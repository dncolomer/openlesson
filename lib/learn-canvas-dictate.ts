/**
 * Prompt-bar Dictate: the click opens a Dictate Work note immediately.
 * Speech that arrives after the click fills that same note. Stop keeps a
 * note that has speech and records it as canvas proof of work.
 */
import {
  BOARD_INSTRUCTION_NOTE_HEADER_HEIGHT,
  BOARD_INSTRUCTION_NOTE_KEY,
  boardInstructionNoteElements,
  convertToExcalidrawElements,
  ileWorkCanvasEmptyNearbyOriginWithReserved,
  ileWorkCanvasNoteLabel,
  ileWorkCanvasOriginCenteredOn,
  ileWorkCanvasViewportCenter,
  ILE_WORK_CANVAS_TEXT_BOX_WIDTH,
  serializeIleWorkCanvasScene,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";

export const ILE_CANVAS_DICTATE_LABEL = "dictate";
export const ILE_CANVAS_DICTATE_STOP_LABEL = "stop";
export const ILE_CANVAS_DICTATE_ANSWER_LABEL = "Answer";
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

function dictatedNoteMemberIds(
  elements: readonly IleWorkCanvasElement[],
  text: IleWorkCanvasElement,
): Set<string> {
  const ids = new Set<string>([text.id]);
  if (typeof text.containerId === "string" && text.containerId) ids.add(text.containerId);
  const groupId = Array.isArray(text.groupIds) ? String(text.groupIds[0] || "") : "";
  if (groupId) {
    for (const el of elements) {
      if (el.isDeleted) continue;
      if (Array.isArray(el.groupIds) && el.groupIds.includes(groupId)) ids.add(el.id);
    }
  }
  return ids;
}

function bumpDictatedElement(
  el: IleWorkCanvasElement,
  patch: Partial<IleWorkCanvasElement>,
): IleWorkCanvasElement {
  return {
    ...el,
    ...patch,
    version: (Number(el.version) || 1) + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    updated: Date.now(),
  };
}

function updateDictatedPlainText(
  existing: IleWorkCanvasElement,
  clean: string,
): IleWorkCanvasElement {
  const wrapped = wrapIleWorkCanvasText(clean, Number(existing.width) || ILE_WORK_CANVAS_TEXT_BOX_WIDTH);
  return bumpDictatedElement(existing, {
    text: wrapped.text,
    originalText: clean,
    width: wrapped.width,
    height: wrapped.height,
    autoResize: false,
    customData: { ...(existing.customData ?? {}), author: ILE_CANVAS_DICTATE_AUTHOR },
  });
}

function updateDictatedNote(
  elements: readonly IleWorkCanvasElement[],
  textEl: IleWorkCanvasElement,
  clean: string,
): { elements: IleWorkCanvasElement[]; changed: boolean } | null {
  const groupId = Array.isArray(textEl.groupIds) ? String(textEl.groupIds[0] || "") : "";
  if (!groupId || textEl.customData?.[BOARD_INSTRUCTION_NOTE_KEY] !== "text") return null;
  const members = elements.filter(
    (el) => !el.isDeleted && Array.isArray(el.groupIds) && el.groupIds.includes(groupId),
  );
  const body = members.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "body");
  const header = members.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "header");
  const label = members.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "label");
  if (!body || !header) return null;
  const sameText =
    normalizeDictateText(String(textEl.originalText || textEl.text || "")) === clean;
  const padX = Math.max(8, (Number(textEl.x) || 0) - (Number(body.x) || 0) || 14);
  const padY = Math.max(4, (Number(textEl.y) || 0) - (Number(body.y) || 0) || 12);
  const innerWidth = Math.max(
    96,
    (Number(body.width) || ILE_WORK_CANVAS_TEXT_BOX_WIDTH) - padX * 2,
  );
  const wrapped = wrapIleWorkCanvasText(
    clean || " ",
    innerWidth,
    Number(textEl.fontSize) || undefined,
  );
  const width = innerWidth + padX * 2;
  const bodyHeight = padY + wrapped.height + padY;
  const headerH = Number(header.height) || BOARD_INSTRUCTION_NOTE_HEADER_HEIGHT;
  const x = Number(header.x) || Number(body.x) || 0;
  const y = Number(header.y) || 0;
  const bodyY = y + headerH;
  if (
    sameText &&
    body.width === width &&
    body.height === bodyHeight &&
    body.y === bodyY &&
    textEl.height === wrapped.height
  ) {
    return { elements: [...elements], changed: false };
  }
  const byId = new Map(elements.map((el) => [el.id, el]));
  byId.set(
    body.id,
    bumpDictatedElement(body, {
      x,
      y: bodyY,
      width,
      height: bodyHeight,
      customData: { ...(body.customData ?? {}), author: ILE_CANVAS_DICTATE_AUTHOR },
    }),
  );
  byId.set(
    header.id,
    bumpDictatedElement(header, {
      x,
      y,
      width,
      customData: { ...(header.customData ?? {}), author: ILE_CANVAS_DICTATE_AUTHOR },
    }),
  );
  byId.set(
    textEl.id,
    bumpDictatedElement(textEl, {
      x: x + padX,
      y: bodyY + padY,
      width: innerWidth,
      height: wrapped.height,
      text: clean ? wrapped.text : "",
      originalText: clean,
      autoResize: false,
      customData: { ...(textEl.customData ?? {}), author: ILE_CANVAS_DICTATE_AUTHOR },
    }),
  );
  if (label) {
    byId.set(
      label.id,
      bumpDictatedElement(label, {
        x: x + padX,
        y: y + 8,
        width: innerWidth,
        customData: { ...(label.customData ?? {}), author: ILE_CANVAS_DICTATE_AUTHOR },
      }),
    );
  }
  return { elements: elements.map((el) => byId.get(el.id) ?? el), changed: true };
}

/**
 * Create or update the live dictate mark. The same note grows with the
 * transcript. `persistEmpty` keeps an empty Dictate card while recording.
 * Without it, an empty transcript removes the mark this dictate started.
 */
export function syncIleDictatedTextOnWorkCanvas(
  scene: IleWorkCanvasScene | null | undefined,
  text: string,
  elementId: string | null | undefined,
  opts?: { persistEmpty?: boolean },
): { scene: IleWorkCanvasScene; elementId: string | null; changed: boolean } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = normalizeDictateText(text);
  const existing = dictatedTextElement(current.elements, elementId);
  const persistEmpty = opts?.persistEmpty === true;
  if (!clean && !persistEmpty) {
    if (!existing) return { scene: current, elementId: null, changed: false };
    const remove = dictatedNoteMemberIds(current.elements, existing);
    return {
      scene: {
        elements: current.elements.filter((el) => !remove.has(el.id)),
        appState: current.appState,
        files: current.files,
      },
      elementId: null,
      changed: true,
    };
  }
  if (existing) {
    const note = updateDictatedNote(current.elements, existing, clean);
    if (note) {
      if (!note.changed) return { scene: current, elementId: existing.id, changed: false };
      return {
        scene: { ...current, elements: note.elements },
        elementId: existing.id,
        changed: true,
      };
    }
    const wrapped = wrapIleWorkCanvasText(clean);
    const sameText =
      normalizeDictateText(String(existing.originalText || existing.text || "")) === clean;
    if (sameText && existing.width === wrapped.width && existing.height === wrapped.height) {
      return { scene: current, elementId: existing.id, changed: false };
    }
    const nextElement = updateDictatedPlainText(existing, clean);
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
  const placed = appendIleDictatedTextToWorkCanvas(current, clean, { allowEmpty: persistEmpty });
  const created =
    placed.appended.find((el) => el.customData?.[BOARD_INSTRUCTION_NOTE_KEY] === "text") ??
    placed.appended.find((el) => el.type === "text") ??
    null;
  if (!created) return { scene: current, elementId: null, changed: false };
  return { scene: placed.scene, elementId: created.id, changed: true };
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
      role === "well-label" ||
      role === "question" ||
      role === "region" ||
      role === "well" ||
      role === "instruction" ||
      role === "instruction-label" ||
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
  const name = regionName(target);
  const well = alive.find((el) => {
    if (el.type !== "rectangle" || elementData(el)[CALIBRATE_ROLE] !== "well") return false;
    return elementData(el)[CALIBRATE_REGION] === name;
  });
  const label = alive.find((el) => {
    if (el.type !== "text" || elementData(el)[CALIBRATE_ROLE] !== "well-label") return false;
    return elementData(el)[CALIBRATE_REGION] === name;
  });
  if (well) {
    const prior = alive.filter((el) => {
      if (el.type !== "text" || elementData(el)[CALIBRATE_ROLE] !== "response") return false;
      return elementContains(well, elementCenter(el));
    });
    let y = label ? label.y + label.height + 6 : well.y + 28;
    for (const earlier of prior) y = Math.max(y, earlier.y + (earlier.height || 0) + 6);
    return {
      questionId: cardId(target),
      x: well.x + 8,
      y,
      width: Math.max(80, well.width - 16),
    };
  }
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
        if (
          other.locked ||
          otherRole === "region" ||
          otherRole === "instruction" ||
          otherRole === "instruction-label" ||
          otherRole === "region-label" ||
          otherRole === "well" ||
          otherRole === "well-label"
        ) {
          continue;
        }
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
        const upperCenter = {
          x: upper.x + upperBox.width / 2,
          y: upper.y + upperBox.height / 2,
        };
        const lowerCenter = {
          x: lower.x + lowerBox.width / 2,
          y: lower.y + lowerBox.height / 2,
        };
        const sharedLockedRegion = next.some((el) => {
          if (el.isDeleted || !el.locked || roleOf(el) !== "region") return false;
          return (
            upperCenter.x >= el.x &&
            upperCenter.x <= el.x + (el.width || 0) &&
            upperCenter.y >= el.y &&
            upperCenter.y <= el.y + (el.height || 0) &&
            lowerCenter.x >= el.x &&
            lowerCenter.x <= el.x + (el.width || 0) &&
            lowerCenter.y >= el.y &&
            lowerCenter.y <= el.y + (el.height || 0)
          );
        });
        if (sharedLockedRegion) continue;
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
        if (
          el.locked ||
          elRole === "region" ||
          elRole === "region-label" ||
          elRole === "instruction" ||
          elRole === "instruction-label" ||
          elRole === "well" ||
          elRole === "well-label"
        ) {
          continue;
        }
        const cx = el.x + (el.width || 0) / 2;
        const cy = el.y + (el.height || 0) / 2;
        if (cx < region.x || cx > region.x + (region.width || 0)) continue;
        if (cy < region.y) continue;
        bottom = Math.max(bottom, el.y + (el.height || 0) + 20);
      }
      if (region.locked) continue;
      const height = bottom - region.y;
      if (height > (region.height || 0) + 0.5) {
        region.height = height;
        moved = true;
      }
    }
    for (let index = 0; index < regions.length - 1; index += 1) {
      const upper = regions[index]!;
      const lower = regions[index + 1]!;
      const sharesColumn =
        upper.x < lower.x + (lower.width || 0) && upper.x + (upper.width || 0) > lower.x;
      if (!sharesColumn || upper.locked || lower.locked) continue;
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
  opts?: { allowEmpty?: boolean },
): { scene: IleWorkCanvasScene; appended: IleWorkCanvasElement[] } {
  const current = serializeIleWorkCanvasScene(scene);
  const clean = normalizeDictateText(text);
  if (!clean && !opts?.allowEmpty) return { scene: current, appended: [] };
  const target = calibrateDictateTarget(current.elements);
  if (target) {
    if (!clean) return { scene: current, appended: [] };
    const fontSize = 15;
    const wrapped = wrapIleWorkCanvasText(clean, target.width, fontSize);
    const customData: Record<string, unknown> = {
      author: ILE_CANVAS_DICTATE_AUTHOR,
      [CALIBRATE_ROLE]: "response",
      [CALIBRATE_QUESTION]: target.questionId,
      [CALIBRATE_SOURCE]: "dictated",
    };
    const appended = convertToExcalidrawElements([
      {
        type: "text",
        text: clean,
        x: target.x,
        y: target.y,
        width: wrapped.width,
        fontSize,
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
  const textWidth = ILE_WORK_CANVAS_TEXT_BOX_WIDTH;
  const customData: Record<string, unknown> = { author: ILE_CANVAS_DICTATE_AUTHOR };
  const note = boardInstructionNoteElements({
    text: clean,
    x: 0,
    y: 0,
    textWidth,
    label: ileWorkCanvasNoteLabel("dictate"),
    allowEmpty: true,
    textCustomData: customData,
    bodyCustomData: customData,
  });
  if (!note.elements.length) return { scene: current, appended: [] };
  const viewCenter = ileWorkCanvasViewportCenter(current.appState);
  const origin = viewCenter
    ? ileWorkCanvasOriginCenteredOn(viewCenter, { width: note.width, height: note.height })
    : ileWorkCanvasEmptyNearbyOriginWithReserved({
        elements: current.elements,
        near: current.elements.filter((el) => !el.isDeleted),
        box: { width: note.width, height: note.height },
      });
  const dx = origin.x;
  const dy = origin.y;
  const appended = note.elements.map((el) => ({
    ...el,
    x: Number(el.x) + dx,
    y: Number(el.y) + dy,
  }));
  return {
    scene: {
      elements: [...current.elements, ...appended],
      appState: current.appState,
      files: current.files,
    },
    appended,
  };
}
