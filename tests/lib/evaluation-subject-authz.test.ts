import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  canAccessWorkspaceEval,
  canInspectOtherSubjects,
  EVAL_SUBJECT_SELF_WRITE_TABLES,
  formatEvalSubjectLabel,
  resolveEvalPersistenceClientMode,
  resolveEvaluationSubject,
  resolveScoreParticipantIds,
} from "@/lib/agent-v2/evaluation-subject";
import {
  insertEvalRunHistory,
  listEvalRunHistory,
  resolveHistorySubjectScope,
} from "@/lib/agent-v2/eval-run-history-store";
import { updateLearnerStateAfterScore } from "@/lib/agent-v2/learner-state-engine";
import { createLearnerStateMockDb } from "../helpers/mock-supabase-learner-state";
import type { VerticalScoreReport } from "@/lib/agent-v2/performance-report";
import type { AuthContext } from "@/lib/agent-v2/types";
import { readFileSync } from "node:fs";

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
    workspace_goal: "Goal",
    ghc_score: 40,
    ghc_confidence: "medium",
    marker_scores: [{ id: "m1", label: "M", score: 80, rationale: "ok" }],
    summary: "ok",
    strengths: [],
    growth_areas: [],
    gap_analysis: {
      summary: "gaps",
      gaps: [
        {
          title: "g",
          proof_of_work: "p",
          severity: "low",
          suggested_repair: "r",
        },
      ],
      next_steps: { directions: [], events: [] },
    },
    suggestions: [],
    confidence: "developing",
    ...overrides,
  };
}

describe("canAccessWorkspaceEval", () => {
  it("allows owner on private workspace", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "owner",
        workspaceOwnerId: "owner",
        isGroup: false,
      }),
    ).toEqual({ allowed: true, isOwner: true });
  });

  it("denies non-owner on private workspace", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "member",
        workspaceOwnerId: "owner",
        isGroup: false,
      }),
    ).toEqual({ allowed: false, isOwner: false });
  });

  it("allows non-owner on group workspace (self-eval path)", () => {
    expect(
      canAccessWorkspaceEval({
        callerUserId: "member",
        workspaceOwnerId: "owner",
        isGroup: true,
      }),
    ).toEqual({ allowed: true, isOwner: false });
  });
});

describe("canInspectOtherSubjects + resolveScoreParticipantIds", () => {
  it("owners and org admins can inspect; members cannot", () => {
    expect(canInspectOtherSubjects({ isWorkspaceOwner: true })).toBe(true);
    expect(canInspectOtherSubjects({ isOrgAdmin: true })).toBe(true);
    expect(canInspectOtherSubjects({})).toBe(false);
  });

  it("non-owner score always targets self even if body has other ids", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "me" }),
      isWorkspaceOwner: false,
      requestedUserId: "other",
      requestedGuestUserId: "g1",
    });
    expect(r.participantUserId).toBeNull();
    expect(r.participantGuestUserId).toBeNull();
    expect(r.subject).toEqual({ user_id: "me" });
  });

  it("owner can target guest UUID for score", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "owner" }),
      isWorkspaceOwner: true,
      requestedGuestUserId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(r.participantGuestUserId).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(r.participantUserId).toBeNull();
    expect(r.subject).toEqual({
      guest_user_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
  });

  it("owner can target registered user for score", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "owner" }),
      isWorkspaceOwner: true,
      requestedUserId: "learner-42",
    });
    expect(r.participantUserId).toBe("learner-42");
    expect(r.subject).toEqual({ user_id: "learner-42" });
  });

  it("guest id wins over user id when both requested by owner", () => {
    const r = resolveScoreParticipantIds({
      auth: auth({ user_id: "owner" }),
      isWorkspaceOwner: true,
      requestedUserId: "learner-42",
      requestedGuestUserId: "guest-1",
    });
    expect(r.subject).toEqual({ guest_user_id: "guest-1" });
  });
});

describe("guest UUID isolation in history + score archive", () => {
  it("inserts and lists distinct user vs guest subjects without collapse", async () => {
    const db = createLearnerStateMockDb();
    const ws = "ws-isolation";
    const userId = "user-reg-1";
    const guestA = "11111111-2222-4333-8444-555555555555";
    const guestB = "66666666-7777-4888-8999-aaaaaaaaaaaa";

    const userInsert = await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: userId },
      vertical: "verification",
      report: scoreReport({ score: 50 }),
      source: "web",
    });
    const guestAInsert = await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { guest_user_id: guestA },
      vertical: "verification",
      report: scoreReport({ score: 60 }),
      source: "web",
    });
    const guestBInsert = await insertEvalRunHistory(db, {
      workspaceId: ws,
      subject: { guest_user_id: guestB },
      vertical: "augmentation",
      report: scoreReport({ score: 70, vertical: "augmentation" }),
      source: "api",
    });

    expect(userInsert.id).toBeTruthy();
    expect(guestAInsert.id).toBeTruthy();
    expect(guestBInsert.id).toBeTruthy();
    expect(userInsert.error).toBeUndefined();

    const forUser = await listEvalRunHistory(db, {
      workspaceId: ws,
      subject: { user_id: userId },
    });
    expect(forUser).toHaveLength(1);
    expect(forUser[0].subject_user_id).toBe(userId);
    expect(forUser[0].subject_guest_user_id).toBeNull();
    expect(forUser[0].score).toBe(50);

    const forGuestA = await listEvalRunHistory(db, {
      workspaceId: ws,
      subject: { guest_user_id: guestA },
    });
    expect(forGuestA).toHaveLength(1);
    expect(forGuestA[0].subject_guest_user_id).toBe(guestA);
    expect(forGuestA[0].subject_user_id).toBeNull();
    expect(forGuestA[0].score).toBe(60);

    // Non-owner scope cannot widen to other subjects.
    const memberScope = resolveHistorySubjectScope({
      authUserId: userId,
      isWorkspaceOwner: false,
      requestedGuestUserIds: [guestA, guestB],
    });
    expect(memberScope.restricted).toBe(true);
    expect(memberScope.subject).toEqual({ user_id: userId });
    expect(memberScope.guestUserIds).toBeUndefined();

    // Owner cohort of both guests.
    const ownerScope = resolveHistorySubjectScope({
      authUserId: "owner",
      isWorkspaceOwner: true,
      requestedGuestUserIds: [guestA, guestB],
    });
    expect(ownerScope.restricted).toBe(false);
    const cohort = await listEvalRunHistory(db, {
      workspaceId: ws,
      guestUserIds: ownerScope.guestUserIds,
    });
    expect(cohort).toHaveLength(2);
    expect(new Set(cohort.map((r) => r.subject_guest_user_id))).toEqual(
      new Set([guestA, guestB]),
    );
  });

  it("score path archives under participant guest, not caller user", async () => {
    const db = createLearnerStateMockDb();
    const guestId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
    const result = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws-score-guest",
      auth: auth({ user_id: "owner-user" }),
      report: scoreReport({ score: 88 }),
      vertical: "verification",
      participantGuestUserId: guestId,
      historySource: "web",
      proofOfWork: [{ type: "tool", tool_name: "editor", timestamp_ms: Date.now() }],
      totalBlocks: 2,
    });

    expect(result.evalRunHistoryId).toBeTruthy();
    expect(result.evalRunHistoryError).toBeNull();

    const asOwnerSelf = await listEvalRunHistory(db, {
      workspaceId: "ws-score-guest",
      subject: { user_id: "owner-user" },
    });
    expect(asOwnerSelf).toHaveLength(0);

    const asGuest = await listEvalRunHistory(db, {
      workspaceId: "ws-score-guest",
      subject: { guest_user_id: guestId },
    });
    expect(asGuest).toHaveLength(1);
    expect(asGuest[0].score).toBe(88);
    expect(asGuest[0].subject_guest_user_id).toBe(guestId);
    expect(asGuest[0].report.score).toBe(88);
  });

  it("score path archives under target user when owner scores member", async () => {
    const db = createLearnerStateMockDb();
    const memberId = "member-learner";
    const result = await updateLearnerStateAfterScore({
      supabase: db,
      workspaceId: "ws-score-member",
      auth: auth({ user_id: "owner-user" }),
      report: scoreReport({ score: 42, vertical: "optimization" }),
      vertical: "optimization",
      participantUserId: memberId,
      historySource: "web",
    });

    expect(result.evalRunHistoryId).toBeTruthy();

    const memberHistory = await listEvalRunHistory(db, {
      workspaceId: "ws-score-member",
      subject: { user_id: memberId },
    });
    expect(memberHistory).toHaveLength(1);
    expect(memberHistory[0].vertical).toBe("optimization");
    expect(memberHistory[0].score).toBe(42);

    const ownerHistory = await listEvalRunHistory(db, {
      workspaceId: "ws-score-member",
      subject: { user_id: "owner-user" },
    });
    expect(ownerHistory).toHaveLength(0);
  });
});

describe("formatEvalSubjectLabel", () => {
  it("distinguishes guest UUIDs from users", () => {
    expect(formatEvalSubjectLabel({ guest_user_id: "abcd1234-ef00" })).toContain("Guest");
    expect(formatEvalSubjectLabel({ user_id: "user-xyz" })).toContain("User");
    expect(formatEvalSubjectLabel({})).toBe("Unknown subject");
  });
});

describe("resolveEvalPersistenceClientMode + subject self-write RLS", () => {
  it("requires privileged client only after access granted", () => {
    expect(resolveEvalPersistenceClientMode({ allowed: true })).toBe("privileged");
    expect(resolveEvalPersistenceClientMode({ allowed: false })).toBe("deny");
  });

  it("ships migration allowing subject_user_id=auth.uid() INSERT on learner tables", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260720120000_eval_subject_self_write_rls.sql",
      ),
      "utf8",
    );
    for (const table of EVAL_SUBJECT_SELF_WRITE_TABLES) {
      expect(migration).toContain(table);
    }
    expect(migration).toContain("subject_user_id = auth.uid()");
    expect(migration).toContain("Subjects write own eval run history");
    expect(migration).toContain("Subjects write own learning world models");
    expect(migration).toContain("Subjects write own knowledge config snapshots");
    expect(migration).toContain("is_group = true");
    // Must not allow arbitrary guest writes as the caller (guest rows stay owner/service).
    expect(migration).toContain("subject_guest_user_id IS NULL");
  });

  it("legacy owner-only RLS is documented as insufficient alone", () => {
    const legacy = readFileSync(
      join(process.cwd(), "supabase/migrations/20260719180000_eval_run_history.sql"),
      "utf8",
    );
    // Original migration: owners FOR ALL + subjects SELECT-only — no subject INSERT.
    expect(legacy).toContain("Workspace owners manage eval run history");
    expect(legacy).toContain("Subjects read own eval run history");
    expect(legacy).not.toContain("Subjects write own eval run history");
  });
});

describe("Knowledge eval UI + web routes structural", () => {
  it("performance-report uses privileged client after canAccessWorkspaceEval", () => {
    const web = readFileSync(
      join(process.cwd(), "app/api/workspace/performance-report/route.ts"),
      "utf8",
    );
    expect(web).toContain("canAccessWorkspaceEval");
    expect(web).toContain("resolveEvalPersistenceClientMode");
    expect(web).toContain("createAdminClient");
    expect(web).toContain("resolveScoreParticipantIds");
    expect(web).toContain("eval_history_saved");
    expect(web).toContain("eval_run_history_error");
    expect(web).toContain("updateLearnerStateAfterScore");
    expect(web).toContain("participantUserId");
    expect(web).toContain("is_group");
    // Must NOT hard-require plan.user_id === user.id only.
    expect(web).not.toMatch(/plan\.user_id !== user\.id/);
  });

  it("eval-history uses privileged client after authz", () => {
    const web = readFileSync(
      join(process.cwd(), "app/api/workspace/eval-history/route.ts"),
      "utf8",
    );
    expect(web).toContain("canAccessWorkspaceEval");
    expect(web).toContain("resolveEvalPersistenceClientMode");
    expect(web).toContain("createAdminClient");
    expect(web).toContain("isWorkspaceOwner");
    expect(web).toContain("resolveEvaluationSubject");
    expect(web).toContain("is_group");
  });

  it("panel always runs evals for current user (no learner picker)", () => {
    const panel = readFileSync(
      join(process.cwd(), "components/WorkspacePerformancePanel.tsx"),
      "utf8",
    );
    // No multi-learner subject picker on Eval tab.
    expect(panel).not.toContain("data-eval-subject-picker");
    expect(panel).not.toContain("subjectFocus");
    expect(panel).not.toContain("performanceEvalSubjectLabel");
    // History uses authenticated unique user_id (not guest targeting, not me-token).
    expect(panel).toContain('params.set("user_id", currentUserId)');
    expect(panel).not.toContain('params.set("guest_user_id"');
    expect(panel).not.toContain('params.set("subject", "me")');
    expect(panel).toContain("data-eval-self-only");
    expect(panel).toContain("scoreSubjectBody");
    expect(panel).toContain("eval_history_saved");
    expect(panel).toContain("data-eval-save-warning");
    expect(panel).toContain("formatEvalSubjectLabel");
    expect(panel).toContain("isGroup");
    // Live scorecard from response.report — not only history reload.
    expect(panel).toContain("setLiveReport");
    expect(panel).toContain("liveReport");
    expect(panel).toContain("data-eval-scorecard");
    expect(panel).toContain("result.report");
    // Score POST must not inject other-user / guest targeting from this UI.
    expect(panel).toContain("const scoreSubjectBody = useMemo(() => ({} as Record<string, never>), [])");
    // scoreSubjectBody is spread into the POST body but must stay empty (self-only).
    expect(panel).toContain("...scoreSubjectBody");
    expect(panel).not.toMatch(/scoreSubjectBody[\s\S]{0,200}user_id/);
    expect(panel).not.toMatch(/return \{\s*user_id:/);
    expect(panel).not.toMatch(/return \{\s*guest_user_id:/);
  });

  it("Eval tab i18n copy is always-self and uses user not learner", () => {
    const en = readFileSync(join(process.cwd(), "messages/en.json"), "utf8");
    const messages = JSON.parse(en) as {
      planView?: Record<string, string>;
    };
    const planView = messages.planView ?? {};
    expect(planView.performanceEvalRoleOwner).toBeTruthy();
    expect(planView.performanceEvalRoleOwner).not.toMatch(/other learners/i);
    expect(planView.performanceEvalRoleOwner).not.toMatch(/\blearner(s)?\b/i);
    expect(planView.performanceEvalRoleOwner).toMatch(/own proof of work/i);
    expect(planView.performanceScoreHint).toBeTruthy();
    expect(planView.performanceScoreHint).not.toMatch(/for a learner/i);
    expect(planView.performanceScoreHint).not.toMatch(/\blearner(s)?\b/i);
    expect(planView.performanceScoreHint).toMatch(/your own proof of work/i);
    expect(planView.performanceEvalSubjectLabel).toBe("User");
    expect(planView.performanceEvalSubjectAllHint || "").not.toMatch(/\blearner(s)?\b/i);
    // Panel still binds these keys for the live role/hint UI.
    const panel = readFileSync(
      join(process.cwd(), "components/WorkspacePerformancePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("performanceEvalRoleOwner");
    expect(panel).toContain("performanceScoreHint");
  });

  it("v3 score routes allow workspace owner participant targeting", () => {
    for (const rel of [
      "app/api/v3/eval/workspaces/[id]/verification-score/route.ts",
      "app/api/v3/eval/workspaces/[id]/augmentation-score/route.ts",
      "app/api/v3/eval/workspaces/[id]/optimization-score/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).toContain("resolveScoreParticipantIds");
      expect(src).toContain("isWorkspaceOwner");
    }
  });

  it("writes authz evidence snapshot", async () => {
    const evidence = {
      canAccess: {
        ownerPrivate: canAccessWorkspaceEval({
          callerUserId: "o",
          workspaceOwnerId: "o",
          isGroup: false,
        }),
        memberPrivate: canAccessWorkspaceEval({
          callerUserId: "m",
          workspaceOwnerId: "o",
          isGroup: false,
        }),
        memberGroup: canAccessWorkspaceEval({
          callerUserId: "m",
          workspaceOwnerId: "o",
          isGroup: true,
        }),
      },
      ownerTargetGuest: resolveScoreParticipantIds({
        auth: auth({ user_id: "o" }),
        isWorkspaceOwner: true,
        requestedGuestUserId: "guest-uuid-1",
      }),
      memberCannotTarget: resolveScoreParticipantIds({
        auth: auth({ user_id: "m" }),
        isWorkspaceOwner: false,
        requestedUserId: "someone-else",
      }),
    };
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, "eval-subject-authz.json"), JSON.stringify(evidence, null, 2));
    expect(evidence.canAccess.memberGroup.allowed).toBe(true);
    expect(evidence.ownerTargetGuest.subject).toEqual({ guest_user_id: "guest-uuid-1" });
    expect(evidence.memberCannotTarget.subject).toEqual({ user_id: "m" });
  });
});
