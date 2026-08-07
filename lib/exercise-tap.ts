/**
 * Pure helpers for Exercise TAP — solo prompt + submitted thoughts (no Helios dialogue).
 * Interaction kind persistence lives in tap-link-config; this module owns exercise UX logic.
 *
 * Exercise text is a genuine domain task grounded in block/workspace/file context —
 * never "say this out loud" stage directions.
 */
import {
  normalizeTapInteractionKind,
  TAP_INTERACTION_KIND_DEFAULT,
  type TapInteractionKind,
} from "@/lib/pow-api/tap-link-config";
import {
  buildTapThoughtTracePayload,
  type TapThoughtTracePayload,
} from "@/lib/tap-score-traces";
import { normalize } from "@/lib/tap-score-client-helpers";
import {
  assemblePromptWorkspaceContext,
  containsOutLoudStageDirection,
  stripOutLoudStageDirections,
  type BlockLocalContextInput,
  type PromptBlockInventoryItem,
  type PromptExternalResourceItem,
  type PromptWorkspaceContext,
  type PromptWorkspaceContextInput,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";
export type { TapInteractionKind };

export interface ExerciseSubmittedThought {
  id: string;
  text: string;
  timestamp: number;
  chainId: string;
}

export const EXERCISE_CHAIN_GAP_MS = 2600;

/** Shell path keys returned by the mode resolver (not Next routes). */
export type TapShellKind = "conversational" | "exercise";

/**
 * Pick conversational vs exercise shell from a session record or explicit kind.
 * Missing / legacy / invalid → conversational.
 */
export function resolveTapShellFromSession(input: {
  interaction_kind?: unknown;
  interactionKind?: unknown;
  initialSession?: {
    interaction_kind?: unknown;
    interactionKind?: unknown;
  } | null;
}): TapShellKind {
  const fromSession =
    input.initialSession?.interaction_kind ??
    input.initialSession?.interactionKind ??
    input.interaction_kind ??
    input.interactionKind;
  return normalizeTapInteractionKind(fromSession, TAP_INTERACTION_KIND_DEFAULT);
}

/** True when text is already a solo exercise frame (idempotent re-run safe). */
export function isAlreadyFramedExercisePrompt(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  // Legacy "out loud" frames count as framed so we can rewrite them once via strip path.
  return /^(exercise\s*:|task\s*:|solve(\s+this)?\s*:|work through\b|apply\b|debug\b|design\b)/i.test(
    t,
  );
}

/**
 * Thin title-wrapper templates ("Exercise: Work through \"Heaps\"…") that must not
 * short-circuit when block/chapter description, notes, or file excerpts exist.
 */
export function isThinWorkThroughTitleFrame(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return (
    /^exercise\s*:\s*work through\s+["“'][^"”']+["”']/i.test(t) ||
    /^work through\s+["“'][^"”']+["”']/i.test(t)
  );
}

/** Conversational TAP openings are not solo exercises (e.g. "Teach me…"). */
export function looksLikeConversationalOpening(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return /^(teach me\b|what did you learn|tell me about|how would you explain|walk me through what you learned)/i.test(
    t,
  );
}

export type BuildExercisePromptInput = {
  exerciseText?: string | null;
  openingQuestion?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  rootTopic?: string | null;
  chapterDescription?: string | null;
  files?: WorkspaceFileContextItem[] | null;
  /** External links — JIT URL bias when framing exercises. */
  externalResources?: PromptExternalResourceItem[] | null;
  /** Map inventory (roles/kinds + layout). Feeds TAP/ILE/TAPBench assembly. */
  blocks?: PromptBlockInventoryItem[] | null;
  focusedBlockId?: string | null;
  blockLocalContext?: BlockLocalContextInput | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
  /** Optional pre-built context (avoids re-assembly). Explicit fields above win when set. */
  promptContext?: PromptWorkspaceContextInput | null;
};

/**
 * Build the shared PromptWorkspaceContext for exercise/ILE framing.
 * Includes inventory, topology, and local block materials when provided.
 * Tests and LLM author paths should drive this helper — not re-implement merge.
 */
export function resolveExercisePromptContext(
  input: BuildExercisePromptInput,
): PromptWorkspaceContext {
  const base = input.promptContext || {};
  return assemblePromptWorkspaceContext({
    ...base,
    workspaceTitle: input.workspaceTitle ?? base.workspaceTitle,
    rootTopic: input.rootTopic ?? base.rootTopic,
    workspaceGoal: input.workspaceGoal ?? base.workspaceGoal,
    workspaceDescription: input.workspaceDescription ?? base.workspaceDescription,
    notes: input.notes ?? base.notes,
    blockTitle: input.blockTitle ?? base.blockTitle,
    blockDescription: input.blockDescription ?? base.blockDescription,
    chapterDescription: input.chapterDescription ?? base.chapterDescription,
    files: input.files ?? base.files,
    externalResources: input.externalResources ?? base.externalResources,
    blocks: input.blocks ?? base.blocks,
    focusedBlockId: input.focusedBlockId ?? base.focusedBlockId,
    blockLocalContext: input.blockLocalContext ?? base.blockLocalContext,
    unusableCells: input.unusableCells ?? base.unusableCells,
    extra: base.extra,
  });
}

/**
 * Resolve the exercise prompt after intro start.
 * Prefer topic opening, then server openingQuestion — **raw model/stored text only**.
 * Does not invent pure-template exercises when both are missing.
 */
export function resolveExercisePromptAfterIntro(
  input: BuildExercisePromptInput & {
    topicOpeningQuestion?: string | null;
    serverOpeningQuestion?: string | null;
  },
): string {
  const topic = normalize(String(input.topicOpeningQuestion || ""));
  if (topic) {
    return keepRawExerciseText(topic);
  }
  const server = normalize(String(input.serverOpeningQuestion || ""));
  if (server) {
    return keepRawExerciseText(server);
  }
  return "";
}

/** Keep model/stored exercise text; strip stage directions only — no pure reframe. */
function keepRawExerciseText(text: string): string {
  let t = normalize(text);
  if (!t) return "";
  if (containsOutLoudStageDirection(t)) {
    t = stripOutLoudStageDirections(t) || "";
  }
  if (!t) return "";
  if (looksLikeConversationalOpening(t)) return t;
  if (/^exercise\s*:/i.test(t) || isAlreadyFramedExercisePrompt(t)) {
    return ensureExercisePrefix(t.replace(/^exercise\s*:\s*/i, ""));
  }
  return ensureExercisePrefix(t);
}

function ensureExercisePrefix(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  if (/^exercise\s*:/i.test(clean)) return clean;
  return `Exercise: ${clean}`;
}

/**
 * Return explicit exercise text only (model/stored). Never invent pure shells
 * from block title/description. Empty string if no usable explicit text.
 */
export function buildExercisePromptText(input: BuildExercisePromptInput): string {
  const explicitRaw = normalize(String(input.exerciseText || input.openingQuestion || ""));
  return keepRawExerciseText(explicitRaw);
}

/** Alias used for both stash and submission lists. */
export type ExerciseThought = ExerciseSubmittedThought;

export interface ExerciseDualLists {
  stash: ExerciseThought[];
  submitted: ExerciseThought[];
}

export function emptyExerciseDualLists(): ExerciseDualLists {
  return { stash: [], submitted: [] };
}

export function buildExerciseThoughtRecord(
  text: string,
  current: ExerciseThought[],
  nowMs = Date.now(),
  chainGapMs = EXERCISE_CHAIN_GAP_MS,
): ExerciseThought | null {
  const clean = normalize(text);
  if (!clean) return null;
  const last = current[current.length - 1];
  const chainId =
    last && nowMs - last.timestamp <= chainGapMs
      ? last.chainId
      : `chain_${nowMs}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: `${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
    text: clean,
    timestamp: nowMs,
    chainId,
  };
}

/**
 * System 1: append spoken text to the stash history (Del / silence auto-stash).
 * Does not touch the submission stack.
 */
export function stashExerciseSpeech(
  lists: ExerciseDualLists,
  text: string,
  nowMs = Date.now(),
): { lists: ExerciseDualLists; added: ExerciseThought | null } {
  const added = buildExerciseThoughtRecord(text, lists.stash, nowMs);
  if (!added) return { lists, added: null };
  return { lists: { ...lists, stash: [...lists.stash, added] }, added };
}

/**
 * System 2: promote a stashed thought into the submission stack (leaves stash).
 */
export function promoteExerciseStashToSubmission(
  lists: ExerciseDualLists,
  thoughtId: string,
): { lists: ExerciseDualLists; moved: ExerciseThought | null } {
  const moved = lists.stash.find((t) => t.id === thoughtId) ?? null;
  if (!moved) return { lists, moved: null };
  return {
    lists: {
      stash: lists.stash.filter((t) => t.id !== thoughtId),
      submitted: [...lists.submitted, moved],
    },
    moved,
  };
}

/**
 * System 2: submit live speech directly onto the submission stack (Enter with live text).
 * Skips the stash surface — equivalent to conversational “send” without a prior Del.
 */
export function submitExerciseSpeechDirect(
  lists: ExerciseDualLists,
  text: string,
  nowMs = Date.now(),
): { lists: ExerciseDualLists; added: ExerciseThought | null } {
  const added = buildExerciseThoughtRecord(text, lists.submitted, nowMs);
  if (!added) return { lists, added: null };
  return { lists: { ...lists, submitted: [...lists.submitted, added] }, added };
}

/**
 * System 2 undo: demote a Solution Stack thought back into stash (does not discard).
 * Inverse of promoteExerciseStashToSubmission. Missing id → no-op.
 */
export function demoteExerciseSubmissionToStash(
  lists: ExerciseDualLists,
  thoughtId: string,
): { lists: ExerciseDualLists; moved: ExerciseThought | null } {
  const moved = lists.submitted.find((t) => t.id === thoughtId) ?? null;
  if (!moved) return { lists, moved: null };
  return {
    lists: {
      stash: [...lists.stash, moved],
      submitted: lists.submitted.filter((t) => t.id !== thoughtId),
    },
    moved,
  };
}

/**
 * Hard-remove from the Solution Stack only (no stash). Prefer demote for Undo UX.
 * Kept for rare discard paths / tests that need delete-only.
 */
export function removeExerciseSubmission(
  lists: ExerciseDualLists,
  thoughtId: string,
): { lists: ExerciseDualLists; removed: ExerciseThought | null } {
  const removed = lists.submitted.find((t) => t.id === thoughtId) ?? null;
  if (!removed) return { lists, removed: null };
  return {
    lists: {
      ...lists,
      submitted: lists.submitted.filter((t) => t.id !== thoughtId),
    },
    removed,
  };
}

/** @deprecated Prefer stashExerciseSpeech — kept for older call sites. */
export function submitExerciseThought(
  list: ExerciseThought[],
  text: string,
  nowMs = Date.now(),
): { list: ExerciseThought[]; added: ExerciseThought | null } {
  const dual = stashExerciseSpeech({ stash: list, submitted: [] }, text, nowMs);
  return { list: dual.lists.stash, added: dual.added };
}

/** @deprecated Prefer demoteExerciseSubmissionToStash for Undo. */
export function removeExerciseThought(
  list: ExerciseThought[],
  thoughtId: string,
): { list: ExerciseThought[]; removed: ExerciseThought | null } {
  const dual = removeExerciseSubmission({ stash: [], submitted: list }, thoughtId);
  return { list: dual.lists.submitted, removed: dual.removed };
}

/** System 1 stash trace (deliberate or auto). */
export function buildExerciseStashTracePayload(input: {
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  thought: ExerciseThought;
  auto?: boolean;
}): TapThoughtTracePayload {
  return buildTapThoughtTracePayload({
    traceType: "system1",
    action: input.auto ? "auto_stash" : "pause_finalize",
    tapSessionId: input.tapSessionId,
    workspaceId: input.workspaceId,
    blockId: input.blockId,
    focusSessionId: input.focusSessionId,
    thoughtId: input.thought.id,
    chainId: input.thought.chainId,
    text: input.thought.text,
    timestampMs: input.thought.timestamp,
  });
}

/** System 2 submit/promote onto the submission stack. */
export function buildExerciseSubmitTracePayload(input: {
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  thought: ExerciseThought;
}): TapThoughtTracePayload {
  return buildTapThoughtTracePayload({
    traceType: "system2",
    action: "send",
    tapSessionId: input.tapSessionId,
    workspaceId: input.workspaceId,
    blockId: input.blockId,
    focusSessionId: input.focusSessionId,
    thoughtId: input.thought.id,
    chainId: input.thought.chainId,
    text: input.thought.text,
    timestampMs: input.thought.timestamp,
  });
}

/** System 2 remove from submission stack (undo dimension). */
export function buildExerciseRemoveTracePayload(input: {
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  thought: ExerciseThought;
  timestampMs?: number;
}): TapThoughtTracePayload {
  return buildTapThoughtTracePayload({
    traceType: "system2",
    action: "remove",
    tapSessionId: input.tapSessionId,
    workspaceId: input.workspaceId,
    blockId: input.blockId,
    focusSessionId: input.focusSessionId,
    thoughtId: input.thought.id,
    chainId: input.thought.chainId,
    text: input.thought.text,
    timestampMs: input.timestampMs ?? Date.now(),
  });
}
