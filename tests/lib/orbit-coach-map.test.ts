import { describe, expect, it } from "vitest";
import { buildOrbitAppSnapshot } from "@/lib/product-demos/orbit-app-context";
import { createSeedOrbitState } from "@/lib/product-demos/orbit-app-model";
import {
  matchCoachingHintToAction,
  resolveOrbitPrimaryCoachStep,
} from "@/lib/product-demos/orbit-coach-map";

describe("orbit coach map", () => {
  it("matches scorecard hints to actionable UI targets", () => {
    const seed = createSeedOrbitState();
    const critical = seed.issues.find((issue) => issue.identifier === "ORB-12")!;
    const snapshot = buildOrbitAppSnapshot({
      ...seed,
      issues: seed.issues.map((issue) => ({ ...issue, unread: false })),
      ui: {
        ...seed.ui,
        view: "inbox",
        selectedIssueId: critical.id,
        assigneeFilter: null,
      },
    });

    const target = matchCoachingHintToAction(
      ["Assign the regression issue to yourself before starting work."],
      snapshot
    );

    expect(target?.actionId).toBe("assign_to_self");
    expect(target?.coachKey).toBe("assign");
  });

  it("matches inbox triage coaching", () => {
    const seed = createSeedOrbitState();
    const snapshot = buildOrbitAppSnapshot({
      ...seed,
      ui: { ...seed.ui, view: "inbox", assigneeFilter: null },
    });
    const target = matchCoachingHintToAction(
      ["Complete inbox triage for unread issues."],
      snapshot
    );
    expect(target?.actionId).toBe("triage_issue");
  });

  it("resolveOrbitPrimaryCoachStep falls back to snapshot when hints are empty", () => {
    const snapshot = buildOrbitAppSnapshot(createSeedOrbitState());
    const target = resolveOrbitPrimaryCoachStep([], snapshot);
    expect(target?.actionId).toBe("open_inbox");
    expect(target?.source).toBe("snapshot");
    expect(target?.instruction.toLowerCase()).toContain("inbox");
  });
});
