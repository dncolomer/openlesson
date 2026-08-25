/**
 * Learning Harness public pricing copy. Amounts come from shipped plan constants.
 */
import {
  formatHarnessMonthlyPrice,
  formatHarnessTrialPrice,
} from "@/lib/plans";
import { AYCL_PATH } from "@/lib/marketing/paths";

export const PRICING_AYCL_HREF = AYCL_PATH;
export const PRICING_AYCL_LABEL = "All-You-Can-Learn";
export const PRICING_AYCL_CTA = "Browse ready-made workspaces";

export const HARNESS_PRICING_COPY = {
  eyebrow: "LEARNING HARNESS",
  title: "Learning Harness pricing",
  lead: "A fixed monthly subscription for the Learning Harness — or try unlimited for 3 days. Public registration via this page is for the harness only.",
  monthlyLabel: "Monthly",
  monthlyName: "Learning Harness",
  monthlyPrice: formatHarnessMonthlyPrice(),
  monthlyCadence: "/ month",
  monthlyBody:
    "Unlimited Learning Harness access. Workspaces, practice, and the system at a fixed monthly price.",
  monthlyCta: "Start",
  trialCta: `Try unlimited for 3 days for ${formatHarnessTrialPrice()}`,
  trialPrice: formatHarnessTrialPrice(),
  needsPlan:
    "Choose a plan to continue. Start the Learning Harness or try unlimited for 3 days for $14.99.",
  features: [
    `${formatHarnessMonthlyPrice()} fixed monthly subscription`,
    `Try unlimited for 3 days for ${formatHarnessTrialPrice()}`,
    "Unlimited Learning Harness access",
    "Unlimited Workspaces",
    "All-You-Can-Learn catalog available as lifetime buys",
  ],
  ayclHref: PRICING_AYCL_HREF,
  ayclCta: PRICING_AYCL_CTA,
  ayclLabel: PRICING_AYCL_LABEL,
} as const;
