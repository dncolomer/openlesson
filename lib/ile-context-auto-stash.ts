/**
 * ILE context-capacity auto-stash apply path.
 * SessionHeliosPanel calls this when the forming-thought bar is full.
 * Distinct from TAP silence auto-stash (purity unchanged).
 */
import {
  applyIleProjectThoughtMutation,
  emptyIleProjectDualLists,
  isIleChapterThoughtsLocked,
  normalizeIleSessionMode,
  type ExerciseDualLists,
  type ExerciseThought,
  type IleSessionMode,
} from "@/lib/ile-mode";
import {
  shouldAutoStashOnContextFull,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";

export const ILE_THOUGHT_CHAIN_GAP_MS = 2600;

export type IleThoughtMemoryRecord = {
  id: string;
  text: string;
  timestamp: number;
  chainId: string;
};

export type IleContextAutoStashDestination = "thought-memory" | "project-dual-stash";

export type IleContextAutoStashResult = {
  didStash: boolean;
  formingText: string;
  destination: IleContextAutoStashDestination | null;
  thought: IleThoughtMemoryRecord | null;
  thoughtMemory: IleThoughtMemoryRecord[];
  projectLists: ExerciseDualLists;
};

export function normalizeIleFormingText(text: string | null | undefined): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function buildIleThoughtMemoryRecord(
  text: string,
  currentThoughts: IleThoughtMemoryRecord[] = [],
  nowMs: number = Date.now(),
): IleThoughtMemoryRecord | null {
  const clean = normalizeIleFormingText(text);
  if (!clean) return null;
  const last = currentThoughts[currentThoughts.length - 1];
  const chainId =
    last && nowMs - last.timestamp <= ILE_THOUGHT_CHAIN_GAP_MS
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
 * Persist forming text when the ILE context bar is at capacity.
 * Learning → thought-memory list. Project → dual-stack stash.
 * Always clears forming text on success. Locked Project chapters are a no-op.
 */
export function applyIleContextFullAutoStash(input: {
  formingText: string;
  sessionMode?: IleSessionMode | string | null;
  chapterStatus?: string | null;
  thoughtMemory?: IleThoughtMemoryRecord[];
  projectLists?: ExerciseDualLists;
  nowMs?: number;
}): IleContextAutoStashResult {
  const mode = normalizeIleSessionMode(input.sessionMode);
  const memory = input.thoughtMemory ?? [];
  const lists = input.projectLists ?? emptyIleProjectDualLists();
  const ratio = thoughtContextFillRatio(input.formingText);
  const clean = normalizeIleFormingText(input.formingText);

  const empty: IleContextAutoStashResult = {
    didStash: false,
    formingText: String(input.formingText || ""),
    destination: null,
    thought: null,
    thoughtMemory: memory,
    projectLists: lists,
  };

  if (!shouldAutoStashOnContextFull(ratio) || !clean) return empty;
  if (mode === "project" && isIleChapterThoughtsLocked(input.chapterStatus)) {
    return empty;
  }

  if (mode === "project") {
    const mutated = applyIleProjectThoughtMutation(lists, input.chapterStatus, {
      type: "stash",
      text: clean,
      nowMs: input.nowMs,
    });
    if (mutated.rejected || !mutated.thought) return empty;
    const thought = exerciseThoughtToMemoryRecord(mutated.thought);
    return {
      didStash: true,
      formingText: "",
      destination: "project-dual-stash",
      thought,
      thoughtMemory: memory,
      projectLists: mutated.lists,
    };
  }

  const record = buildIleThoughtMemoryRecord(clean, memory, input.nowMs);
  if (!record) return empty;
  return {
    didStash: true,
    formingText: "",
    destination: "thought-memory",
    thought: record,
    thoughtMemory: [...memory, record],
    projectLists: lists,
  };
}

function exerciseThoughtToMemoryRecord(thought: ExerciseThought): IleThoughtMemoryRecord {
  return {
    id: thought.id,
    text: thought.text,
    timestamp: thought.timestamp,
    chainId: thought.chainId,
  };
}
