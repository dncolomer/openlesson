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

/**
 * Keys shared with the calibrate canvas. Kept as literals so this module
 * does not import the phase model.
 */
const CALIBRATE_ROLE = "calibrateRole";
const CALIBRATE_REGION = "calibrateRegion";
const CALIBRATE_QUESTION = "calibrateQuestionId";
const CALIBRATE_SOURCE = "calibrateResponseSource";

function elementData(el: IleWorkCanvasElement): Record<string, unknown> {
  return el.customData ?? {};
}

function elementCenter(el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">) {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

function elementContains(
  el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
  point: { x: number; y: number },
) {
  return (
    point.x >= el.x &&
    point.x <= el.x + el.width &&
    point.y >= el.y &&
    point.y <= el.y + el.height
  );
}

/**
 * On a calibrate board, dictate has to land on one question in the active
 * region. The generic empty-space placement sits outside both regions, so
 * the answer and uncertainty gates never see it.
 * Comfortable questions are the answer step. After one of those has a
 * response, the next dictate is the uncertainty on a not-confident question.
 */
function calibrateDictateTarget(elements: readonly IleWorkCanvasElement[]): {
  questionId: string;
  x: number;
  y: number;
  width: number;
} | null {
  const alive = elements.filter((el) => !el.isDeleted);
  const regions = alive.filter((el) => {
    if (el.type !== "rectangle" || elementData(el)[CALIBRATE_ROLE] !== "region") return false;
    const region = elementData(el)[CALIBRATE_REGION];
    return region === "comfortable" || region === "unconfident";
  });
  const cards = alive.filter((el) => {
    if (el.type !== "rectangle" || elementData(el)[CALIBRATE_ROLE] !== "question") return false;
    return String(elementData(el)[CALIBRATE_QUESTION] || "").trim().length > 0;
  });
  if (!regions.length || !cards.length) return null;

  const regionName = (card: IleWorkCanvasElement): "comfortable" | "unconfident" | null => {
    const hit = regions.find((region) => elementContains(region, elementCenter(card)));
    const name = hit ? elementData(hit)[CALIBRATE_REGION] : null;
    return name === "comfortable" || name === "unconfident" ? name : null;
  };
  const cardId = (card: IleWorkCanvasElement) => String(elementData(card)[CALIBRATE_QUESTION]).trim();

  const answered = new Set<string>();
  for (const el of alive) {
    if (el.type !== "text") continue;
    const role = elementData(el)[CALIBRATE_ROLE];
    if (
      role === "question-label" ||
      role === "region-label" ||
      role === "question" ||
      role === "region" ||
      role === "instruction" ||
      role === "cue" ||
      role === "cue-label"
    ) {
      continue;
    }
    const text = String(el.originalText || el.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const explicit = String(elementData(el)[CALIBRATE_QUESTION] || "").trim();
    if (explicit) {
      answered.add(explicit);
      continue;
    }
    const hit = cards.find((card) => elementContains(card, elementCenter(el)));
    if (hit) answered.add(cardId(hit));
  }

  const inRegion = (name: "comfortable" | "unconfident") =>
    cards
      .filter((card) => regionName(card) === name && !answered.has(cardId(card)))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  const comfortableAnswered = cards.some(
    (card) => regionName(card) === "comfortable" && answered.has(cardId(card)),
  );
  const target = (!comfortableAnswered ? inRegion("comfortable") : inRegion("unconfident"))[0];
  if (!target) return null;
  const width = Math.max(80, Math.min(240, target.width - 24));
  return {
    questionId: cardId(target),
    x: target.x + 12,
    y: target.y + target.height + 12,
    width,
  };
}

function boardBoxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  pad = 4,
): boolean {
  return (
    a.x - pad < b.x + b.width &&
    a.x + a.width + pad > b.x &&
    a.y - pad < b.y + b.height &&
    a.y + a.height + pad > b.y
  );
}

function boardBox(el: IleWorkCanvasElement): { x: number; y: number; width: number; height: number } {
  return {
    x: el.x,
    y: el.y,
    width: Math.max(1, el.width || 0),
    height: Math.max(1, el.height || 0),
  };
}

/**
 * Responses sit under their cards. A long answer pushes the next card, and
 * the region frame grows so the words stay inside it and off the next title.
 */
export function clearCalibrateResponseOverlap(
  elements: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  const next = elements.map((el) => ({ ...el }));
  const roleOf = (el: IleWorkCanvasElement) => String(el.customData?.[CALIBRATE_ROLE] || "");
  const questionOf = (el: IleWorkCanvasElement) => String(el.customData?.[CALIBRATE_QUESTION] || "");
  const shiftQuestion = (id: string, dy: number) => {
    if (!id || dy <= 0) return;
    for (const el of next) {
      if (questionOf(el) === id) el.y += dy;
    }
  };
  const shiftRegionDown = (regionName: string, dy: number) => {
    if (!regionName || dy <= 0) return;
    const region = next.find(
      (el) => roleOf(el) === "region" && String(el.customData?.[CALIBRATE_REGION] || "") === regionName,
    );
    if (!region) return;
    const cutoff = region.y - 80;
    for (const el of next) {
      if (el.y + (el.height || 0) < cutoff && el.id !== region.id) continue;
      const cx = el.x + (el.width || 0) / 2;
      const inColumn = cx >= region.x - 8 && cx <= region.x + (region.width || 0) + 8;
      const named = String(el.customData?.[CALIBRATE_REGION] || "") === regionName;
      if ((named || inColumn) && (el.y >= cutoff - 4 || el.id === region.id)) el.y += dy;
    }
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    const responses = next.filter((el) => !el.isDeleted && el.type === "text" && roleOf(el) === "response");
    for (const response of responses) {
      const box = boardBox(response);
      const pushed = new Set<string>();
      for (const other of next) {
        if (other.id === response.id || other.isDeleted) continue;
        const otherRole = roleOf(other);
        if (otherRole === "region" || otherRole === "instruction") continue;
        if (questionOf(other) && questionOf(other) === questionOf(response)) continue;
        if (!boardBoxesOverlap(box, boardBox(other))) continue;
        const id = questionOf(other);
        if (id && other.y >= response.y - 1) {
          if (pushed.has(id)) continue;
          const dy = response.y + box.height + 12 - other.y;
          if (dy > 0) {
            shiftQuestion(id, dy);
            pushed.add(id);
            moved = true;
          }
          continue;
        }
        if (otherRole === "region-label" && other.y >= response.y - 1) {
          const dy = response.y + box.height + 16 - other.y;
          const regionName = String(other.customData?.[CALIBRATE_REGION] || "");
          if (dy > 0 && regionName && !pushed.has(`region:${regionName}`)) {
            shiftRegionDown(regionName, dy);
            pushed.add(`region:${regionName}`);
            moved = true;
          }
        }
      }
    }

    const questionCards = next
      .filter((el) => !el.isDeleted && el.type === "rectangle" && roleOf(el) === "question")
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < questionCards.length; i += 1) {
      const upper = questionCards[i]!;
      const upperBox = boardBox(upper);
      const response = next.find(
        (el) => roleOf(el) === "response" && questionOf(el) === questionOf(upper) && !el.isDeleted,
      );
      const floor = Math.max(
        upper.y + upperBox.height + 28,
        response ? response.y + (response.height || 0) + 12 : 0,
      );
      for (let j = i + 1; j < questionCards.length; j += 1) {
        const lower = questionCards[j]!;
        const lowerBox = boardBox(lower);
        const xOverlap =
          upperBox.x < lowerBox.x + lowerBox.width && upperBox.x + upperBox.width > lowerBox.x;
        if (!xOverlap || lower.y >= floor) continue;
        shiftQuestion(questionOf(lower), floor - lower.y);
        moved = true;
      }
    }

    const regions = next
      .filter((el) => !el.isDeleted && el.type === "rectangle" && roleOf(el) === "region")
      .sort((a, b) => a.y - b.y);
    for (const region of regions) {
      let bottom = region.y + 24;
      for (const el of next) {
        if (el.isDeleted || el.id === region.id) continue;
        const elRole = roleOf(el);
        if (elRole === "region" || elRole === "region-label" || elRole === "instruction") continue;
        const cx = el.x + (el.width || 0) / 2;
        const cy = el.y + (el.height || 0) / 2;
        if (cx < region.x || cx > region.x + (region.width || 0)) continue;
        if (cy < region.y) continue;
        bottom = Math.max(bottom, el.y + (el.height || 0) + 20);
      }
      const height = bottom - region.y;
      if (height > (region.height || 0) + 0.5) {
        region.height = height;
        moved = true;
      }
    }
    for (let index = 0; index < regions.length - 1; index += 1) {
      const upper = regions[index]!;
      const lower = regions[index + 1]!;
      const lowerName = String(lower.customData?.[CALIBRATE_REGION] || "");
      const label = next.find(
        (el) => roleOf(el) === "region-label" && String(el.customData?.[CALIBRATE_REGION] || "") === lowerName,
      );
      const top = label ? Math.min(label.y, lower.y) : lower.y;
      const dy = upper.y + (upper.height || 0) + 24 - top;
      if (dy > 0) {
        shiftRegionDown(lowerName, dy);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

/** Place dictated speech as a learner text box beside existing marks. */
export function appendIleDictatedTextToWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  text: string,
): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = normalizeDictateText(text);
  if (!clean) return { scene: current, appended: [] };
  const target = calibrateDictateTarget(current.elements);
  const wrapped = wrapIleWorkCanvasText(clean, target?.width);
  const origin = target
    ? { x: target.x, y: target.y }
    : ileWorkCanvasEmptyNearbyOriginWithReserved({
        elements: current.elements,
        near: current.elements.filter((el) => !el.isDeleted),
        box: { width: wrapped.width, height: wrapped.height },
      });
  const customData: Record<string, unknown> = { author: ILE_CANVAS_DICTATE_AUTHOR };
  if (target) {
    customData[CALIBRATE_ROLE] = "response";
    customData[CALIBRATE_QUESTION] = target.questionId;
    customData[CALIBRATE_SOURCE] = "dictated";
  }
  const appended = convertToExcalidrawElements([
    {
      type: "text",
      text: clean,
      x: origin.x,
      y: origin.y,
      width: wrapped.width,
      autoResize: false,
      customData,
    },
  ]);
  if (!appended.length) return { scene: current, appended: [] };
  return {
    scene: {
      elements: clearCalibrateResponseOverlap([...current.elements, ...appended]),
      appState: current.appState,
      files: current.files,
    },
    appended,
  };
}
