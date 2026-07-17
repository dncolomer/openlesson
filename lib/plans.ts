// ============================================
// PLAN DEFINITIONS & USAGE LIMITS
// ============================================

/**
 * Current product plans. `inactive` = no personal paid entitlement.
 * Legacy free/regular/pro plan ids are removed; use inactive + subscription_status.
 */
export type PlanId = "inactive" | "trial" | "regular_2026" | "pro_teams" | "api_metered";

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

export interface VolumeTier {
  /** Proof-of-Work submissions per month (stored as monthly_volume in Stripe). */
  proofOfWork: number;
  priceCents: number;
}

/** Multiplier when converting legacy session-count Stripe volume metadata to PoW submissions. */
export const PROOF_OF_WORK_SUBMISSIONS_PER_SESSION = 4;

/** Pre–PoW-only pricing stored session counts in Stripe metadata (Jul 2026). */
export const LEGACY_SESSION_VOLUME_TIERS = new Set([25, 50, 100, 250, 500, 1000, 2500]);

export const PROOF_OF_WORK_ALLOWANCE_LABEL = "Proof-of-Work submissions";

/** One-time trial: full product access for this many days after payment. */
export const TRIAL_ACCESS_DAYS = 3;
export const TRIAL_PRICE_CENTS = 1999;

/** Token-tier regular: fixed PoW allowance when a valid token is present. */
export const TOKEN_REGULAR_PROOF_OF_WORK_LIMIT = 25;

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
  regular_2026: {
    id: "regular_2026",
    name: "Individual",
    price: "$49",
    priceAmount: 4900,
    proofOfWorkPerPeriod: 100,
    workspacesPerPeriod: null,
    features: [
      "100+ Proof-of-Work submissions/mo",
      "Unlimited Workspaces",
      "Volume upgrades before checkout",
      "Session reports & history",
    ],
    stripePriceEnv: null,
  },
  pro_teams: {
    id: "pro_teams",
    name: "Pro / Teams",
    price: "$599",
    priceAmount: 59900,
    proofOfWorkPerPeriod: 1000,
    workspacesPerPeriod: null,
    features: [
      "1,000+ Proof-of-Work submissions/mo",
      "Unlimited Workspaces",
      "Volume upgrades before checkout",
      "Org guests and team API keys",
      "Readiness proof of work and history",
      "Priority support",
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
      "Unlimited Proof-of-Work API usage (no monthly cap)",
      "$1.99 per API submission — invoiced monthly",
      "$99/mo platform access",
      "Unlimited Workspaces",
      "Agentic API keys + MCP",
      "TAP / ILE included without per-call API metering",
      "Priority support",
    ],
    stripePriceEnv: null,
  },
};

/** Monthly platform fee for API Metered (cents). */
export const API_METERED_PLATFORM_FEE_CENTS = 9900;

/** Per Proof-of-Work API submission on API Metered (cents) — higher than bundled tiers. */
export const POW_API_CALL_PRICE_CENTS = 199;

/** 2026 volume tiers (PoW + price). Canonical source for Stripe checkout. */
export const REGULAR_VOLUME_TIERS: readonly VolumeTier[] = [
  { proofOfWork: 100, priceCents: 4900 },
  { proofOfWork: 250, priceCents: 9900 },
  { proofOfWork: 500, priceCents: 14900 },
];

export const TEAM_VOLUME_TIERS: readonly VolumeTier[] = [
  { proofOfWork: 1000, priceCents: 59900 },
  { proofOfWork: 2500, priceCents: 99900 },
  { proofOfWork: 5000, priceCents: 149900 },
  { proofOfWork: 10000, priceCents: 249900 },
];

/** Intermediate PoW tiers already stored as PoW counts in Stripe metadata — do not multiply. */
export const LEGACY_POW_VOLUME_TIERS = new Set([200, 400, 2000, 4000]);

export const REGULAR_VOLUME_PRICES: Record<number, number> = Object.fromEntries(
  REGULAR_VOLUME_TIERS.map((tier) => [tier.proofOfWork, tier.priceCents])
);

export const TEAM_VOLUME_PRICES: Record<number, number> = Object.fromEntries(
  TEAM_VOLUME_TIERS.map((tier) => [tier.proofOfWork, tier.priceCents])
);

export const DEFAULT_REGULAR_VOLUME = REGULAR_VOLUME_TIERS[0].proofOfWork;
export const DEFAULT_TEAM_VOLUME = TEAM_VOLUME_TIERS[0].proofOfWork;

export const BASE_INCLUDED_PROOF_OF_WORK: Record<string, number> = {
  regular_2026: 100,
  pro_teams: 1000,
};

/**
 * Convert Stripe `monthly_volume` to Proof-of-Work submissions.
 * Legacy subscriptions stored session counts; new ones set metadata.volume_unit = "proof_of_work".
 */
export function normalizeStripeVolumeToProofOfWork(
  volume: number,
  volumeUnit?: string | null
): number {
  if (!Number.isFinite(volume) || volume <= 0) return volume;
  if (volumeUnit === "proof_of_work") return volume;
  if (LEGACY_POW_VOLUME_TIERS.has(volume)) return volume;
  if (LEGACY_SESSION_VOLUME_TIERS.has(volume)) {
    return volume * PROOF_OF_WORK_SUBMISSIONS_PER_SESSION;
  }
  return volume;
}

export function formatProofOfWorkAllowance(count: number): string {
  return `${count.toLocaleString()} Proof-of-Work submission${count === 1 ? "" : "s"}/mo`;
}

export function formatVolumeTierLabel(tier: VolumeTier): string {
  return formatProofOfWorkAllowance(tier.proofOfWork);
}

function findVolumeTier(priceType: string, proofOfWork: number): VolumeTier | null {
  const tiers = priceType === "pro_teams" ? TEAM_VOLUME_TIERS : priceType === "regular_2026" ? REGULAR_VOLUME_TIERS : [];
  return tiers.find((tier) => tier.proofOfWork === proofOfWork) ?? null;
}

export function resolveCheckoutVolume(priceType: string, rawVolume: unknown): number {
  const requested = Number(rawVolume);
  if (priceType === "regular_2026") {
    return REGULAR_VOLUME_PRICES[requested] ? requested : DEFAULT_REGULAR_VOLUME;
  }
  if (priceType === "pro_teams") {
    return TEAM_VOLUME_PRICES[requested] ? requested : DEFAULT_TEAM_VOLUME;
  }
  return 1;
}

export function getVolumeTier(priceType: string, proofOfWorkVolume: number): VolumeTier | null {
  return findVolumeTier(priceType, proofOfWorkVolume);
}

export function formatPlanMonthlyPrice(
  plan: PlanId | string,
  volume?: number
): string {
  if (plan === "regular_2026") {
    const vol = volume ?? DEFAULT_REGULAR_VOLUME;
    const cents = REGULAR_VOLUME_PRICES[vol] ?? REGULAR_VOLUME_PRICES[DEFAULT_REGULAR_VOLUME];
    return `$${cents / 100}/month`;
  }
  if (plan === "pro_teams") {
    const vol = volume ?? DEFAULT_TEAM_VOLUME;
    const cents = TEAM_VOLUME_PRICES[vol] ?? TEAM_VOLUME_PRICES[DEFAULT_TEAM_VOLUME];
    return `$${cents / 100}/month`;
  }
  if (plan === "api_metered") {
    return `$${API_METERED_PLATFORM_FEE_CENTS / 100}/month + $${POW_API_CALL_PRICE_CENTS / 100} per API submission`;
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

export function normalizePlanId(plan: string | null | undefined): PlanId {
  if (plan === "trial" || plan === "regular_2026" || plan === "pro_teams" || plan === "api_metered") {
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
   * Volume-tier overage above the plan base (profiles.extra_lessons column).
   * Set by Stripe from monthly_volume − base; not a one-time purchase pack.
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

const PAID_PRODUCT_PLANS = new Set<PlanId>([
  "trial",
  "regular_2026",
  "pro_teams",
  "api_metered",
]);

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
  /** User's own Proof-of-Work submissions in the current period (org members on Teams). */
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
 */
export function getProofOfWorkAllowance(profile: UserProfile): Pick<UsageCheckResult, "plan" | "limit" | "isAdmin"> {
  const { plan, is_admin, extra_lessons, subscription_status, current_period_end, token_tier, token_validity_expires_at } = profile;
  const normalized = normalizePlanId(plan);

  if (is_admin) {
    return { plan: normalized, limit: null, isAdmin: true };
  }

  const planDef = PLANS[normalized];

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

  if ((normalized === "regular_2026" || normalized === "pro_teams") && subscription_status === "active") {
    const effectiveLimit = (planDef.proofOfWorkPerPeriod ?? 0) + extra_lessons;
    return { plan: normalized, limit: effectiveLimit, isAdmin: false };
  }

  // Inactive / expired / unknown — no freemium PoW pool
  return { plan: "inactive", limit: 0, isAdmin: false };
}

/**
 * Check whether a user can submit another Proof-of-Work artifact this billing period.
 * TAP, ILE, and API uploads all meter against this allowance.
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

export function formatPowApiCallPrice(): string {
  return `$${(POW_API_CALL_PRICE_CENTS / 100).toFixed(2)}`;
}

export function estimateApiMeteredInvoice(apiCallCount: number): {
  platformCents: number;
  usageCents: number;
  totalCents: number;
  apiCallCount: number;
} {
  const usageCents = Math.max(0, apiCallCount) * POW_API_CALL_PRICE_CENTS;
  return {
    platformCents: API_METERED_PLATFORM_FEE_CENTS,
    usageCents,
    totalCents: API_METERED_PLATFORM_FEE_CENTS + usageCents,
    apiCallCount: Math.max(0, apiCallCount),
  };
}

/** Active subscription may use the Proof-of-Work REST/MCP API. */
export function hasProofOfWorkApiAccess(
  plan: PlanId | string | null | undefined,
  subscriptionStatus?: string | null,
): boolean {
  if (subscriptionStatus !== "active") return false;
  return plan === "pro_teams" || plan === "api_metered";
}

/** Plans that may create Proof-of-Work API keys (v2 /api/v2/agent/keys). */
export function hasAgentApiKeyPlan(plan: PlanId | string | null | undefined): boolean {
  return plan === "pro_teams" || plan === "api_metered";
}
