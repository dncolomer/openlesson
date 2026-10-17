/**
 * Public pricing copy — sparse module list. Course authoring is its own page.
 */
import { AYCL_PATH, AUTHORING_PRICING_PATH, ENTERPRISE_SETUP_EMAIL, ENTERPRISE_SETUP_MAILTO } from "@/lib/marketing/paths";
import { formatUsdFromCents, TRY_EVERYTHING_PRICE_CENTS } from "@/lib/pricing/modules";

export const UNIFIED_PRICING_COPY = {
  eyebrow: "PRICING",
  title: "Pick a module.",
  lead: "Learning, Verification, Calibration, or try everything for three days.",
  needsPlan: `Choose a module to continue, or try everything for 3 days for ${formatUsdFromCents(TRY_EVERYTHING_PRICE_CENTS)}.`,
  ayclHref: AYCL_PATH,
  ayclCta: "Browse ready-made workspaces",
  ayclLabel: "All-You-Can-Learn",
  authoringHref: AUTHORING_PRICING_PATH,
  authoringCta: "Course authoring",
  custom: {
    id: "custom",
    eyebrow: "CUSTOM",
    name: "Custom setup",
    priceLabel: "Contact",
    body: "Mix modules, embed a program, or ask for a scoped build.",
    cta: `Contact ${ENTERPRISE_SETUP_EMAIL}`,
    mailto: ENTERPRISE_SETUP_MAILTO,
  },
} as const;
