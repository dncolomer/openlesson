import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateApiMeteredInvoice,
  formatIleSessionPrice,
  formatPowApiCallPrice,
  formatTapSessionPrice,
} from "@/lib/plans";
import { upsertPendingCheckoutFromSession } from "@/lib/pending-checkout";
import {
  isGuestCheckoutPriceType,
  periodEndForCheckout,
  profileUpdateFromCheckout,
} from "@/lib/stripe-checkout";
import { fulfillAyclPurchase } from "@/lib/aycl";
import {
  countIleSessions,
  countOrgIleSessions,
  countOrgTapSessions,
  countPowApiSubmissions,
  countTapSessions,
} from "@/lib/usage-metrics";
import {
  applyBillingToUserOrganization,
  cancelOrgBillingForUser,
} from "@/lib/organization/apply-org-billing";

export const runtime = "nodejs";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-01-28.clover",
  });
}

function getAdminClient() {
  return createAdminClient();
}

/** Only api_metered remains as a subscription plan id from Stripe price_type. */
function subscriptionPlanFromPriceType(priceType: string | null | undefined): "api_metered" | null {
  if (priceType === "api_metered") return "api_metered";
  // Legacy Individual / Teams price types are no longer applied as distinct plans.
  // In-app migration moves those entitlements to api_metered; new Stripe events for
  // old price objects are ignored so we do not reintroduce removed tier names.
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
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
        const priceType = session.metadata?.price_type || "";

        if (priceType === "all_you_can_learn") {
          await fulfillAyclPurchase(supabase, session);
          break;
        }

        if (!userId && priceType && isGuestCheckoutPriceType(priceType)) {
          let subscription: Stripe.Subscription | null = null;
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          if (subscriptionId) {
            subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
          }
          await upsertPendingCheckoutFromSession(supabase, session, subscription);
          break;
        }

        if (!userId) break;

        if (priceType === "trial_3day") {
          const stripeCustomerId =
            typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
          const update = profileUpdateFromCheckout({
            priceType,
            monthlyVolume: 0,
            stripeCustomerId,
            stripeSubscriptionId: null,
            currentPeriodEnd: periodEndForCheckout(priceType),
          });
          await applyBillingToUserOrganization(supabase, {
            userId,
            plan: update.plan,
            subscriptionStatus: update.subscription_status,
            currentPeriodEnd: update.current_period_end,
            extraLessons: update.extra_lessons,
            stripeCustomerId,
            stripeSubscriptionId: null,
          });
        } else if (priceType === "rabbit_hole_plays") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("rabbit_hole_bonus_plays")
            .eq("id", userId)
            .single();

          await supabase
            .from("profiles")
            .update({ rabbit_hole_bonus_plays: (profile?.rabbit_hole_bonus_plays ?? 0) + 3 })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        const priceType = subscription.metadata?.price_type;
        const plan = subscriptionPlanFromPriceType(priceType);

        if (!plan) {
          console.warn(
            `[stripe webhook] Ignoring subscription for unsupported price_type=${priceType ?? "null"} user=${userId}`
          );
          break;
        }

        const periodEnd = subscription.items?.data?.[0]?.current_period_end;
        const stripeCustomerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null;

        await applyBillingToUserOrganization(supabase, {
          userId,
          plan,
          subscriptionStatus:
            subscription.status === "active" || subscription.status === "trialing"
              ? "active"
              : subscription.status,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          extraLessons: 0,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        await cancelOrgBillingForUser(supabase, userId);
        break;
      }

      case "invoice.created": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.status !== "draft") break;

        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;
        if (!subscriptionId) break;

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
        if (!subscription || subscription.metadata?.price_type !== "api_metered") break;

        const userId = subscription.metadata.supabase_user_id;
        if (!userId) break;

        const periodStartUnix = subscription.items?.data?.[0]?.current_period_start;
        const periodStart = periodStartUnix ? new Date(periodStartUnix * 1000) : null;

        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();

        let externalPow = 0;
        let tapSessions = 0;
        let ileSessions = 0;

        if (profile?.organization_id) {
          const { data: members } = await supabase
            .from("profiles")
            .select("id")
            .eq("organization_id", profile.organization_id);
          const memberIds = (members || []).map((m) => m.id);
          for (const m of members || []) {
            externalPow += await countPowApiSubmissions(supabase, m.id, periodStart);
          }
          if (periodStart && memberIds.length > 0) {
            tapSessions = await countOrgTapSessions(supabase, memberIds, periodStart);
            ileSessions = await countOrgIleSessions(supabase, memberIds, periodStart);
          }
        } else {
          externalPow = await countPowApiSubmissions(supabase, userId, periodStart);
          tapSessions = await countTapSessions(supabase, userId, periodStart);
          ileSessions = await countIleSessions(supabase, userId, periodStart);
        }

        const estimate = estimateApiMeteredInvoice(externalPow, tapSessions, ileSessions);
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

        if (customerId && invoice.id && estimate.usageCentsRounded > 0) {
          // Prefer separate line items when each component has whole-cent amount;
          // otherwise one combined usage line with rounded total (sub-cent PoW).
          const powRounded = Math.round(estimate.externalPowCents);
          const tapRounded = estimate.tapSessionCents;
          const ileRounded = estimate.ileSessionCents;

          if (powRounded > 0) {
            await getStripe().invoiceItems.create({
              customer: customerId,
              invoice: invoice.id,
              description: `${externalPow.toLocaleString()} external/API Proof-of-Work submission${externalPow === 1 ? "" : "s"} @ ${formatPowApiCallPrice()} (rounded to whole cents)`,
              amount: powRounded,
              currency: "usd",
            });
          }
          if (tapRounded > 0) {
            await getStripe().invoiceItems.create({
              customer: customerId,
              invoice: invoice.id,
              description: `${tapSessions.toLocaleString()} TAP session${tapSessions === 1 ? "" : "s"} @ ${formatTapSessionPrice()}`,
              amount: tapRounded,
              currency: "usd",
            });
          }
          if (ileRounded > 0) {
            await getStripe().invoiceItems.create({
              customer: customerId,
              invoice: invoice.id,
              description: `${ileSessions.toLocaleString()} ILE session${ileSessions === 1 ? "" : "s"} @ ${formatIleSessionPrice()}`,
              amount: ileRounded,
              currency: "usd",
            });
          }

          // Catch fractional PoW remainder if component rounding undershoots total
          const componentsSum = powRounded + tapRounded + ileRounded;
          const remainder = estimate.usageCentsRounded - componentsSum;
          if (remainder > 0) {
            await getStripe().invoiceItems.create({
              customer: customerId,
              invoice: invoice.id,
              description: "API Metered usage rounding adjustment",
              amount: remainder,
              currency: "usd",
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null;

        if (!subscriptionId) break;

        // Prefer org by stripe_subscription_id, then profile
        let userId: string | null = null;
        const { data: orgBySub } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (orgBySub) {
          const { data: adminMember } = await supabase
            .from("profiles")
            .select("id")
            .eq("organization_id", orgBySub.id)
            .eq("is_org_admin", true)
            .limit(1)
            .maybeSingle();
          userId = adminMember?.id ?? null;
          if (!userId) {
            const { data: anyMember } = await supabase
              .from("profiles")
              .select("id")
              .eq("organization_id", orgBySub.id)
              .limit(1)
              .maybeSingle();
            userId = anyMember?.id ?? null;
          }
        }

        if (!userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();
          userId = profile?.id ?? null;
        }

        if (!userId) break;

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
        const priceType = subscription?.metadata?.price_type;
        const plan = subscriptionPlanFromPriceType(priceType);
        const periodEnd = subscription?.items?.data?.[0]?.current_period_end;

        if (plan) {
          await applyBillingToUserOrganization(supabase, {
            userId,
            plan,
            subscriptionStatus: "active",
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            extraLessons: 0,
            stripeSubscriptionId: subscriptionId,
          });
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
