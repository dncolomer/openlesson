import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleSessionContextWrite,
  boundIleSessionLiveState,
  capIleLiveList,
  createIleSessionContext,
  createIleSessionContextStore,
  ileChapterCanvasInitialScene,
  ileChapterCanvasRemountKey,
  ILE_LIVE_CHAT_MAX_MESSAGES,
  mergeLegacyIleChapterWorkspaces,
  parseIleSessionContextStored,
  persistIleChapterColdWorkspace,
  readIleFocusedChapterWorkspace,
  readIleSessionContext,
} from "@/lib/ile-session-global-context";
import {
  IleEvidenceBuffer,
  ILE_LIVE_EEG_CHUNKS_MAX,
  ILE_LIVE_SCREENSHOTS_MAX,
} from "@/lib/ile-evidence-buffer";

const ROOT = join(__dirname, "../..");

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a2f4918b104f/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ILE chapter-scoped context store", () => {
  it("keeps chapter A notebook/canvas absent when reading chapter B", () => {
    const store = createIleSessionContextStore();
    store.focus("chapter-1");
    store.write("chapter-1", {
      whiteboardData: "canvas-png",
      notebookContent: "notes from chapter 1",
      chatMessages: [{ id: "m1", role: "user", content: "hello" }],
      pendingChatMessage: "queued",
    });
    store.write("chapter-1", (current) => ({
      chatMessages: [...current.chatMessages, { id: "m2", role: "assistant", content: "hi" }],
    }));

    const afterFirst = store.read("chapter-1");
    expect(afterFirst.whiteboardData).toBe("canvas-png");
    expect(afterFirst.notebookContent).toBe("notes from chapter 1");
    expect(afterFirst.chatMessages.map((m) => m.id)).toEqual(["m1", "m2"]);

    store.focus("chapter-2");
    const afterFocus = store.read("chapter-2");
    expect(afterFocus.notebookContent).not.toBe("notes from chapter 1");
    expect(afterFocus.notebookContent).toBe("");
    expect(afterFocus.chatMessages).toHaveLength(0);
    expect(afterFocus.whiteboardData).toBeNull();

    store.write("chapter-2", {
      notebookContent: "notes from chapter 2",
      whiteboardData: "canvas-2",
    });
    expect(store.read("chapter-1").notebookContent).toBe("notes from chapter 1");
    expect(store.read("chapter-2").notebookContent).toBe("notes from chapter 2");
    expect(store.read("chapter-2").whiteboardData).toBe("canvas-2");

    let session = {};
    session = applyIleSessionContextWrite(session, "chapter-1", {
      whiteboardData: "hook-canvas",
      notebookContent: "hook-notes",
      chatMessages: [{ id: "h1", role: "user", content: "q" }],
    });
    session = applyIleSessionContextWrite(session, "chapter-2", (current) => ({
      chatMessages: [...current.chatMessages, { id: "h2", role: "assistant", content: "a" }],
    }));
    expect(readIleSessionContext(session, "chapter-1").notebookContent).toBe("hook-notes");
    expect(readIleSessionContext(session, "chapter-2").chatMessages.map((m) => m.id)).toEqual(["h2"]);
    expect(readIleSessionContext(session, "chapter-1").chatMessages.map((m) => m.id)).toEqual(["h1"]);
    // Unfocused chapter drops heavy canvas from live state; notebook/chat stay.
    expect(readIleSessionContext(session, "chapter-1").whiteboardData).toBeNull();
    expect(readIleSessionContext(session, "chapter-2").notebookContent).toBe("");

    const hook = readFileSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"), "utf8");
    expect(existsSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"))).toBe(true);
    expect(hook).toContain("applyIleSessionContextWrite");
    expect(hook).toContain("const [sessionContext, setSessionContext]");
    expect(hook).toContain("readIleFocusedChapterWorkspace");
    expect(hook).toContain("coldContextRef.current");
    expect(hook).toContain("ileChapterCanvasInitialScene(activeWorkspace)");
    expect(hook).toContain("boundIleSessionLiveState");

    const merged = mergeLegacyIleChapterWorkspaces({
      a: { notebookContent: "A", chatMessages: [{ id: "a", role: "user", content: "a" }] },
      b: { whiteboardData: "B", chatMessages: [{ id: "b", role: "user", content: "b" }] },
    });
    expect(merged.a.notebookContent).toBe("A");
    expect(merged.b.whiteboardData).toBe("B");
    expect(merged.a.chatMessages.map((m) => m.id)).toEqual(["a"]);
    expect(merged.b.chatMessages.map((m) => m.id)).toEqual(["b"]);

    const parsed = parseIleSessionContextStored(
      JSON.stringify({ notebookContent: "solo", chatMessages: [] }),
    );
    expect(parsed?.session.notebookContent).toBe("solo");

    writeScratch(
      "ile-session-global-context-excerpts.txt",
      JSON.stringify({
        afterFocusNotebook: afterFocus.notebookContent,
        ch1: store.read("chapter-1").notebookContent,
        ch2: store.read("chapter-2").notebookContent,
        chatIds: store.read("chapter-1").chatMessages.map((m) => m.id),
      }),
    );
  });

  it("remounts the Excalidraw canvas per chapter so CH1 drawings are not shown on CH3", () => {
    const sessionId = "session-ile-1";
    const ch1Key = ileChapterCanvasRemountKey(sessionId, "chapter-1");
    const ch3Key = ileChapterCanvasRemountKey(sessionId, "chapter-3");
    expect(ch1Key).toContain("chapter-1");
    expect(ch3Key).toContain("chapter-3");
    expect(ch1Key).not.toBe(ch3Key);
    expect(ch1Key).not.toBe(sessionId);
    expect(ileChapterCanvasRemountKey(sessionId, "chapter-1")).toBe(ch1Key);

    const store = createIleSessionContextStore();
    store.write("chapter-1", {
      whiteboardSceneData: {
        elements: [{ id: "draw-ch1" }],
        appState: { zoom: 1 },
        files: {},
      },
    });
    const scene1 = ileChapterCanvasInitialScene(store.read("chapter-1"));
    expect(scene1?.elements).toEqual([{ id: "draw-ch1" }]);

    store.write("chapter-3", {
      whiteboardSceneData: {
        elements: [{ id: "draw-ch3" }],
        appState: { zoom: 1 },
        files: {},
      },
    });
    const scene3 = ileChapterCanvasInitialScene(store.read("chapter-3"));
    expect(scene3?.elements).toEqual([{ id: "draw-ch3" }]);
    expect(scene1?.elements).not.toEqual(scene3?.elements);
    expect(ileChapterCanvasInitialScene(store.read("chapter-2"))).toBeNull();
    // Live store evicts unfocused heavy scenes; remount + same-render hydrate restores CH1.
    expect(store.readLive("chapter-1").whiteboardSceneData).toBeNull();
    const remountScene = ileChapterCanvasInitialScene(
      readIleFocusedChapterWorkspace(store.map, store.cold, "chapter-1"),
    );
    expect(remountScene?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(remountScene?.elements).not.toEqual(scene3?.elements);
    store.focus("chapter-1");
    expect(ileChapterCanvasInitialScene(store.read("chapter-1"))?.elements).toEqual([
      { id: "draw-ch1" },
    ]);
    const persisted = persistIleChapterColdWorkspace(
      {},
      "chapter-1",
      store.read("chapter-1"),
    );
    expect(persisted["chapter-1"]?.whiteboardSceneData?.elements).toEqual([
      { id: "draw-ch1" },
    ]);

    const panes = readFileSync(join(ROOT, "components/session-view/session-tool-panes.tsx"), "utf8");
    expect(panes).toContain("ileChapterCanvasRemountKey");
    expect(panes).toContain("ileChapterCanvasRemountKey(session.id, activeChapterKey)");
    expect(panes).not.toMatch(/<ExcalidrawCanvas[\s\S]{0,80}key=\{session\.id\}/);
    expect(panes).toContain("initialSceneData={whiteboardSceneData}");

    const canvas = readFileSync(join(ROOT, "components/ExcalidrawCanvas.tsx"), "utf8");
    expect(canvas).toContain("initialSceneDataRef = useRef(sanitizeSceneData(initialSceneData))");

    const view = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(view).toContain("activeChapterKey={activeChapterKey}");

    writeScratch(
      "ile-chapter-canvas-remount.txt",
      JSON.stringify({
        ch1Key,
        ch3Key,
        ch1Element: scene1?.elements?.[0],
        ch3Element: scene3?.elements?.[0],
      }),
    );
  });

  it("refuses unbounded live growth: chat and PoW buffers stay at the cap", () => {
    const overflow = ILE_LIVE_CHAT_MAX_MESSAGES + 40;
    const messages = Array.from({ length: overflow }, (_, index) => ({
      id: `m${index}`,
      role: "user" as const,
      content: `msg ${index}`,
    }));
    const store = createIleSessionContextStore();
    store.write("chapter-1", { chatMessages: messages });
    expect(store.read("chapter-1").chatMessages.length).toBe(ILE_LIVE_CHAT_MAX_MESSAGES);
    expect(store.read("chapter-1").chatMessages[0]?.id).toBe(`m${overflow - ILE_LIVE_CHAT_MAX_MESSAGES}`);

    const capped = capIleLiveList(messages, ILE_LIVE_CHAT_MAX_MESSAGES);
    expect(capped.length).toBe(ILE_LIVE_CHAT_MAX_MESSAGES);

    const withHeavy = applyIleSessionContextWrite(
      {
        "chapter-1": {
          ...createIleSessionContext(),
          whiteboardData: "png-1",
          whiteboardSceneData: { elements: [1], appState: {}, files: {} },
        },
        "chapter-2": {
          ...createIleSessionContext(),
          whiteboardData: "png-2",
          whiteboardSceneData: { elements: [2], appState: {}, files: {} },
        },
      },
      "chapter-2",
      { notebookContent: "focused" },
    );
    const live = boundIleSessionLiveState(withHeavy, "chapter-2");
    expect(live["chapter-2"].notebookContent).toBe("focused");
    expect(live["chapter-1"].whiteboardData).toBeNull();
    expect(live["chapter-1"].whiteboardSceneData).toBeNull();

    const buffer = new IleEvidenceBuffer();
    for (let i = 0; i < ILE_LIVE_EEG_CHUNKS_MAX + 5; i += 1) {
      buffer.pushEegChunk({
        channels: { TP9: [i] },
        bandPowers: null,
        timestampMs: i,
      });
    }
    for (let i = 0; i < ILE_LIVE_SCREENSHOTS_MAX + 5; i += 1) {
      buffer.pushScreenshot({
        blob: new Blob([new Uint8Array([i])], { type: "image/png" }),
        timestampMs: i,
      });
    }
    const drained = buffer.drainForSubmit("session-1", Date.now(), true);
    expect(drained.screenshots.length).toBeLessThanOrEqual(ILE_LIVE_SCREENSHOTS_MAX);
  });
});
