/**
 * TAP Learning Work canvas: per-chapter isolation, XAI apply, session-chat scene,
 * Excalidraw-tool PoW, and prompt/chrome structural checks.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleXaiReplyToWorkCanvas,
  applyIleXaiTurnAtCommit,
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
  clampIleCanvasTimerSeconds,
  formatIleWorkCanvasTimer,
  ileWorkCanvasTimerExpired,
  ileWorkCanvasTimerRemainingSeconds,
  resetIleWorkCanvasSceneOnTimerExpiry,
  ILE_CANVAS_TIMER_SECONDS_CEILING,
  ILE_CANVAS_TIMER_SECONDS_DEFAULT,
  ILE_CANVAS_TIMER_SECONDS_MIN,
  ILE_CANVAS_TIMER_RESET_LOADING_MS,
  ileWorkCanvasInitialSeedText,
  ILE_CHAPTER_SEED_CUSTOM_DATA_KEY,
  ILE_WORK_CANVAS_DEFAULT_GRID_SIZE,
  ILE_WORK_CANVAS_FONT_FAMILY,
  ILE_WORK_CANVAS_OVERLAP_GAP,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  wrapIleWorkCanvasText,
  ILE_XAI_LOADING_CUSTOM_DATA_KEY,
  ILE_XAI_LOADING_TEXT,
  applyIleWorkCanvasPositionEdits,
  applyIleWorkCanvasRefactor,
  applyIleWorkCanvasSuggestInsight,
  buildIleWorkCanvasAskUserMessage,
  buildIleWorkCanvasCommandUserMessage,
  buildIleWorkCanvasCompressUserMessage,
  compressIleWorkCanvasScene,
  compressIleWorkCanvasSelection,
  ILE_SELECTIVE_COMPRESSION_LABEL,
  ILE_WORK_CANVAS_COMMANDS,
  ILE_WORK_CANVAS_NEW_MARK_HIGHLIGHT_MS,
  ileSessionChatCanvasReply,
  ileWorkCanvasAskFromSessionChat,
  ileWorkCanvasHighlightActive,
  ileWorkCanvasLayoutReply,
  ileWorkCanvasNoteNewMarks,
  runIleWorkCanvasClearOverlaps,
  ILE_COMPRESS_WORK_CUSTOM_DATA_KEY,
  ILE_COMPRESS_WORK_LABEL,
  ILE_COMPRESS_WORK_LOADING_LABEL,
  ILE_COMPRESS_WORK_PROMPT,
  ileWorkCanvasCanCompress,
  createIleXaiLoadingPlaceholder,
  replaceIleXaiLoadingPlaceholder,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP,
  ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH,
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
  ileCanvasPromptBarWidth,
  ileCanvasPromptMode,
  ileLearnMoreFollowOffset,
  ileLearnMoreFollowPosition,
  ileLearnMorePromptPlacement,
  ileLearnMoreSelectionKey,
  ileLearnMoreVisiblePlacement,
  ileWorkCanvasCenterScroll,
  ileWorkCanvasZoomAtPoint,
  ileWorkCanvasContentBounds,
  ileWorkCanvasClusteredOrigin,
  ileWorkCanvasEmptyNearbyOrigin,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasSelectionIds,
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
  pasteIleWorkCanvasElements,
  placeIleLearnMorePrompt,
  joinIleWorkCanvasSelection,
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

function canvasRect(el: { x: number; y: number; width: number; height: number }) {
  const x = Number(el.x) || 0;
  const y = Number(el.y) || 0;
  const w = Number(el.width) || 0;
  const h = Number(el.height) || 0;
  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  if (!(maxX > minX) || !(maxY > minY)) return null;
  return { minX, minY, maxX, maxY };
}

function positiveAreaHit(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
) {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0
  );
}

function newMarksOverlapExisting(
  incoming: readonly {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
    containerId?: string | null;
  }[],
  existing: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted?: boolean;
  }[],
) {
  const ids = new Set(incoming.map((el) => el.id));
  for (const el of incoming) {
    if (el.isDeleted) continue;
    if (el.type === "text" && el.containerId && ids.has(el.containerId)) continue;
    const rect = canvasRect(el);
    if (!rect) continue;
    for (const other of existing) {
      if (other.isDeleted) continue;
      const obstacle = canvasRect(other);
      if (!obstacle) continue;
      if (positiveAreaHit(rect, obstacle)) return true;
    }
  }
  return false;
}

function sceneWith(id: string, text = id): IleWorkCanvasScene {
  return {
    elements: convertToExcalidrawElements([{ type: "text", text, x: 10, y: 10, id }]),
    appState: { zoom: { value: 1 } },
    files: {},
  };
}

describe("TAP Learning Work canvas grid default (shipped)", () => {
  it("starts with the grid off and zen mode on, and keeps an explicit choice", () => {
    const empty = emptyIleWorkCanvasScene();
    expect(empty.appState.gridModeEnabled).toBe(false);
    expect(empty.appState.zenModeEnabled).toBe(true);
    expect(empty.appState.gridSize).toBe(ILE_WORK_CANVAS_DEFAULT_GRID_SIZE);
    expect(empty.appState.currentItemStrokeColor).toBe("#1e1e1e");
    expect(empty.appState.currentItemFontFamily).toBe(ILE_WORK_CANVAS_FONT_FAMILY);
    expect(ILE_WORK_CANVAS_FONT_FAMILY).toBe(6);

    const restored = serializeIleWorkCanvasScene({
      elements: [],
      appState: { zoom: { value: 1 } },
      files: {},
    });
    expect(restored.appState.gridModeEnabled).toBe(false);
    expect(restored.appState.zenModeEnabled).toBe(true);
    expect(restored.appState.gridSize).toBe(ILE_WORK_CANVAS_DEFAULT_GRID_SIZE);

    const keptOff = withIleWorkCanvasGridAppState({ gridModeEnabled: false, gridSize: 40 });
    expect(keptOff.gridModeEnabled).toBe(false);
    expect(keptOff.zenModeEnabled).toBe(true);
    expect(keptOff.gridSize).toBe(40);

    const keptOn = withIleWorkCanvasGridAppState({ gridModeEnabled: true, zenModeEnabled: false });
    expect(keptOn.gridModeEnabled).toBe(true);
    expect(keptOn.zenModeEnabled).toBe(false);

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

describe("TAP Learning Work canvas chapter isolation (shipped)", () => {
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

describe("TAP Learning Work canvas chapter seed (shipped)", () => {
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

describe("TAP Learning Work canvas center on open (shipped)", () => {
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

describe("TAP Learning Work canvas zoom at point (shipped)", () => {
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

describe("TAP Learning Work canvas ask-XAI on selection (shipped)", () => {
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
    const keptSelection = replied.elements.find((el) => el.id === selected[0]!.id);
    expect(keptSelection?.x).toBe(selected[0]!.x);
    expect(keptSelection?.y).toBe(selected[0]!.y);
    expect(newMarksOverlapExisting(replied.elements.filter((el) => el.id !== selected[0]!.id), selected)).toBe(
      false,
    );

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("data-ile-excalidraw-ask");
    expect(canvas).toContain("data-ile-learn-more");
    expect(canvas).toContain('data-ile-canvas-prompt-mode={canvasSelectionActive ? "commands" : "ask"}');
    expect(canvas).toContain("data-ile-learn-more-actions");
    expect(canvas).not.toContain("data-ile-learn-more-handle");
    expect(canvas).not.toContain("data-ile-learn-more-dragging");
    expect(canvas).not.toContain("data-ile-learn-more-collapsed");
    expect(canvas).not.toContain("left: learnMoreUi.left");
    expect(canvas).toContain("ileCanvasPromptMode");
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
    expect(canvas).toContain("top: promptBarTop");
    expect(canvas).toContain("Math.max(promptBarWidth, ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH)");
    expect(canvas).toContain(": promptBarWidth");
    expect(canvas).toContain("ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR");
    expect(canvas).not.toContain("inset-x-0 bottom-3 z-[58]");
    expect(canvas).not.toContain("max-w-4xl");
    expect(ileCanvasPromptBarTop({ bottom: 120 }, { top: 40 })).toBe(120 - 40 + ILE_CANVAS_PROMPT_BAR_GAP);
    expect(ileCanvasPromptBarTop(null, { top: 0 })).toBe(ILE_CANVAS_PROMPT_BAR_FALLBACK_TOP);
    expect(ileCanvasPromptBarWidth({ width: 512 })).toBe(512);
    expect(ileCanvasPromptBarWidth(null)).toBe(ILE_CANVAS_PROMPT_BAR_FALLBACK_WIDTH);
    expect(ILE_CANVAS_PROMPT_BAR_TOOLBAR_SELECTOR).toContain(".App-toolbar");
    expect(canvas).toContain("handleBoardAsk");
    expect(canvas).not.toContain("data-ile-compress-work");
    expect(canvas).toContain("IleCraftInsightButton");
    expect(canvas).toContain("selectedElements: []");
    expect(canvas).toContain("ileWorkCanvasThinkingOverlayStyle");
    const view = read("components/SessionView.tsx");
    expect(view).toContain("onAskSelected={handleAskCanvasSelection}");
    expect(view).toContain("buildIleWorkCanvasCommandUserMessage");
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
    expect(ILE_LEARN_MORE_LABEL).toBe("Commands");
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
    expect(canvas).toContain('payload.button === "down" && api');
    expect(canvas).toContain("syncCanvasSelection(api.getAppState?.() ?? {})");
    expect(canvas).not.toContain("learnMoreHostRef");
    expect(canvas).not.toContain("paintLearnMoreUi");
    expect(canvas).not.toContain("learnMorePinnedRef");
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

describe("TAP Learning Work canvas text wrap (shipped)", () => {
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

    const narrow = applyIleXaiReplyToWorkCanvas(
      null,
      JSON.stringify({
        text: "Short note beside the mark.",
        textWidth: 180,
        origin: { x: 80, y: 80 },
      }),
    );
    const narrowText = narrow.elements.find((el) => el.originalText === "Short note beside the mark.");
    expect(narrowText?.width).toBe(180);
    const wide = applyIleXaiReplyToWorkCanvas(
      null,
      JSON.stringify({
        text: "A longer coaching line that should sit in a wider box.",
        textWidth: 480,
      }),
    );
    const wideText = wide.elements.find(
      (el) => el.originalText === "A longer coaching line that should sit in a wider box.",
    );
    expect(wideText?.width).toBe(480);
    expect(wideText?.width).not.toBe(narrowText?.width);
    const shaped = applyIleXaiTurnToWorkCanvas(null, {
      elements: [{ type: "text", text: "Caption", x: 10, y: 10, width: 140 }],
    });
    expect(shaped.elements.find((el) => el.originalText === "Caption")?.width).toBe(140);
    expect(ileWorkCanvasXaiToolsInstruction()).toContain("textWidth");
  });
});

describe("TAP Learning Work canvas XAI apply (shipped convertToExcalidrawElements wrapper)", () => {
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

describe("TAP Learning session-chat board context (shipped builder)", () => {
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
    expect(view).toContain("applyIleXaiTurnAtCommit");
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

describe("TAP Learning Excalidraw-tool PoW (shipped)", () => {
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

describe("TAP Learning prompts describe one chapter canvas (shipped)", () => {
  it("drops Notebook / Grokipedia / Dantes as TAP Learning tools", () => {
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

describe("TAP Learning Work chrome is canvas-only (shipped source)", () => {
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
    expect(view).toContain("applyIleXaiTurnAtCommit");
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

describe("TAP Learning Work canvas XAI suggested origin (shipped parse+apply)", () => {
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

    const trailingComma = parseIleXaiCanvasTurn(
      '{"text":"Label the invariant.","elements":[{"type":"rectangle","x":10,"y":20,"width":40,"height":30},]}',
    );
    expect(trailingComma.text).toBe("Label the invariant.");
    expect(trailingComma.elements?.[0]?.type).toBe("rectangle");
    const trailingApplied = applyIleXaiTurnToWorkCanvas(existing, trailingComma);
    expect(
      trailingApplied.elements.some((el) => (el.originalText || el.text) === "Label the invariant."),
    ).toBe(true);
    expect(
      trailingApplied.elements.some((el) => String(el.originalText || el.text || "").includes('{"text"')),
    ).toBe(false);

    const elementsOnly = '{"elements":[{"type":"ellipse","x":4,"y":6,"width":20,"height":20}]}';
    const shapesOnly = parseIleXaiCanvasTurn(elementsOnly);
    expect(shapesOnly.text).toBe("");
    expect(shapesOnly.elements?.[0]?.type).toBe("ellipse");
    const shapesApplied = applyIleXaiTurnToWorkCanvas(existing, { text: elementsOnly });
    expect(shapesApplied.elements.some((el) => el.type === "ellipse")).toBe(true);
    expect(
      shapesApplied.elements.some((el) => String(el.originalText || el.text || "").trim().startsWith("{")),
    ).toBe(false);

    const nested = parseIleXaiCanvasTurn(
      JSON.stringify({ text: JSON.stringify({ text: "Say it in words." }), elements: [] }),
    );
    expect(nested.text).toBe("Say it in words.");

    const proseAndJson = parseIleXaiCanvasTurn(
      'Keep the invariant in view.\n{"elements":[{"type":"arrow","x":0,"y":0,"width":30,"height":0},]}',
    );
    expect(proseAndJson.text).toBe("Keep the invariant in view.");
    expect(proseAndJson.elements?.[0]?.type).toBe("arrow");
    expect(proseAndJson.text).not.toContain("{");

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

describe("TAP Learning Work canvas thinking overlay box (shipped occupancy+style)", () => {
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

describe("TAP Learning Work canvas parallel asks (shipped live merge)", () => {
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

describe("TAP Learning and TAP Work canvas share one component (shipped)", () => {
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
        "TAP Learning SessionView mounts WorkCanvas with onAskSelected, heliosBusy, onSceneChange, onCanvasPowActions",
        "TAP tap-score-phases mounts WorkCanvas with onAskSelected, heliosBusy, onSceneChange, onCanvasPowActions",
        "canvas module does not import SessionView, tap-score-phases, or session-chat-client",
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Learning Work canvas thinking occupancy (shipped)", () => {
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

describe("TAP Learning Work canvas Expand More unselect (shipped)", () => {
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
    expect(ileCanvasPromptMode({})).toBe("ask");
    expect(ileCanvasPromptMode({ a: false })).toBe("ask");
    expect(ileCanvasPromptMode({ b: true, a: true })).toBe("commands");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ileCanvasPromptMode(appState?.selectedElementIds ?? {})");
    expect(canvas).not.toContain("ileLearnMoreVisiblePlacement");
  });
});

describe("TAP Learning Work canvas workspace+block prompt context (shipped)", () => {
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

describe("TAP Learning Work canvas split + Expand More quick actions (shipped)", () => {
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

    const upper = convertToExcalidrawElements([{ type: "text", text: "Alpha", x: 10, y: 10 }])[0]!;
    const lower = convertToExcalidrawElements([{ type: "text", text: "Beta", x: 30, y: 80 }])[0]!;
    const merged = joinIleWorkCanvasSelection(
      { elements: [lower, upper], appState: {}, files: {} },
      [lower, upper],
    );
    expect(merged.joined).toBe(true);
    const joinedText = merged.parts.map((el) => String(el.originalText || el.text || "")).join("\n");
    expect(joinedText.indexOf("Alpha")).toBeGreaterThanOrEqual(0);
    expect(joinedText.indexOf("Alpha")).toBeLessThan(joinedText.indexOf("Beta"));
    expect(
      merged.scene.elements.filter((el) => String(el.originalText || el.text || "").trim()).length,
    ).toBe(1);
    const boxA = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 40, height: 40 },
    ])[0]!;
    const boxB = convertToExcalidrawElements([
      { type: "rectangle", x: 80, y: 0, width: 40, height: 40 },
    ])[0]!;
    const grouped = joinIleWorkCanvasSelection(
      { elements: [boxA, boxB], appState: {}, files: {} },
      [boxA, boxB],
    );
    expect(grouped.joined).toBe(true);
    const sharedGroup = grouped.parts.map((el) => el.groupIds?.at(-1));
    expect(sharedGroup[0]).toBeTruthy();
    expect(sharedGroup[0]).toBe(sharedGroup[1]);
    expect(joinIleWorkCanvasSelection({ elements: [upper], appState: {}, files: {} }, [upper]).joined).toBe(
      false,
    );

    expect(ileWorkCanvasQuickActionPrompt("rephrase")).toMatch(/rephrase/i);
    expect(ileWorkCanvasQuickActionPrompt("elaborate more pls")).toMatch(/elaborate more pls/i);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("ILE_WORK_CANVAS_COMMANDS.map");
    expect(canvas).toContain("data-ile-learn-more-quick={command.id}");
    expect(canvas).toContain("handleQuickAction(command.id)");
    expect(canvas).toContain("{command.label}");
    expect(canvas).toContain("IleCraftInsightButton");
    expect(canvas).toContain("ileCanvasCraftInsightUsable");
    expect(canvas).not.toContain("data-ile-compress-work");
    const craftBtn = read("components/session-view/ile-canvas-craft-insight.tsx");
    expect(craftBtn).toContain("data-ile-craft-insight");
    expect(craftBtn).toContain("ILE_CRAFT_INSIGHT_LABEL");
    expect(canvas).toContain("ileWorkCanvasQuickActionPrompt");
    expect(canvas).toContain("splitIleWorkCanvasSelectedText");
    expect(canvas).toContain("handleQuickAction(command.id)");
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
        "quickActions=named Rephrase/Split/Elaborate",
        "packaging=WorkCanvas injected ask, no host imports",
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Learning Work canvas user delete stays empty (shipped)", () => {
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
    expect(canvas).toContain("data-ile-learn-more-quick={command.id}");
    expect(canvas).toContain("{command.label}");
  });
});

describe("TAP Learning Work canvas timer expiry (shipped)", () => {
  it("counts down a positive duration, then reseeds the initial chapter element while keeping insights", () => {
    expect(clampIleCanvasTimerSeconds(undefined)).toBe(ILE_CANVAS_TIMER_SECONDS_DEFAULT);
    expect(ILE_CANVAS_TIMER_SECONDS_MIN).toBe(10 * 60);
    expect(ILE_CANVAS_TIMER_SECONDS_DEFAULT).toBe(15 * 60);
    expect(ILE_CANVAS_TIMER_SECONDS_CEILING).toBe(60 * 60);
    expect(clampIleCanvasTimerSeconds(30)).toBe(ILE_CANVAS_TIMER_SECONDS_MIN);
    expect(clampIleCanvasTimerSeconds(180)).toBe(ILE_CANVAS_TIMER_SECONDS_MIN);
    expect(clampIleCanvasTimerSeconds(15 * 60)).toBe(15 * 60);
    expect(clampIleCanvasTimerSeconds(60 * 60)).toBe(60 * 60);
    expect(clampIleCanvasTimerSeconds(2 * 60 * 60)).toBe(ILE_CANVAS_TIMER_SECONDS_CEILING);
    const started = 1_000_000;
    expect(
      ileWorkCanvasTimerRemainingSeconds({
        durationSeconds: 30 * 60,
        startedAtMs: started,
        nowMs: started + 60_000,
      }),
    ).toBe(29 * 60);
    expect(
      ileWorkCanvasTimerExpired({
        durationSeconds: 30 * 60,
        startedAtMs: started,
        nowMs: started + 60_000,
      }),
    ).toBe(false);
    expect(
      ileWorkCanvasTimerRemainingSeconds({
        durationSeconds: 15 * 60,
        startedAtMs: started,
        nowMs: started + 15 * 60 * 1000,
      }),
    ).toBe(0);
    expect(
      ileWorkCanvasTimerExpired({
        durationSeconds: 15 * 60,
        startedAtMs: started,
        nowMs: started + 15 * 60 * 1000,
      }),
    ).toBe(true);
    expect(formatIleWorkCanvasTimer(65)).toBe("1:05");

    const scene: IleWorkCanvasScene = {
      ...emptyIleWorkCanvasScene(),
      elements: [
        {
          id: "el-1",
          type: "rectangle",
          x: 10,
          y: 10,
          width: 40,
          height: 20,
          angle: 0,
          strokeColor: "#fff",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: started,
          link: null,
          locked: false,
        },
      ],
    };
    const seedText = "Walk a case through just-war criteria";
    const firstOpen = seedIleChapterWorkCanvas(emptyIleWorkCanvasScene(), {
      text: seedText,
      chapterId: "ch-a",
    });
    expect(firstOpen.seeded).toBe(true);
    const withWork: IleWorkCanvasScene = {
      ...firstOpen.scene,
      elements: [...firstOpen.scene.elements, scene.elements[0]!],
    };
    expect(withWork.elements.length).toBeGreaterThan(1);
    expect(ileWorkCanvasInitialSeedText(withWork)).toContain("Walk a case");

    const insights = [{ id: "ins-1", chapter_id: "ch-a", title: "Kept" }];
    const reset = resetIleWorkCanvasSceneOnTimerExpiry({
      scene: withWork,
      insights,
      chapterId: "ch-a",
      seedText,
    });
    const live = reset.scene.elements.filter((el) => !el.isDeleted);
    expect(live).toHaveLength(1);
    expect(live[0]?.customData?.[ILE_CHAPTER_SEED_CUSTOM_DATA_KEY]).toBe(true);
    expect(String(live[0]?.originalText || live[0]?.text || "").replace(/\s+/g, " ")).toContain(
      "Walk a case through just-war criteria",
    );
    expect(live.some((el) => el.id === "el-1")).toBe(false);
    expect(reset.insights).toEqual(insights);
    expect(reset.insights[0]?.title).toBe("Kept");
    expect(reset.resetChapterIds).toEqual(["ch-a"]);

    const noSeedLeft: IleWorkCanvasScene = {
      ...emptyIleWorkCanvasScene(),
      elements: [scene.elements[0]!],
    };
    const fromFallback = resetIleWorkCanvasSceneOnTimerExpiry({
      scene: noSeedLeft,
      insights,
      chapterId: "ch-a",
      seedText,
    });
    expect(fromFallback.scene.elements.filter((el) => !el.isDeleted)).toHaveLength(1);
    expect(
      String(
        fromFallback.scene.elements[0]?.originalText || fromFallback.scene.elements[0]?.text || "",
      ),
    ).toContain("Walk a case");

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("replaceSceneNonce");
    expect(canvas).toContain("ILE_CANVAS_TIMER_RESET_LOADING_MS");
    expect(canvas).toContain("timer-reset-");
    expect(canvas).toContain("upsertThinkingChip");
    expect(ILE_CANVAS_TIMER_RESET_LOADING_MS).toBeGreaterThan(0);
    const view = read("components/SessionView.tsx");
    expect(view).not.toContain("resetIleWorkCanvasSceneOnTimerExpiry");
    expect(view).not.toContain("ileWorkCanvasTimerExpired");
    expect(view).not.toContain("IleWorkCanvasTimer");

    writeScratch(
      "ile-canvas-timer-reset.txt",
      [
        `default=${ILE_CANVAS_TIMER_SECONDS_DEFAULT}`,
        `min=${ILE_CANVAS_TIMER_SECONDS_MIN}`,
        `ceiling=${ILE_CANVAS_TIMER_SECONDS_CEILING}`,
        `remaining60sInto30m=${ileWorkCanvasTimerRemainingSeconds({ durationSeconds: 30 * 60, startedAtMs: started, nowMs: started + 60_000 })}`,
        `expiredAt15m=${ileWorkCanvasTimerExpired({ durationSeconds: 15 * 60, startedAtMs: started, nowMs: started + 15 * 60 * 1000 })}`,
        `resetLive=${live.length}`,
        `seedKept=${live[0]?.customData?.[ILE_CHAPTER_SEED_CUSTOM_DATA_KEY] === true}`,
        `insightsKept=${reset.insights.map((row) => row.id).join(",")}`,
        `loadingMs=${ILE_CANVAS_TIMER_RESET_LOADING_MS}`,
        `fallbackSeed=${fromFallback.scene.elements.filter((el) => !el.isDeleted).length}`,
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Learning Work canvas compress work (shipped)", () => {
  it("replaces the board with one summary element and keeps the Compress work control next to the prompt bar", () => {
    expect(ILE_COMPRESS_WORK_LABEL).toBe("Compress work");
    expect(ILE_COMPRESS_WORK_LOADING_LABEL).not.toBe(ILE_COMPRESS_WORK_LABEL);
    expect(ileWorkCanvasCanCompress(emptyIleWorkCanvasScene())).toBe(false);
    const seeded = seedIleChapterWorkCanvas(emptyIleWorkCanvasScene(), {
      text: "Force is not the same as field. The metric encodes curvature.",
      chapterId: "ch-compress",
    });
    expect(seeded.seeded).toBe(true);
    expect(ileWorkCanvasCanCompress(seeded.scene)).toBe(true);

    const prompt = buildIleWorkCanvasCompressUserMessage({
      scene: seeded.scene,
      workspace: { workspaceTitle: "General Relativity", blockTitle: "Fields" },
    });
    expect(prompt).toMatch(/Compress the current Work canvas/i);
    expect(prompt).toContain("Force is not the same as field");
    expect(prompt).toContain("Stay on this workspace");

    const emptyKeep = compressIleWorkCanvasScene(seeded.scene, "   ");
    expect(emptyKeep.elements.length).toBe(seeded.scene.elements.length);

    const compressed = compressIleWorkCanvasScene(
      seeded.scene,
      "Gravity is geometry: mass curves spacetime.",
    );
    expect(compressed.elements.filter((el) => !el.isDeleted)).toHaveLength(1);
    const only = compressed.elements.find((el) => !el.isDeleted);
    expect(only?.type).toBe("text");
    expect(String(only?.originalText || only?.text || "").replace(/\s+/g, " ").trim()).toBe(
      "Gravity is geometry: mass curves spacetime.",
    );
    expect(only?.customData?.[ILE_COMPRESS_WORK_CUSTOM_DATA_KEY]).toBe(true);
    expect(
      compressed.elements.some((el) =>
        String(el.text || "").includes("Force is not the same as field"),
      ),
    ).toBe(false);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).not.toContain("data-ile-compress-work");
    expect(canvas).toContain('emitCommand("selective-compression"');
    expect(canvas).toContain('kind: "selective-compress"');
    expect(canvas).toContain("compressIleWorkCanvasSelection");
    expect(canvas).toContain("<IleCraftInsightButton");
    const view = read("components/SessionView.tsx");
    expect(view).toContain("buildIleWorkCanvasCommandUserMessage");
    expect(view).not.toContain("buildIleWorkCanvasCompressUserMessage");
    expect(view).not.toContain('input.kind === "compress"');
    expect(ILE_COMPRESS_WORK_PROMPT.toLowerCase()).toContain("compress");

    writeScratch(
      "ile-compress-work.txt",
      [
        `label=${ILE_COMPRESS_WORK_LABEL}`,
        `emptyCan=${ileWorkCanvasCanCompress(emptyIleWorkCanvasScene())}`,
        `seededCan=${ileWorkCanvasCanCompress(seeded.scene)}`,
        `emptyKeep=${emptyKeep.elements.length === seeded.scene.elements.length}`,
        `compressedCount=${compressed.elements.filter((el) => !el.isDeleted).length}`,
        `summary=${only?.text}`,
        "button=selection Compress; prompt bar has no Compress work",
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Learning Work canvas live geometry and non-overlapping drops (shipped)", () => {
  it("moves a real reply off a loading slot that only fits the square, keeps a free origin, and lists live geometry", () => {
    const long = "measure the wrapped reply ".repeat(40).trim();
    const wrapped = wrapIleWorkCanvasText(long);
    expect(wrapped.width).toBeGreaterThan(ILE_XAI_LOADING_BOX_WIDTH);
    expect(wrapped.height).toBeGreaterThan(ILE_XAI_LOADING_BOX_HEIGHT);
    const origin = { x: 80, y: 40 };
    const square = canvasRect({
      x: origin.x,
      y: origin.y,
      width: ILE_XAI_LOADING_BOX_WIDTH,
      height: ILE_XAI_LOADING_BOX_HEIGHT,
    })!;
    const naive = canvasRect({
      x: origin.x,
      y: origin.y,
      width: wrapped.width,
      height: wrapped.height,
    })!;
    const obstacle = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: origin.x + ILE_XAI_LOADING_BOX_WIDTH + 8,
        y: origin.y,
        width: 36,
        height: 36,
      },
    ])[0]!;
    const obstacleRect = canvasRect(obstacle)!;
    expect(positiveAreaHit(square, obstacleRect)).toBe(false);
    expect(positiveAreaHit(naive, obstacleRect)).toBe(true);

    const loading = createIleXaiLoadingPlaceholder({
      x: origin.x,
      y: origin.y,
      turnId: "load-wide",
    });
    const scene: IleWorkCanvasScene = {
      elements: [obstacle, loading],
      appState: { collaborators: { "cursor-agent-77": { pointer: { x: 1234, y: 5678 } } } },
      files: {},
    };
    const replaced = replaceIleXaiLoadingPlaceholder(scene, "load-wide", { text: long });
    const reply = replaced.elements.find((el) => el.originalText === long);
    expect(reply).toBeTruthy();
    expect(reply!.x !== origin.x || reply!.y !== origin.y).toBe(true);
    expect(replaced.elements.some((el) => el.id === loading.id)).toBe(false);
    expect(replaced.elements.some((el) => el.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY])).toBe(false);
    expect(replaced.elements.some((el) => (el.text || el.originalText) === ILE_XAI_LOADING_TEXT)).toBe(false);
    const kept = replaced.elements.find((el) => el.id === obstacle.id)!;
    expect(kept.x).toBe(obstacle.x);
    expect(kept.y).toBe(obstacle.y);
    expect(kept.width).toBe(obstacle.width);
    expect(kept.height).toBe(obstacle.height);
    const added = replaced.elements.filter((el) => el.id !== obstacle.id);
    expect(newMarksOverlapExisting(added, [obstacle])).toBe(false);

    const free = applyIleXaiTurnToWorkCanvas(
      { elements: [obstacle], appState: {}, files: {} },
      { text: "sits in the open", origin: { x: 4000, y: 4200 }, turnId: "free-origin" },
    );
    const freeEl = free.elements.find((el) => el.originalText === "sits in the open")!;
    expect(freeEl.x).toBe(4000);
    expect(freeEl.y).toBe(4200);
    expect(free.elements.find((el) => el.id === obstacle.id)?.x).toBe(obstacle.x);

    const colliding = applyIleXaiTurnToWorkCanvas(
      { elements: [obstacle], appState: {}, files: {} },
      {
        text: "lands on the mark",
        origin: { x: obstacle.x, y: obstacle.y },
        elements: [{ type: "rectangle", x: obstacle.x, y: obstacle.y + 140, width: 40, height: 24 }],
        turnId: "hit-origin",
      },
    );
    const hitText = colliding.elements.find((el) => el.originalText === "lands on the mark")!;
    const hitRect = colliding.elements.find((el) => el.type === "rectangle" && el.id !== obstacle.id)!;
    expect(hitText.x - hitRect.x).toBe(obstacle.x - obstacle.x);
    expect(hitRect.y - hitText.y).toBe(140);
    expect(colliding.elements.find((el) => el.id === obstacle.id)?.x).toBe(obstacle.x);
    expect(colliding.elements.find((el) => el.id === obstacle.id)?.y).toBe(obstacle.y);
    expect(
      newMarksOverlapExisting(
        colliding.elements.filter((el) => el.id !== obstacle.id),
        [obstacle],
      ),
    ).toBe(false);

    const reserved = mergeIleXaiTurnOntoLiveWorkCanvas(
      { elements: [obstacle], appState: {}, files: {} },
      { text: "second drop", turnId: "reserved-b" },
      { fallbackOrigin: { x: 80, y: 400 }, reserved: [{ x: 200, y: 400 }] },
    );
    const reservedText = reserved.elements.find((el) => el.originalText === "second drop")!;
    const reservedBox = { x: 200, y: 400, width: ILE_XAI_LOADING_BOX_WIDTH, height: ILE_XAI_LOADING_BOX_HEIGHT };
    expect(newMarksOverlapExisting([reservedText], [obstacle, reservedBox])).toBe(false);
    expect(reserved.elements.find((el) => el.id === obstacle.id)?.x).toBe(obstacle.x);

    const labeledObstacle = convertToExcalidrawElements([
      { type: "rectangle", x: 600, y: 508, width: 40, height: 20 },
    ])[0]!;
    const labeled = applyIleXaiTurnToWorkCanvas(
      { elements: [labeledObstacle], appState: {}, files: {} },
      {
        elements: [
          {
            type: "rectangle",
            x: 500,
            y: 500,
            width: 80,
            height: 40,
            label: { text: "caption" },
          },
        ],
      },
    );
    const shape = labeled.elements.find((el) => el.type === "rectangle" && el.id !== labeledObstacle.id)!;
    const caption = labeled.elements.find((el) => (el.originalText || el.text) === "caption")!;
    expect(caption.containerId).toBe(shape.id);
    expect(caption.x - shape.x).toBe(8);
    expect(caption.y - shape.y).toBe(8);
    expect(positiveAreaHit(canvasRect(shape)!, canvasRect(caption)!)).toBe(true);
    const unshiftedCaption = canvasRect({ x: 508, y: 508, width: caption.width, height: caption.height })!;
    expect(positiveAreaHit(unshiftedCaption, canvasRect(labeledObstacle)!)).toBe(true);
    expect(positiveAreaHit(canvasRect(caption)!, canvasRect(labeledObstacle)!)).toBe(false);
    expect(
      newMarksOverlapExisting(
        labeled.elements.filter((el) => el.id !== labeledObstacle.id),
        [labeledObstacle],
      ),
    ).toBe(false);

    const deleted = {
      ...obstacle,
      id: "deleted-mark",
      isDeleted: true,
      type: "text",
      text: "DELETED_MARK_SHOULD_NOT_APPEAR",
      originalText: "DELETED_MARK_SHOULD_NOT_APPEAR",
      x: 7,
      y: 9,
      width: 11,
      height: 13,
    };
    const listed = ileWorkCanvasTurnContextMessage({
      elements: [obstacle, deleted],
      appState: { collaborators: { "cursor-agent-77": { pointer: { x: 1234, y: 5678 } } } },
      files: {},
    });
    expect(listed).toContain(
      `rectangle x=${obstacle.x} y=${obstacle.y} width=${obstacle.width} height=${obstacle.height}`,
    );
    expect(listed).toContain("freedraw");
    expect(listed).toContain(ileWorkCanvasXaiToolsInstruction());
    expect(listed).not.toContain("DELETED_MARK_SHOULD_NOT_APPEAR");
    expect(listed).not.toContain("x=7 y=9 width=11 height=13");
    expect(listed).not.toContain("cursor-agent-77");
    expect(listed).not.toContain("1234");

    const chat = read("app/api/session-chat/route.ts");
    const view = read("components/SessionView.tsx");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(chat).toContain("ileWorkCanvasTurnContextMessage");
    expect(view).toContain("applyIleXaiTurnAtCommit");
    expect(view).toContain("live: whiteboardSceneDataRef.current");
    expect(canvas).toContain("mergeIleXaiTurnOntoLiveWorkCanvas");
    expect(canvas).toContain("pasteIleWorkCanvasElements");

    writeScratch(
      "canvas-nonoverlap-ile.txt",
      [
        `replyMoved=${reply!.x !== origin.x || reply!.y !== origin.y}`,
        `loadingGone=${!replaced.elements.some((el) => el.id === loading.id)}`,
        `freeStayed=${freeEl.x === 4000 && freeEl.y === 4200}`,
        `hitCleared=${!newMarksOverlapExisting(colliding.elements.filter((el) => el.id !== obstacle.id), [obstacle])}`,
        `geometry=${listed.includes(`width=${obstacle.width}`)}`,
        `tools=${listed.includes("freedraw")}`,
      ].join("\n") + "\n",
    );
  });

  it("settles a snapshot reply against a mark drawn while the request was in flight", () => {
    const snapshot = sceneWith("seed", "seed mark");
    const origin = { x: 900, y: 700 };
    const payload = { text: "reply after the draw", origin, turnId: "inflight" };
    const naive = applyIleXaiTurnToWorkCanvas(snapshot, payload);
    const naiveReply = naive.elements.find((el) => el.originalText === "reply after the draw")!;
    expect(naiveReply.x).toBe(origin.x);
    expect(naiveReply.y).toBe(origin.y);
    const blocker = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: naiveReply.x,
        y: naiveReply.y,
        width: Math.max(40, naiveReply.width),
        height: Math.max(40, naiveReply.height),
      },
    ])[0]!;
    expect(positiveAreaHit(canvasRect(naiveReply)!, canvasRect(blocker)!)).toBe(true);
    const live: IleWorkCanvasScene = {
      elements: [...snapshot.elements, blocker],
      appState: snapshot.appState,
      files: snapshot.files,
    };
    const committed = applyIleXaiTurnAtCommit({
      snapshot,
      live,
      applyLive: true,
      payload,
    });
    const kept = committed.scene.elements.find((el) => el.id === blocker.id)!;
    expect(kept.x).toBe(blocker.x);
    expect(kept.y).toBe(blocker.y);
    expect(kept.width).toBe(blocker.width);
    expect(kept.height).toBe(blocker.height);
    expect(committed.scene.elements.some((el) => el.id === snapshot.elements[0]!.id)).toBe(true);
    expect(newMarksOverlapExisting(committed.appended, live.elements)).toBe(false);
    expect(committed.appended.some((el) => el.originalText === "reply after the draw")).toBe(true);

    const pasted = pasteIleWorkCanvasElements({
      existing: live.elements,
      incoming: naive.elements.filter((el) => !snapshot.elements.some((seed) => seed.id === el.id)),
    });
    const pastedBlocker = pasted.find((el) => el.id === blocker.id)!;
    expect(pastedBlocker.x).toBe(blocker.x);
    expect(pastedBlocker.y).toBe(blocker.y);
    expect(pastedBlocker.width).toBe(blocker.width);
    expect(pastedBlocker.height).toBe(blocker.height);
    const pastedNew = pasted.filter(
      (el) => el.id !== blocker.id && !snapshot.elements.some((seed) => seed.id === el.id),
    );
    expect(newMarksOverlapExisting(pastedNew, [blocker])).toBe(false);

    const cold = applyIleXaiTurnAtCommit({
      snapshot,
      live,
      applyLive: false,
      payload,
    });
    expect(cold.scene.elements.some((el) => el.id === blocker.id)).toBe(false);
    expect(cold.scene.elements.find((el) => el.originalText === "reply after the draw")?.x).toBe(origin.x);
  });

  it("tucks a wide reply under the cluster without selecting the new marks", () => {
    const mark = { x: 40, y: 20, width: 100, height: 50, isDeleted: false };
    const slot = ileWorkCanvasClusteredOrigin({
      elements: [mark],
      box: { width: ILE_WORK_CANVAS_TEXT_BOX_WIDTH, height: 90 },
    });
    const farRight = mark.x + mark.width + ILE_XAI_LOADING_GAP;
    expect(slot.y).toBeGreaterThanOrEqual(mark.y + mark.height);
    expect(slot.x).toBeLessThan(farRight);
    const placedMid = slot.x + ILE_WORK_CANVAS_TEXT_BOX_WIDTH / 2;
    const clusterMid = mark.x + mark.width / 2;
    const rightMid = farRight + ILE_WORK_CANVAS_TEXT_BOX_WIDTH / 2;
    expect(Math.abs(placedMid - clusterMid)).toBeLessThan(Math.abs(rightMid - clusterMid));

    const scene = {
      elements: convertToExcalidrawElements([
        { type: "rectangle", x: mark.x, y: mark.y, width: mark.width, height: mark.height },
      ]),
      appState: {},
      files: {},
    };
    const obstacle = scene.elements[0]!;
    const settled = applyIleXaiTurnToWorkCanvas(scene, {
      text: "Stay with the cluster.",
      origin: { x: obstacle.x, y: obstacle.y },
    });
    const reply = settled.elements.find((el) => el.originalText === "Stay with the cluster.")!;
    expect(reply.x).toBeLessThan(obstacle.x + obstacle.width + ILE_XAI_LOADING_GAP);
    expect(newMarksOverlapExisting([reply], [obstacle])).toBe(false);
    expect(ileWorkCanvasSelectionIds(settled.elements.filter((el) => el.id === reply.id))).toEqual({
      [reply.id]: true,
    });
    expect(ileWorkCanvasSelectionIds([{ id: "gone", isDeleted: true }])).toEqual({});
    expect(settled.appState.selectedElementIds ?? {}).toEqual({});

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).not.toContain("ileWorkCanvasSelectionIds");
    expect(canvas).toContain("selectedElementIds: {}");
    expect(canvas).toContain("scrollToContent(added, ILE_WORK_CANVAS_SCROLL_TO_CONTENT_OPTS)");
    expect(ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION).toMatch(/under nearby marks/i);
  });

  it("separates boxes, text, and captions in one XAI reply without moving existing marks", () => {
    const blocker = convertToExcalidrawElements([
      { type: "rectangle", x: 80, y: 80, width: 50, height: 50 },
    ])[0]!;
    const applied = applyIleXaiTurnToWorkCanvas(
      { elements: [blocker], appState: {}, files: {} },
      {
        text: "Three marks.",
        origin: { x: 80, y: 80 },
        elements: [
          {
            type: "rectangle",
            x: 80,
            y: 80,
            width: 120,
            height: 70,
            label: { text: "wide caption" },
          },
          { type: "ellipse", x: 80, y: 80, width: 90, height: 60 },
          { type: "diamond", x: 100, y: 90, width: 80, height: 80 },
          { type: "text", x: 80, y: 80, text: "loose note" },
          { type: "image", x: 80, y: 80, width: 60, height: 60, fileId: "file-1" },
        ],
      },
    );
    const kept = applied.elements.find((el) => el.id === blocker.id)!;
    expect(kept.x).toBe(blocker.x);
    expect(kept.y).toBe(blocker.y);
    expect(kept.width).toBe(blocker.width);
    expect(kept.height).toBe(blocker.height);

    const added = applied.elements.filter((el) => el.id !== blocker.id && !el.isDeleted);
    const ids = new Set(added.map((el) => el.id));
    const connectors = new Set(["arrow", "line", "freedraw"]);
    const bound = (el: (typeof added)[number]) =>
      el.type === "text" && Boolean(el.containerId) && ids.has(String(el.containerId));
    const solids = added.filter((el) => !connectors.has(el.type) && !bound(el) && el.type !== "frame");
    expect(solids.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < solids.length; i += 1) {
      for (let j = i + 1; j < solids.length; j += 1) {
        const a = canvasRect(solids[i]!)!;
        const b = canvasRect(solids[j]!)!;
        expect(ileWorkCanvasRectsOverlap(a, b, ILE_WORK_CANVAS_OVERLAP_GAP)).toBe(false);
      }
    }
    const tops = solids.map((el) => el.y);
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(0);
    for (const label of added.filter(bound)) {
      const host = added.find((el) => el.id === label.containerId)!;
      expect(label.x - host.x).toBe(8);
      expect(label.y - host.y).toBe(8);
      expect(positiveAreaHit(canvasRect(label)!, canvasRect(host)!)).toBe(true);
      for (const other of solids) {
        if (other.id === host.id) continue;
        expect(positiveAreaHit(canvasRect(label)!, canvasRect(other)!)).toBe(false);
      }
      expect(positiveAreaHit(canvasRect(label)!, canvasRect(kept)!)).toBe(false);
    }
    expect(newMarksOverlapExisting(added, [blocker])).toBe(false);

    const spaced = applyIleXaiTurnToWorkCanvas(emptyIleWorkCanvasScene(), {
      elements: [
        { type: "rectangle", x: 0, y: 0, width: 40, height: 40 },
        { type: "ellipse", x: 80, y: 0, width: 40, height: 40 },
        { type: "text", x: 0, y: 80, text: "beside" },
        { type: "frame", x: 400, y: 400, width: 30, height: 20 },
      ],
    });
    expect(spaced.elements.find((el) => el.type === "rectangle")).toMatchObject({ x: 0, y: 0 });
    expect(spaced.elements.find((el) => el.type === "ellipse")).toMatchObject({ x: 80, y: 0 });
    expect(spaced.elements.find((el) => (el.originalText || el.text) === "beside")).toMatchObject({
      x: 0,
      y: 80,
    });
    expect(spaced.elements.find((el) => el.type === "frame")).toMatchObject({
      x: 400,
      y: 400,
      width: 30,
      height: 20,
    });

    const framed = applyIleXaiTurnToWorkCanvas(emptyIleWorkCanvasScene(), {
      elements: [
        {
          type: "rectangle",
          x: 40,
          y: 40,
          width: 100,
          height: 60,
          label: { text: "A" },
        },
        { type: "rectangle", x: 50, y: 50, width: 100, height: 60, label: { text: "B" } },
        { type: "frame", x: 20, y: 20, width: 220, height: 160 },
        { type: "arrow", x: 50, y: 50, width: 30, height: 0 },
      ],
    });
    const frame = framed.elements.find((el) => el.type === "frame")!;
    const boxA = framed.elements.find((el) =>
      framed.elements.some(
        (label) => label.containerId === el.id && (label.originalText || label.text) === "A",
      ),
    )!;
    const boxB = framed.elements.find((el) =>
      framed.elements.some(
        (label) => label.containerId === el.id && (label.originalText || label.text) === "B",
      ),
    )!;
    const arrow = framed.elements.find((el) => el.type === "arrow")!;
    expect(ileWorkCanvasRectsOverlap(canvasRect(boxA)!, canvasRect(boxB)!, ILE_WORK_CANVAS_OVERLAP_GAP)).toBe(
      false,
    );
    const labelA = framed.elements.find((el) => (el.originalText || el.text) === "A")!;
    expect(labelA.x - boxA.x).toBe(8);
    expect(labelA.y - boxA.y).toBe(8);
    expect(positiveAreaHit(canvasRect(labelA)!, canvasRect(boxB)!)).toBe(false);
    expect(arrow.x - boxA.x).toBe(10);
    expect(arrow.y - boxA.y).toBe(10);
    for (const box of [boxA, boxB]) {
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      expect(center.x).toBeGreaterThanOrEqual(frame.x);
      expect(center.y).toBeGreaterThanOrEqual(frame.y);
      expect(center.x).toBeLessThanOrEqual(frame.x + frame.width);
      expect(center.y).toBeLessThanOrEqual(frame.y + frame.height);
    }
    expect(frame.x).toBeLessThanOrEqual(20);
    expect(frame.y).toBeLessThanOrEqual(20);
    expect(frame.x + frame.width).toBeGreaterThanOrEqual(240);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(180);
    const labelRect = canvasRect(labelA)!;
    expect(labelRect.minX).toBeGreaterThanOrEqual(frame.x);
    expect(labelRect.minY).toBeGreaterThanOrEqual(frame.y);
    expect(labelRect.maxX).toBeLessThanOrEqual(frame.x + frame.width);
    expect(labelRect.maxY).toBeLessThanOrEqual(frame.y + frame.height);
  });
});

function elementWords(el: { originalText?: string; text?: string } | null | undefined): string {
  return String(el?.originalText || el?.text || "").replace(/\s+/g, " ").trim();
}

function boxSeparation(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ra = canvasRect(a);
  const rb = canvasRect(b);
  if (!ra || !rb) return 0;
  const sepX = ra.maxX <= rb.minX ? rb.minX - ra.maxX : rb.maxX <= ra.minX ? ra.minX - rb.maxX : 0;
  const sepY = ra.maxY <= rb.minY ? rb.minY - ra.maxY : rb.maxY <= ra.minY ? ra.minY - rb.maxY : 0;
  if (sepX > 0 || sepY > 0) return Math.max(sepX, sepY);
  return 0;
}

describe("TAP Learning Work canvas selection commands (shipped)", () => {
  it("compresses only the selection, refactors it, suggests an insight, clears overlaps, and highlights new marks", () => {
    const selected = convertToExcalidrawElements([
      { type: "text", text: "alpha claim about last resort", x: 0, y: 0, width: 200, height: 48 },
      { type: "text", text: "beta claim about proportionality", x: 40, y: 16, width: 200, height: 48 },
    ]);
    const keeper = convertToExcalidrawElements([
      { type: "text", text: "keep this note", x: 900, y: 700, width: 160, height: 40 },
    ])[0]!;
    const scene: IleWorkCanvasScene = {
      elements: [...selected, keeper],
      appState: {},
      files: {},
    };
    const current = serializeIleWorkCanvasScene(scene);
    const alpha = current.elements.find((el) => elementWords(el).includes("alpha claim"))!;
    const beta = current.elements.find((el) => elementWords(el).includes("beta claim"))!;
    const kept = current.elements.find((el) => elementWords(el).includes("keep this note"))!;
    expect(boxSeparation(alpha, beta)).toBe(0);

    const selective = buildIleWorkCanvasCommandUserMessage({
      kind: "selective-compress",
      prompt: "Compress work",
      selectedElements: [alpha, beta],
      workspace: { workspaceTitle: "Just War Ethics", blockTitle: "Last resort" },
    });
    expect(selective).toContain("alpha claim about last resort");
    expect(selective).toContain("beta claim about proportionality");
    expect(selective).not.toMatch(/whole board/i);
    expect(selective).not.toMatch(/board will be replaced/i);
    expect(selective).toContain("Just War Ethics");

    const blank = compressIleWorkCanvasSelection(current, [alpha, beta], "   ");
    expect(blank.elements.map((el) => [el.id, el.x, el.y, elementWords(el)])).toEqual(
      current.elements.map((el) => [el.id, el.x, el.y, elementWords(el)]),
    );
    const noSelection = compressIleWorkCanvasSelection(
      current,
      [],
      "A summary that must not replace the board.",
    );
    expect(noSelection.elements.map((el) => el.id)).toEqual(current.elements.map((el) => el.id));
    expect(
      noSelection.elements.some((el) => elementWords(el).includes("must not replace")),
    ).toBe(false);

    const compressed = compressIleWorkCanvasSelection(
      current,
      [alpha, beta],
      "One dense takeaway: force is the last resort.",
    );
    const compressedLive = compressed.elements.filter((el) => !el.isDeleted);
    expect(compressedLive.some((el) => elementWords(el) === "One dense takeaway: force is the last resort.")).toBe(
      true,
    );
    expect(compressedLive.some((el) => elementWords(el).includes("alpha claim"))).toBe(false);
    expect(compressedLive.some((el) => elementWords(el).includes("beta claim"))).toBe(false);
    const keptAfterCompress = compressedLive.find((el) => el.id === kept.id)!;
    expect(keptAfterCompress.x).toBe(kept.x);
    expect(keptAfterCompress.y).toBe(kept.y);
    expect(elementWords(keptAfterCompress)).toBe("keep this note");

    const refactored = applyIleWorkCanvasRefactor(
      current,
      [alpha],
      JSON.stringify({
        elements: [{ id: alpha.id, text: "Restated last-resort claim", x: alpha.x + 48, y: alpha.y + 36 }],
      }),
    );
    const movedAlpha = refactored.elements.find((el) => el.id === alpha.id)!;
    expect(elementWords(movedAlpha)).toBe("Restated last-resort claim");
    expect(movedAlpha.x).toBe(alpha.x + 48);
    expect(movedAlpha.y).toBe(alpha.y + 36);
    expect(movedAlpha.type).toBe(alpha.type);
    const untouchedBeta = refactored.elements.find((el) => el.id === beta.id)!;
    const untouchedKeep = refactored.elements.find((el) => el.id === kept.id)!;
    expect(untouchedBeta.x).toBe(beta.x);
    expect(untouchedBeta.y).toBe(beta.y);
    expect(elementWords(untouchedBeta)).toBe(elementWords(beta));
    expect(untouchedKeep.x).toBe(kept.x);
    expect(untouchedKeep.y).toBe(kept.y);
    expect(elementWords(untouchedKeep)).toBe("keep this note");

    const layoutAssistant = JSON.stringify({
      elements: [
        {
          id: alpha.id,
          text: "Restated from the session-chat body",
          x: alpha.x + 64,
          y: alpha.y + 28,
        },
      ],
    });
    const layoutHttp = ileSessionChatCanvasReply(layoutAssistant);
    expect(layoutHttp.message).toBe("");
    expect(layoutHttp.canvasElements).toEqual([]);
    expect(layoutHttp.raw).toBe(layoutAssistant);
    const layoutAsked = ileWorkCanvasAskFromSessionChat({
      ok: true,
      message: layoutHttp.message,
      canvasElements: layoutHttp.canvasElements,
      raw: layoutHttp.raw,
      errorMessage: "Helios could not answer.",
    });
    expect(layoutAsked.raw).toBe(layoutAssistant);
    expect(layoutAsked.text).not.toMatch(/could not answer/i);
    expect(layoutAsked.raw).not.toMatch(/could not answer/i);
    const fromSessionChat = applyIleWorkCanvasRefactor(
      current,
      [alpha],
      ileWorkCanvasLayoutReply(layoutAsked.raw, layoutAsked.elements),
    );
    const sessionAlpha = fromSessionChat.elements.find((el) => el.id === alpha.id)!;
    expect(elementWords(sessionAlpha)).toBe("Restated from the session-chat body");
    expect(sessionAlpha.x).toBe(alpha.x + 64);
    expect(sessionAlpha.y).toBe(alpha.y + 28);
    expect(fromSessionChat.elements.find((el) => el.id === kept.id)?.x).toBe(kept.x);
    expect(elementWords(fromSessionChat.elements.find((el) => el.id === beta.id))).toBe(
      elementWords(beta),
    );

    const toolsAssistant = JSON.stringify({
      elements: [
        {
          type: "text",
          id: alpha.id,
          text: "Tools rephrase that must not be the only copy",
          x: alpha.x + 12,
          y: alpha.y + 18,
        },
        {
          type: "rectangle",
          id: beta.id,
          x: beta.x + 30,
          y: beta.y + 70,
        },
      ],
    });
    const toolsHttp = ileSessionChatCanvasReply(toolsAssistant);
    expect(toolsHttp.canvasElements.map((el) => el.id)).toEqual([alpha.id, beta.id]);
    expect(toolsHttp.message).toBe("");
    const toolsAsked = ileWorkCanvasAskFromSessionChat({
      ok: true,
      message: toolsHttp.message,
      canvasElements: toolsHttp.canvasElements,
      raw: "",
      errorMessage: "Helios could not answer.",
    });
    expect(toolsAsked.text).toMatch(/could not answer/i);
    const fromCanvasElements = applyIleWorkCanvasRefactor(
      current,
      [alpha],
      ileWorkCanvasLayoutReply(toolsAsked.text, toolsAsked.elements),
    );
    const toolsAlpha = fromCanvasElements.elements.find((el) => el.id === alpha.id)!;
    expect(elementWords(toolsAlpha)).toBe("Tools rephrase that must not be the only copy");
    expect(toolsAlpha.x).toBe(alpha.x + 12);
    expect(toolsAlpha.y).toBe(alpha.y + 18);
    const fromPositions = applyIleWorkCanvasPositionEdits(
      current,
      [alpha, beta],
      ileWorkCanvasLayoutReply(toolsAsked.text, toolsAsked.elements),
    );
    const shiftedBeta = fromPositions.elements.find((el) => el.id === beta.id)!;
    expect(shiftedBeta.x).toBe(beta.x + 30);
    expect(shiftedBeta.y).toBe(beta.y + 70);
    expect(elementWords(shiftedBeta)).toBe(elementWords(beta));
    expect(shiftedBeta.type).toBe(beta.type);

    const suggested = applyIleWorkCanvasSuggestInsight(
      current,
      [alpha, beta],
      "Last resort and proportionality can be one insight.",
    );
    const suggestion = suggested.elements.find(
      (el) => !current.elements.some((prev) => prev.id === el.id) && !el.isDeleted,
    )!;
    expect(elementWords(suggestion)).toContain("Last resort and proportionality");
    expect(suggestion.type).toBe("text");
    for (const id of [alpha.id, beta.id, kept.id]) {
      const before = current.elements.find((el) => el.id === id)!;
      const after = suggested.elements.find((el) => el.id === id)!;
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      expect(elementWords(after)).toBe(elementWords(before));
      expect(after.type).toBe(before.type);
    }

    const ask = viAsk();
    const cleared = runIleWorkCanvasClearOverlaps({
      scene: current,
      selectedElements: [alpha, beta],
      ask,
    });
    expect(cleared.needsModel).toBe(false);
    expect(ask.calls).toEqual([]);
    const clearedAlpha = cleared.scene.elements.find((el) => el.id === alpha.id)!;
    const clearedBeta = cleared.scene.elements.find((el) => el.id === beta.id)!;
    const clearedKeep = cleared.scene.elements.find((el) => el.id === kept.id)!;
    expect(boxSeparation(clearedAlpha, clearedBeta)).toBeGreaterThan(0);
    expect(elementWords(clearedAlpha)).toBe(elementWords(alpha));
    expect(elementWords(clearedBeta)).toBe(elementWords(beta));
    expect(clearedAlpha.type).toBe(alpha.type);
    expect(clearedBeta.type).toBe(beta.type);
    expect(clearedKeep.x).toBe(kept.x);
    expect(clearedKeep.y).toBe(kept.y);
    expect(elementWords(clearedKeep)).toBe("keep this note");

    const gappedBeta = {
      ...beta,
      x: alpha.x,
      y: alpha.y + alpha.height + 40,
    };
    const gappedScene: IleWorkCanvasScene = {
      ...current,
      elements: current.elements.map((el) => (el.id === beta.id ? gappedBeta : el)),
    };
    expect(boxSeparation(alpha, gappedBeta)).toBeGreaterThan(0);
    const gappedAsk = viAsk();
    const gapped = runIleWorkCanvasClearOverlaps({
      scene: gappedScene,
      selectedElements: [alpha, gappedBeta],
      ask: gappedAsk,
    });
    expect(gapped.needsModel).toBe(false);
    expect(gapped.moved).toBe(false);
    expect(gappedAsk.calls).toEqual([]);
    expect(gapped.scene.elements.find((el) => el.id === alpha.id)?.x).toBe(alpha.x);
    expect(gapped.scene.elements.find((el) => el.id === alpha.id)?.y).toBe(alpha.y);
    expect(gapped.scene.elements.find((el) => el.id === gappedBeta.id)?.x).toBe(gappedBeta.x);
    expect(gapped.scene.elements.find((el) => el.id === gappedBeta.id)?.y).toBe(gappedBeta.y);

    const degenerateA = { ...alpha, width: 0, height: 0 };
    const degenerateB = { ...beta, width: 0, height: 0 };
    const degenerateScene: IleWorkCanvasScene = {
      ...current,
      elements: [degenerateA, degenerateB, kept],
    };
    const modelAsk = viAsk();
    const needsModel = runIleWorkCanvasClearOverlaps({
      scene: degenerateScene,
      selectedElements: [degenerateA, degenerateB],
      ask: modelAsk,
    });
    expect(needsModel.needsModel).toBe(true);
    expect(needsModel.moved).toBe(false);
    expect(modelAsk.calls).toHaveLength(1);
    expect(modelAsk.calls[0]).toContain("alpha claim about last resort");
    expect(modelAsk.calls[0]).toMatch(/position/i);
    expect(modelAsk.calls[0]).not.toMatch(/whole board/i);
    const repositioned = applyIleWorkCanvasPositionEdits(
      degenerateScene,
      [degenerateA, degenerateB],
      JSON.stringify({
        elements: [
          { id: degenerateA.id, text: "should not replace alpha", x: 12, y: 18 },
          { id: degenerateB.id, text: "should not replace beta", x: 12, y: 80 },
        ],
      }),
    );
    const positionedA = repositioned.elements.find((el) => el.id === degenerateA.id)!;
    const positionedB = repositioned.elements.find((el) => el.id === degenerateB.id)!;
    expect(positionedA.x).toBe(12);
    expect(positionedA.y).toBe(18);
    expect(positionedB.y).toBe(80);
    expect(elementWords(positionedA)).toBe(elementWords(degenerateA));
    expect(elementWords(positionedB)).toBe(elementWords(degenerateB));
    expect(positionedA.type).toBe(degenerateA.type);
    expect(repositioned.elements.find((el) => el.id === kept.id)?.x).toBe(kept.x);

    const added = convertToExcalidrawElements([
      { type: "text", text: "fresh reply", x: 20, y: 20, width: 120, height: 32 },
    ])[0]!;
    const movedOnly = { ...alpha, x: alpha.x + 25 };
    const after = { elements: [movedOnly, beta, kept, added] };
    const noted = ileWorkCanvasNoteNewMarks({ elements: [alpha, beta, kept] }, after, 5_000);
    expect(noted.scene).toBe(after);
    expect(noted.highlight.ids).toEqual([added.id]);
    expect(after.elements[0]?.x).toBe(movedOnly.x);
    expect(elementWords(after.elements[0])).toBe(elementWords(movedOnly));
    expect(elementWords(added)).toBe(elementWords(noted.scene.elements.find((el) => el.id === added.id)));
    expect(ileWorkCanvasHighlightActive(noted.highlight, 5_000)).toEqual([added.id]);
    expect(
      ileWorkCanvasHighlightActive(noted.highlight, 5_000 + ILE_WORK_CANVAS_NEW_MARK_HIGHLIGHT_MS - 1),
    ).toEqual([added.id]);
    expect(
      ileWorkCanvasHighlightActive(noted.highlight, 5_000 + ILE_WORK_CANVAS_NEW_MARK_HIGHLIGHT_MS),
    ).toEqual([]);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    const view = read("components/SessionView.tsx");
    const phases = read("components/tap-score/tap-score-phases.tsx");
    expect(ILE_LEARN_MORE_LABEL).toBe("Commands");
    expect(canvas).toContain("canvasSelectionActive");
    expect(canvas).toContain('data-ile-canvas-prompt-mode={canvasSelectionActive ? "commands" : "ask"}');
    expect(canvas).not.toContain("commandsOpen");
    expect(canvas).not.toContain("data-ile-learn-more-collapsed");
    expect(canvas).not.toContain("data-ile-learn-more-handle");
    expect(canvas).not.toContain("data-ile-compress-work");
    expect(canvas).toContain("IleCraftInsightButton");
    expect(canvas).toContain("Any questions?");
    expect(canvas).toContain("Prompt a question about this selection");
    expect(canvas).toContain("data-ile-learn-more-quick={command.id}");
    expect(canvas).toContain("title={command.tooltip}");
    expect(canvas).toContain("{command.label}");
    for (const command of ILE_WORK_CANVAS_COMMANDS) {
      expect(command.tooltip.toLowerCase()).not.toBe(command.label.toLowerCase());
      expect(command.tooltip.length).toBeGreaterThan(command.label.length + 8);
    }
    expect(ILE_SELECTIVE_COMPRESSION_LABEL).toBe("Compress");
    expect(canvas).toContain('kind: "selective-compress"');
    expect(canvas).toContain('kind: "refactor"');
    expect(canvas).toContain('kind: "suggest-insight"');
    expect(canvas).toContain('kind: "clear-overlaps"');
    expect(canvas).toContain("runIleWorkCanvasClearOverlaps");
    expect(canvas).toContain("if (!cleared.needsModel && cleared.moved)");
    expect(canvas).toContain("applyIleWorkCanvasSuggestInsight");
    expect(canvas).not.toContain("buildIleCanvasCraftInsightEvaluateRequest");
    expect(canvas).not.toContain("ILE_TURN_INSIGHT_CREATE_PATH");
    expect(canvas).toContain("data-ile-canvas-new-mark");
    expect(canvas).toContain("ileWorkCanvasNoteNewMarks");
    const paste = canvas.slice(
      canvas.indexOf("const flushPendingApply"),
      canvas.indexOf("const syncPromptBarPlacement"),
    );
    expect(paste).toContain("rememberNewCanvasMarks");
    expect(paste).toContain("scrollToContent");
    const rememberBody = canvas.slice(
      canvas.indexOf("const rememberNewCanvasMarks"),
      canvas.indexOf("const syncThinkingOverlay"),
    );
    expect(rememberBody).toContain("ileWorkCanvasNoteNewMarks");
    const applyBody = canvas.slice(
      canvas.indexOf("const applyReply"),
      canvas.indexOf("const reply = await ask"),
    );
    expect(applyBody).toContain("ileWorkCanvasNoteNewMarks");
    expect(applyBody).toContain("scrollToContent");
    const changeStart = canvas.indexOf("const handleChange = useCallback");
    const changeBody = canvas.slice(changeStart, canvas.indexOf("debouncedExportPNG();", changeStart));
    expect(changeBody).not.toContain("ileWorkCanvasNoteNewMarks");
    expect(view).toContain("buildIleWorkCanvasCommandUserMessage");
    expect(view).not.toContain("buildIleWorkCanvasCompressUserMessage");
    expect(view).toContain("ileWorkCanvasAskFromSessionChat");
    expect(view).toContain("raw: data?.raw");
    expect(view).toContain("return asked");
    const route = read("app/api/session-chat/route.ts");
    expect(route).toContain("ileSessionChatCanvasReply");
    expect(route).toContain("raw: canvasReply.raw");
    expect(canvas).toContain("ileWorkCanvasLayoutReply(payload.raw, payload.elements)");
    expect(phases).toContain("buildIleWorkCanvasCommandUserMessage");
    expect(phases).not.toContain("buildIleWorkCanvasCompressUserMessage");
    expect(phases).not.toContain('kind === "compress"');
    const suggestSource = read("lib/ile-work-canvas.ts");
    const suggestStart = suggestSource.indexOf("export function applyIleWorkCanvasSuggestInsight");
    const suggestBody = suggestSource.slice(
      suggestStart,
      suggestSource.indexOf("export function applyIleWorkCanvasPositionEdits"),
    );
    expect(suggestBody).not.toContain("/api/insights");
    expect(suggestBody).not.toContain("evaluate");

    writeScratch(
      "work-canvas-commands.log",
      [
        `selectiveKeeps=${elementWords(keptAfterCompress)}`,
        `refactorMoved=${movedAlpha.x !== alpha.x && elementWords(movedAlpha) !== elementWords(alpha)}`,
        `suggestAdded=${elementWords(suggestion)}`,
        `gap=${boxSeparation(clearedAlpha, clearedBeta)}`,
        `clearAskCalls=${ask.calls.length}`,
        `gappedAskCalls=${gappedAsk.calls.length}`,
        `modelAsk=${modelAsk.calls.length}`,
        `highlightUntil=${noted.highlight.untilMs}`,
        "commands=Rephrase Split Elaborate Compress Refactor Suggest Insight Clear overlaps",
      ].join("\n") + "\n",
    );
  });
});

function viAsk(): { calls: string[]; (message: string): void } {
  const calls: string[] = [];
  const ask = (message: string) => {
    calls.push(message);
  };
  return Object.assign(ask, { calls });
}
