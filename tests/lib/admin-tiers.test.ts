import { describe, expect, it } from "vitest";
import {
  adminTierSelectValue,
  isGrandfatheredPlan,
  planFilterBucket,
  tierChangeWarning,
  tierLabel,
} from "@/lib/admin/tiers";

describe("admin tiers", () => {
  it("preserves legacy subscribers in filter bucket", () => {
    expect(planFilterBucket({ plan: "pro", subscription_status: "active" })).toBe("legacy");
    expect(planFilterBucket({ plan: "regular", subscription_status: "active" })).toBe("legacy");
  });

  it("locks grandfathered plans out of editable tier select", () => {
    expect(isGrandfatheredPlan({ plan: "pro", subscription_status: "active" })).toBe(true);
    expect(adminTierSelectValue({ plan: "pro", subscription_status: "active" })).toBeNull();
    expect(adminTierSelectValue({ plan: "regular_2026", subscription_status: "active" })).toBe(
      "regular_2026"
    );
  });

  it("labels legacy plans distinctly", () => {
    expect(tierLabel("pro")).toContain("legacy");
    expect(tierLabel("regular")).toContain("legacy");
  });

  it("warns before migrating grandfathered users", () => {
    const warning = tierChangeWarning(
      { plan: "pro", subscription_status: "active", extra_lessons: 10 },
      "regular_2026"
    );
    expect(warning).toContain("grandfathered");
  });
});