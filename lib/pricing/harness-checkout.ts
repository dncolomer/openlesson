/**
 * Public Learning Harness checkout amounts and Stripe price_data.
 * Guest / public-link registration sells only these SKUs — not verification.
 */
import {
  HARNESS_MONTHLY_PRICE_CENTS,
  TRIAL_PRICE_CENTS,
} from "@/lib/plans";

export function harnessMonthlyCheckoutPriceData() {
  return {
    currency: "usd" as const,
    unit_amount: HARNESS_MONTHLY_PRICE_CENTS,
    recurring: { interval: "month" as const },
    product_data: {
      name: "Uncertain Systems Learning Harness",
      description: "Fixed monthly subscription. Unlimited Learning Harness access.",
    },
  };
}

export function harnessTrialCheckoutPriceData() {
  return {
    currency: "usd" as const,
    unit_amount: TRIAL_PRICE_CENTS,
    product_data: {
      name: "Uncertain Systems Learning Harness — 3-day unlimited trial",
      description: "Try unlimited for 3 days. One-time payment.",
    },
  };
}

export const PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES = ["api_metered", "trial_3day"] as const;
