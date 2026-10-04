import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionPlan } from "@/lib/domain/types";
import { ileBlockSessionFrame } from "@/lib/ile-canvas-session";
import { useSessionChapterWorkspaces } from "@/lib/useSessionChapterWorkspaces";
import {
  adoptIleSingleLiveCanvas,
  applyIleSessionContextWrite,
  boundIleSessionLiveState,
  capIleLiveList,
  createIleSessionContext,
  createIleSessionContextStore,
  hydrateIleFocusedChapterLiveState,
  ileChapterCanvasInitialScene,
  ileChapterCanvasRemountKey,
  ileSingleCanvasChapterWorkspaces,
  ILE_LIVE_CHAT_MAX_MESSAGES,
  ILE_SESSION_GLOBAL_CONTEXT_KEY,
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

describe("TAP Learning single-canvas context store", () => {
  it("keeps one workspace when a second chapter id is read or written", () => {
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
    expect(afterFocus.notebookContent).toBe("notes from chapter 1");
    expect(afterFocus.chatMessages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(afterFocus.whiteboardData).toBe("canvas-png");
    expect(store.read("chapter-1")).toEqual(afterFocus);
    expect(Object.keys(store.map)).toEqual([ILE_SESSION_GLOBAL_CONTEXT_KEY]);

    store.write("chapter-2", {
      notebookContent: "notes from the one topic",
    });
    expect(store.read("chapter-1").notebookContent).toBe("notes from the one topic");
    expect(store.read("chapter-2").notebookContent).toBe("notes from the one topic");
    expect(store.read("chapter-2").whiteboardData).toBe("canvas-png");
    expect(Object.keys(store.cold)).toEqual([ILE_SESSION_GLOBAL_CONTEXT_KEY]);

    let session = {};
    session = applyIleSessionContextWrite(session, "chapter-1", {
      whiteboardData: "hook-canvas",
      notebookContent: "hook-notes",
      chatMessages: [{ id: "h1", role: "user", content: "q" }],
    });
    session = applyIleSessionContextWrite(session, "chapter-2", (current) => ({
      chatMessages: [...current.chatMessages, { id: "h2", role: "assistant", content: "a" }],
    }));
    expect(Object.keys(session)).toEqual([ILE_SESSION_GLOBAL_CONTEXT_KEY]);
    expect(readIleSessionContext(session, "chapter-1").notebookContent).toBe("hook-notes");
    expect(readIleSessionContext(session, "chapter-2").chatMessages.map((m) => m.id)).toEqual([
      "h1",
      "h2",
    ]);
    expect(readIleSessionContext(session, "chapter-1").whiteboardData).toBe("hook-canvas");
    expect(readIleSessionContext(session, "chapter-2").whiteboardData).toBe("hook-canvas");

    const hook = readFileSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"), "utf8");
    expect(existsSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"))).toBe(true);
    expect(hook).toContain("applyIleSessionContextWrite");
    expect(hook).toContain("const [sessionContext, setSessionContext]");
    expect(hook).toContain("readIleFocusedChapterWorkspace");
    expect(hook).toContain("coldContextRef.current");
    expect(hook).toContain("ileChapterCanvasInitialScene(activeWorkspace)");
    expect(hook).toContain("boundIleSessionLiveState");
    expect(hook).toContain("ileSingleCanvasChapterWorkspaces(activeWorkspace)");

    const liveWorkspace = {
      ...createIleSessionContext(),
      notebookContent: "the one topic",
      chatMessages: [{ id: "kept", role: "user" as const, content: "on the board" }],
    };
    const byChapter = ileSingleCanvasChapterWorkspaces(liveWorkspace);
    const secondIdMessages = byChapter["chapter-b"]?.chatMessages ?? [];
    expect(byChapter["chapter-b"]).toBe(byChapter["chapter-a"]);
    expect(secondIdMessages.map((message) => message.id)).toEqual(["kept"]);
    expect(byChapter["step-2"]?.notebookContent).toBe("the one topic");

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
        sameCanvas: store.read("chapter-1").whiteboardData === store.read("chapter-2").whiteboardData,
        chatIds: store.read("chapter-1").chatMessages.map((m) => m.id),
      }),
    );
  });

  it("uses one canvas scene so a second chapter id does not switch the board", () => {
    const sessionId = "session-ile-1";
    const ch1Key = ileChapterCanvasRemountKey(sessionId, "chapter-1");
    const ch3Key = ileChapterCanvasRemountKey(sessionId, "chapter-3");
    expect(ch1Key).toBe(ch3Key);
    expect(ch1Key).toContain(ILE_SESSION_GLOBAL_CONTEXT_KEY);
    expect(ch1Key).not.toContain("chapter-1");
    expect(ch1Key).not.toContain("chapter-3");
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

    store.focus("chapter-3");
    const scene3 = ileChapterCanvasInitialScene(store.read("chapter-3"));
    expect(scene3?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(ileChapterCanvasInitialScene(store.read("chapter-2"))?.elements).toEqual([
      { id: "draw-ch1" },
    ]);
    expect(Object.keys(store.map)).toEqual([ILE_SESSION_GLOBAL_CONTEXT_KEY]);
    expect(store.readLive("chapter-3").whiteboardSceneData?.elements).toEqual([
      { id: "draw-ch1" },
    ]);
    const remountScene = ileChapterCanvasInitialScene(
      readIleFocusedChapterWorkspace(store.map, store.cold, "chapter-3"),
    );
    expect(remountScene?.elements).toEqual([{ id: "draw-ch1" }]);

    const legacy = createIleSessionContextStore({
      "chapter-1": {
        ...createIleSessionContext(),
        notebookContent: "current chapter",
        whiteboardSceneData: {
          elements: [{ id: "draw-ch1" }],
          appState: { zoom: 1 },
          files: {},
        },
      },
      "chapter-3": {
        ...createIleSessionContext(),
        notebookContent: "other chapter",
        whiteboardSceneData: {
          elements: [{ id: "draw-ch3" }],
          appState: { zoom: 1 },
          files: {},
        },
      },
    });
    const adopted = adoptIleSingleLiveCanvas(legacy.map, legacy.cold, "chapter-1");
    expect(adopted?.[ILE_SESSION_GLOBAL_CONTEXT_KEY]?.notebookContent).toBe("current chapter");
    expect(adopted?.[ILE_SESSION_GLOBAL_CONTEXT_KEY]?.whiteboardSceneData?.elements).toEqual([
      { id: "draw-ch1" },
    ]);
    expect(JSON.stringify(adopted)).not.toContain("draw-ch3");
    expect(JSON.stringify(adopted)).not.toContain("other chapter");
    expect(legacy.read("chapter-1").whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(legacy.read("chapter-3").whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(legacy.read("chapter-3").notebookContent).toBe("current chapter");

    const persisted = persistIleChapterColdWorkspace(
      {},
      ILE_SESSION_GLOBAL_CONTEXT_KEY,
      store.read("chapter-1"),
    );
    expect(persisted[ILE_SESSION_GLOBAL_CONTEXT_KEY]?.whiteboardSceneData?.elements).toEqual([
      { id: "draw-ch1" },
    ]);
    expect(persisted["chapter-3"]).toBeUndefined();

    const viewCanvas = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(viewCanvas).toContain("ileChapterCanvasRemountKey");
    expect(viewCanvas).toContain("ileChapterCanvasRemountKey(session.id, activeChapterKey)");
    expect(viewCanvas).not.toMatch(/<ExcalidrawCanvas[\s\S]{0,80}key=\{session\.id\}/);
    expect(viewCanvas).toContain("initialSceneData={whiteboardSceneData}");

    const canvas = readFileSync(join(ROOT, "components/ExcalidrawCanvas.tsx"), "utf8");
    expect(canvas).toContain("initialSceneDataRef = useRef(");
    expect(canvas).toContain("ileWorkCanvasWithScrollToContent(sanitizeSceneData(initialSceneData))");

    const view = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(view).toContain("activeChapterKey={activeChapterKey}");

    writeScratch(
      "ile-chapter-canvas-remount.txt",
      JSON.stringify({
        ch1Key,
        ch3Key,
        sameKey: ch1Key === ch3Key,
        ch1Element: scene1?.elements?.[0],
        ch3Element: scene3?.elements?.[0],
      }),
    );
  });

  it("keeps the current chapter when a pre-plan step id is written", () => {
    const legacy = {
      "chapter-1": {
        ...createIleSessionContext(),
        notebookContent: "current chapter",
        whiteboardSceneData: {
          elements: [{ id: "draw-ch1" }],
          appState: { zoom: 1 },
          files: {},
        },
      },
      "chapter-3": {
        ...createIleSessionContext(),
        notebookContent: "other chapter",
        whiteboardSceneData: {
          elements: [{ id: "draw-ch3" }],
          appState: { zoom: 1 },
          files: {},
        },
      },
    };
    const written = applyIleSessionContextWrite(legacy, "step-0", {
      notebookContent: "placeholder",
    });
    expect(written[ILE_SESSION_GLOBAL_CONTEXT_KEY]).toBeUndefined();
    expect(written["chapter-1"]?.notebookContent).toBe("current chapter");
    expect(written["chapter-1"]?.whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(JSON.stringify(written)).toContain("draw-ch1");
    expect(JSON.stringify(written)).not.toContain("placeholder");

    const hydrated = hydrateIleFocusedChapterLiveState(legacy, legacy, "step-0");
    const afterHookWrite = applyIleSessionContextWrite(hydrated, "step-0", {
      notebookContent: "placeholder",
    });
    expect(afterHookWrite[ILE_SESSION_GLOBAL_CONTEXT_KEY]).toBeUndefined();
    const stillThere = readIleSessionContext(afterHookWrite, "chapter-1");
    expect(stillThere.notebookContent).toBe("current chapter");
    expect(stillThere.whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);

    const store = createIleSessionContextStore(legacy);
    store.write("step-0", { notebookContent: "placeholder" });
    expect(store.map[ILE_SESSION_GLOBAL_CONTEXT_KEY]).toBeUndefined();
    expect(store.map["chapter-1"]?.notebookContent).toBe("current chapter");
    expect(store.cold["chapter-1"]?.whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);
    const current = store.read("chapter-1");
    expect(current.notebookContent).toBe("current chapter");
    expect(current.whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(JSON.stringify(current)).not.toContain("draw-ch3");
    expect(JSON.stringify(current)).not.toContain("placeholder");

    const withPlaceholderRow = {
      ...legacy,
      "step-0": {
        ...createIleSessionContext(),
        notebookContent: "empty mount",
      },
    };
    expect(adoptIleSingleLiveCanvas(withPlaceholderRow, withPlaceholderRow, "step-0")).toBeNull();
    const kept = applyIleSessionContextWrite(withPlaceholderRow, "step-0", {
      notebookContent: "placeholder",
    });
    expect(kept[ILE_SESSION_GLOBAL_CONTEXT_KEY]).toBeUndefined();
    expect(kept["chapter-1"]?.notebookContent).toBe("current chapter");
    expect(kept["chapter-1"]?.whiteboardSceneData?.elements).toEqual([{ id: "draw-ch1" }]);
    expect(kept["step-0"]?.notebookContent).toBe("empty mount");
    expect(readIleSessionContext(kept, "chapter-1").whiteboardSceneData?.elements).toEqual([
      { id: "draw-ch1" },
    ]);
  });

  it("seeds the plan frame's chapter before any index effect", () => {
    const steps = [
      { id: "ch-1", description: "Prompt one" },
      { id: "ch-2", description: "Prompt two" },
      { id: "ch-3", description: "Prompt three" },
    ];
    expect(ileBlockSessionFrame(null)).toBeNull();
    expect(ileBlockSessionFrame({ steps: [], currentStepIndex: 2 })).toBeNull();
    const plan = { steps, currentStepIndex: 2 } as SessionPlan;
    const frame = ileBlockSessionFrame(plan);
    expect(frame).toEqual({ index: 2, id: "ch-3", prompt: "Prompt three" });
    expect(frame?.id).not.toMatch(/^step-\d+$/);

    function FirstRenderProbe({ sessionPlan }: { sessionPlan: SessionPlan | null }) {
      const live = useSessionChapterWorkspaces("sess-frame", sessionPlan);
      return createElement("div", {
        "data-active-chapter-key": live.activeChapterKey ?? "none",
        "data-active-chapter-index": String(live.activeChapterIndex),
      });
    }
    const firstPaint = renderToStaticMarkup(createElement(FirstRenderProbe, { sessionPlan: plan }));
    expect(firstPaint).toContain('data-active-chapter-key="ch-3"');
    expect(firstPaint).toContain('data-active-chapter-index="2"');
    expect(firstPaint).not.toContain('data-active-chapter-key="ch-1"');
    expect(firstPaint).not.toContain("step-0");
    const beforePlan = renderToStaticMarkup(
      createElement(FirstRenderProbe, { sessionPlan: null }),
    );
    expect(beforePlan).toContain('data-active-chapter-key="none"');

    const stored = {
      "ch-1": {
        ...createIleSessionContext(),
        notebookContent: "empty chapter",
        whiteboardSceneData: {
          elements: [{ id: "draw-ch1" }],
          appState: { zoom: 1 },
          files: {},
        },
      },
      "ch-3": {
        ...createIleSessionContext(),
        notebookContent: "current chapter",
        whiteboardSceneData: {
          elements: [{ id: "draw-ch3" }],
          appState: { zoom: 1 },
          files: {},
        },
      },
    };
    const adopted = adoptIleSingleLiveCanvas(stored, stored, frame?.id);
    expect(Object.keys(adopted ?? {})).toEqual([ILE_SESSION_GLOBAL_CONTEXT_KEY]);
    expect(adopted?.[ILE_SESSION_GLOBAL_CONTEXT_KEY]?.notebookContent).toBe("current chapter");
    expect(adopted?.[ILE_SESSION_GLOBAL_CONTEXT_KEY]?.whiteboardSceneData?.elements).toEqual([
      { id: "draw-ch3" },
    ]);
    expect(JSON.stringify(adopted)).not.toContain("draw-ch1");
    expect(JSON.stringify(adopted)).not.toContain("empty chapter");

    const hook = readFileSync(join(ROOT, "lib/useSessionChapterWorkspaces.ts"), "utf8");
    const view = readFileSync(join(ROOT, "components/SessionView.tsx"), "utf8");
    expect(hook).toContain("const frame = ileBlockSessionFrame(sessionPlan)");
    expect(hook).toContain("const activeChapterKey = frame?.id ?? null");
    expect(hook).toContain("if (!chapterWorkspacesLoaded || !activeChapterKey) return");
    expect(hook).not.toContain("setActiveChapterIndex(");
    expect(hook).not.toContain("`step-${activeChapterIndex}`");
    expect(hook).not.toContain("planInitializedRef");
    expect(hook).not.toContain("useState(0)");
    expect(view).toContain("if (!heliosWidgetOpen || !blockFrame) return");
    expect(view).toContain("seedChapterWorkCanvas(blockFrame.id, text)");
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
    const live = boundIleSessionLiveState(withHeavy, "chapter-1");
    expect(Object.keys(live)).toEqual([ILE_SESSION_GLOBAL_CONTEXT_KEY]);
    expect(live[ILE_SESSION_GLOBAL_CONTEXT_KEY].notebookContent).toBe("focused");
    expect(live[ILE_SESSION_GLOBAL_CONTEXT_KEY].whiteboardData).toBe("png-2");
    expect(JSON.stringify(live)).not.toContain("png-1");
    expect(live["chapter-1"]).toBeUndefined();

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
