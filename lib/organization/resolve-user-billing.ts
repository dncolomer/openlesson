import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  billingEntityHasApiAccess,
  billingEntityToUserProfile,
  resolveBillingEntity,
  type OrgBillingRow,
  type ResolvedBillingEntity,
} from "@/lib/billing-entity";
import type { PlanId, UserProfile } from "@/lib/plans";
import {
  loadUsageProfile,
  type UsageProfileRow,
} from "@/lib/usage-metrics";

const ORG_BILLING_SELECT =
  "id, plan, subscription_status, current_period_end, extra_lessons, billing_mode, kind, archived_at";

export async function loadOrgBillingRow(
  organizationId: string | null | undefined,
  client?: SupabaseClient
): Promise<OrgBillingRow | null> {
  if (!organizationId) return null;
  const db = client || createAdminClient();
  const { data } = await db
    .from("organizations")
    .select(ORG_BILLING_SELECT)
    .eq("id", organizationId)
    .maybeSingle();
  return (data as OrgBillingRow | null) ?? null;
}

export type ResolvedUserBilling = {
  profile: UsageProfileRow;
  org: OrgBillingRow | null;
  entity: ResolvedBillingEntity;
  /** UserProfile shape for canCreateWorkspace / canSubmitProofOfWork (org plan when entitled). */
  userProfile: UserProfile;
};

/**
 * Load profile + org and resolve billing. Product limits must use `userProfile` from here,
 * never raw profiles.plan after the org-model migrate.
 */
export async function resolveUserBilling(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedUserBilling | { error: string }> {
  const { profile, error } = await loadUsageProfile(supabase, userId);
  if (error || !profile) {
    return { error: error || "Profile not found" };
  }

  const org = await loadOrgBillingRow(profile.organization_id);
  const entity = resolveBillingEntity(
    {
      plan: (profile.plan || "inactive") as PlanId,
      is_admin: profile.is_admin ?? false,
      extra_lessons: profile.extra_lessons ?? 0,
      subscription_status: profile.subscription_status ?? "inactive",
      current_period_end: profile.current_period_end,
      token_tier: profile.token_tier,
      token_validity_expires_at: profile.token_validity_expires_at,
      organization_id: profile.organization_id,
    },
    org
  );

  return {
    profile,
    org,
    entity,
    userProfile: billingEntityToUserProfile(entity),
  };
}

/** True when user may use PoW API features (admin or org plan api_metered). */
export async function userHasOrgApiAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const resolved = await resolveUserBilling(supabase, userId);
  if ("error" in resolved) return false;
  return billingEntityHasApiAccess(resolved.entity);
}

/** True when org (by id) is entitled to Teams/API features. */
export async function organizationHasApiAccess(organizationId: string | null): Promise<boolean> {
  if (!organizationId) return false;
  const org = await loadOrgBillingRow(organizationId);
  if (!org) return false;
  const entity = resolveBillingEntity(
    {
      plan: "inactive",
      is_admin: false,
      extra_lessons: 0,
      subscription_status: "inactive",
      current_period_end: null,
      token_tier: null,
      token_validity_expires_at: null,
      organization_id: organizationId,
    },
    org
  );
  return billingEntityHasApiAccess(entity);
}
