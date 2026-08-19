import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * Drives shipped tutoring, auth-policy, map-selection, product-intent,
 * ILE-mode, and error-envelope functions — no reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  allowCookieWorkspacePerformance,
  allowProductWorkspaceEvalAccess,
  assertWorkspacePolicy,
  ayclNonOwnerActor,
  ayclPrincipal,
  ayclSubjectId,
  cookieUserPrincipal,
  ileGuestPrincipal,
  persistableOwnerUserId,
  tokenPrincipalIsOwner,
} from "@/lib/workspace-access-policy";
import { resolveScoreParticipantIds } from "@/lib/pow-api/evaluation-subject";
import {
  applySoloThoughtMutation,
  buildTutoringIdleOutcome,
  buildTutoringSpeechOutcome,
  emptySoloThoughtLists,
  planTutoringSessionMutate,
  resolveTutoringContext,
} from "@/lib/tutoring-runtime";
import {
  nextWorkspaceMapSelection,
  emptyWorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import {
  decodePracticeLaunchIntent,
  launchPracticeHref,
  resolveProductIntent,
} from "@/lib/product-intent";
import {
  normalizeIleSessionMode,
  parseIleSessionModeWrite,
  resolveIleSessionModeFromBody,
  resolveIleSessionModeFromSession,
} from "@/lib/ile-mode";
import {
  classifyApiErrorEnvelope,
  jsonError,
} from "@/lib/api-error-envelope";
import { KNOWN_ERROR_CODES, toErrorCode } from "@/lib/api/error-codes";
import { readMapGridSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

describe("tutoring runtime (speech/idle/mutate)", () => {
  it("one helper accepts ILE vs TAP vs AYCL auth and dialog vs solo with the same outcome shape", () => {
    const cases = [
      { product: "ile" as const, modality: "dialog" as const, authKind: "cookie" as const },
      { product: "ile" as const, modality: "solo" as const, authKind: "ile" as const },
      { product: "ile" as const, modality: "dialog" as const, authKind: "aycl" as const },
      { product: "tap" as const, modality: "dialog" as const, authKind: "tap" as const },
      { product: "tap" as const, modality: "solo" as const, authKind: "tap" as const },
    ];
    for (const c of cases) {
      const ctx = resolveTutoringContext({
        ...c,
        workspaceId: "ws-1",
        sessionId: "sess-1",
      });
      const speech = buildTutoringSpeechOutcome(ctx, { event: "start", timestampMs: 1 });
      const idle = buildTutoringIdleOutcome(ctx, { idleDurationMs: 1000, timestampMs: 1 });
      const mutate = planTutoringSessionMutate(ctx, { action: "save", session: { status: "active" } });
      expect(speech.product).toBe(c.product);
      expect(speech.modality).toBe(c.modality);
      expect(speech.authKind).toBe(c.authKind);
      expect(speech.toolName).toBeTruthy();
      expect(speech.payload.type).toContain("speech");
      expect(idle.toolAction).toBe("idle_heartbeat");
      expect(idle.payload.type).toContain("idle");
      expect(mutate.action).toBe("save");
      expect(mutate.sessionPatch).toEqual({ status: "active" });
      expect(mutate.product).toBe(c.product);
    }

    const lists = emptySoloThoughtLists();
    const solo = applySoloThoughtMutation(lists, "pending", {
      type: "stash",
      text: "a thought",
      nowMs: 1,
    });
    expect(solo.rejected).toBe(false);
    expect(solo.lists.stash.length).toBe(1);

    const ileSpeech = read("app/api/workspace-ile/speech/route.ts");
    const tapSpeech = read("app/api/workspace-tap-score/speech/route.ts");
    const ileMutate = read("app/api/ile/session-mutate/route.ts");
    const ayclMutate = read("app/api/aycl/session-mutate/route.ts");
    expect(ileSpeech).toContain("buildTutoringSpeechOutcome");
    expect(tapSpeech).toContain("buildTutoringSpeechOutcome");
    expect(ileMutate).toContain("applyTutoringSessionMutate");
    expect(ayclMutate).toContain("applyTutoringSessionMutate");
    expect(read("lib/tutoring-client.ts")).toContain("buildTutoringSpeechOutcome");
    expect(read("lib/tutoring-client.ts")).toContain("TAP_SESSION_RUNTIME_PATHS.start");
  });
});

describe("workspace access policy", () => {
  it("denies unaffiliated cookie performance and refuses owner-attribution for token principals", () => {
    expect(
      allowCookieWorkspacePerformance({
        callerUserId: "stranger",
        workspaceOwnerId: "owner",
      }),
    ).toBe(false);
    expect(
      allowCookieWorkspacePerformance({
        callerUserId: "owner",
        workspaceOwnerId: "owner",
      }),
    ).toBe(true);
    expect(
      allowCookieWorkspacePerformance({
        callerUserId: "member",
        workspaceOwnerId: "owner",
        isSessionParticipant: true,
      }),
    ).toBe(true);

    const cookie = cookieUserPrincipal("stranger");
    const denied = assertWorkspacePolicy({
      principal: cookie,
      workspaceOwnerId: "owner",
      action: "score_performance",
    });
    expect(denied.ok).toBe(false);

    const aycl = ayclPrincipal({ purchaseId: "buy-1", ownerUserId: "owner" });
    expect(aycl.subjectId).toBe("aycl:buy-1");
    expect(tokenPrincipalIsOwner(aycl)).toBe(false);
    const ayclOk = assertWorkspacePolicy({
      principal: aycl,
      workspaceOwnerId: "owner",
      action: "eval",
    });
    expect(ayclOk.ok).toBe(true);
    if (ayclOk.ok) expect(ayclOk.attributeAsOwner).toBe(false);

    const ile = ileGuestPrincipal({
      guestUserId: "guest-1",
      ownerUserId: "owner",
    });
    expect("error" in ile).toBe(false);
    if (!("error" in ile)) {
      expect(ile.subjectId).toBe("guest-1");
      expect(tokenPrincipalIsOwner(ile)).toBe(false);
    }

    const requireAuth = read("lib/api/require-auth.ts");
    expect(requireAuth).not.toContain("actingUser");
    expect(requireAuth).not.toContain("ayclAccess");
    expect(requireAuth).not.toContain("ileSessionMode");
    expect(requireAuth).toContain("ayclPrincipal");
    expect(requireAuth).toContain("ileGuestPrincipal");
    expect(requireAuth).toContain("subjectId:");
    expect(requireAuth).toContain("persistUserId:");
    expect(requireAuth).toContain("persistIds");

    const productAuth = read("lib/product-workspace-auth.ts");
    expect(productAuth).not.toContain("actingUser");
    expect(productAuth).not.toMatch(/ayclAccess\?:/);
    expect(productAuth).not.toContain("user: User | { id");
    expect(productAuth).toContain("assertWorkspacePolicy");
    expect(productAuth).toContain("workspaceOwnerId");

    const perf = read("app/api/workspace-ile/performance/route.ts");
    expect(perf).toContain("requireSessionWorkspaceProofOfWorkAccess");
    expect(perf).not.toMatch(/createClient\(\)[\s\S]*getUser\(\)[\s\S]*from\("workspaces"\)/);
  });

  it("AYCL token is aycl:{purchaseId} and never scores or lists as the owner User", () => {
    const ownerId = "owner-user";
    const purchaseId = "purchase-99";
    const subject = ayclSubjectId(purchaseId);
    expect(subject).toBe("aycl:purchase-99");
    expect(subject).not.toBe(ownerId);

    const actor = ayclNonOwnerActor({ purchaseId, ownerUserId: ownerId });
    expect(actor.subjectId).toBe(subject);
    expect(actor.isOwner).toBe(false);
    expect(actor.attributeAsOwner).toBe(false);
    expect(tokenPrincipalIsOwner(actor.principal)).toBe(false);

    const policy = assertWorkspacePolicy({
      principal: actor.principal,
      workspaceOwnerId: ownerId,
      action: "score_performance",
    });
    expect(policy.ok).toBe(true);
    if (policy.ok) {
      expect(policy.subjectId).toBe(subject);
      expect(policy.attributeAsOwner).toBe(false);
    }

    expect(
      allowProductWorkspaceEvalAccess({
        isOwner: false,
        evalAllowed: false,
      }),
    ).toBe(false);

    const scored = resolveScoreParticipantIds({
      auth: {
        user_id: actor.subjectId,
        guest_user_id: null,
        organization_id: null,
        is_org_admin: false,
        key_id: "aycl-ile-performance",
        scopes: ["workspaces:read"],
      },
      isWorkspaceOwner: actor.isOwner,
      requestedUserId: ownerId,
    });
    expect(scored.participantUserId).not.toBe(ownerId);
    expect(scored.subject).not.toEqual({ user_id: ownerId });

    expect(persistableOwnerUserId(actor.principal)).toBe(ownerId);
    expect(persistableOwnerUserId(actor.principal)).not.toBe(subject);
    expect(persistableOwnerUserId(cookieUserPrincipal(ownerId))).toBe(ownerId);
    const ileGuest = ileGuestPrincipal({
      guestUserId: "guest-uuid",
      ownerUserId: ownerId,
    });
    expect("error" in ileGuest).toBe(false);
    if (!("error" in ileGuest)) {
      expect(persistableOwnerUserId(ileGuest)).toBe(ownerId);
      expect(persistableOwnerUserId(ileGuest)).not.toBe(ileGuest.subjectId);
    }

    const ayclAuth = read("lib/aycl-session-auth.ts");
    expect(ayclAuth).toContain("ayclSubjectId(purchase.id)");
    expect(ayclAuth).not.toContain("actingUser");

    const ileAuth = read("lib/ile-link-auth.ts");
    expect(ileAuth).not.toContain("actingUser");

    const policySrc = read("lib/workspace-access-policy.ts");
    expect(policySrc).not.toMatch(/if\s*\(\s*input\.ayclAccess\s*\)\s*return\s*true/);
    expect(policySrc).not.toContain("ayclAccess?:");

    const report = read("app/api/workspace/performance-report/route.ts");
    expect(report).toContain("requireProductWorkspaceEvalAuth");
    expect(report).not.toContain("resolveAyclAccess");
    expect(report).not.toContain("actingUser");
    expect(report).not.toMatch(/isWorkspaceOwner\s*=\s*[^;]*ayclAccess/);
    expect(report).toContain("const isWorkspaceOwner = accessIsOwner");
    expect(report).toContain("user_id: subjectId");
    expect(report).not.toContain("persistableOwnerUserId");
    expect(report).not.toMatch(/user_id:\s*ownerUserId/);

    const ilePerf = read("app/api/workspace-ile/performance/route.ts");
    expect(ilePerf).toContain("requireSessionWorkspaceProofOfWorkAccess");
    expect(ilePerf).toContain("ayclToken");
    expect(ilePerf).not.toContain("guardWorkspaceRoute");
    expect(ilePerf).not.toContain("resolveAyclAccess");
    expect(ilePerf).not.toContain("else if (ayclToken)");
    expect(ilePerf).not.toContain("actingUser");
    expect(ilePerf).not.toMatch(/participantUserId\s*=\s*aycl\.actingUser/);
    expect(ilePerf).not.toMatch(/user_id:\s*aycl\.actingUser/);
    const powAccess = read("lib/pow-api/workspace-session-access.ts");
    expect(powAccess).toContain("ayclToken");
    expect(powAccess).toContain("principal.subjectId");

    const goals = read("app/api/workspace/goals/route.ts");
    expect(goals).toContain("requireProductWorkspaceEvalAuth");
    expect(goals).toContain("auth.subjectId");
    expect(goals).toContain("assertWorkspacePolicy");
    expect(goals).toContain('action: "author"');
    expect(goals).not.toContain("actingUser");
    expect(goals).not.toMatch(/isOwner\s*\|\|\s*auth\.principal\.kind\s*===\s*"aycl"/);
    expect(goals).not.toMatch(/isOwner:\s*true/);

    const history = read("app/api/workspace/snapshot-history/route.ts");
    expect(history).toContain("requireProductWorkspaceEvalAuth");
    expect(history).toContain("const isWorkspaceOwner = opts.isOwner");
    expect(history).not.toMatch(/isOwner\s*\|\|\s*Boolean\(opts\.ayclAccess\)/);
    expect(history).not.toMatch(/isOwner:\s*auth\.isOwner,\s*ayclAccess/);

    const launch = read("app/api/workspace/learner-launch/route.ts");
    expect(launch).toContain("auth.persistUserId");
    expect(launch).toContain("user_id: auth.persistUserId");
    expect(launch).toContain("subject_id: auth.subjectId");
    expect(launch).not.toContain("persistableOwnerUserId");
    expect(launch).not.toMatch(/user_id:\s*auth\.subjectId/);

    const notes = read("app/api/workspace/notes/route.ts");
    expect(notes).toContain('.eq("id", workspaceId)');
    expect(notes).not.toMatch(/\.eq\("user_id",\s*subjectId\)/);

    const chapter = read("app/api/workspace/suggest-chapter-edit/route.ts");
    expect(chapter).toContain("persistUserId");
    expect(chapter).toContain("session.user_id !== persistUserId");
    expect(chapter).not.toContain("persistableOwnerUserId");
    expect(chapter).not.toMatch(/session\.user_id\s*!==\s*subjectId/);
    expect(chapter).toContain("user_id: persistUserId");
    expect(chapter).toContain("participantUserId: subjectId");
    expect(chapter).not.toMatch(/auth:\s*\{[^}]*user_id:\s*subjectId/);

    const suggest = read("app/api/workspace/suggest-blocks/route.ts");
    expect(suggest).toContain("persistUserId");
    expect(suggest).not.toContain("persistableOwnerUserId");
    expect(suggest).not.toMatch(/session\.user_id\s*!==\s*subjectId/);
    expect(suggest).not.toMatch(/plan\.user_id\s*!==\s*subjectId/);

    const welcome = read("app/api/session-chat/welcome/route.ts");
    expect(welcome).toContain("persistUserId");
    expect(welcome).toContain('.eq("user_id", persistUserId)');
    expect(welcome).not.toContain("persistableOwnerUserId");
    expect(welcome).not.toMatch(/\.eq\("user_id",\s*subjectId\)/);

    const resources = read("app/api/workspace/external-resources/route.ts");
    expect(resources).toContain("auth.persistUserId");
    expect(resources).toContain("user_id: auth.persistUserId");
    expect(resources).not.toContain("persistableOwnerUserId");
    expect(resources).not.toMatch(/user_id:\s*auth\.subjectId/);

    expect(read("lib/api/require-auth.ts")).toMatch(/persistUserId:\s*ids\.persistUserId/);
    expect(persistableOwnerUserId(actor.principal)).not.toBe(actor.subjectId);

    const libAndApi = [
      "lib/api/require-auth.ts",
      "lib/aycl-session-auth.ts",
      "lib/ile-link-auth.ts",
      "lib/product-workspace-auth.ts",
      "lib/workspace-access-policy.ts",
    ];
    for (const rel of libAndApi) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/\bactingUser\b/);
      expect(src, rel).not.toMatch(/ayclAccess\?:/);
    }
  });
});

describe("exclusive map selection + product intent", () => {
  it("commit is a single exclusive union write; clone/generator stay off the selection bus", () => {
    const writes: ReturnType<typeof nextWorkspaceMapSelection>[] = [];
    const onChange = (next: ReturnType<typeof nextWorkspaceMapSelection>) => {
      writes.push(next);
    };

    const sole = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ["only"],
    });
    onChange(sole);
    const multi = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ["a", "b"],
    });
    onChange(multi);
    const empties = nextWorkspaceMapSelection({
      type: "set_empty_cells",
      cells: [
        { row: 1, col: 2 },
        { row: 1, col: 3 },
      ],
    });
    onChange(empties);
    const wipe = nextWorkspaceMapSelection({ type: "open_block", blockId: null });
    expect(wipe).toEqual(emptyWorkspaceMapSelection());
    expect(writes.map((w) => w.kind)).toEqual(["block", "blocks", "empties"]);

    const mapSel = read("lib/workspace-map-selection.ts");
    expect(mapSel).not.toContain("commitWorkspaceMapSelection");
    expect(mapSel).not.toContain("notifyMapHostCommit");

    const grid = readMapGridSurface();
    expect(grid).not.toContain("commitWorkspaceMapSelection");
    expect(grid).toContain("onMapSelectionChange(selection)");
    expect(grid).toContain("onClonePaste");
    expect(grid).toContain("resolveClonePasteTarget");
    expect(grid).not.toContain("onSelectedBlockIdsChange");
    expect(grid).not.toContain("onEmptySelectionChange");
    expect(grid).not.toContain("onAddTargetChange");

    const view = readWorkspaceViewSurface();
    expect(view).not.toContain("shouldInterceptEmptyClickForClone");
    expect(view).toContain("onClonePaste");
    expect(view).toMatch(/handleMapSelectionChange[\s\S]*?applyMapSelectionResult\(selection\)/);

    const explore = resolveProductIntent("explore", "dialog");
    const drill = resolveProductIntent("drill", "solo");
    expect(decodePracticeLaunchIntent("explore_dialog")).toEqual(explore);
    expect(decodePracticeLaunchIntent("timed_drill").id).toBe("drill_solo");
    expect(launchPracticeHref(explore, { workspaceId: "ws", sessionId: "s1" })).toContain(
      "/session",
    );
    expect(launchPracticeHref(drill, { workspaceId: "ws", blockId: "b1" })).toContain(
      "/workspace/ws/tap",
    );

    const mapShell = read("components/block-skill-grid/map-grid-shell.tsx");
    expect(mapShell).toContain("export type MapGridShellProps");
    expect(mapShell).toContain("rail: ComponentProps");
    expect(mapShell).toContain("world: ComponentProps");
    expect(mapShell).not.toMatch(/props:\s*Record<string,\s*any>/);
    expect(mapShell).not.toContain("handleToolClick");
    expect(mapShell).not.toMatch(/Omit<\s*MapToolRailProps/);

    const gridOpsDir = join(ROOT, "lib/workspace-grid-ops");
    const ctx = read("lib/workspace-grid-ops/context.ts");
    expect(ctx).not.toMatch(/:\s*any\b/);
    for (const name of readdirSync(gridOpsDir)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(gridOpsDir, name), "utf8");
      expect(src, name).not.toContain("@ts-nocheck");
    }

    const tapFlow = read("components/tap-score/use-tap-score-flow.ts");
    expect(tapFlow).toContain("useTapScoreSession");
    expect(tapFlow).not.toContain("TapScoreFlowHost");
    expect(tapFlow).not.toMatch(/setPhase:\s*\(v:/);
    const tapClient = read("components/TapScoreClient.tsx");
    expect(tapClient).toContain("useTapScoreSession");
    expect(tapClient).not.toContain("flowHostRef");
    expect(tapClient).not.toContain("createTapScoreFlow");
    const exercise = read("components/ExerciseTapClient.tsx");
    expect(tapClient.split("\n").length).toBeLessThan(1000);
    expect(exercise.split("\n").length).toBeLessThan(1000);
    expect(exercise).toContain("postTutoringSessionStart");
    expect(read("lib/useTapSpeechProofOfWork.ts")).toContain("postTutoringSpeech");
    expect(read("lib/useTapIdleProofOfWork.ts")).toContain("postTutoringIdle");
    expect(read("components/tap-score/use-tap-score-flow.ts")).toContain("postTutoringSessionStart");
  });
});

describe("ILE mode write vs read", () => {
  it("write accepts only learning|project; read still understands legacy aliases", () => {
    expect(parseIleSessionModeWrite("project")).toBe("project");
    expect(parseIleSessionModeWrite("learning")).toBe("learning");
    expect(parseIleSessionModeWrite("exercise")).toBeNull();
    expect(parseIleSessionModeWrite(true)).toBeNull();
    expect(normalizeIleSessionMode("exercise", "learning", { write: true })).toBe("learning");
    expect(normalizeIleSessionMode("project", "learning", { write: true })).toBe("project");
    expect(resolveIleSessionModeFromBody({ session_mode: "project" }, { write: true })).toBe(
      "project",
    );
    expect(
      resolveIleSessionModeFromBody({ interaction_kind: "exercise" }, { write: true }),
    ).toBe("learning");
    expect(normalizeIleSessionMode("exercise")).toBe("project");
    expect(resolveIleSessionModeFromSession({ metadata: { session_mode: "project" } })).toBe(
      "project",
    );
    expect(resolveIleSessionModeFromBody({ interaction_kind: "exercise" })).toBe("project");
  });
});

describe("one ILE coaching constitution", () => {
  it("dashboard opening_probe is kernel surface plus overlay variables", () => {
    const prompts = read("lib/prompts.ts");
    expect(prompts).toContain("ILE_SURFACE");
    expect(prompts).toContain("ILE_TOOLS_BLOCK");
    expect(prompts).toContain("OVERLAY — opening move variables only");
  });
});

describe("closed error envelope", () => {
  it("jsonError writes nested envelope; unknown codes fall back; no string writers in app/api", async () => {
    expect(KNOWN_ERROR_CODES).toContain("forbidden");
    expect(toErrorCode("not_a_real_code")).toBe("internal_error");
    expect(toErrorCode("guest_missing")).toBe("guest_missing");

    const res = jsonError(403, "Nope", "forbidden");
    const body = await res.json();
    expect(classifyApiErrorEnvelope(body)).toBe("nested_code");
    expect(body.error.code).toBe("forbidden");

    const routes = walkRoutes(join(ROOT, "app/api"));
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      const withoutComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      if (file.includes("/app/api/oauth/")) continue;
      if (
        /NextResponse\.json\(\s*\{\s*error:\s*["'`]/.test(withoutComments) ||
        /NextResponse\.json\(\s*\{\s*error:\s*(?!\{)[a-zA-Z]/.test(withoutComments)
      ) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    expect(offenders, `string error writers: ${offenders.join(", ")}`).toEqual([]);
  });
});
