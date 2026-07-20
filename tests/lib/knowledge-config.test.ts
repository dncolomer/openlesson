import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  cosineSimilarity,
  emptyKnowledgeConfig,
  encodeKnowledgeConfig,
  isKnowledgeConfigVector,
  l2Distance,
  l2Norm,
  projectKnowledgeConfigTo2D,
} from "@/lib/knowledge-config";
import {
  emptyLearningWorldModel,
  mergeLearningWorldModelDelta,
} from "@/lib/prompt-kernel/world-model";

describe("knowledgecfg-v1-d64", () => {
  it("exports fixed model contract", () => {
    expect(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID).toBe("knowledgecfg-v1-d64");
    expect(KNOWLEDGE_CONFIG_DIM).toBe(64);
  });

  it("encodes deterministically with fixed dimensionality", () => {
    const wm = mergeLearningWorldModelDelta(emptyLearningWorldModel("ws-1", { user_id: "u1" }), {
      scores_snapshot: {
        verification_score: 72,
        augmentation_score: 55,
        optimization_score: 40,
        ghc_score: 30,
      },
      exploration: {
        block_coverage: [
          { block_id: "b1", depth: "solid", evidence_refs: ["e1"] },
          { block_id: "b2", depth: "shallow", evidence_refs: [] },
        ],
        pathways_touched: ["p1"],
        blind_spots: ["gap-a"],
      },
      evidence_appetite: {
        want_more: ["decision_rationale"],
        saturated: ["tool_crud_events"],
      },
      learning_profile: {
        strengths: ["decomposition"],
        friction_patterns: ["skipping justification"],
        preferred_modalities: ["tool"],
        temporal_patterns: { avg_dwell_ms: 4000, idle_bursts: 2 },
      },
    });

    const powRows = [
      {
        proof_of_work_type: "tool",
        block_id: "b1",
        timestamp_ms: 1_700_000_000_000,
        tool_name: "canvas",
        tool_action: "draw",
        metadata: {},
      },
      {
        proof_of_work_type: "tool",
        block_id: "b1",
        timestamp_ms: 1_700_000_030_000,
        tool_name: "speech",
        tool_action: "utterance",
        metadata: { system: 1, selective_thought: true },
      },
      {
        proof_of_work_type: "screen",
        block_id: "b2",
        timestamp_ms: 1_700_000_090_000,
        metadata: {},
      },
    ];

    const a = encodeKnowledgeConfig({
      workspaceId: "ws-1",
      totalBlocks: 4,
      powRows,
      worldModel: wm,
    });
    const b = encodeKnowledgeConfig({
      workspaceId: "ws-1",
      totalBlocks: 4,
      powRows,
      worldModel: wm,
    });

    expect(a.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(a.dim).toBe(64);
    expect(isKnowledgeConfigVector(a.vector)).toBe(true);
    expect(a.vector).toEqual(b.vector);
    expect(Math.abs(l2Norm(a.vector) - 1)).toBeLessThan(1e-6);
    expect(a.confidence).toBeGreaterThan(0);
    expect(a.pow_event_count).toBe(3);
  });

  it("moves when scores improve", () => {
    const baseRows = [
      {
        proof_of_work_type: "tool",
        timestamp_ms: 1000,
        tool_name: "cli",
        metadata: {},
      },
      {
        proof_of_work_type: "tool",
        timestamp_ms: 5000,
        tool_name: "cli",
        metadata: {},
      },
    ];

    const low = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: baseRows,
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 20,
          augmentation_score: 10,
          optimization_score: 5,
          ghc_score: 0,
        },
      }),
    });

    const high = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: baseRows,
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 90,
          augmentation_score: 80,
          optimization_score: 70,
          ghc_score: 60,
        },
      }),
    });

    expect(l2Distance(low.vector, high.vector)).toBeGreaterThan(0.05);
    expect(cosineSimilarity(low.vector, high.vector)).toBeLessThan(0.999);
  });

  it("projects to finite 2D coordinates", () => {
    const emb = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        { proof_of_work_type: "tool", timestamp_ms: 1, metadata: {} },
        { proof_of_work_type: "eeg", timestamp_ms: 2000, device_name: "muse", metadata: {} },
      ],
      worldModel: emptyLearningWorldModel("ws"),
    });
    const p = projectKnowledgeConfigTo2D(emb.vector);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it("empty config is zero vector with zero confidence", () => {
    const empty = emptyKnowledgeConfig(0);
    expect(empty.vector.every((v) => v === 0)).toBe(true);
    expect(empty.confidence).toBe(0);
  });

  it("LWM accepts subject and knowledge_config pointer", () => {
    const model = mergeLearningWorldModelDelta(
      emptyLearningWorldModel("ws-x", { user_id: "user-1" }),
      {
        knowledge_config: {
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          dim: 64,
          vector: new Array(64).fill(0),
          as_of: new Date(0).toISOString(),
          pow_event_count: 0,
          confidence: 0,
        },
      },
    );
    expect(model.subject?.user_id).toBe("user-1");
    expect(model.knowledge_config?.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
  });
});
