import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applySolveCommand,
  emptySolveState,
  flowByPublicToken,
  solveFlowPublicPath,
  solveRunParent,
} from "@/lib/solve-flow";
import {
  applyCalibrationCommand,
  emptyCalibrationState,
} from "@/lib/calibration-flow";
import {
  applyVerificationCommand,
  emptyVerificationState,
  acceptParticipantIdentity,
} from "@/lib/verification-flow";
import {
  isMapLearnSession,
  isSolveSession,
  parseSessionResult,
} from "@/lib/core-data-model";
import {
  isFlowArchived,
  listedAuthorFlows,
  publicInviteClaimReason,
} from "@/lib/flow-archive";
import {
  flowRunSurfaceForWorkspace,
  inviteFlowSessionOwner,
  isPlayCopyRunMetadata,
  playCopyFlowSessionHref,
  playCopyFlowSessionInsert,
  playCopyIdRunnerAcceptsMetadata,
  playCopySessionQuestions,
  playCopyVerifyStartingTopics,
} from "@/lib/map-play-data-access";
import { dashboardPlayHref } from "@/lib/dashboard-play";

const ROOT = join(__dirname, "../..");

describe("Solve flow identity claim", () => {
  it("rejects empty and duplicate identities and accepts a unique claim", () => {
    const created = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Limits",
      topic: "epsilon-delta",
      id: "sf1",
      publicToken: "stok",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.flow?.name).toBe("Limits");
    expect(created.flow?.topic).toBe("epsilon-delta");
    expect(solveFlowPublicPath(created.flow!.publicToken)).toBe("/s/stok");

    const empty = applySolveCommand(created.state, {
      type: "claim",
      flowId: "sf1",
      identity: "  ",
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.reason).toBe("empty");
    expect(acceptParticipantIdentity("  ", [])).toEqual({ ok: false, reason: "empty" });

    const first = applySolveCommand(created.state, {
      type: "claim",
      flowId: "sf1",
      identity: "  ada ",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.identity).toBe("ada");

    const duplicate = applySolveCommand(first.state, {
      type: "claim",
      flowId: "sf1",
      identity: "ada",
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.reason).toBe("duplicate");
    expect(acceptParticipantIdentity("ada", ["ada"])).toEqual({
      ok: false,
      reason: "duplicate",
    });

    const unique = applySolveCommand(first.state, {
      type: "claim",
      flowId: "sf1",
      identity: "bob",
    });
    expect(unique.ok).toBe(true);
    if (!unique.ok) return;
    expect(unique.identity).toBe("bob");
  });
});

describe("Solve run vs map Learn session", () => {
  it("parents a Solve run on solve_flow_id and leaves map Learn unparented", () => {
    const solveRow = { kind: "solve", solve_flow_id: "sf1" };
    const learnRow = { kind: "learn" };
    const verifyRow = { kind: "verify", verify_flow_id: "vf1" };
    expect(isSolveSession(solveRow)).toBe(true);
    expect(isMapLearnSession(learnRow)).toBe(true);
    expect(isMapLearnSession(solveRow)).toBe(false);
    expect(solveRunParent(solveRow)).toEqual({ kind: "solve", solveFlowId: "sf1" });
    expect(solveRunParent(learnRow)).toEqual({ kind: "learn", solveFlowId: null });
    expect(solveRunParent(verifyRow)).toEqual({ kind: "verify", solveFlowId: null });
    expect(parseSessionResult({ kind: "solve", projectedPolicy: null })?.kind).toBe("solve");
  });
});

describe("Solve flow schema", () => {
  it("commits owner scoping and session/region foreign keys", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261030200000_solve_flows.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.solve_flows");
    expect(sql).toContain("owner_user_id uuid not null");
    expect(sql).toContain("auth.uid() = owner_user_id");
    expect(sql).toContain("sessions_solve_flow_id_fkey");
    expect(sql).toContain("foreign key (solve_flow_id) references public.solve_flows(id)");
    expect(sql).toContain("knowledge_regions_solve_flow_id_fkey");
    expect(sql).toContain("product = any (array['verification'::text, 'calibration'::text, 'solve'::text])");
    expect(sql).toContain("kind = any (array['learn'::text, 'calibrate'::text, 'verify'::text, 'solve'::text])");
  });
});

describe("archive-not-delete flows", () => {
  it("archives Solve, Calibrate, and Verify on remove, keeps the token, hides from author lists, and refuses new public claims", () => {
    const solveCreated = applySolveCommand(emptySolveState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: "Limits",
      topic: "epsilon-delta",
      id: "sf-archive",
      publicToken: "stok-live",
    });
    expect(solveCreated.ok).toBe(true);
    if (!solveCreated.ok) return;
    const token = solveCreated.flow!.publicToken;
    expect(token).toBe("stok-live");

    const solveRemoved = applySolveCommand(solveCreated.state, {
      type: "remove",
      ownerUserId: "owner-1",
      flowId: "sf-archive",
    });
    expect(solveRemoved.ok).toBe(true);
    if (!solveRemoved.ok) return;
    expect(solveRemoved.state.flows).toHaveLength(1);
    expect(solveRemoved.flow?.publicToken).toBe(token);
    expect(isFlowArchived(solveRemoved.flow)).toBe(true);
    expect(listedAuthorFlows(solveRemoved.state.flows)).toEqual([]);
    expect(flowByPublicToken(solveRemoved.state, token)?.id).toBe("sf-archive");
    const solveClaim = applySolveCommand(solveRemoved.state, {
      type: "claim",
      flowId: "sf-archive",
      identity: "ada",
    });
    expect(solveClaim.ok).toBe(false);
    if (solveClaim.ok) return;
    expect(solveClaim.reason).toBe("archived");
    expect(publicInviteClaimReason(solveRemoved.flow)).toBe("archived");

    const calCreated = applyCalibrationCommand(emptyCalibrationState(), {
      type: "create",
      ownerUserId: "owner-1",
      workspaceId: "ws-cal",
      goal: "Continuity",
      questions: ["When is a function continuous?"],
      id: "cf-archive",
      publicToken: "ctok-live",
    });
    expect(calCreated.ok).toBe(true);
    if (!calCreated.ok) return;
    const calRemoved = applyCalibrationCommand(calCreated.state, {
      type: "remove",
      ownerUserId: "owner-1",
      workspaceId: "ws-cal",
      flowId: "cf-archive",
    });
    expect(calRemoved.ok).toBe(true);
    if (!calRemoved.ok) return;
    expect(calRemoved.state.flows).toHaveLength(1);
    expect(calRemoved.flow?.publicToken).toBe("ctok-live");
    expect(listedAuthorFlows(calRemoved.state.flows)).toEqual([]);
    const calClaim = applyCalibrationCommand(calRemoved.state, {
      type: "claim",
      flowId: "cf-archive",
      identity: "ada",
    });
    expect(calClaim.ok).toBe(false);
    if (calClaim.ok) return;
    expect(calClaim.reason).toBe("archived");

    const verCreated = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "owner-1",
      workspaceId: "ws-ver",
      topic: "Series",
      questions: ["What is a series?"],
      id: "vf-archive",
      publicToken: "vtok-live",
    });
    expect(verCreated.ok).toBe(true);
    if (!verCreated.ok) return;
    const verRemoved = applyVerificationCommand(verCreated.state, {
      type: "remove",
      ownerUserId: "owner-1",
      workspaceId: "ws-ver",
      flowId: "vf-archive",
    });
    expect(verRemoved.ok).toBe(true);
    if (!verRemoved.ok) return;
    expect(verRemoved.state.flows).toHaveLength(1);
    expect(verRemoved.flow?.publicToken).toBe("vtok-live");
    expect(listedAuthorFlows(verRemoved.state.flows)).toEqual([]);
    const verClaim = applyVerificationCommand(verRemoved.state, {
      type: "claim",
      flowId: "vf-archive",
      identity: "ada",
    });
    expect(verClaim.ok).toBe(false);
    if (verClaim.ok) return;
    expect(verClaim.reason).toBe("archived");

    for (const rel of [
      "lib/solve-flow-repository.ts",
      "lib/calibration-flow-repository.ts",
      "lib/verification-flow-repository.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/\.delete\(\)/);
      expect(src).toContain("archived_at: value.flow.archivedAt");
      expect(src).toContain("listedAuthorFlows");
    }
    expect(
      readFileSync(join(ROOT, "lib/calibration-flow-repository.ts"), "utf8"),
    ).not.toContain("return state.flows.map(presentFlow)");
    expect(
      readFileSync(join(ROOT, "lib/verification-flow-repository.ts"), "utf8"),
    ).not.toContain("return state.flows.map(presentFlow)");
    const calList = readFileSync(join(ROOT, "lib/calibration-flow-repository.ts"), "utf8");
    const verList = readFileSync(join(ROOT, "lib/verification-flow-repository.ts"), "utf8");
    expect(calList).toContain("listedAuthorFlows(state.flows)");
    expect(verList).toContain("listedAuthorFlows(state.flows)");
    expect(readFileSync(join(ROOT, "components/dashboard/play-calibrate-session.tsx"), "utf8")).toContain(
      "playCopyIdRunnerAcceptsMetadata",
    );
    expect(readFileSync(join(ROOT, "app/play/verify/page.tsx"), "utf8")).toContain(
      "playCopyIdRunnerAcceptsMetadata",
    );
    expect(readFileSync(join(ROOT, "app/play/verify/page.tsx"), "utf8")).toContain(
      "getSession(sessionId)",
    );
    expect(readFileSync(join(ROOT, "app/play/verify/page.tsx"), "utf8")).toContain(
      "playCopySessionQuestions(session.metadata)",
    );
    expect(readFileSync(join(ROOT, "app/play/verify/page.tsx"), "utf8")).toContain(
      "playCopyVerifyStartingTopics",
    );
    expect(readFileSync(join(ROOT, "app/play/verify/page.tsx"), "utf8")).toContain(
      "playCopyVerifyEmbeddingFromProof",
    );
    expect(readFileSync(join(ROOT, "app/play/verify/page.tsx"), "utf8")).toContain(
      "postWorkspaceFlowEmbedding",
    );
    expect(readFileSync(join(ROOT, "components/dashboard/play-calibrate-session.tsx"), "utf8")).toContain(
      "playCopyCalibrateEmbeddingFromSounding",
    );
    expect(readFileSync(join(ROOT, "components/dashboard/play-calibrate-session.tsx"), "utf8")).toContain(
      "postWorkspaceFlowEmbedding",
    );
  });
});

describe("play-copy vs public-token session ownership", () => {
  it("parents a private run on the live flow with player owner, copy workspace, and player billing", () => {
    expect(flowRunSurfaceForWorkspace({ is_play_copy: true })).toBe("play_copy");
    expect(flowRunSurfaceForWorkspace({ ayclToken: "aycl-1" })).toBe("play_copy");
    expect(flowRunSurfaceForWorkspace({ is_play_copy: false })).toBe("invite");

    const play = playCopyFlowSessionInsert({
      flowKind: "solve",
      flowId: "sf-live",
      runnerUserId: "player-1",
      copyWorkspaceId: "copy-ws",
      blockId: "copy-block",
      topic: "epsilon-delta",
      publicToken: "stok-live",
    });
    expect(play.user_id).toBe("player-1");
    expect(play.workspace_id).toBe("copy-ws");
    expect(play.billedUserId).toBe("player-1");
    expect(play.row.user_id).toBe("player-1");
    expect(play.row.workspace_id).toBe("copy-ws");
    expect(play.row.solve_flow_id).toBe("sf-live");
    expect(play.row.kind).toBe("solve");
    expect(play.hrefForSession("sess-1")).toBe("/session?id=sess-1&solve=stok-live");

    const calibrateHref = playCopyFlowSessionHref({
      flowKind: "calibrate",
      publicToken: "ctok-live",
      copyWorkspaceId: "copy-ws",
      sessionId: "sess-cal",
    });
    expect(calibrateHref).toBe(dashboardPlayHref("calibrate", "sess-cal"));
    expect(calibrateHref).toBe("/play/calibrate?id=sess-cal");
    expect(calibrateHref).not.toMatch(/\/c\//);
    const verifyStart = playCopyFlowSessionInsert({
      flowKind: "verify",
      flowId: "vf-live",
      runnerUserId: "player-1",
      copyWorkspaceId: "copy-ws",
      topic: "Series",
      publicToken: "vtok-live",
      questions: [{ id: "q-1", text: "What is a series?" }],
    });
    const verifyHref = verifyStart.hrefForSession("sess-ver");
    expect(verifyHref).toBe(dashboardPlayHref("verify", "sess-ver"));
    expect(verifyHref).toBe("/play/verify?id=sess-ver");
    expect(verifyHref).not.toMatch(/\/v\//);
    expect(playCopySessionQuestions(verifyStart.metadata)).toEqual([
      { id: "q-1", text: "What is a series?" },
    ]);
    expect(
      playCopyVerifyStartingTopics({
        prompt: String(verifyStart.row.problem),
        questions: playCopySessionQuestions(verifyStart.metadata),
      }),
    ).toEqual([
      {
        id: "q-1",
        title: "What is a series?",
        subtitle: "Play session",
        openingQuestion: "What is a series?",
      },
    ]);
    const withQuestions = playCopyFlowSessionInsert({
      flowKind: "calibrate",
      flowId: "cf-live",
      runnerUserId: "player-1",
      copyWorkspaceId: "copy-ws",
      topic: "Continuity",
      publicToken: "ctok-live",
      questions: [{ id: "q-1", text: "When is a function continuous?" }],
    });
    expect(isPlayCopyRunMetadata(withQuestions.metadata)).toBe(true);
    expect(playCopyIdRunnerAcceptsMetadata(withQuestions.metadata)).toBe(true);
    expect(playCopySessionQuestions(withQuestions.metadata)).toEqual([
      { id: "q-1", text: "When is a function continuous?" },
    ]);
    expect(playCopyIdRunnerAcceptsMetadata({ disposable: true, play_kind: "calibrate" })).toBe(
      true,
    );

    const invite = inviteFlowSessionOwner({
      flowOwnerUserId: "author-1",
      runnerUserId: "player-1",
    });
    expect(invite.user_id).toBe("author-1");
    expect(invite.workspace_id).toBeNull();
    expect(invite.billedUserId).toBe("player-1");
    expect(
      inviteFlowSessionOwner({ flowOwnerUserId: "author-1", runnerUserId: null }).billedUserId,
    ).toBe("author-1");

    const startFlow = readFileSync(
      join(ROOT, "app/api/dashboard/maps/start-flow/route.ts"),
      "utf8",
    );
    expect(startFlow).toContain("playCopyFlowSessionInsert");
    expect(startFlow).toContain("flowRunSurfaceForWorkspace");
    expect(startFlow).toContain("ownerUserId: runnerUserId");
    const tryRoute = readFileSync(join(ROOT, "app/api/dashboard/maps/try/route.ts"), "utf8");
    expect(tryRoute).toContain("playCopyFlowSessionInsert");
    const claim = readFileSync(join(ROOT, "lib/solve-flow-repository.ts"), "utf8");
    expect(claim).toContain("inviteFlowSessionOwner");
    expect(claim).toContain("user_id: owner.user_id");
  });
});
