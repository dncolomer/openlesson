import { hasAgentApiKeyPlan } from "@/lib/plans";

/**
 * Whether the dashboard should show Teams/API key UI and allow client-side create.
 * Prefer org-resolved fields from /api/check-usage over demoted profiles.plan.
 */
export function dashboardUsesAgenticKeys(opts: {
  /** Org-resolved plan from check-usage (preferred). */
  usagePlan?: string | null;
  /** Explicit flag from check-usage.canUseAgentApi. */
  canUseAgentApi?: boolean | null;
  usageIsAdmin?: boolean | null;
  userIsAdmin?: boolean | null;
  /** Fallback only when usage not loaded yet. */
  userPlan?: string | null;
}): boolean {
  if (opts.usageIsAdmin || opts.userIsAdmin) return true;
  if (opts.canUseAgentApi === true) return true;
  // Prefer usagePlan when present (including "inactive") over stale userPlan
  if (opts.usagePlan !== undefined && opts.usagePlan !== null) {
    return hasAgentApiKeyPlan(opts.usagePlan);
  }
  return hasAgentApiKeyPlan(opts.userPlan || "inactive");
}
