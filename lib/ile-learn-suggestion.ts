/**
 * Learn shows the contextual next-step sentence under the command dock.
 * The note stays until dismiss or add. Add to canvas places that sentence
 * as its own text mark.
 */
import type { IleCommandDockMode } from "@/lib/ile-command-dock";
import {
  convertToExcalidrawElements,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  serializeIleWorkCanvasScene,
  settleIleWorkCanvasIncoming,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import { policySuggestionIsRawLabel } from "@/lib/session-policy-infer";

export const LEARN_SUGGESTION_AUTHOR = "suggestion";
export const LEARN_SUGGESTION_ADD_LABEL = "add to canvas";
export const LEARN_SUGGESTION_DISMISS_LABEL = "dismiss";

const SUGGESTION_FONT_SIZE = 20;

export type LearnSuggestionToastPlacement = "under" | "beside-right" | "beside-left" | "notification";

/**
 * The sentence to show. Learn only. A raw action name, a blank line,
 * and a sentence the learner already dismissed stay hidden.
 */
export function learnSuggestionToastText(input: {
  mode: string | null | undefined;
  suggestion: string | null | undefined;
  dismissed?: string | null;
}): string | null {
  if (input.mode !== "learn") return null;
  const text = String(input.suggestion ?? "").replace(/\s+/g, " ").trim();
  if (!text || policySuggestionIsRawLabel(text)) return null;
  const dismissed = String(input.dismissed ?? "").replace(/\s+/g, " ").trim();
  if (dismissed && dismissed === text) return null;
  return text;
}

/** Dismiss hides the note. Add hides it and places the same sentence. */
export function learnSuggestionToastAction(
  kind: "add" | "dismiss",
  text: string,
): { dismiss: string; place: string | null } {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (kind === "dismiss") return { dismiss: clean, place: null };
  return { dismiss: clean, place: clean };
}

/** Full-height rails have no room under the strip, so the note sits beside the bottom. */
export function learnSuggestionToastPlacement(mode: IleCommandDockMode): LearnSuggestionToastPlacement {
  if (mode === "left") return "beside-right";
  if (mode === "right") return "beside-left";
  return "under";
}

export function learnSuggestionToastClass(placement: LearnSuggestionToastPlacement): string {
  if (placement === "beside-right") {
    return "pointer-events-auto absolute bottom-2 left-full z-30 ml-1 w-64";
  }
  if (placement === "beside-left") {
    return "pointer-events-auto absolute bottom-2 right-full z-30 mr-1 w-64";
  }
  if (placement === "notification") {
    return "pointer-events-auto relative z-30 w-full";
  }
  return "pointer-events-auto relative z-30 mt-1 w-full";
}

function suggestionTextBox(text: string): { width: number; height: number } {
  const probe = wrapIleWorkCanvasText(text, ILE_WORK_CANVAS_TEXT_BOX_WIDTH, SUGGESTION_FONT_SIZE);
  const charW = Math.max(6, SUGGESTION_FONT_SIZE * 0.55);
  const longest = probe.text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  const width = Math.min(
    ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
    Math.max(96, Math.ceil(longest * charW)),
  );
  const fitted = wrapIleWorkCanvasText(text, width, SUGGESTION_FONT_SIZE);
  return { width, height: fitted.height };
}

/** One learner text mark, clear of whatever is already on the board. */
export function appendLearnSuggestionText(
  scene: IleWorkCanvasScene | null | undefined,
  text: string,
): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean || policySuggestionIsRawLabel(clean)) return { scene: current, appended: [] };
  const box = suggestionTextBox(clean);
  const obstacles = current.elements.filter((el) => !el.isDeleted);
  const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
    elements: current.elements,
    near: obstacles,
    box,
  });
  const created = convertToExcalidrawElements([
    {
      type: "text",
      text: clean,
      x: origin.x,
      y: origin.y,
      width: box.width,
      fontSize: SUGGESTION_FONT_SIZE,
      autoResize: false,
      customData: { author: LEARN_SUGGESTION_AUTHOR },
    },
  ]);
  if (!created.length) return { scene: current, appended: [] };
  const appended = settleIleWorkCanvasIncoming(created, obstacles);
  return {
    scene: {
      elements: [...current.elements, ...appended],
      appState: current.appState,
      files: current.files,
    },
    appended,
  };
}
