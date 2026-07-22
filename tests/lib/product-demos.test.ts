import { describe, expect, it } from "vitest";
import { createTimeToolActions } from "@/lib/product-demos/demo-definition";
import { PROOF_OF_WORK_API_DEMOS, getDemoById, resolveDemoId } from "@/lib/product-demos/demos";
import { countDistinctProofOfWorkActions, getActionsByCategory } from "@/lib/product-demos/simulation";
import { createInitialWorldState } from "@/lib/product-demos/simulation";

describe("Proof-of-Work API demo registry", () => {
  it("exposes Orbit as the standalone external verification scenario", () => {
    expect(PROOF_OF_WORK_API_DEMOS.length).toBe(1);
    expect(PROOF_OF_WORK_API_DEMOS[0]?.id).toBe("orbit");

    const demo = PROOF_OF_WORK_API_DEMOS[0]!;
    const proofOfWorkActions = demo.actions.filter((action) => action.kind === "proof_of_work");
    const timeTools = getActionsByCategory(demo, "simulation_tools");

    expect(demo.productName).toBe("Orbit");
    expect(demo.useCase.length).toBeGreaterThan(8);
    expect(demo.scenarioTitle.length).toBeGreaterThan(8);
    expect(demo.workspacePrompt.length).toBeGreaterThan(80);
    expect(demo.modelDoc).toMatch(/lwm_snapshot_score|LWM Snapshot/i);
    expect(demo.modelDoc).toMatch(/lwm[-_]snapshot/);
    expect(demo.modelDoc).not.toMatch(/\bverification_score\b/);
    expect(demo.modelDoc).not.toMatch(/\boptimization_score\b/);
    expect(demo.modelDoc).toContain(demo.useCase);
    expect(demo.modelDoc).not.toMatch(/fictional|Proof-of-Work API demo|Demo workspace|simulation|simulate/i);
    expect(demo.scenarioTitle).not.toMatch(/simulation/i);
    expect(demo.workspaceDescription.length).toBeGreaterThan(10);
    expect(proofOfWorkActions.length).toBeGreaterThan(18);
    expect(timeTools.length).toBe(createTimeToolActions().length);
    expect(demo.categoryOrder).toContain("simulation_tools");
    expect(demo.simulatorMode).toBe("external");
  });

  it("resolves unknown demo ids to Orbit", () => {
    expect(resolveDemoId("unknown-demo").id).toBe("orbit");
    expect(getDemoById("orbit")?.productName).toBe("Orbit");
  });

  it("tracks coverage per demo definition", () => {
    const demo = getDemoById("orbit");
    expect(demo).toBeDefined();

    const action = getActionsByCategory(demo!, "onboarding")[0];
    const state = createInitialWorldState();
    const next = {
      ...state,
      actionCounts: { [action.id]: 1 },
      completedActions: [action.id],
    };

    expect(countDistinctProofOfWorkActions(demo!, next)).toBe(1);
  });
});