import type Stripe from "stripe";
import {
  TRIAL_ACCESS_DAYS,
  type PlanId,
} from "@/lib/plans";
import { PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES } from "@/lib/pricing/harness-checkout";

export type CheckoutPriceType =
  | "api_metered"
  | "trial_3day"
  | "all_you_can_learn"
  | "rabbit_hole_plays";

export function isGuestCheckoutPriceType(priceType: string): boolean {
  return (PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES as readonly string[]).includes(priceType);
}

export function planIdFromPriceType(priceType: string): PlanId {
  if (priceType === "trial_3day") return "trial";
  if (priceType === "api_metered") return "api_metered";
  // Unknown / removed legacy price types (regular_2026, pro_teams, etc.) do not grant a paid plan
  return "inactive";
}

export function checkoutModeForPriceType(priceType: CheckoutPriceType): "subscription" | "payment" {
  if (
    priceType === "trial_3day" ||
    priceType === "all_you_can_learn" ||
    priceType === "rabbit_hole_plays"
  ) {
    return "payment";
  }
  return "subscription";
}

export function periodEndForCheckout(priceType: string, subscription?: Stripe.Subscription | null): string | null {
  if (priceType === "trial_3day") {
    const end = new Date();
    end.setDate(end.getDate() + TRIAL_ACCESS_DAYS);
    return end.toISOString();
  }

  const periodEnd = subscription?.items?.data?.[0]?.current_period_end;
  if (periodEnd) {
    return new Date(periodEnd * 1000).toISOString();
  }
  return null;
}

/** Volume overages are no longer sold; always 0 for current checkout types. */
export function extraLessonsForCheckout(
  priceType: string,
  _monthlyVolume: number,
  _plan: PlanId
): number {
  if (priceType === "trial_3day" || priceType === "api_metered") return 0;
  return 0;
}

export function normalizeCheckoutEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export function emailFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  return normalizeCheckoutEmail(
    session.customer_details?.email ||
      session.customer_email ||
      session.metadata?.checkout_email
  );
}

/** Billing fields derived from a checkout (applied to organization, not personal plan). */
export function profileUpdateFromCheckout(params: {
  priceType: string;
  monthlyVolume: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}): {
  plan: PlanId;
  subscription_status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end: string | null;
  extra_lessons: number;
  extra_workspaces: number;
} {
  const plan = planIdFromPriceType(params.priceType);
  return {
    plan,
    subscription_status: plan === "inactive" ? "inactive" : "active",
    ...(params.stripeCustomerId ? { stripe_customer_id: params.stripeCustomerId } : {}),
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    current_period_end: params.currentPeriodEnd ?? null,
    extra_lessons: extraLessonsForCheckout(params.priceType, params.monthlyVolume, plan),
    extra_workspaces: 0,
  };
}

/** Alias: checkout billing is org-level; same field shape as historical profile updates. */
export const orgBillingUpdateFromCheckout = profileUpdateFromCheckout;
