/**
 * Calibration session: sort a question pool on the work canvas, answer one
 * comfortable question, then explain one uncertainty.
 * Pure over assignments, canvas scenes, and proof events. UI and both entry
 * points call these functions. Tests inject pools and canvas text.
 */

import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";
import {
  convertToExcalidrawElements,
  emptyIleWorkCanvasScene,
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
export const CALIBRATE_POOL_LIMIT = 8;

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

const CARD_WIDTH = 280;
const CARD_MIN_HEIGHT = 88;
const CARD_PAD_X = 14;
const CARD_PAD_Y = 12;
const CARD_FONT = 16;
const REGION_WIDTH = 520;
const CARD_STACK_GAP = 28;
/** Room under a card for a response so the words do not sit on the question. */
const RESPONSE_CLEARANCE = 96;

/** Opening plate. The camera centers this box, and the question column starts to its right. */
const OPENING_X = 80;
const OPENING_Y = 80;
const OPENING_W = 560;
const OPENING_H = 220;
/** Empty world space between the centered instruction and the question column. */
const CUE_LANE = 280;
/** Keeps the region title below the opening cue, which sits under the instruction on a phone. */
const OPENING_CLEARANCE = 140;

export const CALIBRATE_OPENING_INSTRUCTION =
  "Move three questions into Comfortable answering and two into Not confident. Then answer one question you could answer, and write what is uncertain about one you could not. Type, paste, or dictate on that card.";
export const CALIBRATE_MOVE_RIGHT_LABEL = "move right";

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

function cardMetrics(text: string): { width: number; height: number; innerWidth: number; wrapped: string } {
  const innerWidth = CARD_WIDTH - CARD_PAD_X * 2;
  const wrapped = wrapIleWorkCanvasText(text, innerWidth, CARD_FONT);
  return {
    width: CARD_WIDTH,
    height: Math.max(CARD_MIN_HEIGHT, wrapped.height + CARD_PAD_Y * 2),
    innerWidth,
    wrapped: wrapped.text,
  };
}

function regionFrame(
  region: CalibrateRegion,
  x: number,
  y: number,
  height: number,
): IleWorkCanvasElement[] {
  const label = region === "comfortable" ? CALIBRATE_COMFORTABLE_LABEL : CALIBRATE_UNCONFIDENT_LABEL;
  const wrapped = wrapIleWorkCanvasText(label, REGION_WIDTH - 32, 18);
  const custom = {
    [CALIBRATE_ROLE_KEY]: "region",
    [CALIBRATE_REGION_KEY]: region,
  };
  const labelCustom = {
    [CALIBRATE_ROLE_KEY]: "region-label",
    [CALIBRATE_REGION_KEY]: region,
  };
  return convertToExcalidrawElements([
    {
      type: "rectangle",
      x,
      y,
      width: REGION_WIDTH,
      height,
      strokeColor: "#e5e5e5",
      backgroundColor: "transparent",
      strokeWidth: 2,
      locked: true,
      customData: custom,
    },
    {
      type: "text",
      text: label,
      x: x + 16,
      y: y - wrapped.height - 12,
      width: wrapped.width,
      height: wrapped.height,
      autoResize: false,
      locked: true,
      customData: labelCustom,
    },
  ]);
}

function openingAnchor(): IleWorkCanvasElement[] {
  return convertToExcalidrawElements([
    {
      type: "rectangle",
      x: OPENING_X,
      y: OPENING_Y,
      width: OPENING_W,
      height: OPENING_H,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      strokeWidth: 0,
      locked: true,
      customData: { [CALIBRATE_ROLE_KEY]: "instruction" },
    },
  ]);
}

function questionCard(
  question: CalibrateQuestion,
  x: number,
  y: number,
): IleWorkCanvasElement[] {
  const box = cardMetrics(question.text);
  const custom = {
    [CALIBRATE_ROLE_KEY]: "question",
    [CALIBRATE_QUESTION_KEY]: question.id,
    [CALIBRATE_HOME_X_KEY]: x,
    [CALIBRATE_HOME_Y_KEY]: y,
  };
  const converted = convertToExcalidrawElements([
    {
      type: "rectangle",
      x,
      y,
      width: box.width,
      height: box.height,
      strokeColor: "#f5f5f5",
      backgroundColor: "transparent",
      strokeWidth: 2,
      customData: custom,
    },
    {
      type: "text",
      text: question.text,
      x: x + CARD_PAD_X,
      y: y + CARD_PAD_Y,
      width: box.innerWidth,
      fontSize: CARD_FONT,
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
  }
  return converted;
}

function questionColumnX(): number {
  return OPENING_X + OPENING_W + CUE_LANE;
}

function regionHeightFor(questions: readonly CalibrateQuestion[]): number {
  const tallest = questions.reduce((max, question) => {
    return Math.max(max, cardMetrics(question.text).height);
  }, CARD_MIN_HEIGHT);
  const slots = Math.max(questions.length, CALIBRATE_COMFORTABLE_REQUIRED);
  return 24 + slots * (tallest + RESPONSE_CLEARANCE);
}

export function seedCalibrateWorkCanvas(
  raw: unknown,
): { scene: IleWorkCanvasScene; questions: CalibrateQuestion[] } {
  const questions = normalizeCalibrateQuestions(raw);
  const height = regionHeightFor(questions);
  const labelGap = wrapIleWorkCanvasText(CALIBRATE_COMFORTABLE_LABEL, REGION_WIDTH - 32, 18).height + 28;
  const comfortableY = OPENING_Y + OPENING_H + OPENING_CLEARANCE + labelGap;
  const unconfidentY = comfortableY + height + labelGap;
  const elements: IleWorkCanvasElement[] = [
    ...openingAnchor(),
    ...regionFrame("comfortable", OPENING_X, comfortableY, height),
    ...regionFrame("unconfident", OPENING_X, unconfidentY, height),
  ];
  let cardY = OPENING_Y;
  const cardX = questionColumnX();
  for (const question of questions) {
    const box = cardMetrics(question.text);
    elements.push(...questionCard(question, cardX, cardY));
    cardY += box.height + CARD_STACK_GAP;
  }
  const empty = emptyIleWorkCanvasScene();
  return {
    questions,
    scene: serializeIleWorkCanvasScene({
      elements,
      appState: empty.appState,
      files: empty.files,
    }),
  };
}

/** True when readable text shares pixels with other text or with a card it is not inside. */
export function calibrateTextCollides(elements: readonly IleWorkCanvasElement[]): boolean {
  const live = elements.filter((el) => !el.isDeleted);
  const texts = live.filter((el) => el.type === "text");
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts[i]!;
    for (let j = i + 1; j < texts.length; j += 1) {
      if (boxesOverlap(boxOf(text), boxOf(texts[j]!), 2)) return true;
    }
    for (const other of live) {
      if (other.type !== "rectangle") continue;
      const role = roleOf(other);
      if (role === "region" || role === "instruction") continue;
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

/** True when two board marks occupy the same pixels, other than a label inside its card. */
export function calibrateBoardHasOverlap(elements: readonly IleWorkCanvasElement[]): boolean {
  const live = elements.filter((el) => !el.isDeleted);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i]!;
      const b = live[j]!;
      if (a.containerId === b.id || b.containerId === a.id) continue;
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
  "prompt",
  "question",
  "region",
  "instruction",
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
  let targetX = Number(card.customData?.[CALIBRATE_HOME_X_KEY]);
  let targetY = Number(card.customData?.[CALIBRATE_HOME_Y_KEY]);
  if (region !== "pool") {
    const frame = regionRectangles(elements).find((el) => regionOf(el) === region);
    if (!frame) return current;
    const stacked = questionRectangles(elements)
      .filter((el) => {
        if (questionIdOf(el) === questionId) return false;
        return containsPoint(frame, centerOf(el));
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);
    targetX = frame.x + 24;
    targetY = frame.y + 20;
    for (const other of stacked) {
      targetY = Math.max(targetY, other.y + other.height + RESPONSE_CLEARANCE);
    }
  }
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return current;
  const dx = targetX - card.x;
  const dy = targetY - card.y;
  const moved = elements.map((el) => {
    if (el.id === card.id) return shiftBy(el, dx, dy);
    if (
      el.containerId === card.id ||
      (questionIdOf(el) === questionId &&
        (roleOf(el) === "question-label" || roleOf(el) === "response"))
    ) {
      return shiftBy(el, dx, dy);
    }
    return el;
  });
  return serializeIleWorkCanvasScene({
    elements: clearCalibrateResponseOverlap(moved),
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
  const x = card ? card.x + 12 : 48;
  const y = card ? card.y + card.height + 12 : 48;
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
      width: CARD_WIDTH - 24,
      customData: custom,
    },
  ]);
  return serializeIleWorkCanvasScene({
    elements: clearCalibrateResponseOverlap([...current.elements, ...added]),
    appState: current.appState,
    files: current.files,
  });
}
