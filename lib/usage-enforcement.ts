import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canSubmitProofOfWork,
  getSessionAllowance,
  PLANS,
  type ProofOfWorkCheckResult,
  type PlanId,
  type UserProfile,
} from "@/lib/plans";
import {
  billingPeriodStart,
  countProofOfWorkSubmissions,
  countOrgProofOfWorkSubmissions,
  countOrgTapIleSessions,
  countTapIleSessions,
  loadUsageProfile,
  type UsageProfileRow,
} from "@/lib/usage-metrics";

function toUserProfile(profile: UsageProfileRow): UserProfile {
  return {
    plan: (profile.plan || "free") as PlanId,
    is_admin: profile.is_admin ?? false,
    extra_lessons: profile.extra_lessons ?? 0,
    extra_workspaces: profile.extra_workspaces ?? 0,
    subscription_status: profile.subscription_status ?? "inactive",
    current_period_end: profile.current_period_end,
    token_tier: profile.token_tier,
    token_validity_expires_at: profile.token_validity_expires_at,
  };
}

async function resolveUsageCounts(
  supabase: SupabaseClient,
  profile: UsageProfileRow,
  userId: string,
  periodStart: Date | null
): Promise<{ sessionCount: number; proofOfWorkCount: number; sessionAllowance: number | null }> {
  const userProfile = toUserProfile(profile);
  let sessionCount = await countTapIleSessions(supabase, userId, periodStart);
  let proofOfWorkCount = await countProofOfWorkSubmissions(supabase, userId, periodStart);

  if (profile.plan === "pro_teams" && profile.organization_id && periodStart) {
    const admin = createAdminClient();
    const { data: orgMembers } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id);
    const memberIds = (orgMembers || []).map((member) => member.id);

    if (memberIds.length > 0) {
      sessionCount = await countOrgTapIleSessions(admin, memberIds, periodStart);
      proofOfWorkCount = await countOrgProofOfWorkSubmissions(admin, memberIds, periodStart);
    }

    const planLimit = PLANS.pro_teams.sessionsPerPeriod;
    const effectiveOrgLimit = (planLimit ?? 0) + (profile.extra_lessons ?? 0);
    return {
      sessionCount,
      proofOfWorkCount,
      sessionAllowance: userProfile.is_admin ? null : effectiveOrgLimit,
    };
  }

  const { limit: sessionAllowance } = getSessionAllowance(userProfile, sessionCount);
  return { sessionCount, proofOfWorkCount, sessionAllowance };
}

export async function checkProofOfWorkSubmissionAllowance(
  supabase: SupabaseClient,
  userId: string
): Promise<ProofOfWorkCheckResult & { profile: UsageProfileRow | null }> {
  const { profile, error } = await loadUsageProfile(supabase, userId);
  if (error || !profile) {
    return {
      allowed: false,
      reason: "Profile not found",
      plan: "free",
      used: 0,
      limit: 25,
      isAdmin: false,
      profile: null,
    };
  }

  const userProfile = toUserProfile(profile);
  const periodStart =
    profile.plan === "free" || !profile.current_period_end
      ? null
      : billingPeriodStart(profile.current_period_end);

  const { proofOfWorkCount, sessionAllowance } = await resolveUsageCounts(
    supabase,
    profile,
    userId,
    periodStart
  );
  const result = canSubmitProofOfWork(userProfile, proofOfWorkCount, sessionAllowance);

  return { ...result, profile };
}

export async function assertCanSubmitProofOfWork(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const check = await checkProofOfWorkSubmissionAllowance(supabase, userId);
  if (!check.allowed) {
    throw new Error(check.reason || "Proof-of-Work API monthly limit reached");
  }
}