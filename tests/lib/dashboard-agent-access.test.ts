import { describe, expect, it } from "vitest";
import { dashboardUsesAgenticKeys } from "@/lib/dashboard-agent-access";

describe("dashboardUsesAgenticKeys", () => {
  it("uses org-resolved pro_teams from usage even when user.plan is demoted inactive", () => {
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "pro_teams",
        canUseAgentApi: true,
        userPlan: "inactive",
        userIsAdmin: false,
      })
    ).toBe(true);
  });

  it("uses usagePlan alone when canUseAgentApi omitted", () => {
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "api_metered",
        userPlan: "inactive",
      })
    ).toBe(true);
  });

  it("does not enable keys for demoted personal plan only", () => {
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "inactive",
        canUseAgentApi: false,
        userPlan: "inactive",
      })
    ).toBe(false);
  });

  it("does not treat stale user.plan=pro_teams as enough without usage when usage says inactive", () => {
    // When usage loaded as inactive org, prefer usagePlan over stale userPlan
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "inactive",
        canUseAgentApi: false,
        userPlan: "pro_teams",
      })
    ).toBe(false);
  });

  it("allows admins", () => {
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "inactive",
        userIsAdmin: true,
      })
    ).toBe(true);
  });
});
