import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/plans";
import { ensurePersonalOrganization } from "@/lib/organization/ensure-personal-org";
import {
  demoteProfilePersonalBilling,
  orgBillingFromCheckoutFields,
} from "@/lib/organization/migrate-to-orgs";

export type ApplyOrgBillingParams = {
  userId: string;
  plan: PlanId | string;
  subscriptionStatus: string;
  currentPeriodEnd?: string | null;
  extraLessons?: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingMode?: "subscription" | "partner";
  /** When true (default), demote profile personal plan fields to inactive. */
  demoteProfile?: boolean;
};

/**
 * Authoritative write path: ensure user has an org, write billing onto that org,
 * optionally demote personal profile plan fields.
 */
export async function applyBillingToUserOrganization(
  admin: SupabaseClient,
  params: ApplyOrgBillingParams
): Promise<{ organizationId: string }> {
  const ensured = await ensurePersonalOrganization(admin, params.userId);

  // If ensure returned existing org that might be a multi-member team, still write there
  // (checkout purchaser's org is the billing entity).
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", params.userId)
    .single();

  const organizationId = profile?.organization_id || ensured.organizationId;
  if (!organizationId) {
    throw new Error("Failed to resolve organization for billing write");
  }

  const patch = orgBillingFromCheckoutFields({
    plan: params.plan,
    subscriptionStatus: params.subscriptionStatus,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    extraLessons: params.extraLessons ?? 0,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    billingMode: params.billingMode,
  });

  const { error: orgError } = await admin
    .from("organizations")
    .update({
      plan: patch.plan,
      subscription_status: patch.subscription_status,
      current_period_end: patch.current_period_end,
      extra_lessons: patch.extra_lessons,
      ...(params.stripeCustomerId !== undefined
        ? { stripe_customer_id: patch.stripe_customer_id }
        : {}),
      stripe_subscription_id: patch.stripe_subscription_id,
      billing_mode: patch.billing_mode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (orgError) {
    throw new Error(`Failed to update organization billing: ${orgError.message}`);
  }

  if (params.demoteProfile !== false) {
    const demote = demoteProfilePersonalBilling();
    await admin
      .from("profiles")
      .update({
        plan: demote.plan,
        subscription_status: demote.subscription_status,
        extra_lessons: demote.extra_lessons,
        extra_workspaces: demote.extra_workspaces,
        current_period_end: demote.current_period_end,
        stripe_subscription_id: demote.stripe_subscription_id,
        ...(params.stripeCustomerId
          ? { stripe_customer_id: params.stripeCustomerId }
          : {}),
      })
      .eq("id", params.userId);
  }

  return { organizationId };
}

/**
 * Cancel org subscription when Stripe subscription is deleted.
 */
export async function cancelOrgBillingForUser(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();

  if (profile?.organization_id) {
    await admin
      .from("organizations")
      .update({
        plan: "inactive",
        subscription_status: "canceled",
        stripe_subscription_id: null,
        current_period_end: null,
        extra_lessons: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.organization_id);
  }

  await admin
    .from("profiles")
    .update(demoteProfilePersonalBilling())
    .eq("id", userId);
}
