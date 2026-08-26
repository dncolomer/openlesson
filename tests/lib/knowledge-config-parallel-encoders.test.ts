/**
 * Parallel experimental knowledgecfg encoders + dual-write on score path.
 * Exercises real shipped encode/registry/store helpers (no re-implementations).
 */
import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  ALL_KNOWLEDGE_CONFIG_MODELS,
  EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS,
  KNOWLEDGE_CONFIG_CONTENT_D256_DIM,
  KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_HYBRID_D192_DIM,
  KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
  encodeKnowledgeConfig,
  encodeKnowledgeConfigContent256,
  encodeKnowledgeConfigDual256,
  encodeKnowledgeConfigForModel,
  encodeKnowledgeConfigHybrid192,
  experimentalDualWriteModelIds,
  isKnowledgeConfigVector,
  l2Norm,
  type KnowledgeConfigEncodeInput,
} from "@/lib/knowledge-config";
import {
  insertExperimentalKnowledgeConfigSnapshots,
  insertKnowledgeConfigSnapshot,
  encodeAndMeasureVelocity,
  knowledgeConfigPointerFromEmbedding,
  loadLatestKnowledgeConfig,
} from "@/lib/pow-api/knowledge-config-store";
import { updateLearnerStateAfterScore } from "@/lib/pow-api/learner-state-engine";
import {
  emptyLearningWorldModel,
  mergeLearningWorldModelDelta,
  type LearningWorldModelDelta,
} from "@/lib/prompt-kernel/world-model";
import { createLearnerStateMockDb } from "../helpers/mock-supabase-learner-state";
import {
  EMBEDDING_MODEL_CATALOG,
  resolveSelectedEmbeddingModelId,
} from "@/lib/map-of-knowledge";
import type { AuthContext } from "@/lib/pow-api/types";
import type { VerticalScoreReport } from "@/lib/pow-api/performance-report";

const SCRATCH =
  process.env.GROK_SCRATCH_DIR ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-07b06b0f25b0/implementer";

function fixtureInput(overrides: Partial<KnowledgeConfigEncodeInput> = {}): KnowledgeConfigEncodeInput {
  const wm = mergeLearningWorldModelDelta(
    emptyLearningWorldModel("ws-parallel", { user_id: "u1" }),
    {
      scores_snapshot: {
        verification_score: 70,
        augmentation_score: 55,
        optimization_score: 40,
        ghc_score: 35,
      },
      exploration: {
        block_coverage: [
          { block_id: "b1", depth: "solid", evidence_refs: ["e1"] },
          { block_id: "b2", depth: "shallow", evidence_refs: [] },
        ],
        pathways_touched: ["bases", "spans"],
        blind_spots: ["eigenvalues"],
      },
      learning_profile: {
        strengths: ["definitions"],
        friction_patterns: ["proof jumps"],
        preferred_modalities: ["tool", "speech"],
        temporal_patterns: { avg_dwell_ms: 3500, idle_bursts: 1 },
      },
      evidence_appetite: {
        want_more: ["decision_rationale"],
        saturated: ["tool_crud_events"],
      },
      inferred_goal: {
        text: "Explain linear algebra bases and dimension",
        confidence: 0.7,
        source: "evolved",
      },
    },
  );

  const powRows = [
    {
      proof_of_work_type: "tool",
      block_id: "b1",
      timestamp_ms: 1_700_000_000_000,
      tool_name: "ile-thought-trace",
      tool_action: "crystallize",
      metadata: {
        selective_thought: true,
        system: 1,
        stash: true,
        trace_type: "system1",
        text: "A basis is a linearly independent spanning set",
      },
    },
    {
      proof_of_work_type: "tool",
      block_id: "b1",
      timestamp_ms: 1_700_000_030_000,
      tool_name: "tap-speech-segment",
      tool_action: "stop",
      metadata: {
        transcript_snapshot: "Dimension is the size of any basis of the space",
        system: 1,
      },
    },
    {
      proof_of_work_type: "tool",
      block_id: "b2",
      timestamp_ms: 1_700_000_090_000,
      tool_name: "ile-thought-trace",
      tool_action: "send",
      metadata: {
        selective_thought: true,
        system: 2,
        submit: true,
        trace_type: "system2",
        text: "The dimension of R^n is n because the standard basis has n vectors",
      },
    },
    {
      proof_of_work_type: "screen",
      block_id: "b2",
      timestamp_ms: 1_700_000_120_000,
      metadata: {},
    },
  ];

  return {
    workspaceId: "ws-parallel",
    totalBlocks: 4,
    powRows,
    worldModel: wm,
    asOfMs: 1_700_000_120_000,
    ...overrides,
  };
}

function expectUnitVector(vector: number[], dim: number) {
  expect(isKnowledgeConfigVector(vector, dim)).toBe(true);
  expect(vector).toHaveLength(dim);
  expect(vector.every((v) => Number.isFinite(v))).toBe(true);
  const norm = l2Norm(vector);
  // Empty/zero feature cases may be all zeros (norm 0); otherwise unit length.
  if (norm > 1e-9) {
    expect(Math.abs(norm - 1)).toBeLessThan(1e-6);
  }
}

describe("experimental parallel encoders", () => {
  it("registry lists product v1 + three experimental models with fixed dims", () => {
    expect(ALL_KNOWLEDGE_CONFIG_MODELS.map((m) => m.id)).toContain(
      KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    );
    expect(EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS).toHaveLength(3);
    expect(experimentalDualWriteModelIds()).toEqual([
      KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
      KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
      KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
    ]);
    const byId = Object.fromEntries(ALL_KNOWLEDGE_CONFIG_MODELS.map((m) => [m.id, m.dim]));
    expect(byId[KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID]).toBe(64);
    expect(byId[KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID]).toBe(192);
    expect(byId[KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID]).toBe(256);
    expect(byId[KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID]).toBe(256);
  });

  it("hybrid-d192: model id, dim, unit vector, deterministic", () => {
    const input = fixtureInput();
    const a = encodeKnowledgeConfigHybrid192(input);
    const b = encodeKnowledgeConfigHybrid192(input);
    expect(a.embedding_model_id).toBe(KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID);
    expect(a.dim).toBe(KNOWLEDGE_CONFIG_HYBRID_D192_DIM);
    expectUnitVector(a.vector, KNOWLEDGE_CONFIG_HYBRID_D192_DIM);
    expect(a.vector).toEqual(b.vector);
    expect(a.pow_event_count).toBe(4);
  });

  it("content-d256: model id, dim, unit vector, uses thought/transcript text, deterministic", () => {
    const input = fixtureInput();
    const a = encodeKnowledgeConfigContent256(input);
    const b = encodeKnowledgeConfigContent256(input);
    expect(a.embedding_model_id).toBe(KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID);
    expect(a.dim).toBe(KNOWLEDGE_CONFIG_CONTENT_D256_DIM);
    expectUnitVector(a.vector, KNOWLEDGE_CONFIG_CONTENT_D256_DIM);
    expect(a.vector).toEqual(b.vector);

    const noText = encodeKnowledgeConfigContent256(
      fixtureInput({
        powRows: [
          {
            proof_of_work_type: "tool",
            timestamp_ms: 1,
            metadata: {},
          },
        ],
        worldModel: emptyLearningWorldModel("ws"),
      }),
    );
    // Content residual should move when free text is present
    expect(a.vector).not.toEqual(noText.vector);
  });

  it("dual-d256: model id, dim, unit vector, S1/S2 channel sensitivity, deterministic", () => {
    const input = fixtureInput();
    const a = encodeKnowledgeConfigDual256(input);
    const b = encodeKnowledgeConfigDual256(input);
    expect(a.embedding_model_id).toBe(KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID);
    expect(a.dim).toBe(KNOWLEDGE_CONFIG_DUAL_D256_DIM);
    expectUnitVector(a.vector, KNOWLEDGE_CONFIG_DUAL_D256_DIM);
    expect(a.vector).toEqual(b.vector);

    const s2Only = encodeKnowledgeConfigDual256(
      fixtureInput({
        powRows: [
          {
            proof_of_work_type: "tool",
            timestamp_ms: 1_700_000_000_000,
            tool_name: "ile-thought-trace",
            metadata: {
              system: 2,
              submit: true,
              trace_type: "system2",
              text: "Completely different submitted answer about topology",
            },
          },
        ],
      }),
    );
    expect(a.vector).not.toEqual(s2Only.vector);
  });

  it("empty PoW still yields valid finite vectors for all experimental models", () => {
    const empty: KnowledgeConfigEncodeInput = {
      workspaceId: "ws-empty",
      powRows: [],
      worldModel: null,
      asOfMs: 42,
    };
    for (const model of EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS) {
      const emb = model.encode(empty);
      expect(emb.embedding_model_id).toBe(model.id);
      expect(emb.dim).toBe(model.dim);
      expectUnitVector(emb.vector, model.dim);
      expect(emb.pow_event_count).toBe(0);
      expect(emb.as_of_ms).toBe(42);
    }
  });

  it("encodeKnowledgeConfigForModel dispatches registry and rejects unknown ids", () => {
    const input = fixtureInput();
    const v1 = encodeKnowledgeConfigForModel(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID, input);
    expect(v1.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(v1.dim).toBe(KNOWLEDGE_CONFIG_DIM);

    const hybrid = encodeKnowledgeConfigForModel(KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID, input);
    expect(hybrid.dim).toBe(192);

    expect(() => encodeKnowledgeConfigForModel("not-a-real-model", input)).toThrow(
      /Unknown knowledge-config/,
    );
  });

  it("different model ids are contractually separate (dims differ from v1)", () => {
    const input = fixtureInput();
    const v1 = encodeKnowledgeConfig(input);
    const hybrid = encodeKnowledgeConfigHybrid192(input);
    expect(v1.dim).not.toBe(hybrid.dim);
    expect(v1.embedding_model_id).not.toBe(hybrid.embedding_model_id);
  });
});

describe("dual-write on score path (no backfill)", () => {
  it("insertExperimentalKnowledgeConfigSnapshots writes three models without rewriting history", async () => {
    const db = createLearnerStateMockDb();
    const subject = { user_id: "u-dual" };
    const input = fixtureInput();

    // Pre-existing v1 historical row (must not be rewritten)
    const hist = encodeKnowledgeConfig({
      workspaceId: "ws-parallel",
      powRows: [{ proof_of_work_type: "tool", timestamp_ms: 100, metadata: {} }],
      asOfMs: 100,
    });
    await insertKnowledgeConfigSnapshot(db, {
      workspaceId: "ws-parallel",
      subject,
      embedding: hist,
      trigger: "score",
    });
    const histId = db._state.snapshots[0].id;
    const histVector = [...(db._state.snapshots[0].vector as number[])];

    const { inserted } = await insertExperimentalKnowledgeConfigSnapshots(db, {
      workspaceId: "ws-parallel",
      subject,
      encodeInput: input,
      trigger: "score",
      lwmId: "lwm-1",
    });

    expect(inserted).toHaveLength(3);
    expect(inserted.every((r) => r.id)).toBe(true);
    const modelIds = inserted.map((r) => r.embedding_model_id).sort();
    expect(modelIds).toEqual(
      [
        KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
        KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
        KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
      ].sort(),
    );

    // Historical v1 row untouched
    const histRow = db._state.snapshots.find((s) => s.id === histId);
    expect(histRow).toBeTruthy();
    expect(histRow!.vector).toEqual(histVector);
    expect(histRow!.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);

    // Latest per experimental model is the new insert
    for (const model of EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS) {
      const latest = await loadLatestKnowledgeConfig(db, "ws-parallel", subject, model.id);
      expect(latest).not.toBeNull();
      expect(latest!.embedding_model_id).toBe(model.id);
      expect(latest!.dim).toBe(model.dim);
      expectUnitVector(latest!.vector, model.dim);
    }

    // No historical re-encode API surface: second dual-write adds new rows, does not delete
    const countBefore = db._state.snapshots.length;
    await insertExperimentalKnowledgeConfigSnapshots(db, {
      workspaceId: "ws-parallel",
      subject,
      encodeInput: input,
      trigger: "score",
    });
    expect(db._state.snapshots.length).toBe(countBefore + 3);
    expect(db._state.snapshots.find((s) => s.id === histId)?.vector).toEqual(histVector);
  });

  it("updateLearnerStateAfterScore dual-writes experiments and keeps LWM pointer on v1", async () => {
    const db = createLearnerStateMockDb();
    const auth: AuthContext = {
      user_id: "learner-parallel",
      guest_user_id: null,
      organization_id: "org-1",
      is_org_admin: false,
      key_id: "key-1",
      scopes: ["workspaces:read"],
    };
    const report: VerticalScoreReport = {
      vertical: "verification",
      score: 72,
      workspace_goal: "Master bases",
      ghc_score: 40,
      ghc_confidence: "medium",
      marker_scores: [],
      summary: "ok",
      strengths: ["defs"],
      growth_areas: ["proofs"],
      gap_analysis: {
        summary: "gaps",
        gaps: [],
        next_steps: { directions: [], events: [] },
      },
      suggestions: [],
      confidence: "developing",
    };

    const result = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws-score-parallel",
      auth,
      report,
      vertical: "verification",
      proofOfWork: fixtureInput().powRows.map((r) => ({
        type: r.proof_of_work_type || "tool",
        block_id: r.block_id,
        timestamp_ms: r.timestamp_ms ?? undefined,
        tool_name: r.tool_name,
        tool_action: r.tool_action,
        metadata: r.metadata || {},
      })),
      totalBlocks: 4,
      trigger: "score",
    });

    expect(result.knowledgeConfig?.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(result.knowledgeConfig?.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(result.worldModel.knowledge_config?.embedding_model_id).toBe(
      KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    );

    const modelIds = new Set(db._state.snapshots.map((s) => s.embedding_model_id as string));
    expect(modelIds.has(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID)).toBe(true);
    expect(modelIds.has(KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID)).toBe(true);
    expect(modelIds.has(KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID)).toBe(true);
    expect(modelIds.has(KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID)).toBe(true);
    // One score event → 4 snapshots (v1 + 3 experimental)
    expect(db._state.snapshots).toHaveLength(4);

    const v1 = encodeAndMeasureVelocity(fixtureInput(), null);
    const ptr = knowledgeConfigPointerFromEmbedding(v1);
    expect(ptr.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
  });

  it("updateLearnerStateAfterScore still writes knowledge config when block_coverage is prose", async () => {
    const db = createLearnerStateMockDb();
    const auth: AuthContext = {
      user_id: "learner-kr",
      guest_user_id: null,
      organization_id: "org-1",
      is_org_admin: false,
      key_id: "key-1",
      scopes: ["workspaces:read"],
    };
    const report: VerticalScoreReport = {
      vertical: "verification",
      score: 74,
      workspace_goal: "Formalize a lemma",
      ghc_score: 40,
      ghc_confidence: "medium",
      marker_scores: [],
      summary: "ok",
      strengths: [],
      growth_areas: [],
      gap_analysis: {
        summary: "gaps",
        gaps: [],
        next_steps: { directions: [], events: [] },
      },
      suggestions: [],
      confidence: "developing",
      world_model_delta: {
        exploration: {
          block_coverage:
            "No named blocks; pathway coverage is a single live formalization episode",
          pathways_touched: [],
          blind_spots: [],
        },
      } as unknown as LearningWorldModelDelta,
    };

    const result = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws-kr-prose-coverage",
      auth,
      report,
      vertical: "verification",
      proofOfWork: [
        {
          type: "tool",
          tool_name: "ile-thought-trace",
          tool_action: "system1:pause_finalize",
          timestamp_ms: 1000,
          metadata: { thought_trace: true },
        },
      ],
      totalBlocks: 0,
      trigger: "score",
    });

    expect(result.knowledgeConfig?.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(isKnowledgeConfigVector(result.knowledgeConfig?.vector)).toBe(true);
    expect(db._state.snapshots.some((s) => s.embedding_model_id === KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID)).toBe(
      true,
    );
  });
});

describe("product defaults stay on knowledgecfg-v1-d64", () => {
  it("Map of Knowledge resolveSelectedEmbeddingModelId prefers v1 when present", () => {
    const available = EMBEDDING_MODEL_CATALOG.map((m) => ({ ...m }));
    expect(resolveSelectedEmbeddingModelId(null, available)).toBe(
      KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    );
    expect(resolveSelectedEmbeddingModelId("", available)).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(resolveSelectedEmbeddingModelId(KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID, available)).toBe(
      KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
    );
    // Catalog lists experimental models for discovery
    expect(EMBEDDING_MODEL_CATALOG.some((m) => m.id === KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID)).toBe(
      true,
    );
    // Product default is first / resolved when no request
    expect(EMBEDDING_MODEL_CATALOG[0].id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
  });

  it("UI MapOfKnowledgeClient initializes embedding model to v1", () => {
    const src = readFileSync(join(__dirname, "../../components/MapOfKnowledgeClient.tsx"), "utf8");
    expect(src).toContain("KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID");
    expect(src).toMatch(
      /useState<\s*string\s*>\(\s*\n?\s*KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID/,
    );
  });
});

describe("parallel encode fixture capture", () => {
  it("writes control + experimental encode results for verification", () => {
    const input = fixtureInput();
    const payload = {
      control: encodeKnowledgeConfig(input),
      experimental: EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS.map((m) => m.encode(input)),
      reencode_match: EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS.map((m) => {
        const a = m.encode(input);
        const b = m.encode(input);
        return {
          embedding_model_id: m.id,
          same: JSON.stringify(a.vector) === JSON.stringify(b.vector),
          dim: a.dim,
        };
      }),
      note: "No historical snapshot rows updated; dual-write is forward-only inserts.",
    };

    mkdirSync(SCRATCH, { recursive: true });
    const outPath = join(SCRATCH, "parallel-encode.json");
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          control: {
            embedding_model_id: payload.control.embedding_model_id,
            dim: payload.control.dim,
            norm: l2Norm(payload.control.vector),
            confidence: payload.control.confidence,
          },
          experimental: payload.experimental.map((e) => ({
            embedding_model_id: e.embedding_model_id,
            dim: e.dim,
            norm: l2Norm(e.vector),
            confidence: e.confidence,
            pow_event_count: e.pow_event_count,
          })),
          reencode_match: payload.reencode_match,
          note: payload.note,
        },
        null,
        2,
      ),
    );

    expect(payload.control.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(payload.control.dim).toBe(64);
    expect(payload.experimental).toHaveLength(3);
    expect(payload.reencode_match.every((r) => r.same)).toBe(true);
  });
});
