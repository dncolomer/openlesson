"use client";

import type { ReactNode } from "react";
import type { ExerciseThought } from "@/lib/exercise-tap";
import { ExerciseStashHistory } from "./ExerciseStashHistory";
import { ExerciseSubmissionStack } from "./ExerciseSubmissionStack";

/**
 * Wider Exercise TAP live shell — prompt + speech + dual history (stash / Solution Stack).
 * No Helios/user dialogue bubbles. Non-essential chrome trimmed for room.
 */
export function ExerciseTapShell({
  exerciseText,
  stash,
  submitted,
  onSubmitStashThought,
  onRemoveSubmission,
  speechBar,
  controlStrip,
  identityBadge,
}: {
  exerciseText: string;
  stash: ExerciseThought[];
  submitted: ExerciseThought[];
  onSubmitStashThought: (thoughtId: string) => void;
  onRemoveSubmission: (thoughtId: string) => void;
  speechBar: ReactNode;
  controlStrip?: ReactNode;
  identityBadge?: ReactNode;
}) {
  return (
    <section
      data-exercise-tap-shell
      data-exercise-dual-history
      className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden"
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div
          data-exercise-prompt
          className="min-w-0 flex-1 rounded-xl border border-neutral-800/90 bg-neutral-950/75 px-4 py-3"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-300/70">
            Exercise
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-100 sm:text-base">
            {exerciseText}
          </p>
        </div>
        {identityBadge ? <div className="shrink-0 pt-1">{identityBadge}</div> : null}
      </div>

      {controlStrip}

      <div
        data-exercise-speech-panel
        className="shrink-0 rounded-xl border border-neutral-800/90 bg-neutral-950/70 p-2.5"
      >
        {speechBar}
      </div>

      {/* Wide dual history: stash (sys1) | Solution Stack (sys2, evaluated at end) */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <ExerciseStashHistory thoughts={stash} onSubmitThought={onSubmitStashThought} />
        <ExerciseSubmissionStack thoughts={submitted} onRemove={onRemoveSubmission} />
      </div>
    </section>
  );
}
