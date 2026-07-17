import { describe, expect, it } from "vitest";
import { matchCoachingHintToAction } from "@/lib/product-demos/orbit-coach-map";

describe("orbit coach map", () => {
  it("matches scorecard hints to actionable UI targets", () => {
    const target = matchCoachingHintToAction([
      "Assign the regression issue to yourself before starting work.",
    ]);

    expect(target?.actionId).toBe("assign_to_self");
    expect(target?.coachKey).toBe("assign");
  });

  it("matches inbox triage coaching", () => {
    const target = matchCoachingHintToAction(["Complete inbox triage for unread issues."]);
    expect(target?.actionId).toBe("open_inbox");
  });
});