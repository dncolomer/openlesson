import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canSubmitProofOfWork,
  PLANS,
  type ProofOfWorkCheckResult,
  type PlanId,
  type UserProfile,
} from "@/lib/plans";
import {
  billingEntityToUserProfile,
  resolveBillingEntity,
  type OrgBillingRow,
} from "@/lib/billing-entity";
import {
  billingPeriodStart,
  countProofOfWorkSubmissions,
  countOrgProofOfWorkSubmissions,
  loadUsageProfile,
  type UsageProfileRow,
} from "@/lib/usage-metrics";

const ORG_BILLING_SELECT =
  "id, plan, subscription_status, current_period_end, extra_lessons, billing_mode, kind, archived_at";

async function loadOrgBilling(
  organizationId: string | null | undefined
): Promise<OrgBillingRow | null> {
  if (!organizationId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select(ORG_BILLING_SELECT)
    .eq("id", organizationId)
    .maybeSingle();
  return (data as OrgBillingRow | null) ?? null;
}

function toUserProfile(profile: UsageProfileRow): UserProfile {
  return {
    plan: (profile.plan || "inactive") as PlanId,
    is_admin: profile.is_admin ?? false,
    extra_lessons: profile.extra_lessons ?? 0,
    extra_workspaces: profile.extra_workspaces ?? 0,
    subscription_status: profile.subscription_status ?? "inactive",
    current_period_end: profile.current_period_end,
    token_tier: profile.token_tier,
    token_validity_expires_at: profile.token_validity_expires_at,
  };
}

function resolvePeriodStart(
  entity: ReturnType<typeof resolveBillingEntity>
): Date | null {
  if (!entity.entitled) return null;

  if (entity.source === "organization") {
    if (entity.currentPeriodEnd) {
      return billingPeriodStart(entity.currentPeriodEnd);
    }
    // Partner without period end: rolling 30 days
    if (entity.billingMode === "partner") {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return start;
    }
    return null;
  }

  if (entity.source === "user" && entity.currentPeriodEnd) {
    return billingPeriodStart(entity.currentPeriodEnd);
  }

  return null;
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
      plan: "inactive",
      used: 0,
      limit: PLANS.inactive.proofOfWorkPerPeriod,
      isAdmin: false,
      profile: null,
    };
  }

  const org = await loadOrgBilling(profile.organization_id);
  const entity = resolveBillingEntity(
    {
      ...toUserProfile(profile),
      organization_id: profile.organization_id,
    },
    org
  );

  const periodStart = resolvePeriodStart(entity);
  let proofOfWorkCount = 0;

  if (entity.source === "organization" && profile.organization_id && periodStart) {
    const admin = createAdminClient();
    const { data: orgMembers } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id);
    const memberIds = (orgMembers || []).map((member) => member.id);
    if (memberIds.length > 0) {
      proofOfWorkCount = await countOrgProofOfWorkSubmissions(admin, memberIds, periodStart);
    }
  } else {
    proofOfWorkCount = await countProofOfWorkSubmissions(supabase, userId, periodStart);
  }

  const userProfile = billingEntityToUserProfile(entity);
  const result = canSubmitProofOfWork(userProfile, proofOfWorkCount);

  return { ...result, profile };
}

export async function assertCanSubmitProofOfWork(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const check = await checkProofOfWorkSubmissionAllowance(supabase, userId);
  if (!check.allowed) {
    throw new Error(check.reason || "Proof-of-Work monthly limit reached");
  }
}
