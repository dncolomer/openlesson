import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import {
  API_METERED_PLATFORM_FEE_CENTS,
  formatIleSessionPrice,
  formatPowApiCallPrice,
  formatTapSessionPrice,
  TRIAL_PRICE_CENTS,
} from "@/lib/plans";
import {
  ayclPriceCentsForTier,
  ayclPurchaseEligibleForUpgrade,
  createPendingAyclPurchase,
  getAyclPurchaseByToken,
  normalizeAyclAccessTier,
  type AyclAccessTier,
} from "@/lib/aycl";
import {
  ayclOfferDescription,
  ayclOfferLabel,
  ayclUpgradeOfferDescription,
  ayclUpgradeOfferLabel,
  AYCL_UPGRADE_PRICE_CENTS,
  isAyclAccessTier,
} from "@/lib/aycl-shared";
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

    const body = await request.json();
    const {
      priceType,
      workspaceId: rawWorkspaceId,
      ayclAccessTier: rawTier,
      ayclToken: rawAyclToken,
      upgradeFromPurchaseId: rawUpgradeId,
    } = body as {
      priceType?: string;
      workspaceId?: string;
      ayclAccessTier?: string;
      ayclToken?: string;
      upgradeFromPurchaseId?: string;
    };

    if (
      !priceType ||
      ![
        "api_metered",
        "trial_3day",
        "all_you_can_learn",
        "rabbit_hole_plays",
      ].includes(priceType)
    ) {
      return NextResponse.json({ error: "Invalid price type" }, { status: 400 });
    }
    const priceTypeResolved = priceType as CheckoutPriceType;

    const workspaceId = typeof rawWorkspaceId === "string" ? rawWorkspaceId.trim() : "";
    const ayclTokenEarly =
      typeof rawAyclToken === "string" ? rawAyclToken.trim() : "";
    const upgradeFromIdEarly =
      typeof rawUpgradeId === "string" ? rawUpgradeId.trim() : "";
    // Fresh purchase needs catalog workspaceId; upgrade uses token / purchase id.
    if (
      priceTypeResolved === "all_you_can_learn" &&
      !workspaceId &&
      !ayclTokenEarly &&
      !upgradeFromIdEarly
    ) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const isGuestCheckout = GUEST_CHECKOUT_TYPES.has(priceTypeResolved) && !user;

    if (priceTypeResolved === "rabbit_hole_plays" && !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let priceId = "";
    const mode = checkoutModeForPriceType(priceTypeResolved);
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem | null = null;

    if (priceTypeResolved === "api_metered") {
      lineItem = {
        price_data: {
          currency: "usd",
          unit_amount: API_METERED_PLATFORM_FEE_CENTS,
          recurring: { interval: "month" },
          product_data: {
            name: "Uncertain Systems API Metered — platform access",
            description: `Usage billed monthly: ${formatPowApiCallPrice()} per external/API PoW, ${formatTapSessionPrice()} per TAP session, ${formatIleSessionPrice()} per ILE session. TAP/ILE-generated PoW is not billed as API PoW.`,
          },
        },
        quantity: 1,
      };
    } else if (priceTypeResolved === "trial_3day") {
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
    } else if (priceTypeResolved === "all_you_can_learn") {
      const admin = createAdminClient();
      const upgradeFromId =
        typeof rawUpgradeId === "string" ? rawUpgradeId.trim() : "";
      const ayclTokenIn =
        typeof rawAyclToken === "string" ? rawAyclToken.trim() : "";
      const isUpgradeCheckout = Boolean(upgradeFromId || ayclTokenIn);

      if (isUpgradeCheckout) {
        // Promote existing practice-access purchase → full (same fork + link).
        let purchase =
          upgradeFromId
            ? (
                await admin
                  .from("aycl_purchases")
                  .select("*")
                  .eq("id", upgradeFromId)
                  .eq("status", "completed")
                  .maybeSingle()
              ).data
            : null;
        if (!purchase && ayclTokenIn) {
          purchase = await getAyclPurchaseByToken(admin, ayclTokenIn);
        }
        if (!purchase || !ayclPurchaseEligibleForUpgrade(purchase as import("@/lib/aycl").AyclPurchase)) {
          return NextResponse.json(
            { error: "This access cannot be upgraded (already full or invalid)." },
            { status: 400 },
          );
        }
        const { data: catalogWorkspace } = await admin
          .from("workspaces")
          .select("id, title, root_topic")
          .eq("id", purchase.source_workspace_id)
          .single();
        const workspaceTitle =
          catalogWorkspace?.title ||
          catalogWorkspace?.root_topic ||
          "Learning Workspace";
        lineItem = {
          price_data: {
            currency: "usd",
            unit_amount: AYCL_UPGRADE_PRICE_CENTS,
            product_data: {
              name: `Unlock creation: ${workspaceTitle}`,
              description: ayclUpgradeOfferDescription(),
            },
          },
          quantity: 1,
        };
        // Stash for metadata block below via mutable locals
        (body as { __ayclUpgradePurchaseId?: string }).__ayclUpgradePurchaseId =
          purchase.id;
        (body as { __ayclUpgradeSourceWorkspaceId?: string }).__ayclUpgradeSourceWorkspaceId =
          purchase.source_workspace_id;
      } else {
        const { data: catalogWorkspace } = await admin
          .from("workspaces")
          .select("id, title, root_topic, is_all_you_can_learn")
          .eq("id", workspaceId)
          .single();

        if (!catalogWorkspace?.is_all_you_can_learn) {
          return NextResponse.json(
            { error: "Workspace is not available for All-You-Can-Learn" },
            { status: 404 },
          );
        }

        const tier: AyclAccessTier = isAyclAccessTier(rawTier)
          ? rawTier
          : normalizeAyclAccessTier(rawTier || "full");
        const workspaceTitle =
          catalogWorkspace.title || catalogWorkspace.root_topic || "Learning Workspace";
        lineItem = {
          price_data: {
            currency: "usd",
            unit_amount: ayclPriceCentsForTier(tier),
            product_data: {
              name: `${ayclOfferLabel(tier)}: ${workspaceTitle}`,
              description: ayclOfferDescription(tier),
            },
          },
          quantity: 1,
        };
        (body as { __ayclAccessTier?: AyclAccessTier }).__ayclAccessTier = tier;
      }
    } else {
      priceId = process.env.STRIPE_PRICE_RABBIT_HOLE || "";
    }

    if (!priceId && !lineItem && priceTypeResolved !== "rabbit_hole_plays") {
      return NextResponse.json(
        { error: `Stripe price not configured for ${priceTypeResolved}` },
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

    const ayclUpgradePurchaseId = (body as { __ayclUpgradePurchaseId?: string })
      .__ayclUpgradePurchaseId;
    const ayclUpgradeSourceWorkspaceId = (
      body as { __ayclUpgradeSourceWorkspaceId?: string }
    ).__ayclUpgradeSourceWorkspaceId;
    const ayclAccessTierResolved = (body as { __ayclAccessTier?: AyclAccessTier })
      .__ayclAccessTier;

    const metadata: Record<string, string> = {
      price_type: priceTypeResolved,
      quantity: "1",
      monthly_volume: "0",
      volume_unit: "",
      ...(user ? { supabase_user_id: user.id } : {}),
      ...(priceTypeResolved === "all_you_can_learn" && workspaceId
        ? { workspace_id: workspaceId }
        : {}),
      ...(priceTypeResolved === "all_you_can_learn" && ayclUpgradeSourceWorkspaceId
        ? { workspace_id: ayclUpgradeSourceWorkspaceId }
        : {}),
      ...(ayclAccessTierResolved
        ? { aycl_access_tier: ayclAccessTierResolved }
        : {}),
      ...(ayclUpgradePurchaseId
        ? {
            aycl_upgrade: "1",
            upgrade_from_purchase_id: ayclUpgradePurchaseId,
          }
        : {}),
    };

    const successUrl =
      priceTypeResolved === "all_you_can_learn"
        ? `${origin}/all-you-can-learn/success?session_id={CHECKOUT_SESSION_ID}`
        : isGuestCheckout
          ? `${origin}/register?session_id={CHECKOUT_SESSION_ID}`
          : priceTypeResolved === "rabbit_hole_plays"
            ? `${origin}/rabbit-hole?unlocked=1`
            : `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      priceTypeResolved === "all_you_can_learn"
        ? `${origin}/all-you-can-learn`
        : priceTypeResolved === "rabbit_hole_plays"
          ? `${origin}/rabbit-hole`
          : `${origin}/pricing`;

    const session = await stripe.checkout.sessions.create({
      ...(customerId ? { customer: customerId } : {}),
      mode,
      line_items: [
        lineItem ??
          (priceTypeResolved === "rabbit_hole_plays" && !priceId
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
    if (priceTypeResolved === "all_you_can_learn" && !ayclUpgradePurchaseId) {
      const admin = createAdminClient();
      const pending = await createPendingAyclPurchase(admin, {
        sourceWorkspaceId: workspaceId,
        stripeCheckoutSessionId: session.id,
        purchaserEmail: user?.email ?? null,
        accessTier: ayclAccessTierResolved || "full",
      });
      ayclAccessToken = pending.accessToken;
    } else if (
      priceTypeResolved === "all_you_can_learn" &&
      ayclUpgradePurchaseId &&
      ayclTokenEarly
    ) {
      // Same lifetime access token as the practice purchase (no new hash/link).
      ayclAccessToken = ayclTokenEarly;
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
