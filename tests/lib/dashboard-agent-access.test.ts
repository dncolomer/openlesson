import { describe, expect, it } from "vitest";
import { dashboardUsesAgenticKeys } from "@/lib/dashboard-agent-access";

describe("dashboardUsesAgenticKeys", () => {
  it("uses org-resolved api_metered from usage even when user.plan is demoted inactive", () => {
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "api_metered",
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

  it("does not treat stale removed plan names as enough without usage when usage says inactive", () => {
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "inactive",
        canUseAgentApi: false,
        userPlan: "pro_teams",
      })
    ).toBe(false);
    expect(
      dashboardUsesAgenticKeys({
        usagePlan: "pro_teams",
        userPlan: "inactive",
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
