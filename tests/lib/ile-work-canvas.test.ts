/**
 * ILE Work canvas: per-chapter isolation, XAI apply, session-chat scene,
 * Excalidraw-tool PoW, and prompt/chrome structural checks.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleXaiTurnToWorkCanvas,
  convertToExcalidrawElements,
  createIleWorkCanvasChapterStore,
  ileWorkCanvasScenesFromWorkspaces,
  ileWorkCanvasTurnContextMessage,
  isRetiredIleWorkToolName,
  mapExcalidrawToolToIlePow,
  parseIleXaiCanvasTurn,
  pickIleWorkCanvasTurnScene,
  readIleChapterWorkCanvas,
  restoreIleChapterWorkCanvas,
  seedIleChapterWorkCanvas,
  serializeIleWorkCanvasScene,
  writeIleChapterWorkCanvas,
  withIleWorkCanvasGridAppState,
  emptyIleWorkCanvasScene,
  ILE_CHAPTER_SEED_CUSTOM_DATA_KEY,
  ILE_WORK_CANVAS_DEFAULT_GRID_SIZE,
  ILE_WORK_CANVAS_FONT_FAMILY,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  wrapIleWorkCanvasText,
  ILE_XAI_LOADING_CUSTOM_DATA_KEY,
  ILE_XAI_LOADING_TEXT,
  buildIleWorkCanvasAskUserMessage,
  createIleXaiLoadingPlaceholder,
  replaceIleXaiLoadingPlaceholder,
  ILE_LEARN_MORE_BOX_HEIGHT,
  ILE_LEARN_MORE_BOX_WIDTH,
  ILE_LEARN_MORE_GAP,
  ILE_LEARN_MORE_LABEL,
  ILE_LEARN_MORE_VIEWPORT_PAD,
  ILE_XAI_LOADING_BOX_HEIGHT,
  ILE_XAI_LOADING_BOX_WIDTH,
  ILE_XAI_LOADING_CLEARANCE,
  ILE_XAI_LOADING_GAP,
  clampIleLearnMorePosition,
  ileLearnMorePromptPlacement,
  ileLearnMoreSelectionKey,
  ileWorkCanvasEmptyNearbyOrigin,
  ileWorkCanvasPointerBusy,
  ileWorkCanvasRectsOverlap,
  placeIleLearnMorePrompt,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import { buildIleSessionChatBody } from "@/lib/session-chat-client";
import {
  buildIleExcalidrawToolUploadItem,
  buildIleNotebookUploadItem,
} from "@/lib/ile-realtime-pow";
import {
  ILE_SURFACE,
  ILE_TOOLS_BLOCK,
  ILE_CONTEXT_BODY,
  buildIleHeliosChatSystemPrompt,
} from "@/lib/prompt-kernel";
import { DEFAULT_PROMPTS } from "@/lib/prompts";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1d00e45436b7/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, { encoding: "utf8" });
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function sceneWith(id: string, text = id): IleWorkCanvasScene {
  return {
    elements: convertToExcalidrawElements([{ type: "text", text, x: 10, y: 10, id }]),
    appState: { zoom: { value: 1 } },
    files: {},
  };
}

describe("ILE Work canvas grid default (shipped)", () => {
  it("enables Excalidraw grid on empty and restored scenes", () => {
    const empty = emptyIleWorkCanvasScene();
    expect(empty.appState.gridModeEnabled).toBe(true);
    expect(empty.appState.gridSize).toBe(ILE_WORK_CANVAS_DEFAULT_GRID_SIZE);
    expect(empty.appState.currentItemStrokeColor).toBe("#1e1e1e");
    expect(empty.appState.currentItemFontFamily).toBe(ILE_WORK_CANVAS_FONT_FAMILY);
    expect(ILE_WORK_CANVAS_FONT_FAMILY).toBe(6);

    const restored = serializeIleWorkCanvasScene({
      elements: [],
      appState: { zoom: { value: 1 } },
      files: {},
    });
    expect(restored.appState.gridModeEnabled).toBe(true);
    expect(restored.appState.gridSize).toBe(ILE_WORK_CANVAS_DEFAULT_GRID_SIZE);

    const forced = withIleWorkCanvasGridAppState({ gridModeEnabled: false, gridSize: 40 });
    expect(forced.gridModeEnabled).toBe(true);
    expect(forced.gridSize).toBe(40);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("withIleWorkCanvasGridAppState");
    expect(canvas).toContain("@/app/ile-excalidraw-theme.css");
    const globals = read("app/globals.css");
    expect(globals).toContain("ile-excalidraw-theme.css");
    const css = read("app/ile-excalidraw-theme.css");
    expect(css).toContain("[data-ile-excalidraw-host] .excalidraw");
    expect(css).toContain("[data-ile-excalidraw-host] .excalidraw.theme--dark");
    expect(css).toContain("--color-primary-contrast-offset");
    expect(css).toContain("--color-primary-light: #2a2a2a !important");
    expect(css).toContain("--color-surface-primary-container: #3a3a3a !important");
    expect(css).toContain("--button-selected-bg: #3a3a3a !important");
    expect(css).toContain("--color-selection: #111111 !important");
    expect(css).toContain(".ToolIcon_type_radio:checked + .ToolIcon__icon");
    expect(css).toContain("button.standalone.active");
    expect(css).not.toContain("#a8a5ff");
    expect(css).not.toContain("#4f4d6f");
    expect(css).not.toContain("#403e6a");
    expect(css).not.toContain("#bbb8ff");
  });
});

describe("ILE Work canvas chapter isolation (shipped)", () => {
  it("keeps two chapter keys on distinct scenes; completed chapter restores non-empty board", () => {
    const store = createIleWorkCanvasChapterStore();
    const sceneA = sceneWith("draw-chA", "chapter A notes");
    const sceneB = sceneWith("draw-chB", "chapter B notes");
    writeIleChapterWorkCanvas(store, "chapter-a", sceneA);
    expect(readIleChapterWorkCanvas(store, "chapter-a").elements.map((el) => el.id)).toEqual(
      sceneA.elements.map((el) => el.id),
    );

    writeIleChapterWorkCanvas(store, "chapter-b", sceneB);
    const readB = readIleChapterWorkCanvas(store, "chapter-b");
    expect(readB.elements.some((el) => el.text === "chapter B notes")).toBe(true);
    expect(readB.elements.some((el) => el.text === "chapter A notes")).toBe(false);

    const readA = readIleChapterWorkCanvas(store, "chapter-a");
    expect(readA.elements.some((el) => el.text === "chapter A notes")).toBe(true);
    expect(readA.elements.some((el) => el.text === "chapter B notes")).toBe(false);

    store.focus("chapter-b");
    const restoredDone = restoreIleChapterWorkCanvas(store.map, store.cold, "chapter-a");
    expect(restoredDone.elements.length).toBeGreaterThan(0);
    expect(restoredDone.elements.some((el) => el.text === "chapter A notes")).toBe(true);
    expect(serializeIleWorkCanvasScene(restoredDone).appState).not.toHaveProperty("collaborators");
  });
});

describe("ILE Work canvas chapter seed (shipped)", () => {
  it("places chapter text as a type:text element on an empty board and does not overwrite existing work", () => {
    const empty = serializeIleWorkCanvasScene(null);
    const seeded = seedIleChapterWorkCanvas(empty, {
      text: "Walk a case through just-war criteria",
      chapterId: "chapter-a",
    });
    expect(seeded.seeded).toBe(true);
    const textEl = seeded.scene.elements.find((el) => el.type === "text");
    expect(textEl?.originalText).toBe("Walk a case through just-war criteria");
    expect(textEl?.fontFamily).toBe(ILE_WORK_CANVAS_FONT_FAMILY);
    expect(textEl?.autoResize).toBe(false);
    expect(textEl?.width).toBe(ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
    expect(textEl?.customData).toMatchObject({
      [ILE_CHAPTER_SEED_CUSTOM_DATA_KEY]: true,
      author: "chapter",
      chapterId: "chapter-a",
    });

    const again = seedIleChapterWorkCanvas(seeded.scene, {
      text: "Walk a case through just-war criteria",
      chapterId: "chapter-a",
    });
    expect(again.seeded).toBe(false);
    expect(again.scene.elements).toHaveLength(seeded.scene.elements.length);

    const store = createIleWorkCanvasChapterStore();
    writeIleChapterWorkCanvas(store, "chapter-a", seeded.scene);
    const other = seedIleChapterWorkCanvas(null, {
      text: "Define the rotation invariant",
      chapterId: "chapter-b",
    });
    writeIleChapterWorkCanvas(store, "chapter-b", other.scene);
    expect(readIleChapterWorkCanvas(store, "chapter-a").elements.some((el) => el.originalText === "Walk a case through just-war criteria")).toBe(true);
    expect(readIleChapterWorkCanvas(store, "chapter-b").elements.some((el) => el.originalText === "Define the rotation invariant")).toBe(true);
    expect(readIleChapterWorkCanvas(store, "chapter-a").elements.some((el) => el.originalText === "Define the rotation invariant")).toBe(false);

    expect(seedIleChapterWorkCanvas(null, { text: "   ", chapterId: "c" }).seeded).toBe(false);

    const view = read("components/SessionView.tsx");
    expect(view).toContain("seedIleChapterWorkCanvas");
    expect(view).toContain("seedChapterWorkCanvas(stepId, step?.description)");
  });
});

describe("ILE Work canvas ask-XAI on selection (shipped)", () => {
  it("places a loading text item then replaces it with the XAI reply", () => {
    const selected = convertToExcalidrawElements([
      { type: "text", text: "just-war criteria", x: 10, y: 20 },
    ]);
    const message = buildIleWorkCanvasAskUserMessage({
      prompt: "What is missing?",
      selectedElements: selected,
    });
    expect(message).toContain("What is missing?");
    expect(message).toContain("[text] just-war criteria");

    const loading = createIleXaiLoadingPlaceholder({
      x: 200,
      y: 20,
      turnId: "ask-1",
    });
    expect(loading.type).toBe("text");
    expect(ILE_XAI_LOADING_TEXT).toBe("Thinking ...");
    expect(loading.text).toBe(ILE_XAI_LOADING_TEXT);
    expect(loading.text).not.toMatch(/Asking XAI/i);
    expect(loading.customData).toMatchObject({
      [ILE_XAI_LOADING_CUSTOM_DATA_KEY]: true,
      turnId: "ask-1",
      pending: true,
    });

    const withLoading: IleWorkCanvasScene = {
      elements: [...selected, loading],
      appState: {},
      files: {},
    };
    const replied = replaceIleXaiLoadingPlaceholder(withLoading, "ask-1", {
      text: "Add the last-resort clause.",
      turnId: "ask-1",
    });
    expect(replied.elements.some((el) => el.text === ILE_XAI_LOADING_TEXT)).toBe(false);
    const reply = replied.elements.find((el) => el.text === "Add the last-resort clause.");
    expect(reply?.type).toBe("text");
    expect(reply?.x).toBe(loading.x);
    expect(reply?.y).toBe(loading.y);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("data-ile-excalidraw-ask");
    expect(canvas).toContain("data-ile-learn-more");
    expect(canvas).toContain("ILE_LEARN_MORE_LABEL");
    expect(canvas).toContain("ileLearnMorePromptPlacement");
    expect(canvas).toContain("clampIleLearnMorePosition");
    expect(canvas).toContain("setPointerCapture");
    expect(canvas).toContain("data-ile-learn-more-handle");
    expect(canvas).toContain("data-ile-learn-more-dragging");
    expect(canvas).toContain("ileWorkCanvasPointerBusy");
    expect(canvas).toContain("pointer-events-none");
    expect(canvas).toContain("IleExcalidrawMount");
    expect(canvas).toContain("Prompt a question about this selection");
    expect(canvas).not.toContain("Ask XAI about");
    expect(canvas).not.toContain("renderTopRightUI");
    expect(canvas).toContain("ileWorkCanvasEmptyNearbyOrigin");
    expect(canvas).toContain("data-ile-canvas-thinking");
    expect(canvas).toContain("ileHeliosThinkingLine");
    expect(canvas).toContain("applyIleXaiTurnToWorkCanvas");
    expect(canvas).not.toContain("createIleXaiLoadingPlaceholder");
    const view = read("components/SessionView.tsx");
    expect(view).toContain("onAskSelected={handleAskCanvasSelection}");
    expect(view).toContain("buildIleWorkCanvasAskUserMessage");
  });

  it("floats Learn more under the selection and keeps it inside the canvas viewport", () => {
    expect(ILE_LEARN_MORE_LABEL).toBe("Expand More");
    expect(ILE_LEARN_MORE_GAP).toBe(8);
    const viewport = { left: 64, top: 8, width: 800, height: 600 };
    const below = placeIleLearnMorePrompt({
      selection: { left: 300, top: 120, right: 420, bottom: 180 },
      viewport,
    });
    expect(below).not.toBeNull();
    expect(below!.left).toBe(Math.round((300 + 420) / 2 - ILE_LEARN_MORE_BOX_WIDTH / 2));
    expect(below!.top).toBe(180 + ILE_LEARN_MORE_GAP);

    const nearBottom = placeIleLearnMorePrompt({
      selection: { left: 300, top: 520, right: 420, bottom: 580 },
      viewport,
    });
    expect(nearBottom!.top).toBe(520 - ILE_LEARN_MORE_GAP - ILE_LEARN_MORE_BOX_HEIGHT);
    expect(nearBottom!.top).toBeGreaterThanOrEqual(viewport.top + ILE_LEARN_MORE_VIEWPORT_PAD);

    const nearRight = placeIleLearnMorePrompt({
      selection: { left: 780, top: 80, right: 860, bottom: 140 },
      viewport,
    });
    expect(nearRight!.left).toBe(
      viewport.left + viewport.width - ILE_LEARN_MORE_BOX_WIDTH - ILE_LEARN_MORE_VIEWPORT_PAD,
    );
    expect(nearRight!.left + ILE_LEARN_MORE_BOX_WIDTH).toBeLessThanOrEqual(
      viewport.left + viewport.width - ILE_LEARN_MORE_VIEWPORT_PAD,
    );

    const offLeft = placeIleLearnMorePrompt({
      selection: { left: -200, top: 80, right: -40, bottom: 140 },
      viewport,
    });
    expect(offLeft!.left).toBe(viewport.left + ILE_LEARN_MORE_VIEWPORT_PAD);
    expect(offLeft!.top).toBeGreaterThanOrEqual(viewport.top + ILE_LEARN_MORE_VIEWPORT_PAD);

    const selected = convertToExcalidrawElements([
      { type: "text", text: "just-war", x: 100, y: 80, width: 120, height: 40 },
    ]);
    const el = selected[0]!;
    const placed = ileLearnMorePromptPlacement({
      elements: selected,
      selectedElementIds: { [el.id]: true },
      appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0, offsetLeft: 64, offsetTop: 8, width: 800, height: 600 },
    });
    expect(placed?.count).toBe(1);
    expect(placed!.left).toBeGreaterThanOrEqual(64 + ILE_LEARN_MORE_VIEWPORT_PAD);
    expect(placed!.top).toBe(Math.round(8 + el.y + el.height + ILE_LEARN_MORE_GAP));

    expect(ileLearnMoreSelectionKey({ a: true, c: true, b: false })).toBe("a,c");
    const dragged = clampIleLearnMorePosition({
      left: 900,
      top: -40,
      viewport,
    });
    expect(dragged.left).toBe(
      viewport.left + viewport.width - ILE_LEARN_MORE_BOX_WIDTH - ILE_LEARN_MORE_VIEWPORT_PAD,
    );
    expect(dragged.top).toBe(viewport.top + ILE_LEARN_MORE_VIEWPORT_PAD);

    expect(ileWorkCanvasPointerBusy({ cursorButton: "down" })).toBe(true);
    expect(ileWorkCanvasPointerBusy({ cursorButton: "up", isResizing: true })).toBe(true);
    expect(ileWorkCanvasPointerBusy({ cursorButton: "up", draggingElement: { id: "el" } })).toBe(true);
    expect(ileWorkCanvasPointerBusy({ cursorButton: "up" })).toBe(false);
  });

  it("parks the thinking chip in empty space beside the closest object", () => {
    const selected = {
      id: "sel",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      isDeleted: false,
    };
    const open = ileWorkCanvasEmptyNearbyOrigin({
      elements: [selected],
      near: [selected],
    });
    expect(open).toEqual({ x: 100 + ILE_XAI_LOADING_GAP, y: 0 });

    const blocker = {
      id: "block",
      type: "rectangle",
      x: 120,
      y: 0,
      width: 80,
      height: 40,
      isDeleted: false,
    };
    const shifted = ileWorkCanvasEmptyNearbyOrigin({
      elements: [selected, blocker],
      near: [selected],
    });
    const chip = {
      minX: shifted.x,
      minY: shifted.y,
      maxX: shifted.x + ILE_XAI_LOADING_BOX_WIDTH,
      maxY: shifted.y + ILE_XAI_LOADING_BOX_HEIGHT,
    };
    expect(
      ileWorkCanvasRectsOverlap(chip, {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 40,
      }, ILE_XAI_LOADING_CLEARANCE),
    ).toBe(false);
    expect(
      ileWorkCanvasRectsOverlap(chip, {
        minX: 120,
        minY: 0,
        maxX: 200,
        maxY: 40,
      }, ILE_XAI_LOADING_CLEARANCE),
    ).toBe(false);
    expect(shifted.y).toBeGreaterThanOrEqual(40 + ILE_XAI_LOADING_GAP);
  });
});

describe("ILE Work canvas text wrap (shipped)", () => {
  it("wraps long seed and XAI replies into a narrow box instead of one line", () => {
    const long =
      "When this chapter feels solid after a multi-turn guided conversation, invite Mark as Done and open the next adjacent chapter about just-war last resort.";
    const wrapped = wrapIleWorkCanvasText(long);
    expect(wrapped.lineCount).toBeGreaterThan(1);
    expect(wrapped.width).toBe(ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
    expect(wrapped.text.split("\n").every((line) => line.length <= 40)).toBe(true);
    expect(wrapped.originalText).toBe(long);
    expect(wrapped.text).not.toBe(long);

    const seeded = seedIleChapterWorkCanvas(null, { text: long, chapterId: "ch-wrap" });
    const seedText = seeded.scene.elements.find((el) => el.type === "text");
    expect(seedText?.autoResize).toBe(false);
    expect(seedText?.width).toBe(ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
    expect(String(seedText?.text || "").includes("\n")).toBe(true);
    expect(seedText?.originalText).toBe(long);

    const applied = applyIleXaiTurnToWorkCanvas(null, { text: long, turnId: "t-wrap" });
    const reply = applied.elements.find((el) => el.originalText === long);
    expect(reply?.autoResize).toBe(false);
    expect(reply?.width).toBe(ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
    expect(String(reply?.text || "").split("\n").length).toBeGreaterThan(1);
  });
});

describe("ILE Work canvas XAI apply (shipped convertToExcalidrawElements wrapper)", () => {
  it("appends a real type:text element from the XAI response plus optional shapes", () => {
    const existing = sceneWith("user-1", "learner sketch");
    const next = applyIleXaiTurnToWorkCanvas(existing, {
      text: "Here is the next move: label the invariant.",
      elements: [{ type: "rectangle", x: 40, y: 200, width: 120, height: 60 }],
      turnId: "turn-9",
    });
    const texts = next.elements.filter((el) => el.type === "text");
    expect(texts.some((el) => el.originalText === "Here is the next move: label the invariant.")).toBe(true);
    expect(next.elements.some((el) => el.type === "rectangle")).toBe(true);
    const xaiText = texts.find((el) => el.originalText === "Here is the next move: label the invariant.");
    expect(xaiText?.type).toBe("text");
    expect(typeof xaiText?.id).toBe("string");
    expect(xaiText?.customData).toMatchObject({ author: "xai", turnId: "turn-9" });
    expect(JSON.stringify(next)).toContain('"type":"text"');

    const converted = convertToExcalidrawElements([{ type: "text", text: "wrapper", x: 1, y: 2 }]);
    expect(converted[0]?.type).toBe("text");
    expect(converted[0]?.text).toBe("wrapper");

    const parsed = parseIleXaiCanvasTurn(
      '{"text":"Coach reply","elements":[{"type":"arrow","x":0,"y":0,"width":80,"height":0}]}',
    );
    expect(parsed.text).toBe("Coach reply");
    expect(parsed.elements?.[0]?.type).toBe("arrow");
  });
});

describe("ILE session-chat board context (shipped builder)", () => {
  it("sends the full current scene on a turn and a mutated scene on the next", () => {
    const first = sceneWith("el-1", "first board");
    first.appState = { zoom: { value: 1 }, collaborators: { skip: true } };
    const body1 = buildIleSessionChatBody({
      problem: "BST insert",
      messages: [{ role: "user", content: "turn one" }],
      sessionId: "s1",
      activeStepId: "chapter-a",
      workCanvasScene: first,
    });
    const scene1 = body1.workCanvasScene as IleWorkCanvasScene;
    expect(scene1.elements.some((el) => el.text === "first board")).toBe(true);
    expect(scene1.appState).not.toHaveProperty("collaborators");
    expect(ileWorkCanvasTurnContextMessage(first)).toContain("first board");

    const mutated = applyIleXaiTurnToWorkCanvas(first, { text: "coach on turn 1" });
    const body2 = buildIleSessionChatBody({
      problem: "BST insert",
      messages: [
        { role: "user", content: "turn one" },
        { role: "assistant", content: "coach on turn 1" },
        { role: "user", content: "turn two" },
      ],
      sessionId: "s1",
      activeStepId: "chapter-a",
      workCanvasScene: mutated,
    });
    const scene2 = body2.workCanvasScene as IleWorkCanvasScene;
    expect(scene2.elements.some((el) => el.text === "coach on turn 1")).toBe(true);
    expect(JSON.stringify(scene2)).not.toBe(JSON.stringify(scene1));
    expect(scene2.elements.length).toBeGreaterThan(scene1.elements.length);

    const route = read("app/api/session-chat/route.ts");
    expect(route).toContain("workCanvasScene");
    expect(route).toContain("ileWorkCanvasTurnContextMessage");
    expect(route).toContain("canvasElements");
    const client = read("lib/session-chat-client.ts");
    expect(client).toContain("workCanvasScene");
    expect(client).toContain("serializeIleWorkCanvasScene");
    const view = read("components/SessionView.tsx");
    expect(view).toContain("workCanvasScene: currentScene");
    expect(view).toContain("applyIleXaiTurnToWorkCanvas");
    expect(view).toContain("pickIleWorkCanvasTurnScene");
    expect(view).toContain("picked.applyLive");
  });

  it("sends chapter B's stored scene and does not apply live onto focused chapter A", () => {
    const store = createIleWorkCanvasChapterStore();
    const sceneA = sceneWith("el-a", "board A");
    const sceneB = sceneWith("el-b", "board B");
    writeIleChapterWorkCanvas(store, "chapter-a", sceneA);
    writeIleChapterWorkCanvas(store, "chapter-b", sceneB);
    store.focus("chapter-a");

    const liveScenes = ileWorkCanvasScenesFromWorkspaces(store.map);
    const coldScenes = ileWorkCanvasScenesFromWorkspaces(store.cold);
    expect(liveScenes["chapter-b"]).toBeNull();
    expect(coldScenes["chapter-b"]?.elements.some((el) => el.text === "board B")).toBe(true);

    const focusedRef = { current: sceneA };
    const pickB = pickIleWorkCanvasTurnScene({
      targetChapterId: "chapter-b",
      focusedChapterId: "chapter-a",
      liveSceneByChapter: liveScenes,
      coldSceneByChapter: coldScenes,
      focusedSceneRef: focusedRef,
    });
    expect(pickB.applyLive).toBe(false);
    expect(pickB.sceneToSend.elements.some((el) => el.text === "board B")).toBe(true);
    expect(pickB.sceneToSend.elements.some((el) => el.text === "board A")).toBe(false);

    const bodyB = buildIleSessionChatBody({
      problem: "two open works",
      messages: [{ role: "user", content: "end turn B" }],
      sessionId: "s-parallel",
      activeStepId: "chapter-b",
      workCanvasScene: pickB.sceneToSend,
    });
    const sentB = bodyB.workCanvasScene as IleWorkCanvasScene;
    expect(sentB.elements.some((el) => el.text === "board B")).toBe(true);
    expect(sentB.elements.some((el) => el.text === "board A")).toBe(false);

    const pickA = pickIleWorkCanvasTurnScene({
      targetChapterId: "chapter-a",
      focusedChapterId: "chapter-a",
      liveSceneByChapter: liveScenes,
      coldSceneByChapter: coldScenes,
      focusedSceneRef: focusedRef,
    });
    expect(pickA.applyLive).toBe(true);
    expect(pickA.sceneToSend.elements.some((el) => el.text === "board A")).toBe(true);
    expect(pickA.sceneToSend.elements.some((el) => el.text === "board B")).toBe(false);

    const appliedOnA = applyIleXaiTurnToWorkCanvas(pickB.sceneToSend, {
      text: "reply meant for B",
    });
    expect(appliedOnA.elements.some((el) => el.text === "reply meant for B")).toBe(true);
    expect(pickA.applyLive && pickB.applyLive).toBe(false);
  });
});

describe("ILE Excalidraw-tool PoW (shipped)", () => {
  it("maps Excalidraw tools and does not emit notebook / grokipedia / dantes", () => {
    expect(mapExcalidrawToolToIlePow({ activeTool: "text" })).toEqual({
      toolName: "text",
      toolAction: "text",
    });
    expect(mapExcalidrawToolToIlePow({ activeTool: "freedraw" })).toEqual({
      toolName: "freedraw",
      toolAction: "freedraw",
    });
    expect(mapExcalidrawToolToIlePow({ elementType: "rectangle" })).toEqual({
      toolName: "rectangle",
      toolAction: "rectangle",
    });
    expect(mapExcalidrawToolToIlePow({ activeTool: "notebook" })).toBeNull();
    expect(mapExcalidrawToolToIlePow({ activeTool: "grokipedia" })).toBeNull();
    expect(mapExcalidrawToolToIlePow({ activeTool: "dantes" })).toBeNull();
    expect(isRetiredIleWorkToolName("notebook")).toBe(true);

    const item = buildIleExcalidrawToolUploadItem("session-1", {
      activeTool: "text",
      timestampMs: 42,
    });
    expect(item?.toolName).toBe("text");
    expect(item?.toolAction).toBe("text");
    expect(item?.toolName).not.toBe("notebook");

    expect(buildIleExcalidrawToolUploadItem("session-1", { activeTool: "notebook" })).toBeNull();
    expect(buildIleExcalidrawToolUploadItem("session-1", { activeTool: "dantes" })).toBeNull();

    const legacy = buildIleNotebookUploadItem("session-1", "notes", 1);
    expect(legacy.toolName).toBe("notebook");

    const view = read("components/SessionView.tsx");
    expect(view).toContain("mapExcalidrawToolToIlePow");
    expect(view).toContain('via: "excalidraw"');
    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).not.toContain("buildIleNotebookUploadItem");
  });
});

describe("ILE prompts describe one chapter canvas (shipped)", () => {
  it("drops Notebook / Grokipedia / Dantes as ILE tools", () => {
    const chat = buildIleHeliosChatSystemPrompt();
    for (const [label, text] of [
      ["ILE_SURFACE", ILE_SURFACE],
      ["ILE_TOOLS_BLOCK", ILE_TOOLS_BLOCK],
      ["ILE_CONTEXT_BODY", ILE_CONTEXT_BODY],
      ["heliosChat", chat],
      ["opening_probe", DEFAULT_PROMPTS.opening_probe],
      ["probe_generation", DEFAULT_PROMPTS.probe_generation],
    ] as const) {
      expect(text, label).toMatch(/chapter canvas|Work canvas|drawing tools/i);
      expect(text, label).not.toMatch(/Look up \[concept\] in Grokipedia/i);
      expect(text, label).not.toMatch(/Jot down your key insight in the Notebook/i);
      expect(text, label).not.toMatch(/Open Dantes/i);
    }
    expect(ILE_TOOLS_BLOCK).toMatch(/one shared Excalidraw board per chapter/i);
    expect(ILE_TOOLS_BLOCK).not.toMatch(/left sidebar/i);
    expect(chat).toMatch(/text block/i);
  });
});

describe("ILE Work chrome is canvas-only (shipped source)", () => {
  it("has no notebook / grokipedia / dantes Work tabs or panes", () => {
    const tabs = read("components/session-view/ile-chapter-tool-tabs.tsx");
    const panes = read("components/session-view/session-tool-panes.tsx");
    const chrome = read("components/session-view/session-chrome.tsx");
    const view = read("components/SessionView.tsx");
    expect(tabs).not.toContain("Grokipedia");
    expect(tabs).not.toContain("Dantes");
    expect(tabs).not.toContain('"notebook"');
    expect(panes).not.toContain("DantesTool");
    expect(panes).not.toContain("GrokGrokipediaTool");
    expect(panes).not.toContain("session.notebookPlaceholder");
    expect(panes).not.toContain("<ExcalidrawCanvas");
    expect(chrome).toContain("workCanvas");
    expect(chrome).not.toContain("IleChapterToolTabs");
    expect(view).toContain("renderWorkCanvas");
    expect(view).toContain("ileChapterCanvasRemountKey");
    expect(view).toContain("<ExcalidrawCanvas");
    expect(view).toContain("applyIleXaiTurnToWorkCanvas");
    writeScratch(
      "ile-work-canvas-structure.txt",
      [
        "Work chrome: canvas-only, no IleChapterToolTabs",
        "session-tool-panes: no DantesTool / GrokGrokipediaTool / notebook textarea",
        "ExcalidrawCanvas mounted from SessionView renderWorkCanvas, remount key chapter-scoped",
        "prompts: one chapter canvas with drawing tools",
      ].join("\n"),
    );
  });
});
