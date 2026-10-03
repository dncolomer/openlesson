/**
 * Prompt-bar Dictate: record the live speech bar after the click, then drop
 * that text on the work canvas as one editable text element.
 */
import {
  convertToExcalidrawElements,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  serializeIleWorkCanvasScene,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";

export const ILE_CANVAS_DICTATE_LABEL = "dictate";
export const ILE_CANVAS_DICTATE_STOP_LABEL = "stop";
export const ILE_CANVAS_DICTATE_AUTHOR = "dictate";

export type IleDictateCapture = {
  /** Speech already on the bar when this slice started. Kept out of the note. */
  anchor: string;
  /** Speech from earlier recognition slices during this dictate. */
  sealed: string;
  /** Latest speech-bar display for the current slice. */
  display: string;
};

function normalizeDictateText(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function joinDictate(left: string, right: string): string {
  const a = normalizeDictateText(left);
  const b = normalizeDictateText(right);
  if (!a) return b;
  if (!b) return a;
  if (a === b || a.endsWith(` ${b}`) || a.endsWith(b)) return a;
  if (b.startsWith(a)) return b;
  return `${a} ${b}`;
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

/** Interim corrections stay one slice. A recognition restart starts another. */
function sameSpeechSlice(previous: string, next: string, anchor: string): boolean {
  if (!previous || !next) return true;
  if (anchor && (next.startsWith(anchor) || anchor.startsWith(next))) return true;
  if (next.startsWith(previous) || previous.startsWith(next)) return true;
  const shared = commonPrefixLength(previous, next);
  const shorter = Math.min(previous.length, next.length);
  return shared >= 8 || (shorter > 0 && shared / shorter >= 0.5);
}

function sliceAfterAnchor(display: string, anchor: string): string {
  const live = normalizeDictateText(display);
  const base = normalizeDictateText(anchor);
  if (!live) return "";
  if (!base) return live;
  if (live.startsWith(base)) return normalizeDictateText(live.slice(base.length));
  if (base.startsWith(live)) return "";
  return live;
}

export function startIleDictateCapture(currentTranscript: string): IleDictateCapture {
  const anchor = normalizeDictateText(currentTranscript);
  return { anchor, sealed: "", display: anchor };
}

export function noteIleDictateTranscript(
  capture: IleDictateCapture,
  nextTranscript: string,
): IleDictateCapture {
  const next = normalizeDictateText(nextTranscript);
  if (sameSpeechSlice(capture.display, next, capture.anchor)) {
    if (!next) {
      return {
        anchor: "",
        sealed: joinDictate(capture.sealed, sliceAfterAnchor(capture.display, capture.anchor)),
        display: "",
      };
    }
    return { ...capture, display: next };
  }
  return {
    anchor: "",
    sealed: joinDictate(capture.sealed, sliceAfterAnchor(capture.display, capture.anchor)),
    display: next,
  };
}

export function ileDictateCaptureText(capture: IleDictateCapture): string {
  return joinDictate(capture.sealed, sliceAfterAnchor(capture.display, capture.anchor));
}

/** Place dictated speech as a learner text box beside existing marks. */
export function appendIleDictatedTextToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  text: string,
): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = normalizeDictateText(text);
  if (!clean) return { scene: current, appended: [] };
  const wrapped = wrapIleWorkCanvasText(clean);
  const origin = ileWorkCanvasEmptyNearbyOriginWithReserved({
    elements: current.elements,
    near: current.elements.filter((el) => !el.isDeleted),
    box: { width: wrapped.width, height: wrapped.height },
  });
  const appended = convertToExcalidrawElements([
    {
      type: "text",
      text: clean,
      x: origin.x,
      y: origin.y,
      width: wrapped.width,
      autoResize: false,
      customData: { author: ILE_CANVAS_DICTATE_AUTHOR },
    },
  ]);
  if (!appended.length) return { scene: current, appended: [] };
  return {
    scene: {
      elements: [...current.elements, ...appended],
      appState: current.appState,
      files: current.files,
    },
    appended,
  };
}
