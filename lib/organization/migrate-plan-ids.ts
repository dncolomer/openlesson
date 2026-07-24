/**
 * Pure helpers for collapsing removed plan ids onto the current product set.
 * Used by unit tests and scripts; the durable SQL migration is
 * supabase/migrations/20260724150000_collapse_plans_to_api_metered.sql
 */

import {
  migratePlanIdToCurrent,
  REMOVED_PLAN_IDS_MIGRATED_TO_API_METERED,
  type PlanId,
} from "@/lib/plans";

export type PlanMigrationRow = {
  id: string;
  plan: string | null;
  subscription_status?: string | null;
};

export type PlanMigrationResult = {
  id: string;
  from: string | null;
  to: PlanId;
  changed: boolean;
};

/** Apply migratePlanIdToCurrent to a list of org/profile rows (dry-run friendly). */
export function migratePlanRows(rows: PlanMigrationRow[]): PlanMigrationResult[] {
  return rows.map((row) => {
    const to = migratePlanIdToCurrent(row.plan);
    return {
      id: row.id,
      from: row.plan,
      to,
      changed: to !== row.plan,
    };
  });
}

/** True when a stored plan string is one of the removed paid tiers. */
export function isRemovedPaidPlanId(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return (REMOVED_PLAN_IDS_MIGRATED_TO_API_METERED as readonly string[]).includes(plan);
}

/**
 * Representative dry-run fixtures matching the SQL migration intent.
 * trial / inactive unchanged; removed paid tiers → api_metered.
 */
export function dryRunCollapsePricingMigration(): PlanMigrationResult[] {
  return migratePlanRows([
    { id: "org-individual", plan: "regular_2026", subscription_status: "active" },
    { id: "org-teams", plan: "pro_teams", subscription_status: "active" },
    { id: "org-legacy-regular", plan: "regular", subscription_status: "active" },
    { id: "org-legacy-pro", plan: "pro", subscription_status: "active" },
    { id: "org-trial", plan: "trial", subscription_status: "active" },
    { id: "org-inactive", plan: "inactive", subscription_status: "inactive" },
    { id: "org-metered", plan: "api_metered", subscription_status: "active" },
    { id: "profile-teams", plan: "pro_teams", subscription_status: "active" },
  ]);
}
