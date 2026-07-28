"use client";

/**
 * @deprecated Prefer ExerciseSubmissionStack for the dual-history Exercise UI.
 * Kept as a thin re-export of the submission stack so older imports keep working.
 */
import type { ExerciseThought } from "@/lib/exercise-tap";
import { ExerciseSubmissionStack } from "./ExerciseSubmissionStack";

export function ExerciseSubmittedList({
  thoughts,
  onRemove,
  emptyMessage,
}: {
  thoughts: ExerciseThought[];
  onRemove: (thoughtId: string) => void;
  emptyMessage?: string;
}) {
  return (
    <ExerciseSubmissionStack
      thoughts={thoughts}
      onRemove={onRemove}
      emptyMessage={emptyMessage}
    />
  );
}
