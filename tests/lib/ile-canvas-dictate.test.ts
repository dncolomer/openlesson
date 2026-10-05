import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";

vi.mock("@excalidraw/excalidraw/index.css", () => ({}));
vi.mock("@/app/ile-excalidraw-theme.css", () => ({}));
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
import {
  ILE_CANVAS_DICTATE_AUTHOR,
  ILE_CANVAS_DICTATE_LABEL,
  ILE_CANVAS_DICTATE_STOP_LABEL,
  advanceIleDictateCapture,
  appendIleDictatedTextToWorkCanvas,
  ileDictateCaptureText,
  noteIleDictateTranscript,
  startIleDictateCapture,
  syncIleDictatedTextOnWorkCanvas,
} from "@/lib/ile-canvas-dictate";
import {
  ILE_WORK_CANVAS_DICTATE_ACTION,
  IleWorkCanvasPowCollector,
  buildIleWorkCanvasActionUploadItem,
  buildIleWorkCanvasDictatePowEvent,
} from "@/lib/ile-work-canvas-pow";
import {
  convertToExcalidrawElements,
  ileWorkCanvasElementRect,
  ileWorkCanvasRectsOverlap,
} from "@/lib/ile-work-canvas";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
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

describe("canvas dictate live text", () => {
  it("keeps one element and replaces its text as the transcript grows", () => {
    let capture = startIleDictateCapture("already said");
    let live = advanceIleDictateCapture(capture, "already said hello");
    capture = live.capture;
    expect(live.text).toBe("hello");

    const first = syncIleDictatedTextOnWorkCanvas(
      { elements: [], appState: {}, files: {} },
      live.text,
      null,
    );
    expect(first.changed).toBe(true);
    expect(first.elementId).toBeTruthy();
    expect(first.scene.elements).toHaveLength(1);
    expect(first.scene.elements[0]?.originalText).toBe("hello");
    expect(first.scene.elements[0]?.customData).toMatchObject({ author: ILE_CANVAS_DICTATE_AUTHOR });

    live = advanceIleDictateCapture(capture, "already said hello world");
    const second = syncIleDictatedTextOnWorkCanvas(first.scene, live.text, first.elementId);
    expect(second.elementId).toBe(first.elementId);
    expect(second.scene.elements).toHaveLength(1);
    expect(second.scene.elements[0]?.originalText).toBe("hello world");
    expect(second.scene.elements[0]?.customData).not.toMatchObject({ ileXaiTurn: true });

    const same = syncIleDictatedTextOnWorkCanvas(second.scene, live.text, second.elementId);
    expect(same.changed).toBe(false);
    expect(same.elementId).toBe(first.elementId);
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
  it("adds one learner text element and leaves an empty note off the board", () => {
    const empty = appendIleDictatedTextToWorkCanvas({ elements: [], appState: {}, files: {} }, "  ");
    expect(empty.appended).toEqual([]);

    const obstacle = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 220, height: 80 },
    ])[0]!;
    const placed = appendIleDictatedTextToWorkCanvas(
      { elements: [obstacle], appState: {}, files: {} },
      "Dictated on the canvas",
    );
    expect(placed.appended).toHaveLength(1);
    const text = placed.appended[0]!;
    expect(text.type).toBe("text");
    expect(text.originalText).toBe("Dictated on the canvas");
    expect(text.customData).toMatchObject({ author: ILE_CANVAS_DICTATE_AUTHOR });
    expect(text.customData).not.toMatchObject({ ileXaiTurn: true });
    expect(placed.scene.elements).toHaveLength(2);
    const textRect = ileWorkCanvasElementRect(text);
    const obstacleRect = ileWorkCanvasElementRect(obstacle);
    expect(ileWorkCanvasRectsOverlap(textRect, obstacleRect)).toBe(false);
  });
});

describe("canvas dictate button", () => {
  it("sits next to craft insight and reads the live transcript", () => {
    expect(ILE_CANVAS_DICTATE_LABEL).toBe("dictate");
    expect(ILE_CANVAS_DICTATE_STOP_LABEL).toBe("stop");
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

    const canvas = read("components/ExcalidrawCanvas.tsx");
    const gate = canvas.indexOf("{canvasSelectionActive ? (");
    const input = canvas.indexOf("data-ile-canvas-prompt-bar-input");
    const gateClose = canvas.indexOf(") : null}", input);
    const rowStart = canvas.indexOf("<IleCraftInsightButton");
    const rowEnd = canvas.indexOf("<IleCanvasCraftInsightForm");
    expect(gate).toBeGreaterThan(canvas.indexOf("data-ile-canvas-prompt-bar"));
    expect(input).toBeGreaterThan(gate);
    expect(gateClose).toBeGreaterThan(input);
    expect(gateClose).toBeLessThan(rowStart);
    const commandRow = canvas.slice(gate, gateClose);
    expect(commandRow).toContain("data-ile-canvas-ask");
    expect(commandRow).toContain("data-ile-canvas-prompt-bar-send");
    expect(commandRow).toContain('"Ask"');
    expect(commandRow).toMatch(/>\s*Run\s*</);
    const row = canvas.slice(rowStart, rowEnd);
    expect(row).not.toContain("data-ile-canvas-prompt-bar-input");
    expect(row).toContain("<IleCanvasDictateButton");
    expect(row.indexOf("<IleCanvasDictateButton")).toBeGreaterThan(0);
    expect(canvas).toContain("syncIleDictatedTextOnWorkCanvas");
    expect(canvas).toContain("writeDictatedText(text, false)");
    expect(canvas).toContain("writeDictatedText(text, true)");
    expect(canvas).toContain("dictateTranscript !== undefined && !viewModeEnabled");
    expect(canvas).toContain(".dictate(");
    expect(canvas).toContain("transcript={dictateTranscript}");
    expect(read("components/SessionView.tsx")).toContain(
      "dictateTranscript={sessionThoughtInterface.crystallizableText}",
    );
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain(
      "dictateTranscript={crystallizableText}",
    );
  });

  it("hides ask, run, and the command field until something is selected", () => {
    const html = renderToStaticMarkup(
      createElement(ExcalidrawCanvas, {
        onAskSelected: async () => ({ text: "" }),
        dictateTranscript: "",
        craftInsight: { chapterId: "chapter-1", sessionId: "session-1" },
      }),
    );
    expect(html).toContain("data-ile-craft-insight");
    expect(html).toContain("data-ile-canvas-dictate");
    expect(html).toContain(">craft insight<");
    expect(html).toContain(">dictate<");
    expect(html).not.toContain("data-ile-canvas-prompt-bar-input");
    expect(html).not.toContain("data-ile-canvas-ask");
    expect(html).not.toContain("data-ile-canvas-prompt-bar-send");
    expect(html).not.toContain(">Run<");
  });
});
