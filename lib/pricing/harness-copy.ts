/**
 * Learning pricing copy. Amounts come from shipped credit constants.
 */
import { CREDIT_PACKS, FLOW_SESSION_CREDIT_COST, STARTER_CREDIT_GRANT } from "@/lib/credits/constants";
import { formatUsdFromCents } from "@/lib/pricing/modules";
import { AYCL_PATH } from "@/lib/marketing/paths";
import { HARNESS_PRICING_THESIS_LINKS } from "@/lib/science/hub";
import { UNIFIED_PRICING_COPY } from "@/lib/pricing/unified-copy";

export const PRICING_AYCL_HREF = AYCL_PATH;
export const PRICING_AYCL_CTA = UNIFIED_PRICING_COPY.ayclCta;
export const PRICING_AYCL_LABEL = UNIFIED_PRICING_COPY.ayclLabel;

const highlightedPack = CREDIT_PACKS.find((pack) => pack.highlighted) ?? CREDIT_PACKS[1];
const starterPack = CREDIT_PACKS[0];

export const HARNESS_PRICING_COPY = {
  eyebrow: UNIFIED_PRICING_COPY.eyebrow,
  title: UNIFIED_PRICING_COPY.title,
  lead: UNIFIED_PRICING_COPY.lead,
  monthlyLabel: "Credits",
  monthlyName: highlightedPack.name,
  monthlyPrice: formatUsdFromCents(highlightedPack.priceCents),
  monthlyCadence: "one-time",
  monthlyBody: "One-time credit packs. Creating maps is free; running sessions spends credits.",
  monthlyCta: highlightedPack.cta,
  trialCta: `Start free with ${STARTER_CREDIT_GRANT} credits`,
  trialPrice: "$0",
  needsPlan: UNIFIED_PRICING_COPY.needsPlan,
  features: [
    `${STARTER_CREDIT_GRANT} starter credits on free signup`,
    `${FLOW_SESSION_CREDIT_COST} credits per Calibrate, Learn, Verify, or Solve session`,
    `${starterPack.name} for ${formatUsdFromCents(starterPack.priceCents)} one-time`,
    "All-You-Can-Learn catalog available as lifetime buys",
  ],
  ayclHref: PRICING_AYCL_HREF,
  ayclCta: PRICING_AYCL_CTA,
  ayclLabel: PRICING_AYCL_LABEL,
  thesisLead:
    "You are paying credits to run Solving, Learn, Verify, and Calibrate sessions.",
  thesisLinks: HARNESS_PRICING_THESIS_LINKS,
} as const;
