/**
 * P10 leftovers: one map-selection path, TAP live hook, session-chat PoW,
 * used Project persist helper, dead leftovers gone.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emptyWorkspaceMapSelection,
  mapSelectionFromApplyPayload,
  mapSelectionToApplyPayload,
  nextWorkspaceMapSelection,
  workspaceMapSelectionHostApply,
} from "@/lib/workspace-map-selection";
import {
  isTapLiveThoughtSpeechEnabled,
  shouldRestartLocalTapSpeechBindings,
  tapLiveSpeechFlushText,
} from "@/lib/tap-session-runtime";
import {
  buildIleSessionChatPowFile,
  resolveIleSessionChatPowUpload,
} from "@/lib/ile-session-chat-pow";
import {
  emptyIleProjectDualLists,
  ileProjectThoughtsStorageKey,
  parseIleProjectThoughtsStored,
  serializeIleProjectThoughts,
} from "@/lib/ile-mode";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-9c2c45c08185/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("P10 leftovers shipped helpers", () => {
  it("selection, TAP hook, session-chat PoW, persist, dead leftovers", () => {
    const empty = emptyWorkspaceMapSelection();
    const opened = nextWorkspaceMapSelection(empty, {
      type: "open_block",
      blockId: "b1",
    });
    expect(opened.expandedBlockId).toBe("b1");
    expect(opened.selectedFilledBlockIds).toEqual([]);
    expect(opened.emptyCells).toEqual([]);

    const multi = nextWorkspaceMapSelection(opened, {
      type: "set_filled_ids",
      blockIds: ["a", "b"],
    });
    expect(multi.expandedBlockId).toBeNull();
    expect(multi.selectedFilledBlockIds).toEqual(["a", "b"]);

    const search = nextWorkspaceMapSelection(multi, {
      type: "apply_search_blocks",
      blockIds: ["only"],
    });
    expect(search.expandedBlockId).toBe("only");
    expect(search.selectedFilledBlockIds).toEqual([]);
    const searchApply = mapSelectionToApplyPayload(search, 2);
    expect(searchApply.blockIds).toEqual(["only"]);
    const searchRebuilt = mapSelectionFromApplyPayload(searchApply);
    expect(searchRebuilt.expandedBlockId).toBe("only");
    expect(searchRebuilt.selectedFilledBlockIds).toEqual([]);
    const searchHost = workspaceMapSelectionHostApply(searchRebuilt);
    expect(searchHost.selectNodeId).toBe("only");
    expect(searchHost.emitFilled).toBeNull();

    const suggest = nextWorkspaceMapSelection(search, {
      type: "apply_suggest_cells",
      cells: [{ row: 2, col: 3 }],
    });
    expect(suggest.expandedBlockId).toBeNull();
    expect(suggest.emptyCells).toEqual([{ row: 2, col: 3 }]);

    const cleared = nextWorkspaceMapSelection(suggest, { type: "clear" });
    expect(cleared).toEqual(emptyWorkspaceMapSelection());
    const apply = mapSelectionToApplyPayload(cleared, 4);
    expect(apply.token).toBe(4);
    expect(apply.blockIds).toEqual([]);
    expect(apply.emptyCells).toEqual([]);

    expect(isTapLiveThoughtSpeechEnabled("live")).toBe(true);
    expect(isTapLiveThoughtSpeechEnabled("briefing")).toBe(false);
    expect(shouldRestartLocalTapSpeechBindings("live")).toBe(false);
    expect(shouldRestartLocalTapSpeechBindings("briefing")).toBe(true);
    expect(
      tapLiveSpeechFlushText({
        hookFormingText: "  hook live  ",
        crystallizableText: "local",
        localFinalBuffer: ["dead"],
      }),
    ).toBe("hook live");
    expect(
      tapLiveSpeechFlushText({
        hookFormingText: "",
        crystallizableText: "from bar",
        localFinalBuffer: ["ignored"],
      }),
    ).toBe("from bar");
    expect(
      tapLiveSpeechFlushText({
        hookFormingText: "",
        crystallizableText: "",
        localFinalBuffer: ["only", "if", "nothing", "else"],
      }),
    ).toBe("only if nothing else");

    const skipPow = resolveIleSessionChatPowUpload({ sessionId: "s", workspaceId: "" });
    expect(skipPow.persist).toBe(false);
    const persistPow = resolveIleSessionChatPowUpload({
      sessionId: "s1",
      workspaceId: "w1",
    });
    expect(persistPow.persist).toBe(true);
    if (persistPow.persist) {
      const file = buildIleSessionChatPowFile({
        sessionId: persistPow.sessionId,
        workspaceId: persistPow.workspaceId,
        learnerText: "q",
        assistantText: "a",
        timestampMs: 1,
      });
      expect(file.fileName).toContain(persistPow.sessionId);
      expect(file.base64.length).toBeGreaterThan(0);
    }

    const lists = {
      ...emptyIleProjectDualLists(),
      stash: [{ id: "t1", text: "hi", timestamp: 1, chainId: "c" }],
    };
    const raw = serializeIleProjectThoughts(lists);
    expect(parseIleProjectThoughtsStored(raw)?.stash[0]?.id).toBe(lists.stash[0]?.id);
    expect(parseIleProjectThoughtsStored("nope")).toBeNull();
    expect(ileProjectThoughtsStorageKey("sess", "ch")).toContain("sess");

    const view = read("components/WorkspaceView.tsx");
    const list = read("components/SessionList.tsx");
    const grid = read("components/BlockSkillGrid.tsx");
    const tap = read("components/TapScoreClient.tsx");
    const exercise = read("components/ExerciseTapClient.tsx");
    const sessionChat = read("app/api/session-chat/route.ts");
    const sessionView = read("components/SessionView.tsx");
    const hook = read("lib/useSessionThoughtInterface.ts");

    expect(view).toContain("nextWorkspaceMapSelection");
    expect(list).toContain("nextWorkspaceMapSelection");
    expect(grid).toContain("mapSelectionFromApplyPayload");
    expect(grid).toContain("workspaceMapSelectionHostApply");
    expect(view).not.toContain("mapSelectionClearNonce");
    expect(list).not.toContain("mapSelectionClearNonce");
    expect(grid).not.toContain("mapSelectionClearNonce");
    expect(view).not.toMatch(/loadPlan\(\);\s*\n\s*\}, \[workspaceId[\s\S]*refreshKey/);
    expect(view).not.toContain("const [refreshKey");
    expect(view).not.toContain("const inventoryBlocks");

    expect(tap).toContain("useSessionThoughtInterface(");
    expect(exercise).toContain("useSessionThoughtInterface(");
    expect(tap).toContain("isTapLiveThoughtSpeechEnabled");
    expect(exercise).toContain("isTapLiveThoughtSpeechEnabled");
    expect(tap).toContain("shouldRestartLocalTapSpeechBindings");
    expect(exercise).toContain("shouldRestartLocalTapSpeechBindings");
    expect(tap).toContain("tapLiveSpeechFlushText");
    expect(exercise).toContain("tapLiveSpeechFlushText");
    expect(hook).toContain("captureKeys");

    expect(sessionChat).toContain("uploadWorkspaceProofOfWork");
    expect(sessionChat).toContain("resolveIleSessionChatPowUpload");
    expect(sessionView).toContain("ileProjectThoughtsStorageKey");
    expect(sessionView).toContain("parseIleProjectThoughtsStored");

    expect(existsSync(join(ROOT, "components/WorkspaceBuilderShell.tsx"))).toBe(false);

    writeScratch(
      "p10-leftovers-excerpts.txt",
      [
        `selectionClear=${JSON.stringify(cleared)}`,
        `applyClearToken=${apply.token}`,
        `tapLiveHook=${isTapLiveThoughtSpeechEnabled("live")}`,
        `searchOneBlock=${searchHost.selectNodeId}`,
        `localRestartLive=${shouldRestartLocalTapSpeechBindings("live")}`,
        `flushPrefersHook=${tapLiveSpeechFlushText({ hookFormingText: "hook", crystallizableText: "bar" })}`,
        `powPersist=${persistPow.persist}`,
        `projectKey=${ileProjectThoughtsStorageKey("sess", "ch")}`,
        "one nextWorkspaceMapSelection path: WorkspaceView + SessionList + BlockSkillGrid",
        "no mapSelectionClearNonce",
        "no refreshKey on loadPlan",
        "TAP shells: useSessionThoughtInterface on live path",
        "session-chat: uploadWorkspaceProofOfWork",
        "Project persist helper used in SessionView",
        "inventoryBlocks + WorkspaceBuilderShell removed",
      ].join("\n"),
    );
  });
});
