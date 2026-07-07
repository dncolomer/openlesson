import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { BASE_INCLUDED_LESSONS, BASE_INCLUDED_WORKSPACES } from "@/lib/plans";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

// Use service role for webhook — no user context
function getAdminClient() {
  return createAdminClient();
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const priceType = session.metadata?.price_type;

        if (!userId) break;

        if (priceType === "rabbit_hole_plays") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("rabbit_hole_bonus_plays")
            .eq("id", userId)
            .single();

          await supabase
            .from("profiles")
            .update({ rabbit_hole_bonus_plays: (profile?.rabbit_hole_bonus_plays ?? 0) + 3 })
            .eq("id", userId);
        } else if (priceType === "extra_lesson") {
          const quantity = Math.max(1, Math.min(500, Number(session.metadata?.quantity) || 1));
          // Increment extra_lessons counter
          const { data: profile } = await supabase
            .from("profiles")
            .select("extra_lessons")
            .eq("id", userId)
            .single();

          await supabase
            .from("profiles")
            .update({ extra_lessons: (profile?.extra_lessons ?? 0) + quantity })
            .eq("id", userId);
        }
        // Subscription checkout is handled by customer.subscription.updated
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        const priceType = subscription.metadata?.price_type;
        const monthlyVolume = Math.max(1, Number(subscription.metadata?.monthly_volume) || BASE_INCLUDED_LESSONS[priceType || ""] || 0);
        const monthlyWorkspaceVolume = Math.max(
          1,
          Number(subscription.metadata?.monthly_workspace_volume) || BASE_INCLUDED_WORKSPACES[priceType || ""] || 0
        );
        const plan = priceType === "pro_teams"
          ? "pro_teams"
          : priceType === "regular_2026"
            ? "regular_2026"
            : priceType === "pro"
              ? "pro"
              : "regular";

        // In the 2026 Stripe API, current_period_end lives on subscription items
        const periodEnd = subscription.items?.data?.[0]?.current_period_end;

        await supabase
          .from("profiles")
          .update({
            plan,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status,
            ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
            extra_lessons: Math.max(0, monthlyVolume - (BASE_INCLUDED_LESSONS[plan] || 0)),
            extra_workspaces: Math.max(0, monthlyWorkspaceVolume - (BASE_INCLUDED_WORKSPACES[plan] || 0)),
          })
          .eq("id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        await supabase
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: "canceled",
            stripe_subscription_id: null,
            current_period_end: null,
            extra_lessons: 0,
            extra_workspaces: 0,
          })
          .eq("id", userId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // In the 2026 Stripe API, subscription is under parent.subscription_details
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === "string"
          ? subscriptionRef
          : subscriptionRef?.id ?? null;

        if (!subscriptionId) break;

        // Look up the user by subscription ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (profile) {
          // Reset extra lessons at the start of each new billing period
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
          const priceType = subscription?.metadata?.price_type;
          const plan = priceType === "pro_teams" ? "pro_teams" : priceType === "regular_2026" ? "regular_2026" : null;
          const monthlyVolume = Math.max(0, Number(subscription?.metadata?.monthly_volume) || (plan ? BASE_INCLUDED_LESSONS[plan] : 0));
          const monthlyWorkspaceVolume = Math.max(
            0,
            Number(subscription?.metadata?.monthly_workspace_volume) || (plan ? BASE_INCLUDED_WORKSPACES[plan] : 0)
          );

          await supabase
            .from("profiles")
            .update({
              subscription_status: "active",
              extra_lessons: plan ? Math.max(0, monthlyVolume - BASE_INCLUDED_LESSONS[plan]) : 0,
              extra_workspaces: plan ? Math.max(0, monthlyWorkspaceVolume - BASE_INCLUDED_WORKSPACES[plan]) : 0,
            })
            .eq("id", profile.id);
        }
        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
