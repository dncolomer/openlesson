/**
 * Pure helpers for org-model data migration (no I/O).
 * Used by scripts/migrate-org-model.mjs and unit tests.
 */

import { normalizePlanId, type PlanId } from "@/lib/plans";

export type ProfileBillingSnapshot = {
  id: string;
  username: string | null;
  organization_id: string | null;
  is_org_admin: boolean | null;
  plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  extra_lessons: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type OrgBillingSnapshot = {
  id: string;
  kind: string | null;
  billing_mode: string | null;
  plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  extra_lessons: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  archived_at: string | null;
};

export type OrgBillingPatch = {
  plan: PlanId;
  subscription_status: string;
  current_period_end: string | null;
  extra_lessons: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_mode: "subscription" | "partner";
  kind?: "personal" | "team" | "partner";
};

const PAID_PLANS = new Set<PlanId>(["trial", "regular_2026", "pro_teams", "api_metered"]);

function planRank(plan: string | null | undefined): number {
  const p = normalizePlanId(plan);
  switch (p) {
    case "api_metered":
      return 50;
    case "pro_teams":
      return 40;
    case "regular_2026":
      return 30;
    case "trial":
      return 20;
    default:
      return 0;
  }
}

function isActiveStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** True when profile holds a paid entitlement we should copy onto an org. */
export function profileHasMigratableEntitlement(profile: ProfileBillingSnapshot): boolean {
  const plan = normalizePlanId(profile.plan);
  if (!PAID_PLANS.has(plan)) return false;
  if (plan === "trial") {
    if (!profile.current_period_end) return false;
    return new Date(profile.current_period_end) > new Date();
  }
  return isActiveStatus(profile.subscription_status);
}

/** Map a single profile's billing fields onto an org patch. */
export function mapProfileBillingToOrg(profile: ProfileBillingSnapshot): OrgBillingPatch {
  const plan = normalizePlanId(profile.plan);
  const entitled = profileHasMigratableEntitlement(profile);
  return {
    plan: entitled ? plan : "inactive",
    subscription_status: entitled
      ? isActiveStatus(profile.subscription_status)
        ? "active"
        : profile.subscription_status || "active"
      : "inactive",
    current_period_end: entitled ? profile.current_period_end : null,
    extra_lessons: entitled ? profile.extra_lessons ?? 0 : 0,
    stripe_customer_id: profile.stripe_customer_id,
    stripe_subscription_id: profile.stripe_subscription_id,
    billing_mode: "subscription",
    kind: "personal",
  };
}

/**
 * Among members of an existing multi-member org, pick the best billing source
 * (prefer org admin with highest plan rank, then any paid member).
 */
export function pickBestMemberBilling(
  members: ProfileBillingSnapshot[]
): OrgBillingPatch | null {
  if (members.length === 0) return null;

  const ranked = [...members].sort((a, b) => {
    const aAdmin = a.is_org_admin ? 1 : 0;
    const bAdmin = b.is_org_admin ? 1 : 0;
    if (bAdmin !== aAdmin) return bAdmin - aAdmin;
    const aEnt = profileHasMigratableEntitlement(a) ? 1 : 0;
    const bEnt = profileHasMigratableEntitlement(b) ? 1 : 0;
    if (bEnt !== aEnt) return bEnt - aEnt;
    if (planRank(b.plan) !== planRank(a.plan)) return planRank(b.plan) - planRank(a.plan);
    return (b.extra_lessons ?? 0) - (a.extra_lessons ?? 0);
  });

  const best = ranked[0];
  if (!profileHasMigratableEntitlement(best)) {
    // Still return inactive patch so callers can clear junk if needed
    return {
      plan: "inactive",
      subscription_status: "inactive",
      current_period_end: null,
      extra_lessons: 0,
      stripe_customer_id: best.stripe_customer_id,
      stripe_subscription_id: best.stripe_subscription_id,
      billing_mode: "subscription",
      kind: "team",
    };
  }

  const patch = mapProfileBillingToOrg(best);
  patch.kind = "team";
  return patch;
}

/**
 * Whether an existing org row needs billing overwrite from member profile data.
 * Prefer not to downgrade an already-entitled org.
 */
export function shouldOverwriteOrgBilling(
  org: OrgBillingSnapshot,
  candidate: OrgBillingPatch
): boolean {
  const orgPlan = normalizePlanId(org.plan);
  const orgActive =
    org.billing_mode === "partner"
      ? orgPlan !== "inactive"
      : isActiveStatus(org.subscription_status) && PAID_PLANS.has(orgPlan);

  if (org.billing_mode === "partner" && orgPlan !== "inactive") {
    return false; // never clobber partner grants
  }

  if (!orgActive && candidate.plan !== "inactive") return true;
  if (!orgActive) return false;

  // Upgrade path: candidate is better ranked
  if (planRank(candidate.plan) > planRank(org.plan)) return true;
  if (
    planRank(candidate.plan) === planRank(org.plan) &&
    (candidate.extra_lessons ?? 0) > (org.extra_lessons ?? 0)
  ) {
    return true;
  }
  // Fill missing Stripe linkage
  if (!org.stripe_subscription_id && candidate.stripe_subscription_id) return true;
  return false;
}

export function buildPersonalOrgSlug(username: string | null, userId: string): string {
  const base = (username || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const short = userId.replace(/-/g, "").slice(0, 8);
  return `user-${base || "member"}-${short}`;
}

export function buildPersonalOrgName(username: string | null): string {
  return `${username || "User"}'s workspace`;
}

/** After migration, profile personal plan fields should be cleared (inactive). */
export function demoteProfilePersonalBilling(): {
  plan: "inactive";
  subscription_status: "inactive";
  extra_lessons: number;
  extra_workspaces: number;
  current_period_end: null;
  stripe_subscription_id: null;
  // keep stripe_customer_id on profile for Stripe customer linkage lookup if needed
} {
  return {
    plan: "inactive",
    subscription_status: "inactive",
    extra_lessons: 0,
    extra_workspaces: 0,
    current_period_end: null,
    stripe_subscription_id: null,
  };
}

export type OrgBillingWritePayload = OrgBillingPatch & {
  plan: PlanId;
  subscription_status: string;
  current_period_end: string | null;
  extra_lessons: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_mode: "subscription" | "partner";
};

/** Shared shape for Stripe/admin → org writes. */
export function orgBillingFromCheckoutFields(params: {
  plan: PlanId | string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  extraLessons: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingMode?: "subscription" | "partner";
}): OrgBillingWritePayload {
  const plan = normalizePlanId(params.plan);
  return {
    plan,
    subscription_status: params.subscriptionStatus,
    current_period_end: params.currentPeriodEnd,
    extra_lessons: Math.max(0, params.extraLessons),
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    billing_mode: params.billingMode ?? "subscription",
  };
}

export type VerificationCounts = {
  profilesTotal: number;
  profilesWithoutOrg: number;
  orgsWithPaidPlan: number;
  workspacesMissingOrgButOwnerHasOrg: number;
  powMissingOrgButOwnerHasOrg: number;
};

export function verificationPassed(counts: VerificationCounts): boolean {
  return (
    counts.profilesWithoutOrg === 0 &&
    counts.workspacesMissingOrgButOwnerHasOrg === 0 &&
    counts.powMissingOrgButOwnerHasOrg === 0
  );
}
