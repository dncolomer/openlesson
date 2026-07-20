import { describe, expect, it } from "vitest";
import {
  fallbackWorkspaceGoal,
  finalizeVerticalScoreReport,
  normalizeWorkspaceGoal,
} from "@/lib/pow-api/workspace-goal";
import { emptyVerticalScoreReport } from "@/lib/pow-api/performance-report";

describe("normalizeWorkspaceGoal", () => {
  it("trims and caps length", () => {
    expect(normalizeWorkspaceGoal("  Trial activation  ")).toBe("Trial activation");
    expect(normalizeWorkspaceGoal("")).toBeNull();
  });
});

describe("finalizeVerticalScoreReport", () => {
  it("uses stored workspace goal when present", () => {
    const base = emptyVerticalScoreReport("verification");
    const result = finalizeVerticalScoreReport(base, "Paid plan activation", {
      title: "Demo",
    });
    expect(result.workspace_goal_source).toBe("workspace");
    expect(result.workspace_goal).toBe("Paid plan activation");
    expect(result.report.workspace_goal).toBe("Paid plan activation");
    expect(result.report).not.toHaveProperty("conversion_goal");
  });

  it("falls back to inferred goal when workspace goal is absent", () => {
    const base = {
      ...emptyVerticalScoreReport("optimization"),
      workspace_goal: "Model inferred goal",
    };
    const result = finalizeVerticalScoreReport(base, null, { title: "Sales onboarding" });
    expect(result.workspace_goal_source).toBe("inferred");
    expect(result.workspace_goal).toBe("Model inferred goal");
  });

  it("uses fallback from workspace context when nothing is stored", () => {
    const base = { ...emptyVerticalScoreReport("augmentation"), workspace_goal: "" };
    const result = finalizeVerticalScoreReport(base, null, {
      description: "Close the quarter with certified reps",
    });
    expect(result.workspace_goal_source).toBe("inferred");
    expect(result.workspace_goal).toBe("Close the quarter with certified reps");
  });
});

describe("fallbackWorkspaceGoal", () => {
  it("prefers description then title", () => {
    expect(fallbackWorkspaceGoal({ description: "Launch approval", title: "Ignored" })).toBe(
      "Launch approval"
    );
    expect(fallbackWorkspaceGoal({ title: "Pipeline mastery" })).toBe(
      "Demonstrate readiness: Pipeline mastery"
    );
  });
});
