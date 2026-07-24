import { describe, expect, it } from "vitest";
import {
  canCreateWorkspace,
  canSubmitProofOfWork,
  demoteExpiredTrialProfile,
  formatPlanMonthlyPrice,
  getProofOfWorkAllowance,
  getWorkspaceLimit,
  API_METERED_PLATFORM_FEE_CENTS,
  estimateApiMeteredInvoice,
  hasAgentApiKeyPlan,
  hasProductAccess,
  hasProofOfWorkApiAccess,
  isApiMeteredPlan,
  isBillingPeriodActive,
  isExternalApiPowUsage,
  migratePlanIdToCurrent,
  normalizePlanId,
  POW_API_CALL_PRICE_CENTS,
  TAP_SESSION_PRICE_CENTS,
  ILE_SESSION_PRICE_CENTS,
  PLANS,
  type PlanId,
} from "@/lib/plans";

describe("plans pricing model", () => {
  it("only exposes inactive, trial, and api_metered plan ids", () => {
    const ids = Object.keys(PLANS).sort();
    expect(ids).toEqual(["api_metered", "inactive", "trial"]);
    const invalid = "regular_2026" as PlanId;
    expect(PLANS[invalid]).toBeUndefined();
  });

  it("sets Metered rates: 0.05 cents/PoW, $1 TAP, $10 ILE, $99 platform", () => {
    expect(POW_API_CALL_PRICE_CENTS).toBe(0.05);
    expect(TAP_SESSION_PRICE_CENTS).toBe(100);
    expect(ILE_SESSION_PRICE_CENTS).toBe(1000);
    expect(API_METERED_PLATFORM_FEE_CENTS).toBe(9900);
  });

  it("formats api metered monthly price with usage rates", () => {
    const label = formatPlanMonthlyPrice("api_metered");
    expect(label).toContain("$99/month");
    expect(label).toMatch(/0\.05/);
    expect(label).toContain("$1/TAP");
    expect(label).toContain("$10/ILE");
  });

  it("normalizes removed tier names to inactive (no backwards-compat plan ids)", () => {
    expect(normalizePlanId("free")).toBe("inactive");
    expect(normalizePlanId("regular")).toBe("inactive");
    expect(normalizePlanId("pro")).toBe("inactive");
    expect(normalizePlanId("regular_2026")).toBe("inactive");
    expect(normalizePlanId("pro_teams")).toBe("inactive");
    expect(normalizePlanId("trial")).toBe("trial");
    expect(normalizePlanId("api_metered")).toBe("api_metered");
  });

  it("migratePlanIdToCurrent rewrites removed paid tiers to api_metered", () => {
    expect(migratePlanIdToCurrent("regular_2026")).toBe("api_metered");
    expect(migratePlanIdToCurrent("pro_teams")).toBe("api_metered");
    expect(migratePlanIdToCurrent("regular")).toBe("api_metered");
    expect(migratePlanIdToCurrent("pro")).toBe("api_metered");
    expect(migratePlanIdToCurrent("trial")).toBe("trial");
    expect(migratePlanIdToCurrent("inactive")).toBe("inactive");
    expect(migratePlanIdToCurrent("api_metered")).toBe("api_metered");
  });
});

describe("plans workspace limits", () => {
  const baseProfile = {
    is_admin: false,
    extra_lessons: 0,
    extra_workspaces: 0,
    subscription_status: "active",
    current_period_end: "2026-12-31",
    token_tier: null,
    token_validity_expires_at: null,
  };

  it("gives api_metered unlimited workspaces", () => {
    expect(getWorkspaceLimit({ ...baseProfile, plan: "api_metered" })).toBeNull();
    expect(getWorkspaceLimit({ ...baseProfile, plan: "trial" })).toBeNull();
  });

  it("blocks inactive workspace creation", () => {
    const result = canCreateWorkspace(
      { ...baseProfile, plan: "inactive", subscription_status: "inactive" },
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
  });
});

describe("plans proof-of-work limits", () => {
  const baseProfile = {
    is_admin: false,
    extra_lessons: 0,
    extra_workspaces: 0,
    subscription_status: "active",
    current_period_end: "2026-12-31",
    token_tier: null,
    token_validity_expires_at: null,
  };

  it("gives unlimited proof-of-work for active api_metered and trial", () => {
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "api_metered" }).limit).toBeNull();
    expect(
      getProofOfWorkAllowance({
        ...baseProfile,
        plan: "trial",
        current_period_end: "2099-01-01T00:00:00.000Z",
      }).limit
    ).toBeNull();
    expect(
      getProofOfWorkAllowance({ ...baseProfile, plan: "inactive", subscription_status: "inactive" })
        .limit
    ).toBe(0);
  });

  it("blocks inactive proof-of-work submissions", () => {
    const result = canSubmitProofOfWork(
      { ...baseProfile, plan: "inactive", subscription_status: "inactive" },
      0
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
  });

  it("allows api_metered PoW without a hard monthly cap", () => {
    const result = canSubmitProofOfWork({ ...baseProfile, plan: "api_metered" }, 10_000);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });

  it("enforces token_tier regular finite pool", () => {
    const result = canSubmitProofOfWork(
      {
        ...baseProfile,
        plan: "inactive",
        subscription_status: "inactive",
        token_tier: "regular",
        token_validity_expires_at: "2099-01-01T00:00:00.000Z",
      },
      25
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(25);
  });
});

describe("billing period", () => {
  it("expires access when current_period_end is in the past", () => {
    expect(
      isBillingPeriodActive({
        subscription_status: "active",
        current_period_end: "2000-01-01T00:00:00.000Z",
      })
    ).toBe(false);
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          current_period_end: null,
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "trial",
          subscription_status: "active",
          current_period_end: "2000-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(false);
  });

  it("grants trial access during the active window via org", () => {
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          current_period_end: null,
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "trial",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(true);
  });

  it("demotes expired trials to inactive + trial_expired", () => {
    expect(
      demoteExpiredTrialProfile({
        plan: "trial",
        subscription_status: "active",
        current_period_end: "2000-01-01T00:00:00.000Z",
      })
    ).toEqual({ plan: "inactive", subscription_status: "trial_expired" });

    expect(
      demoteExpiredTrialProfile({
        plan: "trial",
        subscription_status: "active",
        current_period_end: "2099-01-01T00:00:00.000Z",
      })
    ).toBeNull();
  });
});

describe("product access", () => {
  it("requires an entitled organization (personal plan alone is not enough)", () => {
    expect(
      hasProductAccess({
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(false);
    expect(
      hasProductAccess({
        plan: "api_metered",
        subscription_status: "active",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(false);
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "api_metered",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(true);
  });

  it("allows admins, entitled org members, and valid token tiers", () => {
    expect(
      hasProductAccess({
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: true,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(true);
    expect(
      hasProductAccess({
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: false,
        token_tier: "pro",
        token_validity_expires_at: "2099-01-01T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("does not treat removed tier ids as product access", () => {
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "pro_teams",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(false);
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-1",
        },
        {
          id: "org-1",
          plan: "regular_2026",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(false);
  });
});

describe("agent api key plans", () => {
  it("grants API access only for active api_metered", () => {
    expect(hasAgentApiKeyPlan("api_metered")).toBe(true);
    expect(hasAgentApiKeyPlan("pro_teams")).toBe(false);
    expect(hasAgentApiKeyPlan("regular_2026")).toBe(false);
    expect(hasAgentApiKeyPlan("inactive")).toBe(false);
    expect(hasAgentApiKeyPlan("trial")).toBe(false);

    expect(hasProofOfWorkApiAccess("api_metered", "active")).toBe(true);
    expect(hasProofOfWorkApiAccess("api_metered", "inactive")).toBe(false);
    expect(hasProofOfWorkApiAccess("pro_teams", "active")).toBe(false);
  });
});

describe("api metered invoice estimate", () => {
  it("bills external PoW at 0.05 cents and sessions at $1/$10", () => {
    const estimate = estimateApiMeteredInvoice(50, 3, 2);
    expect(estimate.platformCents).toBe(API_METERED_PLATFORM_FEE_CENTS);
    expect(estimate.externalPowCents).toBe(50 * POW_API_CALL_PRICE_CENTS);
    expect(estimate.externalPowCents).toBe(2.5);
    expect(estimate.tapSessionCents).toBe(3 * TAP_SESSION_PRICE_CENTS);
    expect(estimate.ileSessionCents).toBe(2 * ILE_SESSION_PRICE_CENTS);
    expect(estimate.usageCents).toBe(2.5 + 300 + 2000);
    expect(estimate.usageCentsRounded).toBe(Math.round(2.5 + 300 + 2000));
    expect(estimate.totalCents).toBe(
      API_METERED_PLATFORM_FEE_CENTS + estimate.usageCentsRounded
    );
    expect(isApiMeteredPlan("api_metered")).toBe(true);
  });

  it("does not charge TAP/ILE-generated PoW as external API PoW", () => {
    // Internal product PoW (no API key) → not billed at PoW rate; sessions are separate.
    expect(isExternalApiPowUsage(null)).toBe(false);
    expect(isExternalApiPowUsage(undefined)).toBe(false);
    expect(isExternalApiPowUsage("")).toBe(false);
    expect(isExternalApiPowUsage("key-abc")).toBe(true);

    // Only external count feeds PoW line; session counts feed session lines.
    const estimate = estimateApiMeteredInvoice(0, 5, 1);
    expect(estimate.externalPowCents).toBe(0);
    expect(estimate.tapSessionCents).toBe(500);
    expect(estimate.ileSessionCents).toBe(1000);
  });

  it("rounds sub-cent PoW for Stripe whole-cent totals", () => {
    // 10 * 0.05 = 0.5 cents → rounds to 1 or 0 depending on half-up; Math.round(0.5)=1
    const half = estimateApiMeteredInvoice(10, 0, 0);
    expect(half.externalPowCents).toBe(0.5);
    expect(half.usageCentsRounded).toBe(1);

    // 1 * 0.05 = 0.05 → rounds to 0 whole cents
    const one = estimateApiMeteredInvoice(1, 0, 0);
    expect(one.externalPowCents).toBe(0.05);
    expect(one.usageCentsRounded).toBe(0);

    // 20 * 0.05 = 1.0 → exactly 1 cent
    const twenty = estimateApiMeteredInvoice(20, 0, 0);
    expect(twenty.externalPowCents).toBe(1);
    expect(twenty.usageCentsRounded).toBe(1);
  });
});
