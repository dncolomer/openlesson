import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillAyclPurchase, getAyclPurchaseByCheckoutSession } from "@/lib/aycl";

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

    const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
    if (stripeSession.payment_status !== "paid" && stripeSession.status !== "complete") {
      return NextResponse.json({ ready: false, error: "Payment not complete yet" }, { status: 202 });
    }

    const admin = createAdminClient();
    let purchase = await getAyclPurchaseByCheckoutSession(admin, sessionId);

    if (!purchase || purchase.status !== "completed") {
      await fulfillAyclPurchase(admin, stripeSession);
      purchase = await getAyclPurchaseByCheckoutSession(admin, sessionId);
    }

    if (!purchase || purchase.status !== "completed" || !purchase.forked_workspace_id) {
      return NextResponse.json({ ready: false }, { status: 202 });
    }

    return NextResponse.json({
      ready: true,
      forkedWorkspaceId: purchase.forked_workspace_id,
      sourceWorkspaceId: purchase.source_workspace_id,
    });
  } catch (error) {
    console.error("[aycl/verify-session]", error);
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }
}