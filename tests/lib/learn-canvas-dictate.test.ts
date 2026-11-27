import { createElement } from "react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readExcalidrawSurface, readSessionStageSurface } from "../helpers/surface-source";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";
import { CanvasPromptBar } from "@/components/excalidraw-canvas/canvas-prompt-bar";
import type { SessionMarkMode } from "@/lib/session-marks";

vi.mock("@excalidraw/excalidraw/index.css", () => ({}));
vi.mock("@/app/learn-excalidraw-theme.css", () => ({}));
import { IleCanvasDictateButton } from "@/components/session-view/learn-canvas-dictate-button";
import {
  ILE_CANVAS_DICTATE_AUTHOR,
  ILE_CANVAS_DICTATE_RUN_LABEL,
  ILE_CANVAS_DICTATE_LABEL,
  ILE_CANVAS_DICTATE_STOP_LABEL,
  advanceIleDictateCapture,
  appendIleDictatedTextToWorkCanvas,
  ileDictateCaptureText,
  noteIleDictateTranscript,
  startIleDictateCapture,
  syncIleDictatedTextOnWorkCanvas,
} from "@/lib/learn-canvas-dictate";
import {
  BOARD_INSTRUCTION_NOTE_KEY,
  ileWorkCanvasViewportCenter,
} from "@/lib/learn-work-canvas";
import {
  ILE_WORK_CANVAS_DICTATE_ACTION,
  IleWorkCanvasPowCollector,
  buildIleWorkCanvasActionUploadItem,
  buildIleWorkCanvasDictatePowEvent,
} from "@/lib/learn-work-canvas-pow";
import {
  ileCanvasSlashBarOpen,
  ileCanvasSlashKeyOpensBar,
} from "@/lib/learn-work-canvas";
import {
  convertToExcalidrawElements,
  ileWorkCanvasElementRect,
  ileWorkCanvasRectsOverlap,
} from "@/lib/learn-work-canvas";

const ROOT = join(__dirname, "../..");

function promptBar(mode: SessionMarkMode) {
  return renderToStaticMarkup(
    createElement(CanvasPromptBar, {
      askInFlight: 0,
      canvasSelectionActive: false,
      promptBarWidth: 480,
      submitCommand: () => {},
      slashBarOpen: false,
      commandText: "",
      setCommandText: () => {},
      handleQuickAction: () => {},
      commandInputRef: { current: null },
      writeDictatedText: () => [],
      selectedCanvasElements: () => [],
      selectedMarkTexts: [],
      markSpeech: "",
      sessionMarkMode: mode,
      dictateTranscript: "",
    }),
  );
}

function read(rel: string) {
  if (rel === "components/ExcalidrawCanvas.tsx") return readExcalidrawSurface();
  if (rel === "components/SessionView.tsx") return readSessionStageSurface();
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("canvas dictate capture", () => {
  it("keeps speech from before the click out of the note", () => {
    const capture = startIleDictateCapture("already said");
    expect(ileDictateCaptureText(capture)).toBe("");
    const next = noteIleDictateTranscript(capture, "already said and this is new");
    expect(ileDictateCaptureText(next)).toBe("and this is new");
  });

  it("replaces an interim correction instead of duplicating it", () => {
    let capture = startIleDictateCapture("");
    capture = noteIleDictateTranscript(capture, "hello world");
    capture = noteIleDictateTranscript(capture, "hello word");
    expect(ileDictateCaptureText(capture)).toBe("hello word");
  });

  it("appends the next utterance after the speech bar resets", () => {
    let capture = startIleDictateCapture("already said");
    capture = noteIleDictateTranscript(capture, "already said and more");
    capture = noteIleDictateTranscript(capture, "");
    capture = noteIleDictateTranscript(capture, "brand new sentence");
    expect(ileDictateCaptureText(capture)).toBe("and more brand new sentence");
  });

  it("returns nothing when dictate stops before any new speech", () => {
    const capture = noteIleDictateTranscript(startIleDictateCapture("already said"), "already said");
    expect(ileDictateCaptureText(capture)).toBe("");
  });
});

function dictateBodyText(
  scene: { elements: { id: string; originalText?: string; text?: string; customData?: Record<string, unknown> | null }[] },
  elementId: string | null,
) {
  return scene.elements.find((el) => el.id === elementId);
}

function dictateLabel(
  scene: { elements: { originalText?: string; text?: string; customData?: Record<string, unknown> | null }[] },
) {
  return scene.elements.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "label");
}

describe("canvas dictate live text", () => {
  it("opens a Dictate note on start and fills the same card as speech arrives", () => {
    const opened = syncIleDictatedTextOnWorkCanvas(
      { elements: [], appState: {}, files: {} },
      "",
      null,
      { persistEmpty: true },
    );
    expect(opened.changed).toBe(true);
    expect(opened.elementId).toBeTruthy();
    expect(String(dictateLabel(opened.scene)?.originalText || dictateLabel(opened.scene)?.text || "")).toBe(
      "Dictate",
    );
    expect(String(dictateBodyText(opened.scene, opened.elementId)?.originalText || "")).toBe("");
    expect(opened.scene.elements.some((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body")).toBe(
      true,
    );

    let capture = startIleDictateCapture("already said");
    let live = advanceIleDictateCapture(capture, "already said hello");
    capture = live.capture;
    expect(live.text).toBe("hello");

    const first = syncIleDictatedTextOnWorkCanvas(opened.scene, live.text, opened.elementId, {
      persistEmpty: true,
    });
    expect(first.changed).toBe(true);
    expect(first.elementId).toBe(opened.elementId);
    expect(dictateBodyText(first.scene, first.elementId)?.originalText).toBe("hello");
    expect(dictateBodyText(first.scene, first.elementId)?.customData).toMatchObject({
      author: ILE_CANVAS_DICTATE_AUTHOR,
    });

    live = advanceIleDictateCapture(capture, "already said hello world");
    const second = syncIleDictatedTextOnWorkCanvas(first.scene, live.text, first.elementId, {
      persistEmpty: true,
    });
    expect(second.elementId).toBe(first.elementId);
    expect(dictateBodyText(second.scene, second.elementId)?.originalText).toBe("hello world");
    expect(dictateBodyText(second.scene, second.elementId)?.customData).not.toMatchObject({
      ileXaiTurn: true,
    });

    const same = syncIleDictatedTextOnWorkCanvas(second.scene, live.text, second.elementId, {
      persistEmpty: true,
    });
    expect(same.changed).toBe(false);
    expect(same.elementId).toBe(first.elementId);

    const closed = syncIleDictatedTextOnWorkCanvas(opened.scene, "", opened.elementId);
    expect(closed.elementId).toBeNull();
    expect(closed.scene.elements.some((el) => el.customData?.author === ILE_CANVAS_DICTATE_AUTHOR)).toBe(
      false,
    );
  });

  it("records the finished transcript as canvas dictate proof, not draw_text", () => {
    const placed = syncIleDictatedTextOnWorkCanvas(
      { elements: [], appState: {}, files: {} },
      "hello world",
      null,
    );
    const collector = new IleWorkCanvasPowCollector();
    collector.syncWithoutEmit(placed.scene);
    expect(collector.observeScene(placed.scene)).toEqual([]);

    const event = buildIleWorkCanvasDictatePowEvent({
      text: "hello world",
      elementId: placed.elementId,
    });
    expect(event?.toolAction).toBe(ILE_WORK_CANVAS_DICTATE_ACTION);
    expect(event?.toolAction).not.toBe("draw_text");
    expect(event?.metadata.prompt).toBe("hello world");
    expect(event?.metadata.element_ids).toEqual([placed.elementId]);
    expect(collector.dictate({ text: "  ", elementId: placed.elementId })).toEqual([]);
    const finished = collector.dictate({ text: "hello world", elementId: placed.elementId });
    expect(finished).toEqual([event]);
    const item = buildIleWorkCanvasActionUploadItem("session-1", finished[0]!, 40);
    expect(item?.toolAction).toBe("dictate");
    expect(JSON.parse(item!.payload).prompt).toBe("hello world");
    expect(buildIleWorkCanvasDictatePowEvent({ text: "   " })).toBeNull();
  });
});

describe("canvas dictate text element", () => {
  it("adds a Dictate Work note beside existing marks and leaves blank appends off the board", () => {
    const empty = appendIleDictatedTextToWorkCanvas({ elements: [], appState: {}, files: {} }, "  ");
    expect(empty.appended).toEqual([]);

    const obstacle = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 220, height: 80 },
    ])[0]!;
    const placed = appendIleDictatedTextToWorkCanvas(
      { elements: [obstacle], appState: {}, files: {} },
      "Dictated on the canvas",
    );
    const text = placed.appended.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "text");
    const body = placed.appended.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body");
    expect(text?.type).toBe("text");
    expect(text?.originalText).toBe("Dictated on the canvas");
    expect(text?.customData).toMatchObject({ author: ILE_CANVAS_DICTATE_AUTHOR });
    expect(text?.customData).not.toMatchObject({ ileXaiTurn: true });
    expect(String(dictateLabel(placed.scene)?.originalText || dictateLabel(placed.scene)?.text || "")).toBe(
      "Dictate",
    );
    expect(placed.scene.elements.length).toBeGreaterThan(2);
    const textRect = ileWorkCanvasElementRect(body ?? text!);
    const obstacleRect = ileWorkCanvasElementRect(obstacle);
    expect(ileWorkCanvasRectsOverlap(textRect, obstacleRect)).toBe(false);
  });

  it("opens the Dictate note at the center of the current canvas view", () => {
    const appState = {
      width: 800,
      height: 600,
      zoom: { value: 1 },
      scrollX: 120,
      scrollY: -40,
      offsetLeft: 0,
      offsetTop: 0,
    };
    const placed = appendIleDictatedTextToWorkCanvas(
      { elements: [], appState, files: {} },
      "hello",
    );
    const header = placed.appended.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "header");
    const body = placed.appended.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body");
    expect(header).toBeTruthy();
    expect(body).toBeTruthy();
    const centerX = header!.x + header!.width / 2;
    const centerY = (header!.y + body!.y + body!.height) / 2;
    const viewCenter = ileWorkCanvasViewportCenter(appState)!;
    expect(Math.abs(centerX - viewCenter.x)).toBeLessThan(1);
    expect(Math.abs(centerY - viewCenter.y)).toBeLessThan(1);
  });
});

describe("canvas dictate button", () => {
  it("sits on the board tools row and reads the live transcript", () => {
    expect(ILE_CANVAS_DICTATE_LABEL).toBe("dictate");
    expect(ILE_CANVAS_DICTATE_STOP_LABEL).toBe("stop");
    expect(ILE_CANVAS_DICTATE_RUN_LABEL).toBe("Do/run");
    const idle = renderToStaticMarkup(
      createElement(IleCanvasDictateButton, {
        transcript: "",
        onLiveText: () => {},
        onCommit: () => {},
      }),
    );
    expect(idle).toContain("data-ile-canvas-dictate");
    expect(idle).toContain('aria-pressed="false"');
    expect(idle).toContain(">dictate<");
    expect(idle).not.toContain(">stop<");
    expect(idle).not.toContain("stop & ask");
    expect(idle).not.toContain("data-ile-canvas-dictate-stop-ask");
    const dictate = read("components/session-view/learn-canvas-dictate-button.tsx");
    expect(dictate).toContain("data-ile-canvas-dictate-stop");
    expect(dictate).toContain("data-ile-canvas-dictate-run");
    expect(dictate).toContain("finishAndRun");
    expect(dictate).toContain("onRun");
    expect(dictate).not.toContain("ileWorkCanvasCommandIndex");
    expect(dictate).not.toContain("CommandPlate");
    expect(dictate).toContain('CommandMark id="draw"');
    expect(dictate).not.toContain("data-ile-canvas-dictate-answer");
    expect(dictate).not.toContain("onAnswer");
    expect(dictate).not.toContain("data-ile-canvas-dictate-stop-ask");
    expect(dictate).not.toContain("ILE_CANVAS_DICTATE_STOP_ASK_LABEL");
    expect(dictate).not.toContain("onAsk");
    expect(read("components/excalidraw-canvas/canvas-prompt-bar.tsx")).not.toContain(
      "onAsk=",
    );
    expect(read("components/excalidraw-canvas/canvas-prompt-bar.tsx")).toContain("onRun=");
    expect(read("components/excalidraw-canvas/canvas-prompt-bar.tsx")).toContain(
      'handleQuickAction("draw", selected)',
    );
    expect(read("components/session-view/session-guide-panel.tsx")).not.toContain(
      "onAsk=",
    );
    expect(read("components/session-view/session-guide-panel.tsx")).toContain("onRun=");

    const canvas = read("components/ExcalidrawCanvas.tsx");
    const promptAt = canvas.indexOf("data-ile-canvas-prompt-bar");
    const gate = canvas.indexOf("ileCanvasSlashBarOpen({", promptAt);
    const input = canvas.indexOf("data-ile-canvas-prompt-bar-input");
    const gateClose = canvas.indexOf(") : null}", input);
    const rowStart = canvas.indexOf("<IleCanvasDictateButton");
    const rowEnd = canvas.indexOf("<IleCanvasPointerButton");
    expect(gate).toBeGreaterThan(canvas.indexOf("data-ile-canvas-prompt-bar"));
    expect(input).toBeGreaterThan(gate);
    expect(gateClose).toBeGreaterThan(input);
    expect(gateClose).toBeLessThan(rowStart);
    const commandRow = canvas.slice(gate, gateClose);
    expect(commandRow).not.toContain("data-ile-canvas-ask");
    expect(commandRow).toContain("data-ile-canvas-prompt-bar-send");
    expect(commandRow).not.toContain('"Ask"');
    expect(commandRow).toMatch(/>\s*Run\s*</);
    expect(rowStart).toBeGreaterThan(gateClose);
    expect(rowEnd).toBeGreaterThan(rowStart);
    const row = canvas.slice(rowStart, rowEnd);
    expect(row).not.toContain("data-ile-canvas-prompt-bar-input");
    expect(row).not.toContain("IleCraftInsightButton");
    expect(canvas).not.toContain("IleCanvasCraftInsightForm");
    expect(canvas).toContain("syncIleDictatedTextOnWorkCanvas");
    expect(canvas).toContain("writeDictatedText(text, false)");
    expect(canvas).toContain("writeDictatedText(text, true)");
    expect(canvas).toContain("persistEmpty: !emitPow");
    expect(dictate).toContain('onLiveText("")');
    expect(dictate).toContain("onCommit(text)");
    expect(dictate).not.toContain("if (text) onCommit");
    expect(canvas).toContain("dictateTranscript !== undefined && !viewModeEnabled");
    expect(canvas).toContain(".dictate(");
    expect(canvas).toContain("transcript={dictateTranscript}");
    expect(read("components/session-view/session-chapter-canvas.tsx")).toContain(
      "dictateTranscript={sessionThoughtInterface.crystallizableText",
    );
    expect(read("components/session-view/session-chapter-canvas.tsx")).toContain(
      "getLiveTranscript={sessionThoughtInterface.getFormingText}",
    );
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain(
      "dictateTranscript={crystallizableText}",
    );
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain(
      "getLiveTranscript={getLiveTranscript}",
    );
  });

  it("hides ask, run, and the command field until something is selected", () => {
    const html = renderToStaticMarkup(
      createElement(ExcalidrawCanvas, {
        onAskSelected: async () => ({ text: "" }),
        dictateTranscript: "",
      }),
    );
    expect(html).not.toContain("data-ile-craft-insight");
    expect(html).toContain("data-ile-canvas-dictate");
    expect(html).toContain("data-ile-learn-more-actions");
    for (const label of ["Simplify", "Subdivide", "Concepts", "Do/run", "Refactor"]) {
      expect(html).toContain(`>${label}<`);
    }
    for (const label of ["Focus", "Next", "Check/ask", "Declutter", "Rephrase", "Join", "Elaborate", "Compress", "Clear overlaps"]) {
      expect(html).not.toContain(`>${label}<`);
    }
    expect(html).toContain('data-ile-command-mark="simplify"');
    expect(html).toContain('data-ile-command-mark="draw"');
    expect(html).toContain('data-ile-command-mark="breakdown"');
    expect(html).toContain('data-ile-command-mark="concepts"');
    expect(html).not.toContain('data-ile-command-mark="answer"');
    expect(html).not.toContain('data-ile-command-mark="define"');
    expect(html).toContain('role="switch"');
    expect(html).toContain("data-session-auto-layout-track");
    expect(html).toContain('data-ile-command-index="01"');
    expect(html).toContain('data-ile-command-index="05"');
    expect(html).not.toContain('data-ile-command-index="06"');
    expect(read("components/excalidraw-canvas/command-plate.tsx")).toContain("min-h-9");
    for (const file of [
      "components/session-view/session-chapter-canvas.tsx",
      "components/tap-score/tap-score-phases.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("<WorkCanvas");
      expect(source).not.toContain("ILE_WORK_CANVAS_COMMANDS");
    }
    expect(html).toContain("min-w-0 items-center justify-center");
    expect(html).toContain("flex-col");
    expect(html).toContain("border-l border-t");
    expect(html).toContain(">Do/run<");
    expect(html).not.toContain(">Answer<");
    expect(html).not.toContain(">Define<");
    expect(html).not.toContain(">Suggest Insight<");
    expect(html).toContain('data-ile-learn-more-quick="draw"');
    expect(html).not.toContain('data-ile-learn-more-quick="answer"');
    expect(html).not.toContain('data-ile-learn-more-quick="ask"');
    expect(html).not.toContain('data-ile-learn-more-quick="suggest-insight"');
    expect(html).not.toContain(">commit (insight)<");
    expect(html).toContain(">dictate<");
    expect(promptBar("learn")).not.toContain("data-ile-command-dock");
    expect(promptBar("learn")).not.toContain("data-ile-learn-more-actions");
    expect(promptBar("learn")).not.toContain("data-ile-craft-insight");
    expect(promptBar("learn")).not.toContain(">commit (insight)<");
    expect(promptBar("learn")).not.toContain("data-ile-canvas-dictate");
    expect(promptBar("learn")).not.toContain(">hide commands<");
    expect(promptBar("calibrate")).not.toContain("data-ile-command-dock");
    expect(promptBar("calibrate")).not.toContain("data-ile-craft-insight");
    expect(promptBar("calibrate")).not.toContain("data-ile-canvas-commands-toggle");
    expect(promptBar("verification")).not.toContain("data-ile-command-dock");
    expect(promptBar("verification")).not.toContain("data-ile-craft-insight");
    expect(promptBar("verification")).not.toContain("data-ile-canvas-commands-toggle");
    expect(html).not.toContain("data-ile-canvas-prompt-bar-input");
    expect(html).not.toContain("data-ile-canvas-ask");
    expect(html).not.toContain("data-ile-canvas-prompt-bar-send");
    expect(html).not.toContain(">Run<");
    expect(ileCanvasSlashBarOpen({ selectionActive: false, slashIntent: true })).toBe(false);
    expect(ileCanvasSlashKeyOpensBar({ key: "/", selectionActive: false })).toBe(false);
    expect(html).toContain("px-4 py-2.5 text-sm");
    const dictateBtn = read("components/session-view/learn-canvas-dictate-button.tsx");
    expect(dictateBtn).toContain("px-4 py-2.5 text-sm");
    expect(dictateBtn).toContain("min-w-0 flex-1");
    const prompt = read("components/ExcalidrawCanvas.tsx");
    const actionRow = prompt.slice(
      prompt.indexOf("data-ile-learn-more-actions"),
      prompt.indexOf("<IleCanvasPointerButton"),
    );
    expect(actionRow).toContain("flex w-full items-stretch gap-1");
    expect(actionRow).toContain("grid w-full grid-cols-1 gap-1");
    expect(prompt).toContain("aspect-square");
    expect(actionRow).not.toContain("data-ile-canvas-commands-toggle");
    expect(actionRow).not.toContain("hide commands");
    expect(actionRow).not.toContain("commandsOpen");
    expect(prompt).not.toContain("commandCatalogShown");
    const sharedRow = prompt.slice(
      prompt.indexOf("flex w-full items-stretch gap-1"),
      prompt.indexOf("<IleCanvasPointerButton"),
    );
    expect(sharedRow).not.toContain("<IleCraftInsightButton");
    expect(sharedRow).toContain("<IleCanvasDictateButton");
    expect(html).not.toContain("data-ile-canvas-commands-toggle");
    expect(html).not.toContain(">hide commands<");
    expect(html).not.toContain(">show commands<");
    expect(html).toContain('data-ile-command-dock="bottom-left"');
    expect(html).toContain('data-ile-command-dock-anchor="bottom-left"');
    expect(html).toContain('data-ile-command-dock-anchor="left"');
    expect(html).toContain('data-ile-command-dock-anchor="right"');
    expect(html).toContain("data-ile-command-dock-grip");
    expect(html).not.toContain("left-1/2");
    expect(dictateBtn).not.toContain("px-2.5 py-2 text-xs");
    expect(read("components/session-view/learn-work-dock-bar.tsx")).not.toContain(
      "data-session-topic-card-description",
    );
    expect(read("components/PracticeVoiceChallenge.tsx")).not.toContain(
      "data-ile-sample-insight-card",
    );
  });

  it("refuses slash without a selection", () => {
    expect(ileCanvasSlashBarOpen({ selectionActive: false, slashIntent: false })).toBe(false);
    expect(ileCanvasSlashBarOpen({ selectionActive: false, slashIntent: true })).toBe(false);
    expect(ileCanvasSlashKeyOpensBar({ key: "/", selectionActive: false })).toBe(false);
    expect(ileCanvasSlashKeyOpensBar({ key: "/", selectionActive: true })).toBe(true);
    expect(
      ileCanvasSlashKeyOpensBar({
        key: "/",
        selectionActive: true,
        typingInField: true,
      }),
    ).toBe(false);
    expect(ileCanvasSlashBarOpen({ selectionActive: true, slashIntent: true })).toBe(true);
    expect(ileCanvasSlashBarOpen({ selectionActive: true, slashIntent: false })).toBe(false);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).not.toContain("ileCanvasCraftInsightOpenAfterSelection");
    expect(canvas).toContain("ileCanvasSlashKeyOpensBar");
    expect(canvas).not.toContain("if (active) setCraftInsightOpen(false)");
    expect(canvas).not.toContain("setCraftInsightOpen");

    const html = renderToStaticMarkup(
      createElement(ExcalidrawCanvas, {
        onAskSelected: async () => ({ text: "" }),
        dictateTranscript: "",
      }),
    );
    expect(html).not.toContain("data-ile-canvas-prompt-bar-input");
    expect(html).not.toContain("data-ile-craft-insight");

    const scratch =
      process.env.GROK_GOAL_SCRATCH ||
      "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-94f79d5a71b0/implementer";
    mkdirSync(scratch, { recursive: true });
    writeFileSync(
      join(scratch, "craft-and-slash.log"),
      [
        `slash_without_selection=${ileCanvasSlashKeyOpensBar({ key: "/", selectionActive: false })}`,
        `bar_without_selection=${ileCanvasSlashBarOpen({ selectionActive: false, slashIntent: true })}`,
        `slash_with_selection=${ileCanvasSlashKeyOpensBar({ key: "/", selectionActive: true })}`,
        `bar_with_slash=${ileCanvasSlashBarOpen({ selectionActive: true, slashIntent: true })}`,
        `rendered_input=${html.includes("data-ile-canvas-prompt-bar-input")}`,
        `rendered_craft=${html.includes("data-ile-craft-insight")}`,
      ].join("\n") + "\n",
    );
  });
});
