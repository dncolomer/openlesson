import { describe, expect, it } from "vitest";
import { nexusfrontDemo } from "@/lib/product-demos/demos/nexusfront";
import { getDemoWorkspaceModelFile } from "@/lib/product-demos/demo-definition";
import {
  applySimulationAction,
  buildSimulationProofOfWorkPayload,
  countDistinctProofOfWorkActions,
  createInitialWorldState,
  getActionsByCategory,
  shouldSuggestSkillRegeneration,
} from "@/lib/product-demos/simulation";

describe("nexusfront simulation toolkit", () => {
  it("exposes non-linear categories including simulation tools", () => {
    expect(nexusfrontDemo.categoryOrder).toContain("simulation_tools");
    expect(getActionsByCategory(nexusfrontDemo, "simulation_tools").length).toBeGreaterThanOrEqual(3);
    expect(nexusfrontDemo.actions.length).toBeGreaterThan(20);
  });

  it("advances simulated days on time tools", () => {
    const waitDay = nexusfrontDemo.actions.find((action) => action.id === "wait_1_day");
    expect(waitDay).toBeDefined();

    const next = applySimulationAction(createInitialWorldState(), waitDay!);
    expect(next.simulatedDays).toBe(1);
    expect(next.actionCounts.wait_1_day).toBe(1);
  });

  it("builds time-gap proof-of-work payloads", () => {
    const waitWeek = nexusfrontDemo.actions.find((action) => action.id === "wait_1_week")!;
    const payload = buildSimulationProofOfWorkPayload(nexusfrontDemo, waitWeek, {
      sessionId: "session-1",
      worldState: createInitialWorldState(),
    });

    expect(payload.time_gap).toMatchObject({
      days_elapsed: 7,
      total_elapsed_days: 7,
    });
    expect(payload.event).toMatchObject({
      verb: "time_gap_elapsed",
    });
  });

  it("provides a demo workspace model file for workspace_files upload", () => {
    const file = getDemoWorkspaceModelFile(nexusfrontDemo);
    expect(file.name).toBe("nexusfront-eval-model.md");
    expect(file.mime_type).toBe("text/markdown");
    expect(file.data.length).toBeGreaterThan(100);
    const decoded = Buffer.from(file.data, "base64").toString("utf8");
    expect(decoded).toContain("Haven Rise");
    expect(decoded).toContain("Resource-gathering city growth certification");
    expect(decoded).toContain("overall_score");
    expect(decoded).toContain("integration-skill");
  });

  it("tracks distinct evidence actions for coverage", () => {
    let state = createInitialWorldState();
    const found = nexusfrontDemo.actions.find((action) => action.id === "commission_outpost")!;
    const wait = nexusfrontDemo.actions.find((action) => action.id === "wait_1_day")!;

    state = applySimulationAction(state, found);
    state = applySimulationAction(state, wait);

    expect(countDistinctProofOfWorkActions(nexusfrontDemo, state)).toBe(1);
    expect(shouldSuggestSkillRegeneration(3, null)).toBe(true);
    expect(shouldSuggestSkillRegeneration(4, 3)).toBe(false);
    expect(shouldSuggestSkillRegeneration(5, 3)).toBe(true);
  });
});
