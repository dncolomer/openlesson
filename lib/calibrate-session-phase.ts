/**
 * Calibration session: sort a question pool on the work canvas, answer one
 * comfortable question, then explain one uncertainty.
 * Pure over assignments, canvas scenes, and proof events. UI and both entry
 * points call these functions. Tests inject pools and canvas text.
 * Canvas geometry lives in calibrate-session-geometry; this file is the phase machine.
 */

import { TUTOR_CANVAS_VOICE } from "@/lib/prompt-kernel/tutor-voice";

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

/** Side-by-side areas. Fixed size: answers never grow them. */
export const CALIBRATE_REGION_WIDTH = 300;
export const CALIBRATE_REGION_HEIGHT = 236;
/**
 * Stored mid-grays. The dark canvas inverts them into solid cards:
 * questions a little darker than the answer space.
 */
export const CALIBRATE_QUESTION_FILL = "#d4d4d8";
export const CALIBRATE_WELL_FILL = "#a3a3a3";

export const CALIBRATE_OPENING_INSTRUCTION =
  "Move three questions into Comfortable answering and two into Not confident. Write one answer in the filled space under Comfortable answering. Write why you could not answer one question in the filled space under Not confident.";
export const CALIBRATE_ANSWER_WELL_LABEL = "Write one answer here";
export const CALIBRATE_EXPLAIN_WELL_LABEL = "Write why not here";
export const CALIBRATE_MOVE_RIGHT_LABEL = "move right";

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
