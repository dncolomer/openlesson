/**
 * Public module checkout amounts and Stripe price_data.
 */
import {
  LEARN_MONTHLY_PRICE_CENTS,
  TRY_EVERYTHING_PRICE_CENTS,
  moduleSkuCheckoutPriceData,
} from "@/lib/pricing/modules";

export function harnessMonthlyCheckoutPriceData() {
  return moduleSkuCheckoutPriceData("module_learn", LEARN_MONTHLY_PRICE_CENTS, "learn");
}

export function harnessTrialCheckoutPriceData() {
  return moduleSkuCheckoutPriceData("trial_3day", TRY_EVERYTHING_PRICE_CENTS, "trial");
}

export const PUBLIC_MODULE_CHECKOUT_PRICE_TYPES = [
  "trial_3day",
  "module_learn",
  "module_author",
  "module_verify",
  "module_calibrate",
  "bundle_verify_calibrate",
] as const;

/** @deprecated Use PUBLIC_MODULE_CHECKOUT_PRICE_TYPES */
export const PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES = PUBLIC_MODULE_CHECKOUT_PRICE_TYPES;
