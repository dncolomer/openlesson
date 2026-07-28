"use client";

import type { ExerciseThought } from "@/lib/exercise-tap";

/**
 * System 2 Solution Stack — same card grid as stash history.
 * Undo demotes a card back to Stash (leaves evaluated solution; does not discard).
 * Contents of this stack are what get evaluated as the solution at the end.
 */
export function ExerciseSubmissionStack({
  thoughts,
  onRemove,
  emptyMessage = "Solution stack is empty. Promote stashed thoughts or Enter with live speech — this stack is evaluated as your solution.",
}: {
  thoughts: ExerciseThought[];
  /** Demote thought back to stash (Undo). */
  onRemove: (thoughtId: string) => void;
  emptyMessage?: string;
}) {
  // Same pile order as stash: newest first in the grid.
  const latest = thoughts.slice(-6).reverse();

  return (
    <div
      data-exercise-submission-history
      data-exercise-solution-stack
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-800/90 bg-neutral-950/70"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-900 px-3 py-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            Solution Stack
          </p>
          <p className="text-[10px] text-neutral-600">
            System 2 · {thoughts.length} in solution · undo → stash
          </p>
        </div>
      </div>
      {latest.length === 0 ? (
        <p className="m-3 text-xs text-neutral-600" data-empty="true">
          {emptyMessage}
        </p>
      ) : (
        <ul
          data-exercise-submission-pile
          className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto overscroll-y-contain p-2 sm:grid-cols-3"
        >
          {latest.map((thought, index) => (
            <li
              key={thought.id}
              data-exercise-submitted-item={thought.id}
              className="flex min-h-[5.5rem] flex-col gap-1.5 rounded-lg border border-neutral-800 bg-black/50 p-2"
            >
              <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-600">
                Solution {thoughts.length - index}
              </p>
              <p
                className="min-h-0 flex-1 overflow-hidden text-[11px] leading-snug text-neutral-200 line-clamp-4"
                title={thought.text}
              >
                {thought.text}
              </p>
              <div className="flex shrink-0 justify-end">
                <button
                  type="button"
                  data-exercise-remove-thought={thought.id}
                  data-exercise-undo-to-stash={thought.id}
                  onClick={() => onRemove(thought.id)}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 transition hover:border-neutral-500 hover:text-white"
                  title="Move back to Stash (out of evaluated solution)"
                  aria-label="Move back to Stash"
                >
                  To stash
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
