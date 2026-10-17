/**
 * Learning pricing copy. Amounts come from shipped plan constants.
 * Public pricing is the unified page; these fields remain for product-page CTAs.
 */
import {
  formatHarnessMonthlyPrice,
  formatHarnessTrialPrice,
} from "@/lib/plans";
import { AYCL_PATH } from "@/lib/marketing/paths";
import { HARNESS_PRICING_THESIS_LINKS } from "@/lib/science/hub";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";

export const PRICING_AYCL_HREF = AYCL_PATH;
export const PRICING_AYCL_CTA = UNIFIED_PRICING_COPY.ayclCta;
export const PRICING_AYCL_LABEL = UNIFIED_PRICING_COPY.ayclLabel;

export const HARNESS_PRICING_COPY = {
  eyebrow: UNIFIED_PRICING_COPY.eyebrow,
  title: UNIFIED_PRICING_COPY.title,
  lead: UNIFIED_PRICING_COPY.lead,
  monthlyLabel: "Monthly",
  monthlyName: "Learning",
  monthlyPrice: formatHarnessMonthlyPrice(),
  monthlyCadence: "/ month",
  monthlyBody: "Learning workspaces and Learn sessions at a fixed monthly price.",
  monthlyCta: "Get Learning",
  trialCta: `Try everything for 3 days for ${formatHarnessTrialPrice()}`,
  trialPrice: formatHarnessTrialPrice(),
  needsPlan: UNIFIED_PRICING_COPY.needsPlan,
  features: [
    `${formatHarnessMonthlyPrice()} Learning monthly`,
    `Try everything for 3 days for ${formatHarnessTrialPrice()}`,
    "Course authoring, Verification, and Calibration as separate modules",
    "All-You-Can-Learn catalog available as lifetime buys",
  ],
  ayclHref: PRICING_AYCL_HREF,
  ayclCta: PRICING_AYCL_CTA,
  ayclLabel: PRICING_AYCL_LABEL,
  thesisLead:
    "You are paying for time in the foraging loop and the measurement modules.",
  thesisLinks: HARNESS_PRICING_THESIS_LINKS,
} as const;
