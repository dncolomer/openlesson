import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import {
  creditPackCheckoutPriceData,
  PUBLIC_MODULE_CHECKOUT_PRICE_TYPES,
} from "@/lib/pricing/harness-checkout";
import { API_METERED_PLATFORM_FEE_CENTS } from "@/lib/plans";
import { isCreditPackSkuId } from "@/lib/credits/constants";
import { getAppOrigin } from "@/lib/app-url";
import { checkoutModeForPriceType, type CheckoutPriceType } from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

const GUEST_CHECKOUT_TYPES = new Set<CheckoutPriceType>([
  ...PUBLIC_MODULE_CHECKOUT_PRICE_TYPES,
]);

const CHECKOUT_PRICE_TYPES: CheckoutPriceType[] = [
  ...PUBLIC_MODULE_CHECKOUT_PRICE_TYPES,
  "api_metered",
];

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const { priceType } = body as { priceType?: string };

    if (!priceType || !CHECKOUT_PRICE_TYPES.includes(priceType as CheckoutPriceType)) {
      return jsonError(400, "Invalid price type");
    }
    const priceTypeResolved = priceType as CheckoutPriceType;

    const isGuestCheckout = GUEST_CHECKOUT_TYPES.has(priceTypeResolved) && !user;

    let priceId = "";
    const mode = checkoutModeForPriceType(priceTypeResolved);
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem | null = null;

    let targetPlan = "";
    if (isCreditPackSkuId(priceTypeResolved)) {
      lineItem = {
        price_data: creditPackCheckoutPriceData(priceTypeResolved),
        quantity: 1,
      };
    } else if (priceTypeResolved === "api_metered") {
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: API_METERED_PLATFORM_FEE_CENTS,
          recurring: { interval: "month" as const },
          product_data: {
            name: "Uncertain Systems API Metered",
            description: "All modules plus Proof-of-Work API. $99/mo platform + usage.",
          },
        },
        quantity: 1,
      };
      targetPlan = "api_metered";
    }

    if (!priceId && !lineItem) {
      return jsonError(500, `Stripe price not configured for ${priceTypeResolved}`);
    }

    const origin = request.headers.get("origin") || getAppOrigin(request);

    let customerId: string | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      customerId = profile?.stripe_customer_id ?? undefined;

      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
        } catch {
          customerId = undefined;
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
        await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      }
    }

    const metadata: Record<string, string> = {
      price_type: priceTypeResolved,
      quantity: "1",
      monthly_volume: "0",
      volume_unit: "",
      ...(targetPlan ? { target_plan: targetPlan } : {}),
      ...(user ? { supabase_user_id: user.id } : {}),
    };

    const successUrl = isGuestCheckout
      ? `${origin}/register?session_id={CHECKOUT_SESSION_ID}`
      : user
        ? `${origin}/dashboard?tab=usage&session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      ...(customerId ? { customer: customerId } : {}),
      mode,
      line_items: [
        lineItem ?? { price: priceId, quantity: 1 },
      ],
      success_url: successUrl,
      cancel_url: `${origin}/pricing`,
      metadata,
      ...(mode === "subscription"
        ? {
            subscription_data: {
              metadata,
            },
          }
        : {
            payment_intent_data: { metadata },
          }),
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Create checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(500, "Failed to create checkout session: " + message);
  }
}
