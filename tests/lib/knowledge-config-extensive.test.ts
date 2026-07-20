import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_SEM_DIM,
  KNOWLEDGE_CONFIG_STRUCT_DIM,
  cosineSimilarity,
  emptyKnowledgeConfig,
  encodeKnowledgeConfig,
  isKnowledgeConfigVector,
  l2Distance,
  l2Norm,
  l2Normalize,
  projectKnowledgeConfigTo2D,
  scoreToUnit,
} from "@/lib/knowledge-config";
import {
  clip01,
  hashUnit,
  projectWithMatrix,
  seededRandomProjection,
} from "@/lib/knowledge-config/math";
import {
  emptyLearningWorldModel,
  mergeLearningWorldModelDelta,
  parseLearningWorldModel,
  serializeLearningWorldModel,
  formatEvidenceAppetiteGuidance,
  learningWorldModelForTim,
} from "@/lib/prompt-kernel/world-model";
import {
  encodeAndMeasureVelocity,
  powRowsFromPerformanceContext,
  projectTrajectory2D,
  trajectoryPathLength,
  knowledgeConfigPointerFromEmbedding,
} from "@/lib/agent-v2/knowledge-config-store";
import type { KnowledgeConfigTrajectoryPoint } from "@/lib/knowledge-config";

function basePow(n: number, startMs = 1_000_000) {
  return Array.from({ length: n }, (_, i) => ({
    proof_of_work_type: i % 3 === 0 ? "screen" : "tool",
    block_id: `b${i % 4}`,
    timestamp_ms: startMs + i * 15_000,
    tool_name: i % 2 === 0 ? "cli" : "editor",
    tool_action: "run",
    metadata: i % 5 === 0 ? { selective_thought: true, system: 1 } : {},
  }));
}

describe("knowledge-config math primitives", () => {
  it("normalizes, distances, and clips correctly", () => {
    expect(l2Norm([3, 4])).toBeCloseTo(5);
    expect(l2Normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(l2Normalize([0, 0])).toEqual([0, 0]);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(l2Distance([0, 0], [3, 4])).toBeCloseTo(5);
    expect(l2Distance([1], [1, 2])).toBe(Infinity);
    expect(clip01(1.5)).toBe(1);
    expect(clip01(-2)).toBe(0);
    expect(clip01(Number.NaN)).toBe(0);
    expect(scoreToUnit(50)).toBeCloseTo(0.5);
    expect(scoreToUnit(null)).toBe(0);
    expect(scoreToUnit(200)).toBe(1);
  });

  it("hashUnit and seeded projection are deterministic", () => {
    expect(hashUnit("abc")).toBe(hashUnit("abc"));
    expect(hashUnit("abc")).not.toBe(hashUnit("abd"));
    const a = seededRandomProjection(3, 4, "seed-x");
    const b = seededRandomProjection(3, 4, "seed-x");
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a[0]).toHaveLength(4);
    const different = seededRandomProjection(3, 4, "seed-y");
    expect(a).not.toEqual(different);

    const proj = projectWithMatrix([1, 0, 0, 0], a);
    expect(proj).toHaveLength(3);
    expect(proj.every((x) => Number.isFinite(x))).toBe(true);
  });
});

describe("knowledgecfg-v1-d64 encoder extensive", () => {
  it("keeps struct/sem dim contract", () => {
    expect(KNOWLEDGE_CONFIG_STRUCT_DIM + KNOWLEDGE_CONFIG_SEM_DIM).toBe(KNOWLEDGE_CONFIG_DIM);
  });

  it("handles empty PoW with null scores", () => {
    const emb = encodeKnowledgeConfig({
      workspaceId: "ws-empty",
      powRows: [],
      worldModel: emptyLearningWorldModel("ws-empty"),
      asOfMs: 42,
    });
    expect(isKnowledgeConfigVector(emb.vector)).toBe(true);
    expect(emb.pow_event_count).toBe(0);
    expect(emb.as_of_ms).toBe(42);
    expect(emb.confidence).toBe(0);
    // zero residual + zero scores still unit-or-zero after normalize
    expect(l2Norm(emb.vector)).toBeGreaterThanOrEqual(0);
  });

  it("increases confidence with more PoW and scores", () => {
    const sparse = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: basePow(1),
      worldModel: emptyLearningWorldModel("ws"),
    });
    const rich = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: basePow(20),
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 80,
          augmentation_score: 70,
          optimization_score: 60,
          ghc_score: 50,
        },
        exploration: {
          block_coverage: [
            { block_id: "b0", depth: "solid", evidence_refs: [] },
            { block_id: "b1", depth: "solid", evidence_refs: [] },
            { block_id: "b2", depth: "shallow", evidence_refs: [] },
            { block_id: "b3", depth: "shallow", evidence_refs: [] },
          ],
          pathways_touched: ["a", "b"],
          blind_spots: [],
        },
      }),
      totalBlocks: 4,
    });
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  it("reacts to evidence mix and temporal burstiness", () => {
    const steady = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        { proof_of_work_type: "tool", timestamp_ms: 0, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 10_000, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 20_000, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 30_000, metadata: {} },
      ],
    });
    const bursty = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        { proof_of_work_type: "tool", timestamp_ms: 0, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 100, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 200, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 3_600_000, metadata: {} },
      ],
    });
    expect(l2Distance(steady.vector, bursty.vector)).toBeGreaterThan(0.001);

    const eegHeavy = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        { proof_of_work_type: "eeg", timestamp_ms: 0, device_name: "muse", metadata: {} },
        { proof_of_work_type: "eeg", timestamp_ms: 1000, device_name: "muse", metadata: {} },
        { proof_of_work_type: "video", timestamp_ms: 2000, metadata: {} },
      ],
    });
    const toolOnly = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        { proof_of_work_type: "tool", timestamp_ms: 0, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 1000, metadata: {} },
        { proof_of_work_type: "tool", timestamp_ms: 2000, metadata: {} },
      ],
    });
    expect(l2Distance(eegHeavy.vector, toolOnly.vector)).toBeGreaterThan(0.01);
  });

  it("semantic residual shifts when LWM text changes (capped influence)", () => {
    const rows = basePow(5);
    const plain = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: rows,
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 50,
          augmentation_score: 50,
          optimization_score: 50,
          ghc_score: 20,
        },
        learning_profile: {
          strengths: ["algebra"],
          friction_patterns: [],
          preferred_modalities: [],
          temporal_patterns: { avg_dwell_ms: null, idle_bursts: null },
        },
      }),
    });
    const other = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: rows,
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 50,
          augmentation_score: 50,
          optimization_score: 50,
          ghc_score: 20,
        },
        learning_profile: {
          strengths: ["quantum-chromodynamics-proof-strategies"],
          friction_patterns: ["forgetting-boundary-conditions"],
          preferred_modalities: ["whiteboard"],
          temporal_patterns: { avg_dwell_ms: null, idle_bursts: null },
        },
      }),
    });
    const dist = l2Distance(plain.vector, other.vector);
    expect(dist).toBeGreaterThan(0);
    // residual is weighted 0.15 — should not dominate unit ball
    expect(dist).toBeLessThan(0.8);
  });

  it("is independent of workspace_id string (global axes)", () => {
    const rows = basePow(4);
    const wm = mergeLearningWorldModelDelta(emptyLearningWorldModel("ws-a"), {
      scores_snapshot: {
        verification_score: 60,
        augmentation_score: null,
        optimization_score: null,
        ghc_score: null,
      },
    });
    const a = encodeKnowledgeConfig({ workspaceId: "ws-a", powRows: rows, worldModel: wm });
    const b = encodeKnowledgeConfig({
      workspaceId: "ws-b-totally-different",
      powRows: rows,
      worldModel: { ...wm, workspace_id: "ws-b-totally-different" },
    });
    expect(a.vector).toEqual(b.vector);
  });

  it("rejects malformed vectors via isKnowledgeConfigVector", () => {
    expect(isKnowledgeConfigVector([])).toBe(false);
    expect(isKnowledgeConfigVector(new Array(64).fill(0))).toBe(true);
    expect(isKnowledgeConfigVector(new Array(63).fill(0))).toBe(false);
    expect(isKnowledgeConfigVector(new Array(64).fill(Number.NaN))).toBe(false);
    expect(isKnowledgeConfigVector("nope" as unknown as number[])).toBe(false);
  });

  it("projects trajectory and measures path length", () => {
    const points: KnowledgeConfigTrajectoryPoint[] = [];
    for (let i = 0; i < 5; i++) {
      const emb = encodeKnowledgeConfig({
        workspaceId: "ws",
        powRows: basePow(3 + i, 1_000_000 + i * 60_000),
        worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
          scores_snapshot: {
            verification_score: 20 + i * 15,
            augmentation_score: 10 + i * 10,
            optimization_score: 5 + i * 12,
            ghc_score: i * 10,
          },
        }),
        asOfMs: 1_000_000 + i * 60_000,
      });
      points.push({
        t: emb.as_of,
        as_of_ms: emb.as_of_ms,
        vector: emb.vector,
        confidence: emb.confidence,
        trigger: "score",
        pow_event_count: emb.pow_event_count,
      });
    }
    const path = trajectoryPathLength(points);
    expect(path).toBeGreaterThan(0);
    const coords = projectTrajectory2D(points);
    expect(coords).toHaveLength(5);
    expect(coords.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y))).toBe(true);
  });

  it("encodeAndMeasureVelocity attaches finite velocity vs previous", () => {
    const first = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: basePow(3),
      asOfMs: 1_000_000,
      worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
        scores_snapshot: {
          verification_score: 30,
          augmentation_score: null,
          optimization_score: null,
          ghc_score: null,
        },
      }),
    });
    const second = encodeAndMeasureVelocity(
      {
        workspaceId: "ws",
        powRows: basePow(6),
        asOfMs: 1_000_000 + 3_600_000,
        worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
          scores_snapshot: {
            verification_score: 80,
            augmentation_score: null,
            optimization_score: null,
            ghc_score: null,
          },
        }),
      },
      {
        id: "prev",
        workspace_id: "ws",
        embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
        dim: 64,
        vector: first.vector,
        as_of_ms: first.as_of_ms,
        pow_event_count: first.pow_event_count,
        confidence: first.confidence,
        trigger: "score",
        created_at: first.as_of,
      },
    );
    expect(second.velocity).toBeTypeOf("number");
    expect(second.velocity!).toBeGreaterThan(0);
    expect(Number.isFinite(second.velocity!)).toBe(true);
  });

  it("powRowsFromPerformanceContext maps type aliases", () => {
    const rows = powRowsFromPerformanceContext([
      {
        type: "tool",
        block_id: "b1",
        timestamp_ms: 1,
        tool_name: "x",
        tool_action: "y",
        metadata: { a: 1 },
      },
    ]);
    expect(rows[0].proof_of_work_type).toBe("tool");
    expect(rows[0].metadata).toEqual({ a: 1 });
  });

  it("knowledgeConfigPointerFromEmbedding preserves model id and dim", () => {
    const emb = emptyKnowledgeConfig(0);
    const ptr = knowledgeConfigPointerFromEmbedding(emb);
    expect(ptr?.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(ptr?.dim).toBe(64);
    expect(ptr?.vector).toHaveLength(64);
  });

  it("2D projection is stable for same vector", () => {
    const emb = encodeKnowledgeConfig({ workspaceId: "ws", powRows: basePow(4) });
    const a = projectKnowledgeConfigTo2D(emb.vector);
    const b = projectKnowledgeConfigTo2D(emb.vector);
    expect(a).toEqual(b);
  });

  it("cosine of identical embeddings is 1", () => {
    const emb = encodeKnowledgeConfig({ workspaceId: "ws", powRows: basePow(8) });
    expect(cosineSimilarity(emb.vector, emb.vector)).toBeCloseTo(1, 10);
  });
});

describe("LWM dual layer + TIM export", () => {
  it("round-trips subject and knowledge_config through serialize/parse", () => {
    const emb = encodeKnowledgeConfig({ workspaceId: "ws", powRows: basePow(3) });
    const model = mergeLearningWorldModelDelta(
      emptyLearningWorldModel("ws", { user_id: "u-9" }),
      {
        evidence_appetite: { want_more: ["reflection"], saturated: ["crud"] },
        knowledge_config: knowledgeConfigPointerFromEmbedding(emb),
      },
    );
    const parsed = parseLearningWorldModel(JSON.parse(serializeLearningWorldModel(model)));
    expect(parsed?.subject?.user_id).toBe("u-9");
    expect(parsed?.knowledge_config?.vector).toEqual(emb.vector);
    expect(parsed?.evidence_appetite.want_more).toContain("reflection");
  });

  it("learningWorldModelForTim exposes confidence", () => {
    const model = mergeLearningWorldModelDelta(emptyLearningWorldModel("ws"), {
      knowledge_config: {
        embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
        dim: 64,
        vector: new Array(64).fill(0),
        as_of: new Date().toISOString(),
        pow_event_count: 2,
        confidence: 0.42,
      },
      evidence_appetite: { want_more: ["x"], saturated: [] },
    });
    const subset = learningWorldModelForTim(model);
    expect(subset?.knowledge_config_confidence).toBe(0.42);
    expect(formatEvidenceAppetiteGuidance(model)).toContain("Prefer more of");
  });

  it("rejects invalid version on parse", () => {
    expect(parseLearningWorldModel({ version: 2, workspace_id: "ws" })).toBeNull();
    expect(parseLearningWorldModel(null)).toBeNull();
    expect(parseLearningWorldModel({ version: 1 })).toBeNull();
  });
});
