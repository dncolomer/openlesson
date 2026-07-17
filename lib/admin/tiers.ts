import type { PlanId } from "@/lib/plans";
import { PLANS, TRIAL_ACCESS_DAYS, isTrialExpiredStatus, normalizePlanId } from "@/lib/plans";

/** Admin-assignable subscription tiers (current product). */
export const ADMIN_TIER_OPTIONS = [
  { id: "inactive" as const, label: "Inactive", description: "No paid entitlement · use for demotion" },
  { id: "trial" as const, label: "3-Day Trial", description: "$19.99 one-time · full access for 3 days" },
  { id: "regular_2026" as const, label: "Individual", description: "from $49/mo · 100+ Proof-of-Work submissions" },
  { id: "pro_teams" as const, label: "Pro / Teams", description: "from $599/mo · 1,000+ Proof-of-Work submissions + org" },
  {
    id: "api_metered" as const,
    label: "API Metered",
    description: "$99/mo platform · $1.99 per API submission (monthly invoice)",
  },
] as const;

export type AdminTierId = (typeof ADMIN_TIER_OPTIONS)[number]["id"];

export type PlanFilterBucket = "all" | AdminTierId | "trial_expired";

export function isAdminTier(plan: string): plan is AdminTierId {
  return ADMIN_TIER_OPTIONS.some((tier) => tier.id === plan);
}

/** Value for the admin tier dropdown. */
export function adminTierSelectValue(user: {
  plan: string;
  subscription_status: string;
}): AdminTierId {
  if (isTrialExpiredStatus(user.subscription_status)) return "inactive";
  if (user.subscription_status !== "active") return "inactive";
  if (isAdminTier(user.plan)) return user.plan;
  return "inactive";
}

/**
 * Bucket for list filters and KPIs.
 * trial_expired is a status cohort for email targeting (plan is inactive).
 */
export function planFilterBucket(user: { plan: string; subscription_status: string }): PlanFilterBucket {
  if (isTrialExpiredStatus(user.subscription_status)) return "trial_expired";
  if (user.subscription_status !== "active") return "inactive";
  if (isAdminTier(user.plan)) return user.plan;
  return "inactive";
}

export function tierLabel(plan: string): string {
  if (plan === "regular_2026") return "Individual";
  if (plan === "pro_teams") return "Pro / Teams";
  if (plan === "api_metered") return "API Metered";
  if (plan === "trial") return "3-Day Trial";
  if (plan === "inactive" || plan === "free") return "Inactive";
  if (plan === "regular") return "Individual (legacy)";
  if (plan === "pro") return "Pro (legacy)";
  return plan;
}

export function tierColor(plan: string): string {
  switch (plan) {
    case "pro_teams":
    case "api_metered":
      return "text-purple-400";
    case "regular_2026":
      return "text-blue-400";
    case "trial":
      return "text-emerald-400";
    case "inactive":
    case "free":
    case "regular":
    case "pro":
    default:
      return "text-neutral-400";
  }
}

export function statusLabel(status: string): string {
  if (status === "trial_expired") return "Trial expired";
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "canceled") return "Canceled";
  if (status === "past_due") return "Past due";
  return status;
}

export function describePlanLimits(plan: string, extraLessons = 0, _extraWorkspaces = 0): string {
  const normalized = normalizePlanId(plan);
  const def = PLANS[normalized];
  if (!def) return "Unknown plan";

  const proofOfWork =
    def.proofOfWorkPerPeriod === null
      ? "Unlimited Proof-of-Work submissions"
      : def.proofOfWorkPerPeriod === 0
        ? "No Proof-of-Work entitlement"
        : `${(def.proofOfWorkPerPeriod ?? 0) + extraLessons} Proof-of-Work submissions / period`;

  const workspaces =
    def.workspacesPerPeriod === null
      ? "Unlimited workspaces"
      : def.workspacesPerPeriod === 0
        ? "No workspace entitlement"
        : `${def.workspacesPerPeriod} workspace(s)`;

  return `${proofOfWork} · ${workspaces}`;
}

export function tierChangeWarning(
  from: { plan: string; subscription_status: string; extra_lessons?: number },
  to: AdminTierId
): string | null {
  const current = adminTierSelectValue(from);
  if (current === to) return null;

  if (isTrialExpiredStatus(from.subscription_status) && to === "inactive") {
    return null;
  }

  if ((from.extra_lessons ?? 0) > 0 && to === "inactive") {
    return `Moving to Inactive will set subscription_status to inactive and reset PoW volume overage to 0 (currently ${from.extra_lessons}).`;
  }

  if (to !== "inactive") {
    return `Assign ${tierLabel(to)}? PoW volume overage will reset to 0 and a new period will start.`;
  }

  return `Move to Inactive? Subscription becomes inactive and PoW volume overage resets to 0.`;
}

export function buildTierUpdate(tier: AdminTierId): {
  plan: PlanId;
  subscription_status: string;
  extra_lessons: number;
  extra_workspaces: number;
  current_period_end: string | null;
} {
  if (tier === "inactive") {
    return {
      plan: "inactive",
      subscription_status: "inactive",
      extra_lessons: 0,
      extra_workspaces: 0,
      current_period_end: null,
    };
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + (tier === "trial" ? TRIAL_ACCESS_DAYS : 30));

  return {
    plan: tier,
    subscription_status: "active",
    extra_lessons: 0,
    extra_workspaces: 0,
    current_period_end: periodEnd.toISOString(),
  };
}
