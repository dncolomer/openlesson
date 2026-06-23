import { describe, expect, it } from "vitest";
import {
  canStartSession,
  formatExtraBlockPrice,
  formatPlanMonthlyPrice,
  getExtraBlockPriceCents,
  hasAgentApiKeyPlan,
  resolveCheckoutVolume,
  REGULAR_VOLUME_PRICES,
  TEAM_VOLUME_PRICES,
} from "@/lib/plans";

describe("plans pricing", () => {
  it("resolves checkout volumes", () => {
    expect(resolveCheckoutVolume("regular_2026", 50)).toBe(50);
    expect(resolveCheckoutVolume("regular_2026", 999)).toBe(25);
    expect(resolveCheckoutVolume("pro_teams", 500)).toBe(500);
    expect(resolveCheckoutVolume("pro_teams", 1)).toBe(250);
  });

  it("formats 2026 monthly prices", () => {
    expect(formatPlanMonthlyPrice("regular_2026")).toBe("$49/month");
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
    expect(REGULAR_VOLUME_PRICES[25]).toBe(4900);
    expect(TEAM_VOLUME_PRICES[250]).toBe(39900);
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

describe("agent api key plans", () => {
  it("recognizes pro and pro_teams", () => {
    expect(hasAgentApiKeyPlan("pro")).toBe(true);
    expect(hasAgentApiKeyPlan("pro_teams")).toBe(true);
    expect(hasAgentApiKeyPlan("regular_2026")).toBe(false);
  });
});