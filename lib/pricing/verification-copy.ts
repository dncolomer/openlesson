/**
 * Knowledge Verification pricing: Deep Project vs light-weight, sales-led setup.
 * Rates match shipped TAP ($1 / run) and ILE ($10 / assessment) unit prices.
 */
import {
  formatIleSessionPrice,
  formatTapSessionPrice,
  ILE_SESSION_PRICE_CENTS,
  TAP_SESSION_PRICE_CENTS,
} from "@/lib/plans";
import { ENTERPRISE_SETUP_EMAIL, ENTERPRISE_SETUP_MAILTO } from "@/lib/marketing/paths";

export const VERIFICATION_DEEP_PROJECT_CENTS = ILE_SESSION_PRICE_CENTS;
export const VERIFICATION_LIGHT_WEIGHT_CENTS = TAP_SESSION_PRICE_CENTS;

export const VERIFICATION_PRICING_COPY = {
  eyebrow: "KNOWLEDGE VERIFICATION · ENTERPRISE",
  title: "Verification pricing",
  lead: "Two ways to verify Human Knowledge without traditional tests and exams — with the guarantee that results cannot be cheated or faked. We set you up.",
  contactEmail: ENTERPRISE_SETUP_EMAIL,
  contactMailto: ENTERPRISE_SETUP_MAILTO,
  contactCta: `Contact ${ENTERPRISE_SETUP_EMAIL} to get set-up`,
  contactBody:
    "Public registration is for the Learning Harness only. For Knowledge Verification, contact daniel@uncertain.systems to get set-up.",
  deepProject: {
    eyebrow: "DEEP PROJECT",
    name: "Deep Project style assessment",
    price: `${formatIleSessionPrice()} per assessment`,
    priceAmount: formatIleSessionPrice(),
    unit: "per assessment",
    difference:
      "Open-ended, assignment- and project-style verification. Candidates or employees work through a realistic brief with depth — multi-step judgment, artifacts, and proof of work. Use this when the role demands more than a short live probe: take-home replacement, senior screens, or complex cognition. Billed at $10 per assessment.",
  },
  lightWeight: {
    eyebrow: "LIGHT WEIGHT",
    name: "Light weight verification",
    price: `${formatTapSessionPrice()} per run`,
    priceAmount: formatTapSessionPrice(),
    unit: "per run",
    difference:
      "Live, time-framed verification. A short Think Aloud Protocol run: the person works a scoped scenario on a clock while talking through their thinking. Built for volume — screening, interview stages, quick hard-skill probes. Billed at $1 per run.",
  },
} as const;
