/**
 * Session-level ILE turn close: run I'm-done-answering collect/send/flag
 * once per currently open Work. Chapter widgets do not mount this control.
 */
import {
  closeIleImDoneAnswering,
  type IleEndOfChainOfThoughtEvent,
  type IleImDoneAnsweringThought,
} from "@/lib/ile-im-done-answering";
import {
  ILE_END_TURN_LABEL,
  ILE_SUBMIT_TURN_LABEL,
  normalizeIleOpenWorkId,
} from "@/lib/ile-pow-spend";

export { ILE_END_TURN_LABEL, ILE_SUBMIT_TURN_LABEL };

/** Fallback Helios send for an open Work that had no stashed thoughts this turn. */
export const ILE_SUBMIT_WORK_CONTINUE_TEXT =
  "I've submitted this turn of work. Continue coaching from here.";

export type IleWorkChatStep = {
  id?: string | null;
  description?: string | null;
};

/** Route a turn-close send onto the Work's chapter, not whatever is focused. */
export function resolveIleWorkChatTarget(input: {
  chapterId?: string | null;
  steps?: readonly IleWorkChatStep[] | null;
  fallbackIndex?: number | null;
  fallbackId?: string | null;
  fallbackDescription?: string | null;
}): {
  chapterId: string;
  stepIndex: number;
  description: string;
} {
  const steps = input.steps ?? [];
  const wanted = normalizeIleOpenWorkId(input.chapterId);
  const fallbackId = normalizeIleOpenWorkId(input.fallbackId);
  const fallbackIndex = Math.max(0, Math.floor(Number(input.fallbackIndex) || 0));
  let stepIndex = wanted
    ? steps.findIndex((step) => normalizeIleOpenWorkId(step.id) === wanted)
    : -1;
  if (stepIndex < 0 && fallbackId) {
    stepIndex = steps.findIndex((step) => normalizeIleOpenWorkId(step.id) === fallbackId);
  }
  if (stepIndex < 0) stepIndex = Math.min(fallbackIndex, Math.max(0, steps.length - 1));
  const step = steps[stepIndex];
  return {
    chapterId: normalizeIleOpenWorkId(step?.id) || wanted || fallbackId,
    stepIndex: Number.isFinite(stepIndex) && stepIndex >= 0 ? stepIndex : 0,
    description: String(step?.description || input.fallbackDescription || "").trim(),
  };
}

export type IleOpenWorkTurnSlice<T extends IleImDoneAnsweringThought> = {
  chapterId: string;
  thoughts: readonly T[] | null | undefined;
  formingText?: string | null;
};

export type IleOpenWorkTurnResult<T extends IleImDoneAnsweringThought> = {
  chapterId: string;
  submitted: boolean;
  ids: string[];
  text: string;
  thoughts: T[];
};

export function partitionIleThoughtsByOpenWork<
  T extends IleImDoneAnsweringThought & { chapterId?: string | null },
>(input: {
  thoughts: readonly T[] | null | undefined;
  openWorkIds: readonly string[] | null | undefined;
  focusedChapterId?: string | null;
}): IleOpenWorkTurnSlice<T>[] {
  const openWorkIds = (input.openWorkIds ?? [])
    .map(normalizeIleOpenWorkId)
    .filter(Boolean);
  if (openWorkIds.length === 0) return [];
  const focused =
    normalizeIleOpenWorkId(input.focusedChapterId) || openWorkIds[0];
  const buckets = new Map<string, T[]>();
  for (const id of openWorkIds) buckets.set(id, []);
  for (const thought of input.thoughts ?? []) {
    if (!thought?.id) continue;
    const tagged = normalizeIleOpenWorkId(thought.chapterId);
    const target = tagged && buckets.has(tagged) ? tagged : focused;
    buckets.get(target)!.push(thought);
  }
  return openWorkIds.map((chapterId) => ({
    chapterId,
    thoughts: buckets.get(chapterId) ?? [],
    formingText: chapterId === focused ? undefined : "",
  }));
}

export async function closeIleOpenWorkTurn<T extends IleImDoneAnsweringThought>(input: {
  works: readonly IleOpenWorkTurnSlice<T>[];
  flaggedIds?: ReadonlySet<string> | readonly string[] | null;
  formingText?: string | null;
  focusedChapterId?: string | null;
  sendThought: (text: string, thoughtIds: string[], chapterId: string) => void | Promise<void>;
  logEndOfChainOfThought: (event: IleEndOfChainOfThoughtEvent) => void;
  onClearForming?: () => void;
}): Promise<{
  submitted: boolean;
  results: IleOpenWorkTurnResult<T>[];
  flaggedIds: Set<string>;
  ids: string[];
}> {
  const focused = normalizeIleOpenWorkId(input.focusedChapterId);
  let flaggedIds = new Set(
    input.flaggedIds instanceof Set
      ? input.flaggedIds
      : input.flaggedIds ?? [],
  );
  const results: IleOpenWorkTurnResult<T>[] = [];
  let formingCleared = false;

  for (const work of input.works) {
    const chapterId = normalizeIleOpenWorkId(work.chapterId);
    if (!chapterId) continue;
    const formingText =
      work.formingText !== undefined
        ? work.formingText
        : chapterId === focused || (!focused && results.length === 0)
          ? input.formingText
          : "";
    const close = await closeIleImDoneAnswering({
      thoughts: work.thoughts,
      flaggedIds,
      formingText,
      sendThought: (text, thoughtIds) => input.sendThought(text, thoughtIds, chapterId),
      logEndOfChainOfThought: input.logEndOfChainOfThought,
      onClearForming: () => {
        if (formingCleared) return;
        formingCleared = true;
        input.onClearForming?.();
      },
    });
    flaggedIds = close.flaggedIds;
    results.push({
      chapterId,
      submitted: close.submitted,
      ids: close.ids,
      text: close.text,
      thoughts: (work.thoughts ?? []).filter((row) => close.ids.includes(row.id)) as T[],
    });
  }

  return {
    submitted: results.some((row) => row.submitted),
    results,
    flaggedIds,
    ids: results.flatMap((row) => row.ids),
  };
}
