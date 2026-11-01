/**
 * Public checkout: one-time credit packs.
 */
import { CREDIT_PACK_SKU_IDS, creditPackById } from "@/lib/credits/constants";

export function creditPackCheckoutPriceData(sku: string) {
  const pack = creditPackById(sku);
  if (!pack) {
    throw new Error(`Unknown credit pack ${sku}`);
  }
  return {
    currency: "usd" as const,
    unit_amount: pack.priceCents,
    product_data: {
      name: `Uncertain Systems — ${pack.name}`,
      description: `${pack.credits} usage credits. One-time payment.`,
    },
  };
}

export function harnessMonthlyCheckoutPriceData() {
  return creditPackCheckoutPriceData("credits_500");
}

export function harnessTrialCheckoutPriceData() {
  return creditPackCheckoutPriceData("credits_100");
}

export const PUBLIC_MODULE_CHECKOUT_PRICE_TYPES = CREDIT_PACK_SKU_IDS;

/** @deprecated Use PUBLIC_MODULE_CHECKOUT_PRICE_TYPES */
export const PUBLIC_HARNESS_CHECKOUT_PRICE_TYPES = PUBLIC_MODULE_CHECKOUT_PRICE_TYPES;
