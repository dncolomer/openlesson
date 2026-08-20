/**
 * ILE session mode: Learning Mode (default Helios dialogue) vs Project Mode
 * (Exercise-TAP-style solo exercises per chapter, dual-stack Thoughts, no bubbles).
 *
 * Dual-list stash ↔ solution mutations reuse Exercise TAP helpers so both products
 * share System 1 / System 2 semantics.
 */
import {
  buildExercisePromptText,
  demoteExerciseSubmissionToStash,
  emptyExerciseDualLists,
  isAlreadyFramedExercisePrompt,
  promoteExerciseStashToSubmission,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
  type ExerciseDualLists,
  type ExerciseThought,
} from "@/lib/exercise-tap";

export type { ExerciseDualLists, ExerciseThought };

/** Named ILE modes — independent of TAP interaction_kind. */
export const ILE_SESSION_MODES = ["learning", "project"] as const;

export type IleSessionMode = (typeof ILE_SESSION_MODES)[number];

export const ILE_SESSION_MODE_DEFAULT: IleSessionMode = "learning";

/** Shell path keys for SessionView branching (not Next routes). */
export type IleShellKind = "learning" | "project";

export const ILE_SESSION_MODE_LABELS: Record<IleSessionMode, string> = {
  learning: "Learning Mode",
  project: "Explore Solo",
};

/**
 * Normalize ILE session mode. Missing / legacy / invalid → Learning Mode.
 * Accepts project aliases (exercise, solo) and learning aliases (conversational, dialogue).
 */
export function parseIleSessionModeWrite(value: unknown): IleSessionMode | null {
  if (value === "learning" || value === "project") return value;
  return null;
}

export function normalizeIleSessionMode(
  value: unknown,
  fallback: IleSessionMode = ILE_SESSION_MODE_DEFAULT,
  opts?: { write?: boolean },
): IleSessionMode {
  if (opts?.write) {
    return parseIleSessionModeWrite(value) ?? fallback;
  }
  if (value === true || value === 1) return "project";
  if (value === false || value === 0) return "learning";
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (
      raw === "project" ||
      raw === "exercise" ||
      raw === "solo" ||
      raw === "prompt" ||
      raw === "project_mode" ||
      raw === "project-mode"
    ) {
      return "project";
    }
    if (
      raw === "learning" ||
      raw === "learn" ||
      raw === "conversational" ||
      raw === "dialogue" ||
      raw === "chat" ||
      raw === "conversation" ||
      raw === "learning_mode" ||
      raw === "learning-mode"
    ) {
      return "learning";
    }
    if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") return "project";
    if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return "learning";
  }
  return fallback;
}

/** Resolve mode from create-body keys (snake/camel + project checkbox + TAP-style aliases). */
export function resolveIleSessionModeFromBody(
  body: Record<string, unknown> | null | undefined,
  opts?: { write?: boolean },
): IleSessionMode {
  if (!body || typeof body !== "object") return ILE_SESSION_MODE_DEFAULT;
  const record = body as Record<string, unknown>;
  if (opts?.write) {
    const raw = record.session_mode ?? record.sessionMode;
    return parseIleSessionModeWrite(raw) ?? ILE_SESSION_MODE_DEFAULT;
  }
  if ("session_mode" in record) return normalizeIleSessionMode(record.session_mode);
  if ("sessionMode" in record) return normalizeIleSessionMode(record.sessionMode);
  if ("ile_mode" in record) return normalizeIleSessionMode(record.ile_mode);
  if ("ileMode" in record) return normalizeIleSessionMode(record.ileMode);
  if ("project_mode" in record) return normalizeIleSessionMode(record.project_mode);
  if ("projectMode" in record) return normalizeIleSessionMode(record.projectMode);
  if ("project" in record) return normalizeIleSessionMode(record.project);
  if ("is_project" in record) return normalizeIleSessionMode(record.is_project);
  if ("isProject" in record) return normalizeIleSessionMode(record.isProject);
  // TAP-style create keys map exercise → Project Mode for API convenience.
  if ("interaction_kind" in record) return normalizeIleSessionMode(record.interaction_kind);
  if ("interactionKind" in record) return normalizeIleSessionMode(record.interactionKind);
  if ("exercise" in record) return normalizeIleSessionMode(record.exercise);
  if ("is_exercise" in record) return normalizeIleSessionMode(record.is_exercise);
  if ("isExercise" in record) return normalizeIleSessionMode(record.isExercise);
  return ILE_SESSION_MODE_DEFAULT;
}

/**
 * Resolve mode from link row, session metadata, or explicit props.
 * Missing / legacy → Learning Mode.
 */
export function resolveIleSessionModeFromSession(input: {
  session_mode?: unknown;
  sessionMode?: unknown;
  ile_session_mode?: unknown;
  ileSessionMode?: unknown;
  interaction_kind?: unknown;
  interactionKind?: unknown;
  metadata?: {
    session_mode?: unknown;
    ile_session_mode?: unknown;
    sessionMode?: unknown;
    ileSessionMode?: unknown;
  } | null;
  initialSession?: {
    session_mode?: unknown;
    sessionMode?: unknown;
    interaction_kind?: unknown;
    interactionKind?: unknown;
    metadata?: {
      session_mode?: unknown;
      ile_session_mode?: unknown;
    } | null;
  } | null;
  ileLink?: {
    session_mode?: unknown;
    sessionMode?: unknown;
  } | null;
}): IleSessionMode {
  const fromMeta =
    input.metadata?.session_mode ??
    input.metadata?.ile_session_mode ??
    input.metadata?.sessionMode ??
    input.metadata?.ileSessionMode ??
    input.initialSession?.metadata?.session_mode ??
    input.initialSession?.metadata?.ile_session_mode;
  if (fromMeta !== undefined && fromMeta !== null && fromMeta !== "") {
    return normalizeIleSessionMode(fromMeta);
  }
  const fromLink =
    input.ileLink?.session_mode ??
    input.ileLink?.sessionMode ??
    input.session_mode ??
    input.sessionMode ??
    input.ile_session_mode ??
    input.ileSessionMode ??
    input.initialSession?.session_mode ??
    input.initialSession?.sessionMode;
  if (fromLink !== undefined && fromLink !== null && fromLink !== "") {
    return normalizeIleSessionMode(fromLink);
  }
  const fromKind =
    input.interaction_kind ??
    input.interactionKind ??
    input.initialSession?.interaction_kind ??
    input.initialSession?.interactionKind;
  if (fromKind !== undefined && fromKind !== null && fromKind !== "") {
    return normalizeIleSessionMode(fromKind);
  }
  return ILE_SESSION_MODE_DEFAULT;
}

export function isIleProjectMode(mode: unknown): boolean {
  return normalizeIleSessionMode(mode) === "project";
}

export function resolveIleShellFromSession(
  input: Parameters<typeof resolveIleSessionModeFromSession>[0],
): IleShellKind {
  return resolveIleSessionModeFromSession(input);
}

/**
 * Durable Learning vs Project mode — same order as the ILE shell:
 * explicit link/prop wins, then session metadata / link row, else learning.
 */
export function resolveIleDurableSessionMode(input: {
  sessionModeProp?: unknown;
  metadata?: {
    session_mode?: unknown;
    ile_session_mode?: unknown;
    sessionMode?: unknown;
    ileSessionMode?: unknown;
  } | null;
  ileLink?: {
    session_mode?: unknown;
    sessionMode?: unknown;
  } | null;
}): IleSessionMode {
  if (
    input.sessionModeProp !== undefined &&
    input.sessionModeProp !== null &&
    input.sessionModeProp !== ""
  ) {
    return normalizeIleSessionMode(input.sessionModeProp);
  }
  return resolveIleSessionModeFromSession({
    metadata: input.metadata,
    ileLink: input.ileLink,
  });
}

/** Mark as Done / skipped is terminal for chapter thought mutations in Project Mode. */
export function isIleChapterThoughtsLocked(
  chapterStatus: string | null | undefined,
): boolean {
  return chapterStatus === "completed" || chapterStatus === "skipped";
}

export type IleProjectThoughtMutation =
  | { type: "stash"; text: string; nowMs?: number; auto?: boolean }
  | { type: "submit_direct"; text: string; nowMs?: number }
  | { type: "promote"; thoughtId: string }
  | { type: "demote"; thoughtId: string };

export type IleProjectThoughtMutationResult = {
  lists: ExerciseDualLists;
  thought: ExerciseThought | null;
  /** When set, mutation was a no-op. */
  rejected: false | "chapter_locked" | "invalid";
};

/**
 * Apply stash / solution dual-list mutation. When chapter is Done, all stash/solution
 * mutations are rejected (no-op). Done itself is handled separately and still emits PoW.
 */
export function applyIleProjectThoughtMutation(
  lists: ExerciseDualLists,
  chapterStatus: string | null | undefined,
  mutation: IleProjectThoughtMutation,
): IleProjectThoughtMutationResult {
  if (isIleChapterThoughtsLocked(chapterStatus)) {
    return { lists, thought: null, rejected: "chapter_locked" };
  }

  switch (mutation.type) {
    case "stash": {
      const result = stashExerciseSpeech(lists, mutation.text, mutation.nowMs);
      return {
        lists: result.lists,
        thought: result.added,
        rejected: result.added ? false : "invalid",
      };
    }
    case "submit_direct": {
      const result = submitExerciseSpeechDirect(lists, mutation.text, mutation.nowMs);
      return {
        lists: result.lists,
        thought: result.added,
        rejected: result.added ? false : "invalid",
      };
    }
    case "promote": {
      const result = promoteExerciseStashToSubmission(lists, mutation.thoughtId);
      return {
        lists: result.lists,
        thought: result.moved,
        rejected: result.moved ? false : "invalid",
      };
    }
    case "demote": {
      const result = demoteExerciseSubmissionToStash(lists, mutation.thoughtId);
      return {
        lists: result.lists,
        thought: result.moved,
        rejected: result.moved ? false : "invalid",
      };
    }
    default:
      return { lists, thought: null, rejected: "invalid" };
  }
}

export function emptyIleProjectDualLists(): ExerciseDualLists {
  return emptyExerciseDualLists();
}

/**
 * Frame a chapter description as a longer-horizon exercise for Project Mode.
 * Idempotent — already-framed exercise text is returned unchanged.
 */
export function frameIleProjectChapterDescription(description: string): string {
  const clean = String(description || "").replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  // Delegate to domain exercise framer so chapter text becomes a task, not stage directions.
  return buildExercisePromptText({
    chapterDescription: clean,
    exerciseText: clean,
  });
}

/**
 * Prompt shown for the active chapter exercise in Project Mode.
 * Prefer chapter plan text as the domain task; otherwise block/workspace context
 * (and optional file names/excerpts when the caller has them).
 */
export function buildIleProjectChapterExercisePrompt(input: {
  chapterDescription?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  notes?: string | null;
  files?: import("@/lib/prompt-workspace-context").WorkspaceFileContextItem[] | null;
  blocks?: import("@/lib/prompt-workspace-context").PromptBlockInventoryItem[] | null;
  focusedBlockId?: string | null;
  blockLocalContext?: import("@/lib/prompt-workspace-context").BlockLocalContextInput | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
}): string {
  const chapter = String(input.chapterDescription || "").trim();
  const shared = {
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
    workspaceTitle: input.workspaceTitle,
    workspaceGoal: input.workspaceGoal,
    notes: input.notes,
    files: input.files,
    blocks: input.blocks,
    focusedBlockId: input.focusedBlockId,
    blockLocalContext: input.blockLocalContext,
    unusableCells: input.unusableCells,
  };
  if (chapter) {
    return buildExercisePromptText({
      ...shared,
      chapterDescription: chapter,
      exerciseText: chapter,
    });
  }
  return buildExercisePromptText(shared);
}

/** Tool-event payload for chapter_done — PoW path, no eval fields. */
export function buildIleChapterDonePowToolData(input: {
  stepIndex: number;
  stepId: string;
  stepDescription?: string | null;
  via?: string;
  sessionMode?: IleSessionMode;
}): Record<string, unknown> {
  return {
    stepIndex: input.stepIndex,
    stepId: input.stepId,
    stepDescription: (input.stepDescription || "").slice(0, 120),
    via: input.via ?? "chapter_map_mark_done",
    session_mode: input.sessionMode ?? ILE_SESSION_MODE_DEFAULT,
    // Explicit absence of interface evaluation on Done (Project Mode contract).
    evaluation: null,
    score: null,
    interface_evaluation: false,
  };
}

/** Persist key for dual lists scoped to session + chapter. */
export function ileProjectThoughtsStorageKey(sessionId: string, chapterId: string): string {
  return `uncertain-systems:${sessionId}:project-thoughts:${chapterId}`;
}

export function serializeIleProjectThoughts(lists: ExerciseDualLists): string {
  return JSON.stringify(lists);
}

export function parseIleProjectThoughtsStored(
  raw: string | null | undefined,
): ExerciseDualLists | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ExerciseDualLists>;
    if (!parsed || !Array.isArray(parsed.stash) || !Array.isArray(parsed.submitted)) {
      return null;
    }
    return {
      stash: parsed.stash,
      submitted: parsed.submitted,
    };
  } catch {
    return null;
  }
}
