import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  createCustomVerificationModelFromVectors,
  encodeKnowledgeConfig,
  scoreAgainstCustomVerificationModel,
  CustomVerificationModelError,
} from "@/lib/knowledge-config";
import { emptyLearningWorldModel, mergeLearningWorldModelDelta } from "@/lib/prompt-kernel/world-model";

function expertVector(score: number, seed: number): number[] {
  return encodeKnowledgeConfig({
    workspaceId: "ws",
    powRows: [
      {
        proof_of_work_type: "tool",
        timestamp_ms: 1_000_000 + seed * 1000,
        tool_name: "prod-console",
        tool_action: "runbook",
        metadata: { selective_thought: true, system: 2 },
      },
      {
        proof_of_work_type: "tool",
        timestamp_ms: 1_000_000 + seed * 1000 + 30_000,
        tool_name: "pager",
        metadata: {},
      },
      {
        proof_of_work_type: "screen",
        timestamp_ms: 1_000_000 + seed * 1000 + 60_000,
        metadata: {},
      },
    ],
    worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
      scores_snapshot: {
        verification_score: score,
        augmentation_score: score - 5,
        optimization_score: score - 10,
        ghc_score: 50,
      },
      learning_profile: {
        strengths: ["incident-response", "runbook-discipline"],
        friction_patterns: [],
        preferred_modalities: ["tool"],
        temporal_patterns: { avg_dwell_ms: 5000, idle_bursts: 1 },
      },
    }),
    totalBlocks: 4,
  }).vector;
}

describe("custom verification model (shipped geometry)", () => {
  it("creates a high-validation region from expert cohort embeddings", () => {
    const experts = [expertVector(88, 1), expertVector(90, 2), expertVector(85, 3)];
    const model = createCustomVerificationModelFromVectors({
      name: "Production SRE bar",
      vectors: experts,
      subjects: [
        { user_id: "expert-1", label: "Alice" },
        { user_id: "expert-2", label: "Bob" },
        { user_id: "expert-3", label: "Cara" },
      ],
    });

    expect(model.name).toBe("Production SRE bar");
    expect(model.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(model.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(model.centroid).toHaveLength(64);
    expect(model.subject_count).toBe(3);
    expect(model.cohort_cohesion).toBeGreaterThan(0.5);
    expect(model.cosine_threshold).toBeGreaterThan(0.3);
    expect(model.cosine_threshold).toBeLessThanOrEqual(0.99);
  });

  it("scores a strong expert higher than a weak novice against the model", () => {
    const experts = [expertVector(90, 10), expertVector(92, 11), expertVector(88, 12)];
    const model = createCustomVerificationModelFromVectors({
      name: "SRE custom verification model",
      vectors: experts,
    });

    const expertLike = expertVector(91, 10);
    const novice = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        {
          proof_of_work_type: "tool",
          timestamp_ms: 50,
          tool_name: "notes",
          metadata: {},
        },
      ],
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 15,
          augmentation_score: 10,
          optimization_score: 5,
          ghc_score: 0,
        },
      }),
    }).vector;

    const high = scoreAgainstCustomVerificationModel(expertLike, model);
    const low = scoreAgainstCustomVerificationModel(novice, model);

    expect(high.validation_score).toBeGreaterThan(low.validation_score);
    expect(high.cosine_similarity).toBeGreaterThan(low.cosine_similarity);
    expect(high.model_name).toBe("SRE custom verification model");
    expect(high.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    // Expert-like should land near/in region
    expect(high.validation_score).toBeGreaterThan(50);
  });

  it("rejects empty cohort and invalid vectors", () => {
    expect(() =>
      createCustomVerificationModelFromVectors({ name: "x", vectors: [] }),
    ).toThrow(CustomVerificationModelError);

    expect(() =>
      createCustomVerificationModelFromVectors({
        name: "  ",
        vectors: [expertVector(80, 1)],
      }),
    ).toThrow(/name/i);

    expect(() =>
      createCustomVerificationModelFromVectors({
        name: "bad",
        vectors: [[1, 2, 3]],
      }),
    ).toThrow(CustomVerificationModelError);
  });

  it("in_region is true when cosine meets threshold", () => {
    const v = expertVector(95, 99);
    const model = createCustomVerificationModelFromVectors({
      name: "solo expert",
      vectors: [v],
    });
    // Same vector as centroid-ish → high cosine
    const score = scoreAgainstCustomVerificationModel(v, model);
    expect(score.in_region).toBe(true);
    expect(score.validation_score).toBeGreaterThanOrEqual(80);
  });
});
