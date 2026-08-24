"use client";

import { useState, type ReactNode } from "react";
import { ImDoneAnsweringControl } from "@/components/thought-ui/ImDoneAnsweringButton";
import type { IleEndOfChainOfThoughtEvent } from "@/lib/ile-im-done-answering";
import type { ExerciseThought } from "@/lib/exercise-tap";
import type { TapSoloProblem } from "@/lib/tap-session-map";
import { TapSessionMap } from "@/components/tap-score/tap-session-map";
import { TapTurnOverlay } from "@/components/tap-score/tap-turn-overlay";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import {
  openOlderThoughtsSurface,
  selectLastStashedThought,
} from "@/lib/ile-last-stash";

/**
 * Exercise TAP live shell — 50/50 map | universal Stash Submit UI.
 */
export function ExerciseTapShell({
  exerciseText,
  stash,
  thoughtHistory,
  sendThought,
  isSending = false,
  speechBar,
  formingText = "",
  logEndOfChainOfThought,
  onClearForming,
  controlStrip,
  identityBadge,
  problems,
  activeProblemId,
  onSelectProblem,
  onSubmitSolution,
  solutionSubmitted = false,
  bgImage,
  workspaceId,
  blockId,
  sessionId,
}: {
  exerciseText: string;
  stash: ExerciseThought[];
  thoughtHistory: ExerciseThought[];
  sendThought: (text: string, thoughtIds: string[]) => void | Promise<void>;
  isSending?: boolean;
  speechBar: ReactNode;
  formingText?: string;
  logEndOfChainOfThought?: (event: IleEndOfChainOfThoughtEvent) => void;
  onClearForming?: () => void;
  controlStrip?: ReactNode;
  identityBadge?: ReactNode;
  problems: TapSoloProblem[];
  activeProblemId: string | null;
  onSelectProblem: (id: string) => void;
  onSubmitSolution: () => void;
  solutionSubmitted?: boolean;
  bgImage?: string | null;
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
}) {
  const active = problems.find((problem) => problem.id === activeProblemId) ?? problems[0];
  const prompt = active?.prompt || exerciseText;
  const [olderThoughtsOpen, setOlderThoughtsOpen] = useState(false);
  const lastStash = selectLastStashedThought(stash);

  return (
    <section
      data-exercise-tap-shell
      data-exercise-tap-stash-submit
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0b0b0b]"
    >
      <div
        data-exercise-tap-live-split
        className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden lg:grid-cols-2 lg:grid-rows-1"
      >
        <div
          data-exercise-tap-map-pane
          className="relative min-h-0 min-w-0 overflow-hidden border-b border-neutral-800/60 lg:border-b-0 lg:border-r"
        >
          <TapSessionMap
            blocks={problems}
            selectedId={active?.id ?? null}
            onSelect={onSelectProblem}
            overlay={
              <TapTurnOverlay
                kind="solo"
                kicker={active?.title || "Exercise"}
                body={prompt}
                onSubmitSolution={onSubmitSolution}
                solutionSubmitted={Boolean(active?.solutionSubmitted || solutionSubmitted)}
              />
            }
          />
        </div>

        <TapAestheticSection
          bgImage={bgImage}
          kind="solo-stacks"
          className="min-h-0 min-w-0"
        >
          {identityBadge ? (
            <div className="flex shrink-0 items-center justify-end gap-2 border-b border-neutral-800/60 bg-black/35 px-3 py-1.5">
              {identityBadge}
            </div>
          ) : null}
          {controlStrip}
          <div
            data-exercise-speech-panel
            data-tap-transcript-container
            className="shrink-0 border-b border-neutral-800/60 bg-black/35 p-2.5"
          >
            {speechBar}
          </div>
          <div
            data-tap-im-done-slot
            className="shrink-0 border-b border-neutral-800/60 bg-black/35 px-3 py-2"
          >
            <ImDoneAnsweringControl
              sessionId={sessionId}
              thoughts={stash}
              formingText={formingText}
              sendThought={sendThought}
              logEndOfChainOfThought={logEndOfChainOfThought ?? (() => {})}
              onClearForming={onClearForming}
              disabled={isSending}
            />
          </div>
          <div
            className="shrink-0 border-b border-neutral-800/60 bg-black/35 px-3 py-2.5"
            data-tap-last-stash
            data-exercise-last-stash
          >
            {lastStash ? (
              <p
                data-tap-last-stash-text
                data-exercise-last-stash-text
                className="line-clamp-3 text-sm leading-relaxed text-neutral-200"
                title={lastStash.text}
              >
                {lastStash.text}
              </p>
            ) : (
              <p className="text-xs text-neutral-600" data-exercise-last-stash-empty>
                No stashed thought
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-tap-see-older-thoughts
                data-exercise-see-older-thoughts
                aria-pressed={olderThoughtsOpen}
                onClick={() => openOlderThoughtsSurface(setOlderThoughtsOpen)}
                className={`rounded-none border px-2.5 py-1.5 text-[11px] font-medium transition ${
                  olderThoughtsOpen
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-neutral-600/40 bg-neutral-800/10 text-neutral-200 hover:border-neutral-500/60 hover:bg-neutral-800/20"
                }`}
              >
                See Older Thoughts
              </button>
            </div>
          </div>
          {olderThoughtsOpen ? (
            <div
              className="min-h-0 flex-1 overflow-hidden bg-black/35 px-2 py-2"
              data-tap-older-thoughts
              data-exercise-older-thoughts
            >
              <ThoughtMemoryPanel
                className="flex h-full min-h-0 max-h-full flex-col overflow-hidden"
                listClassName="pr-1"
                thoughts={thoughtHistory}
                workspaceId={workspaceId}
                blockId={blockId}
                sessionId={sessionId}
                insightSurface="tap"
                allowInsightGeneration={false}
                onSendThought={sendThought}
                isSending={isSending}
                emptyMessage="Speak, press Del to stash thoughts, or I'm done answering to close. Every trace appears here."
              />
            </div>
          ) : null}
        </TapAestheticSection>
      </div>
    </section>
  );
}
