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
 * TAP statuses that represent a real session run (billable at $1).
 * Excludes pending guest links (created but never opened) and revoked links.
 */
export const BILLABLE_TAP_STATUSES = ["in_progress", "completed"] as const;

export type TapSessionBillingRow = {
  status?: string | null;
  started_at?: string | null;
};

export type IleSessionBillingRow = {
  metadata?: Record<string, unknown> | null;
};

/**
 * Pure: whether a workspace_tap_sessions row is a billable TAP run.
 * Pending unused guest links and revoked links are not charged.
 */
export function isBillableTapSession(row: TapSessionBillingRow): boolean {
  const status = row.status ?? null;
  if (status === "pending" || status === "revoked") return false;
  if (status === "in_progress" || status === "completed") return true;
  // Defensive: started_at set implies a real run even if status is unexpected.
  return row.started_at != null && String(row.started_at).length > 0;
}

/**
 * Pure: whether a sessions row is a billable ILE practice session ($10).
 * Excludes AYCL one-time product sessions and demo_integration sessions that share the table.
 */
export function isBillableIleSession(row: IleSessionBillingRow): boolean {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  if (meta.aycl_purchase_id != null && meta.aycl_purchase_id !== "") return false;
  if (meta.demo_integration === true || meta.demo_integration === "true") return false;
  return true;
}

/**
 * Pure: whether a PoW row is external/API-direct (metered at PoW rate).
 * Same signal as countPowApiSubmissions (created_by_api_key_id set).
 */
export function isBillableExternalPow(row: {
  created_by_api_key_id?: string | null;
}): boolean {
  return (
    row.created_by_api_key_id != null && String(row.created_by_api_key_id).length > 0
  );
}

/** Apply production TAP billing filters to a Supabase query builder. */
export function applyBillableTapSessionFilters<T extends { in: (col: string, vals: readonly string[]) => T }>(
  query: T
): T {
  return query.in("status", BILLABLE_TAP_STATUSES);
}

/**
 * PostgREST filter fragment: demo_integration is not the string "true".
 * Must use OR (is.null | neq.true) — bare `not.eq.true` drops NULL keys under
 * SQL three-valued logic (NULL NOT EQ true → UNKNOWN → row excluded).
 * Ordinary product ILE rows omit the key and must remain billable.
 */
export const ILE_BILLABLE_DEMO_INTEGRATION_OR =
  "metadata->>demo_integration.is.null,metadata->>demo_integration.neq.true" as const;

/**
 * Apply production ILE billing filters to a Supabase query builder.
 * Excludes rows whose metadata marks AYCL or demo sessions.
 * Absent demo_integration / aycl_purchase_id keys remain billable.
 */
export function applyBillableIleSessionFilters<
  T extends {
    is: (col: string, val: null) => T;
    or: (filters: string) => T;
  },
>(query: T): T {
  // aycl_purchase_id: is.null matches missing key and explicit null (billable).
  // demo_integration: OR null|neq true — NOT bare not.eq.true (that undercounts).
  return query
    .is("metadata->>aycl_purchase_id", null)
    .or(ILE_BILLABLE_DEMO_INTEGRATION_OR);
}

/** Apply external/API-direct PoW filter (created_by_api_key_id IS NOT NULL). */
export function applyExternalPowFilters<
  T extends { not: (col: string, op: string, val: null) => T },
>(query: T): T {
  return query.not("created_by_api_key_id", "is", null);
}

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

  // Prefer service-role client so privileged-column freeze trigger allows demotion.
  let writer = supabase;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    writer = createAdminClient();
  } catch {
    writer = supabase;
  }

  const { error } = await writer
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
  table: "workspace_proof_of_work",
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
 * Count billable ILE sessions attributed to the user (`sessions` table).
 * Excludes AYCL (metadata.aycl_purchase_id) and demo (metadata.demo_integration) sessions.
 */
export async function countIleSessions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  let query = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  query = applyBillableIleSessionFilters(query);

  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error("[usage-metrics] ILE session count failed:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Count billable TAP sessions attributed to the user (`workspace_tap_sessions`).
 * Only real runs (in_progress / completed) — not pending unused links or revoked.
 */
export async function countTapSessions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  let query = supabase
    .from("workspace_tap_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  query = applyBillableTapSessionFilters(query);

  if (periodStart) {
    query = query.gte("created_at", periodStart.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error("[usage-metrics] TAP session count failed:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Count combined billable TAP + ILE sessions attributed to the user.
 */
export async function countTapIleSessions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  const [ileCount, tapCount] = await Promise.all([
    countIleSessions(supabase, userId, periodStart),
    countTapSessions(supabase, userId, periodStart),
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

/** Proof-of-Work rows created via the Proof-of-Work API (Bearer key or OAuth), for metered billing. */
export async function countPowApiSubmissions(
  supabase: SupabaseClient,
  userId: string,
  periodStart?: Date | null
): Promise<number> {
  let query = supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  query = applyExternalPowFilters(query);

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

export async function countOrgIleSessions(
  supabase: SupabaseClient,
  memberIds: string[],
  periodStart: Date
): Promise<number> {
  if (memberIds.length === 0) return 0;

  let query = supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds)
    .gte("created_at", periodStart.toISOString());

  query = applyBillableIleSessionFilters(query);

  const { count, error } = await query;
  if (error) {
    console.error("[usage-metrics] org ILE session count failed:", error);
    return 0;
  }
  return count ?? 0;
}

export async function countOrgTapSessions(
  supabase: SupabaseClient,
  memberIds: string[],
  periodStart: Date
): Promise<number> {
  if (memberIds.length === 0) return 0;

  let query = supabase
    .from("workspace_tap_sessions")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds)
    .gte("created_at", periodStart.toISOString());

  query = applyBillableTapSessionFilters(query);

  const { count, error } = await query;
  if (error) {
    console.error("[usage-metrics] org TAP session count failed:", error);
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
    countOrgIleSessions(supabase, memberIds, periodStart),
    countOrgTapSessions(supabase, memberIds, periodStart),
  ]);

  return ileCount + tapCount;
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
