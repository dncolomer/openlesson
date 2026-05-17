// ============================================
// PLAN DEFINITIONS & USAGE LIMITS
// ============================================

export type PlanId = "free" | "regular" | "pro";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  priceAmount: number; // cents
  sessionsPerPeriod: number | null; // null = unlimited
  features: string[];
  stripePriceEnv: string | null; // env var name for Stripe Price ID
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    priceAmount: 0,
    sessionsPerPeriod: 10,
    features: [
      "10 tutoring sessions",
      "Real-time audio analysis",
      "Session report",
    ],
    stripePriceEnv: null,
  },
  regular: {
    id: "regular",
    name: "Regular",
    price: "$4.99",
    priceAmount: 499,
    sessionsPerPeriod: 5,
    features: [
      "5 sessions per month",
      "Buy extra sessions at $1.99",
      "Think-aloud data uploads",
      "Muse EEG integration",
      "Custom system prompts",
      "Session reports & history",
    ],
    stripePriceEnv: "STRIPE_PRICE_REGULAR",
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$14.99",
    priceAmount: 1499,
    sessionsPerPeriod: null,
    features: [
      "Unlimited sessions",
      "Think-aloud data uploads",
      "Custom system prompts",
      "Muse EEG integration",
      "Session reports & history",
      "Priority support",
      "Agentic Tutoring (API keys)",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
};

export const EXTRA_LESSON_PRICE = 199; // $1.99 in cents

export interface UserProfile {
  plan: PlanId;
  is_admin: boolean;
  extra_lessons: number;
  subscription_status: string;
  current_period_end: string | null;
  token_tier: string | null;
  token_validity_expires_at: string | null;
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  plan: PlanId;
  used: number;
  limit: number | null; // null = unlimited
  isAdmin: boolean;
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

  // Pro = unlimited
  if (plan === "pro" && subscription_status === "active") {
    return { allowed: true, plan, used: sessionCount, limit: null, isAdmin: false };
  }

  // Regular = 5 per period + extras
  if (plan === "regular" && subscription_status === "active") {
    const effectiveLimit = (planDef.sessionsPerPeriod ?? 0) + extra_lessons;
    if (sessionCount >= effectiveLimit) {
      return {
        allowed: false,
        reason: `You've used all ${effectiveLimit} sessions this month. Buy extra sessions or upgrade to Pro.`,
        plan,
        used: sessionCount,
        limit: effectiveLimit,
        isAdmin: false,
      };
    }
    return { allowed: true, plan, used: sessionCount, limit: effectiveLimit, isAdmin: false };
  }

  // Free plan = 1 session ever + any purchased extras
  const freeBaseLimit = planDef.sessionsPerPeriod ?? 1;
  const freeEffectiveLimit = freeBaseLimit + extra_lessons;
  if (sessionCount >= freeEffectiveLimit) {
    return {
      allowed: false,
      reason: "You've used your free session. Buy an extra session or upgrade to continue learning.",
      plan: "free",
      used: sessionCount,
      limit: freeEffectiveLimit,
      isAdmin: false,
    };
  }

  return { allowed: true, plan: "free", used: sessionCount, limit: freeEffectiveLimit, isAdmin: false };
}
