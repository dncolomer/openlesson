"use client";

import { type ReactNode } from "react";
import { ImDoneAnsweringControl } from "@/components/thought-ui/ImDoneAnsweringButton";
import type { IleEndOfChainOfThoughtEvent } from "@/lib/ile-im-done-answering";
import type { ExerciseThought } from "@/lib/exercise-tap";
import type { TapSoloProblem } from "@/lib/tap-session-map";
import { TapSessionMap } from "@/components/tap-score/tap-session-map";
import { TapTurnOverlay } from "@/components/tap-score/tap-turn-overlay";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import {
  TAP_IM_DONE_CONFIRM_BODY,
  TAP_IM_DONE_CONFIRM_CANCEL,
  TAP_IM_DONE_CONFIRM_CONFIRM,
  TAP_IM_DONE_CONFIRM_TITLE,
  isTapExerciseThoughtMemoryLocked,
} from "@/lib/tap-thought-memory";

/**
 * Exercise TAP live shell — 50/50 map | universal Stash Submit UI.
 */
export function ExerciseTapShell({
  exerciseText,
  stash,
  thoughtHistory,
  sendThought,
  onEditThought,
  onDeleteThought,
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
  bgImage,
  workspaceId,
  blockId,
  sessionId,
}: {
  exerciseText: string;
  stash: ExerciseThought[];
  thoughtHistory: ExerciseThought[];
  sendThought: (text: string, thoughtIds: string[]) => void | Promise<void>;
  onEditThought: (thought: ExerciseThought, nextText: string) => void;
  onDeleteThought: (thought: ExerciseThought) => void;
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
  bgImage?: string | null;
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
}) {
  const active = problems.find((problem) => problem.id === activeProblemId) ?? problems[0];
  const prompt = active?.prompt || exerciseText;
  const thoughtsLocked = isTapExerciseThoughtMemoryLocked(active);

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
              confirmClose={{
                title: TAP_IM_DONE_CONFIRM_TITLE,
                body: TAP_IM_DONE_CONFIRM_BODY,
                confirmLabel: TAP_IM_DONE_CONFIRM_CONFIRM,
                cancelLabel: TAP_IM_DONE_CONFIRM_CANCEL,
              }}
            />
          </div>
          <div
            className="min-h-0 flex-1 overflow-hidden bg-black/35 px-2 py-2"
            data-tap-older-thoughts
            data-exercise-older-thoughts
            data-tap-thought-memory-always
            data-tap-thoughts-locked={thoughtsLocked ? "true" : "false"}
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
              onEditThought={thoughtsLocked ? undefined : onEditThought}
              onDeleteThought={thoughtsLocked ? undefined : onDeleteThought}
              emptyMessage={
                thoughtsLocked
                  ? "This problem is done. Thoughts are read-only."
                  : "Speak, press Del to stash thoughts, then edit or delete individual thoughts. I'm done answering closes your turn."
              }
            />
          </div>
        </TapAestheticSection>
      </div>
    </section>
  );
}
