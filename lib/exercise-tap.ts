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
  /** Optional pre-built context (avoids re-assembly). */
  promptContext?: PromptWorkspaceContextInput | null;
};

/**
 * Resolve the exercise prompt after intro start.
 * Prefer topic opening (seeded from topic cards), then server openingQuestion,
 * then structural block/workspace framing. Always returns solo exercise text.
 */
export function resolveExercisePromptAfterIntro(
  input: BuildExercisePromptInput & {
    topicOpeningQuestion?: string | null;
    serverOpeningQuestion?: string | null;
  },
): string {
  const topic = normalize(String(input.topicOpeningQuestion || ""));
  if (topic) {
    return buildExercisePromptText({
      ...input,
      exerciseText: topic,
    });
  }
  const server = normalize(String(input.serverOpeningQuestion || ""));
  if (server) {
    // Keep only clean, substantive framed prompts. Thin "Work through \"Title\"" and
    // out-loud legacy frames always go through the domain framer (may use description/files).
    if (
      isAlreadyFramedExercisePrompt(server) &&
      !containsOutLoudStageDirection(server) &&
      !isThinWorkThroughTitleFrame(server)
    ) {
      return server;
    }
    return buildExercisePromptText({
      ...input,
      exerciseText: server,
    });
  }
  return buildExercisePromptText(input);
}

function ensureExercisePrefix(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  if (/^exercise\s*:/i.test(clean)) return clean;
  return `Exercise: ${clean}`;
}

/**
 * Build a concrete domain exercise from context substance (description, notes, files).
 * No "out loud" / think-aloud stage directions.
 */
export function buildExercisePromptText(input: BuildExercisePromptInput): string {
  const ctx = assemblePromptWorkspaceContext({
    workspaceTitle: input.workspaceTitle,
    rootTopic: input.rootTopic,
    workspaceGoal: input.workspaceGoal,
    workspaceDescription: input.workspaceDescription,
    notes: input.notes,
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
    chapterDescription: input.chapterDescription,
    files: input.files,
    ...(input.promptContext || {}),
  });

  const explicitRaw = normalize(String(input.exerciseText || input.openingQuestion || ""));
  let explicit = explicitRaw;
  if (explicit && containsOutLoudStageDirection(explicit)) {
    explicit = stripOutLoudStageDirections(explicit);
  }
  if (explicit && looksLikeConversationalOpening(explicit)) {
    explicit = "";
  }

  // Already a clean framed exercise → keep (idempotent), unless it is only a thin
  // "Work through \"Title\"" wrapper and we have richer domain substance to use.
  if (
    explicit &&
    isAlreadyFramedExercisePrompt(explicit) &&
    !containsOutLoudStageDirection(explicit) &&
    !(ctx.hasDomainSubstance && isThinWorkThroughTitleFrame(explicit))
  ) {
    return explicit.startsWith("Exercise:") || /^exercise\s*:/i.test(explicit)
      ? explicit
      : ensureExercisePrefix(explicit);
  }

  const topicLabel =
    ctx.blockTitle ||
    ctx.workspaceTitle ||
    ctx.rootTopic ||
    "this material";

  // Rich substance: turn description / files into a concrete task.
  // Preferred over stripped legacy Work-through title frames.
  if (ctx.hasDomainSubstance) {
    const substance =
      ctx.blockDescription ||
      ctx.chapterDescription ||
      ctx.workspaceGoal ||
      ctx.workspaceDescription ||
      ctx.domainSubstanceSummary;
    const fileCue =
      ctx.fileNames.length > 0
        ? ` Use the workspace materials (${ctx.fileNames.slice(0, 3).join(", ")}${ctx.fileNames.length > 3 ? ", …" : ""}) where relevant.`
        : "";
    if (substance) {
      // If substance already reads like a task/instruction, frame lightly.
      if (
        /^(design|implement|debug|compare|explain|derive|prove|build|analyze|write|calculate|model)\b/i.test(
          substance,
        )
      ) {
        return ensureExercisePrefix(`${substance}${fileCue}`);
      }
      return ensureExercisePrefix(
        `Using what you know about "${topicLabel}", complete this task: ${substance}${fileCue} State assumptions, work the solution, and note where you are uncertain.`,
      );
    }
  }

  // Explicit domain free text (non-conversational) → task framing without stage directions.
  if (explicit) {
    const cleaned = stripOutLoudStageDirections(explicit);
    if (cleaned) {
      if (isAlreadyFramedExercisePrompt(cleaned) || /^exercise\s*:/i.test(cleaned)) {
        return ensureExercisePrefix(cleaned.replace(/^exercise\s*:\s*/i, ""));
      }
      return ensureExercisePrefix(
        `Complete this task about "${topicLabel}": ${cleaned} Show your reasoning and the result.`,
      );
    }
  }

  // Title-only thin context — still a knowledge task, never out-loud stage direction.
  if (ctx.blockTitle) {
    return ensureExercisePrefix(
      `Demonstrate your understanding of "${ctx.blockTitle}": define the core idea, give one concrete example or application, and call out a common mistake or edge case.`,
    );
  }

  return ensureExercisePrefix(
    `Demonstrate your understanding of "${topicLabel}": explain the key idea, how the pieces fit together, and one place the idea is easy to misuse.`,
  );
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
