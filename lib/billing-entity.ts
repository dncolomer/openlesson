import {
  normalizePlanId,
  PLANS,
  type PlanId,
  type UserProfile,
} from "@/lib/plans";

/** How the organization pays / is entitled. */
export type OrgBillingMode = "subscription" | "partner";

export type OrgKind = "personal" | "team" | "partner";

/** Org row fields needed for product access + PoW limits. */
export type OrgBillingRow = {
  id: string;
  plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  extra_lessons: number | null;
  billing_mode: string | null;
  kind?: string | null;
  archived_at?: string | null;
};

export type ResolvedBillingEntity =
  | { source: "admin"; plan: PlanId; limit: null; isAdmin: true; entitled: true }
  | {
      source: "token";
      plan: PlanId;
      limit: number | null;
      isAdmin: false;
      entitled: true;
      tokenTier: string;
    }
  | {
      source: "organization";
      plan: PlanId;
      limit: number | null;
      isAdmin: false;
      entitled: boolean;
      organizationId: string;
      billingMode: OrgBillingMode;
      subscriptionStatus: string;
      currentPeriodEnd: string | null;
      extraLessons: number;
    }
  | {
      source: "user";
      plan: PlanId;
      limit: number | null;
      isAdmin: false;
      entitled: boolean;
      subscriptionStatus: string;
      currentPeriodEnd: string | null;
      extraLessons: number;
    }
  | { source: "none"; plan: "inactive"; limit: 0; isAdmin: false; entitled: false };

export type ProfileForBilling = Pick<
  UserProfile,
  | "plan"
  | "is_admin"
  | "extra_lessons"
  | "subscription_status"
  | "current_period_end"
  | "token_tier"
  | "token_validity_expires_at"
> & {
  organization_id?: string | null;
};

function powLimitForPlan(
  plan: PlanId,
  subscriptionStatus: string,
  currentPeriodEnd: string | null,
  extraLessons: number,
  isAdmin: boolean
): number | null {
  if (isAdmin) return null;

  const planDef = PLANS[plan];

  if (plan === "api_metered" && subscriptionStatus === "active") {
    return null;
  }

  if (
    plan === "trial" &&
    subscriptionStatus === "active" &&
    (!currentPeriodEnd || new Date(currentPeriodEnd) > new Date())
  ) {
    return null;
  }

  if ((plan === "regular_2026" || plan === "pro_teams") && subscriptionStatus === "active") {
    return (planDef.proofOfWorkPerPeriod ?? 0) + extraLessons;
  }

  return 0;
}

/**
 * Partner orgs: product access when plan is a paid/product plan (not inactive),
 * regardless of Stripe status. Subscription orgs need active period.
 */
export function isOrgEntitled(org: OrgBillingRow): boolean {
  if (org.archived_at) return false;

  const plan = normalizePlanId(org.plan);
  const mode = (org.billing_mode || "subscription") as OrgBillingMode;
  const status = org.subscription_status || "inactive";

  if (mode === "partner") {
    return plan !== "inactive";
  }

  if (status !== "active") return false;
  if (plan === "inactive") return false;

  if (org.current_period_end && new Date(org.current_period_end) <= new Date()) {
    return false;
  }

  return plan === "trial" || plan === "regular_2026" || plan === "pro_teams" || plan === "api_metered";
}

export function orgToUserProfileShape(org: OrgBillingRow, isAdmin = false): UserProfile {
  const plan = normalizePlanId(org.plan);
  const mode = (org.billing_mode || "subscription") as OrgBillingMode;
  // Partner orgs act as "active" for allowance helpers when entitled
  const subscription_status =
    mode === "partner" && plan !== "inactive"
      ? "active"
      : org.subscription_status || "inactive";

  return {
    plan,
    is_admin: isAdmin,
    extra_lessons: org.extra_lessons ?? 0,
    subscription_status,
    current_period_end: org.current_period_end,
    token_tier: null,
    token_validity_expires_at: null,
  };
}

/**
 * Resolve who pays and what PoW limit applies.
 * Priority: platform admin → valid token → organization (if present) → personal profile.
 *
 * Membership alone does **not** grant access — the org must be entitled
 * (active subscription or partner grant).
 */
export function resolveBillingEntity(
  profile: ProfileForBilling | null | undefined,
  org: OrgBillingRow | null | undefined
): ResolvedBillingEntity {
  if (!profile) {
    return { source: "none", plan: "inactive", limit: 0, isAdmin: false, entitled: false };
  }

  if (profile.is_admin) {
    return {
      source: "admin",
      plan: normalizePlanId(profile.plan),
      limit: null,
      isAdmin: true,
      entitled: true,
    };
  }

  const isTokenValid =
    !!profile.token_tier &&
    (profile.token_validity_expires_at === null ||
      new Date(profile.token_validity_expires_at) > new Date());

  if (isTokenValid && profile.token_tier) {
    const limit =
      profile.token_tier === "pro"
        ? null
        : profile.token_tier === "regular"
          ? 25
          : 0;
    return {
      source: "token",
      plan: normalizePlanId(profile.plan),
      limit,
      isAdmin: false,
      entitled: true,
      tokenTier: profile.token_tier,
    };
  }

  // Org membership present → org is the only product billing source (no personal fallback).
  if (profile.organization_id) {
    if (org && org.id === profile.organization_id) {
      const plan = normalizePlanId(org.plan);
      const entitled = isOrgEntitled(org);
      const mode = (org.billing_mode || "subscription") as OrgBillingMode;
      const status =
        mode === "partner" && plan !== "inactive"
          ? "active"
          : org.subscription_status || "inactive";
      const extra = org.extra_lessons ?? 0;
      const limit = entitled
        ? powLimitForPlan(plan, status, org.current_period_end, extra, false)
        : 0;

      return {
        source: "organization",
        plan: entitled ? plan : "inactive",
        limit,
        isAdmin: false,
        entitled,
        organizationId: org.id,
        billingMode: mode,
        subscriptionStatus: status,
        currentPeriodEnd: org.current_period_end,
        extraLessons: extra,
      };
    }

    // organization_id set but org row missing/unloadable → deny product access
    return {
      source: "organization",
      plan: "inactive",
      limit: 0,
      isAdmin: false,
      entitled: false,
      organizationId: profile.organization_id,
      billingMode: "subscription",
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
      extraLessons: 0,
    };
  }

  // No organization_id: no product access (except admin/token above). Personal plan is not authoritative.
  return { source: "none", plan: "inactive", limit: 0, isAdmin: false, entitled: false };
}

export function billingEntityHasProductAccess(entity: ResolvedBillingEntity): boolean {
  return entity.entitled;
}

/** Proof-of-Work REST/MCP API access for pro_teams / api_metered (org or personal). */
export function billingEntityHasApiAccess(entity: ResolvedBillingEntity): boolean {
  if (entity.source === "admin") return true;
  if (!entity.entitled) return false;
  return entity.plan === "pro_teams" || entity.plan === "api_metered";
}

export function billingEntityToUserProfile(entity: ResolvedBillingEntity): UserProfile {
  if (entity.source === "admin") {
    return {
      plan: entity.plan,
      is_admin: true,
      extra_lessons: 0,
      subscription_status: "active",
      current_period_end: null,
      token_tier: null,
      token_validity_expires_at: null,
    };
  }
  if (entity.source === "token") {
    return {
      plan: entity.plan,
      is_admin: false,
      extra_lessons: 0,
      subscription_status: "active",
      current_period_end: null,
      token_tier: entity.tokenTier,
      token_validity_expires_at: null,
    };
  }
  if (entity.source === "organization") {
    return {
      plan: entity.plan,
      is_admin: false,
      extra_lessons: entity.extraLessons,
      subscription_status: entity.subscriptionStatus,
      current_period_end: entity.currentPeriodEnd,
      token_tier: null,
      token_validity_expires_at: null,
    };
  }
  if (entity.source === "user") {
    return {
      plan: entity.plan,
      is_admin: false,
      extra_lessons: entity.extraLessons,
      subscription_status: entity.subscriptionStatus,
      current_period_end: entity.currentPeriodEnd,
      token_tier: null,
      token_validity_expires_at: null,
    };
  }
  return {
    plan: "inactive",
    is_admin: false,
    extra_lessons: 0,
    subscription_status: "inactive",
    current_period_end: null,
    token_tier: null,
    token_validity_expires_at: null,
  };
}
