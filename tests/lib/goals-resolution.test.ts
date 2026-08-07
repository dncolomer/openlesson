/**
 * Pure goal-set resolution + PoW∪goals uniqueness fingerprints.
 * Drives shipped helpers in lib/pow-api/goals.ts — no re-implementation.
 */
import { describe, expect, it } from "vitest";
import {
  blockIdsFromProofOfWork,
  fingerprintGoals,
  fingerprintPowSet,
  normalizeGoalText,
  parseGoalSelectionFromBody,
  resolveEvaluatedGoals,
  snapshotIdentityKey,
  summarizeGoalsText,
  type GoalCatalogEntry,
} from "@/lib/pow-api/goals";
import { encodeKnowledgeConfig } from "@/lib/knowledge-config/encoder";
import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";

const wsGoals: GoalCatalogEntry[] = [
  { id: "wg-1", text: "Ship API", scope: "workspace" },
  { id: "wg-2", text: "Pass certification", scope: "workspace" },
];

const blockGoals: GoalCatalogEntry[] = [
  { id: "bg-1", text: "Auth module mastery", scope: "block", block_id: "block-a" },
  { id: "bg-2", text: "DB migrations", scope: "block", block_id: "block-b" },
  { id: "bg-3", text: "Deploy pipeline", scope: "block", block_id: "block-a" },
];

describe("normalizeGoalText", () => {
  it("trims and caps length", () => {
    expect(normalizeGoalText("  hello  ")).toBe("hello");
    expect(normalizeGoalText("")).toBeNull();
    expect(normalizeGoalText(null)).toBeNull();
    expect(normalizeGoalText("x".repeat(600))!.length).toBe(500);
  });
});

describe("resolveEvaluatedGoals — default", () => {
  it("returns all workspace goals ∪ goals for PoW-related blocks", () => {
    const resolved = resolveEvaluatedGoals({
      selection: { mode: "default" },
      workspaceGoals: wsGoals,
      blockGoals,
      powRelatedBlockIds: ["block-a"],
    });
    const ids = resolved.map((g) => g.id).sort();
    expect(ids).toEqual(["bg-1", "bg-3", "wg-1", "wg-2"].sort());
    expect(resolved.every((g) => g.text.length > 0)).toBe(true);
  });

  it("excludes block goals when no PoW block links", () => {
    const resolved = resolveEvaluatedGoals({
      selection: { mode: "default" },
      workspaceGoals: wsGoals,
      blockGoals,
      powRelatedBlockIds: [],
    });
    expect(resolved.map((g) => g.id).sort()).toEqual(["wg-1", "wg-2"]);
  });

  it("handles empty catalogs", () => {
    expect(
      resolveEvaluatedGoals({
        selection: { mode: "default" },
        workspaceGoals: [],
        blockGoals: [],
        powRelatedBlockIds: ["block-a"],
      }),
    ).toEqual([]);
  });

  it("handles partial catalogs (workspace only)", () => {
    const resolved = resolveEvaluatedGoals({
      selection: { mode: "default" },
      workspaceGoals: [wsGoals[0]],
      blockGoals: [],
      powRelatedBlockIds: ["block-a"],
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0].text).toBe("Ship API");
  });
});

describe("resolveEvaluatedGoals — custom selected + adhoc", () => {
  it("selects workspace + block goal ids", () => {
    const resolved = resolveEvaluatedGoals({
      selection: { mode: "selected", goal_ids: ["wg-2", "bg-2", "missing"] },
      workspaceGoals: wsGoals,
      blockGoals,
    });
    expect(resolved.map((g) => g.id).sort()).toEqual(["bg-2", "wg-2"]);
    expect(resolved.find((g) => g.id === "bg-2")?.scope).toBe("block");
  });

  it("adhoc single NL goal", () => {
    const resolved = resolveEvaluatedGoals({
      selection: { mode: "adhoc", adhoc_goal: "  Demo readiness  " },
      workspaceGoals: wsGoals,
      blockGoals,
    });
    expect(resolved).toEqual([
      { id: null, text: "Demo readiness", scope: "adhoc", block_id: null },
    ]);
  });

  it("adhoc empty returns empty", () => {
    expect(
      resolveEvaluatedGoals({
        selection: { mode: "adhoc", adhoc_goal: "   " },
        workspaceGoals: wsGoals,
        blockGoals,
      }),
    ).toEqual([]);
  });
});

describe("fingerprints + snapshot identity", () => {
  it("stable goals fingerprint regardless of order", () => {
    const a = fingerprintGoals([
      { id: "wg-1", text: "Ship API", scope: "workspace" },
      { id: "bg-1", text: "Auth", scope: "block", block_id: "b1" },
    ]);
    const b = fingerprintGoals([
      { id: "bg-1", text: "Auth", scope: "block", block_id: "b1" },
      { id: "wg-1", text: "Ship API", scope: "workspace" },
    ]);
    expect(a).toBe(b);
  });

  it("different goals → different fingerprint", () => {
    const a = fingerprintGoals([{ id: "1", text: "A", scope: "workspace" }]);
    const b = fingerprintGoals([{ id: "1", text: "B", scope: "workspace" }]);
    expect(a).not.toBe(b);
  });

  it("stable PoW fingerprint + composite identity", () => {
    const powA = fingerprintPowSet(["p2", "p1"]);
    const powB = fingerprintPowSet(["p1", "p2"]);
    expect(powA).toBe(powB);
    const goalsFp = fingerprintGoals([
      { id: null, text: "G", scope: "adhoc" },
    ]);
    const key1 = snapshotIdentityKey({ powFingerprint: powA, goalsFingerprint: goalsFp });
    const key2 = snapshotIdentityKey({
      powFingerprint: fingerprintPowSet(["p3"]),
      goalsFingerprint: goalsFp,
    });
    expect(key1).not.toBe(key2);
    const key3 = snapshotIdentityKey({
      powFingerprint: powA,
      goalsFingerprint: fingerprintGoals([{ id: null, text: "H", scope: "adhoc" }]),
    });
    expect(key1).not.toBe(key3);
  });
});

describe("parseGoalSelectionFromBody + helpers", () => {
  it("parses default / adhoc / selected from request bodies", () => {
    expect(parseGoalSelectionFromBody({}).mode).toBe("default");
    expect(parseGoalSelectionFromBody({ adhoc_goal: "X" }).mode).toBe("adhoc");
    expect(parseGoalSelectionFromBody({ goal_ids: ["a"] }).mode).toBe("selected");
    expect(parseGoalSelectionFromBody({ goal_mode: "selected", selected_goal_ids: ["a"] }).goal_ids).toEqual([
      "a",
    ]);
  });

  it("blockIdsFromProofOfWork extracts unique block ids", () => {
    expect(
      blockIdsFromProofOfWork([
        { block_id: "a" },
        { block_id: "a" },
        { block_id: "b" },
        { block_id: null },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("summarizeGoalsText joins multi goals", () => {
    expect(
      summarizeGoalsText([
        { id: "1", text: "A", scope: "workspace" },
        { id: "2", text: "B", scope: "block" },
      ]),
    ).toBe("A; B");
  });
});

describe("knowledge-config encode includes evaluated goals", () => {
  it("two snapshots that differ only by goals produce different embedding inputs", () => {
    const wm = {
      schema_version: "lwm-v0",
      inferred_goal: { text: "base", confidence: 0.5, source: "workspace" },
      exploration: { block_coverage: [], blind_spots: [], pathways_touched: [] },
      learning_profile: {
        strengths: [],
        friction_patterns: [],
        preferred_modalities: [],
        temporal_patterns: {},
      },
      evidence_appetite: { want_more: [], saturated: [] },
      scores_snapshot: { verification_score: 50 },
    } as unknown as LearningWorldModelV0;

    const base = {
      workspaceId: "ws-1",
      totalBlocks: 3,
      powRows: [
        { type: "tool", block_id: "b1", timestamp_ms: 1, tool_name: "git" },
      ],
      worldModel: wm,
    };

    const embA = encodeKnowledgeConfig({
      ...base,
      evaluatedGoalsText: "Ship the API",
    });
    const embB = encodeKnowledgeConfig({
      ...base,
      evaluatedGoalsText: "Pass the certification exam",
    });
    expect(embA.vector).not.toEqual(embB.vector);
    // Same goals → same vector
    const embA2 = encodeKnowledgeConfig({
      ...base,
      evaluatedGoalsText: "Ship the API",
    });
    expect(embA.vector).toEqual(embA2.vector);
  });
});
