/**
 * Shared snapshot runner / API request adapters for multi-goals.
 * Exercises parse + finalize + report payload contracts of shipped code.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  parseGoalSelectionFromBody,
  resolveEvaluatedGoals,
  fingerprintGoals,
  type GoalCatalogEntry,
} from "@/lib/pow-api/goals";
import { finalizeVerticalScoreReport } from "@/lib/pow-api/workspace-goal";
import { emptyVerticalScoreReport } from "@/lib/pow-api/performance-report";
import { scoresDeltaFromReport } from "@/lib/pow-api/learner-state-engine";
import { encodeKnowledgeConfig } from "@/lib/knowledge-config/encoder";

const ROOT = join(__dirname, "../..");

const catalogWs: GoalCatalogEntry[] = [
  { id: "wg-1", text: "Workspace success", scope: "workspace" },
];
const catalogBl: GoalCatalogEntry[] = [
  { id: "bg-1", text: "Block success", scope: "block", block_id: "b1" },
];

describe("request adapters → evaluated goals on report", () => {
  it("default omit/explicit produces evaluated goals list with scope", () => {
    const selection = parseGoalSelectionFromBody({});
    const goals = resolveEvaluatedGoals({
      selection,
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
      powRelatedBlockIds: ["b1"],
    });
    const finalized = finalizeVerticalScoreReport(
      emptyVerticalScoreReport("verification"),
      null,
      { title: "Demo" },
      "verification",
      goals,
    );
    expect(finalized.evaluated_goals.length).toBe(2);
    expect(finalized.report.evaluated_goals).toEqual(goals);
    expect(finalized.workspace_goal).toContain("Workspace success");
    expect(finalized.workspace_goal_source).toBe("multi_goals");
  });

  it("adhoc_goal produces single adhoc evaluated goal", () => {
    const selection = parseGoalSelectionFromBody({
      goal_mode: "adhoc",
      adhoc_goal: "One-off demo goal",
    });
    const goals = resolveEvaluatedGoals({
      selection,
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
    });
    const finalized = finalizeVerticalScoreReport(
      emptyVerticalScoreReport("verification"),
      null,
      {},
      "verification",
      goals,
    );
    expect(finalized.evaluated_goals).toEqual([
      { id: null, text: "One-off demo goal", scope: "adhoc", block_id: null },
    ]);
    expect(finalized.workspace_goal_source).toBe("adhoc");
  });

  it("selected goal ids produce matching evaluated set used in scoring summary", () => {
    const selection = parseGoalSelectionFromBody({
      goal_ids: ["wg-1"],
    });
    expect(selection.mode).toBe("selected");
    const goals = resolveEvaluatedGoals({
      selection,
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
    });
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe("wg-1");
    const fp = fingerprintGoals(goals);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
  });

  it("scoresDeltaFromReport promotes multi-goal summary into inferred_goal", () => {
    const goals = resolveEvaluatedGoals({
      selection: { mode: "selected", goal_ids: ["wg-1", "bg-1"] },
      workspaceGoals: catalogWs,
      blockGoals: catalogBl,
    });
    const report = {
      ...emptyVerticalScoreReport("verification"),
      score: 70,
      evaluated_goals: goals,
      workspace_goal: "Workspace success; Block success",
    };
    const delta = scoresDeltaFromReport(report, "verification");
    expect(delta.inferred_goal?.text).toMatch(/Workspace success/);
    expect(delta.inferred_goal?.source).toBe("workspace");
  });

  it("embedding path includes evaluated goal text (different goals → different vectors)", () => {
    const a = encodeKnowledgeConfig({
      workspaceId: "w",
      powRows: [{ type: "tool", timestamp_ms: 1 }],
      evaluatedGoalsText: "Alpha goal set",
    });
    const b = encodeKnowledgeConfig({
      workspaceId: "w",
      powRows: [{ type: "tool", timestamp_ms: 1 }],
      evaluatedGoalsText: "Beta goal set totally different words",
    });
    expect(a.vector).not.toEqual(b.vector);
  });
});

describe("API / MCP surface structural contracts for goal selection", () => {
  it("REST lwm-snapshot route accepts goalSelectionBody and returns evaluated_goals", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v3/snapshot/workspaces/[id]/lwm-snapshot/route.ts"),
      "utf8",
    );
    expect(src).toContain("goalSelectionBody");
    expect(src).toContain("evaluated_goals");
    expect(src).toContain("goals_fingerprint");
  });

  it("web performance-report path passes goal selection and returns evaluated_goals", () => {
    const src = readFileSync(
      join(ROOT, "app/api/workspace/performance-report/route.ts"),
      "utf8",
    );
    expect(src).toContain("goalSelectionBody");
    expect(src).toContain("evaluated_goals");
  });

  it("MCP lwm_snapshot schema documents goal_mode / adhoc_goal / goal_ids", () => {
    const src = readFileSync(
      join(ROOT, "lib/pow-api/mcp-proof-of-work-server.ts"),
      "utf8",
    );
    expect(src).toContain("goal_mode");
    expect(src).toContain("adhoc_goal");
    expect(src).toContain("goal_ids");
    expect(src).toContain("evaluated_goals");
    expect(src).toContain("goalSelectionBody");
  });

  it("runVerticalScore wires goals resolution + gate fingerprint", () => {
    const src = readFileSync(join(ROOT, "lib/pow-api/run-vertical-score.ts"), "utf8");
    expect(src).toContain("resolveEvaluatedGoals");
    expect(src).toContain("goalsFingerprint");
    expect(src).toContain("loadGoalCatalogs");
    expect(src).toContain("evaluated_goals");
  });

  it("goals CRUD routes and migration exist", () => {
    expect(existsSync(join(ROOT, "app/api/workspace/goals/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/workspace/block-goals/route.ts"))).toBe(true);
    expect(
      existsSync(join(ROOT, "supabase/migrations/20260807120000_workspace_block_goals.sql")),
    ).toBe(true);
  });
});
