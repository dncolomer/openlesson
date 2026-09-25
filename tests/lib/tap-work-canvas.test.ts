/**
 * TAP session Work canvas: apply Helios replies, pull-in selection, PoW builders.
 * Drives shipped ILE apply/PoW units via TAP wrappers — no reimplementation.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  applyTapAssistantTurnsToWorkCanvas,
  applyTapHeliosReplyToWorkCanvas,
  buildTapCanvasSnapshotUploadItem,
  buildTapExcalidrawToolUploadItem,
  buildTapWorkCanvasAskUserMessage,
  emptyTapWorkCanvasScene,
  ILE_XAI_LOADING_CUSTOM_DATA_KEY,
  ILE_XAI_LOADING_TEXT,
  parseTapXaiCanvasTurn,
  placeThenReplaceTapXaiLoading,
  serializeTapWorkCanvasScene,
  tapHeliosCanvasBusy,
  tapWorkCanvasAskUserMessage,
  tapWorkCanvasShouldAcceptSceneUpdate,
  tapWorkCanvasTurnContextMessage,
} from "@/lib/tap-work-canvas";
import {
  convertToExcalidrawElements,
  ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION,
  ILE_XAI_LOADING_BOX_HEIGHT,
  ILE_XAI_LOADING_BOX_WIDTH,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasThinkingOverlayStyle,
  ileWorkCanvasXaiToolsInstruction,
  mapExcalidrawToolToIlePow,
  wrapIleWorkCanvasText,
} from "@/lib/ile-work-canvas";
import { readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-43f631c11586/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
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

describe("TAP Work canvas apply / pull (shipped)", () => {
  it("drops a Helios reply onto an empty TAP scene, places then replaces loading, and builds ask-about-selection", () => {
    const empty = emptyTapWorkCanvasScene();
    expect(empty.elements).toHaveLength(0);
    expect(empty.appState.gridModeEnabled).toBe(true);

    const applied = applyTapHeliosReplyToWorkCanvas(
      empty,
      "What is the first checkable intermediate for this heap insert?",
      [{ type: "rectangle", x: 80, y: 200, width: 120, height: 40 }],
      "helios-1",
    );
    const textEl = applied.elements.find((el) => el.type === "text");
    expect(textEl?.originalText || textEl?.text).toContain("heap insert");
    expect(
      applied.elements.some(
        (el) => String(el.text || el.originalText || "") === ILE_XAI_LOADING_TEXT,
      ),
    ).toBe(false);
    expect(applied.elements.some((el) => el.type === "rectangle")).toBe(true);
    expect(tapHeliosCanvasBusy({ isStartingSession: true, hasAssistantTurn: false })).toBe(true);
    expect(tapHeliosCanvasBusy({ isStartingSession: true, hasAssistantTurn: true })).toBe(false);
    expect(tapHeliosCanvasBusy({ isSending: true, hasAssistantTurn: true })).toBe(true);
    expect(tapHeliosCanvasBusy({ isSending: false, isStartingSession: false, hasAssistantTurn: false })).toBe(
      false,
    );
    expect(JSON.stringify(applied)).not.toBe(JSON.stringify(empty));

    const fromTurns = applyTapAssistantTurnsToWorkCanvas(empty, [
      { id: "open-1", role: "assistant", content: "Walk the heap insert from this array." },
    ]);
    expect(fromTurns.elements.some((el) => String(el.originalText || el.text || "").includes("heap insert"))).toBe(
      true,
    );
    expect(
      fromTurns.elements.some(
        (el) => String(el.text || el.originalText || "") === ILE_XAI_LOADING_TEXT,
      ),
    ).toBe(false);
    expect(tapWorkCanvasShouldAcceptSceneUpdate(fromTurns, empty)).toBe(false);
    expect(tapWorkCanvasShouldAcceptSceneUpdate(empty, fromTurns)).toBe(true);
    expect(tapWorkCanvasShouldAcceptSceneUpdate(empty, empty)).toBe(true);
    const deletedAll = {
      ...fromTurns,
      elements: fromTurns.elements.map((el) => ({ ...el, isDeleted: true })),
    };
    expect(tapWorkCanvasShouldAcceptSceneUpdate(fromTurns, deletedAll)).toBe(true);

    const loadingTurn = "pending-ask";
    const placed = placeThenReplaceTapXaiLoading(applied, loadingTurn, {
      text: "Now name the failure mode if the parent is larger.",
      turnId: loadingTurn,
    });
    expect(placed.loading.text || placed.loading.originalText).toBe(ILE_XAI_LOADING_TEXT);
    expect(placed.loading.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY]).toBe(true);
    expect(
      placed.withLoading.elements.some((el) => el.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY]),
    ).toBe(true);
    expect(
      placed.replaced.elements.some((el) => el.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY]),
    ).toBe(false);
    expect(
      placed.replaced.elements.some((el) =>
        String(el.originalText || el.text || "").includes("failure mode"),
      ),
    ).toBe(true);

    const selected = convertToExcalidrawElements([
      { type: "text", text: "heap insert walk", x: 10, y: 10 },
    ]);
    const ask = tapWorkCanvasAskUserMessage({
      prompt: "Why this parent?",
      selectedElements: selected,
    });
    expect(ask).toContain("Why this parent?");
    expect(ask).toContain("heap insert walk");
    expect(ask).toBe(
      buildTapWorkCanvasAskUserMessage({
        prompt: "Why this parent?",
        selectedElements: selected,
      }),
    );
    const boardAsk = tapWorkCanvasAskUserMessage({ prompt: "Sketch the first swap." });
    expect(boardAsk).toContain("Sketch the first swap.");
    expect(boardAsk).not.toContain("Selected elements:");
    expect(boardAsk).toBe(buildTapWorkCanvasAskUserMessage({ prompt: "Sketch the first swap." }));

    writeScratch(
      "tap-work-canvas-apply.log",
      [
        `emptyElements=${empty.elements.length}`,
        `appliedTypes=${applied.elements.map((el) => el.type).join(",")}`,
        `appliedHasText=${Boolean(textEl)}`,
        `loadingText=${placed.loading.text || placed.loading.originalText}`,
        `replacedHasLoading=${placed.replaced.elements.some((el) => el.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY])}`,
        `askIncludesSelection=${ask.includes("heap insert walk")}`,
        `openingHasThinkingText=false`,
        `busyStart=${tapHeliosCanvasBusy({ isStartingSession: true, hasAssistantTurn: false })}`,
        `busyAfterOpening=${tapHeliosCanvasBusy({ isStartingSession: true, hasAssistantTurn: true })}`,
        `rejectEmptyWipe=${tapWorkCanvasShouldAcceptSceneUpdate(fromTurns, empty)}`,
        `fromTurnsHasOpening=${fromTurns.elements.some((el) => String(el.originalText || el.text || "").includes("heap insert"))}`,
        `serializedKeys=${Object.keys(serializeTapWorkCanvasScene(applied)).join(",")}`,
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Work canvas live surface (shipped)", () => {
  it("conversational live left pane mounts Work canvas / Excalidraw, not the TAP map", () => {
    const live = readTapScoreSurface();
    const phases = read("components/tap-score/tap-score-phases.tsx");
    expect(live).toContain("WorkCanvas");
    expect(phases).toContain("data-tap-convo-work-canvas-pane");
    expect(phases).toContain("onAskSelected");
    expect(phases).toContain("onAskSelected={handleAskSelected}");
    expect(phases).toContain("applyTapHeliosReplyToWorkCanvas");
    expect(phases).toContain("applyTapAssistantTurnsToWorkCanvas");
    expect(phases).toContain("if (!missing.length) return");
    expect(phases).not.toContain("if (!missing.length && !boardEmpty) return");
    expect(phases).toContain("tapWorkCanvasShouldAcceptSceneUpdate");
    expect(phases).toContain("tapHeliosCanvasBusy");
    expect(phases).toContain("heliosBusy");
    expect(phases).not.toContain("createTapXaiLoadingPlaceholder");
    expect(phases).not.toContain("replaceTapXaiLoadingPlaceholder");
    expect(phases).toContain("tapWorkCanvasAskUserMessage");
    expect(phases).not.toContain("TapSessionMap");
    expect(phases).not.toContain("tapConvoBlocksFromAssistantTurns");
    expect(phases).not.toContain("data-tap-convo-map-pane");
    expect(live).toContain("ThoughtMemoryPanel");
    expect(live).toContain("ImDoneAnsweringControl");
    expect(live).toContain("stashCurrentTranscription");
    expect(live).toContain("data-tap-convo-live-split");
    expect(live).toContain("data-tap-transcript-container");
    expect(live).toContain("logTapTrace");

    expect(phases).toContain("<WorkCanvas");
    expect(phases).toContain('import { WorkCanvas } from "@/components/ExcalidrawCanvas"');
    expect(phases).toContain("buildTapWorkCanvasActionUploadItem");
    expect(phases).toContain("buildTapCanvasSnapshotUploadItem");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("heliosBusy");
    expect(canvas).toContain("showHeliosThinking");
    expect(canvas).toContain("data-ile-canvas-thinking");
    expect(canvas).toContain("ileHeliosThinkingLine");
    expect(canvas).toContain("flushPendingApply");
    expect(canvas).toContain("pendingApplyRef");
    expect(canvas).toContain("scheduleCenterOnOpen");
    expect(canvas).toContain("scrollToContent");
    expect(canvas).toContain("data-ile-canvas-prompt-bar");
    expect(canvas).toContain("top: promptBarTop");
    expect(canvas).toContain("width: promptBarWidth");
    expect(canvas).not.toContain("inset-x-0 bottom-3 z-[58]");
    expect(canvas).toContain("handleBoardAsk");
    expect(canvas).toContain("data-ile-compress-work");
    expect(canvas).toContain("handleCompressWork");
    expect(canvas).toContain("ileWorkCanvasThinkingOverlayStyle");

    const propsType = phases.slice(
      phases.indexOf("export function TapScorePhases(props: {"),
      phases.indexOf("}) {"),
    );
    expect((propsType.match(/privateToken\?:/g) || []).length).toBe(1);
    const destructure = phases.slice(phases.indexOf("\n  const {"), phases.indexOf("} = props;"));
    expect((destructure.match(/\bprivateToken\b/g) || []).length).toBe(1);
    const parsed = ts.transpileModule(phases, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
      fileName: "tap-score-phases.tsx",
      reportDiagnostics: true,
    });
    const parseErrors = (parsed.diagnostics ?? []).filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    );
    expect(parseErrors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual(
      [],
    );

    writeScratch(
      "tap-live-left-canvas.log",
      [
        "left=ExcalidrawCanvas",
        "pane=data-tap-convo-work-canvas-pane",
        "heliosBusy=ILE thinking chip not Thinking... text",
        "no TapSessionMap",
        "no tapConvoBlocksFromAssistantTurns",
        "right=ThoughtMemoryPanel+ImDoneAnsweringControl+stash+timer",
        "traces=logTapTrace",
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Work canvas PoW (shipped ILE builders)", () => {
  it("maps Excalidraw tools and canvas snapshots the same class as ILE; TAP live wires them", () => {
    expect(mapExcalidrawToolToIlePow({ activeTool: "text" })).toEqual({
      toolName: "canvas",
      toolAction: "draw_text",
    });
    const tool = buildTapExcalidrawToolUploadItem("tap-session-1", {
      activeTool: "freedraw",
      timestampMs: 42,
    });
    expect(tool?.toolName).toBe("canvas");
    expect(tool?.toolAction).toBe("draw_freedraw");
    expect(tool?.fileName).toMatch(/canvas-draw_freedraw/);
    expect(buildTapExcalidrawToolUploadItem("tap-session-1", { activeTool: "notebook" })).toBeNull();

    const snap = buildTapCanvasSnapshotUploadItem("tap-session-1", '{"elements":[]}', 99);
    expect(snap.toolName).toBe("canvas");
    expect(snap.toolAction).toBe("canvas_draw");
    expect(snap.payload).toContain("tap-session-1");

    const live = readTapScoreSurface();
    expect(live).toContain("buildTapWorkCanvasActionUploadItem");
    expect(live).toContain("buildTapCanvasSnapshotUploadItem");
    expect(live).toContain("uploadTapWorkCanvasPow");
    expect(live).toContain("onCanvasPowActions");
    const runtime = read("lib/tap-session-runtime.ts");
    expect(runtime).toContain('canvas: "/api/workspace-tap-score/canvas"');
    expect(existsSync(join(ROOT, "app/api/workspace-tap-score/canvas/route.ts"))).toBe(true);

    writeScratch(
      "tap-canvas-pow.log",
      [
        `tool=${tool?.toolName}/${tool?.toolAction}`,
        `snap=${snap.toolName}/${snap.toolAction}`,
        "live wires buildTapWorkCanvasActionUploadItem + buildTapCanvasSnapshotUploadItem",
        "path=/api/workspace-tap-score/canvas",
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Work canvas XAI origin + board ask (shipped)", () => {
  it("honors a suggested origin, falls back without one, and wires the anchored bar", () => {
    const empty = emptyTapWorkCanvasScene();
    const parsed = parseTapXaiCanvasTurn(
      JSON.stringify({
        text: "Name the parent index.",
        origin: { x: 310, y: 90 },
        elements: [{ type: "ellipse", x: 12, y: 40, width: 60, height: 40 }],
      }),
    );
    expect(parsed.origin).toEqual({ x: 310, y: 90 });
    const placed = applyTapHeliosReplyToWorkCanvas(
      empty,
      JSON.stringify({
        text: "Name the parent index.",
        origin: { x: 310, y: 90 },
        elements: [{ type: "ellipse", x: 12, y: 40, width: 60, height: 40 }],
      }),
    );
    const reply = placed.elements.find((el) => (el.originalText || el.text) === "Name the parent index.");
    expect(reply?.x).toBe(310);
    expect(reply?.y).toBe(90);
    const extra = placed.elements.find((el) => el.type === "ellipse");
    expect(extra?.x).toBe(12);
    expect(extra?.y).toBe(40);

    const prose = applyTapHeliosReplyToWorkCanvas(empty, "Walk the first swap.");
    expect(prose.elements.some((el) => String(el.originalText || el.text || "").includes("first swap"))).toBe(true);
    expect(ileWorkCanvasFiniteOrigin(parseTapXaiCanvasTurn("Walk the first swap.").origin)).toBeNull();

    const ctx = tapWorkCanvasTurnContextMessage(placed);
    expect(ctx).toContain("SESSION");
    expect(ctx).toContain("Name the parent index.");
    expect(ctx).toContain(ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("data-ile-canvas-prompt-bar");
    const phases = read("components/tap-score/tap-score-phases.tsx");
    expect(phases).toContain("onAskSelected={handleAskSelected}");

    const box = ileWorkCanvasThinkingOverlayStyle();
    expect(box.width).toBe(ILE_XAI_LOADING_BOX_WIDTH);
    expect(box.height).toBe(ILE_XAI_LOADING_BOX_HEIGHT);
    expect(box.width).toBe(box.height);
    expect(box.height).toBeGreaterThan(52);

    writeScratch(
      "tap-xai-canvas-origin.log",
      [
        `origin=${JSON.stringify(parsed.origin)}`,
        `placed=${reply?.x},${reply?.y}`,
        `contextAsksOrigin=${ctx.includes(ILE_WORK_CANVAS_TURN_ORIGIN_INSTRUCTION)}`,
        `bar=${canvas.includes("data-ile-canvas-prompt-bar")}`,
        `overlay=${box.width}x${box.height}`,
      ].join("\n") + "\n",
    );
  });
});

describe("TAP Work canvas workspace+block domain context (shipped)", () => {
  it("canvas ask and turn context carry workspace title/goal and focused block", () => {
    const workspace = {
      workspaceTitle: "Heap Lab",
      workspaceGoal: "Insert into a binary heap without breaking the heap property",
      blockTitle: "Heap insert",
      blockDescription: "Sift up after append until the parent is smaller.",
    };
    const selected = convertToExcalidrawElements([
      { type: "text", text: "heap insert walk", x: 10, y: 10 },
    ]);
    const ask = tapWorkCanvasAskUserMessage({
      prompt: "Why this parent?",
      selectedElements: selected,
      workspace,
    });
    expect(ask).toContain("Heap Lab");
    expect(ask).toContain("Insert into a binary heap without breaking the heap property");
    expect(ask).toContain("Heap insert");
    expect(ask).toContain("Sift up after append until the parent is smaller.");
    expect(ask).toMatch(/do not invent unrelated topics/i);
    expect(ask).toContain("Why this parent?");

    const scene = applyTapHeliosReplyToWorkCanvas(emptyTapWorkCanvasScene(), "Name the parent index.");
    const ctx = tapWorkCanvasTurnContextMessage(scene, { workspace });
    expect(ctx).toContain("SESSION");
    expect(ctx).toContain("Heap Lab");
    expect(ctx).toContain("Heap insert");
    expect(ctx).toContain("Name the parent index.");
    expect(ctx).toMatch(/do not invent unrelated topics/i);

    const route = read("app/api/workspace-tap-score/chat/route.ts");
    expect(route).toContain("tapWorkCanvasTurnContextMessage");
    expect(route).toContain("tapScoreBriefToPromptWorkspaceInput");
    expect(route).toContain("assemblePromptWorkspaceContext");
    expect(route).toContain("focusedBlockId: blockId || access.blockId");
    const phases = read("components/tap-score/tap-score-phases.tsx");
    expect(phases).toContain("workspace: { workspaceTitle }");
    expect(phases).toContain("onAskSelected={handleAskSelected}");
    expect(phases).toContain("heliosBusy={heliosBusy}");
    expect(phases).toContain("onSceneChange={handleSceneChange}");
    expect(phases).toContain("onCanvasPowActions={handleCanvasPowActions}");
  });
});

describe("TAP Work canvas non-overlap and session geometry (shipped)", () => {
  it("shifts a loading replacement whose real footprint hits a live mark, and lists that mark for Learn and Drill", () => {
    const existing = convertToExcalidrawElements([
      { type: "rectangle", x: 30, y: 30, width: 140, height: 90 },
    ])[0]!;
    const scene = { elements: [existing], appState: {}, files: {} };
    const placed = placeThenReplaceTapXaiLoading(scene, "tap-load", {
      text: "Name the parent index.",
      elements: [{ type: "rectangle", x: 30, y: 30, width: 140, height: 90 }],
    });
    expect(placed.replaced.elements.some((el) => el.id === placed.loading.id)).toBe(false);
    expect(placed.replaced.elements.some((el) => el.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY])).toBe(
      false,
    );
    const kept = placed.replaced.elements.find((el) => el.id === existing.id)!;
    expect(kept.x).toBe(existing.x);
    expect(kept.y).toBe(existing.y);
    expect(kept.width).toBe(existing.width);
    expect(kept.height).toBe(existing.height);
    const added = placed.replaced.elements.filter((el) => el.id !== existing.id);
    expect(newMarksOverlapExisting(added, [existing])).toBe(false);
    const addedText = added.find((el) => (el.originalText || el.text) === "Name the parent index.")!;
    const addedRect = added.find((el) => el.type === "rectangle")!;
    expect(addedText.x - addedRect.x).toBe(placed.loading.x - 30);
    expect(addedText.y - addedRect.y).toBe(placed.loading.y - 30);

    const blocker = convertToExcalidrawElements([
      { type: "rectangle", x: 120, y: 80, width: 80, height: 50 },
    ])[0]!;
    const collided = applyTapHeliosReplyToWorkCanvas(
      { elements: [blocker], appState: {}, files: {} },
      JSON.stringify({
        text: "Walk the sift.",
        origin: { x: blocker.x, y: blocker.y },
      }),
      null,
      "tap-hit",
    );
    const moved = collided.elements.find((el) => el.originalText === "Walk the sift.")!;
    expect(moved.x !== blocker.x || moved.y !== blocker.y).toBe(true);
    expect(collided.elements.find((el) => el.id === blocker.id)?.x).toBe(blocker.x);
    expect(newMarksOverlapExisting([moved], [blocker])).toBe(false);

    const open = applyTapHeliosReplyToWorkCanvas(
      { elements: [blocker], appState: {}, files: {} },
      JSON.stringify({ text: "Free corner.", origin: { x: 3600, y: 2800 } }),
      null,
      "tap-free",
    );
    const stayed = open.elements.find((el) => el.originalText === "Free corner.")!;
    expect(stayed.x).toBe(3600);
    expect(stayed.y).toBe(2800);

    const tall = "stack the wrapped lines ".repeat(30).trim();
    const metrics = wrapIleWorkCanvasText(tall);
    expect(metrics.height).toBeGreaterThan(ILE_XAI_LOADING_BOX_HEIGHT);
    const below = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: 80,
        y: 40 + ILE_XAI_LOADING_BOX_HEIGHT + 12,
        width: 90,
        height: 28,
      },
    ])[0]!;
    const square = canvasRect({
      x: 80,
      y: 40,
      width: ILE_XAI_LOADING_BOX_WIDTH,
      height: ILE_XAI_LOADING_BOX_HEIGHT,
    })!;
    const naive = canvasRect({ x: 80, y: 40, width: metrics.width, height: metrics.height })!;
    expect(positiveAreaHit(square, canvasRect(below)!)).toBe(false);
    expect(positiveAreaHit(naive, canvasRect(below)!)).toBe(true);
    const tallPlaced = placeThenReplaceTapXaiLoading(
      { elements: [below], appState: {}, files: {} },
      "tap-tall",
      { text: tall, origin: { x: 80, y: 40 } },
    );
    const tallReply = tallPlaced.replaced.elements.find((el) => el.originalText === tall)!;
    expect(tallPlaced.replaced.elements.some((el) => el.customData?.[ILE_XAI_LOADING_CUSTOM_DATA_KEY])).toBe(
      false,
    );
    expect(tallPlaced.replaced.elements.find((el) => el.id === below.id)?.y).toBe(below.y);
    expect(newMarksOverlapExisting([tallReply], [below])).toBe(false);

    const deleted = {
      ...blocker,
      id: "gone",
      isDeleted: true,
      type: "text",
      text: "TAP_DELETED_MARK",
      originalText: "TAP_DELETED_MARK",
      x: 7,
      y: 9,
      width: 11,
      height: 13,
    };
    const ctx = tapWorkCanvasTurnContextMessage({
      elements: [blocker, deleted],
      appState: { collaborators: { "cursor-agent-77": { pointer: { x: 1234, y: 5678 } } } },
      files: {},
    });
    expect(ctx).toContain("SESSION");
    expect(ctx).toContain(
      `rectangle x=${blocker.x} y=${blocker.y} width=${blocker.width} height=${blocker.height}`,
    );
    expect(ctx).toContain("freedraw");
    expect(ctx).toContain(ileWorkCanvasXaiToolsInstruction());
    expect(ctx).not.toContain("TAP_DELETED_MARK");
    expect(ctx).not.toContain("cursor-agent-77");

    const phases = read("components/tap-score/tap-score-phases.tsx");
    const route = read("app/api/workspace-tap-score/chat/route.ts");
    expect(phases).toContain("applyTapHeliosReplyToWorkCanvas");
    expect(route).toContain("tapWorkCanvasTurnContextMessage");

    writeScratch(
      "canvas-nonoverlap-tap.txt",
      [
        `groupShifted=${addedText.x !== placed.loading.x || addedRect.x !== 30}`,
        `layoutKept=${addedText.x - addedRect.x === placed.loading.x - 30}`,
        `freeStayed=${stayed.x === 3600 && stayed.y === 2800}`,
        `tallCleared=${!newMarksOverlapExisting([tallReply], [below])}`,
        `sessionGeometry=${ctx.includes(`width=${blocker.width}`)}`,
        `tools=${ctx.includes("freedraw")}`,
      ].join("\n") + "\n",
    );
  });
});
