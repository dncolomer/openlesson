/**
 * Public pricing copy — sparse module list. Course authoring is its own page.
 */
import {
  ACADEMY_K_HREF,
  AYCL_PATH,
  AUTHORING_PRICING_PATH,
  ENTERPRISE_SETUP_EMAIL,
  ENTERPRISE_SETUP_MAILTO,
} from "@/lib/marketing/paths";
import { FREE_WEEKLY_SESSION_LIMIT } from "@/lib/free-tier";
import { formatUsdFromCents, TRY_EVERYTHING_PRICE_CENTS } from "@/lib/pricing/modules";

export const UNIFIED_PRICING_COPY = {
  eyebrow: "PRICING",
  title: "Pick a module.",
  lead: "Start free, or pick Learning, Verification, Calibration, or try everything for three days.",
  needsPlan: `Choose a module to continue, or try everything for 3 days for ${formatUsdFromCents(TRY_EVERYTHING_PRICE_CENTS)}.`,
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    cadence: `${FREE_WEEKLY_SESSION_LIMIT} sessions a week`,
    body: "Home, My Maps, and Quick Work Session.",
    cta: "Create Free account",
    href: "/register",
  },
  ayclHref: AYCL_PATH,
  ayclCta: "Browse ready-made workspaces",
  ayclLabel: "All-You-Can-Learn",
  authoringHref: AUTHORING_PRICING_PATH,
  authoringCta: "Course authoring",
  academyHref: ACADEMY_K_HREF,
  academyCta: "Academy-k",
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
