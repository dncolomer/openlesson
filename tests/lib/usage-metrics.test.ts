import { describe, expect, it } from "vitest";
import { billingPeriodStart } from "@/lib/usage-metrics";

describe("usage-metrics", () => {
  it("derives billing period start as ~30 days before period end", () => {
    const start = billingPeriodStart("2026-04-01T00:00:00.000Z");
    expect(start?.toISOString().slice(0, 10)).toBe("2026-03-02");
  });

  it("returns null when period end is missing", () => {
    expect(billingPeriodStart(null)).toBeNull();
  });
});