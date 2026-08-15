/**
 * Ready-next quality items: nested error envelopes, map selection, TAP hook
 * forming text, SessionItem learner writes, grid chrome extract.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

import {
  buildNestedApiErrorEnvelope,
  classifyApiErrorEnvelope,
  errorMessageFromBody,
  jsonError,
  statusToErrorCode,
} from "@/lib/api-error-envelope";
import {
  emptyWorkspaceMapSelection,
  nextWorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import {
  tapHookFormingText,
  tapLiveSpeechFlushText,
} from "@/lib/tap-session-runtime";
import { shouldWriteLearnerBlocksViaBrowserClient } from "@/lib/workspace-learner-writes";
import {
  guardWorkspaceRoute,
  requireAuthenticatedUser,
} from "@/lib/api/require-auth";
import { requireProductAccess } from "@/lib/api/product-access";
import {
  requireSessionWorkspaceProofOfWorkAccess,
  requireWorkspaceOwnerSession,
} from "@/lib/pow-api/workspace-session-access";
import { POST as workspaceNewsPost } from "@/app/api/workspace/news/route";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-e29f98aadd15/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("quality-next shipped helpers", () => {
  it("envelopes, selection, TAP hook text, learner writes, extracted chrome", async () => {
    const nested = buildNestedApiErrorEnvelope("forbidden", "nope");
    expect(classifyApiErrorEnvelope(nested)).toBe("nested_code");
    expect(errorMessageFromBody(nested, "x")).toBe("nope");
    expect(errorMessageFromBody({ error: "legacy" }, "x")).toBe("legacy");
    expect(statusToErrorCode(404)).toBe("not_found");
    expect(statusToErrorCode(401)).toBe("unauthorized");
    const res = jsonError(400, "workspaceId is required");
    expect(res.status).toBe(400);
    const productBody = await res.json();
    expect(classifyApiErrorEnvelope(productBody)).toBe("nested_code");
    expect(errorMessageFromBody(productBody, "x")).toBe("workspaceId is required");

    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const unauth = await requireAuthenticatedUser();
    expect(unauth.ok).toBe(false);
    if (unauth.ok) throw new Error("expected unauthenticated");
    expect(unauth.response.status).toBe(401);
    const unauthBody = await unauth.response.json();
    expect(classifyApiErrorEnvelope(unauthBody)).toBe("nested_code");
    expect(errorMessageFromBody(unauthBody, "x")).toBe("Not authenticated");

    const missingWs = await guardWorkspaceRoute("   ");
    expect(missingWs.ok).toBe(false);
    if (missingWs.ok) throw new Error("expected missing workspaceId");
    const missingWsBody = await missingWs.response.json();
    expect(classifyApiErrorEnvelope(missingWsBody)).toBe("nested_code");
    expect(errorMessageFromBody(missingWsBody, "x")).toBe("workspaceId is required");

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: "ws-1", user_id: "other" }, error: null }),
        }),
      }),
    });
    const forbidden = await guardWorkspaceRoute("ws-1");
    expect(forbidden.ok).toBe(false);
    if (forbidden.ok) throw new Error("expected forbidden workspace");
    expect(forbidden.response.status).toBe(403);
    const forbiddenBody = await forbidden.response.json();
    expect(classifyApiErrorEnvelope(forbiddenBody)).toBe("nested_code");
    expect(errorMessageFromBody(forbiddenBody, "x")).toBe("Forbidden");

    const profileDenied = await requireProductAccess(
      {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: { message: "missing" } }),
            }),
          }),
        }),
      } as never,
      { id: "user-1" } as never,
    );
    expect(profileDenied.ok).toBe(false);
    if (profileDenied.ok) throw new Error("expected profile required");
    expect(profileDenied.response.status).toBe(403);
    const profileBody = await profileDenied.response.json();
    expect(classifyApiErrorEnvelope(profileBody)).toBe("nested_code");
    expect(errorMessageFromBody(profileBody, "x")).toBe("Profile not found");

    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const powUnauth = await requireSessionWorkspaceProofOfWorkAccess("ws-1");
    expect(powUnauth instanceof NextResponse).toBe(true);
    if (!(powUnauth instanceof NextResponse)) throw new Error("expected PoW 401");
    expect(powUnauth.status).toBe(401);
    const powUnauthBody = await powUnauth.json();
    expect(classifyApiErrorEnvelope(powUnauthBody)).toBe("nested_code");
    expect(errorMessageFromBody(powUnauthBody, "x")).toBe("Not authenticated");

    const ownerUnauth = await requireWorkspaceOwnerSession("ws-1");
    expect(ownerUnauth instanceof NextResponse).toBe(true);
    if (!(ownerUnauth instanceof NextResponse)) throw new Error("expected owner 401");
    expect(ownerUnauth.status).toBe(401);
    const ownerUnauthBody = await ownerUnauth.json();
    expect(classifyApiErrorEnvelope(ownerUnauthBody)).toBe("nested_code");
    expect(errorMessageFromBody(ownerUnauthBody, "x")).toBe("Not authenticated");

    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: "ws-1", user_id: "other", is_group: false, organization_id: null },
            error: null,
          }),
        }),
      }),
    });
    const powForbidden = await requireSessionWorkspaceProofOfWorkAccess("ws-1");
    expect(powForbidden instanceof NextResponse).toBe(true);
    if (!(powForbidden instanceof NextResponse)) throw new Error("expected PoW 403");
    expect(powForbidden.status).toBe(403);
    const powForbiddenBody = await powForbidden.json();
    expect(classifyApiErrorEnvelope(powForbiddenBody)).toBe("nested_code");
    expect(errorMessageFromBody(powForbiddenBody, "")).not.toBe("");

    const newsRes = await workspaceNewsPost(
      new NextRequest("http://local/api/workspace/news", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(newsRes.ok).toBe(false);
    const newsBody = await newsRes.json();
    expect(classifyApiErrorEnvelope(newsBody)).toBe("nested_code");
    expect(errorMessageFromBody(newsBody, "")).not.toBe("");

    const empty = emptyWorkspaceMapSelection();
    const cells = nextWorkspaceMapSelection(empty, {
      type: "set_empty_cells",
      cells: [{ row: 2, col: 3 }],
    });
    expect(cells.emptyCells).toEqual([{ row: 2, col: 3 }]);
    expect(cells.expandedBlockId).toBeNull();
    const oneBlock = nextWorkspaceMapSelection(cells, {
      type: "set_filled_ids",
      blockIds: ["block-1"],
    });
    expect(oneBlock.expandedBlockId).toBe("block-1");
    expect(oneBlock.selectedFilledBlockIds).toEqual([]);
    expect(oneBlock.emptyCells).toEqual([]);
    const cleared = nextWorkspaceMapSelection(oneBlock, { type: "clear" });
    expect(cleared).toEqual(emptyWorkspaceMapSelection());

    expect(tapHookFormingText({ getFormingText: () => "  live  " })).toBe("live");
    expect(tapHookFormingText({ getFormingText: () => "" })).toBe("");
    expect(
      tapLiveSpeechFlushText({
        hookFormingText: tapHookFormingText({ getFormingText: () => "hook first" }),
        crystallizableText: "stale crystallize",
        localFinalBuffer: ["dead buffer"],
      }),
    ).toBe("hook first");
    expect(shouldWriteLearnerBlocksViaBrowserClient()).toBe(false);

    const sessionChat = read("app/api/session-chat/route.ts");
    const tapChat = read("app/api/workspace-tap-score/chat/route.ts");
    const ileSpeech = read("app/api/workspace-ile/speech/route.ts");
    const gridOps = read("app/api/workspace/grid-ops/route.ts");
    const view = read("components/WorkspaceView.tsx");
    const tap = read("components/TapScoreClient.tsx");
    const exercise = read("components/ExerciseTapClient.tsx");
    const item = read("components/SessionItem.tsx");
    const host = read("components/BlockSkillGrid.tsx");

    expect(sessionChat).toContain("jsonError");
    expect(tapChat).toContain("jsonError");
    expect(ileSpeech).toContain("jsonError");
    expect(gridOps).toContain("jsonError");
    expect(sessionChat).not.toMatch(/NextResponse\.json\(\s*\{\s*error:\s*"/);

    expect(view).toContain("nextWorkspaceMapSelection");
    expect(view).not.toMatch(
      /setExpandedBlockId\(clearWorkspaceBlockSelection\(\)\)/,
    );
    expect(view).not.toMatch(
      /setSelectedFilledBlockIds\(clearWorkspaceFilledBlockSelection\(\)\)/,
    );

    expect(tap).toContain("tapHookFormingText");
    expect(exercise).toContain("tapHookFormingText");
    expect(item).not.toMatch(/from\("blocks"\)\s*\n\s*\.update/);
    expect(item).toContain("WORKSPACE_LEARNER_LAUNCH_PATH");
    expect(item).toContain("WORKSPACE_LEARNER_PROMPT_PATH");

    expect(host).toContain("MapToolStripButton");
    expect(host).toContain("MapMinimapChrome");
    expect(host).toContain("data-block-map-tool-strip");

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "quality-next-excerpts.txt"),
      [
        `envelopeKind=${classifyApiErrorEnvelope(productBody)}`,
        `msg=${errorMessageFromBody(productBody, "x")}`,
        `auth401=${classifyApiErrorEnvelope(unauthBody)}`,
        `auth401msg=${errorMessageFromBody(unauthBody, "x")}`,
        `guard400=${classifyApiErrorEnvelope(missingWsBody)}`,
        `guard403=${classifyApiErrorEnvelope(forbiddenBody)}`,
        `product403=${classifyApiErrorEnvelope(profileBody)}`,
        `pow401=${classifyApiErrorEnvelope(powUnauthBody)}`,
        `pow401msg=${errorMessageFromBody(powUnauthBody, "x")}`,
        `owner401=${classifyApiErrorEnvelope(ownerUnauthBody)}`,
        `pow403=${classifyApiErrorEnvelope(powForbiddenBody)}`,
        `newsStatus=${newsRes.status}`,
        `newsEnvelope=${classifyApiErrorEnvelope(newsBody)}`,
        `emptyClickCells=${cells.emptyCells.length}`,
        `oneBlockId=${oneBlock.expandedBlockId}`,
        `hookText=${tapHookFormingText({ getFormingText: () => "live" })}`,
        `browserBlockWrite=${shouldWriteLearnerBlocksViaBrowserClient()}`,
        "jsonError on session-chat / tap / ile / grid-ops",
        "WorkspaceView selection via nextWorkspaceMapSelection",
        "TAP stash/send/purity/end use tapHookFormingText",
        "SessionItem learner-launch/prompt APIs",
        "grid host imports MapToolStripButton + MapMinimapChrome",
      ].join("\n"),
      "utf8",
    );
  });
});
