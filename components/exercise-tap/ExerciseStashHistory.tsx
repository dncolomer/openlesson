"use client";

import type { ExerciseThought } from "@/lib/exercise-tap";
import { cn } from "@/lib/utils";

/**
 * System 1 stash history — denser tile strip (not Helios bubbles).
 * Promote to Solution Stack via visible "To solution" action (Enter / 1–3 also work).
 */
export function ExerciseStashHistory({
  thoughts,
  onSubmitThought,
  emptyMessage = "Del or silence stashes speech here.",
  compact = false,
  className,
  actionLabel = "To solution",
  actionTitle = "Move to Solution Stack",
  actionDisabled = false,
}: {
  thoughts: ExerciseThought[];
  onSubmitThought: (thoughtId: string) => void;
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
  actionLabel?: string;
  actionTitle?: string;
  actionDisabled?: boolean;
}) {
  const latest = compact ? thoughts.slice(-4).reverse() : thoughts.slice().reverse();

  return (
    <div
      data-exercise-stash-history
      data-exercise-stash-compact={compact ? "true" : "false"}
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60",
        className,
      )}
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
              className={`flex flex-col gap-1.5 rounded-none border border-neutral-800 bg-black/50 p-2 ${
                compact ? "min-h-[3.25rem]" : "min-h-[5.5rem]"
              }`}
            >
              <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-600">
                Stash {thoughts.length - index}
              </p>
              <p
                className={`min-h-0 flex-1 overflow-hidden text-[11px] leading-snug text-neutral-200 ${
                  compact ? "line-clamp-2" : "line-clamp-4"
                }`}
                title={thought.text}
              >
                {thought.text}
              </p>
              <div className="flex shrink-0 justify-end">
                <button
                  type="button"
                  data-exercise-promote-to-solution={thought.id}
                  onClick={() => onSubmitThought(thought.id)}
                  className="rounded-none border border-neutral-700 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  title={actionTitle}
                  aria-label={actionLabel}
                  disabled={actionDisabled}
                >
                  {actionLabel}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
