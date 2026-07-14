import { describe, expect, it } from "vitest";
import {
  canCreateWorkspace,
  canStartSession,
  canSubmitProofOfWork,
  formatExtraProofOfWorkPackPrice,
  formatPlanMonthlyPrice,
  getExtraProofOfWorkPackPriceCents,
  getProofOfWorkAllowance,
  getWorkspaceLimit,
  API_METERED_PLATFORM_FEE_CENTS,
  estimateApiMeteredInvoice,
  hasAgentApiKeyPlan,
  hasProductAccess,
  hasProofOfWorkApiAccess,
  isApiMeteredPlan,
  isBillingPeriodActive,
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

  it("formats extra proof-of-work pack prices", () => {
    expect(getExtraProofOfWorkPackPriceCents("regular_2026")).toBe(399);
    expect(getExtraProofOfWorkPackPriceCents("pro_teams")).toBe(199);
    expect(formatExtraProofOfWorkPackPrice("pro_teams")).toBe("$1.99");
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

  it("blocks free workspace creation at limit", () => {
    const result = canCreateWorkspace(
      { ...baseProfile, plan: "free", subscription_status: "inactive" },
      1
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(1);
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

  it("gates TAP/ILE starts through proof-of-work allowance", () => {
    const result = canStartSession(
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
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "free" }).limit).toBe(25);
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "regular_2026" }).limit).toBe(100);
    expect(getProofOfWorkAllowance({ ...baseProfile, plan: "pro" }).limit).toBeNull();
  });

  it("blocks proof-of-work submissions at monthly cap", () => {
    const result = canSubmitProofOfWork(
      { ...baseProfile, plan: "regular_2026" },
      100
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(100);
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
      hasProductAccess({
        plan: "trial",
        subscription_status: "active",
        current_period_end: "2000-01-01T00:00:00.000Z",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(false);
  });

  it("grants trial access during the active window", () => {
    expect(
      hasProductAccess({
        plan: "trial",
        subscription_status: "active",
        current_period_end: "2099-01-01T00:00:00.000Z",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
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
});

describe("product access", () => {
  it("requires an active paid plan for new users", () => {
    expect(
      hasProductAccess({
        plan: "free",
        subscription_status: "inactive",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(false);
    expect(
      hasProductAccess({
        plan: "regular_2026",
        subscription_status: "active",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(true);
    expect(
      hasProductAccess({
        plan: "pro_teams",
        subscription_status: "active",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(true);
  });

  it("allows admins, org members, and valid token tiers", () => {
    expect(
      hasProductAccess({
        plan: "free",
        subscription_status: "inactive",
        is_admin: true,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(true);
    expect(
      hasProductAccess({
        plan: "free",
        subscription_status: "inactive",
        is_admin: false,
        organization_id: "org-1",
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(true);
    expect(
      hasProductAccess({
        plan: "free",
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
    expect(hasAgentApiKeyPlan("pro")).toBe(false);
    expect(hasAgentApiKeyPlan("pro_teams")).toBe(true);
    expect(hasAgentApiKeyPlan("api_metered")).toBe(true);
    expect(hasAgentApiKeyPlan("regular_2026")).toBe(false);
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

  it("includes api_metered in product access", () => {
    expect(
      hasProductAccess({
        plan: "api_metered",
        subscription_status: "active",
        is_admin: false,
        token_tier: null,
        token_validity_expires_at: null,
      })
    ).toBe(true);
  });

  it("formats api metered monthly price label", () => {
    expect(formatPlanMonthlyPrice("api_metered")).toContain("$99/month");
    expect(formatPlanMonthlyPrice("api_metered")).toContain("$1.99");
  });
});