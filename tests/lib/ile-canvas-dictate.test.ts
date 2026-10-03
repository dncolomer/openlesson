import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IleCanvasDictateButton } from "@/components/session-view/ile-canvas-dictate-button";
import {
  ILE_CANVAS_DICTATE_AUTHOR,
  ILE_CANVAS_DICTATE_LABEL,
  ILE_CANVAS_DICTATE_STOP_LABEL,
  appendIleDictatedTextToWorkCanvas,
  ileDictateCaptureText,
  noteIleDictateTranscript,
  startIleDictateCapture,
} from "@/lib/ile-canvas-dictate";
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
      createElement(IleCanvasDictateButton, { transcript: "", onCommit: () => {} }),
    );
    expect(idle).toContain("data-ile-canvas-dictate");
    expect(idle).toContain('aria-pressed="false"');
    expect(idle).toContain(">dictate<");
    expect(idle).not.toContain(">stop<");

    const canvas = read("components/ExcalidrawCanvas.tsx");
    const rowStart = canvas.indexOf("<IleCraftInsightButton");
    const rowEnd = canvas.indexOf("<IleCanvasCraftInsightForm");
    const row = canvas.slice(rowStart, rowEnd);
    expect(row).toContain("<IleCanvasDictateButton");
    expect(row.indexOf("<IleCanvasDictateButton")).toBeGreaterThan(0);
    expect(canvas).toContain("appendIleDictatedTextToWorkCanvas");
    expect(canvas).toContain("transcript={dictateTranscript}");
    expect(read("components/SessionView.tsx")).toContain(
      "dictateTranscript={sessionThoughtInterface.crystallizableText}",
    );
  });
});
