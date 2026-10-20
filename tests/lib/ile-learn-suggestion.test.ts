import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasPromptBar } from "@/components/excalidraw-canvas/canvas-prompt-bar";
import { LearnSuggestionToast } from "@/components/session-view/learn-suggestion-toast";
import {
  LEARN_SUGGESTION_ADD_LABEL,
  LEARN_SUGGESTION_AUTHOR,
  LEARN_SUGGESTION_DISMISS_LABEL,
  appendLearnSuggestionText,
  learnSuggestionToastAction,
  learnSuggestionToastClass,
  learnSuggestionToastPlacement,
  learnSuggestionToastText,
} from "@/lib/ile-learn-suggestion";
import {
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  convertToExcalidrawElements,
  ileWorkCanvasElementRect,
  ileWorkCanvasRectsOverlap,
} from "@/lib/ile-work-canvas";
import type { SessionMarkMode } from "@/lib/session-marks";

const ROOT = join(__dirname, "../..");
const SENTENCE = "Write one example.";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

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
      setCraftInsightOpen: () => {},
      writeDictatedText: () => {},
      craftInsightOpen: false,
      selectedCanvasElements: () => [],
      selectedMarkTexts: [],
      markSpeech: "",
      sessionMarkMode: mode,
      dictateTranscript: "",
      craftInsight: { chapterId: "chapter-1", sessionId: "session-1", onCrafted: () => {} },
    }),
  );
}

describe("learn suggestion toast", () => {
  it("places the sentence only on add, and dismiss hides it", () => {
    expect(learnSuggestionToastAction("dismiss", `  ${SENTENCE}  `)).toEqual({
      dismiss: SENTENCE,
      place: null,
    });
    expect(learnSuggestionToastAction("add", SENTENCE)).toEqual({
      dismiss: SENTENCE,
      place: SENTENCE,
    });
  });

  it("shows a new Learn sentence and hides a dismissed or raw one", () => {
    expect(learnSuggestionToastText({ mode: "learn", suggestion: `  ${SENTENCE}  ` })).toBe(SENTENCE);
    expect(learnSuggestionToastText({ mode: "learn", suggestion: "Write   one example." })).toBe(SENTENCE);
    expect(learnSuggestionToastText({ mode: "calibrate", suggestion: SENTENCE })).toBeNull();
    expect(learnSuggestionToastText({ mode: "verification", suggestion: SENTENCE })).toBeNull();
    expect(learnSuggestionToastText({ mode: null, suggestion: SENTENCE })).toBeNull();
    expect(learnSuggestionToastText({ mode: "learn", suggestion: "Insight" })).toBeNull();
    expect(learnSuggestionToastText({ mode: "learn", suggestion: "close." })).toBeNull();
    expect(learnSuggestionToastText({ mode: "learn", suggestion: "   " })).toBeNull();
    expect(
      learnSuggestionToastText({ mode: "learn", suggestion: SENTENCE, dismissed: SENTENCE }),
    ).toBeNull();
    expect(
      learnSuggestionToastText({
        mode: "learn",
        suggestion: "Name a second example.",
        dismissed: SENTENCE,
      }),
    ).toBe("Name a second example.");
  });

  it("sits under the corner box and beside a full-height rail", () => {
    expect(learnSuggestionToastPlacement("bottom-left")).toBe("under");
    expect(learnSuggestionToastPlacement("free")).toBe("under");
    expect(learnSuggestionToastPlacement("left")).toBe("beside-right");
    expect(learnSuggestionToastPlacement("right")).toBe("beside-left");
    expect(learnSuggestionToastClass("under")).toContain("mt-1");
    expect(learnSuggestionToastClass("notification")).toContain("w-full");
    expect(learnSuggestionToastClass("notification")).not.toContain("mt-1");
    expect(learnSuggestionToastClass("under")).not.toContain("left-full");
    expect(learnSuggestionToastClass("beside-right")).toContain("left-full");
    expect(learnSuggestionToastClass("beside-left")).toContain("right-full");
  });

  it("renders the sentence, dismiss, and add, with no auto-hide timer", () => {
    const html = renderToStaticMarkup(
      createElement(LearnSuggestionToast, {
        text: SENTENCE,
        placement: "under",
        onAdd: () => {},
        onDone: () => {},
      }),
    );
    expect(html).toContain("data-ile-learn-suggestion");
    expect(html).toContain("data-ile-learn-suggestion-add");
    expect(html).toContain("data-ile-learn-suggestion-dismiss");
    expect(html).toContain(`>${LEARN_SUGGESTION_ADD_LABEL}<`);
    expect(html).toContain(`>${LEARN_SUGGESTION_DISMISS_LABEL}<`);
    expect(LEARN_SUGGESTION_ADD_LABEL).toBe("add to canvas");
    expect(LEARN_SUGGESTION_DISMISS_LABEL).toBe("dismiss");
    expect(html).toContain(SENTENCE);
    expect(html).not.toContain("data-ile-learn-suggestion-bar");
    expect(html).not.toContain("ile-learn-suggestion-drain");
    expect(html).toContain("mt-1");
    expect(html).not.toMatch(/\b(Close|Keep|Discard|Insight)\b/);

    const beside = renderToStaticMarkup(
      createElement(LearnSuggestionToast, {
        text: SENTENCE,
        placement: "beside-right",
        onAdd: () => {},
        onDone: () => {},
      }),
    );
    expect(beside).toContain('data-ile-learn-suggestion-placement="beside-right"');
    expect(beside).toContain("left-full");

    const toast = read("components/session-view/learn-suggestion-toast.tsx");
    expect(toast).not.toContain("setTimeout");
    expect(toast).not.toContain("LEARN_SUGGESTION_TOAST_MS");
    expect(toast).toContain('learnSuggestionToastAction("dismiss"');
    const addAt = toast.indexOf('learnSuggestionToastAction("add"');
    const click = toast.slice(addAt, addAt + 220);
    expect(addAt).toBeGreaterThan(toast.indexOf("data-ile-learn-suggestion-add"));
    expect(click.indexOf("onDoneRef")).toBeLessThan(click.indexOf("onAddRef"));
  });

  it("places one clear text mark and leaves a raw label off the board", () => {
    const empty = appendLearnSuggestionText({ elements: [], appState: {}, files: {} }, "  ");
    expect(empty.appended).toEqual([]);
    const raw = appendLearnSuggestionText({ elements: [], appState: {}, files: {} }, "Insight");
    expect(raw.appended).toEqual([]);

    const obstacle = convertToExcalidrawElements([
      { type: "rectangle", x: 0, y: 0, width: 220, height: 80 },
    ])[0]!;
    const placed = appendLearnSuggestionText(
      { elements: [obstacle], appState: {}, files: {} },
      SENTENCE,
    );
    expect(placed.appended).toHaveLength(1);
    const text = placed.appended[0]!;
    expect(text.type).toBe("text");
    expect(text.originalText).toBe(SENTENCE);
    expect(text.customData).toMatchObject({ author: LEARN_SUGGESTION_AUTHOR });
    expect(text.customData).not.toMatchObject({ ileXaiTurn: true });
    expect(text.width).toBeGreaterThanOrEqual(96);
    expect(text.width).toBeLessThan(ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
    expect(placed.scene.elements).toHaveLength(2);
    expect(placed.scene.elements[0]).toMatchObject({ id: obstacle.id, x: obstacle.x, y: obstacle.y });
    expect(
      ileWorkCanvasRectsOverlap(ileWorkCanvasElementRect(text), ileWorkCanvasElementRect(obstacle)),
    ).toBe(false);
  });

  it("mounts the note only for a Learn suggestion, under the command card", () => {
    expect(promptBar("learn")).not.toContain("data-ile-learn-suggestion=");
    expect(promptBar("learn")).not.toContain("data-ile-command-dock");
    expect(promptBar("learn")).not.toContain(">Simplify<");
    expect(promptBar("calibrate")).not.toContain("data-ile-learn-suggestion");
    expect(promptBar("calibrate")).not.toContain("data-ile-command-dock");
    expect(promptBar("verification")).not.toContain("data-ile-learn-suggestion");
    expect(promptBar("verification")).not.toContain("data-ile-command-dock");

    const prompt = read("components/excalidraw-canvas/canvas-prompt-bar.tsx");
    expect(prompt).toContain("useSessionPolicySuggestion");
    expect(prompt).toContain("learnSuggestionToastText");
    expect(prompt).toContain("ileCanvasCommandDockVisible");
    expect(prompt).toContain("data-ile-canvas-side-note");
    expect(prompt).toContain("key={learnSuggestion}");
    expect(prompt).toContain("[data-ile-learn-suggestion]");
    expect(prompt).toContain('placement={commandDockVisible ? "under" : "notification"}');
    expect(prompt).toContain("right-3 top-3");
    const dockAt = prompt.indexOf("data-ile-learn-more-actions");
    const noteAt = prompt.indexOf("data-ile-canvas-side-note");
    expect(noteAt).toBeGreaterThan(dockAt);

    const canvas = read("components/ExcalidrawCanvas.tsx");
    const place = canvas.slice(canvas.indexOf("const placeSuggestionText"), canvas.indexOf("const submitCommand"));
    expect(place).toContain("appendLearnSuggestionText");
    expect(place).toContain("selectedElementIds: {}");
    expect(place).toContain("syncWithoutEmit");
    expect(place).not.toContain(".dictate(");
    expect(place).not.toContain(".command(");
    expect(place).not.toContain("suggest-insight");
    expect(canvas).toContain("placeSuggestionText={placeSuggestionText}");
  });
});
