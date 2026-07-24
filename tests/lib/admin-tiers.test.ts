import { describe, expect, it } from "vitest";
import {
  ADMIN_TIER_OPTIONS,
  adminTierSelectValue,
  buildTierUpdate,
  planFilterBucket,
  tierChangeWarning,
  tierLabel,
} from "@/lib/admin/tiers";

describe("admin tiers", () => {
  it("only offers inactive, trial, and api_metered", () => {
    expect(ADMIN_TIER_OPTIONS.map((t) => t.id)).toEqual(["inactive", "trial", "api_metered"]);
  });

  it("buckets inactive and trial_expired distinctly", () => {
    expect(planFilterBucket({ plan: "inactive", subscription_status: "inactive" })).toBe("inactive");
    expect(planFilterBucket({ plan: "inactive", subscription_status: "trial_expired" })).toBe(
      "trial_expired"
    );
    expect(planFilterBucket({ plan: "api_metered", subscription_status: "active" })).toBe(
      "api_metered"
    );
    // Removed tiers are not admin options → inactive bucket
    expect(planFilterBucket({ plan: "regular_2026", subscription_status: "active" })).toBe(
      "inactive"
    );
  });

  it("maps non-active users to inactive tier select", () => {
    expect(adminTierSelectValue({ plan: "pro", subscription_status: "active" })).toBe("inactive");
    expect(adminTierSelectValue({ plan: "inactive", subscription_status: "inactive" })).toBe(
      "inactive"
    );
    expect(
      adminTierSelectValue({ plan: "api_metered", subscription_status: "active" })
    ).toBe("api_metered");
  });

  it("labels current product plans", () => {
    expect(tierLabel("inactive")).toBe("Inactive");
    expect(tierLabel("free")).toBe("Inactive");
    expect(tierLabel("api_metered")).toBe("API Metered");
    expect(tierLabel("trial")).toBe("3-Day Trial");
  });

  it("builds inactive tier update without period end", () => {
    const patch = buildTierUpdate("inactive");
    expect(patch.plan).toBe("inactive");
    expect(patch.subscription_status).toBe("inactive");
    expect(patch.current_period_end).toBeNull();
    expect(patch.extra_lessons).toBe(0);
  });

  it("warns when demoting with volume overage", () => {
    const warning = tierChangeWarning(
      { plan: "api_metered", subscription_status: "active", extra_lessons: 10 },
      "inactive"
    );
    expect(warning).toContain("Inactive");
    expect(warning).toContain("10");
  });
});
