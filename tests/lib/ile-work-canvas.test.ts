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
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasScenesFromWorkspaces,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasTurnContextMessage,
  ileWorkCanvasXaiShapeType,
  ileWorkCanvasXaiToolsInstruction,
  ILE_EXCALIDRAW_POW_TOOLS,
  ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS,
  ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION,
  ILE_XAI_CANVAS_SHAPE_TYPES,
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
  ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP,
  ILE_CANVAS_PROMPT_BAR_GAP,
  ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR,
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
  ileCanvasPromptBarTop,
  ileLearnMoreFollowOffset,
  ileLearnMoreFollowPosition,
  ileLearnMorePromptPlacement,
  ileLearnMoreSelectionKey,
  ileLearnMoreVisiblePlacement,
  ileWorkCanvasCenterScroll,
  ileWorkCanvasZoomAtPoint,
  ileWorkCanvasContentBounds,
  ileWorkCanvasEmptyNearbyOrigin,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasPointerBusy,
  ileWorkCanvasQuickActionPrompt,
  ileWorkCanvasRectsOverlap,
  ileWorkCanvasSplitTextChunks,
  ileWorkCanvasThinkingOccupancy,
  ileWorkCanvasIncomingClearsLiveScene,
  ileWorkCanvasShouldRestoreEmptyBoard,
  ileWorkCanvasWorkspaceFromChatBody,
  ileWorkCanvasViewportToHost,
  ileWorkCanvasWithScrollToContent,
  mergeIleXaiTurnOntoLiveWorkCanvas,
  placeIleLearnMorePrompt,
  splitIleWorkCanvasSelectedText,
  splitIleWorkCanvasTextElement,
  ILE_WORK_CANVAS_STAY_ON_DOMAIN,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import { assemblePromptWorkspaceContext } from "@/lib/prompt-workspace-context";
import { ileHeliosThinkingLine } from "@/lib/ile-dialogue-turn";
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
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-43f631c11586/implementer";

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
    expect(seeded.scene.appState).not.toHaveProperty("scrollX");
    expect(seeded.scene.appState).not.toHaveProperty("scrollY");
    expect(seeded.scene).not.toHaveProperty("scrollToContent");
  });
});

describe("ILE Work canvas center on open (shipped)", () => {
  it("centers first-time XAI/chapter text in the viewport and scrolls once per board open", () => {
    const seeded = seedIleChapterWorkCanvas(null, {
      text: "Walk a case through just-war criteria",
      chapterId: "chapter-center",
    });
    const textEl = seeded.scene.elements.find((el) => el.type === "text");
    expect(textEl).toBeTruthy();
    const bounds = ileWorkCanvasContentBounds(seeded.scene.elements);
    expect(bounds).toBeTruthy();
    expect(bounds!.minX).toBe(textEl!.x);
    expect(bounds!.minY).toBe(textEl!.y);

    expect(ileWorkCanvasCenterScroll(bounds, null)).toBeNull();
    expect(ileWorkCanvasCenterScroll(bounds, { width: 0, height: 600 })).toBeNull();
    expect(ileWorkCanvasCenterScroll(null, { width: 800, height: 600 })).toBeNull();

    const viewport = { width: 800, height: 600, zoom: { value: 1 } };
    const scroll = ileWorkCanvasCenterScroll(bounds, viewport);
    expect(scroll).toEqual({
      scrollX: viewport.width / 2 - (bounds!.minX + bounds!.maxX) / 2,
      scrollY: viewport.height / 2 - (bounds!.minY + bounds!.maxY) / 2,
    });
    expect(scroll!.scrollX).not.toBe(0);
    expect(scroll!.scrollY).not.toBe(0);

    const empty = ileWorkCanvasWithScrollToContent(emptyIleWorkCanvasScene());
    expect(empty).not.toHaveProperty("scrollToContent");
    const withFlag = ileWorkCanvasWithScrollToContent(seeded.scene);
    expect(withFlag.scrollToContent).toBe(true);
    expect(ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS).toEqual({ animate: false });

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileWorkCanvasWithScrollToContent");
    expect(canvas).toContain("scheduleCenterOnOpen");
    expect(canvas).toContain("centeredOnOpenRef");
    expect(canvas).toContain("scrollToContent");
    expect(canvas).toContain("ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS");
    expect(canvas).toContain("api.scrollToContent(elements, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS)");
  });
});

describe("ILE Work canvas zoom at point (shipped)", () => {
  it("increases zoom for negative wheel delta and keeps the cursor scene point", () => {
    const before = { zoom: 1, scrollX: 40, scrollY: 20, offsetLeft: 0, offsetTop: 0 };
    const cursor = { viewportX: 200, viewportY: 150 };
    const sceneX = (cursor.viewportX - before.offsetLeft) / before.zoom - before.scrollX;
    const sceneY = (cursor.viewportY - before.offsetTop) / before.zoom - before.scrollY;
    const zoomed = ileWorkCanvasZoomAtPoint({
      ...before,
      ...cursor,
      deltaY: -40,
    });
    expect(zoomed.zoom).toBeGreaterThan(before.zoom);
    const afterX = (cursor.viewportX - before.offsetLeft) / zoomed.zoom - zoomed.scrollX;
    const afterY = (cursor.viewportY - before.offsetTop) / zoomed.zoom - zoomed.scrollY;
    expect(afterX).toBeCloseTo(sceneX, 6);
    expect(afterY).toBeCloseTo(sceneY, 6);
    const out = ileWorkCanvasZoomAtPoint({ ...before, ...cursor, deltaY: 40 });
    expect(out.zoom).toBeLessThan(before.zoom);
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
    expect(message).toContain("Selected elements:");

    const boardWide = buildIleWorkCanvasAskUserMessage({
      prompt: "Add a worked example on the board.",
    });
    expect(boardWide).toContain("Add a worked example on the board.");
    expect(boardWide).toContain("Ask about the Work canvas.");
    expect(boardWide).not.toContain("Selected elements:");
    expect(boardWide).not.toContain("(none)");
    const emptySelection = buildIleWorkCanvasAskUserMessage({
      prompt: "Put a definition here.",
      selectedElements: [],
    });
    expect(emptySelection).toContain("Put a definition here.");
    expect(emptySelection).not.toContain("Selected elements:");

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
    expect(canvas).toContain("mergeIleXaiTurnOntoLiveWorkCanvas");
    expect(canvas).toContain("enqueueCanvasAskApply");
    expect(canvas).not.toContain("createIleXaiLoadingPlaceholder");
    expect(canvas).toContain("data-ile-canvas-prompt-bar");
    expect(canvas).toContain("ileCanvasPromptBarTop");
    expect(canvas).toContain("syncPromptBarPlacement");
    expect(canvas).toContain("style={{ top: promptBarTop }}");
    expect(canvas).toContain("ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR");
    expect(canvas).not.toContain("inset-x-0 bottom-3 z-[58]");
    expect(ileCanvasPromptBarTop({ bottom: 120 }, { top: 40 })).toBe(120 - 40 + ILE_CANVAS_PROMPT_BAR_GAP);
    expect(ileCanvasPromptBarTop(null, { top: 0 })).toBe(ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP);
    expect(ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR).toContain(".App-toolbar");
    expect(canvas).toContain("handleBoardAsk");
    expect(canvas).toContain("selectedElements: []");
    expect(canvas).toContain("ileWorkCanvasThinkingOverlayStyle");
    const view = read("components/SessionView.tsx");
    expect(view).toContain("onAskSelected={handleAskCanvasSelection}");
    expect(view).toContain("buildIleWorkCanvasAskUserMessage");
    writeScratch(
      "canvas-prompt-bar.log",
      [
        `selectionAsk=${message.includes("What is missing?") && message.includes("just-war criteria")}`,
        `boardAskHasQuestion=${boardWide.includes("Add a worked example on the board.")}`,
        `boardAskRequiresSelection=${boardWide.includes("Selected elements:")}`,
        "bar=data-ile-canvas-prompt-bar",
        "ileWires=onAskSelected={handleAskCanvasSelection}",
        "expandMore=data-ile-learn-more",
      ].join("\n") + "\n",
    );
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

    const ileInset = { left: 16, top: 96 };
    expect(ileWorkCanvasViewportToHost({ x: 80, y: 180 }, ileInset)).toEqual({ x: 64, y: 84 });
    const tight = ileLearnMorePromptPlacement({
      elements: selected,
      selectedElementIds: { [el.id]: true },
      appState: {
        zoom: { value: 1 },
        scrollX: 0,
        scrollY: 0,
        offsetLeft: ileInset.left,
        offsetTop: ileInset.top,
        width: 800,
        height: 600,
      },
      viewport: { left: 0, top: 0, width: 800, height: 600 },
      host: ileInset,
    });
    expect(tight!.top).toBe(Math.round(el.y + el.height + ILE_LEARN_MORE_GAP));
    expect(tight!.top).toBeLessThan(placed!.top);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileWorkCanvasViewportToHost");
    expect(canvas).toContain("ileWorkCanvasSelectionHostRect");
    expect(canvas).toContain("canvasHostOrigin()");

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

    const selection = { left: 100, top: 80, right: 220, bottom: 120 };
    const prompt = { left: 140, top: 128 };
    expect(ileLearnMoreFollowOffset(prompt, selection)).toEqual({ dx: 40, dy: 48 });
    expect(ileLearnMoreFollowPosition({ left: 160, top: 200 }, { dx: 40, dy: 48 })).toEqual({
      left: 200,
      top: 248,
    });
    expect(ileLearnMoreFollowOffset(null, selection)).toBeNull();
    expect(ileLearnMoreFollowPosition(null, { dx: 1, dy: 1 })).toBeNull();
    expect(canvas).toContain("ileLearnMoreFollowOffset");
    expect(canvas).toContain("ileLearnMoreFollowPosition");
    expect(canvas).toContain("paintLearnMoreUi");
    expect(canvas).toContain("learnMoreHostRef");
    expect(canvas).toContain('payload.button === "down" && api');
    expect(canvas).toContain("syncLearnMorePlacement(api.getSceneElements?.() ?? [], api.getAppState?.() ?? {})");
    expect(canvas).toContain("learnMorePinnedRef.current?.key !== selectionKey");
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

  it("parses and applies every Excalidraw shape XAI may emit, including aliases", () => {
    expect(ileWorkCanvasXaiShapeType("circle")).toBe("ellipse");
    expect(ileWorkCanvasXaiShapeType("box")).toBe("rectangle");
    expect(ileWorkCanvasXaiShapeType("scribble")).toBe("freedraw");
    expect(ileWorkCanvasXaiShapeType("eraser")).toBeNull();
    expect(ileWorkCanvasXaiShapeType("selection")).toBeNull();
    const parsed = parseIleXaiCanvasTurn(
      JSON.stringify({
        text: "Here is the diagram.",
        origin: { x: 40, y: 40 },
        elements: [
          { type: "rectangle", x: 40, y: 120, width: 100, height: 60, label: { text: "node" } },
          { type: "diamond", x: 160, y: 120, width: 80, height: 80 },
          { type: "circle", x: 260, y: 120, width: 70, height: 70 },
          { type: "arrow", x: 40, y: 200, width: 120, height: 0 },
          { type: "line", x: 40, y: 220, width: 80, height: 20 },
          { type: "frame", x: 20, y: 100, width: 340, height: 160 },
          { type: "freedraw", x: 40, y: 280, points: [[0, 0], [12, 8], [24, 0]] },
          { type: "eraser", x: 0, y: 0 },
        ],
      }),
    );
    expect(parsed.elements?.map((el) => el.type)).toEqual([
      "rectangle",
      "diamond",
      "ellipse",
      "arrow",
      "line",
      "frame",
      "freedraw",
    ]);
    const applied = applyIleXaiTurnToWorkCanvas(emptyIleWorkCanvasScene(), parsed);
    const types = new Set(applied.elements.map((el) => el.type));
    expect(types.has("rectangle")).toBe(true);
    expect(types.has("diamond")).toBe(true);
    expect(types.has("ellipse")).toBe(true);
    expect(types.has("arrow")).toBe(true);
    expect(types.has("line")).toBe(true);
    expect(types.has("frame")).toBe(true);
    expect(types.has("freedraw")).toBe(true);
    expect(types.has("text")).toBe(true);
    expect(applied.elements.some((el) => (el.originalText || el.text) === "node")).toBe(true);
    expect(applied.elements.some((el) => el.type === "eraser")).toBe(false);

    const tools = ileWorkCanvasXaiToolsInstruction();
    for (const tool of ILE_EXCALIDRAW_POW_TOOLS) {
      expect(tools).toContain(tool);
    }
    for (const shape of ILE_XAI_CANVAS_SHAPE_TYPES.filter((type) => type !== "image")) {
      expect(tools).toContain(shape);
    }
    const ctx = ileWorkCanvasTurnContextMessage(emptyIleWorkCanvasScene());
    expect(ctx).toContain(ileWorkCanvasXaiToolsInstruction());
    expect(ILE_TOOLS_BLOCK).toContain(ileWorkCanvasXaiToolsInstruction());
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
    const turnContext = ileWorkCanvasTurnContextMessage(first);
    expect(turnContext).toContain("first board");
    expect(turnContext).toContain(ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION);
    expect(turnContext).toContain('"origin": {"x": number, "y": number}');

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
  it("maps Excalidraw tools onto canvas actions and does not emit notebook / grokipedia / dantes", () => {
    expect(mapExcalidrawToolToIlePow({ activeTool: "text" })).toEqual({
      toolName: "canvas",
      toolAction: "draw_text",
    });
    expect(mapExcalidrawToolToIlePow({ activeTool: "freedraw" })).toEqual({
      toolName: "canvas",
      toolAction: "draw_freedraw",
    });
    expect(mapExcalidrawToolToIlePow({ elementType: "rectangle" })).toEqual({
      toolName: "canvas",
      toolAction: "draw_rectangle",
    });
    expect(mapExcalidrawToolToIlePow({ activeTool: "notebook" })).toBeNull();
    expect(mapExcalidrawToolToIlePow({ activeTool: "grokipedia" })).toBeNull();
    expect(mapExcalidrawToolToIlePow({ activeTool: "dantes" })).toBeNull();
    expect(isRetiredIleWorkToolName("notebook")).toBe(true);

    const item = buildIleExcalidrawToolUploadItem("session-1", {
      activeTool: "text",
      timestampMs: 42,
    });
    expect(item?.toolName).toBe("canvas");
    expect(item?.toolAction).toBe("draw_text");
    expect(item?.toolName).not.toBe("notebook");

    expect(buildIleExcalidrawToolUploadItem("session-1", { activeTool: "notebook" })).toBeNull();
    expect(buildIleExcalidrawToolUploadItem("session-1", { activeTool: "dantes" })).toBeNull();

    const legacy = buildIleNotebookUploadItem("session-1", "notes", 1);
    expect(legacy.toolName).toBe("notebook");

    const view = read("components/SessionView.tsx");
    expect(view).toContain("handleCanvasPowActions");
    expect(view).toContain("onCanvasPowActions=");
    expect(view).not.toContain("lastExcalidrawPowKeyRef");
    expect(view).toContain("shouldLogIleSidebarToolSwitch");
    const runtime = read("components/session-view/use-session-runtime.ts");
    expect(runtime).not.toContain("buildIleNotebookUploadItem");
    expect(runtime).not.toContain("lastUploadedNotebookHashRef");
    expect(runtime).not.toContain("notebookPowDebounceRef");
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
    expect(view).toContain("<WorkCanvas");
    expect(view).toContain('import { WorkCanvas } from "@/components/ExcalidrawCanvas"');
    expect(view).toContain("heliosBusy={isHeliosAssistantPending}");
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

describe("ILE Work canvas XAI suggested origin (shipped parse+apply)", () => {
  it("places JSON origin when finite and falls back when missing or invalid", () => {
    const existing = sceneWith("user-1", "learner sketch");
    const parsed = parseIleXaiCanvasTurn(
      JSON.stringify({
        text: "Park this beside the heap.",
        origin: { x: 420, y: 180 },
        elements: [{ type: "rectangle", x: 40, y: 200, width: 80, height: 40 }],
      }),
    );
    expect(parsed.text).toBe("Park this beside the heap.");
    expect(parsed.origin).toEqual({ x: 420, y: 180 });
    const placed = applyIleXaiTurnToWorkCanvas(existing, parsed);
    const reply = placed.elements.find((el) => el.originalText === "Park this beside the heap.");
    expect(reply?.x).toBe(420);
    expect(reply?.y).toBe(180);
    const extra = placed.elements.find((el) => el.type === "rectangle");
    expect(extra?.x).toBe(40);
    expect(extra?.y).toBe(200);

    const prose = parseIleXaiCanvasTurn("plain prose reply with no JSON");
    expect(ileWorkCanvasFiniteOrigin(prose.origin)).toBeNull();
    const stacked = applyIleXaiTurnToWorkCanvas(existing, prose);
    expect(stacked.elements.some((el) => (el.originalText || el.text) === "plain prose reply with no JSON")).toBe(
      true,
    );

    const invalid = parseIleXaiCanvasTurn(
      JSON.stringify({ text: "no coords", origin: { x: "nope", y: 1 } }),
    );
    expect(ileWorkCanvasFiniteOrigin(invalid.origin)).toBeNull();
    const fallback = applyIleXaiTurnToWorkCanvas(existing, invalid);
    expect(fallback.elements.some((el) => (el.originalText || el.text) === "no coords")).toBe(true);

    expect(ileWorkCanvasFiniteOrigin({ x: Number.POSITIVE_INFINITY, y: 0 })).toBeNull();
    expect(ileWorkCanvasFiniteOrigin({ x: 10, y: null })).toBeNull();

    const ctx = ileWorkCanvasTurnContextMessage(existing);
    expect(ctx).toContain("learner sketch");
    expect(ctx).toContain(ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION);

    writeScratch(
      "xai-canvas-origin.log",
      [
        `parsedOrigin=${JSON.stringify(parsed.origin)}`,
        `placedAt=${reply?.x},${reply?.y}`,
        `extraAt=${extra?.x},${extra?.y}`,
        `proseHasText=${stacked.elements.some((el) => (el.originalText || el.text) === "plain prose reply with no JSON")}`,
        `invalidFallsBack=${fallback.elements.some((el) => (el.originalText || el.text) === "no coords")}`,
        `contextAsksOrigin=${ctx.includes(ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION)}`,
      ].join("\n") + "\n",
    );
  });
});

describe("ILE Work canvas thinking overlay box (shipped occupancy+style)", () => {
  it("uses a fixed square that rotating copy cannot resize", () => {
    expect(ILE_XAI_LOADING_BOX_WIDTH).toBe(ILE_XAI_LOADING_BOX_HEIGHT);
    expect(ILE_XAI_LOADING_BOX_WIDTH).toBeGreaterThan(52);
    expect(ILE_XAI_LOADING_BOX_HEIGHT).toBeGreaterThan(52);
    const style = ileWorkCanvasThinkingOverlayStyle();
    expect(style.width).toBe(style.height);
    expect(style.width).toBe(ILE_XAI_LOADING_BOX_WIDTH);
    expect(style.height).toBe(ILE_XAI_LOADING_BOX_HEIGHT);
    expect(style.minWidth).toBe(ILE_XAI_LOADING_BOX_WIDTH);
    expect(style.minHeight).toBe(ILE_XAI_LOADING_BOX_HEIGHT);
    expect(style.maxWidth).toBe(ILE_XAI_LOADING_BOX_WIDTH);
    expect(style.maxHeight).toBe(ILE_XAI_LOADING_BOX_HEIGHT);
    expect(ileWorkCanvasThinkingOverlayStyle()).toEqual(style);
    expect(ileHeliosThinkingLine(0)).not.toBe(ileHeliosThinkingLine(1));
    expect(ileHeliosThinkingLine(0).length).not.toBe(ileHeliosThinkingLine(1).length);

    const selected = {
      id: "sel",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      isDeleted: false,
    };
    const occA = ileWorkCanvasEmptyNearbyOrigin({
      elements: [selected],
      near: [selected],
      box: { width: style.width, height: style.height },
    });
    const occB = ileWorkCanvasEmptyNearbyOrigin({
      elements: [selected],
      near: [selected],
      box: { width: ileWorkCanvasThinkingOverlayStyle().width, height: ileWorkCanvasThinkingOverlayStyle().height },
    });
    expect(occA).toEqual(occB);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileWorkCanvasThinkingOverlayStyle");
    expect(canvas).toContain("minWidth");
    expect(canvas).toContain("minHeight");
    expect(canvas).toContain("data-ile-canvas-thinking-chip");
    expect(canvas).toContain("overflow-hidden");

    writeScratch(
      "thinking-overlay-box.log",
      [
        `width=${style.width}`,
        `height=${style.height}`,
        `minWidth=${style.minWidth}`,
        `minHeight=${style.minHeight}`,
        `square=${style.width === style.height}`,
        `largerThanChip=${style.width > 52 && style.height > 52}`,
        `occupancyStable=${occA.x === occB.x && occA.y === occB.y}`,
        "markup=ileWorkCanvasThinkingOverlayStyle+minWidth+minHeight",
      ].join("\n") + "\n",
    );
  });
});

describe("ILE Work canvas parallel asks (shipped live merge)", () => {
  it("keeps both replies when applying onto the live scene instead of a stale snapshot", () => {
    const start = sceneWith("user-1", "learner sketch");
    const first = applyIleXaiTurnToWorkCanvas(start, {
      text: "first reply",
      turnId: "ask-a",
      origin: { x: 20, y: 200 },
    });
    const staleSecond = applyIleXaiTurnToWorkCanvas(start, {
      text: "second reply",
      turnId: "ask-b",
      origin: { x: 420, y: 200 },
    });
    expect(staleSecond.elements.some((el) => (el.originalText || el.text) === "first reply")).toBe(false);

    const live = mergeIleXaiTurnOntoLiveWorkCanvas(first, {
      text: "second reply",
      turnId: "ask-b",
      origin: { x: 420, y: 200 },
    });
    expect(live.elements.some((el) => (el.originalText || el.text) === "first reply")).toBe(true);
    expect(live.elements.some((el) => (el.originalText || el.text) === "second reply")).toBe(true);
    expect(live.elements.find((el) => (el.originalText || el.text) === "first reply")?.x).toBe(20);
    expect(live.elements.find((el) => (el.originalText || el.text) === "second reply")?.x).toBe(420);

    const block = { id: "block", x: 0, y: 0, width: 100, height: 40, isDeleted: false };
    const slotA = ileWorkCanvasEmptyNearbyOriginWithReserved({ elements: [block] });
    const slotB = ileWorkCanvasEmptyNearbyOriginWithReserved({
      elements: [block],
      reserved: [slotA],
    });
    expect(slotB).not.toEqual(slotA);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("mergeIleXaiTurnOntoLiveWorkCanvas");
    expect(canvas).toContain("enqueueCanvasAskApply");
    expect(canvas).toContain("ileWorkCanvasEmptyNearbyOriginWithReserved");
    expect(canvas).toContain("data-ile-canvas-thinking-id");
    expect(canvas).toContain("disabled={!askPrompt.trim()}");
    expect(canvas).toContain("disabled={!boardPrompt.trim()}");
    expect(canvas).not.toContain("disabled={askBusy");
    expect(canvas).not.toContain("if (!ask || !api || !prompt || askBusy)");
  });
});

describe("ILE and TAP Work canvas share one component (shipped)", () => {
  it("both hosts mount WorkCanvas with the same board features", () => {
    const canvas = read("components/ExcalidrawCanvas.tsx");
    const ile = read("components/SessionView.tsx");
    const tap = read("components/tap-score/tap-score-phases.tsx");
    expect(canvas).toContain("export function WorkCanvas(props: WorkCanvasProps)");
    expect(canvas).toContain("return <ExcalidrawCanvas {...props} />");
    expect(ile).toContain('import { WorkCanvas } from "@/components/ExcalidrawCanvas"');
    expect(tap).toContain('import { WorkCanvas } from "@/components/ExcalidrawCanvas"');
    expect(ile).not.toContain("<ExcalidrawCanvas");
    expect(tap).not.toContain("<ExcalidrawCanvas");
    const features = [
      "boardId=",
      "initialSceneData=",
      "applyElements=",
      "applyElementsNonce=",
      "heliosBusy=",
      "onSceneChange=",
      "onCanvasPowActions=",
      "onAskSelected=",
    ];
    for (const feature of features) {
      expect(ile).toContain(feature);
      expect(tap).toContain(feature);
    }
    expect(canvas).not.toContain("SessionView");
    expect(canvas).not.toContain("tap-score-phases");
    expect(canvas).not.toContain("session-chat-client");
    const lib = read("lib/ile-work-canvas.ts");
    expect(lib).not.toContain("SessionView");
    expect(lib).not.toContain("tap-score-phases");
    expect(lib).not.toContain("session-chat-client");
    writeScratch(
      "work-canvas-hosts.log",
      [
        "ILE SessionView mounts WorkCanvas with onAskSelected, heliosBusy, onSceneChange, onCanvasPowActions",
        "TAP tap-score-phases mounts WorkCanvas with onAskSelected, heliosBusy, onSceneChange, onCanvasPowActions",
        "canvas module does not import SessionView, tap-score-phases, or session-chat-client",
      ].join("\n") + "\n",
    );
  });
});

describe("ILE Work canvas thinking occupancy (shipped)", () => {
  it("keeps one overlay id when heliosBusy overlaps an in-flight canvas ask", () => {
    expect(
      ileWorkCanvasThinkingOccupancy({
        heliosBusy: true,
        canvasAskTurnIds: ["ask-1"],
      }),
    ).toEqual(["ask-1"]);
    expect(
      ileWorkCanvasThinkingOccupancy({
        heliosBusy: true,
        canvasAskTurnIds: [],
      }),
    ).toEqual(["helios"]);
    expect(
      ileWorkCanvasThinkingOccupancy({
        heliosBusy: false,
        canvasAskTurnIds: ["ask-1", "ask-2"],
      }),
    ).toEqual(["ask-1", "ask-2"]);
    expect(ileWorkCanvasThinkingOccupancy({ heliosBusy: false })).toEqual([]);
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileWorkCanvasThinkingOccupancy");
    expect(canvas).toContain('removeThinkingChip("helios")');
  });
});

describe("ILE Work canvas Expand More unselect (shipped)", () => {
  it("hides Expand More on empty selection even while pointer-busy", () => {
    expect(
      ileLearnMoreVisiblePlacement({
        selectedElementIds: {},
        pointerBusy: true,
        placed: { count: 1, left: 40, top: 80 },
      }),
    ).toBeNull();
    expect(
      ileLearnMoreVisiblePlacement({
        selectedElementIds: { "el-1": false },
        pointerBusy: true,
        placed: { count: 1, left: 40, top: 80 },
      }),
    ).toBeNull();
    const selected = convertToExcalidrawElements([
      { type: "text", text: "just-war", x: 100, y: 80, width: 120, height: 40 },
    ]);
    const el = selected[0]!;
    const placed = ileLearnMorePromptPlacement({
      elements: selected,
      selectedElementIds: { [el.id]: true },
      appState: { zoom: { value: 1 }, scrollX: 0, scrollY: 0, offsetLeft: 64, offsetTop: 8, width: 800, height: 600 },
    });
    expect(placed).not.toBeNull();
    expect(
      ileLearnMoreVisiblePlacement({
        selectedElementIds: { [el.id]: true },
        pointerBusy: false,
        placed,
      }),
    ).toEqual(placed);
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileLearnMoreVisiblePlacement");
  });
});

describe("ILE Work canvas workspace+block prompt context (shipped)", () => {
  it("ask-user and turn-context include workspace, focused block, and stay-on-domain language", () => {
    const workspace = {
      workspaceTitle: "Just War Ethics",
      workspaceGoal: "Apply last-resort tests to a live case",
      blockTitle: "Last resort",
      blockDescription: "Force is justified only after every peaceful option is exhausted.",
      chapterDescription: "Walk a case through just-war criteria",
    };
    const selected = convertToExcalidrawElements([
      { type: "text", text: "just-war criteria", x: 10, y: 20 },
    ]);
    const ask = buildIleWorkCanvasAskUserMessage({
      prompt: "What is missing?",
      selectedElements: selected,
      workspace,
    });
    expect(ask).toContain("Just War Ethics");
    expect(ask).toContain("Apply last-resort tests to a live case");
    expect(ask).toContain("Last resort");
    expect(ask).toContain("Force is justified only after every peaceful option is exhausted.");
    expect(ask).toContain(ILE_WORK_CANVAS_STAY_ON_DOMAIN);
    expect(ask).toMatch(/do not invent unrelated topics/i);
    expect(ask).toContain("What is missing?");
    expect(ask).toContain("[text] just-war criteria");

    const seeded = seedIleChapterWorkCanvas(null, {
      text: "Walk a case through just-war criteria",
      chapterId: "chapter-a",
    });
    const turn = ileWorkCanvasTurnContextMessage(seeded.scene, { workspace });
    expect(turn).toContain("Just War Ethics");
    expect(turn).toContain("Apply last-resort tests to a live case");
    expect(turn).toContain("Last resort");
    expect(turn).toContain("Force is justified only after every peaceful option is exhausted.");
    expect(turn).toContain(ILE_WORK_CANVAS_STAY_ON_DOMAIN);
    expect(turn).toContain("Walk a case through just-war criteria");

    const fromBody = ileWorkCanvasWorkspaceFromChatBody({
      workspaceContext: workspace,
      problem: "BST insert",
      activeStepDescription: "Walk a case through just-war criteria",
    });
    expect(fromBody.workspaceTitle).toBe("Just War Ethics");
    expect(fromBody.blockTitle).toBe("Last resort");
    const assembled = assemblePromptWorkspaceContext(fromBody);
    expect(assembled.contextBlock).toContain("Just War Ethics");
    expect(assembled.contextBlock).toContain("Last resort");

    const route = read("app/api/session-chat/route.ts");
    expect(route).toContain("assemblePromptWorkspaceContext");
    expect(route).toContain("ileWorkCanvasWorkspaceFromChatBody");
    expect(route).toContain("ileWorkCanvasTurnContextMessage");
    expect(route).toContain("assembledWorkspace");
    const client = read("lib/session-chat-client.ts");
    expect(client).toContain("workspaceContext");
    const view = read("components/SessionView.tsx");
    expect(view).toContain("workspaceContext: canvasWorkspaceContext");
    expect(view).toContain("workspace: canvasWorkspaceContext");
  });
});

describe("ILE Work canvas split + Expand More quick actions (shipped)", () => {
  it("splits a text element into 2 or 3 live blocks and keeps icon-only quick actions", () => {
    const source =
      "First clause names the last-resort test. Second clause names discrimination. Third clause names proportionality of means.";
    const chunks = ileWorkCanvasSplitTextChunks(source);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.length).toBeLessThanOrEqual(3);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(source.replace(/\s+/g, " "));

    const scene = {
      elements: convertToExcalidrawElements([{ type: "text", text: source, x: 40, y: 80 }]),
      appState: {},
      files: {},
    };
    const original = scene.elements[0]!;
    const split = splitIleWorkCanvasTextElement(scene, original);
    expect(split.split).toBe(true);
    const liveText = split.scene.elements.filter((el) => el.type === "text" && !el.isDeleted);
    expect(liveText.length).toBeGreaterThanOrEqual(2);
    expect(liveText.length).toBeLessThanOrEqual(3);
    expect(liveText.some((el) => el.id === original.id)).toBe(false);
    const joined = liveText
      .map((el) => String(el.originalText || el.text || ""))
      .join(" ")
      .replace(/\s+/g, " ");
    expect(joined).toBe(source.replace(/\s+/g, " "));

    const rect = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 80, height: 40 },
    ])[0]!;
    const noSplit = splitIleWorkCanvasSelectedText(scene, [rect]);
    expect(noSplit.split).toBe(false);
    expect(noSplit.scene.elements.map((el) => el.id)).toEqual(scene.elements.map((el) => el.id));

    expect(ileWorkCanvasQuickActionPrompt("rephrase")).toMatch(/rephrase/i);
    expect(ileWorkCanvasQuickActionPrompt("elaborate more pls")).toMatch(/elaborate more pls/i);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain('data-ile-learn-more-quick="rephrase"');
    expect(canvas).toContain('data-ile-learn-more-quick="split"');
    expect(canvas).toContain('data-ile-learn-more-quick="elaborate"');
    expect(canvas).toContain("ileWorkCanvasQuickActionPrompt");
    expect(canvas).toContain("splitIleWorkCanvasSelectedText");
    expect(canvas).toContain('handleQuickAction("rephrase")');
    expect(canvas).toContain('handleQuickAction("split")');
    expect(canvas).toContain('handleQuickAction("elaborate more pls")');
    expect(canvas).not.toMatch(/>\s*rephrase\s*</i);
    expect(canvas).not.toMatch(/>\s*split\s*</i);
    expect(canvas).not.toMatch(/>\s*elaborate more pls\s*</i);
    const domainAsk = buildIleWorkCanvasAskUserMessage({
      prompt: "What is missing?",
      workspace: {
        workspaceTitle: "Just War Ethics",
        workspaceGoal: "Apply last-resort tests to a live case",
        blockTitle: "Last resort",
        blockDescription: "Force is justified only after every peaceful option is exhausted.",
      },
    });
    writeScratch(
      "work-canvas-packaging.log",
      [
        `occupancyOverlap=${ileWorkCanvasThinkingOccupancy({ heliosBusy: true, canvasAskTurnIds: ["ask-1"] }).join(",")}`,
        `expandMoreEmptyBusy=${ileLearnMoreVisiblePlacement({ selectedElementIds: {}, pointerBusy: true, placed: { count: 1, left: 1, top: 1 } }) === null}`,
        `askHasWorkspace=${domainAsk.includes("Just War Ethics") && domainAsk.includes("Last resort")}`,
        `splitCount=${liveText.length}`,
        `splitPreserves=${joined === source.replace(/\s+/g, " ")}`,
        "quickActions=icon-only rephrase/split/elaborate",
        "packaging=WorkCanvas injected ask, no host imports",
      ].join("\n") + "\n",
    );
  });
});

describe("ILE Work canvas user delete stays empty (shipped)", () => {
  it("does not restore the previous scene after the learner deletes live elements", () => {
    expect(
      ileWorkCanvasShouldRestoreEmptyBoard({
        liveNonDeletedCount: 0,
        initialHasLive: true,
        userCleared: false,
      }),
    ).toBe(true);
    expect(
      ileWorkCanvasShouldRestoreEmptyBoard({
        liveNonDeletedCount: 0,
        initialHasLive: true,
        userCleared: true,
      }),
    ).toBe(false);
    expect(
      ileWorkCanvasShouldRestoreEmptyBoard({
        liveNonDeletedCount: 2,
        initialHasLive: true,
        userCleared: false,
      }),
    ).toBe(false);

    const live = sceneWith("keep-me", "keep me");
    const deleted: IleWorkCanvasScene = {
      ...live,
      elements: live.elements.map((el) => ({ ...el, isDeleted: true })),
    };
    expect(ileWorkCanvasIncomingClearsLiveScene(live, deleted)).toBe(true);
    expect(ileWorkCanvasIncomingClearsLiveScene(live, emptyIleWorkCanvasScene())).toBe(false);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileWorkCanvasShouldRestoreEmptyBoard");
    expect(canvas).toContain("userClearedRef");
    expect(canvas).toContain("getSceneElementsIncludingDeleted");
    expect(canvas).toContain('data-ile-learn-more-quick="rephrase"');
    expect(canvas).toContain("M4 4v6h6");
  });
});
