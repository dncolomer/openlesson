/**
 * Public pricing copy — sparse module list. Course authoring lives on Academy-k.
 */
import {
  ACADEMY_K_HREF,
  AYCL_PATH,
  ENTERPRISE_SETUP_EMAIL,
  ENTERPRISE_SETUP_MAILTO,
} from "@/lib/marketing/paths";
import { FLOW_SESSION_CREDIT_COST, STARTER_CREDIT_GRANT } from "@/lib/credits/constants";

export const UNIFIED_PRICING_COPY = {
  eyebrow: "PRICING",
  title: "Pay for usage.",
  lead: "Sign up free, get starter credits, and buy more when you run Calibrate, Learn, Verify, and Solve sessions.",
  needsPlan: "Buy a credit pack to keep running sessions.",
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    cadence: `${STARTER_CREDIT_GRANT} starter credits`,
    body: `Create Learning Maps and Knowledge Regions for free. Each flow session costs ${FLOW_SESSION_CREDIT_COST} credits.`,
    cta: "Create Free account",
    href: "/register",
  },
  ayclHref: AYCL_PATH,
  ayclCta: "Browse ready-made workspaces",
  ayclLabel: "All-You-Can-Learn",
  academyHref: ACADEMY_K_HREF,
  academyCta: "Academy-k",
  custom: {
    id: "custom",
    eyebrow: "CUSTOM",
    name: "Custom setup",
    priceLabel: "Contact",
    body: "Mix usage, science setups, or a scoped build.",
    cta: `Contact ${ENTERPRISE_SETUP_EMAIL}`,
    mailto: ENTERPRISE_SETUP_MAILTO,
  },
} as const;
