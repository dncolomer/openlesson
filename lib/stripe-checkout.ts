import type Stripe from "stripe";
import {
  BASE_INCLUDED_PROOF_OF_WORK,
  TRIAL_ACCESS_DAYS,
  type PlanId,
} from "@/lib/plans";

export type CheckoutPriceType =
  | "regular"
  | "pro"
  | "regular_2026"
  | "pro_teams"
  | "api_metered"
  | "trial_3day"
  | "extra_lesson"
  | "extra_proof_of_work"
  | "rabbit_hole_plays";

export function isGuestCheckoutPriceType(priceType: string): boolean {
  return [
    "regular",
    "pro",
    "regular_2026",
    "pro_teams",
    "api_metered",
    "trial_3day",
  ].includes(priceType);
}

export function planIdFromPriceType(priceType: string): PlanId {
  if (priceType === "trial_3day") return "trial";
  if (priceType === "api_metered") return "api_metered";
  if (priceType === "pro_teams") return "pro_teams";
  if (priceType === "regular_2026") return "regular_2026";
  if (priceType === "pro") return "pro";
  return "regular";
}

export function checkoutModeForPriceType(priceType: CheckoutPriceType): "subscription" | "payment" {
  if (
    priceType === "trial_3day" ||
    priceType === "extra_lesson" ||
    priceType === "extra_proof_of_work" ||
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

export function extraLessonsForCheckout(
  priceType: string,
  monthlyVolume: number,
  plan: PlanId
): number {
  if (priceType === "trial_3day") return 0;
  const base = BASE_INCLUDED_PROOF_OF_WORK[plan] ?? 0;
  return Math.max(0, monthlyVolume - base);
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
    subscription_status: "active",
    ...(params.stripeCustomerId ? { stripe_customer_id: params.stripeCustomerId } : {}),
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    current_period_end: params.currentPeriodEnd ?? null,
    extra_lessons: extraLessonsForCheckout(params.priceType, params.monthlyVolume, plan),
    extra_workspaces: 0,
  };
}