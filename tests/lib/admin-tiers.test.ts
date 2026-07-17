import { describe, expect, it } from "vitest";
import {
  adminTierSelectValue,
  buildTierUpdate,
  planFilterBucket,
  tierChangeWarning,
  tierLabel,
} from "@/lib/admin/tiers";

describe("admin tiers", () => {
  it("buckets inactive and trial_expired distinctly", () => {
    expect(planFilterBucket({ plan: "inactive", subscription_status: "inactive" })).toBe("inactive");
    expect(planFilterBucket({ plan: "inactive", subscription_status: "trial_expired" })).toBe(
      "trial_expired"
    );
    expect(planFilterBucket({ plan: "regular_2026", subscription_status: "active" })).toBe(
      "regular_2026"
    );
  });

  it("maps non-active users to inactive tier select", () => {
    expect(adminTierSelectValue({ plan: "pro", subscription_status: "active" })).toBe("inactive");
    expect(adminTierSelectValue({ plan: "inactive", subscription_status: "inactive" })).toBe(
      "inactive"
    );
    expect(
      adminTierSelectValue({ plan: "regular_2026", subscription_status: "active" })
    ).toBe("regular_2026");
  });

  it("labels inactive and current product plans", () => {
    expect(tierLabel("inactive")).toBe("Inactive");
    expect(tierLabel("free")).toBe("Inactive");
    expect(tierLabel("regular_2026")).toBe("Individual");
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
      { plan: "regular_2026", subscription_status: "active", extra_lessons: 10 },
      "inactive"
    );
    expect(warning).toContain("Inactive");
    expect(warning).toContain("10");
  });
});
