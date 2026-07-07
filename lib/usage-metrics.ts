import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/plans";

export type UsageProfileRow = {
  plan: PlanId | string;
  is_admin: boolean;
  extra_lessons: number;
  extra_workspaces: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  token_validity_expires_at: string | null;
  organization_id: string | null;
  is_org_admin: boolean;
};

const PROFILE_FIELDS_WITHOUT_EXTRA_WORKSPACES =
  "plan, is_admin, extra_lessons, subscription_status, current_period_end, token_tier, token_validity_expires_at, organization_id, is_org_admin";

function isMissingExtraWorkspacesColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return error.code === "42703" || message.includes("extra_workspaces");
}

export async function loadUsageProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profile: UsageProfileRow | null; error: string | null }> {
  const withWorkspaces = await supabase
    .from("profiles")
    .select(`${PROFILE_FIELDS_WITHOUT_EXTRA_WORKSPACES}, extra_workspaces`)
    .eq("id", userId)
    .single();

  if (!withWorkspaces.error && withWorkspaces.data) {
    return {
      profile: {
        ...withWorkspaces.data,
        plan: withWorkspaces.data.plan || "free",
        extra_workspaces: withWorkspaces.data.extra_workspaces ?? 0,
      } as UsageProfileRow,
      error: null,
    };
  }

  if (!isMissingExtraWorkspacesColumn(withWorkspaces.error)) {
    return { profile: null, error: withWorkspaces.error?.message || "Profile not found" };
  }

  const fallback = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS_WITHOUT_EXTRA_WORKSPACES)
    .eq("id", userId)
    .single();

  if (fallback.error || !fallback.data) {
    return { profile: null, error: fallback.error?.message || "Profile not found" };
  }

  return {
    profile: {
      ...fallback.data,
      plan: fallback.data.plan || "free",
      extra_workspaces: 0,
    } as UsageProfileRow,
    error: null,
  };
}

/**
 * Count learning blocks (sessions) attributed to the user.
 * Includes in-progress sessions — new sessions start as status "active".
 */
export async function countUsedBlocks(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  let query = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error("[usage-metrics] block count failed:", error);
    return 0;
  }

  return count ?? 0;
}

export async function countActiveWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("learning_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "archived");

  if (error) {
    console.error("[usage-metrics] workspace count failed:", error);
    return 0;
  }

  return count ?? 0;
}

export function billingPeriodStart(periodEndIso: string | null): Date | null {
  if (!periodEndIso) return null;
  const periodEnd = new Date(periodEndIso);
  if (Number.isNaN(periodEnd.getTime())) return null;
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 30);
  return periodStart;
}