/**
 * Calibrate work-canvas geometry: locked plates, question cards, and
 * response text. The phase machine lives in calibrate-session.
 */

import { clearCalibrateResponseOverlap, ILE_CANVAS_DICTATE_AUTHOR } from "@/lib/learn-canvas-dictate";
import {
  boardInstructionNoteElements,
  convertToExcalidrawElements,
  emptyIleWorkCanvasScene,
  ileWorkCanvasMarkRect,
  ileWorkCanvasRectsOverlap,
  ILE_WORK_CANVAS_STROKE_COLOR,
  serializeIleWorkCanvasScene,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasRect,
  type IleWorkCanvasScene,
} from "@/lib/learn-work-canvas";
import {
  CALIBRATE_ANSWER_WELL_LABEL,
  CALIBRATE_COMFORTABLE_LABEL,
  CALIBRATE_EXPLAIN_WELL_LABEL,
  CALIBRATE_HOME_X_KEY,
  CALIBRATE_HOME_Y_KEY,
  CALIBRATE_OPENING_INSTRUCTION,
  CALIBRATE_QUESTION_FILL,
  CALIBRATE_QUESTION_KEY,
  CALIBRATE_REGION_HEIGHT,
  CALIBRATE_REGION_KEY,
  CALIBRATE_REGION_WIDTH,
  CALIBRATE_ROLE_KEY,
  CALIBRATE_SOURCE_KEY,
  CALIBRATE_UNCONFIDENT_LABEL,
  CALIBRATE_WELL_FILL,
  calibrateCanvasTextCounts,
  normalizeCalibrateQuestions,
  type CalibrateCanvasText,
  type CalibrateQuestion,
  type CalibrateRegion,
  type CalibrateResponseSource,
  type CalibrateState,
} from "@/lib/calibrate-session-phase";

const CARD_WIDTH = 232;
const CARD_PAD_X = 10;
const CARD_PAD_Y = 8;
const CARD_FONT = 15;
const CARD_GAP = 8;
const CARD_LINE_HEIGHT = 1.25;
/** Last-resort pile when a fourth card would leave the area. */
const STACK_STEP = 22;
const REGION_WIDTH = CALIBRATE_REGION_WIDTH;
const REGION_HEIGHT = CALIBRATE_REGION_HEIGHT;
const REGION_GAP = 12;
const COLUMN_GAP = 16;
const BOARD_X = 32;
const BOARD_Y = 24;
const INSTRUCTION_GAP = 12;
const INSTRUCTION_FONT = 16;
const WELL_HEIGHT = 112;
const QUESTION_TEXT_KEY = "calibrateQuestionText";
const HOME_W_KEY = "calibrateHomeW";
const HOME_LINES_KEY = "calibrateHomeLines";

const LOCKED_CHROME_ROLES = new Set([
  "instruction",
  "instruction-label",
  "region",
  "region-label",
  "well",
  "well-label",
]);

function trimText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function elementText(el: IleWorkCanvasElement): string {
  return trimText(el.originalText || el.text);
}

function roleOf(el: IleWorkCanvasElement): string {
  return trimText(el.customData?.[CALIBRATE_ROLE_KEY]);
}

function questionIdOf(el: IleWorkCanvasElement): string {
  return trimText(el.customData?.[CALIBRATE_QUESTION_KEY]);
}

function regionOf(el: IleWorkCanvasElement): CalibrateRegion | null {
  const region = el.customData?.[CALIBRATE_REGION_KEY];
  return region === "comfortable" || region === "unconfident" ? region : null;
}

function liveElements(scene: IleWorkCanvasScene | null | undefined): IleWorkCanvasElement[] {
  return (scene?.elements || []).filter((el) => !el.isDeleted);
}

function textBlockHeight(lines: number): number {
  return Math.max(CARD_FONT, Math.ceil(lines * CARD_FONT * CARD_LINE_HEIGHT));
}

function boardWidth(): number {
  return CARD_WIDTH + COLUMN_GAP + REGION_WIDTH + REGION_GAP + REGION_WIDTH;
}

/** Full questions while five cards still fit the viewport. A longer pool uses one line. */
function poolLayout(count: number): { maxLines: number; gap: number } {
  const column = (lines: number, gap: number) => {
    const height = textBlockHeight(lines) + CARD_PAD_Y * 2;
    return count * height + Math.max(0, count - 1) * gap;
  };
  if (count <= 5 && column(3, CARD_GAP) <= 420) return { maxLines: 3, gap: CARD_GAP };
  if (column(2, CARD_GAP) <= 360) return { maxLines: 2, gap: CARD_GAP };
  return { maxLines: 1, gap: 4 };
}

function laidOutQuestion(
  text: string,
  width: number,
  maxLines: number,
): { text: string; textHeight: number; cardHeight: number; inner: number } {
  const inner = Math.max(48, width - CARD_PAD_X * 2);
  const wrapped = wrapIleWorkCanvasText(text, inner, CARD_FONT);
  const lines = wrapped.text.split("\n");
  let shown = wrapped.text;
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1] || "";
    kept[maxLines - 1] = last.length <= 1 ? "…" : `${last.slice(0, -1)}…`;
    shown = kept.join("\n");
  }
  const measured = wrapIleWorkCanvasText(shown, inner, CARD_FONT);
  return {
    text: measured.text,
    textHeight: measured.height,
    cardHeight: measured.height + CARD_PAD_Y * 2,
    inner,
  };
}

function openingPlate(): { elements: IleWorkCanvasElement[]; height: number } {
  const width = boardWidth();
  const note = boardInstructionNoteElements({
    text: CALIBRATE_OPENING_INSTRUCTION,
    x: BOARD_X,
    y: BOARD_Y,
    textWidth: width - 28,
    fontSize: INSTRUCTION_FONT,
    locked: true,
    textCustomData: { [CALIBRATE_ROLE_KEY]: "instruction" },
    bodyCustomData: { [CALIBRATE_ROLE_KEY]: "instruction" },
    headerCustomData: { [CALIBRATE_ROLE_KEY]: "instruction-label" },
  });
  return { elements: note.elements, height: note.height };
}

function regionFrame(region: CalibrateRegion, x: number, y: number): IleWorkCanvasElement[] {
  const title = region === "comfortable" ? CALIBRATE_COMFORTABLE_LABEL : CALIBRATE_UNCONFIDENT_LABEL;
  const wellLabel = region === "comfortable" ? CALIBRATE_ANSWER_WELL_LABEL : CALIBRATE_EXPLAIN_WELL_LABEL;
  const titleWrap = wrapIleWorkCanvasText(title, REGION_WIDTH - 24, 16);
  const stackY = y + 8 + titleWrap.height + 6;
  const wellX = x + 8;
  const wellW = REGION_WIDTH - 16;
  const wellY = y + REGION_HEIGHT - 8 - WELL_HEIGHT;
  const stackX = x + 8;
  const stackW = wellW;
  const wellWrap = wrapIleWorkCanvasText(wellLabel, wellW - 16, 14);
  const regionCustom = {
    [CALIBRATE_ROLE_KEY]: "region",
    [CALIBRATE_REGION_KEY]: region,
    calibrateStackX: stackX,
    calibrateStackY: stackY,
    calibrateStackW: stackW,
    calibrateStackMaxY: wellY,
  };
  const wellCustom = {
    [CALIBRATE_ROLE_KEY]: "well",
    [CALIBRATE_REGION_KEY]: region,
  };
  return convertToExcalidrawElements([
    {
      type: "rectangle",
      x,
      y,
      width: REGION_WIDTH,
      height: REGION_HEIGHT,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      backgroundColor: "transparent",
      strokeWidth: 2,
      roughness: 0,
      locked: true,
      customData: regionCustom,
    },
    {
      type: "text",
      text: title,
      x: x + 12,
      y: y + 8,
      width: titleWrap.width,
      fontSize: 16,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      autoResize: false,
      locked: true,
      customData: {
        [CALIBRATE_ROLE_KEY]: "region-label",
        [CALIBRATE_REGION_KEY]: region,
      },
    },
    {
      type: "rectangle",
      x: wellX,
      y: wellY,
      width: wellW,
      height: WELL_HEIGHT,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      backgroundColor: CALIBRATE_WELL_FILL,
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "dashed",
      roughness: 0,
      locked: true,
      customData: wellCustom,
    },
    {
      type: "text",
      text: wellLabel,
      x: wellX + 8,
      y: wellY + 8,
      width: wellWrap.width,
      fontSize: 14,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      autoResize: false,
      locked: true,
      customData: {
        [CALIBRATE_ROLE_KEY]: "well-label",
        [CALIBRATE_REGION_KEY]: region,
      },
    },
  ]);
}

function questionCard(
  question: CalibrateQuestion,
  x: number,
  y: number,
  maxLines: number,
): IleWorkCanvasElement[] {
  const box = laidOutQuestion(question.text, CARD_WIDTH, maxLines);
  const custom = {
    [CALIBRATE_ROLE_KEY]: "question",
    [CALIBRATE_QUESTION_KEY]: question.id,
    [QUESTION_TEXT_KEY]: question.text,
    [CALIBRATE_HOME_X_KEY]: x,
    [CALIBRATE_HOME_Y_KEY]: y,
    [HOME_W_KEY]: CARD_WIDTH,
    [HOME_LINES_KEY]: maxLines,
  };
  const converted = convertToExcalidrawElements([
    {
      type: "rectangle",
      x,
      y,
      width: CARD_WIDTH,
      height: box.cardHeight,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      backgroundColor: CALIBRATE_QUESTION_FILL,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      customData: custom,
    },
    {
      type: "text",
      text: box.text,
      x: x + CARD_PAD_X,
      y: y + CARD_PAD_Y,
      width: box.inner,
      height: box.textHeight,
      fontSize: CARD_FONT,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      autoResize: false,
      customData: {
        ...custom,
        [CALIBRATE_ROLE_KEY]: "question-label",
      },
    },
  ]);
  const rect = converted.find((el) => el.type === "rectangle");
  const text = converted.find((el) => el.type === "text");
  if (rect && text) {
    text.containerId = rect.id;
    rect.boundElements = [{ type: "text", id: text.id }];
    text.originalText = question.text;
  }
  return converted;
}

function stampChromePins(elements: IleWorkCanvasElement[]): IleWorkCanvasElement[] {
  return elements.map((el) => {
    if (!LOCKED_CHROME_ROLES.has(roleOf(el))) return el;
    const data = { ...(el.customData ?? {}) };
    data.calibratePinX = el.x;
    data.calibratePinY = el.y;
    data.calibratePinW = el.width;
    data.calibratePinH = el.height;
    if (el.type === "text") data.calibratePinText = el.originalText || el.text || "";
    return { ...el, locked: true, customData: data };
  });
}

export function seedCalibrateWorkCanvas(
  raw: unknown,
): { scene: IleWorkCanvasScene; questions: CalibrateQuestion[] } {
  const questions = normalizeCalibrateQuestions(raw);
  const opening = openingPlate();
  const rowY = BOARD_Y + opening.height + INSTRUCTION_GAP;
  const comfortableX = BOARD_X + CARD_WIDTH + COLUMN_GAP;
  const unconfidentX = comfortableX + REGION_WIDTH + REGION_GAP;
  const elements: IleWorkCanvasElement[] = [
    ...opening.elements,
    ...regionFrame("comfortable", comfortableX, rowY),
    ...regionFrame("unconfident", unconfidentX, rowY),
  ];
  const layout = poolLayout(questions.length);
  let cardY = rowY;
  for (const question of questions) {
    const box = laidOutQuestion(question.text, CARD_WIDTH, layout.maxLines);
    elements.push(...questionCard(question, BOARD_X, cardY, layout.maxLines));
    cardY += box.cardHeight + layout.gap;
  }
  const empty = emptyIleWorkCanvasScene();
  return {
    questions,
    scene: serializeIleWorkCanvasScene({
      elements: stampChromePins(elements),
      appState: empty.appState,
      files: empty.files,
    }),
  };
}

/**
 * Locked plates stay where they were seeded. A learner can unlock or drag
 * them in the canvas UI; the next scene snapshot puts them back.
 */
export function restoreCalibrateChrome(
  elements: readonly IleWorkCanvasElement[],
): IleWorkCanvasElement[] {
  let changed = false;
  const next = elements.map((el) => {
    const data = el.customData;
    if (!data || !LOCKED_CHROME_ROLES.has(String(data[CALIBRATE_ROLE_KEY] || ""))) return el;
    const pinX = Number(data.calibratePinX);
    const pinY = Number(data.calibratePinY);
    const pinW = Number(data.calibratePinW);
    const pinH = Number(data.calibratePinH);
    const pinText = typeof data.calibratePinText === "string" ? data.calibratePinText : null;
    const hasBox = [pinX, pinY, pinW, pinH].every((n) => Number.isFinite(n));
    const boxDrift =
      hasBox &&
      (Math.abs(el.x - pinX) > 2 ||
        Math.abs(el.y - pinY) > 2 ||
        Math.abs((el.width || 0) - pinW) > 2 ||
        Math.abs((el.height || 0) - pinH) > 2);
    const textDrift =
      pinText != null && el.type === "text" && (el.originalText || el.text || "") !== pinText;
    const lockDrift = el.locked !== true || Boolean(el.isDeleted);
    if (!boxDrift && !textDrift && !lockDrift) return el;
    changed = true;
    const restored: IleWorkCanvasElement = {
      ...el,
      locked: true,
      isDeleted: false,
      version: (el.version || 1) + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
    };
    if (boxDrift) {
      restored.x = pinX;
      restored.y = pinY;
      restored.width = pinW;
      restored.height = pinH;
    }
    if (textDrift && pinText != null) {
      restored.text = pinText;
      restored.originalText = pinText;
    }
    return restored;
  });
  return changed ? next : (elements as IleWorkCanvasElement[]);
}

/** Question piles inside one area share pixels. That is the stack, not a clash. */
function sameQuestionStack(
  cardA: IleWorkCanvasElement,
  cardB: IleWorkCanvasElement,
  elements: readonly IleWorkCanvasElement[],
): boolean {
  return regionRectangles(elements).some(
    (region) => containsPoint(region, centerOf(cardA)) && containsPoint(region, centerOf(cardB)),
  );
}

function stackedQuestionLabels(
  a: IleWorkCanvasElement,
  b: IleWorkCanvasElement,
  elements: readonly IleWorkCanvasElement[],
): boolean {
  if (roleOf(a) !== "question-label" || roleOf(b) !== "question-label") return false;
  const cards = questionRectangles(elements);
  const cardA = cards.find((card) => questionIdOf(card) === questionIdOf(a));
  const cardB = cards.find((card) => questionIdOf(card) === questionIdOf(b));
  if (!cardA || !cardB) return false;
  return sameQuestionStack(cardA, cardB, elements);
}

/** True when readable text shares pixels with other text or with a card it is not inside. */
export function calibrateTextCollides(elements: readonly IleWorkCanvasElement[]): boolean {
  const live = elements.filter((el) => !el.isDeleted);
  const texts = live.filter((el) => el.type === "text");
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts[i]!;
    const textRect = ileWorkCanvasMarkRect(text);
    for (let j = i + 1; j < texts.length; j += 1) {
      const otherText = texts[j]!;
      const otherTextRect = ileWorkCanvasMarkRect(otherText);
      if (!textRect || !otherTextRect || !ileWorkCanvasRectsOverlap(textRect, otherTextRect, 2)) {
        continue;
      }
      if (stackedQuestionLabels(text, otherText, live)) continue;
      return true;
    }
    for (const other of live) {
      if (other.type !== "rectangle") continue;
      const role = roleOf(other);
      if (role === "region" || role === "instruction" || role === "instruction-label" || role === "well") continue;
      if (role === "question" && roleOf(text) === "question-label") {
        const own = questionRectangles(live).find((card) => questionIdOf(card) === questionIdOf(text));
        if (own && sameQuestionStack(own, other, live)) continue;
      }
      if (text.containerId === other.id) {
        const glyphs = ileWorkCanvasMarkRect(text);
        const card = ileWorkCanvasMarkRect(other);
        if (!glyphs || !card || !fullyInside(glyphs, card)) return true;
        continue;
      }
      const otherRect = ileWorkCanvasMarkRect(other);
      if (textRect && otherRect && ileWorkCanvasRectsOverlap(textRect, otherRect, 2)) return true;
    }
  }
  return false;
}

function fullyInside(inner: IleWorkCanvasRect, outer: IleWorkCanvasRect): boolean {
  return (
    inner.minX >= outer.minX - 1 &&
    inner.minY >= outer.minY - 1 &&
    inner.maxX <= outer.maxX + 1 &&
    inner.maxY <= outer.maxY + 1
  );
}

/** Locked plates may hold their own titles and the answer or explain well. */
function chromeInsideFrame(a: IleWorkCanvasElement, b: IleWorkCanvasElement): boolean {
  const roleA = roleOf(a);
  const roleB = roleOf(b);
  const frames = new Set(["region", "instruction", "well"]);
  const rectA = ileWorkCanvasMarkRect(a);
  const rectB = ileWorkCanvasMarkRect(b);
  if (!rectA || !rectB) return false;
  if (frames.has(roleA) && LOCKED_CHROME_ROLES.has(roleB) && fullyInside(rectB, rectA)) return true;
  if (frames.has(roleB) && LOCKED_CHROME_ROLES.has(roleA) && fullyInside(rectA, rectB)) return true;
  return false;
}

/** True when two board marks occupy the same pixels, other than a label inside its card. */
export function calibrateBoardHasOverlap(elements: readonly IleWorkCanvasElement[]): boolean {
  const live = elements.filter((el) => !el.isDeleted);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i]!;
      const b = live[j]!;
      if (a.containerId === b.id || b.containerId === a.id) continue;
      if (chromeInsideFrame(a, b)) continue;
      const rectA = ileWorkCanvasMarkRect(a);
      const rectB = ileWorkCanvasMarkRect(b);
      if (!rectA || !rectB || !ileWorkCanvasRectsOverlap(rectA, rectB, 4)) continue;
      return true;
    }
  }
  return false;
}

function centerOf(el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">): {
  x: number;
  y: number;
} {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

function containsPoint(
  el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= el.x &&
    point.x <= el.x + el.width &&
    point.y >= el.y &&
    point.y <= el.y + el.height
  );
}

function questionRectangles(elements: readonly IleWorkCanvasElement[]): IleWorkCanvasElement[] {
  return elements.filter((el) => el.type === "rectangle" && roleOf(el) === "question" && questionIdOf(el));
}

function regionRectangles(elements: readonly IleWorkCanvasElement[]): IleWorkCanvasElement[] {
  return elements.filter((el) => el.type === "rectangle" && roleOf(el) === "region" && regionOf(el));
}

export function readCalibratePlacements(
  scene: IleWorkCanvasScene | null | undefined,
): Record<string, CalibrateRegion | null> {
  const elements = liveElements(scene);
  const regions = regionRectangles(elements);
  const placements: Record<string, CalibrateRegion | null> = {};
  for (const card of questionRectangles(elements)) {
    const point = centerOf(card);
    const hit = regions.find((region) => containsPoint(region, point));
    placements[questionIdOf(card)] = hit ? regionOf(hit) : null;
  }
  return placements;
}

function responseSourceOf(el: IleWorkCanvasElement): CalibrateResponseSource {
  const marked = el.customData?.[CALIBRATE_SOURCE_KEY];
  if (marked === "typed" || marked === "pasted" || marked === "dictated") return marked;
  if (el.customData?.author === ILE_CANVAS_DICTATE_AUTHOR) return "dictated";
  return "typed";
}

function nearestQuestion(
  text: IleWorkCanvasElement,
  cards: readonly IleWorkCanvasElement[],
  state: CalibrateState | undefined,
  regions: readonly IleWorkCanvasElement[],
): string {
  const explicit = questionIdOf(text);
  if (explicit) return explicit;
  const textRect = ileWorkCanvasMarkRect(text);
  const hits = cards.filter((card) => {
    const cardRect = ileWorkCanvasMarkRect(card);
    return Boolean(textRect && cardRect && ileWorkCanvasRectsOverlap(textRect, cardRect, 28));
  });
  if (hits.length === 1) return questionIdOf(hits[0]!);
  if (hits.length > 1) {
    const point = centerOf(text);
    const ranked = hits
      .map((card) => {
        const cardPoint = centerOf(card);
        const dx = cardPoint.x - point.x;
        const dy = cardPoint.y - point.y;
        return { id: questionIdOf(card), distance: dx * dx + dy * dy };
      })
      .sort((a, b) => a.distance - b.distance);
    return ranked[0]?.id || "";
  }
  if (!state) return "";
  const point = centerOf(text);
  const region = regions.find((item) => containsPoint(item, point));
  const regionName = region ? regionOf(region) : null;
  if (!regionName) return "";
  const inRegion = cards.filter((card) => state.assignments[questionIdOf(card)] === regionName);
  if (!inRegion.length) return "";
  const ranked = inRegion
    .map((card) => {
      const cardPoint = centerOf(card);
      const dx = cardPoint.x - point.x;
      const dy = cardPoint.y - point.y;
      return { id: questionIdOf(card), distance: dx * dx + dy * dy };
    })
    .sort((a, b) => a.distance - b.distance);
  return ranked[0]?.id || "";
}

const IGNORED_TEXT_ROLES = new Set([
  "question-label",
  "region-label",
  "well-label",
  "prompt",
  "question",
  "region",
  "well",
  "instruction",
  "instruction-label",
  "cue",
  "cue-label",
]);

export function readCalibrateResponseTexts(
  scene: IleWorkCanvasScene | null | undefined,
  state?: CalibrateState,
): CalibrateCanvasText[] {
  const elements = liveElements(scene);
  const cards = questionRectangles(elements);
  const regions = regionRectangles(elements);
  const texts: CalibrateCanvasText[] = [];
  for (const el of elements) {
    if (el.type !== "text") continue;
    if (IGNORED_TEXT_ROLES.has(roleOf(el))) continue;
    const text = elementText(el);
    if (!text) continue;
    const questionId = nearestQuestion(el, cards, state, regions);
    if (!questionId) continue;
    texts.push({ questionId, text, source: responseSourceOf(el) });
  }
  return texts;
}

function shiftBy(el: IleWorkCanvasElement, dx: number, dy: number): IleWorkCanvasElement {
  return { ...el, x: el.x + dx, y: el.y + dy };
}

export function moveCalibrateQuestionOnCanvas(
  scene: IleWorkCanvasScene,
  questionId: string,
  region: CalibrateRegion | "pool",
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const elements = current.elements.map((el) => ({ ...el }));
  const card = questionRectangles(elements).find((el) => questionIdOf(el) === questionId);
  if (!card) return current;
  const label = elements.find(
    (el) => el.type === "text" && roleOf(el) === "question-label" && questionIdOf(el) === questionId,
  );
  const sourceText =
    String(card.customData?.[QUESTION_TEXT_KEY] || label?.originalText || label?.text || "").trim();
  let targetX = Number(card.customData?.[CALIBRATE_HOME_X_KEY]);
  let targetY = Number(card.customData?.[CALIBRATE_HOME_Y_KEY]);
  let targetW = Number(card.customData?.[HOME_W_KEY]);
  let maxLines = Number(card.customData?.[HOME_LINES_KEY]);
  if (!Number.isFinite(targetW) || targetW <= 0) targetW = CARD_WIDTH;
  if (!Number.isFinite(maxLines) || maxLines <= 0) maxLines = 2;
  if (region !== "pool") {
    const frame = regionRectangles(elements).find((el) => regionOf(el) === region);
    if (!frame) return current;
    const stackX = Number(frame.customData?.calibrateStackX);
    const stackY = Number(frame.customData?.calibrateStackY);
    const stackW = Number(frame.customData?.calibrateStackW);
    targetW = Number.isFinite(stackW) && stackW > 0 ? stackW : Math.max(96, frame.width * 0.4);
    maxLines = 2;
    const stacked = questionRectangles(elements)
      .filter((el) => {
        if (questionIdOf(el) === questionId) return false;
        return containsPoint(frame, centerOf(el));
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);
    targetX = Number.isFinite(stackX) ? stackX : frame.x + 8;
    targetY = Number.isFinite(stackY) ? stackY : frame.y + 36;
    const preview = laidOutQuestion(sourceText, targetW, maxLines);
    for (const other of stacked) {
      targetY = Math.max(targetY, other.y + other.height + CARD_GAP);
    }
    const stackBottom = Number(frame.customData?.calibrateStackMaxY);
    const bottom = Number.isFinite(stackBottom) ? stackBottom : frame.y + frame.height;
    const limit = bottom - preview.cardHeight - 6;
    if (targetY > limit) {
      const last = stacked[stacked.length - 1];
      targetY = last ? Math.min(limit, last.y + STACK_STEP) : limit;
      if (Number.isFinite(stackY)) targetY = Math.max(stackY, targetY);
    }
  }
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return current;
  const laid = laidOutQuestion(sourceText, targetW, maxLines);
  const dx = targetX - card.x;
  const dy = targetY - card.y;
  const moved = elements.map((el) => {
    if (el.id === card.id) {
      return { ...el, x: targetX, y: targetY, width: targetW, height: laid.cardHeight };
    }
    if (
      el.containerId === card.id ||
      (questionIdOf(el) === questionId && roleOf(el) === "question-label")
    ) {
      return {
        ...el,
        x: targetX + CARD_PAD_X,
        y: targetY + CARD_PAD_Y,
        width: laid.inner,
        height: laid.textHeight,
        text: laid.text,
        originalText: sourceText,
      };
    }
    if (questionIdOf(el) === questionId && roleOf(el) === "response") return shiftBy(el, dx, dy);
    return el;
  });
  return serializeIleWorkCanvasScene({
    elements: restoreCalibrateChrome(clearCalibrateResponseOverlap(moved)),
    appState: current.appState,
    files: current.files,
  });
}

export function addCalibrateResponseText(
  scene: IleWorkCanvasScene,
  input: { questionId: string; text: string; source: CalibrateResponseSource },
): IleWorkCanvasScene {
  const current = serializeIleWorkCanvasScene(scene);
  const text = trimText(input.text);
  if (!text || !calibrateCanvasTextCounts(text, input.source)) return current;
  const card = questionRectangles(current.elements).find((el) => questionIdOf(el) === input.questionId);
  const placedRegion = card
    ? regionRectangles(current.elements).find((frame) => containsPoint(frame, centerOf(card)))
    : null;
  const well = placedRegion
    ? current.elements.find(
        (el) =>
          !el.isDeleted &&
          el.type === "rectangle" &&
          roleOf(el) === "well" &&
          regionOf(el) === regionOf(placedRegion),
      )
    : null;
  const wellLabel = well
    ? current.elements.find(
        (el) =>
          !el.isDeleted &&
          el.type === "text" &&
          roleOf(el) === "well-label" &&
          regionOf(el) === regionOf(placedRegion!),
      )
    : null;
  const prior = current.elements.filter(
    (el) => !el.isDeleted && el.type === "text" && roleOf(el) === "response" && well && containsPoint(well, centerOf(el)),
  );
  const x = well ? well.x + 8 : card ? card.x + 12 : 48;
  let y = well
    ? (wellLabel ? wellLabel.y + wellLabel.height + 6 : well.y + 28)
    : card
      ? card.y + card.height + 12
      : 48;
  for (const earlier of prior) y = Math.max(y, earlier.y + earlier.height + 6);
  const width = well ? Math.max(80, well.width - 16) : CARD_WIDTH - 24;
  const custom: Record<string, unknown> = {
    [CALIBRATE_ROLE_KEY]: "response",
    [CALIBRATE_QUESTION_KEY]: input.questionId,
    [CALIBRATE_SOURCE_KEY]: input.source,
  };
  if (input.source === "dictated") custom.author = ILE_CANVAS_DICTATE_AUTHOR;
  const added = convertToExcalidrawElements([
    {
      type: "text",
      text,
      x,
      y,
      width,
      fontSize: 15,
      strokeColor: ILE_WORK_CANVAS_STROKE_COLOR,
      autoResize: false,
      customData: custom,
    },
  ]);
  return serializeIleWorkCanvasScene({
    elements: restoreCalibrateChrome(clearCalibrateResponseOverlap([...current.elements, ...added])),
    appState: current.appState,
    files: current.files,
  });
}
