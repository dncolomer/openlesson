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
  normalizePlanId,
  normalizeStripeVolumeToProofOfWork,
  POW_API_CALL_PRICE_CENTS,
  resolveCheckoutVolume,
  REGULAR_VOLUME_PRICES,
  TEAM_VOLUME_PRICES,
} from "@/lib/plans";

describe("plans pricing", () => {
  it("normalizes legacy session volumes to proof-of-work counts", () => {
    expect(normalizeStripeVolumeToProofOfWork(25)).toBe(100);
    expect(normalizeStripeVolumeToProofOfWork(250)).toBe(1000);
    expect(normalizeStripeVolumeToProofOfWork(100)).toBe(400);
    expect(normalizeStripeVolumeToProofOfWork(100, "proof_of_work")).toBe(100);
    expect(normalizeStripeVolumeToProofOfWork(250, "proof_of_work")).toBe(250);
    expect(normalizeStripeVolumeToProofOfWork(200)).toBe(200);
  });

  it("resolves checkout volumes", () => {
    expect(resolveCheckoutVolume("regular_2026", 250)).toBe(250);
    expect(resolveCheckoutVolume("regular_2026", 999)).toBe(100);
    expect(resolveCheckoutVolume("regular_2026", 100)).toBe(100);
    expect(resolveCheckoutVolume("pro_teams", 2500)).toBe(2500);
    expect(resolveCheckoutVolume("pro_teams", 1)).toBe(1000);
  });

  it("formats 2026 monthly prices", () => {
    expect(formatPlanMonthlyPrice("regular_2026")).toBe("$49/month");
    expect(formatPlanMonthlyPrice("regular_2026", 500)).toBe("$149/month");
    expect(formatPlanMonthlyPrice("pro_teams")).toBe("$599/month");
    expect(formatPlanMonthlyPrice("pro_teams", 5000)).toBe("$1499/month");
  });

  it("keeps stripe volume tables aligned with monotonic volume discounts", () => {
    expect(REGULAR_VOLUME_PRICES[100]).toBe(4900);
    expect(REGULAR_VOLUME_PRICES[250]).toBe(9900);
    expect(REGULAR_VOLUME_PRICES[500]).toBe(14900);
    expect(TEAM_VOLUME_PRICES[1000]).toBe(59900);
    expect(TEAM_VOLUME_PRICES[2500]).toBe(99900);
    expect(TEAM_VOLUME_PRICES[5000]).toBe(149900);
    expect(TEAM_VOLUME_PRICES[10000]).toBe(249900);

    const individualPerSub = [100, 250, 500].map((vol) => REGULAR_VOLUME_PRICES[vol] / vol);
    expect(individualPerSub[1]).toBeLessThan(individualPerSub[0]);
    expect(individualPerSub[2]).toBeLessThan(individualPerSub[1]);

    const teamPerSub = [1000, 2500, 5000, 10000].map((vol) => TEAM_VOLUME_PRICES[vol] / vol);
    expect(teamPerSub[1]).toBeLessThan(teamPerSub[0]);
    expect(teamPerSub[2]).toBeLessThan(teamPerSub[1]);
    expect(teamPerSub[3]).toBeLessThan(teamPerSub[2]);
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

  it("gives paid plans unlimited workspaces", () => {
    expect(getWorkspaceLimit({ ...baseProfile, plan: "regular_2026" })).toBeNull();
    expect(getWorkspaceLimit({ ...baseProfile, plan: "pro_teams" })).toBeNull();
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

describe("plans usage", () => {
  it("allows active regular_2026 within proof-of-work limit", () => {
    const result = canSubmitProofOfWork(
      {
        plan: "regular_2026",
        is_admin: false,
        extra_lessons: 0,
        subscription_status: "active",
        current_period_end: "2026-12-31",
        token_tier: null,
        token_validity_expires_at: null,
      },
      50
    );
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(100);
  });

  it("gates product usage when proof-of-work allowance is exhausted", () => {
    const result = canSubmitProofOfWork(
      {
        plan: "regular_2026",
        is_admin: false,
        extra_lessons: 0,
        subscription_status: "active",
        current_period_end: "2026-12-31",
        token_tier: null,
        token_validity_expires_at: null,
      },
      100
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(100);
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

  it("resolves proof-of-work allowance from plan base plus extras", () => {
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "inactive", subscription_status: "inactive" }).limit).toBe(0);
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "regular_2026" }).limit).toBe(100);
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "api_metered" }).limit).toBeNull();
  });

  it("blocks proof-of-work submissions at monthly cap", () => {
    const result = canSubmitProofOfWork(
      { ...baseProfile, plan: "regular_2026" },
      100
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(100);
  });

  it("normalizes legacy plan ids to inactive", () => {
    expect(normalizePlanId("free")).toBe("inactive");
    expect(normalizePlanId("regular")).toBe("inactive");
    expect(normalizePlanId("pro")).toBe("inactive");
    expect(normalizePlanId("regular_2026")).toBe("regular_2026");
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
    expect(
      getProofOfWorkAllowance({
        plan: "trial",
        subscription_status: "active",
        current_period_end: "2099-01-01T00:00:00.000Z",
        is_admin: false,
        extra_lessons: 0,
        token_tier: null,
        token_validity_expires_at: null,
      }).limit
    ).toBeNull();
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

    expect(
      hasProductAccess({
        plan: "inactive",
        subscription_status: "trial_expired",
        current_period_end: "2000-01-01T00:00:00.000Z",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(false);
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
    // Personal plan without org is not product truth
    expect(
      hasProductAccess({
        plan: "regular_2026",
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
          plan: "pro_teams",
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
    // Membership alone is not enough
    expect(
      hasProductAccess({
        plan: "inactive",
        subscription_status: "inactive",
        is_admin: false,
        organization_id: "org-1",
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
          organization_id: "org-1",
          token_tier: null,
          token_validity_expires_at: null,
        },
        {
          id: "org-1",
          plan: "pro_teams",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
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
});

describe("agent api key plans", () => {
  it("recognizes pro_teams and api_metered", () => {
    expect(hasAgentApiKeyPlan("pro_teams")).toBe(true);
    expect(hasAgentApiKeyPlan("api_metered")).toBe(true);
    expect(hasAgentApiKeyPlan("regular_2026")).toBe(false);
    expect(hasAgentApiKeyPlan("inactive")).toBe(false);
  });

  it("grants proof-of-work API access on active api_metered", () => {
    expect(hasProofOfWorkApiAccess("api_metered", "active")).toBe(true);
    expect(hasProofOfWorkApiAccess("api_metered", "inactive")).toBe(false);
    expect(hasProofOfWorkApiAccess("pro_teams", "active")).toBe(true);
  });
});

describe("api metered pricing", () => {
  it("estimates monthly invoice from API call count", () => {
    const estimate = estimateApiMeteredInvoice(50);
    expect(estimate.platformCents).toBe(API_METERED_PLATFORM_FEE_CENTS);
    expect(estimate.usageCents).toBe(50 * POW_API_CALL_PRICE_CENTS);
    expect(estimate.totalCents).toBe(API_METERED_PLATFORM_FEE_CENTS + 50 * POW_API_CALL_PRICE_CENTS);
    expect(isApiMeteredPlan("api_metered")).toBe(true);
  });

  it("gives unlimited proof-of-work allowance for active api_metered", () => {
    expect(
      getProofOfWorkAllowance({
        plan: "api_metered",
        is_admin: false,
        extra_lessons: 0,
        subscription_status: "active",
        current_period_end: "2026-12-31",
        token_tier: null,
        token_validity_expires_at: null,
      }).limit
    ).toBeNull();
  });

  it("includes api_metered in product access via org", () => {
    expect(
      hasProductAccess(
        {
          plan: "inactive",
          subscription_status: "inactive",
          is_admin: false,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: "org-api",
        },
        {
          id: "org-api",
          plan: "api_metered",
          subscription_status: "active",
          current_period_end: "2099-01-01T00:00:00.000Z",
          billing_mode: "subscription",
        }
      )
    ).toBe(true);
  });

  it("formats api metered monthly price label", () => {
    expect(formatPlanMonthlyPrice("api_metered")).toContain("$99/month");
    expect(formatPlanMonthlyPrice("api_metered")).toContain("$1.99");
  });
});
