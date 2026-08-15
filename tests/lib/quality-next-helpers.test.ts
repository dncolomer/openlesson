/**
 * Ready-next quality items: nested error envelopes, map selection, TAP hook
 * forming text, SessionItem learner writes, grid chrome extract.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
import { tapHookFormingText } from "@/lib/tap-session-runtime";
import { shouldWriteLearnerBlocksViaBrowserClient } from "@/lib/workspace-learner-writes";

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
  it("envelopes, selection, TAP hook text, learner writes, extracted chrome", () => {
    const nested = buildNestedApiErrorEnvelope("forbidden", "nope");
    expect(classifyApiErrorEnvelope(nested)).toBe("nested_code");
    expect(errorMessageFromBody(nested, "x")).toBe("nope");
    expect(errorMessageFromBody({ error: "legacy" }, "x")).toBe("legacy");
    expect(statusToErrorCode(404)).toBe("not_found");
    expect(statusToErrorCode(401)).toBe("unauthorized");
    const res = jsonError(400, "workspaceId is required");
    expect(res.status).toBe(400);

    const empty = emptyWorkspaceMapSelection();
    const cells = nextWorkspaceMapSelection(empty, {
      type: "set_empty_cells",
      cells: [{ row: 2, col: 3 }],
    });
    expect(cells.emptyCells).toEqual([{ row: 2, col: 3 }]);
    expect(cells.expandedBlockId).toBeNull();
    const cleared = nextWorkspaceMapSelection(cells, { type: "clear" });
    expect(cleared).toEqual(emptyWorkspaceMapSelection());

    expect(tapHookFormingText({ getFormingText: () => "  live  " })).toBe("live");
    expect(tapHookFormingText({ getFormingText: () => "" })).toBe("");
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
        `envelopeKind=${classifyApiErrorEnvelope(nested)}`,
        `msg=${errorMessageFromBody(nested, "x")}`,
        `emptyClickCells=${cells.emptyCells.length}`,
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
