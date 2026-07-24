// ============================================
// PLAN DEFINITIONS & USAGE LIMITS
// ============================================

/**
 * Current product plans. `inactive` = no personal paid entitlement.
 * Single paid subscription tier: api_metered. Trial is one-time full access.
 * Legacy Individual / Pro-Teams plan ids are removed; migrate rows to api_metered.
 */
export type PlanId = "inactive" | "trial" | "api_metered";

/** Subscription statuses we set intentionally (Stripe may pass through others). */
export type SubscriptionStatus =
  | "active"
  | "inactive"
  | "trial_expired"
  | "canceled"
  | "past_due"
  | string;

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  priceAmount: number; // cents
  /** Proof-of-Work submissions per billing period. null = unlimited. */
  proofOfWorkPerPeriod: number | null;
  workspacesPerPeriod: number | null; // null = unlimited
  features: string[];
  stripePriceEnv: string | null; // env var name for Stripe Price ID
}

/** One-time trial: full product access for this many days after payment. */
export const TRIAL_ACCESS_DAYS = 3;
export const TRIAL_PRICE_CENTS = 1999;

/** Token-tier regular: fixed PoW allowance when a valid token is present. */
export const TOKEN_REGULAR_PROOF_OF_WORK_LIMIT = 25;

export const PROOF_OF_WORK_ALLOWANCE_LABEL = "Proof-of-Work submissions";

export const PLANS: Record<PlanId, PlanDef> = {
  inactive: {
    id: "inactive",
    name: "Inactive",
    price: "$0",
    priceAmount: 0,
    proofOfWorkPerPeriod: 0,
    workspacesPerPeriod: 0,
    features: [
      "No active subscription",
      "Upgrade or start a trial to use the product",
    ],
    stripePriceEnv: null,
  },
  trial: {
    id: "trial",
    name: "3-Day Trial",
    price: "$19.99",
    priceAmount: TRIAL_PRICE_CENTS,
    proofOfWorkPerPeriod: null,
    workspacesPerPeriod: null,
    features: [
      "Full access for 3 days",
      "Unlimited Proof-of-Work submissions",
      "Unlimited Workspaces",
      "All core product features",
    ],
    stripePriceEnv: null,
  },
  api_metered: {
    id: "api_metered",
    name: "API Metered",
    price: "$99",
    priceAmount: 9900,
    proofOfWorkPerPeriod: null,
    workspacesPerPeriod: null,
    features: [
      "Unlimited product usage (no monthly cap)",
      "0.05¢ per external/API-direct PoW submission",
      "$1 per TAP session · $10 per ILE session",
      "$99/mo platform access",
      "Unlimited Workspaces",
      "Proof-of-Work API keys + MCP",
      "Internal TAP/ILE PoW not billed as API PoW",
      "Priority support",
    ],
    stripePriceEnv: null,
  },
};

/** Monthly platform fee for API Metered (cents). */
export const API_METERED_PLATFORM_FEE_CENTS = 9900;

/**
 * Per external/API-direct Proof-of-Work submission on API Metered (cents).
 * 0.05 cents = $0.0005. App-side accounting uses fractional cents;
 * Stripe invoice line items round to whole cents (see estimateApiMeteredInvoice).
 */
export const POW_API_CALL_PRICE_CENTS = 0.05;

/** Per TAP session on API Metered (cents) — $1. */
export const TAP_SESSION_PRICE_CENTS = 100;

/** Per ILE session on API Metered (cents) — $10. */
export const ILE_SESSION_PRICE_CENTS = 1000;

/**
 * Removed plan ids that should be rewritten to api_metered by data migration.
 * Not part of PlanId — only used by migration helpers.
 */
export const REMOVED_PLAN_IDS_MIGRATED_TO_API_METERED = [
  "regular_2026",
  "pro_teams",
  "regular",
  "pro",
] as const;

/**
 * Map a stored plan string onto the current PlanId set.
 * Removed paid tiers (Individual / Teams) become api_metered so migration/scripts
 * and any unmigrated rows still land on the sole remaining paid tier.
 * Truly unknown / free ids become inactive.
 */
export function migratePlanIdToCurrent(plan: string | null | undefined): PlanId {
  if (plan === "trial" || plan === "api_metered") return plan;
  if (
    plan === "regular_2026" ||
    plan === "pro_teams" ||
    plan === "regular" ||
    plan === "pro"
  ) {
    return "api_metered";
  }
  return "inactive";
}

export function formatPlanMonthlyPrice(plan: PlanId | string, _volume?: number): string {
  if (plan === "api_metered") {
    return `$${API_METERED_PLATFORM_FEE_CENTS / 100}/month + usage (0.05¢/API PoW · $1/TAP · $10/ILE)`;
  }
  if (plan === "trial") return `$${TRIAL_PRICE_CENTS / 100} one-time`;
  if (plan === "inactive") return "$0";
  const def = PLANS[plan as PlanId];
  return def ? `${def.price}/month` : String(plan);
}

export function isInactivePlan(plan: PlanId | string | null | undefined): boolean {
  return plan === "inactive" || plan === "free" || plan === "regular" || plan === "pro";
}

export function isTrialExpiredStatus(status: string | null | undefined): boolean {
  return status === "trial_expired";
}

/**
 * Normalize a plan string to a known PlanId.
 * Removed tier names are not kept for compatibility — unknown/removed → inactive.
 * Call migratePlanIdToCurrent when rewriting stored entitlements.
 */
export function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan === "trial" || plan === "api_metered") {
    return plan;
  }
  return "inactive";
}

/**
 * Pure check: active trial whose period has ended should demote to inactive + trial_expired.
 */
export function demoteExpiredTrialProfile(profile: {
  plan: string;
  subscription_status: string;
  current_period_end: string | null;
}): { plan: "inactive"; subscription_status: "trial_expired" } | null {
  if (profile.plan !== "trial") return null;
  if (!profile.current_period_end) return null;
  if (new Date(profile.current_period_end) > new Date()) return null;
  return { plan: "inactive", subscription_status: "trial_expired" };
}

export interface UserProfile {
  plan: PlanId;
  is_admin: boolean;
  /**
   * Historical volume overage column (profiles.extra_lessons / orgs.extra_lessons).
   * No longer used for product limits under the single metered tier; kept for schema compat.
   */
  extra_lessons: number;
  extra_workspaces?: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  token_validity_expires_at: string | null;
}

export type ProductAccessProfile = Pick<
  UserProfile,
  "plan" | "subscription_status" | "is_admin" | "token_tier" | "token_validity_expires_at"
> & {
  organization_id?: string | null;
  current_period_end?: string | null;
};

/** Org billing snapshot for access checks (loaded separately from profile). */
export type ProductAccessOrg = {
  id: string;
  plan: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  billing_mode?: string | null;
  archived_at?: string | null;
  extra_lessons?: number | null;
};

const PAID_PRODUCT_PLANS = new Set<PlanId>(["trial", "api_metered"]);

/** True when subscription_status is active and the billing window has not ended. */
export function isBillingPeriodActive(
  profile: Pick<UserProfile, "subscription_status" | "current_period_end"> | null | undefined
): boolean {
  if (!profile || profile.subscription_status !== "active") return false;
  if (profile.current_period_end && new Date(profile.current_period_end) <= new Date()) {
    return false;
  }
  return true;
}

/**
 * True when the user may use the product.
 * Priority: admin → valid token → entitled organization → personal paid plan.
 * Membership alone does **not** grant access (org must be entitled).
 */
export function hasProductAccess(
  profile: ProductAccessProfile | null | undefined,
  org?: ProductAccessOrg | null
): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;

  const isTokenValid =
    profile.token_tier &&
    (profile.token_validity_expires_at === null ||
      new Date(profile.token_validity_expires_at) > new Date());
  if (isTokenValid) return true;

  if (profile.organization_id && org && org.id === profile.organization_id) {
    if (org.archived_at) return false;
    const plan = normalizePlanId(org.plan);
    const mode = org.billing_mode || "subscription";
    if (mode === "partner") {
      return plan !== "inactive";
    }
    if (org.subscription_status !== "active") return false;
    if (plan === "inactive") return false;
    if (org.current_period_end && new Date(org.current_period_end) <= new Date()) {
      return false;
    }
    return PAID_PRODUCT_PLANS.has(plan);
  }

  // No org → no product access (except admin/token). Personal profiles.plan is not authoritative.
  return false;
}

export interface OrgUsageSummary {
  id: string;
  name: string;
  isOrgAdmin: boolean;
  memberCount: number;
  guestCount: number;
  used: number;
  limit: number | null;
  /** Org-level billing: partner = Stripe bypass / complimentary entitlement. */
  billingMode?: "subscription" | "partner";
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  plan: PlanId;
  used: number;
  limit: number | null; // null = unlimited
  isAdmin: boolean;
  /** User's own Proof-of-Work submissions in the current period (org members). */
  personalUsed?: number;
  organization?: OrgUsageSummary | null;
}

export interface ProofOfWorkCheckResult {
  allowed: boolean;
  reason?: string;
  plan: PlanId;
  used: number;
  limit: number | null;
  isAdmin: boolean;
}

export interface WorkspaceCheckResult {
  allowed: boolean;
  reason?: string;
  plan: PlanId;
  used: number;
  limit: number | null;
  isAdmin: boolean;
}

export function getWorkspaceLimit(profile: UserProfile): number | null {
  const { plan, is_admin, subscription_status, current_period_end } = profile;

  if (is_admin) return null;

  const normalized = normalizePlanId(plan);
  const planDef = PLANS[normalized];

  if (normalized === "trial" && isBillingPeriodActive({ subscription_status, current_period_end })) {
    return null;
  }

  if (subscription_status === "active" && normalized !== "inactive") {
    return null;
  }

  const base = planDef.workspacesPerPeriod;
  if (base === null) return null;
  return base;
}

/**
 * Resolve the effective Proof-of-Work submission allowance for a profile.
 * Trial + api_metered are unlimited (metered billing applies to external API PoW + sessions).
 */
export function getProofOfWorkAllowance(profile: UserProfile): Pick<UsageCheckResult, "plan" | "limit" | "isAdmin"> {
  const { plan, is_admin, subscription_status, current_period_end, token_tier, token_validity_expires_at } = profile;
  const normalized = normalizePlanId(plan);

  if (is_admin) {
    return { plan: normalized, limit: null, isAdmin: true };
  }

  const isTokenValid = token_tier && (
    token_validity_expires_at === null || new Date(token_validity_expires_at) > new Date()
  );

  if (isTokenValid) {
    if (token_tier === "pro") {
      return { plan: normalized, limit: null, isAdmin: false };
    }
    if (token_tier === "regular") {
      return { plan: normalized, limit: TOKEN_REGULAR_PROOF_OF_WORK_LIMIT, isAdmin: false };
    }
  }

  if (normalized === "api_metered" && subscription_status === "active") {
    return { plan: normalized, limit: null, isAdmin: false };
  }

  if (normalized === "trial" && isBillingPeriodActive({ subscription_status, current_period_end })) {
    return { plan: normalized, limit: null, isAdmin: false };
  }

  // Inactive / expired / unknown — no freemium PoW pool
  return { plan: "inactive", limit: 0, isAdmin: false };
}

/**
 * Check whether a user can submit another Proof-of-Work artifact this billing period.
 * TAP, ILE, and API uploads all meter against this allowance (unlimited on api_metered).
 */
export function canSubmitProofOfWork(
  profile: UserProfile,
  proofOfWorkCount: number
): ProofOfWorkCheckResult {
  const { plan, limit, isAdmin } = getProofOfWorkAllowance(profile);

  if (isAdmin) {
    return { allowed: true, plan, used: proofOfWorkCount, limit: null, isAdmin: true };
  }

  if (limit === null) {
    return { allowed: true, plan, used: proofOfWorkCount, limit: null, isAdmin: false };
  }

  if (limit <= 0 || proofOfWorkCount >= limit) {
    return {
      allowed: false,
      reason:
        limit <= 0
          ? "No active subscription. Start a trial or upgrade at /pricing to submit Proof-of-Work."
          : `You've used all ${limit} Proof-of-Work submissions this month. Upgrade your plan volume to continue.`,
      plan,
      used: proofOfWorkCount,
      limit,
      isAdmin: false,
    };
  }

  return { allowed: true, plan, used: proofOfWorkCount, limit, isAdmin: false };
}

/**
 * Check whether a user can create another Workspace.
 * `workspaceCount` = active (non-archived) workspaces owned by the user.
 */
export function canCreateWorkspace(
  profile: UserProfile,
  workspaceCount: number
): WorkspaceCheckResult {
  const plan = normalizePlanId(profile.plan);
  const { is_admin } = profile;

  if (is_admin) {
    return { allowed: true, plan, used: workspaceCount, limit: null, isAdmin: true };
  }

  const limit = getWorkspaceLimit({ ...profile, plan });
  if (limit === null) {
    return { allowed: true, plan, used: workspaceCount, limit: null, isAdmin: false };
  }

  if (limit <= 0 || workspaceCount >= limit) {
    return {
      allowed: false,
      reason:
        plan === "inactive"
          ? "No active subscription. Start a trial or upgrade at /pricing to create a workspace."
          : `You've reached your plan limit of ${limit} Workspaces. Upgrade at /pricing or archive a workspace.`,
      plan,
      used: workspaceCount,
      limit,
      isAdmin: false,
    };
  }

  return { allowed: true, plan, used: workspaceCount, limit, isAdmin: false };
}

export function isApiMeteredPlan(plan: PlanId | string | null | undefined): boolean {
  return plan === "api_metered";
}

/** Format the external PoW unit price for display (0.05 cents). */
export function formatPowApiCallPrice(): string {
  return "0.05¢";
}

export function formatTapSessionPrice(): string {
  return `$${(TAP_SESSION_PRICE_CENTS / 100).toFixed(0)}`;
}

export function formatIleSessionPrice(): string {
  return `$${(ILE_SESSION_PRICE_CENTS / 100).toFixed(0)}`;
}

/**
 * True when a PoW row should be billed at the external/API rate.
 * Shipped signal: created via API key (Bearer key or OAuth) → created_by_api_key_id set.
 * TAP/ILE product-generated PoW leaves this null and is billed via session rates instead.
 */
export function isExternalApiPowUsage(createdByApiKeyId: string | null | undefined): boolean {
  return createdByApiKeyId != null && createdByApiKeyId !== "";
}

export type ApiMeteredInvoiceEstimate = {
  platformCents: number;
  /** External/API-direct PoW usage (fractional cents allowed before Stripe rounding). */
  externalPowCents: number;
  tapSessionCents: number;
  ileSessionCents: number;
  usageCents: number;
  /** Whole-cent total suitable for Stripe line items (rounded usage + platform). */
  totalCents: number;
  /** Whole-cent usage total for Stripe (rounded). */
  usageCentsRounded: number;
  externalPowCount: number;
  tapSessionCount: number;
  ileSessionCount: number;
};

/**
 * Estimate API Metered invoice from usage counts.
 * - externalPowCount: API-direct PoW only (not TAP/ILE-generated PoW)
 * - tapSessionCount / ileSessionCount: session rates ($1 / $10)
 */
export function estimateApiMeteredInvoice(
  externalPowCount: number,
  tapSessionCount = 0,
  ileSessionCount = 0
): ApiMeteredInvoiceEstimate {
  const pow = Math.max(0, externalPowCount);
  const tap = Math.max(0, tapSessionCount);
  const ile = Math.max(0, ileSessionCount);

  const externalPowCents = pow * POW_API_CALL_PRICE_CENTS;
  const tapSessionCents = tap * TAP_SESSION_PRICE_CENTS;
  const ileSessionCents = ile * ILE_SESSION_PRICE_CENTS;
  const usageCents = externalPowCents + tapSessionCents + ileSessionCents;
  // Stripe amounts are integer cents; round half-up on total usage.
  const usageCentsRounded = Math.round(usageCents);

  return {
    platformCents: API_METERED_PLATFORM_FEE_CENTS,
    externalPowCents,
    tapSessionCents,
    ileSessionCents,
    usageCents,
    usageCentsRounded,
    totalCents: API_METERED_PLATFORM_FEE_CENTS + usageCentsRounded,
    externalPowCount: pow,
    tapSessionCount: tap,
    ileSessionCount: ile,
  };
}

/** Active subscription may use the Proof-of-Work REST/MCP API. */
export function hasProofOfWorkApiAccess(
  plan: PlanId | string | null | undefined,
  subscriptionStatus?: string | null,
): boolean {
  if (subscriptionStatus !== "active") return false;
  return plan === "api_metered";
}

/** Plans that may create Proof-of-Work API keys (v2 /api/v3/pow/keys). */
export function hasAgentApiKeyPlan(plan: PlanId | string | null | undefined): boolean {
  return plan === "api_metered";
}
