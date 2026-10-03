/**
 * Prompt-bar Dictate: speech that arrives after the click is written onto
 * the work canvas as it is recognized, in one learner text element. Stop
 * keeps that element and records it as canvas proof of work.
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

/** Advance one recognition update and return the text that should be on the board. */
export function advanceIleDictateCapture(
  capture: IleDictateCapture,
  nextTranscript: string,
): { capture: IleDictateCapture; text: string } {
  const next = noteIleDictateTranscript(capture, nextTranscript);
  return { capture: next, text: ileDictateCaptureText(next) };
}

function dictatedTextElement(
  elements: readonly IleWorkCanvasElement[],
  elementId: string | null | undefined,
): IleWorkCanvasElement | null {
  if (!elementId) return null;
  return (
    elements.find(
      (el) => el.id === elementId && el.type === "text" && !el.isDeleted,
    ) ?? null
  );
}

/**
 * Create or update the live dictate mark. The same element id grows with the
 * transcript. An empty transcript removes a mark this dictate had started.
 */
export function syncIleDictatedTextOnWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  text: string,
  elementId: string | null | undefined,
): { scene: IleWorkCanvasScene; elementId: string | null; changed: boolean } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = normalizeDictateText(text);
  const existing = dictatedTextElement(current.elements, elementId);
  if (!clean) {
    if (!existing) return { scene: current, elementId: null, changed: false };
    return {
      scene: {
        elements: current.elements.filter((el) => el.id !== existing.id),
        appState: current.appState,
        files: current.files,
      },
      elementId: null,
      changed: true,
    };
  }
  const wrapped = wrapIleWorkCanvasText(clean);
  if (existing) {
    const sameText = normalizeDictateText(String(existing.originalText || existing.text || "")) === clean;
    if (sameText && existing.width === wrapped.width && existing.height === wrapped.height) {
      return { scene: current, elementId: existing.id, changed: false };
    }
    const nextElement: IleWorkCanvasElement = {
      ...existing,
      text: wrapped.text,
      originalText: clean,
      width: wrapped.width,
      height: wrapped.height,
      autoResize: false,
      version: (Number(existing.version) || 1) + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
      customData: { ...(existing.customData ?? {}), author: ILE_CANVAS_DICTATE_AUTHOR },
    };
    return {
      scene: {
        elements: current.elements.map((el) => (el.id === existing.id ? nextElement : el)),
        appState: current.appState,
        files: current.files,
      },
      elementId: existing.id,
      changed: true,
    };
  }
  const placed = appendIleDictatedTextToWorkCanvas(current, clean);
  const createdId = placed.appended[0]?.id ?? null;
  if (!createdId) return { scene: current, elementId: null, changed: false };
  return { scene: placed.scene, elementId: createdId, changed: true };
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
