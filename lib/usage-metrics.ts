import type { SupabaseClient } from "@supabase/supabase-js";
import { demoteExpiredTrialProfile, type PlanId } from "@/lib/plans";

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

const PROFILE_FIELDS =
  "plan, is_admin, extra_lessons, extra_workspaces, subscription_status, current_period_end, token_tier, token_validity_expires_at, organization_id, is_org_admin";

/**
 * If the user is on an active trial whose period ended, persist plan=inactive + trial_expired.
 * Idempotent. Returns the (possibly updated) profile fields for access checks.
 */
export async function ensureTrialExpiryApplied<
  T extends {
    plan: string;
    subscription_status: string;
    current_period_end: string | null;
  },
>(supabase: SupabaseClient, userId: string, profile: T): Promise<T> {
  const patch = demoteExpiredTrialProfile(profile);
  if (!patch) return profile;

  const { error } = await supabase
    .from("profiles")
    .update({
      plan: patch.plan,
      subscription_status: patch.subscription_status,
    })
    .eq("id", userId)
    .eq("plan", "trial");

  if (error) {
    console.error("[usage-metrics] trial expiry demotion failed:", error);
    // Still return demoted view so access is denied this request
    return { ...profile, ...patch };
  }

  return { ...profile, ...patch };
}

export async function loadUsageProfile(
  supabase: SupabaseClient,
  userId: string,
  options?: { applyTrialExpiry?: boolean }
): Promise<{ profile: UsageProfileRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { profile: null, error: error?.message || "Profile not found" };
  }

  let profile = {
    ...data,
    plan: data.plan || "inactive",
    extra_workspaces: data.extra_workspaces ?? 0,
  } as UsageProfileRow;

  if (options?.applyTrialExpiry !== false) {
    profile = await ensureTrialExpiryApplied(supabase, userId, profile);
  }

  return {
    profile,
    error: null,
  };
}

async function countTableRows(
  supabase: SupabaseClient,
  table: "sessions" | "workspace_tap_sessions" | "workspace_proof_of_work",
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error(`[usage-metrics] ${table} count failed:`, error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Count combined TAP + ILE sessions attributed to the user.
 * ILE = `sessions`; TAP = `workspace_tap_sessions`.
 */
export async function countTapIleSessions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  const [ileCount, tapCount] = await Promise.all([
    countTableRows(supabase, "sessions", userId, periodStart),
    countTableRows(supabase, "workspace_tap_sessions", userId, periodStart),
  ]);
  return ileCount + tapCount;
}


export async function countProofOfWorkSubmissions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  return countTableRows(supabase, "workspace_proof_of_work", userId, periodStart);
}

/** Proof-of-Work rows created via the Agentic API (Bearer key or OAuth), for metered billing. */
export async function countPowApiSubmissions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  let query = supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("created_by_api_key_id", "is", null);

  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error("[usage-metrics] pow api count failed:", error);
    return 0;
  }

  return count ?? 0;
}

export async function countOrgTapIleSessions(
  supabase: SupabaseClient,
  memberIds: string[],
  periodStart: Date
): Promise<number> {
  if (memberIds.length === 0) return 0;

  const [ileCount, tapCount] = await Promise.all([
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .in("user_id", memberIds)
      .gte("created_at", periodStart.toISOString()),
    supabase
      .from("workspace_tap_sessions")
      .select("id", { count: "exact", head: true })
      .in("user_id", memberIds)
      .gte("created_at", periodStart.toISOString()),
  ]);

  return (ileCount.count ?? 0) + (tapCount.count ?? 0);
}

export async function countOrgProofOfWorkSubmissions(
  supabase: SupabaseClient,
  memberIds: string[],
  periodStart: Date
): Promise<number> {
  if (memberIds.length === 0) return 0;

  const { count, error } = await supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds)
    .gte("created_at", periodStart.toISOString());

  if (error) {
    console.error("[usage-metrics] org proof-of-work count failed:", error);
    return 0;
  }

  return count ?? 0;
}

export async function countActiveWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("workspaces")
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