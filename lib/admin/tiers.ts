import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

/** Admin-manageable subscription tiers (current product). */
export const ADMIN_TIER_OPTIONS = [
  { id: "free" as const, label: "Free", description: PLANS.free.features[0] },
  { id: "regular_2026" as const, label: "Regular", description: "25 blocks / month" },
  { id: "pro_teams" as const, label: "Pro / Teams", description: "250 blocks / month + org features" },
] as const;

export type AdminTierId = (typeof ADMIN_TIER_OPTIONS)[number]["id"];

export function isAdminTier(plan: string): plan is AdminTierId {
  return ADMIN_TIER_OPTIONS.some((tier) => tier.id === plan);
}

export function normalizeAdminTier(user: {
  plan: string;
  subscription_status: string;
}): AdminTierId {
  if (user.subscription_status !== "active") return "free";
  if (user.plan === "regular_2026" || user.plan === "pro_teams") return user.plan;
  return "free";
}

export function tierLabel(plan: string): string {
  if (plan === "regular_2026") return "Regular";
  if (plan === "pro_teams") return "Pro / Teams";
  if (plan === "free") return "Free";
  if (plan === "regular") return "Regular (legacy)";
  if (plan === "pro") return "Pro (legacy)";
  return plan;
}

export function tierColor(plan: string): string {
  switch (plan) {
    case "pro_teams":
      return "text-purple-400";
    case "regular_2026":
      return "text-blue-400";
    default:
      return "text-neutral-400";
  }
}

export function buildTierUpdate(tier: AdminTierId): {
  plan: PlanId;
  subscription_status: string;
  extra_lessons: number;
  current_period_end: string | null;
} {
  if (tier === "free") {
    return {
      plan: "free",
      subscription_status: "inactive",
      extra_lessons: 0,
      current_period_end: null,
    };
  }

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  return {
    plan: tier,
    subscription_status: "active",
    extra_lessons: 0,
    current_period_end: periodEnd.toISOString(),
  };
}