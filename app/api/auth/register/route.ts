import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimPendingCheckout,
  getPendingCheckoutBySessionId,
  upsertPendingCheckoutFromSession,
} from "@/lib/pending-checkout";
import { emailFromCheckoutSession, isGuestCheckoutPriceType } from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, password } = await request.json();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
    if (stripeSession.payment_status !== "paid" && stripeSession.status !== "complete") {
      return NextResponse.json({ error: "Checkout is not complete yet." }, { status: 400 });
    }

    const admin = createAdminClient();
    let pending = await getPendingCheckoutBySessionId(admin, sessionId);
    const priceType = stripeSession.metadata?.price_type || "";
    if (!pending && priceType && isGuestCheckoutPriceType(priceType)) {
      let subscription = null;
      const subscriptionId =
        typeof stripeSession.subscription === "string"
          ? stripeSession.subscription
          : stripeSession.subscription?.id;
      if (subscriptionId) {
        subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
      }
      pending = await upsertPendingCheckoutFromSession(admin, stripeSession, subscription);
    }
    const email = pending?.email || emailFromCheckoutSession(stripeSession);
    if (!email) {
      return NextResponse.json({ error: "Checkout email not found." }, { status: 400 });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      console.error("createUser error:", createError);
      const message = createError?.message || "Failed to create account";
      if (/already|registered|exists/i.test(message)) {
        return NextResponse.json(
          { error: "An account with this email already exists. Sign in instead.", code: "email_exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const claim = await claimPendingCheckout(admin, sessionId, created.user.id, email);
    if (!claim.ok) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: claim.error }, { status: 400 });
    }

    const stripeCustomerId = pending?.stripe_customer_id;
    const stripeSubscriptionId = pending?.stripe_subscription_id;
    if (stripeCustomerId) {
      await getStripe().customers.update(stripeCustomerId, {
        metadata: { supabase_user_id: created.user.id },
      });
    }
    if (stripeSubscriptionId) {
      await getStripe().subscriptions.update(stripeSubscriptionId, {
        metadata: { supabase_user_id: created.user.id },
      });
    }

    return NextResponse.json({
      ok: true,
      email,
      userId: created.user.id,
    });
  } catch (error) {
    console.error("register error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}