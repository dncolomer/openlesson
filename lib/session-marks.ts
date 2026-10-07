/**
 * Session work is the four button presses.
 * Drawing and speech are stored on the press. They are not graded.
 * The mistake list is frozen from the topic's questions before the canvas.
 */

import { encodeKnowledgeConfig } from "@/lib/knowledge-config/encoder";

export const SESSION_PRESS_EMBEDDING_MODEL_ID = "knowledgecfg-press-v1" as const;

export const SESSION_MARK_BUTTONS = [
  { id: "try", label: "Close" },
  { id: "hold", label: "Keep" },
  { id: "drop", label: "Discard" },
  { id: "insight", label: "Insight" },
] as const;

export type SessionMarkButtonId = (typeof SESSION_MARK_BUTTONS)[number]["id"];

export type SessionMarkMode = "calibrate" | "learn" | "verification";

export type SessionMistake = {
  id: string;
  text: string;
  status: "open" | "closed";
  /** The only button that can close a row. */
  closingButton: "try";
};

export type CalibrateSureMark = {
  mistakeId: string;
  sure: boolean;
};

export type SessionPress = {
  id: string;
  button: SessionMarkButtonId;
  aimedMistakeId: string | null;
  slice: string;
  closedMistakeId: string | null;
  earlyInsight: boolean;
  insightCounted: boolean;
  at: number;
};

export type SessionMarkState = {
  mistakes: SessionMistake[];
  presses: SessionPress[];
  insightPressed: boolean;
  calibrate: CalibrateSureMark[];
};

export type SessionPressResult =
  | { ok: true; state: SessionMarkState; press: SessionPress }
  | { ok: false; reason: "insight_already_pressed"; state: SessionMarkState };

export type SessionBundle = {
  mistakes: SessionMistake[];
  presses: SessionPress[];
  closedIds: string[];
  openAtInsightIds: string[];
  earlyInsight: boolean;
  gap: number | null;
  startedTooSureIds: string[];
  calibrate: CalibrateSureMark[];
};

export type WorkspaceMistakePolicy = {
  mistakeId: string;
  text: string;
  cheapCloses: number;
  commitPasts: number;
  pressIds: string[];
};

const CALIBRATE_QUESTION_COUNT = 3;

export function sessionMarkButton(id: SessionMarkButtonId) {
  const button = SESSION_MARK_BUTTONS.find((row) => row.id === id);
  if (!button) throw new Error(`Unknown session mark ${id}`);
  return button;
}

export function freezeMistakeList(
  questions: readonly { id?: string | null; text?: string | null }[],
): SessionMistake[] {
  const mistakes: SessionMistake[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    const text = String(question?.text || "").trim();
    if (!text) continue;
    const id = String(question?.id || "").trim() || `mistake-${mistakes.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    mistakes.push({ id, text, status: "open", closingButton: "try" });
  }
  return mistakes;
}

export function emptySessionMarkState(mistakes: readonly SessionMistake[]): SessionMarkState {
  return {
    mistakes: mistakes.map((row) => ({ ...row, status: "open", closingButton: "try" })),
    presses: [],
    insightPressed: false,
    calibrate: [],
  };
}

/**
 * Grow the frozen list when a new branch opens.
 * A chapter change replaces the list. A new id on the same chapter is appended.
 * Presses stay when the list grows.
 */
export function mergeFrozenMistakes(
  current: SessionMarkState | null,
  questions: readonly { id?: string | null; text?: string | null }[],
  reset: boolean,
): SessionMarkState {
  const frozen = freezeMistakeList(questions);
  if (!current || reset || current.mistakes.length === 0) return emptySessionMarkState(frozen);
  const ids = new Set(current.mistakes.map((row) => row.id));
  const overlap = frozen.some((row) => ids.has(row.id));
  if (!overlap) return emptySessionMarkState(frozen);
  const added = frozen.filter((row) => !ids.has(row.id));
  if (!added.length) return current;
  return { ...current, mistakes: [...current.mistakes, ...added] };
}

export function openMistakes(state: SessionMarkState): SessionMistake[] {
  return state.mistakes.filter((row) => row.status === "open");
}

export function calibrateQuestions(state: SessionMarkState): SessionMistake[] {
  return state.mistakes.slice(0, CALIBRATE_QUESTION_COUNT);
}

export function setCalibrateSure(
  state: SessionMarkState,
  mistakeId: string,
  sure: boolean,
): SessionMarkState {
  const allowed = new Set(calibrateQuestions(state).map((row) => row.id));
  if (!allowed.has(mistakeId)) return state;
  const calibrate = state.calibrate.filter((row) => row.mistakeId !== mistakeId);
  calibrate.push({ mistakeId, sure });
  return { ...state, calibrate };
}

function nextPressId(state: SessionMarkState): string {
  return `press-${state.presses.length + 1}`;
}

export function applySessionPress(
  state: SessionMarkState,
  input: {
    button: SessionMarkButtonId;
    aimedMistakeId?: string | null;
    slice?: string | null;
    at?: number;
  },
): SessionPressResult {
  if (input.button === "insight" && state.insightPressed) {
    return { ok: false, reason: "insight_already_pressed", state };
  }

  const aimed =
    input.button === "try" ? String(input.aimedMistakeId || "").trim() || null : null;
  const target =
    aimed == null ? null : state.mistakes.find((row) => row.id === aimed && row.status === "open");
  const closedMistakeId = input.button === "try" && target ? target.id : null;
  const mistakes = state.mistakes.map((row) =>
    row.id === closedMistakeId ? { ...row, status: "closed" as const } : row,
  );
  const stillOpen = mistakes.filter((row) => row.status === "open");
  const earlyInsight = input.button === "insight" && stillOpen.length > 0;
  const insightCounted = input.button === "insight" && stillOpen.length === 0;
  const press: SessionPress = {
    id: nextPressId(state),
    button: input.button,
    aimedMistakeId: aimed,
    slice: String(input.slice || "").trim(),
    closedMistakeId,
    earlyInsight,
    insightCounted,
    at: input.at ?? Date.now(),
  };

  return {
    ok: true,
    press,
    state: {
      ...state,
      mistakes,
      presses: [...state.presses, press],
      insightPressed: state.insightPressed || input.button === "insight",
    },
  };
}

export function insightPress(state: SessionMarkState): SessionPress | null {
  return state.presses.find((press) => press.button === "insight") ?? null;
}

function closedBeforeInsight(state: SessionMarkState): Set<string> {
  const index = state.presses.findIndex((press) => press.button === "insight");
  if (index < 0) return new Set();
  return new Set(
    state.presses
      .slice(0, index)
      .map((press) => press.closedMistakeId)
      .filter((id): id is string => Boolean(id)),
  );
}

/** Open mistakes at the insight press. Null until that press exists. */
export function verificationGap(state: SessionMarkState): number | null {
  if (!insightPress(state)) return null;
  const closedBefore = closedBeforeInsight(state);
  return state.mistakes.filter((row) => !closedBefore.has(row.id)).length;
}

export function startedTooSureIds(state: SessionMarkState): string[] {
  if (!insightPress(state)) return [];
  const closedBefore = closedBeforeInsight(state);
  const openAtInsight = new Set(
    state.mistakes.filter((row) => !closedBefore.has(row.id)).map((row) => row.id),
  );
  return state.calibrate
    .filter((row) => row.sure && openAtInsight.has(row.mistakeId))
    .map((row) => row.mistakeId);
}

export function learningPointer(
  state: SessionMarkState,
): { mistakeId: string; button: "try" } | null {
  const open = openMistakes(state)[0];
  if (!open) return null;
  return { mistakeId: open.id, button: "try" };
}

export function sessionPressLine(press: SessionPress, mistakeText?: string | null): string {
  const button = sessionMarkButton(press.button);
  const aim = mistakeText?.trim() ? ` Aimed at: ${mistakeText.trim()}.` : "";
  const outcome = press.closedMistakeId
    ? " Closed that mistake."
    : press.earlyInsight
      ? " Early insight. Mark against the path."
      : press.insightCounted
        ? " Insight counted."
        : "";
  return `${button.label}.${aim}${outcome}`;
}

export function buildSessionBundle(state: SessionMarkState): SessionBundle {
  const insight = insightPress(state);
  const closedBefore = closedBeforeInsight(state);
  const openAtInsightIds = insight
    ? state.mistakes.filter((row) => !closedBefore.has(row.id)).map((row) => row.id)
    : [];
  return {
    mistakes: state.mistakes.map((row) => ({ ...row })),
    presses: state.presses.map((press) => ({ ...press })),
    closedIds: state.mistakes.filter((row) => row.status === "closed").map((row) => row.id),
    openAtInsightIds,
    earlyInsight: Boolean(insight?.earlyInsight),
    gap: verificationGap(state),
    startedTooSureIds: startedTooSureIds(state),
    calibrate: state.calibrate.map((row) => ({ ...row })),
  };
}

export function foldWorkspacePolicy(
  sessions: readonly { bundle: SessionBundle }[],
): WorkspaceMistakePolicy[] {
  const byId = new Map<string, WorkspaceMistakePolicy>();
  for (const session of sessions) {
    const textById = new Map(session.bundle.mistakes.map((row) => [row.id, row.text]));
    const openAtInsight = new Set(session.bundle.openAtInsightIds);
    for (const mistake of session.bundle.mistakes) {
      const current = byId.get(mistake.id) ?? {
        mistakeId: mistake.id,
        text: mistake.text,
        cheapCloses: 0,
        commitPasts: 0,
        pressIds: [],
      };
      if (mistake.status === "closed") current.cheapCloses += 1;
      if (openAtInsight.has(mistake.id)) current.commitPasts += 1;
      current.text = textById.get(mistake.id) || current.text;
      for (const press of session.bundle.presses) {
        if (press.aimedMistakeId === mistake.id || press.closedMistakeId === mistake.id) {
          current.pressIds.push(press.id);
        }
      }
      byId.set(mistake.id, current);
    }
  }
  return [...byId.values()];
}

export type MarkRankingRow = {
  id: string;
  label: string;
  gap: number | null;
  rank: number | null;
};

/** Smaller gap ranks higher. A session with no insight press is unranked. */
export function rankByButtonGap(
  rows: readonly { id: string; label: string; gap: number | null }[],
): MarkRankingRow[] {
  const ranked = rows.filter((row) => row.gap != null);
  const unranked = rows.filter((row) => row.gap == null);
  ranked.sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0) || a.label.localeCompare(b.label));
  return [
    ...ranked.map((row, index) => ({ ...row, rank: index + 1 })),
    ...unranked.map((row) => ({ ...row, rank: null })),
  ];
}

export function strengthMistakeIds(bundle: SessionBundle): string[] {
  return bundle.closedIds;
}

export function gapMistakeIds(bundle: SessionBundle): string[] {
  return bundle.openAtInsightIds;
}

export function embedSessionPress(input: {
  workspaceId: string;
  press: SessionPress;
  mistakeText?: string | null;
}): { embedding_model_id: typeof SESSION_PRESS_EMBEDDING_MODEL_ID; dim: number; vector: number[] } {
  const line = sessionPressLine(input.press, input.mistakeText);
  const text = [line, input.press.slice].filter((part) => part.trim()).join("\n");
  const encoded = encodeKnowledgeConfig({
    workspaceId: input.workspaceId || "session-marks",
    totalBlocks: 0,
    evaluatedGoalsText: text,
    asOfMs: input.press.at,
    powRows: [
      {
        proof_of_work_type: "tool",
        timestamp_ms: input.press.at,
        tool_action: input.press.button,
      },
    ],
  });
  return {
    embedding_model_id: SESSION_PRESS_EMBEDDING_MODEL_ID,
    dim: encoded.dim,
    vector: encoded.vector,
  };
}

export function meanPressVectors(vectors: readonly (readonly number[])[]): number[] {
  const rows = vectors.filter((vector) => vector.length > 0);
  if (rows.length === 0) return [];
  const dim = rows[0]!.length;
  const sum = new Array(dim).fill(0);
  for (const vector of rows) {
    for (let i = 0; i < dim; i += 1) sum[i] += vector[i] ?? 0;
  }
  return sum.map((value) => value / rows.length);
}

export function selectionSlice(input: {
  selectedTexts: readonly string[];
  speech: string;
}): string {
  const drawing = input.selectedTexts.map((text) => text.trim()).filter(Boolean).join("\n");
  const speech = input.speech.trim();
  return [drawing, speech].filter(Boolean).join("\n");
}
