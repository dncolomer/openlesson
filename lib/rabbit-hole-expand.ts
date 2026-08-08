/**
 * Pure rabbit-hole expansion process for creator Expand-block flow.
 *
 * Process (independent of React / network):
 *  - Seed = source block topic; outlineTarget = active selection cell count
 *  - Start with 3 questions; user may regenerate that initial set
 *  - Each pick becomes an expansion candidate; then 2 follow-up questions
 *  - Complete when candidates.length >= outlineTarget
 *  - No step-back; restart clears to top
 *  - Summary allows modifying which candidates are confirmed for expand
 */

import type { ExpandSourceIdentity } from "@/lib/expand-block-from-source";
import type { AddExpandCell } from "@/lib/add-block-range-density";

export const RABBIT_HOLE_INITIAL_QUESTION_COUNT = 3;
export const RABBIT_HOLE_FOLLOWUP_QUESTION_COUNT = 2;

export type RabbitHoleExpandPhase = "choosing" | "complete";

export type RabbitHoleExpandState = {
  /** Target number of expansion candidates (active selection size). */
  outlineTarget: number;
  /** Number of picks made (0 = still on initial round). */
  depth: number;
  /** Ordered picked questions (expansion candidates). */
  candidates: string[];
  /** Current question choices shown to the user. */
  currentQuestions: string[];
  phase: RabbitHoleExpandPhase;
  /** Regenerate only allowed on the initial round (depth 0, not complete). */
  canRegenerate: boolean;
  /** How many more picks needed to meet the outline (0 when complete). */
  remaining: number;
};

export type RabbitHoleExpandSummaryState = {
  /** All candidates produced by the dive. */
  candidates: string[];
  /** Parallel selection flags for confirm (default all true). */
  selected: boolean[];
};

function clampOutline(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function remainingFor(outlineTarget: number, candidateCount: number): number {
  return Math.max(0, outlineTarget - candidateCount);
}

function isComplete(outlineTarget: number, candidateCount: number): boolean {
  if (outlineTarget <= 0) return candidateCount > 0 || outlineTarget === 0;
  return candidateCount >= outlineTarget;
}

/**
 * How many questions the generator should return for the current depth.
 * Depth 0 → 3 (initial / regenerate); depth ≥ 1 → 2 (follow-ups).
 */
export function questionsNeededForRound(depth: number): number {
  const d = Math.max(0, Math.floor(Number(depth) || 0));
  return d === 0
    ? RABBIT_HOLE_INITIAL_QUESTION_COUNT
    : RABBIT_HOLE_FOLLOWUP_QUESTION_COUNT;
}

/**
 * Create a fresh process state. Questions arrive via `receiveQuestions`.
 */
export function createRabbitHoleExpandState(
  outlineTarget: number,
): RabbitHoleExpandState {
  const target = clampOutline(outlineTarget);
  return {
    outlineTarget: target,
    depth: 0,
    candidates: [],
    currentQuestions: [],
    phase: target <= 0 ? "complete" : "choosing",
    canRegenerate: target > 0,
    remaining: target,
  };
}

/**
 * Apply a generated question set for the current round.
 * Does not change depth or candidates. Completing phases ignore new questions.
 */
export function receiveQuestions(
  state: RabbitHoleExpandState,
  questions: readonly string[],
): RabbitHoleExpandState {
  if (state.phase === "complete") return state;
  const need = questionsNeededForRound(state.depth);
  const cleaned = (questions || [])
    .map((q) => String(q ?? "").trim())
    .filter(Boolean)
    .slice(0, need);
  return {
    ...state,
    currentQuestions: cleaned,
    canRegenerate: state.depth === 0,
  };
}

/**
 * Pick a question by index. Adds it as a candidate, advances depth,
 * clears current questions (caller loads the next set unless complete).
 */
export function pickQuestion(
  state: RabbitHoleExpandState,
  questionIndex: number,
): RabbitHoleExpandState {
  if (state.phase === "complete") return state;
  const idx = Math.floor(Number(questionIndex));
  if (
    !Number.isFinite(idx) ||
    idx < 0 ||
    idx >= state.currentQuestions.length
  ) {
    return state;
  }
  const picked = String(state.currentQuestions[idx] ?? "").trim();
  if (!picked) return state;

  const candidates = [...state.candidates, picked];
  const depth = state.depth + 1;
  const remaining = remainingFor(state.outlineTarget, candidates.length);
  const complete = isComplete(state.outlineTarget, candidates.length);

  return {
    outlineTarget: state.outlineTarget,
    depth,
    candidates,
    currentQuestions: [],
    phase: complete ? "complete" : "choosing",
    canRegenerate: false,
    remaining,
  };
}

/**
 * Restart from the top: clear picks/depth; keep outline target.
 * Caller must re-fetch the initial 3 questions.
 */
export function restartRabbitHoleExpand(
  state: RabbitHoleExpandState,
): RabbitHoleExpandState {
  return createRabbitHoleExpandState(state.outlineTarget);
}

/**
 * Stop mid-dive and skip to the summary/review step with the candidates
 * collected so far. Requires at least one pick; no-op otherwise or if already complete.
 * Remaining stays based on outline (may be > 0 when finishing early).
 */
export function finishRabbitHoleExpandEarly(
  state: RabbitHoleExpandState,
): RabbitHoleExpandState {
  if (state.phase === "complete") return state;
  if (state.candidates.length === 0) return state;
  return {
    ...state,
    currentQuestions: [],
    phase: "complete",
    canRegenerate: false,
    remaining: remainingFor(state.outlineTarget, state.candidates.length),
  };
}

/** Whether the user can stop and jump to review (has ≥1 candidate, still choosing). */
export function canFinishRabbitHoleExpandEarly(
  state: RabbitHoleExpandState,
): boolean {
  return state.phase === "choosing" && state.candidates.length > 0;
}

/**
 * Build summary selection state when the process is complete.
 */
export function createSummaryState(
  candidates: readonly string[],
): RabbitHoleExpandSummaryState {
  const list = (candidates || [])
    .map((c) => String(c ?? "").trim())
    .filter(Boolean);
  return {
    candidates: list,
    selected: list.map(() => true),
  };
}

/**
 * Toggle a candidate in the summary modify-selection UI.
 */
export function toggleSummaryCandidate(
  summary: RabbitHoleExpandSummaryState,
  index: number,
): RabbitHoleExpandSummaryState {
  const idx = Math.floor(Number(index));
  if (
    !Number.isFinite(idx) ||
    idx < 0 ||
    idx >= summary.candidates.length
  ) {
    return summary;
  }
  const selected = summary.selected.slice();
  selected[idx] = !selected[idx];
  return { candidates: summary.candidates, selected };
}

/**
 * Ordered confirmed candidates after summary modify-selection.
 */
export function getConfirmedCandidates(
  summary: RabbitHoleExpandSummaryState,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < summary.candidates.length; i++) {
    if (summary.selected[i]) out.push(summary.candidates[i]);
  }
  return out;
}

/**
 * Map confirmed rabbit-hole candidates 1:1 onto frozen expand slots.
 * Uses the first min(candidates, slots) pairs; extra candidates/slots dropped.
 */
export function mapCandidatesToFrozenSlots(input: {
  candidates: readonly string[];
  frozenSlots: readonly AddExpandCell[];
}): Array<{ slot: AddExpandCell; candidate: string }> {
  const slots = input.frozenSlots || [];
  const candidates = (input.candidates || [])
    .map((c) => String(c ?? "").trim())
    .filter(Boolean);
  const n = Math.min(slots.length, candidates.length);
  const out: Array<{ slot: AddExpandCell; candidate: string }> = [];
  for (let i = 0; i < n; i++) {
    out.push({
      slot: { row: slots[i].row, col: slots[i].col },
      candidate: candidates[i],
    });
  }
  return out;
}

/**
 * Per-slot prompt when expanding from rabbit-hole candidates.
 */
export function buildRabbitHoleExpandSlotPrompt(input: {
  source: ExpandSourceIdentity;
  candidate: string;
  slot: AddExpandCell;
  slotIndex: number;
  totalSlots: number;
}): string {
  const title = String(input.source?.title ?? "").trim() || "Untitled block";
  const description = String(input.source?.description ?? "").trim();
  const planning = String(input.source?.planning_prompt ?? "").trim();
  const candidate = String(input.candidate ?? "").trim();
  const i = Math.max(0, Math.floor(Number(input.slotIndex) || 0));
  const total = Math.max(1, Math.floor(Number(input.totalSlots) || 1));
  const { row, col } = input.slot;

  const parts = [
    `Create a neighboring 1×1 learning block from a rabbit-hole exploration of the source block.`,
    `Source block title: "${title}"`,
  ];
  if (description) {
    parts.push(`Source block description: ${description}`);
  }
  if (planning) {
    parts.push(`Source planning / teaching notes: ${planning}`);
  }
  parts.push(`Rabbit-hole expansion question / topic: "${candidate}"`);
  parts.push(
    `The new block should teach or explore the subject of this question as a distinct neighbor of the source — same overall theme, different subtopic. Do not duplicate the source title.`,
  );
  if (total <= 1) {
    parts.push(`Place one neighboring block at row ${row}, col ${col}.`);
  } else {
    parts.push(
      `(Place a distinct neighboring 1×1 block ${i + 1} of ${total} at row ${row}, col ${col}.)`,
    );
  }
  return parts.join("\n");
}

// ── Question-generation prompt boundary (pure; AI I/O stays in the API) ──

export function buildRabbitHoleQuestionsSystemMessage(count: number): string {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  return `You generate rabbit-hole style learning questions for expanding a curriculum block.
Return ONLY JSON: { "questions": [ "...", ... ] } with exactly ${n} distinct questions.
Rules:
- Each item is a single inquisitive question (not an answer, not a lecture).
- Questions should dig deeper into the seed topic and the path of prior picks.
- Concrete, curriculum-ready, 8–22 words each.
- No numbering, no markdown, no product jargon.
- Do not repeat prior path questions.`;
}

export function buildRabbitHoleQuestionsUserPrompt(input: {
  seedTitle?: string | null;
  seedDescription?: string | null;
  path?: readonly string[];
  count: number;
}): string {
  const n = Math.max(1, Math.floor(Number(input.count) || 1));
  const title = String(input.seedTitle ?? "").trim() || "Untitled block";
  const description = String(input.seedDescription ?? "").trim();
  const path = (input.path || [])
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  const lines = [
    `Seed block title: "${title}"`,
    description ? `Seed block description: ${description}` : null,
    path.length > 0
      ? `Path of picked questions so far (deepest last):\n${path.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : `Path: (none yet — generate the initial set of open exploration questions on the seed topic)`,
    `Generate exactly ${n} ${path.length === 0 ? "opening" : "follow-up"} question(s).`,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Normalize raw AI / stub output into exactly `count` non-empty question strings.
 */
export function normalizeRabbitHoleQuestions(
  raw: unknown,
  count: number,
): string[] {
  const need = Math.max(1, Math.floor(Number(count) || 1));
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object" && Array.isArray((raw as { questions?: unknown }).questions)) {
    list = (raw as { questions: unknown[] }).questions;
  } else if (typeof raw === "string" && raw.trim()) {
    list = raw
      .split(/\n+/)
      .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const q =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object" && "question" in (item as object)
          ? String((item as { question?: unknown }).question ?? "").trim()
          : "";
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    if (out.length >= need) break;
  }
  // Pad with distinct fallbacks if AI returned fewer than needed (keeps process unblocked).
  let pad = 1;
  while (out.length < need) {
    const fallback = `What deeper aspect of this topic should we explore next (${pad})?`;
    if (!seen.has(fallback.toLowerCase())) {
      out.push(fallback);
      seen.add(fallback.toLowerCase());
    }
    pad += 1;
  }
  return out.slice(0, need);
}
