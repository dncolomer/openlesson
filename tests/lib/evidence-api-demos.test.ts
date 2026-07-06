import { describe, expect, it } from "vitest";
import { createTimeToolActions } from "@/lib/evidence-api-demo/demo-definition";
import { EVIDENCE_API_DEMOS, getDemoById, resolveDemoId } from "@/lib/evidence-api-demo/demos";
import { countDistinctEvidenceActions, getActionsByCategory } from "@/lib/evidence-api-demo/simulation";
import { createInitialWorldState } from "@/lib/evidence-api-demo/simulation";

describe("evidence API demo registry", () => {
  it("exposes Orbit as the standalone external verification scenario", () => {
    expect(EVIDENCE_API_DEMOS.length).toBe(1);
    expect(EVIDENCE_API_DEMOS[0]?.id).toBe("orbit");

    const demo = EVIDENCE_API_DEMOS[0]!;
    const evidenceActions = demo.actions.filter((action) => action.kind === "evidence");
    const timeTools = getActionsByCategory(demo, "simulation_tools");

    expect(demo.productName).toBe("Orbit");
    expect(demo.useCase.length).toBeGreaterThan(8);
    expect(demo.scenarioTitle.length).toBeGreaterThan(8);
    expect(demo.workspacePrompt.length).toBeGreaterThan(80);
    expect(demo.modelDoc).toContain("overall_score");
    expect(demo.modelDoc).toContain(demo.useCase);
    expect(demo.modelDoc).not.toMatch(/fictional|Evidence API demo|Demo workspace|simulation|simulate/i);
    expect(demo.scenarioTitle).not.toMatch(/simulation/i);
    expect(demo.workspaceDescription.length).toBeGreaterThan(10);
    expect(evidenceActions.length).toBeGreaterThan(18);
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

    expect(countDistinctEvidenceActions(demo!, next)).toBe(1);
  });
});