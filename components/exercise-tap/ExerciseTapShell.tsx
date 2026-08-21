"use client";

import type { ReactNode } from "react";
import type { ExerciseThought } from "@/lib/exercise-tap";
import type { TapSoloProblem } from "@/lib/tap-session-map";
import { TapSessionMap } from "@/components/tap-score/tap-session-map";
import { TapTurnOverlay } from "@/components/tap-score/tap-turn-overlay";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { ExerciseStashHistory } from "./ExerciseStashHistory";
import { ExerciseSubmissionStack } from "./ExerciseSubmissionStack";

/**
 * Exercise TAP live shell — 50/50 map | stash/solution with aesthetic.
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
  problems,
  activeProblemId,
  onSelectProblem,
  onSubmitSolution,
  solutionSubmitted = false,
  bgImage,
}: {
  exerciseText: string;
  stash: ExerciseThought[];
  submitted: ExerciseThought[];
  onSubmitStashThought: (thoughtId: string) => void;
  onRemoveSubmission: (thoughtId: string) => void;
  speechBar: ReactNode;
  controlStrip?: ReactNode;
  identityBadge?: ReactNode;
  problems: TapSoloProblem[];
  activeProblemId: string | null;
  onSelectProblem: (id: string) => void;
  onSubmitSolution: () => void;
  solutionSubmitted?: boolean;
  bgImage?: string | null;
}) {
  const active = problems.find((problem) => problem.id === activeProblemId) ?? problems[0];
  const prompt = active?.prompt || exerciseText;

  return (
    <section
      data-exercise-tap-shell
      data-exercise-dual-history
      data-exercise-dual-history-fixed
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
            className="shrink-0 border-b border-neutral-800/60 bg-black/35 p-2.5"
          >
            {speechBar}
          </div>
          <div
            data-exercise-dual-history-pane
            className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden"
          >
            <ExerciseStashHistory
              thoughts={stash}
              onSubmitThought={onSubmitStashThought}
              className="border-b border-neutral-800/60 bg-black/35 lg:border-r-0"
            />
            <ExerciseSubmissionStack
              thoughts={submitted}
              onRemove={onRemoveSubmission}
              className="bg-black/35"
            />
          </div>
        </TapAestheticSection>
      </div>
    </section>
  );
}
