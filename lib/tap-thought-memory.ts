/**
 * TAP thought-memory: local per-thought edit/delete (no multi-select submit).
 * Edit/delete are System 2 PoW; speech keeps running while a thought is edited.
 */
import { normalize } from "@/lib/tap-score-client-helpers";
import type { ExerciseDualLists, ExerciseThought } from "@/lib/exercise-tap";

export const TAP_SEE_EDIT_PREVIOUS_THOUGHTS_LABEL = "See / Edit your previous thoughts";

export const TAP_IM_DONE_CONFIRM_TITLE = "Submit this answer?";
export const TAP_IM_DONE_CONFIRM_BODY =
  "Are you sure you're done answering? You can still edit or delete individual thoughts before submitting.";
export const TAP_IM_DONE_CONFIRM_CONFIRM = "I'm done answering";
export const TAP_IM_DONE_CONFIRM_CANCEL = "Keep thinking";

export type TapThoughtMemoryItem = {
  id: string;
  text: string;
};

/** Exercise TAP: a Done / submitted problem cannot be edited or deleted. */
export function isTapExerciseThoughtMemoryLocked(
  problem: { done?: boolean; solutionSubmitted?: boolean } | null | undefined,
): boolean {
  if (!problem) return false;
  return problem.done === true || problem.solutionSubmitted === true;
}

export function applyTapThoughtLocalEdit<T extends TapThoughtMemoryItem>(
  thoughts: readonly T[],
  thoughtId: string,
  nextText: string,
): { thoughts: T[]; previous: T | null; next: T | null } {
  const clean = normalize(nextText);
  if (!clean || !thoughtId) return { thoughts: [...thoughts], previous: null, next: null };
  const previous = thoughts.find((thought) => thought.id === thoughtId) ?? null;
  if (!previous) return { thoughts: [...thoughts], previous: null, next: null };
  const next = { ...previous, text: clean };
  return {
    thoughts: thoughts.map((thought) => (thought.id === thoughtId ? next : thought)),
    previous,
    next,
  };
}

export function applyTapThoughtLocalDelete<T extends { id: string }>(
  thoughts: readonly T[],
  thoughtId: string,
): { thoughts: T[]; removed: T | null } {
  if (!thoughtId) return { thoughts: [...thoughts], removed: null };
  const removed = thoughts.find((thought) => thought.id === thoughtId) ?? null;
  if (!removed) return { thoughts: [...thoughts], removed: null };
  return {
    thoughts: thoughts.filter((thought) => thought.id !== thoughtId),
    removed,
  };
}

export function applyTapExerciseThoughtEdit(
  lists: ExerciseDualLists,
  thoughtId: string,
  nextText: string,
): { lists: ExerciseDualLists; previous: ExerciseThought | null; next: ExerciseThought | null } {
  const stashEdit = applyTapThoughtLocalEdit(lists.stash, thoughtId, nextText);
  if (stashEdit.next) {
    return { lists: { ...lists, stash: stashEdit.thoughts }, previous: stashEdit.previous, next: stashEdit.next };
  }
  const submittedEdit = applyTapThoughtLocalEdit(lists.submitted, thoughtId, nextText);
  if (submittedEdit.next) {
    return {
      lists: { ...lists, submitted: submittedEdit.thoughts },
      previous: submittedEdit.previous,
      next: submittedEdit.next,
    };
  }
  return { lists, previous: null, next: null };
}

export function applyTapExerciseThoughtDelete(
  lists: ExerciseDualLists,
  thoughtId: string,
): { lists: ExerciseDualLists; removed: ExerciseThought | null } {
  const stashDelete = applyTapThoughtLocalDelete(lists.stash, thoughtId);
  if (stashDelete.removed) {
    return { lists: { ...lists, stash: stashDelete.thoughts }, removed: stashDelete.removed };
  }
  const submittedDelete = applyTapThoughtLocalDelete(lists.submitted, thoughtId);
  if (submittedDelete.removed) {
    return { lists: { ...lists, submitted: submittedDelete.thoughts }, removed: submittedDelete.removed };
  }
  return { lists, removed: null };
}

export function composeTapThoughtEditPow(input: {
  thoughtId: string;
  originalText: string;
  text: string;
}): {
  traceType: "system2";
  action: "edit";
  thoughtId: string;
  originalText: string;
  text: string;
} {
  return {
    traceType: "system2",
    action: "edit",
    thoughtId: input.thoughtId,
    originalText: input.originalText,
    text: input.text,
  };
}

export function composeTapThoughtDeletePow(input: {
  thoughtId: string;
  text: string;
}): {
  traceType: "system2";
  action: "remove";
  thoughtId: string;
  text: string;
} {
  return {
    traceType: "system2",
    action: "remove",
    thoughtId: input.thoughtId,
    text: input.text,
  };
}
