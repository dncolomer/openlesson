"use client";

import type { ExerciseThought } from "@/lib/exercise-tap";
import { ExerciseStashHistory } from "@/components/exercise-tap/ExerciseStashHistory";
import { ExerciseSubmissionStack } from "@/components/exercise-tap/ExerciseSubmissionStack";

/**
 * Project Mode Thoughts tool — one tool, two stacks (solution top, stash bottom).
 * Reuses Exercise TAP dual-list card components; remains the ILE Thoughts surface.
 */
export function ProjectThoughtsDualStack({
  stash,
  submitted,
  onPromoteToSolution,
  onDemoteToStash,
  locked = false,
  className = "",
}: {
  stash: ExerciseThought[];
  submitted: ExerciseThought[];
  onPromoteToSolution: (thoughtId: string) => void;
  onDemoteToStash: (thoughtId: string) => void;
  /** When chapter is Mark as Done — stacks visible but non-interactive. */
  locked?: boolean;
  className?: string;
}) {
  return (
    <div
      data-ile-project-thoughts
      data-ile-thoughts-dual-stack
      data-thoughts-tool="project"
      data-chapter-thoughts-locked={locked ? "true" : "false"}
      className={`flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden ${className}`}
    >
      <div className="shrink-0 px-0.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          Thoughts
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          {locked
            ? "Chapter marked Done — solution and stash are final for this chapter."
            : "Solution stack (top) and stash (bottom). Move thoughts between stacks; both are PoW traces."}
        </p>
      </div>

      <div
        className={`grid min-h-0 flex-1 grid-rows-2 gap-3 overflow-hidden ${
          locked ? "pointer-events-none opacity-70" : ""
        }`}
        data-ile-dual-stack-layout="vertical"
      >
        {/* Solution on top */}
        <div className="min-h-0 overflow-hidden" data-ile-solution-stack-region>
          <ExerciseSubmissionStack
            thoughts={submitted}
            onRemove={onDemoteToStash}
            emptyMessage={
              locked
                ? "No solution thoughts for this chapter."
                : "Solution stack is empty. Promote from stash or Enter with live speech."
            }
          />
        </div>
        {/* Stash on bottom */}
        <div className="min-h-0 overflow-hidden" data-ile-stash-stack-region>
          <ExerciseStashHistory
            thoughts={stash}
            onSubmitThought={onPromoteToSolution}
            emptyMessage={
              locked
                ? "No stashed thoughts for this chapter."
                : "Del stashes speech here (System 1). Promote to Solution when ready."
            }
          />
        </div>
      </div>
    </div>
  );
}
