/**
 * Pure helpers for Exercise TAP — solo prompt + submitted thoughts (no Helios dialogue).
 * Interaction kind persistence lives in tap-link-config; this module owns exercise UX logic.
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
  return /^(exercise\s*:|solve(\s+this)?\s+out\s+loud\b|work through\b|think aloud through\b)/i.test(
    t,
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

/**
 * Resolve the exercise prompt after intro start.
 * Prefer topic opening (seeded from topic cards), then server openingQuestion,
 * then structural block/workspace framing. Always returns solo exercise text.
 */
export function resolveExercisePromptAfterIntro(input: {
  topicOpeningQuestion?: string | null;
  serverOpeningQuestion?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  workspaceTitle?: string | null;
}): string {
  const topic = normalize(String(input.topicOpeningQuestion || ""));
  if (topic) {
    return buildExercisePromptText({
      exerciseText: topic,
      blockTitle: input.blockTitle,
      blockDescription: input.blockDescription,
      workspaceTitle: input.workspaceTitle,
    });
  }
  const server = normalize(String(input.serverOpeningQuestion || ""));
  if (server) {
    // Server already frames exercise for interaction_kind=exercise; keep if framed.
    if (isAlreadyFramedExercisePrompt(server)) return server;
    return buildExercisePromptText({
      exerciseText: server,
      blockTitle: input.blockTitle,
      blockDescription: input.blockDescription,
      workspaceTitle: input.workspaceTitle,
    });
  }
  return buildExercisePromptText({
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
    workspaceTitle: input.workspaceTitle,
  });
}

/**
 * Build the single exercise prompt shown at the top of Exercise TAP.
 * Prefer true solo framing from block/workspace. Idempotent: already-framed
 * prompts are returned unchanged. Conversational openings ("Teach me…") are
 * not treated as exercise text — fall through to block/workspace framing.
 */
export function buildExercisePromptText(input: {
  exerciseText?: string | null;
  openingQuestion?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  workspaceTitle?: string | null;
}): string {
  const explicit = normalize(String(input.exerciseText || input.openingQuestion || ""));
  const blockTitle = normalize(String(input.blockTitle || ""));
  const blockDescription = normalize(String(input.blockDescription || ""));
  const workspaceTitle = normalize(String(input.workspaceTitle || "this workspace"));

  // Already framed → never re-prefix (client/server double-call safe).
  if (explicit && isAlreadyFramedExercisePrompt(explicit)) {
    return explicit;
  }

  // Prefer structural solo exercise when block is known, even if a conversational
  // opening was passed through by mistake.
  if (blockTitle) {
    const desc = blockDescription ? ` Context: ${blockDescription}` : "";
    return `Exercise: Work through "${blockTitle}" out loud on your own. Explain your reasoning as you go.${desc}`;
  }

  // Explicit non-conversational free text → prefix once.
  if (explicit && !looksLikeConversationalOpening(explicit)) {
    return `Solve this out loud: ${explicit}`;
  }

  // Workspace-level solo exercise (ignore leftover "Teach me…" dialogue text).
  return `Exercise: Think aloud through what you know about "${workspaceTitle}". Solve or explain the material out loud on your own — there is no dialogue partner.`;
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
