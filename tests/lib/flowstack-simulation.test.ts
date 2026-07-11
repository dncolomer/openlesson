import { describe, expect, it } from "vitest";
import {
  SIMULATION_ACTIONS,
  SIMULATION_CATEGORY_ORDER,
  applySimulationAction,
  buildSimulationProofOfWorkPayload,
  countDistinctProofOfWorkActions,
  createInitialWorldState,
  getActionsByCategory,
  getDemoWorkspaceModelFile,
  shouldSuggestSkillRegeneration,
} from "@/lib/openlesson-demo/flowstack";

describe("flowstack simulation toolkit", () => {
  it("exposes non-linear categories including simulation tools", () => {
    expect(SIMULATION_CATEGORY_ORDER).toContain("simulation_tools");
    expect(getActionsByCategory("simulation_tools").length).toBeGreaterThanOrEqual(3);
    expect(SIMULATION_ACTIONS.length).toBeGreaterThan(20);
  });

  it("advances simulated days on time tools", () => {
    const waitDay = SIMULATION_ACTIONS.find((action) => action.id === "wait_1_day");
    expect(waitDay).toBeDefined();

    const next = applySimulationAction(createInitialWorldState(), waitDay!);
    expect(next.simulatedDays).toBe(1);
    expect(next.actionCounts.wait_1_day).toBe(1);
  });

  it("builds time-gap proof-of-work payloads", () => {
    const waitWeek = SIMULATION_ACTIONS.find((action) => action.id === "wait_1_week")!;
    const payload = buildSimulationProofOfWorkPayload(waitWeek, {
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
    const file = getDemoWorkspaceModelFile();
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
    const found = SIMULATION_ACTIONS.find((action) => action.id === "commission_outpost")!;
    const wait = SIMULATION_ACTIONS.find((action) => action.id === "wait_1_day")!;

    state = applySimulationAction(state, found);
    state = applySimulationAction(state, wait);

    expect(countDistinctProofOfWorkActions(state)).toBe(1);
    expect(shouldSuggestSkillRegeneration(3, null)).toBe(true);
    expect(shouldSuggestSkillRegeneration(4, 3)).toBe(false);
    expect(shouldSuggestSkillRegeneration(5, 3)).toBe(true);
  });
});