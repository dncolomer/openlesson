// ============================================
// PLAN DEFINITIONS & USAGE LIMITS
// ============================================

export type PlanId = "free" | "regular" | "pro" | "regular_2026" | "pro_teams";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  priceAmount: number; // cents
  sessionsPerPeriod: number | null; // null = unlimited
  workspacesPerPeriod: number | null; // null = unlimited
  features: string[];
  stripePriceEnv: string | null; // env var name for Stripe Price ID
}

export interface VolumeTier {
  blocks: number;
  workspaces: number;
  priceCents: number;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    priceAmount: 0,
    sessionsPerPeriod: 5,
    workspacesPerPeriod: 1,
    features: [
      "5 starter blocks",
      "One Verification Workspace",
      "Basic GHL readiness report",
    ],
    stripePriceEnv: null,
  },
  regular: {
    id: "regular",
    name: "Regular",
    price: "$4.99",
    priceAmount: 499,
    sessionsPerPeriod: 5,
    workspacesPerPeriod: 1,
    features: [
      "5 blocks per month",
      "Buy extra blocks at $1.99",
      "Think-aloud data uploads",
      "Muse EEG integration",
      "Custom system prompts",
      "Block reports & history",
    ],
    stripePriceEnv: "STRIPE_PRICE_REGULAR",
  },
  regular_2026: {
    id: "regular_2026",
    name: "Regular",
    price: "$49",
    priceAmount: 4900,
    sessionsPerPeriod: 25,
    workspacesPerPeriod: 1,
    features: [
      "25+ blocks per month",
      "1+ Verification Workspaces",
      "Volume upgrades before checkout",
      "Additional blocks at $3.99 each",
      "Think-aloud data uploads",
      "Block reports & history",
    ],
    stripePriceEnv: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$14.99",
    priceAmount: 1499,
    sessionsPerPeriod: null,
    workspacesPerPeriod: null,
    features: [
      "Unlimited blocks",
      "Unlimited Verification Workspaces",
      "Think-aloud data uploads",
      "Custom system prompts",
      "Muse EEG integration",
      "Block reports & history",
      "Priority support",
      "Agentic Tutoring (API keys)",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  pro_teams: {
    id: "pro_teams",
    name: "Pro / Teams",
    price: "$399",
    priceAmount: 39900,
    sessionsPerPeriod: 250,
    workspacesPerPeriod: 5,
    features: [
      "250+ blocks per month",
      "5+ Verification Workspaces",
      "Volume upgrades before checkout",
      "Additional blocks at $1.99 each",
      "Team readiness workspaces",
      "Readiness evidence and history",
      "Priority support",
    ],
    stripePriceEnv: null,
  },
};

/** 2026 volume tiers (blocks + workspaces + price). Canonical source for Stripe checkout. */
export const REGULAR_VOLUME_TIERS: readonly VolumeTier[] = [
  { blocks: 25, workspaces: 1, priceCents: 4900 },
  { blocks: 50, workspaces: 3, priceCents: 7900 },
  { blocks: 100, workspaces: 5, priceCents: 12900 },
];

export const TEAM_VOLUME_TIERS: readonly VolumeTier[] = [
  { blocks: 250, workspaces: 5, priceCents: 39900 },
  { blocks: 500, workspaces: 10, priceCents: 64900 },
  { blocks: 1000, workspaces: 25, priceCents: 99900 },
  { blocks: 2500, workspaces: 50, priceCents: 199900 },
];

/** @deprecated Prefer REGULAR_VOLUME_TIERS */
export const REGULAR_VOLUME_PRICES: Record<number, number> = Object.fromEntries(
  REGULAR_VOLUME_TIERS.map((tier) => [tier.blocks, tier.priceCents])
);

/** @deprecated Prefer TEAM_VOLUME_TIERS */
export const TEAM_VOLUME_PRICES: Record<number, number> = Object.fromEntries(
  TEAM_VOLUME_TIERS.map((tier) => [tier.blocks, tier.priceCents])
);

export const REGULAR_VOLUME_WORKSPACES: Record<number, number> = Object.fromEntries(
  REGULAR_VOLUME_TIERS.map((tier) => [tier.blocks, tier.workspaces])
);

export const TEAM_VOLUME_WORKSPACES: Record<number, number> = Object.fromEntries(
  TEAM_VOLUME_TIERS.map((tier) => [tier.blocks, tier.workspaces])
);

export const DEFAULT_REGULAR_VOLUME = REGULAR_VOLUME_TIERS[0].blocks;
export const DEFAULT_TEAM_VOLUME = TEAM_VOLUME_TIERS[0].blocks;
export const DEFAULT_REGULAR_WORKSPACES = REGULAR_VOLUME_TIERS[0].workspaces;
export const DEFAULT_TEAM_WORKSPACES = TEAM_VOLUME_TIERS[0].workspaces;

export const BASE_INCLUDED_LESSONS: Record<string, number> = {
  regular_2026: 25,
  pro_teams: 250,
};

export const BASE_INCLUDED_WORKSPACES: Record<string, number> = {
  regular_2026: 1,
  pro_teams: 5,
};

/** Additional block purchase price (cents). */
export const EXTRA_BLOCK_PRICE_CENTS = 399;
export const PRO_TEAMS_EXTRA_BLOCK_PRICE_CENTS = 199;

/** @deprecated Use EXTRA_BLOCK_PRICE_CENTS */
export const EXTRA_LESSON_PRICE = EXTRA_BLOCK_PRICE_CENTS;
/** @deprecated Use PRO_TEAMS_EXTRA_BLOCK_PRICE_CENTS */
export const PRO_TEAMS_EXTRA_LESSON_PRICE = PRO_TEAMS_EXTRA_BLOCK_PRICE_CENTS;

function findVolumeTier(priceType: string, blocks: number): VolumeTier | null {
  const tiers = priceType === "pro_teams" ? TEAM_VOLUME_TIERS : priceType === "regular_2026" ? REGULAR_VOLUME_TIERS : [];
  return tiers.find((tier) => tier.blocks === blocks) ?? null;
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

export function resolveCheckoutWorkspaceVolume(priceType: string, blocksVolume: number): number {
  const tier = findVolumeTier(priceType, blocksVolume);
  if (priceType === "regular_2026") {
    return tier?.workspaces ?? DEFAULT_REGULAR_WORKSPACES;
  }
  if (priceType === "pro_teams") {
    return tier?.workspaces ?? DEFAULT_TEAM_WORKSPACES;
  }
  return 1;
}

export function getVolumeTier(priceType: string, blocksVolume: number): VolumeTier | null {
  return findVolumeTier(priceType, blocksVolume);
}

export function getExtraBlockPriceCents(plan: PlanId | string | null | undefined): number {
  return plan === "pro_teams" || plan === "pro"
    ? PRO_TEAMS_EXTRA_BLOCK_PRICE_CENTS
    : EXTRA_BLOCK_PRICE_CENTS;
}

export function formatExtraBlockPrice(plan: PlanId | string | null | undefined): string {
  const cents = getExtraBlockPriceCents(plan);
  return `$${(cents / 100).toFixed(2)}`;
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
  if (plan === "pro") return "$14.99/month";
  if (plan === "regular") return "$4.99/month";
  if (plan === "free") return "$0";
  const def = PLANS[plan as PlanId];
  return def ? `${def.price}/month` : String(plan);
}

export interface UserProfile {
  plan: PlanId;
  is_admin: boolean;
  extra_lessons: number;
  extra_workspaces?: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  token_validity_expires_at: string | null;
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
  /** User's own blocks in the current period (org members on Teams). */
  personalUsed?: number;
  organization?: OrgUsageSummary | null;
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
  const { plan, is_admin, extra_workspaces = 0, subscription_status } = profile;

  if (is_admin) return null;

  const planDef = PLANS[plan] || PLANS.free;

  if (plan === "pro" && subscription_status === "active") {
    return null;
  }

  const base = planDef.workspacesPerPeriod;
  if (base === null) return null;
  return base + extra_workspaces;
}

/**
 * Check whether a user can start a new session.
 * `sessionCount` = number of sessions in the current billing period.
 */
export function canStartSession(
  profile: UserProfile,
  sessionCount: number
): UsageCheckResult {
  const { plan, is_admin, extra_lessons, subscription_status, token_tier, token_validity_expires_at } = profile;

  // Admins always pass
  if (is_admin) {
    return { allowed: true, plan, used: sessionCount, limit: null, isAdmin: true };
  }

  const planDef = PLANS[plan] || PLANS.free;

  // Check token tier validity (null expiry = permanent for stakers, otherwise 3-month window)
  const isTokenValid = token_tier && (
    token_validity_expires_at === null || new Date(token_validity_expires_at) > new Date()
  );
  
  // If token tier is valid and better than current plan, use token tier
  if (isTokenValid) {
    if (token_tier === "pro") {
      return { allowed: true, plan: "pro", used: sessionCount, limit: null, isAdmin: false };
    }
    if (token_tier === "regular") {
      const tokenLimit = 5;
      if (sessionCount >= tokenLimit) {
        return {
          allowed: false,
          reason: `Token tier expired or insufficient. Re-verify your wallet at /pricing to continue.`,
          plan: "regular",
          used: sessionCount,
          limit: tokenLimit,
          isAdmin: false,
        };
      }
      return { allowed: true, plan: "regular", used: sessionCount, limit: tokenLimit, isAdmin: false };
    }
  }

  // Legacy Pro = unlimited. Keep existing subscribers untouched.
  if (plan === "pro" && subscription_status === "active") {
    return { allowed: true, plan, used: sessionCount, limit: null, isAdmin: false };
  }

  // Legacy Regular = 5 per period + extras. Keep existing subscribers untouched.
  if (plan === "regular" && subscription_status === "active") {
    const effectiveLimit = (planDef.sessionsPerPeriod ?? 0) + extra_lessons;
    if (sessionCount >= effectiveLimit) {
      return {
        allowed: false,
        reason: `You've used all ${effectiveLimit} legacy Regular blocks this month. Buy additional blocks to continue.`,
        plan,
        used: sessionCount,
        limit: effectiveLimit,
        isAdmin: false,
      };
    }
    return { allowed: true, plan, used: sessionCount, limit: effectiveLimit, isAdmin: false };
  }

  // Current paid plans use finite monthly block allowances.
  if ((plan === "regular_2026" || plan === "pro_teams") && subscription_status === "active") {
    const effectiveLimit = (planDef.sessionsPerPeriod ?? 0) + extra_lessons;
    if (sessionCount >= effectiveLimit) {
      return {
        allowed: false,
        reason: `You've used all ${effectiveLimit} blocks this month. Buy additional blocks to continue.`,
        plan,
        used: sessionCount,
        limit: effectiveLimit,
        isAdmin: false,
      };
    }
    return { allowed: true, plan, used: sessionCount, limit: effectiveLimit, isAdmin: false };
  }

  // Free plan = starter blocks + any purchased extras.
  const freeBaseLimit = planDef.sessionsPerPeriod ?? 1;
  const freeEffectiveLimit = freeBaseLimit + extra_lessons;
  if (sessionCount >= freeEffectiveLimit) {
    return {
      allowed: false,
      reason: "You've used your free blocks. Buy additional blocks or upgrade to continue.",
      plan: "free",
      used: sessionCount,
      limit: freeEffectiveLimit,
      isAdmin: false,
    };
  }

  return { allowed: true, plan: "free", used: sessionCount, limit: freeEffectiveLimit, isAdmin: false };
}

/**
 * Check whether a user can create another Verification Workspace.
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
          : `You've reached your plan limit of ${limit} Verification Workspaces. Upgrade your volume tier at /pricing or archive a workspace.`,
      plan,
      used: workspaceCount,
      limit,
      isAdmin: false,
    };
  }

  return { allowed: true, plan, used: workspaceCount, limit, isAdmin: false };
}

/** Plans that may create legacy dashboard API keys (v1 /api/agent/keys). */
export function hasAgentApiKeyPlan(plan: PlanId | string | null | undefined): boolean {
  return plan === "pro" || plan === "pro_teams";
}

export function canCreateLegacyAgentApiKeys(
  plan: PlanId | string | null | undefined,
  subscriptionStatus: string | null | undefined,
  isAdmin?: boolean
): boolean {
  if (isAdmin) return true;
  if (!hasAgentApiKeyPlan(plan)) return false;
  return subscriptionStatus === "active";
}
