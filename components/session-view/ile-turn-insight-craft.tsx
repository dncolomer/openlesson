"use client";

import {
  ILE_END_TURN_BLOCKED_NO_ACTIVE,
  type IleEndTurnInsightGate,
} from "@/lib/ile-turn-insights";
import {
  IleWorkDockChip,
  type IleWorkDockLabel,
} from "@/components/session-view/ile-work-dock-bar";
import { IleInsightTrophyIcon } from "@/components/session-view/ile-insight-trophies";

/** The session's one chapter. Extra dock labels are not drawn. */
export function ileTurnInsightTopic(
  chapters: readonly IleWorkDockLabel[] | null | undefined,
): IleWorkDockLabel | null {
  const rows = chapters ?? [];
  return rows.find((work) => work.focused) ?? rows[0] ?? null;
}

/**
 * End-turn screen inside the chapter board. Quota check only. Insights are
 * crafted on the Work canvas — this screen never hosts a craft form.
 */
export function IleTurnInsightCraft({
  open,
  dockedChapters,
  gate,
  onContinue,
  onSaveAndExit,
  onBack,
}: {
  open: boolean;
  dockedChapters: IleWorkDockLabel[];
  gate: IleEndTurnInsightGate;
  onContinue: () => void;
  onSaveAndExit: () => void;
  onBack: () => void;
}) {
  if (!open) return null;

  const blocked = !gate.canComplete;
  const unmet = new Set(gate.unmetChapterIds);
  const topic = ileTurnInsightTopic(dockedChapters);
  const missing = topic ? unmet.has(topic.id) : false;

  return (
    <div
      data-ile-turn-insight-craft
      data-ile-end-turn-screen
      data-ile-end-turn-blocked={blocked ? "true" : "false"}
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-black text-white"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-white/15 px-5 py-4 sm:px-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
            Turn close
          </p>
          <h2
            id="ile-turn-insight-craft-title"
            className="mt-1 font-mono text-xl font-semibold uppercase tracking-wide text-white sm:text-2xl"
          >
            {blocked ? "Cannot end turn" : "Chapters complete"}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-white/70">
            {blocked
              ? "Insights are crafted on the Work canvas. End turn only marks active chapters done when each one already has its quota."
              : "Every active chapter met its insight quota. End turn marks those chapters done."}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-7">
          {blocked ? (
            <p
              data-ile-end-turn-blocked-reason
              className="max-w-2xl text-sm text-white/70"
            >
              {gate.reason || ILE_END_TURN_BLOCKED_NO_ACTIVE}
            </p>
          ) : (
            <p
              data-ile-end-turn-complete
              className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-white"
            >
              <IleInsightTrophyIcon className="size-3.5 text-white" />
              {gate.chaptersToComplete.length} chapter
              {gate.chaptersToComplete.length === 1 ? "" : "s"} marked done
            </p>
          )}

          <section data-ile-turn-insight-chapters>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/55">
              Active chapters
            </p>
            {topic ? (
              <ul
                data-ile-turn-insight-chapter-list
                className="flex flex-wrap gap-2"
              >
                <li
                  data-ile-turn-insight-chapter={topic.id}
                  data-ile-end-turn-chapter-unmet={missing ? "true" : undefined}
                >
                  <IleWorkDockChip
                    work={{
                      ...topic,
                      status: missing ? "attention" : topic.status ?? "idle",
                    }}
                    compact
                    caption={missing ? "Needs insight" : "Quota met"}
                  />
                </li>
              </ul>
            ) : (
              <p
                data-ile-turn-insight-chapters-empty
                className="font-mono text-[11px] uppercase tracking-wider text-white/45"
              >
                No docked chapters this turn
              </p>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-white/15 bg-black px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          {blocked ? (
            <button
              type="button"
              data-ile-end-turn-back
              data-ile-turn-insight-continue
              onClick={onBack}
              className="border border-white bg-white px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100"
            >
              Back to work
            </button>
          ) : (
            <>
              <button
                type="button"
                data-ile-turn-insight-save-exit
                onClick={onSaveAndExit}
                className="border border-white/50 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-white hover:border-white"
              >
                Save and go out of the workspace
              </button>
              <button
                type="button"
                data-ile-turn-insight-continue
                onClick={onContinue}
                className="border border-white bg-white px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100"
              >
                Continue with the next turn
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
