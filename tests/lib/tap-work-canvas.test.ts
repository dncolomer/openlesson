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
  placeThenReplaceTapXaiLoading,
  serializeTapWorkCanvasScene,
  tapHeliosCanvasBusy,
  tapWorkCanvasAskUserMessage,
  tapWorkCanvasShouldAcceptSceneUpdate,
} from "@/lib/tap-work-canvas";
import { mapExcalidrawToolToIlePow } from "@/lib/ile-work-canvas";
import { convertToExcalidrawElements } from "@/lib/ile-work-canvas";
import { readTapScoreSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-871793e0b32f/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
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
    expect(live).toContain("ExcalidrawCanvas");
    expect(phases).toContain("data-tap-convo-work-canvas-pane");
    expect(phases).toContain("onAskSelected");
    expect(phases).toContain("applyTapHeliosReplyToWorkCanvas");
    expect(phases).toContain("applyTapAssistantTurnsToWorkCanvas");
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

    expect(phases).toContain("ExcalidrawCanvas");
    expect(phases).toContain("buildTapExcalidrawToolUploadItem");
    expect(phases).toContain("buildTapCanvasSnapshotUploadItem");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("heliosBusy");
    expect(canvas).toContain("showHeliosThinking");
    expect(canvas).toContain("data-ile-canvas-thinking");
    expect(canvas).toContain("ileHeliosThinkingLine");
    expect(canvas).toContain("flushPendingApply");
    expect(canvas).toContain("pendingApplyRef");

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
      toolName: "text",
      toolAction: "text",
    });
    const tool = buildTapExcalidrawToolUploadItem("tap-session-1", {
      activeTool: "freedraw",
      timestampMs: 42,
    });
    expect(tool?.toolName).toBe("freedraw");
    expect(tool?.toolAction).toBe("freedraw");
    expect(tool?.fileName).toMatch(/excalidraw-freedraw/);
    expect(buildTapExcalidrawToolUploadItem("tap-session-1", { activeTool: "notebook" })).toBeNull();

    const snap = buildTapCanvasSnapshotUploadItem("tap-session-1", '{"elements":[]}', 99);
    expect(snap.toolName).toBe("canvas");
    expect(snap.toolAction).toBe("canvas_draw");
    expect(snap.payload).toContain("tap-session-1");

    const live = readTapScoreSurface();
    expect(live).toContain("buildTapExcalidrawToolUploadItem");
    expect(live).toContain("buildTapCanvasSnapshotUploadItem");
    expect(live).toContain("uploadTapWorkCanvasPow");
    expect(live).toContain("onExcalidrawTool");
    const runtime = read("lib/tap-session-runtime.ts");
    expect(runtime).toContain('canvas: "/api/workspace-tap-score/canvas"');
    expect(existsSync(join(ROOT, "app/api/workspace-tap-score/canvas/route.ts"))).toBe(true);

    writeScratch(
      "tap-canvas-pow.log",
      [
        `tool=${tool?.toolName}/${tool?.toolAction}`,
        `snap=${snap.toolName}/${snap.toolAction}`,
        "live wires buildTapExcalidrawToolUploadItem + buildTapCanvasSnapshotUploadItem",
        "path=/api/workspace-tap-score/canvas",
      ].join("\n") + "\n",
    );
  });
});
