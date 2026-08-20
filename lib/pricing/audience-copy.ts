/**
 * Pricing-page copy: individual harness vs business at scale.
 * Driven by the same API Metered rate formatters as the plan card.
 */
import {
  API_METERED_PLATFORM_FEE_CENTS,
  formatIleSessionPrice,
  formatPowApiCallPrice,
  formatTapSessionPrice,
} from "@/lib/plans";

export const PRICING_AYCL_HREF = "/all-you-can-learn" as const;
export const PRICING_AYCL_LABEL = "All-You-Can-Learn";

export function formatApiMeteredPlatformPrice(): string {
  const dollars = API_METERED_PLATFORM_FEE_CENTS / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export const PRICING_AUDIENCE_COPY = {
  individual: {
    eyebrow: "INDIVIDUAL",
    title: "Use the harness yourself",
    body: `One person on API Metered. ${formatApiMeteredPlatformPrice()}/mo platform access, then ${formatTapSessionPrice()} per TAP session and ${formatIleSessionPrice()} per ILE session. You pay for the sessions you run — not a per-seat SKU.`,
  },
  business: {
    eyebrow: "BUSINESS · AT SCALE",
    title: "Run it at scale",
    body: `Many people, same plan. Platform stays ${formatApiMeteredPlatformPrice()}/mo at any volume. Each TAP session is ${formatTapSessionPrice()}, each ILE session is ${formatIleSessionPrice()}, each external/API PoW submission is ${formatPowApiCallPrice()}. Scale is usage on API Metered, not a different product.`,
  },
} as const;

export function getPricingAudienceFullText(
  copy: typeof PRICING_AUDIENCE_COPY = PRICING_AUDIENCE_COPY,
): string {
  return [
    copy.individual.eyebrow,
    copy.individual.title,
    copy.individual.body,
    copy.business.eyebrow,
    copy.business.title,
    copy.business.body,
  ].join("\n");
}
