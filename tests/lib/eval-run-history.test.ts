import { describe, expect, it } from "vitest";
import { createLearnerStateMockDb } from "../helpers/mock-supabase-learner-state";
import {
  insertEvalRunHistory,
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "@/lib/pow-api/eval-run-history-store";
import { updateLearnerStateAfterScore } from "@/lib/pow-api/learner-state-engine";
import type { VerticalScoreReport } from "@/lib/pow-api/performance-report";
import type { AuthContext } from "@/lib/pow-api/types";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SCRATCH =
  process.env.EVAL_HISTORY_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-c2d29882ba5e/implementer";

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
    marker_scores: [
      { id: "m1", label: "Bases", score: 80, rationale: "Solid" },
    ],
    summary: "Solid coverage",
    strengths: ["definitions"],
    growth_areas: ["proofs"],
    gap_analysis: {
      summary: "Need deeper proofs",
      gaps: [
        {
          title: "Proof depth",
          proof_of_work: "No formal write-ups",
          severity: "medium",
          suggested_repair: "Write one short proof",
        },
      ],
      next_steps: { directions: ["Practice proofs"], events: [] },
    },
    suggestions: ["Practice proofs"],
    confidence: "developing",
    ...overrides,
  };
}

describe("eval_run_history migration surfaces", () => {
  it("ships migration defining eval_run_history with subject columns", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260719180000_eval_run_history.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE public.eval_run_history");
    expect(migration).toContain("subject_user_id");
    expect(migration).toContain("subject_guest_user_id");
    expect(migration).toContain("report jsonb");
    expect(migration).toContain("vertical");
  });
});

describe("insertEvalRunHistory + listEvalRunHistory", () => {
  it("keeps multiple runs for same workspace×subject ordered by time desc", async () => {
    const db = createLearnerStateMockDb();
    const ws = "ws-1";
    const subject = { user_id: "learner-a" };

    const r1 = await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject,
      vertical: "verification",
      report: scoreReport({ score: 60, vertical: "verification" }),
      ranAt: "2026-07-01T10:00:00.000Z",
      source: "test",
    });
    const r2 = await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject,
      vertical: "verification",
      report: scoreReport({ score: 80, vertical: "verification" }),
      ranAt: "2026-07-02T10:00:00.000Z",
      source: "test",
    });

    expect(r1.id).toBeTruthy();
    expect(r2.id).toBeTruthy();
    expect(r1.id).not.toBe(r2.id);

    const listed = await listEvalRunHistory(db, {
      workspaceId: ws,
      subject,
    });
    expect(listed).toHaveLength(2);
    expect(listed[0].score).toBe(80);
    expect(listed[1].score).toBe(60);
    expect(listed[0].report.gap_analysis.summary).toBe("Need deeper proofs");
    expect(listed[0].report.vertical).toBe("verification");
  });

  it("list by workspace returns all subjects; list by subject filters", async () => {
    const db = createLearnerStateMockDb();
    const ws = "ws-group";

    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "user-a" },
      vertical: "verification",
      report: scoreReport({ score: 55 }),
      ranAt: "2026-07-03T10:00:00.000Z",
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "user-b" },
      vertical: "augmentation",
      report: scoreReport({ score: 66, vertical: "augmentation" }),
      ranAt: "2026-07-03T11:00:00.000Z",
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "user-c" },
      vertical: "optimization",
      report: scoreReport({ score: 77, vertical: "optimization" }),
      ranAt: "2026-07-03T12:00:00.000Z",
    });

    const all = await listEvalRunHistory(db, { workspaceId: ws, limit: 50 });
    expect(all).toHaveLength(3);
    const subjects = new Set(all.map((r) => r.subject_user_id));
    expect(subjects).toEqual(new Set(["user-a", "user-b", "user-c"]));

    const onlyA = await listEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "user-a" },
    });
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0].subject_user_id).toBe("user-a");
    expect(onlyA[0].score).toBe(55);
  });

  it("multi-user group filter returns exactly requested subjects", async () => {
    const db = createLearnerStateMockDb();
    const ws = "ws-cohort";

    for (const [uid, score] of [
      ["u1", 10],
      ["u2", 20],
      ["u3", 30],
      ["u4", 40],
    ] as const) {
      await insertEvalRunHistory(db, {
        workspaceId: ws,
        subject: { user_id: uid },
        vertical: "verification",
        report: scoreReport({ score }),
        ranAt: `2026-07-04T1${score / 10}:00:00.000Z`,
      });
    }

    const cohort = await listEvalRunHistory(db, {
      workspaceId: ws,
      userIds: ["u2", "u4"],
    });
    expect(cohort).toHaveLength(2);
    expect(new Set(cohort.map((r) => r.subject_user_id))).toEqual(new Set(["u2", "u4"]));
    expect(cohort.map((r) => r.score).sort()).toEqual([20, 40]);
  });

  it("supports guest subjects in multi filter", async () => {
    const db = createLearnerStateMockDb();
    const ws = "ws-guests";

    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { guest_user_id: "g1" },
      vertical: "verification",
      report: scoreReport({ score: 11 }),
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { guest_user_id: "g2" },
      vertical: "verification",
      report: scoreReport({ score: 22 }),
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "u1" },
      vertical: "verification",
      report: scoreReport({ score: 33 }),
    });

    const guests = await listEvalRunHistory(db, {
      workspaceId: ws,
      guestUserIds: ["g1", "g2"],
    });
    expect(guests).toHaveLength(2);
    expect(guests.every((r) => r.subject_guest_user_id)).toBe(true);
  });
});

describe("resolveHistorySubjectScope authz", () => {
  it("forces non-admins to own subject", () => {
    const scope = resolveHistorySubjectScope({
      authUserId: "me",
      isOrgAdmin: false,
      isWorkspaceOwner: false,
      requestedUserIds: ["other"],
    });
    expect(scope.restricted).toBe(true);
    expect(scope.subject).toEqual({ user_id: "me" });
    expect(scope.userIds).toBeUndefined();
  });

  it("allows workspace owners multi-user cohort", () => {
    const scope = resolveHistorySubjectScope({
      authUserId: "owner",
      isWorkspaceOwner: true,
      requestedUserIds: ["a", "b"],
    });
    expect(scope.restricted).toBe(false);
    expect(scope.userIds).toEqual(["a", "b"]);
  });

  it("allows org admins full workspace when no filter", () => {
    const scope = resolveHistorySubjectScope({
      authUserId: "admin",
      isOrgAdmin: true,
    });
    expect(scope.restricted).toBe(false);
    expect(scope.subject).toBeUndefined();
    expect(scope.userIds).toBeUndefined();
  });

  it("forces guest auth identity when non-owner", () => {
    const scope = resolveHistorySubjectScope({
      authGuestUserId: "guest-self",
      isWorkspaceOwner: false,
      requestedUserIds: ["someone"],
    });
    expect(scope.restricted).toBe(true);
    expect(scope.subject).toEqual({ guest_user_id: "guest-self" });
  });
});

describe("updateLearnerStateAfterScore persists eval history", () => {
  it("writes a history row with full report payload on successful score path", async () => {
    const db = createLearnerStateMockDb();
    const report = scoreReport({
      score: 91,
      vertical: "verification",
      gap_analysis: {
        summary: "Archive me",
        gaps: [
          {
            title: "g1",
            proof_of_work: "pow",
            severity: "high",
            suggested_repair: "fix",
          },
        ],
        next_steps: { directions: ["next"], events: [] },
      },
    });

    const result = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws-score",
      auth: auth({ user_id: "learner-x" }),
      report,
      vertical: "verification",
      proofOfWork: [
        {
          type: "tool",
          tool_name: "editor",
          timestamp_ms: Date.now(),
        },
      ],
      totalBlocks: 3,
      historySource: "api",
    });

    expect(result.evalRunHistoryId).toBeTruthy();

    const history = await listEvalRunHistory(db, {
      workspaceId: "ws-score",
      subject: { user_id: "learner-x" },
    });
    expect(history).toHaveLength(1);
    expect(history[0].vertical).toBe("verification");
    expect(history[0].score).toBe(91);
    expect(history[0].report.gap_analysis.summary).toBe("Archive me");
    expect(history[0].report.gap_analysis.gaps[0].title).toBe("g1");
    expect(history[0].report.score).toBe(91);
    expect(history[0].source).toBe("api");
    expect(history[0].ghc_score).toBe(40);
  });

  it("appends new history rows without overwriting prior runs", async () => {
    const db = createLearnerStateMockDb();
    const workspaceId = "ws-append";
    const a = auth({ user_id: "learner-y" });

    await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId,
      auth: a,
      report: scoreReport({ score: 40 }),
      vertical: "verification",
    });
    await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId,
      auth: a,
      report: scoreReport({ score: 90, vertical: "augmentation" }),
      vertical: "augmentation",
    });

    const history = await listEvalRunHistory(db, {
      workspaceId,
      subject: { user_id: "learner-y" },
    });
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.score).sort()).toEqual([40, 90]);
  });
});

describe("eval history API surfaces", () => {
  it("ships eval REST + workspace routes", () => {
    const evalRoute = readFileSync(
      join(process.cwd(), "app/api/v3/snapshot/workspaces/[id]/snapshot-history/route.ts"),
      "utf8",
    );
    const webRoute = readFileSync(
      join(process.cwd(), "app/api/workspace/snapshot-history/route.ts"),
      "utf8",
    );
    expect(evalRoute).toContain("listEvalRunHistory");
    expect(evalRoute).toContain("resolveHistorySubjectScope");
    expect(evalRoute).toContain("user_ids");
    expect(webRoute).toContain("listEvalRunHistory");
    expect(webRoute).toContain("user_ids");
  });

  it("score paths wire historySource into learner state", () => {
    const run = readFileSync(
      join(process.cwd(), "lib/pow-api/run-vertical-score.ts"),
      "utf8",
    );
    const web = readFileSync(
      join(process.cwd(), "app/api/workspace/performance-report/route.ts"),
      "utf8",
    );
    const tap = readFileSync(
      join(process.cwd(), "app/api/workspace-tap-score/performance/route.ts"),
      "utf8",
    );
    expect(run).toContain("historySource");
    expect(web).toContain('historySource: "web"');
    expect(tap).toContain('historySource: "tap"');
    expect(tap).toContain("runVerticalScore");
    expect(run).toContain("updateLearnerStateAfterScore");
  });

  it("writes ordered multi-user query evidence for API response shape", async () => {
    const db = createLearnerStateMockDb();
    const ws = "ws-evidence";
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "alice" },
      vertical: "verification",
      report: scoreReport({ score: 71 }),
      ranAt: "2026-07-10T09:00:00.000Z",
      source: "api",
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "bob" },
      vertical: "augmentation",
      report: scoreReport({ score: 62, vertical: "augmentation" }),
      ranAt: "2026-07-10T10:00:00.000Z",
      source: "api",
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "carol" },
      vertical: "optimization",
      report: scoreReport({ score: 88, vertical: "optimization" }),
      ranAt: "2026-07-10T11:00:00.000Z",
      source: "web",
    });
    await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: "alice" },
      vertical: "verification",
      report: scoreReport({ score: 79 }),
      ranAt: "2026-07-11T09:00:00.000Z",
      source: "api",
    });

    const scope = resolveHistorySubjectScope({
      authUserId: "owner",
      isWorkspaceOwner: true,
      requestedUserIds: ["alice", "bob"],
    });
    const runs = await listEvalRunHistory(db, {
      workspaceId: ws,
      userIds: scope.userIds,
      limit: 50,
    });

    // Matches GET /api/v3/snapshot/workspaces/{id}/snapshot-history response body shape.
    const body = {
      workspace_id: ws,
      is_group: true,
      scope: {
        restricted: scope.restricted,
        subject: scope.subject ?? null,
        user_ids: scope.userIds ?? null,
        guest_user_ids: scope.guestUserIds ?? null,
      },
      count: runs.length,
      runs,
    };

    expect(body.count).toBe(3);
    expect(body.runs.map((r) => r.subject_user_id).sort()).toEqual(["alice", "alice", "bob"]);
    // Newest first
    expect(body.runs[0].score).toBe(79);
    expect(body.runs[0].ran_at).toBe("2026-07-11T09:00:00.000Z");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, "snapshot-history-query.json"), JSON.stringify(body, null, 2));
  });
});
