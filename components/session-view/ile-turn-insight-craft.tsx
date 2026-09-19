"use client";

import { FALLBACK_AESTHETIC_IMAGES } from "@/lib/aesthetics";
import {
  ILE_END_TURN_BLOCKED_NO_ACTIVE,
  type IleEndTurnInsightGate,
} from "@/lib/ile-turn-insights";
import {
  IleWorkDockChip,
  type IleWorkDockLabel,
} from "@/components/session-view/ile-work-dock-bar";
import { IleInsightTrophyIcon } from "@/components/session-view/ile-insight-trophies";

/**
 * End-turn overlay: quota check only. Insights are crafted on the Work
 * canvas — this screen never hosts a craft form.
 */
export function IleTurnInsightCraft({
  open,
  aestheticImage,
  dockedChapters,
  gate,
  onContinue,
  onSaveAndExit,
  onBack,
}: {
  open: boolean;
  aestheticImage?: string | null;
  dockedChapters: IleWorkDockLabel[];
  gate: IleEndTurnInsightGate;
  onContinue: () => void;
  onSaveAndExit: () => void;
  onBack: () => void;
}) {
  if (!open) return null;

  const backdrop =
    (aestheticImage && aestheticImage.trim()) ||
    FALLBACK_AESTHETIC_IMAGES[0] ||
    "";
  const blocked = !gate.canComplete;
  const unmet = new Set(gate.unmetChapterIds);

  return (
    <div
      data-ile-turn-insight-craft
      data-ile-end-turn-screen
      data-ile-end-turn-blocked={blocked ? "true" : "false"}
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div
        data-ile-turn-insight-craft-still
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/45"
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
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
              <IleInsightTrophyIcon className="size-3.5 text-amber-300" />
              {gate.chaptersToComplete.length} chapter
              {gate.chaptersToComplete.length === 1 ? "" : "s"} marked done
            </p>
          )}

          <section data-ile-turn-insight-chapters>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/55">
              Active chapters
            </p>
            {dockedChapters.length > 0 ? (
              <ul
                data-ile-turn-insight-chapter-list
                className="flex flex-wrap gap-2"
              >
                {dockedChapters.map((work) => {
                  const missing = unmet.has(work.id);
                  return (
                    <li
                      key={work.id}
                      data-ile-turn-insight-chapter={work.id}
                      data-ile-end-turn-chapter-unmet={missing ? "true" : undefined}
                    >
                      <IleWorkDockChip
                        work={{
                          ...work,
                          status: missing ? "attention" : work.status ?? "idle",
                        }}
                        compact
                        caption={missing ? "Needs insight" : "Quota met"}
                      />
                    </li>
                  );
                })}
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

        <footer className="flex shrink-0 flex-col gap-2 border-t border-white/15 bg-black/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
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
