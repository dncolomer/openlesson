/**
 * Calibration session: sort a question pool on the work canvas, answer one
 * comfortable question, then explain one uncertainty.
 * Pure over assignments, canvas scenes, and proof events. UI and both entry
 * points call these functions. Tests inject pools and canvas text.
 */

import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";
import {
  boardInstructionNoteElements,
  convertToExcalidrawElements,
  emptyIleWorkCanvasScene,
  ILE_WORK_CANVAS_STROKE_COLOR,
  serializeIleWorkCanvasScene,
  wrapIleWorkCanvasText,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
} from "@/lib/ile-work-canvas";
import { clearCalibrateResponseOverlap, ILE_CANVAS_DICTATE_AUTHOR } from "@/lib/ile-canvas-dictate";

export const CALIBRATE_COMFORTABLE_REQUIRED = 3;
export const CALIBRATE_UNCONFIDENT_REQUIRED = 2;
export const CALIBRATE_MIN_POOL =
  CALIBRATE_COMFORTABLE_REQUIRED + CALIBRATE_UNCONFIDENT_REQUIRED;
export const CALIBRATE_POOL_LIMIT = 12;

export const CALIBRATE_MODE_LABEL = "Calibrate";
export const CALIBRATE_DONE_CLASSIFYING_LABEL = "I'm done classifying";
export const CALIBRATE_DONE_ANSWERING_LABEL = "I'm done answering";
export const CALIBRATE_DONE_EXPLAINING_LABEL = "I'm done explaining";
export const CALIBRATE_DATA_DISABLED_LABEL = "Disabled";
export const CALIBRATE_COMFORTABLE_LABEL = "Comfortable answering";
export const CALIBRATE_UNCONFIDENT_LABEL = "Not confident";

export const CALIBRATE_ROLE_KEY = "calibrateRole";
export const CALIBRATE_REGION_KEY = "calibrateRegion";
export const CALIBRATE_QUESTION_KEY = "calibrateQuestionId";
export const CALIBRATE_SOURCE_KEY = "calibrateResponseSource";
export const CALIBRATE_HOME_X_KEY = "calibrateHomeX";
export const CALIBRATE_HOME_Y_KEY = "calibrateHomeY";

export type CalibrateRegion = "comfortable" | "unconfident";
export type CalibrateResponseSource = "typed" | "pasted" | "dictated";
export type CalibratePhase = "classifying" | "answer" | "explain" | "complete";

export type CalibrateQuestion = {
  id: string;
  text: string;
};

export type CalibrateProofEvent =
  | {
      type: "region_move";
      questionId: string;
      from: CalibrateRegion | null;
      to: CalibrateRegion | null;
    }
  | {
      type: "comfortable_answer";
      questionId: string;
      text: string;
      source: CalibrateResponseSource;
    }
  | {
      type: "uncertainty_explanation";
      questionId: string;
      text: string;
      source: CalibrateResponseSource;
    }
  | {
      type: "policy_score";
      questionId: string;
      text: string;
      source: CalibrateResponseSource;
    }
  | {
      type: "sounding";
      questionId: string;
      text: string;
      source: CalibrateResponseSource;
    };

export type CalibrateCanvasText = {
  questionId: string;
  text: string;
  source: CalibrateResponseSource;
};

export type CalibrateState = {
  pool: CalibrateQuestion[];
  assignments: Record<string, CalibrateRegion | null>;
  phase: CalibratePhase;
  events: CalibrateProofEvent[];
};

export type CalibrateAdvance =
  | { ok: true; state: CalibrateState }
  | { ok: false; reason: string; state: CalibrateState };

const RESPONSE_SOURCES: readonly CalibrateResponseSource[] = ["typed", "pasted", "dictated"];

const CARD_WIDTH = 232;
const CARD_PAD_X = 10;
const CARD_PAD_Y = 8;
const CARD_FONT = 15;
const CARD_GAP = 8;
const CARD_LINE_HEIGHT = 1.25;
/** Last-resort pile when a fourth card would leave the area. */
const STACK_STEP = 22;
/** Side-by-side areas. Fixed size: answers never grow them. */
export const CALIBRATE_REGION_WIDTH = 300;
export const CALIBRATE_REGION_HEIGHT = 236;
const REGION_WIDTH = CALIBRATE_REGION_WIDTH;
const REGION_HEIGHT = CALIBRATE_REGION_HEIGHT;
const REGION_GAP = 12;
const COLUMN_GAP = 16;
const BOARD_X = 32;
const BOARD_Y = 24;
const INSTRUCTION_GAP = 12;
const INSTRUCTION_FONT = 16;
const WELL_HEIGHT = 112;
/**
 * Stored mid-grays. The dark canvas inverts them into solid cards:
 * questions a little darker than the answer space.
 */
export const CALIBRATE_QUESTION_FILL = "#d4d4d8";
export const CALIBRATE_WELL_FILL = "#a3a3a3";
const QUESTION_TEXT_KEY = "calibrateQuestionText";
const HOME_W_KEY = "calibrateHomeW";
const HOME_LINES_KEY = "calibrateHomeLines";

export const CALIBRATE_OPENING_INSTRUCTION =
  "Move three questions into Comfortable answering and two into Not confident. Write one answer in the filled space under Comfortable answering. Write why you could not answer one question in the filled space under Not confident.";
export const CALIBRATE_ANSWER_WELL_LABEL = "Write one answer here";
export const CALIBRATE_EXPLAIN_WELL_LABEL = "Write why not here";
export const CALIBRATE_MOVE_RIGHT_LABEL = "move right";

const LOCKED_CHROME_ROLES = new Set([
  "instruction",
  "instruction-label",
  "region",
  "region-label",
  "well",
  "well-label",
]);

type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(a: Box, b: Box, pad = 4): boolean {
  return (
    a.x - pad < b.x + b.width &&
    a.x + a.width + pad > b.x &&
    a.y - pad < b.y + b.height &&
    a.y + a.height + pad > b.y
  );
}

function boxOf(el: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">): Box {
  return {
    x: el.x,
    y: el.y,
    width: Math.max(1, el.width || 0),
    height: Math.max(1, el.height || 0),
  };
}

function trimText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function poolId(index: number, raw: unknown): string {
  const id = trimText(raw);
  return id || `q-${index + 1}`;
}

export function normalizeCalibrateQuestions(raw: unknown): CalibrateQuestion[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions)) {
    list = (raw as { questions: unknown[] }).questions;
  } else if (typeof raw === "string" && raw.trim()) {
    list = raw
      .split(/\n+/)
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean);
  }

  const questions: CalibrateQuestion[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const record = item && typeof item === "object" ? (item as { id?: unknown; text?: unknown; question?: unknown }) : null;
    const text = trimText(
      typeof item === "string" ? item : record?.text ?? record?.question ?? "",
    );
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push({
      id: poolId(questions.length, record?.id),
      text,
    });
    if (questions.length >= CALIBRATE_POOL_LIMIT) break;
  }
  return questions;
}

export function createCalibrateState(raw: unknown): CalibrateState {
  const pool = normalizeCalibrateQuestions(raw);
  const assignments: Record<string, CalibrateRegion | null> = {};
  for (const question of pool) assignments[question.id] = null;
  return { pool, assignments, phase: "classifying", events: [] };
}

export function calibrateRegionCounts(state: CalibrateState): {
  comfortable: number;
  unconfident: number;
} {
  let comfortable = 0;
  let unconfident = 0;
  for (const question of state.pool) {
    const region = state.assignments[question.id];
    if (region === "comfortable") comfortable += 1;
    else if (region === "unconfident") unconfident += 1;
  }
  return { comfortable, unconfident };
}

export function canFinishClassifying(state: CalibrateState): boolean {
  if (state.phase !== "classifying") return false;
  if (state.pool.length < CALIBRATE_MIN_POOL) return false;
  const counts = calibrateRegionCounts(state);
  return (
    counts.comfortable === CALIBRATE_COMFORTABLE_REQUIRED &&
    counts.unconfident === CALIBRATE_UNCONFIDENT_REQUIRED
  );
}

export function moveCalibrateQuestion(
  state: CalibrateState,
  questionId: string,
  region: CalibrateRegion | null,
): CalibrateState {
  if (state.phase !== "classifying") return state;
  const question = state.pool.find((item) => item.id === questionId);
  if (!question) return state;
  const from = state.assignments[question.id] ?? null;
  if (from === region) return state;
  return {
    ...state,
    assignments: { ...state.assignments, [question.id]: region },
    events: [
      ...state.events,
      { type: "region_move", questionId: question.id, from, to: region },
    ],
  };
}

export function finishClassifying(state: CalibrateState): CalibrateAdvance {
  if (state.phase !== "classifying") {
    return { ok: false, reason: "wrong_phase", state };
  }
  if (state.pool.length < CALIBRATE_MIN_POOL) {
    return { ok: false, reason: "pool_too_small", state };
  }
  if (!canFinishClassifying(state)) {
    return { ok: false, reason: "classification_incomplete", state };
  }
  return { ok: true, state: { ...state, phase: "answer" } };
}

export function calibrateCanvasTextCounts(
  text: string,
  source: CalibrateResponseSource,
): boolean {
  return RESPONSE_SOURCES.includes(source) && trimText(text).length > 0;
}

function groupedResponses(
  texts: readonly CalibrateCanvasText[],
): Map<string, { text: string; source: CalibrateResponseSource }> {
  const grouped = new Map<string, { text: string; source: CalibrateResponseSource }>();
  for (const item of texts) {
    if (!calibrateCanvasTextCounts(item.text, item.source)) continue;
    const text = trimText(item.text);
    const current = grouped.get(item.questionId);
    if (!current) {
      grouped.set(item.questionId, { text, source: item.source });
      continue;
    }
    grouped.set(item.questionId, {
      text: `${current.text}\n${text}`,
      source: item.source,
    });
  }
  return grouped;
}

function questionsInRegion(state: CalibrateState, region: CalibrateRegion): CalibrateQuestion[] {
  return state.pool.filter((question) => state.assignments[question.id] === region);
}

function filledQuestionIds(
  state: CalibrateState,
  region: CalibrateRegion,
  texts: readonly CalibrateCanvasText[],
): string[] {
  const allowed = new Set(questionsInRegion(state, region).map((question) => question.id));
  const grouped = groupedResponses(texts);
  return [...grouped.keys()].filter((id) => allowed.has(id));
}

export function canFinishComfortableAnswer(
  state: CalibrateState,
  texts: readonly CalibrateCanvasText[],
): boolean {
  if (state.phase !== "answer") return false;
  return filledQuestionIds(state, "comfortable", texts).length === 1;
}

export function finishComfortableAnswer(
  state: CalibrateState,
  texts: readonly CalibrateCanvasText[],
): CalibrateAdvance {
  if (state.phase !== "answer") return { ok: false, reason: "wrong_phase", state };
  const filled = filledQuestionIds(state, "comfortable", texts);
  if (filled.length === 0) return { ok: false, reason: "answer_missing", state };
  if (filled.length !== 1) return { ok: false, reason: "answer_not_exactly_one", state };
  const questionId = filled[0]!;
  const response = groupedResponses(texts).get(questionId);
  if (!response) return { ok: false, reason: "answer_missing", state };
  return {
    ok: true,
    state: {
      ...state,
      phase: "explain",
      events: [
        ...state.events,
        {
          type: "comfortable_answer",
          questionId,
          text: response.text,
          source: response.source,
        },
      ],
    },
  };
}

export function canFinishUncertainty(
  state: CalibrateState,
  texts: readonly CalibrateCanvasText[],
): boolean {
  if (state.phase !== "explain") return false;
  return filledQuestionIds(state, "unconfident", texts).length === 1;
}

export function finishUncertainty(
  state: CalibrateState,
  texts: readonly CalibrateCanvasText[],
): CalibrateAdvance {
  if (state.phase !== "explain") return { ok: false, reason: "wrong_phase", state };
  const filled = filledQuestionIds(state, "unconfident", texts);
  if (filled.length === 0) return { ok: false, reason: "uncertainty_missing", state };
  if (filled.length !== 1) return { ok: false, reason: "uncertainty_not_exactly_one", state };
  const questionId = filled[0]!;
  const response = groupedResponses(texts).get(questionId);
  if (!response) return { ok: false, reason: "uncertainty_missing", state };
  return {
    ok: true,
    state: {
      ...state,
      phase: "complete",
      events: [
        ...state.events,
        {
          type: "uncertainty_explanation",
          questionId,
          text: response.text,
          source: response.source,
        },
      ],
    },
  };
}

export function calibrateStepInstruction(phase: CalibratePhase): string {
  switch (phase) {
    case "classifying":
      return `Move ${CALIBRATE_COMFORTABLE_REQUIRED} questions into ${CALIBRATE_COMFORTABLE_LABEL} and ${CALIBRATE_UNCONFIDENT_REQUIRED} into ${CALIBRATE_UNCONFIDENT_LABEL}.`;
    case "answer":
      return "Answer one question you felt comfortable with. Type, paste, or dictate on that card.";
    case "explain":
      return "Pick one question you were not confident about and write what is uncertain.";
    case "complete":
      return "Calibration is stored.";
    default: {
      const unknown: never = phase;
      return unknown;
    }
  }
}

export function buildCalibrateProofMetadata(state: CalibrateState): Record<string, unknown> {
  return {
    calibrate_session: true,
    verification_run: false,
    calibrate_phase: state.phase,
    calibrate_events: state.events,
  };
}

export function buildCalibrateCompleteTranscript(input: {
  seedText: string;
  state: CalibrateState;
}): Array<{ role: "assistant" | "user"; text: string; at: string }> {
  const at = new Date().toISOString();
  const lines: Array<{ role: "assistant" | "user"; text: string; at: string }> = [
    { role: "assistant", text: `Calibrate: ${trimText(input.seedText) || "Topic"}`, at },
  ];
  for (const event of input.state.events) {
    if (event.type === "region_move") {
      lines.push({
        role: "user",
        text: `Moved ${event.questionId} from ${event.from ?? "pool"} to ${event.to ?? "pool"}`,
        at,
      });
    } else if (event.type === "comfortable_answer") {
      lines.push({ role: "user", text: event.text, at });
    } else {
      lines.push({ role: "user", text: event.text, at });
    }
  }
  return lines;
}

export function buildCalibratePoolSystemMessage(
  count: number = CALIBRATE_MIN_POOL,
): string {
  const n = Math.max(CALIBRATE_MIN_POOL, Math.floor(Number(count) || CALIBRATE_MIN_POOL));
  return [
    `You write a calibration pool of questions. Return ONLY JSON: { "questions": [ "...", ... ] } with ${n} distinct questions.`,
    "The learner will sort them into questions they could answer and questions they could not. Do not answer them.",
    TUTOR_CANVAS_VOICE,
    "Each item is a question in two or three unhurried sentences and ends with a question mark.",
    "No headings, no bullets, no numbering, no product jargon.",
  ].join(" ");
}

export function buildCalibratePoolUserPrompt(input: {
  seedTitle?: string | null;
  seedDescription?: string | null;
  count?: number;
}): string {
  const n = Math.max(CALIBRATE_MIN_POOL, Math.floor(Number(input.count) || CALIBRATE_MIN_POOL));
  const title = trimText(input.seedTitle) || "the topic";
  const description = trimText(input.seedDescription);
  return [
    `Write ${n} questions a learner could sort before studying ${title}.`,
    description ? `Context: ${description}` : "",
    "Questions only. Do not include answers.",
  ]
    .filter(Boolean)
    .join("\n");
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
    for (let j = i + 1; j < texts.length; j += 1) {
      const otherText = texts[j]!;
      if (!boxesOverlap(boxOf(text), boxOf(otherText), 2)) continue;
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
        const glyphs = boxOf(text);
        const card = boxOf(other);
        const inside =
          glyphs.x >= card.x - 1 &&
          glyphs.y >= card.y - 1 &&
          glyphs.x + glyphs.width <= card.x + card.width + 1 &&
          glyphs.y + glyphs.height <= card.y + card.height + 1;
        if (!inside) return true;
        continue;
      }
      if (boxesOverlap(boxOf(text), boxOf(other), 2)) return true;
    }
  }
  return false;
}

function fullyInside(inner: Box, outer: Box): boolean {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  );
}

/** Locked plates may hold their own titles and the answer or explain well. */
function chromeInsideFrame(a: IleWorkCanvasElement, b: IleWorkCanvasElement): boolean {
  const roleA = roleOf(a);
  const roleB = roleOf(b);
  const frames = new Set(["region", "instruction", "well"]);
  if (frames.has(roleA) && LOCKED_CHROME_ROLES.has(roleB) && fullyInside(boxOf(b), boxOf(a))) return true;
  if (frames.has(roleB) && LOCKED_CHROME_ROLES.has(roleA) && fullyInside(boxOf(a), boxOf(b))) return true;
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
      if (!boxesOverlap(boxOf(a), boxOf(b))) continue;
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

function intersects(
  a: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
  b: Pick<IleWorkCanvasElement, "x" | "y" | "width" | "height">,
  pad = 28,
): boolean {
  return (
    a.x - pad < b.x + b.width &&
    a.x + a.width + pad > b.x &&
    a.y - pad < b.y + b.height &&
    a.y + a.height + pad > b.y
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

export function syncCalibratePlacements(
  state: CalibrateState,
  placements: Record<string, CalibrateRegion | null>,
): CalibrateState {
  let next = state;
  for (const question of state.pool) {
    if (!Object.prototype.hasOwnProperty.call(placements, question.id)) continue;
    next = moveCalibrateQuestion(next, question.id, placements[question.id] ?? null);
  }
  return next;
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
  const hits = cards.filter((card) => intersects(text, card));
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
