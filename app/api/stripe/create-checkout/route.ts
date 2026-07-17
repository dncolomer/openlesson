import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import {
  API_METERED_PLATFORM_FEE_CENTS,
  EXTRA_PROOF_OF_WORK_PACK_SIZE,
  POW_API_CALL_PRICE_CENTS,
  REGULAR_VOLUME_PRICES,
  TEAM_VOLUME_PRICES,
  TRIAL_PRICE_CENTS,
  resolveCheckoutVolume,
  getExtraProofOfWorkPackPriceCents,
} from "@/lib/plans";
import { AYCL_PRICE_CENTS, createPendingAyclPurchase } from "@/lib/aycl";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppOrigin } from "@/lib/app-url";
import { checkoutModeForPriceType, type CheckoutPriceType } from "@/lib/stripe-checkout";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

const GUEST_CHECKOUT_TYPES = new Set<CheckoutPriceType>([
  "regular",
  "pro",
  "regular_2026",
  "pro_teams",
  "api_metered",
  "trial_3day",
]);

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const {
      priceType,
      quantity: rawQuantity,
      monthlyVolume: rawMonthlyVolume,
      workspaceId: rawWorkspaceId,
    } = await request.json();
    const quantity =
      priceType === "extra_lesson" || priceType === "extra_proof_of_work"
        ? Math.max(1, Math.min(500, Number(rawQuantity) || 1))
        : 1;
    const monthlyVolume = resolveCheckoutVolume(priceType, rawMonthlyVolume);

    if (
      ![
        "regular",
        "pro",
        "regular_2026",
        "pro_teams",
        "api_metered",
        "trial_3day",
        "all_you_can_learn",
        "extra_lesson",
        "extra_proof_of_work",
        "rabbit_hole_plays",
      ].includes(priceType)
    ) {
      return NextResponse.json({ error: "Invalid price type" }, { status: 400 });
    }

    const workspaceId = typeof rawWorkspaceId === "string" ? rawWorkspaceId.trim() : "";
    if (priceType === "all_you_can_learn" && !workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const isGuestCheckout = GUEST_CHECKOUT_TYPES.has(priceType as CheckoutPriceType) && !user;

    if ((priceType === "extra_lesson" || priceType === "extra_proof_of_work" || priceType === "rabbit_hole_plays") && !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let priceId = "";
    const mode = checkoutModeForPriceType(priceType as CheckoutPriceType);
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem | null = null;

    if (priceType === "regular") {
      priceId = process.env.STRIPE_PRICE_REGULAR || "";
    } else if (priceType === "pro") {
      priceId = process.env.STRIPE_PRICE_PRO || "";
    } else if (priceType === "regular_2026") {
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: REGULAR_VOLUME_PRICES[monthlyVolume],
          recurring: { interval: "month" },
          product_data: {
            name: `Uncertain Systems Individual - ${monthlyVolume.toLocaleString()} Proof-of-Work submissions/mo`,
          },
        },
        quantity: 1,
      };
    } else if (priceType === "pro_teams") {
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: TEAM_VOLUME_PRICES[monthlyVolume],
          recurring: { interval: "month" },
          product_data: {
            name: `Uncertain Systems Pro / Teams - ${monthlyVolume.toLocaleString()} Proof-of-Work submissions/mo`,
          },
        },
        quantity: 1,
      };
    } else if (priceType === "api_metered") {
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: API_METERED_PLATFORM_FEE_CENTS,
          recurring: { interval: "month" },
          product_data: {
            name: "Uncertain Systems API Metered — platform access",
            description: `Unlimited API usage. Proof-of-Work API submissions billed at $${(POW_API_CALL_PRICE_CENTS / 100).toFixed(2)} each on your monthly invoice.`,
          },
        },
        quantity: 1,
      };
    } else if (priceType === "trial_3day") {
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: TRIAL_PRICE_CENTS,
          product_data: {
            name: "Uncertain Systems 3-Day Trial",
            description: "Full access for 3 days. One-time payment.",
          },
        },
        quantity: 1,
      };
    } else if (priceType === "all_you_can_learn") {
      const admin = createAdminClient();
      const { data: catalogWorkspace } = await admin
        .from("workspaces")
        .select("id, title, root_topic, is_all_you_can_learn")
        .eq("id", workspaceId)
        .single();

      if (!catalogWorkspace?.is_all_you_can_learn) {
        return NextResponse.json({ error: "Workspace is not available for All-You-Can-Learn" }, { status: 404 });
      }

      const workspaceTitle = catalogWorkspace.title || catalogWorkspace.root_topic || "Learning Workspace";
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: AYCL_PRICE_CENTS,
          product_data: {
            name: `All-You-Can-Learn: ${workspaceTitle}`,
            description: "Lifetime access to your personal copy. ILE included. No account required.",
          },
        },
        quantity: 1,
      };
    } else if (priceType === "extra_lesson" || priceType === "extra_proof_of_work") {
      const { data: planProfile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user!.id)
        .single();
      const unitAmount = getExtraProofOfWorkPackPriceCents(planProfile?.plan);
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name:
              planProfile?.plan === "pro_teams" || planProfile?.plan === "pro"
                ? `Additional Proof-of-Work pack (${EXTRA_PROOF_OF_WORK_PACK_SIZE} submissions) - Pro / Teams`
                : `Additional Proof-of-Work pack (${EXTRA_PROOF_OF_WORK_PACK_SIZE} submissions)`,
          },
        },
        quantity,
      };
    } else {
      priceId = process.env.STRIPE_PRICE_RABBIT_HOLE || "";
    }

    if (!priceId && !lineItem && priceType !== "rabbit_hole_plays") {
      return NextResponse.json(
        { error: `Stripe price not configured for ${priceType}` },
        { status: 500 }
      );
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
      price_type: priceType,
      quantity: String(quantity),
      monthly_volume: String(monthlyVolume),
      volume_unit: priceType === "regular_2026" || priceType === "pro_teams" ? "proof_of_work" : "",
      ...(user ? { supabase_user_id: user.id } : {}),
      ...(priceType === "all_you_can_learn" ? { workspace_id: workspaceId } : {}),
    };

    const successUrl =
      priceType === "all_you_can_learn"
        ? `${origin}/all-you-can-learn/success?session_id={CHECKOUT_SESSION_ID}`
        : isGuestCheckout
          ? `${origin}/register?session_id={CHECKOUT_SESSION_ID}`
          : priceType === "rabbit_hole_plays"
            ? `${origin}/rabbit-hole?unlocked=1`
            : `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      priceType === "all_you_can_learn"
        ? `${origin}/all-you-can-learn`
        : priceType === "rabbit_hole_plays"
          ? `${origin}/rabbit-hole`
          : `${origin}/pricing`;

    const session = await stripe.checkout.sessions.create({
      ...(customerId ? { customer: customerId } : {}),
      mode,
      line_items: [
        lineItem ??
          (priceType === "rabbit_hole_plays" && !priceId
            ? {
                price_data: {
                  currency: "usd",
                  unit_amount: 199,
                  product_data: { name: "3 Rabbit Hole plays" },
                },
                quantity: 1,
              }
            : { price: priceId, quantity: 1 }),
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
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

    let ayclAccessToken: string | undefined;
    if (priceType === "all_you_can_learn") {
      const admin = createAdminClient();
      const pending = await createPendingAyclPurchase(admin, {
        sourceWorkspaceId: workspaceId,
        stripeCheckoutSessionId: session.id,
        purchaserEmail: user?.email ?? null,
      });
      ayclAccessToken = pending.accessToken;
    }

    return NextResponse.json({
      url: session.url,
      ...(ayclAccessToken ? { ayclAccessToken } : {}),
    });
  } catch (error) {
    console.error("Create checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create checkout session: " + message }, { status: 500 });
  }
}