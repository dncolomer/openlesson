"use client";

import type { ExerciseThought } from "@/lib/exercise-tap";

/**
 * System 1 stash history — denser tile strip (not Helios bubbles).
 * Promote to Solution Stack via visible "To solution" action (Enter / 1–3 also work).
 */
export function ExerciseStashHistory({
  thoughts,
  onSubmitThought,
  emptyMessage = "Del or silence stashes speech here.",
}: {
  thoughts: ExerciseThought[];
  onSubmitThought: (thoughtId: string) => void;
  emptyMessage?: string;
}) {
  const latest = thoughts.slice(-6).reverse();

  return (
    <div
      data-exercise-stash-history
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-800/90 bg-neutral-950/70"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-900 px-3 py-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            Stash history
          </p>
          <p className="text-[10px] text-neutral-600">System 1 · {thoughts.length} stashed</p>
        </div>
      </div>
      {latest.length === 0 ? (
        <p className="m-3 text-xs text-neutral-600" data-empty="true">
          {emptyMessage}
        </p>
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto overscroll-y-contain p-2 sm:grid-cols-3">
          {latest.map((thought, index) => (
            <li
              key={thought.id}
              data-exercise-stash-item={thought.id}
              className="flex min-h-[5.5rem] flex-col gap-1.5 rounded-lg border border-neutral-800 bg-black/50 p-2"
            >
              <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-600">
                Stash {thoughts.length - index}
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
                  data-exercise-promote-to-solution={thought.id}
                  onClick={() => onSubmitThought(thought.id)}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 transition hover:border-neutral-500 hover:text-white"
                  title="Move to Solution Stack"
                  aria-label="To solution"
                >
                  To solution
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
