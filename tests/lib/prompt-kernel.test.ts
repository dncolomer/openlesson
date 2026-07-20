import { describe, expect, it } from "vitest";
import {
  composePrompt,
  emptyLearningWorldModel,
  formatEvidenceAppetiteGuidance,
  learningWorldModelForTim,
  mergeLearningWorldModelDelta,
  parseLearningWorldModel,
  PROMPT_SYSTEM_VERSION,
  serializeLearningWorldModel,
  TIM_SYSTEM_ROLE,
  WORKSPACE_ONTOLOGY,
} from "@/lib/prompt-kernel";
import { buildPerformanceReportInstructions } from "@/lib/agent-v2/performance-report";
import { buildProofOfWorkSchemaInstructions } from "@/lib/agent-v2/proof-of-work-schema";

describe("prompt kernel", () => {
  it("exports a versioned kernel and ontology", () => {
    expect(PROMPT_SYSTEM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(WORKSPACE_ONTOLOGY).toContain("Workspaces");
    expect(WORKSPACE_ONTOLOGY).toContain("Trace Interruption Model");
    expect(WORKSPACE_ONTOLOGY).toContain("ghc_score");
    expect(TIM_SYSTEM_ROLE).toContain("Trace Interruption Model");
    expect(TIM_SYSTEM_ROLE).toContain("independent external service");
  });

  it("composePrompt layers ontology and task", () => {
    const composed = composePrompt({
      ontology: "full",
      surface: "SURFACE: test",
      task: "TASK: do the thing",
    });
    expect(composed.indexOf("WORKSPACE ONTOLOGY")).toBeLessThan(composed.indexOf("SURFACE: test"));
    expect(composed.indexOf("SURFACE: test")).toBeLessThan(composed.indexOf("TASK: do the thing"));
  });

  it("learning world model serializes, merges, and feeds TIM subset", () => {
    const base = emptyLearningWorldModel("ws-abc");
    const merged = mergeLearningWorldModelDelta(base, {
      evidence_appetite: { want_more: ["reflection"], saturated: ["crud"] },
      scores_snapshot: {
        verification_score: 40,
        augmentation_score: null,
        optimization_score: 30,
        ghc_score: 10,
      },
    });
    expect(merged.evidence_appetite.want_more).toEqual(["reflection"]);
    // null scores in delta must not wipe siblings; only optimization/verification set
    expect(merged.scores_snapshot.verification_score).toBe(40);
    expect(merged.scores_snapshot.optimization_score).toBe(30);
    expect(merged.scores_snapshot.augmentation_score).toBeNull();

    const preserved = mergeLearningWorldModelDelta(merged, {
      scores_snapshot: {
        verification_score: null,
        augmentation_score: 55,
        optimization_score: null,
        ghc_score: null,
      },
    });
    expect(preserved.scores_snapshot.verification_score).toBe(40);
    expect(preserved.scores_snapshot.augmentation_score).toBe(55);
    expect(preserved.scores_snapshot.optimization_score).toBe(30);

    const json = serializeLearningWorldModel(merged);
    const parsed = parseLearningWorldModel(JSON.parse(json));
    expect(parsed?.workspace_id).toBe("ws-abc");
    expect(parsed?.evidence_appetite.want_more).toContain("reflection");

    const forTim = learningWorldModelForTim(merged);
    expect(forTim?.evidence_appetite?.want_more).toContain("reflection");
    expect(forTim?.scores_snapshot?.verification_score).toBe(40);

    const guidance = formatEvidenceAppetiteGuidance(merged);
    expect(guidance).toContain("Prefer more of");
    expect(guidance).toContain("reflection");
  });

  it("performance and PoW schema builders consume ontology (shipped wiring)", () => {
    const perf = buildPerformanceReportInstructions(null, "Activate trial");
    expect(perf).toContain("WORKSPACE ONTOLOGY");
    expect(perf).toContain("SCORE GENERATION CONTEXT");
    expect(perf).toContain("verification");
    expect(perf).toContain("ghc_score");
    expect(perf).toMatch(/System\s*1/i);

    const schema = buildProofOfWorkSchemaInstructions(
      { definition: "Evaluate onboarding readiness" },
      null,
      undefined,
      formatEvidenceAppetiteGuidance(
        mergeLearningWorldModelDelta(emptyLearningWorldModel("ws-1"), {
          evidence_appetite: { want_more: ["decision_rationale"], saturated: [] },
        }),
      ),
    );
    expect(schema).toContain("WORKSPACE ONTOLOGY");
    expect(schema).toContain("continuous");
    expect(schema).toContain("ghc_score");
    expect(schema).toContain("decision_rationale");
    expect(schema).toContain("Trace Interruption Model");
  });
});
