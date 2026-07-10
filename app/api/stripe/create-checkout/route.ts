import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import {
  REGULAR_VOLUME_PRICES,
  TEAM_VOLUME_PRICES,
  resolveCheckoutVolume,
  resolveCheckoutWorkspaceVolume,
  getExtraBlockPriceCents,
} from "@/lib/plans";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { priceType, quantity: rawQuantity, monthlyVolume: rawMonthlyVolume } = await request.json();
    const quantity = priceType === "extra_lesson"
      ? Math.max(1, Math.min(500, Number(rawQuantity) || 1))
      : 1;
    const monthlyVolume = resolveCheckoutVolume(priceType, rawMonthlyVolume);
    const monthlyWorkspaceVolume = resolveCheckoutWorkspaceVolume(priceType, monthlyVolume);

    if (!["regular", "pro", "regular_2026", "pro_teams", "extra_lesson", "rabbit_hole_plays"].includes(priceType)) {
      return NextResponse.json({ error: "Invalid price type" }, { status: 400 });
    }

    // Resolve the Stripe Price ID from env
    let priceId = "";
    let mode: "subscription" | "payment";
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem | null = null;

    if (priceType === "regular") {
      priceId = process.env.STRIPE_PRICE_REGULAR || "";
      mode = "subscription";
    } else if (priceType === "pro") {
      priceId = process.env.STRIPE_PRICE_PRO || "";
      mode = "subscription";
    } else if (priceType === "regular_2026") {
      mode = "subscription";
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: REGULAR_VOLUME_PRICES[monthlyVolume],
          recurring: { interval: "month" },
          product_data: {
            name: `openLesson Individual - ${monthlyVolume} TAP/ILE sessions/mo · ${monthlyVolume * 4} evidence/mo · ${monthlyWorkspaceVolume} workspace${monthlyWorkspaceVolume === 1 ? "" : "s"}`,
          },
        },
        quantity: 1,
      };
    } else if (priceType === "pro_teams") {
      mode = "subscription";
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: TEAM_VOLUME_PRICES[monthlyVolume],
          recurring: { interval: "month" },
          product_data: {
            name: `openLesson Pro / Teams - ${monthlyVolume} TAP/ILE sessions/mo · ${monthlyVolume * 4} evidence/mo · ${monthlyWorkspaceVolume} workspaces`,
          },
        },
        quantity: 1,
      };
    } else if (priceType === "extra_lesson") {
      const { data: planProfile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      const unitAmount = getExtraBlockPriceCents(planProfile?.plan);
      mode = "payment";
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name:
              planProfile?.plan === "pro_teams" || planProfile?.plan === "pro"
                ? "Additional TAP / ILE session - Pro / Teams"
                : "Additional TAP / ILE session",
          },
        },
        quantity,
      };
    } else {
      priceId = process.env.STRIPE_PRICE_RABBIT_HOLE || "";
      mode = "payment";
    }

    if (!priceId && !lineItem && priceType !== "rabbit_hole_plays") {
      return NextResponse.json(
        { error: `Stripe price not configured for ${priceType}` },
        { status: 500 }
      );
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      line_items: [lineItem ?? (priceType === "rabbit_hole_plays" && !priceId
        ? {
            price_data: {
              currency: "usd",
              unit_amount: 199,
              product_data: { name: "3 Rabbit Hole plays" },
            },
            quantity: 1,
          }
        : { price: priceId, quantity: 1 })],
      success_url: priceType === "rabbit_hole_plays" ? `${origin}/rabbit-hole?unlocked=1` : `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: priceType === "rabbit_hole_plays" ? `${origin}/rabbit-hole` : `${origin}/pricing`,
      metadata: {
        supabase_user_id: user.id,
        price_type: priceType,
        quantity: String(quantity),
        monthly_volume: String(monthlyVolume),
        monthly_workspace_volume: String(monthlyWorkspaceVolume),
      },
      ...(mode === "subscription"
        ? {
            subscription_data: {
              metadata: {
                supabase_user_id: user.id,
                price_type: priceType,
                monthly_volume: String(monthlyVolume),
                monthly_workspace_volume: String(monthlyWorkspaceVolume),
              },
            },
          }
        : { payment_intent_data: { metadata: { supabase_user_id: user.id, price_type: priceType } } }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Create checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create checkout session: " + message }, { status: 500 });
  }
}
