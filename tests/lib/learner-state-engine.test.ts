import { describe, expect, it } from "vitest";
import { createLearnerStateMockDb } from "../helpers/mock-supabase-learner-state";
import {
  applyLearningWorldModelDelta,
  loadLearningWorldModel,
  normalizeSubject,
  saveLearningWorldModel,
  subjectFromAuthAndParticipants,
} from "@/lib/pow-api/learning-world-model-store";
import {
  insertKnowledgeConfigSnapshot,
  loadKnowledgeConfigTrajectory,
  loadLatestKnowledgeConfig,
  projectTrajectory2D,
  trajectoryPathLength,
} from "@/lib/pow-api/knowledge-config-store";
import {
  scoresDeltaFromReport,
  updateLearnerStateAfterScore,
} from "@/lib/pow-api/learner-state-engine";
import { resolveEvaluationSubject } from "@/lib/pow-api/evaluation-subject";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  encodeKnowledgeConfig,
  isKnowledgeConfigVector,
  l2Distance,
} from "@/lib/knowledge-config";
import { emptyLearningWorldModel } from "@/lib/prompt-kernel/world-model";
import type { VerticalScoreReport } from "@/lib/pow-api/performance-report";
import type { AuthContext } from "@/lib/pow-api/types";

function auth(partial: Partial<AuthContext> = {}): AuthContext {
  return {
    user_id: "user-owner",
    guest_user_id: null,
    organization_id: "org-1",
    is_org_admin: false,
    key_id: "key-1",
    scopes: ["workspaces:read"],
    ...partial,
  };
}

function scoreReport(overrides: Partial<VerticalScoreReport> = {}): VerticalScoreReport {
  return {
    vertical: "verification",
    score: 70,
    workspace_goal: "Explain linear algebra bases",
    ghc_score: 40,
    ghc_confidence: "medium",
    marker_scores: [],
    summary: "Solid coverage",
    strengths: ["definitions"],
    growth_areas: ["proofs"],
    gap_analysis: {
      summary: "gaps",
      gaps: [],
      next_steps: { directions: [], events: [] },
    },
    suggestions: [],
    confidence: "developing",
    world_model_delta: {
      evidence_appetite: {
        want_more: ["decision_rationale"],
        saturated: ["tool_crud_events"],
      },
      exploration: {
        block_coverage: [{ block_id: "b1", depth: "solid", evidence_refs: ["e1"] }],
        pathways_touched: ["intro"],
        blind_spots: ["eigenvalues"],
      },
      learning_profile: {
        strengths: ["definitions"],
        friction_patterns: ["proof jumps"],
        preferred_modalities: ["tool"],
        temporal_patterns: { avg_dwell_ms: 3000, idle_bursts: 1 },
      },
    },
    ...overrides,
  };
}

describe("scoresDeltaFromReport", () => {
  it("promotes report strengths, growth, gaps, and appetite without world_model_delta", () => {
    const delta = scoresDeltaFromReport(
      scoreReport({
        world_model_delta: undefined,
        strengths: ["clear definitions", "worked examples"],
        growth_areas: ["edge cases"],
        suggestions: ["Upload more worked examples"],
        gap_analysis: {
          summary: "thin transfer",
          gaps: [{ title: "Transfer to new domains", proof_of_work: "none", severity: "medium", suggested_repair: "try" }],
          next_steps: { directions: ["Practice transfer"], events: ["tool_decision"] },
        },
      }),
      "verification",
    );
    expect(delta.scores_snapshot?.verification_score).toBe(70);
    expect(delta.scores_snapshot?.ghc_score).toBe(40);
    expect(delta.learning_profile?.strengths).toEqual(
      expect.arrayContaining(["clear definitions", "worked examples"]),
    );
    expect(delta.learning_profile?.friction_patterns).toEqual(
      expect.arrayContaining(["edge cases"]),
    );
    expect(delta.exploration?.blind_spots).toEqual(
      expect.arrayContaining(["Transfer to new domains"]),
    );
    expect(delta.evidence_appetite?.want_more).toEqual(
      expect.arrayContaining(["tool_decision", "Practice transfer", "Upload more worked examples"]),
    );
  });

  it("merges report strengths with world_model_delta strengths", () => {
    const delta = scoresDeltaFromReport(scoreReport(), "verification");
    expect(delta.learning_profile?.strengths).toEqual(
      expect.arrayContaining(["definitions"]),
    );
  });
});

describe("subject normalization", () => {
  it("prefers guest over user when both present", () => {
    const n = normalizeSubject({ user_id: "u1", guest_user_id: "g1" });
    expect(n.subject_guest_user_id).toBe("g1");
    expect(n.subject_user_id).toBeNull();
  });

  it("subjectFromAuthAndParticipants prioritizes participant override", () => {
    expect(
      subjectFromAuthAndParticipants({
        authUserId: "owner",
        participantUserId: "learner",
      }),
    ).toEqual({ user_id: "learner" });
    expect(
      subjectFromAuthAndParticipants({
        authGuestUserId: "g-auth",
        participantGuestUserId: "g-part",
      }),
    ).toEqual({ guest_user_id: "g-part" });
  });
});

describe("resolveEvaluationSubject", () => {
  it("omitted ids default to auth user UUID", () => {
    const s = resolveEvaluationSubject(auth({ user_id: "me-user" }), {});
    expect(s).toEqual({ user_id: "me-user" });
  });

  it("explicit user_id of self is accepted", () => {
    const s = resolveEvaluationSubject(auth({ user_id: "me-user" }), {
      user_id: "me-user",
    });
    expect(s).toEqual({ user_id: "me-user" });
  });

  it("subject=me token is ignored; foreign user_id still blocked for non-admin", () => {
    const s = resolveEvaluationSubject(auth({ user_id: "me-user", is_org_admin: false }), {
      subject: "me",
      user_id: "other-user",
    });
    expect(s).toEqual({ user_id: "me-user" });
  });

  it("non-admin cannot inspect other users", () => {
    const s = resolveEvaluationSubject(auth({ user_id: "me-user", is_org_admin: false }), {
      user_id: "other-user",
    });
    expect(s).toEqual({ user_id: "me-user" });
  });

  it("org admin can inspect guest/user", () => {
    const guest = resolveEvaluationSubject(auth({ is_org_admin: true }), {
      guest_user_id: "g-99",
    });
    expect(guest).toEqual({ guest_user_id: "g-99" });
    const user = resolveEvaluationSubject(auth({ is_org_admin: true }), {
      user_id: "u-99",
    });
    expect(user).toEqual({ user_id: "u-99" });
  });

  it("workspace owner can inspect guest/user without org admin", () => {
    const guest = resolveEvaluationSubject(
      auth({ user_id: "owner", is_org_admin: false }),
      { guest_user_id: "g-owner-target" },
      { isWorkspaceOwner: true },
    );
    expect(guest).toEqual({ guest_user_id: "g-owner-target" });
    const user = resolveEvaluationSubject(
      auth({ user_id: "owner", is_org_admin: false }),
      { user_id: "learner-z" },
      { isWorkspaceOwner: true },
    );
    expect(user).toEqual({ user_id: "learner-z" });
  });
});

describe("LWM store (mock supabase)", () => {
  it("loads empty model when none saved", async () => {
    const db = createLearnerStateMockDb();
    const { id, model } = await loadLearningWorldModel(db, "ws-1", { user_id: "u1" });
    expect(id).toBeNull();
    expect(model.workspace_id).toBe("ws-1");
    expect(model.subject?.user_id).toBe("u1");
  });

  it("saves, merges deltas, and isolates subjects", async () => {
    const db = createLearnerStateMockDb();
    await saveLearningWorldModel(
      db,
      "ws-1",
      emptyLearningWorldModel("ws-1", { user_id: "alice" }),
      { user_id: "alice" },
    );
    await applyLearningWorldModelDelta(
      db,
      "ws-1",
      {
        scores_snapshot: {
          verification_score: 55,
          augmentation_score: null,
          optimization_score: null,
          ghc_score: 10,
        },
      },
      { user_id: "alice" },
    );
    await applyLearningWorldModelDelta(
      db,
      "ws-1",
      {
        scores_snapshot: {
          verification_score: 90,
          augmentation_score: null,
          optimization_score: null,
          ghc_score: 80,
        },
      },
      { user_id: "bob" },
    );

    const alice = await loadLearningWorldModel(db, "ws-1", { user_id: "alice" });
    const bob = await loadLearningWorldModel(db, "ws-1", { user_id: "bob" });
    expect(alice.model.scores_snapshot.verification_score).toBe(55);
    expect(bob.model.scores_snapshot.verification_score).toBe(90);
    expect(alice.id).not.toBe(bob.id);
  });
});

describe("knowledge config store (mock supabase)", () => {
  it("inserts snapshots and loads latest + trajectory with range filter", async () => {
    const db = createLearnerStateMockDb();
    const subject = { user_id: "u1" };
    for (let i = 0; i < 4; i++) {
      const emb = encodeKnowledgeConfig({
        workspaceId: "ws-t",
        powRows: [
          {
            proof_of_work_type: "tool",
            timestamp_ms: 1_000_000 + i * 60_000,
            metadata: {},
          },
        ],
        asOfMs: 1_000_000 + i * 60_000,
        worldModel: emptyLearningWorldModel("ws-t", subject),
      });
      const { id } = await insertKnowledgeConfigSnapshot(db, {
        workspaceId: "ws-t",
        subject,
        embedding: emb,
        trigger: "score",
      });
      expect(id).toBeTruthy();
    }

    const latest = await loadLatestKnowledgeConfig(db, "ws-t", subject);
    expect(latest).not.toBeNull();
    expect(latest!.as_of_ms).toBe(1_000_000 + 3 * 60_000);
    expect(isKnowledgeConfigVector(latest!.vector)).toBe(true);

    const mid = await loadKnowledgeConfigTrajectory(db, {
      workspaceId: "ws-t",
      subject,
      fromMs: 1_000_000 + 60_000,
      toMs: 1_000_000 + 2 * 60_000,
      maxPoints: 50,
    });
    expect(mid).toHaveLength(2);
    expect(mid[0].as_of_ms).toBeLessThanOrEqual(mid[1].as_of_ms);

    const all = await loadKnowledgeConfigTrajectory(db, {
      workspaceId: "ws-t",
      subject,
      maxPoints: 50,
    });
    expect(all).toHaveLength(4);
    expect(trajectoryPathLength(all)).toBeGreaterThanOrEqual(0);
    expect(projectTrajectory2D(all)).toHaveLength(4);
  });

  it("does not leak trajectories across subjects", async () => {
    const db = createLearnerStateMockDb();
    const embA = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [{ proof_of_work_type: "tool", timestamp_ms: 1, metadata: {} }],
      asOfMs: 1,
    });
    const embB = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [
        { proof_of_work_type: "eeg", timestamp_ms: 2, device_name: "m", metadata: {} },
        { proof_of_work_type: "screen", timestamp_ms: 3, metadata: {} },
      ],
      asOfMs: 3,
    });
    await insertKnowledgeConfigSnapshot(db, {
      workspaceId: "ws",
      subject: { user_id: "a" },
      embedding: embA,
      trigger: "score",
    });
    await insertKnowledgeConfigSnapshot(db, {
      workspaceId: "ws",
      subject: { user_id: "b" },
      embedding: embB,
      trigger: "score",
    });

    const trajA = await loadKnowledgeConfigTrajectory(db, {
      workspaceId: "ws",
      subject: { user_id: "a" },
    });
    const trajB = await loadKnowledgeConfigTrajectory(db, {
      workspaceId: "ws",
      subject: { user_id: "b" },
    });
    expect(trajA).toHaveLength(1);
    expect(trajB).toHaveLength(1);
    expect(trajA[0].vector).not.toEqual(trajB[0].vector);
  });

  it("skips invalid vector insert", async () => {
    const db = createLearnerStateMockDb();
    const bad = encodeKnowledgeConfig({
      workspaceId: "ws",
      powRows: [],
      asOfMs: 1,
    });
    bad.vector = [1, 2, 3]; // wrong dim
    const { id } = await insertKnowledgeConfigSnapshot(db, {
      workspaceId: "ws",
      subject: { user_id: "u" },
      embedding: bad,
      trigger: "recompute",
    });
    expect(id).toBeNull();
    expect(db._state.snapshots).toHaveLength(0);
  });
});

describe("updateLearnerStateAfterScore integration", () => {
  it("merges world_model_delta, writes LWM, and snapshots knowledge config", async () => {
    const db = createLearnerStateMockDb();
    const result = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws-score",
      auth: auth({ user_id: "learner-1" }),
      report: scoreReport({ score: 72, vertical: "verification" }),
      vertical: "verification",
      proofOfWork: [
        {
          type: "tool",
          block_id: "b1",
          timestamp_ms: 2_000_000,
          tool_name: "notebook",
          tool_action: "run_cell",
          metadata: {},
        },
        {
          type: "tool",
          block_id: "b1",
          timestamp_ms: 2_030_000,
          tool_name: "speech",
          metadata: { system: 2, submit: true },
        },
      ],
      totalBlocks: 5,
      trigger: "score",
    });

    expect(result.lwmId).toBeTruthy();
    expect(result.worldModel.scores_snapshot.verification_score).toBe(72);
    expect(result.worldModel.evidence_appetite.want_more).toContain("decision_rationale");
    expect(result.worldModel.inferred_goal.text).toContain("linear algebra");
    expect(result.knowledgeConfig?.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(result.knowledgeConfig?.dim).toBe(KNOWLEDGE_CONFIG_DIM);
    expect(isKnowledgeConfigVector(result.knowledgeConfig!.vector)).toBe(true);
    expect(result.knowledgeConfig!.confidence).toBeGreaterThan(0);

    expect(db._state.lwm).toHaveLength(1);
    expect(db._state.snapshots).toHaveLength(1);
    expect(db._state.snapshots[0].trigger).toBe("score");
    expect(db._state.snapshots[0].subject_user_id).toBe("learner-1");
  });

  it("accumulates scores across verticals and moves embedding", async () => {
    const db = createLearnerStateMockDb();
    const pow = [
      { type: "tool", timestamp_ms: 1000, metadata: {} },
      { type: "tool", timestamp_ms: 5000, metadata: {} },
      { type: "screen", timestamp_ms: 9000, metadata: {} },
    ];

    const v1 = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws",
      auth: auth({ user_id: "u" }),
      report: scoreReport({
        score: 40,
        vertical: "verification",
        ghc_score: 10,
        world_model_delta: {
          scores_snapshot: {
            verification_score: 40,
            augmentation_score: null,
            optimization_score: null,
            ghc_score: 10,
          },
        },
      }),
      vertical: "verification",
      proofOfWork: pow,
    });

    const powLater = [
      { type: "tool", timestamp_ms: 100_000, metadata: {} },
      { type: "tool", timestamp_ms: 105_000, metadata: {} },
      { type: "screen", timestamp_ms: 109_000, metadata: {} },
    ];
    const v2 = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws",
      auth: auth({ user_id: "u" }),
      report: scoreReport({
        score: 85,
        vertical: "augmentation",
        ghc_score: 45,
        workspace_goal: "Explain linear algebra bases",
        world_model_delta: {
          evidence_appetite: { want_more: ["practice_set"], saturated: ["tool_crud_events"] },
        },
      }),
      vertical: "augmentation",
      proofOfWork: powLater,
    });

    expect(v2.worldModel.scores_snapshot.verification_score).toBe(40);
    expect(v2.worldModel.scores_snapshot.augmentation_score).toBe(85);
    expect(db._state.snapshots).toHaveLength(2);
    expect(l2Distance(v1.knowledgeConfig!.vector, v2.knowledgeConfig!.vector)).toBeGreaterThan(0);

    const latest = await loadLatestKnowledgeConfig(db, "ws", { user_id: "u" });
    expect(latest!.as_of_ms).toBe(v2.knowledgeConfig!.as_of_ms);
    expect(latest!.vector).toEqual(v2.knowledgeConfig!.vector);
  });

  it("scopes guest participants separately from owners", async () => {
    const db = createLearnerStateMockDb();
    const pow = [{ type: "tool", timestamp_ms: 1, metadata: {} }];

    await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws",
      auth: auth({ user_id: "owner", is_org_admin: true }),
      report: scoreReport({ score: 30 }),
      vertical: "verification",
      participantGuestUserId: "guest-42",
      proofOfWork: pow,
    });

    await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws",
      auth: auth({ user_id: "owner" }),
      report: scoreReport({ score: 95 }),
      vertical: "verification",
      proofOfWork: pow,
    });

    const guest = await loadLearningWorldModel(db, "ws", { guest_user_id: "guest-42" });
    const owner = await loadLearningWorldModel(db, "ws", { user_id: "owner" });
    expect(guest.model.scores_snapshot.verification_score).toBe(30);
    expect(owner.model.scores_snapshot.verification_score).toBe(95);
    expect(db._state.lwm).toHaveLength(2);
    expect(db._state.snapshots).toHaveLength(2);
  });
});
