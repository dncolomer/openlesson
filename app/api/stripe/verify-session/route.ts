import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPendingCheckoutBySessionId,
  pendingCheckoutIsClaimable,
  upsertPendingCheckoutFromSession,
} from "@/lib/pending-checkout";
import { emailFromCheckoutSession, isGuestCheckoutPriceType, planIdFromPriceType } from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = new URL(request.url).searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Checkout is not complete yet." }, { status: 400 });
    }

    const admin = createAdminClient();
    let pending = await getPendingCheckoutBySessionId(admin, sessionId);
    const priceType = session.metadata?.price_type || pending?.price_type || "";
    if (!pending && priceType && isGuestCheckoutPriceType(priceType)) {
      let subscription = null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
      }
      pending = await upsertPendingCheckoutFromSession(admin, session, subscription);
    }
    const email = pending?.email || emailFromCheckoutSession(session);
    if (!email) {
      return NextResponse.json({ error: "Checkout email not found." }, { status: 400 });
    }

    const plan = pending?.plan || planIdFromPriceType(priceType);

    return NextResponse.json({
      ok: true,
      email,
      priceType,
      plan,
      claimable: pendingCheckoutIsClaimable(pending),
      claimed: Boolean(pending?.claimed_at),
      periodEnd: pending?.current_period_end ?? null,
    });
  } catch (error) {
    console.error("verify-session error:", error);
    return NextResponse.json({ error: "Invalid or expired checkout session." }, { status: 400 });
  }
}