import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

/** Admin-assignable subscription tiers (current product). */
export const ADMIN_TIER_OPTIONS = [
  { id: "free" as const, label: "Free", description: PLANS.free.features[0] },
  { id: "regular_2026" as const, label: "Individual", description: "25+ TAP / ILE sessions / month" },
  { id: "pro_teams" as const, label: "Pro / Teams", description: "250+ TAP / ILE sessions / month + org" },
] as const;

export type AdminTierId = (typeof ADMIN_TIER_OPTIONS)[number]["id"];

export type PlanFilterBucket = "all" | AdminTierId | "legacy" | "inactive";

const LEGACY_PLANS = new Set<PlanId>(["regular", "pro"]);

export function isLegacyPlan(plan: string): plan is "regular" | "pro" {
  return LEGACY_PLANS.has(plan as PlanId);
}

export function isAdminTier(plan: string): plan is AdminTierId {
  return ADMIN_TIER_OPTIONS.some((tier) => tier.id === plan);
}

/** True when user is on a grandfathered legacy paid plan that admin UI must not overwrite accidentally. */
export function isGrandfatheredPlan(user: { plan: string; subscription_status: string }): boolean {
  return user.subscription_status === "active" && isLegacyPlan(user.plan);
}

/** Value for the admin tier dropdown — only current product tiers; null when grandfathered. */
export function adminTierSelectValue(user: {
  plan: string;
  subscription_status: string;
}): AdminTierId | null {
  if (user.subscription_status !== "active") return "free";
  if (isAdminTier(user.plan)) return user.plan;
  return null;
}

/** Bucket for list filters and KPIs — preserves legacy subscribers instead of lumping them into Free. */
export function planFilterBucket(user: { plan: string; subscription_status: string }): PlanFilterBucket {
  if (user.subscription_status !== "active") return "inactive";
  if (isLegacyPlan(user.plan)) return "legacy";
  if (isAdminTier(user.plan)) return user.plan;
  return "free";
}

/** @deprecated Use planFilterBucket or adminTierSelectValue */
export function normalizeAdminTier(user: {
  plan: string;
  subscription_status: string;
}): AdminTierId {
  return adminTierSelectValue(user) ?? "free";
}

export function tierLabel(plan: string): string {
  if (plan === "regular_2026") return "Individual";
  if (plan === "pro_teams") return "Pro / Teams";
  if (plan === "free") return "Free";
  if (plan === "regular") return "Individual (legacy)";
  if (plan === "pro") return "Pro (legacy)";
  return plan;
}

export function tierColor(plan: string): string {
  switch (plan) {
    case "pro":
    case "pro_teams":
      return "text-purple-400";
    case "regular_2026":
      return "text-blue-400";
    case "regular":
      return "text-cyan-400";
    case "free":
      return "text-neutral-400";
    default:
      return "text-neutral-400";
  }
}

export function describePlanLimits(plan: string, extraLessons = 0, extraWorkspaces = 0): string {
  const def = PLANS[plan as PlanId];
  if (!def) return "Unknown plan";

  const sessions =
    def.sessionsPerPeriod === null
      ? "Unlimited TAP / ILE sessions"
      : `${(def.sessionsPerPeriod ?? 0) + extraLessons} TAP / ILE sessions / period`;

  const workspaces =
    def.workspacesPerPeriod === null
      ? "Unlimited workspaces"
      : `${(def.workspacesPerPeriod ?? 0) + extraWorkspaces} workspace(s) / period`;

  return `${sessions} · ${workspaces}`;
}

export function tierChangeWarning(
  from: { plan: string; subscription_status: string; extra_lessons?: number },
  to: AdminTierId
): string | null {
  const current = adminTierSelectValue(from);
  if (current === to) return null;

  if (isGrandfatheredPlan(from)) {
    return `This user is on grandfathered ${tierLabel(from.plan)}. Migrating to ${tierLabel(to)} will replace legacy limits and reset extra_lessons to the new tier baseline.`;
  }

  if ((from.extra_lessons ?? 0) > 0 && to === "free") {
    return `Moving to Free will set subscription_status to inactive and reset extra_lessons to 0 (currently ${from.extra_lessons}).`;
  }

  if (to !== "free") {
    return `Assign ${tierLabel(to)}? extra_lessons will reset to 0 and a new 30-day period will start.`;
  }

  return `Move to Free? Subscription becomes inactive and extra_lessons reset to 0.`;
}

export function buildTierUpdate(tier: AdminTierId): {
  plan: PlanId;
  subscription_status: string;
  extra_lessons: number;
  extra_workspaces: number;
  current_period_end: string | null;
} {
  if (tier === "free") {
    return {
      plan: "free",
      subscription_status: "inactive",
      extra_lessons: 0,
      extra_workspaces: 0,
      current_period_end: null,
    };
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  return {
    plan: tier,
    subscription_status: "active",
    extra_lessons: 0,
    extra_workspaces: 0,
    current_period_end: periodEnd.toISOString(),
  };
}