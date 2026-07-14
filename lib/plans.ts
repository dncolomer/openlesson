// ============================================
// PLAN DEFINITIONS & USAGE LIMITS
// ============================================

export type PlanId = "free" | "trial" | "regular" | "pro" | "regular_2026" | "pro_teams" | "api_metered";

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

/** @deprecated Pre–PoW-only pricing stored session counts in Stripe metadata (Jul 2026). */
export const LEGACY_SESSION_VOLUME_TIERS = new Set([25, 50, 100, 250, 500, 1000, 2500]);

/** @deprecated Use proofOfWork field on VolumeTier. */
export const PROOF_OF_WORK_SUBMISSIONS_PER_SESSION = 4;

export const PROOF_OF_WORK_ALLOWANCE_LABEL = "Proof-of-Work submissions";

/** Extra Proof-of-Work submissions per one-time purchase pack. */
export const EXTRA_PROOF_OF_WORK_PACK_SIZE = 4;

/** One-time trial: full product access for this many days after payment. */
export const TRIAL_ACCESS_DAYS = 3;
export const TRIAL_PRICE_CENTS = 1999;

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    priceAmount: 0,
    proofOfWorkPerPeriod: 25,
    workspacesPerPeriod: 1,
    features: [
      "25 Proof-of-Work submissions/mo",
      "One Workspace",
      "Basic readiness report",
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
  regular: {
    id: "regular",
    name: "Individual (legacy)",
    price: "$4.99",
    priceAmount: 499,
    proofOfWorkPerPeriod: 20,
    workspacesPerPeriod: 1,
    features: [
      "20 Proof-of-Work submissions/mo",
      "Buy extra submissions at $3.99 per 4",
      "Think-aloud data uploads",
      "Muse EEG integration",
      "Session reports & history",
    ],
    stripePriceEnv: "STRIPE_PRICE_REGULAR",
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
      "Additional submissions at $3.99 per 4",
      "Session reports & history",
    ],
    stripePriceEnv: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$14.99",
    priceAmount: 1499,
    proofOfWorkPerPeriod: null,
    workspacesPerPeriod: null,
    features: [
      "Unlimited Proof-of-Work submissions",
      "Unlimited Workspaces",
      "Think-aloud data uploads",
      "Custom system prompts",
      "Muse EEG integration",
      "Session reports & history",
      "Priority support",
      "Agentic Tutoring (API keys)",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
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
      "Additional submissions at $1.99 per 4",
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

/** @deprecated Intermediate PoW tiers (Jul 2026) — never multiply on Stripe metadata read. */
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

/** @deprecated Use BASE_INCLUDED_PROOF_OF_WORK */
export const BASE_INCLUDED_LESSONS = BASE_INCLUDED_PROOF_OF_WORK;

/** Additional Proof-of-Work pack price (cents) — pack size is EXTRA_PROOF_OF_WORK_PACK_SIZE. */
export const EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS = 399;
export const PRO_TEAMS_EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS = 199;

/** @deprecated Use EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS */
export const EXTRA_BLOCK_PRICE_CENTS = EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS;
/** @deprecated Use PRO_TEAMS_EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS */
export const PRO_TEAMS_EXTRA_BLOCK_PRICE_CENTS = PRO_TEAMS_EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS;
/** @deprecated Use EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS */
export const EXTRA_LESSON_PRICE = EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS;
/** @deprecated Use PRO_TEAMS_EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS */
export const PRO_TEAMS_EXTRA_LESSON_PRICE = PRO_TEAMS_EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS;

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

/** @deprecated Use normalizeStripeVolumeToProofOfWork for Stripe metadata. */
export function normalizeVolumeToProofOfWork(volume: number): number {
  return normalizeStripeVolumeToProofOfWork(volume);
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

export function getExtraProofOfWorkPackPriceCents(plan: PlanId | string | null | undefined): number {
  return plan === "pro_teams" || plan === "pro"
    ? PRO_TEAMS_EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS
    : EXTRA_PROOF_OF_WORK_PACK_PRICE_CENTS;
}

/** @deprecated Use getExtraProofOfWorkPackPriceCents */
export function getExtraBlockPriceCents(plan: PlanId | string | null | undefined): number {
  return getExtraProofOfWorkPackPriceCents(plan);
}

export function formatExtraProofOfWorkPackPrice(plan: PlanId | string | null | undefined): string {
  const cents = getExtraProofOfWorkPackPriceCents(plan);
  return `$${(cents / 100).toFixed(2)}`;
}

/** @deprecated Use formatExtraProofOfWorkPackPrice */
export function formatExtraBlockPrice(plan: PlanId | string | null | undefined): string {
  return formatExtraProofOfWorkPackPrice(plan);
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
  if (plan === "pro") return "$14.99/month";
  if (plan === "regular") return "$4.99/month";
  if (plan === "free") return "$0";
  const def = PLANS[plan as PlanId];
  return def ? `${def.price}/month` : String(plan);
}

export interface UserProfile {
  plan: PlanId;
  is_admin: boolean;
  /** Extra Proof-of-Work submissions above the plan base (profiles.extra_lessons column). */
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

const PAID_PRODUCT_PLANS = new Set<PlanId>([
  "trial",
  "regular_2026",
  "pro_teams",
  "api_metered",
  "regular",
  "pro",
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

/** True when the user may use the product (paid plan, org member, token tier, or admin). */
export function hasProductAccess(profile: ProductAccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  if (profile.organization_id) return true;

  const isTokenValid =
    profile.token_tier &&
    (profile.token_validity_expires_at === null ||
      new Date(profile.token_validity_expires_at) > new Date());
  if (isTokenValid) return true;

  if (
    !isBillingPeriodActive({
      subscription_status: profile.subscription_status,
      current_period_end: profile.current_period_end ?? null,
    })
  ) {
    return false;
  }

  return PAID_PRODUCT_PLANS.has(profile.plan);
}

export interface OrgUsageSummary {
  id: string;
  name: string;
  isOrgAdmin: boolean;
  memberCount: number;
  guestCount: number;
  used: number;
  limit: number | null;
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

  const planDef = PLANS[plan] || PLANS.free;

  if (plan === "trial" && isBillingPeriodActive({ subscription_status, current_period_end })) {
    return null;
  }

  if (subscription_status === "active" && plan !== "free") {
    return null;
  }

  if (plan === "pro") return null;

  const base = planDef.workspacesPerPeriod;
  if (base === null) return null;
  return base;
}

/**
 * Resolve the effective Proof-of-Work submission allowance for a profile.
 */
export function getProofOfWorkAllowance(profile: UserProfile): Pick<UsageCheckResult, "plan" | "limit" | "isAdmin"> {
  const { plan, is_admin, extra_lessons, subscription_status, current_period_end, token_tier, token_validity_expires_at } = profile;

  if (is_admin) {
    return { plan, limit: null, isAdmin: true };
  }

  const planDef = PLANS[plan] || PLANS.free;

  const isTokenValid = token_tier && (
    token_validity_expires_at === null || new Date(token_validity_expires_at) > new Date()
  );

  if (isTokenValid) {
    if (token_tier === "pro") {
      return { plan: "pro", limit: null, isAdmin: false };
    }
    if (token_tier === "regular") {
      return { plan: "regular", limit: 25, isAdmin: false };
    }
  }

  if (plan === "pro" && subscription_status === "active") {
    return { plan, limit: null, isAdmin: false };
  }

  if (plan === "api_metered" && subscription_status === "active") {
    return { plan, limit: null, isAdmin: false };
  }

  if (plan === "trial" && isBillingPeriodActive({ subscription_status, current_period_end })) {
    return { plan, limit: null, isAdmin: false };
  }

  if ((plan === "regular" || plan === "regular_2026" || plan === "pro_teams") && subscription_status === "active") {
    const effectiveLimit = (planDef.proofOfWorkPerPeriod ?? 0) + extra_lessons;
    return { plan, limit: effectiveLimit, isAdmin: false };
  }

  const freeBaseLimit = planDef.proofOfWorkPerPeriod ?? 1;
  return { plan: "free", limit: freeBaseLimit + extra_lessons, isAdmin: false };
}

/** @deprecated Use getProofOfWorkAllowance */
export function getSessionAllowance(
  profile: UserProfile,
  _sessionCount: number
): Pick<UsageCheckResult, "plan" | "limit" | "isAdmin"> {
  return getProofOfWorkAllowance(profile);
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

  if (proofOfWorkCount >= limit) {
    return {
      allowed: false,
      reason: `You've used all ${limit} Proof-of-Work submissions this month. Buy additional submissions or upgrade to continue.`,
      plan,
      used: proofOfWorkCount,
      limit,
      isAdmin: false,
    };
  }

  return { allowed: true, plan, used: proofOfWorkCount, limit, isAdmin: false };
}

/**
 * Check whether a user can use the product (start TAP/ILE, upload proof of work, etc.).
 * @deprecated Prefer canSubmitProofOfWork — kept for API compatibility.
 */
export function canStartSession(
  profile: UserProfile,
  proofOfWorkCount: number
): UsageCheckResult {
  const result = canSubmitProofOfWork(profile, proofOfWorkCount);
  return {
    allowed: result.allowed,
    reason: result.reason,
    plan: result.plan,
    used: result.used,
    limit: result.limit,
    isAdmin: result.isAdmin,
  };
}

/** @deprecated PoW limits are no longer derived from session allowance. */
export function proofOfWorkLimitForSessionAllowance(
  _plan: PlanId | string,
  sessionAllowance: number | null
): number | null {
  return sessionAllowance;
}

/**
 * Check whether a user can create another Workspace.
 * `workspaceCount` = active (non-archived) workspaces owned by the user.
 */
export function canCreateWorkspace(
  profile: UserProfile,
  workspaceCount: number
): WorkspaceCheckResult {
  const { plan, is_admin } = profile;

  if (is_admin) {
    return { allowed: true, plan, used: workspaceCount, limit: null, isAdmin: true };
  }

  const limit = getWorkspaceLimit(profile);
  if (limit === null) {
    return { allowed: true, plan, used: workspaceCount, limit: null, isAdmin: false };
  }

  if (workspaceCount >= limit) {
    return {
      allowed: false,
      reason:
        plan === "free"
          ? "You've reached your free workspace limit. Upgrade or archive a workspace to create another."
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