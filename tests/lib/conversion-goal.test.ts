import { describe, expect, it } from "vitest";
import {
  fallbackConversionGoal,
  finalizePerformanceReport,
  normalizeConversionGoal,
} from "@/lib/agent-v2/conversion-goal";
import { emptyPerformanceReport } from "@/lib/agent-v2/performance-report";

describe("normalizeConversionGoal", () => {
  it("trims and caps length", () => {
    expect(normalizeConversionGoal("  Trial activation  ")).toBe("Trial activation");
    expect(normalizeConversionGoal("")).toBeNull();
  });
});

describe("finalizePerformanceReport", () => {
  it("uses stored workspace goal when present", () => {
    const base = emptyPerformanceReport();
    const result = finalizePerformanceReport(base, "Paid plan activation", {
      title: "Demo",
    });
    expect(result.conversion_goal_source).toBe("workspace");
    expect(result.workspace_conversion_goal).toBe("Paid plan activation");
    expect(result.report.conversion_goal).toBe("Paid plan activation");
  });

  it("falls back to inferred goal when workspace goal is absent", () => {
    const base = { ...emptyPerformanceReport(), conversion_goal: "Model inferred goal" };
    const result = finalizePerformanceReport(base, null, { title: "Sales onboarding" });
    expect(result.conversion_goal_source).toBe("inferred");
    expect(result.workspace_conversion_goal).toBe("Model inferred goal");
  });

  it("uses fallback from workspace context when nothing is stored", () => {
    const base = { ...emptyPerformanceReport(), conversion_goal: "" };
    const result = finalizePerformanceReport(base, null, {
      description: "Close the quarter with certified reps",
    });
    expect(result.conversion_goal_source).toBe("inferred");
    expect(result.workspace_conversion_goal).toBe("Close the quarter with certified reps");
  });
});

describe("fallbackConversionGoal", () => {
  it("prefers description then title", () => {
    expect(
      fallbackConversionGoal({ description: "Launch approval", title: "Ignored" })
    ).toBe("Launch approval");
    expect(fallbackConversionGoal({ title: "Pipeline mastery" })).toBe(
      "Demonstrate readiness: Pipeline mastery"
    );
  });
});