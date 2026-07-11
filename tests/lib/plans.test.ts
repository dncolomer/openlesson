import { describe, expect, it } from "vitest";
import {
  canCreateWorkspace,
  canStartSession,
  canSubmitProofOfWork,
  proofOfWorkLimitForSessionAllowance,
  formatExtraBlockPrice,
  formatPlanMonthlyPrice,
  getExtraBlockPriceCents,
  getWorkspaceLimit,
  hasAgentApiKeyPlan,
  hasProductAccess,
  resolveCheckoutVolume,
  resolveCheckoutWorkspaceVolume,
  REGULAR_VOLUME_PRICES,
  REGULAR_VOLUME_WORKSPACES,
  TEAM_VOLUME_PRICES,
  TEAM_VOLUME_WORKSPACES,
} from "@/lib/plans";

describe("plans pricing", () => {
  it("resolves checkout volumes", () => {
    expect(resolveCheckoutVolume("regular_2026", 50)).toBe(50);
    expect(resolveCheckoutVolume("regular_2026", 999)).toBe(25);
    expect(resolveCheckoutVolume("pro_teams", 500)).toBe(500);
    expect(resolveCheckoutVolume("pro_teams", 1)).toBe(250);
  });

  it("resolves checkout workspace volumes from block tier", () => {
    expect(resolveCheckoutWorkspaceVolume("regular_2026", 25)).toBe(1);
    expect(resolveCheckoutWorkspaceVolume("regular_2026", 50)).toBe(3);
    expect(resolveCheckoutWorkspaceVolume("pro_teams", 250)).toBe(5);
    expect(resolveCheckoutWorkspaceVolume("pro_teams", 1000)).toBe(25);
  });

  it("formats 2026 monthly prices", () => {
    expect(formatPlanMonthlyPrice("regular_2026")).toBe("$19.99/month");
    expect(formatPlanMonthlyPrice("regular_2026", 100)).toBe("$129/month");
    expect(formatPlanMonthlyPrice("pro_teams")).toBe("$399/month");
    expect(formatPlanMonthlyPrice("pro_teams", 1000)).toBe("$999/month");
  });

  it("formats extra block prices", () => {
    expect(getExtraBlockPriceCents("regular_2026")).toBe(399);
    expect(getExtraBlockPriceCents("pro_teams")).toBe(199);
    expect(formatExtraBlockPrice("pro_teams")).toBe("$1.99");
  });

  it("keeps stripe volume tables aligned", () => {
    expect(REGULAR_VOLUME_PRICES[25]).toBe(1999);
    expect(TEAM_VOLUME_PRICES[250]).toBe(39900);
    expect(REGULAR_VOLUME_WORKSPACES[100]).toBe(5);
    expect(TEAM_VOLUME_WORKSPACES[500]).toBe(10);
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

  it("computes workspace limits from plan base plus extras", () => {
    expect(
      getWorkspaceLimit({
        ...baseProfile,
        plan: "regular_2026",
        extra_workspaces: 2,
      })
    ).toBe(3);
    expect(
      getWorkspaceLimit({
        ...baseProfile,
        plan: "pro_teams",
        extra_workspaces: 20,
      })
    ).toBe(25);
  });

  it("blocks workspace creation at limit", () => {
    const result = canCreateWorkspace(
      { ...baseProfile, plan: "free", extra_workspaces: 0 },
      1
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(1);
  });
});

describe("plans usage", () => {
  it("allows active regular_2026 within limit", () => {
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
      10
    );
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(25);
  });
});

describe("plans evidence limits", () => {
  const baseProfile = {
    is_admin: false,
    extra_lessons: 0,
    extra_workspaces: 0,
    subscription_status: "active",
    current_period_end: "2026-12-31",
    token_tier: null,
    token_validity_expires_at: null,
  };

  it("derives evidence caps from session allowance", () => {
    expect(proofOfWorkLimitForSessionAllowance("free", 5)).toBe(25);
    expect(proofOfWorkLimitForSessionAllowance("regular_2026", 25)).toBe(100);
    expect(proofOfWorkLimitForSessionAllowance("pro", null)).toBeNull();
  });

  it("blocks evidence submissions at monthly cap", () => {
    const result = canSubmitProofOfWork(
      { ...baseProfile, plan: "regular_2026" },
      100,
      25
    );
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(100);
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
  it("recognizes pro and pro_teams", () => {
    expect(hasAgentApiKeyPlan("pro")).toBe(true);
    expect(hasAgentApiKeyPlan("pro_teams")).toBe(true);
    expect(hasAgentApiKeyPlan("regular_2026")).toBe(false);
  });
});