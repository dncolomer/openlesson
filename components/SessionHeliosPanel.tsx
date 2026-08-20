"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { formatSpeechTranscriptDisplay, type SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import {
  ThoughtBackgroundLayers,
  ThoughtCompactAction,
  DialogueSplit,
  type DialogueMessage,
  type HeliosTurnMode,
  THOUGHT_BACKGROUND_IMAGES,
} from "@/components/thought-ui/ThoughtUi";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { ActiveThoughtSlots } from "@/components/thought-ui/ActiveThoughtSlots";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { AutoStashContextBar } from "@/components/thought-ui/AutoStashContextBar";
import {
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  shouldAutoStashOnContextFull,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";
import { applyIleContextFullAutoStash } from "@/lib/ile-context-auto-stash";
import type { ExerciseThought } from "@/lib/exercise-tap";
import type { ChapterFollowUpSuggestion } from "@/lib/ile-chapter-follow-ups";

interface SessionHeliosPanelProps {
  lastUserTurn: DialogueMessage | null;
  lastAssistantTurn: DialogueMessage | null;
  isAssistantPending?: boolean;
  heliosTurnMode?: HeliosTurnMode;
  chapterPrompt: string;
  userInitial: string;
  isSessionActive: boolean;
  isInitializing?: boolean;
  isChapterLoading?: boolean;
  loadingChapterLabel?: string | null;
  showWelcome?: boolean;
  onWelcomePlay?: () => void;
  isStartingSession?: boolean;
  /** Bumped when Help re-opens the guide so slides reset to step 1. */
  welcomeResetKey?: number;
  sessionId: string;
  ttsLanguage?: string;
  tutorName?: string;
  aestheticImages?: string[];
  aestheticName?: string;
  sessionControls?: ReactNode;
  thought: SessionThoughtInterface;
  hasPlanSteps?: boolean;
  /**
   * Project Mode: no Helios conversation bubbles; exercise prompt + speech only.
   * Dual-stack stash/solution lives in the Thoughts tool.
   */
  projectMode?: boolean;
  /** When Project Mode chapter is Done — block further thought submits. */
  chapterThoughtsLocked?: boolean;
  /** Project Mode dual lists for the active chapter (shown under exercise when Done). */
  projectStash?: ExerciseThought[];
  projectSolution?: ExerciseThought[];
  /** After Done: 3 adjacent-topic follow-ups; picking one adds a chapter next to the completed one. */
  chapterFollowUps?: ChapterFollowUpSuggestion[];
  chapterFollowUpsLoading?: boolean;
  chapterFollowUpsError?: string | null;
  onSelectChapterFollowUp?: (suggestion: ChapterFollowUpSuggestion) => void;
  onProjectStash?: (text?: string) => void;
  onProjectSubmitToSolution?: () => void;
}

export function SessionHeliosPanel({
  lastUserTurn,
  lastAssistantTurn,
  isAssistantPending = false,
  heliosTurnMode = "idle",
  chapterPrompt,
  userInitial,
  isSessionActive,
  isInitializing = false,
  isChapterLoading = false,
  loadingChapterLabel = null,
  showWelcome = false,
  onWelcomePlay,
  isStartingSession = false,
  welcomeResetKey = 0,
  sessionId,
  ttsLanguage,
  tutorName = "Helios",
  aestheticImages,
  aestheticName,
  sessionControls,
  thought,
  hasPlanSteps = true,
  projectMode = false,
  chapterThoughtsLocked = false,
  projectStash = [],
  projectSolution = [],
  chapterFollowUps = [],
  chapterFollowUpsLoading = false,
  chapterFollowUpsError = null,
  onSelectChapterFollowUp,
  onProjectStash,
  onProjectSubmitToSolution,
}: SessionHeliosPanelProps) {
  const { t } = useI18n();

  const [bgImage, setBgImage] = useState("");
  const contextStashInFlightRef = useRef(false);

  useEffect(() => {
    const pool = aestheticImages?.length ? aestheticImages : THOUGHT_BACKGROUND_IMAGES;
    setBgImage(pool[Math.floor(Math.random() * pool.length)]);
  }, [aestheticImages, sessionId]);

  // Thought context capacity auto-stash (ILE has no purity clock).
  // Reads live forming text (ref) so a full bar actually persists.
  useEffect(() => {
    if (!isSessionActive || !thought.speechEnabled || chapterThoughtsLocked) {
      contextStashInFlightRef.current = false;
      return;
    }
    const live =
      typeof thought.getFormingText === "function"
        ? thought.getFormingText()
        : thought.crystallizableText || "";
    const ratio = thoughtContextFillRatio(live, THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS);
    if (
      !shouldAutoStashOnContextFull(ratio) ||
      contextStashInFlightRef.current ||
      !live.trim()
    ) {
      return;
    }

    const result = applyIleContextFullAutoStash({
      formingText: live,
      sessionMode: projectMode ? "project" : "learning",
      chapterStatus: chapterThoughtsLocked ? "completed" : "in_progress",
      thoughtMemory: thought.thoughts,
      projectLists: {
        stash: projectStash,
        submitted: projectSolution,
      },
    });
    if (!result.didStash || !result.thought) return;

    contextStashInFlightRef.current = true;
    if (projectMode && onProjectStash) {
      thought.clearCurrentTranscription();
      onProjectStash(result.thought.text);
    } else if (typeof thought.ingestStashedThought === "function") {
      thought.ingestStashedThought(result.thought);
      thought.clearCurrentTranscription();
    } else {
      thought.stashCurrentTranscription(result.thought.text);
    }
    window.setTimeout(() => {
      contextStashInFlightRef.current = false;
    }, 300);
  }, [
    isSessionActive,
    thought.crystallizableText,
    thought.speechEnabled,
    thought.stashCurrentTranscription,
    thought.getFormingText,
    thought.ingestStashedThought,
    thought.clearCurrentTranscription,
    thought.thoughts,
    projectMode,
    chapterThoughtsLocked,
    onProjectStash,
    projectStash,
    projectSolution,
  ]);

  if (showWelcome) {
    return (
      <div className="relative h-full overflow-hidden bg-[#0a0a0a]">
        <ThoughtBackgroundLayers bgImage={bgImage} dimStrength="medium" />
        <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden">
          <SessionOnboardingGuide
            key={welcomeResetKey}
            variant="ile"
            presentation="floating"
            language={ttsLanguage}
            showStartAction
            projectMode={projectMode}
            onStart={() => onWelcomePlay?.()}
            isStarting={isStartingSession}
          />
        </div>
        {aestheticName && <div className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700">{aestheticName}</div>}
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-[#0a0a0a]">
      <ThoughtBackgroundLayers bgImage={bgImage} dimStrength="medium" />

      {isChapterLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]/88 backdrop-blur-md">
          <LoadingStatusMessage message={t("chapterMap.loadingChapter")} />
          {loadingChapterLabel && (
            <p className="max-w-md px-6 text-center text-base leading-relaxed text-neutral-400">{loadingChapterLabel}</p>
          )}
        </div>
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col gap-3 p-3">
        {isInitializing && !hasPlanSteps ? (
          <div className="rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
            {sessionControls && (
              <div className="mb-3 flex w-full flex-col items-center gap-2 border-b border-neutral-900/80 pb-3">
                {sessionControls}
              </div>
            )}
            <div className="flex items-center justify-center py-8">
              <LoadingStatusMessage size="sm" tone="subtle" message={t("probes.preparing")} />
            </div>
          </div>
        ) : (
          <>
            {projectMode ? (
              <div
                data-ile-project-panel
                data-helios-bubbles="hidden"
                className="mt-auto flex w-full shrink-0 flex-col"
              >
                <div
                  data-ile-project-exercise-prompt
                  data-chapter-solved={chapterThoughtsLocked ? "true" : "false"}
                  className={`rounded-2xl border px-5 py-4 backdrop-blur-md sm:px-6 sm:py-5 ${
                    chapterThoughtsLocked
                      ? "border-neutral-600/70 bg-neutral-950/75 shadow-none"
                      : "border-neutral-500/40 bg-neutral-950/80 shadow-[0_0_24px_rgba(251,191,36,0.06)]"
                  }`}
                >
                  <p
                    className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                      chapterThoughtsLocked ? "text-neutral-500" : "text-neutral-300/85"
                    }`}
                  >
                    Explore Solo · Exercise
                  </p>
                  <p
                    className={`mt-2.5 overflow-y-auto text-base font-medium leading-relaxed text-neutral-50 sm:text-lg sm:leading-relaxed ${
                      chapterThoughtsLocked
                        ? "max-h-[8rem] sm:max-h-[9rem]"
                        : "max-h-[12rem] sm:max-h-[14rem]"
                    }`}
                  >
                    {chapterPrompt}
                  </p>
                  {chapterThoughtsLocked ? (
                    <div
                      data-ile-chapter-solved-summary
                      className="mt-3 space-y-3 border-t border-neutral-800/80 pt-3"
                    >
                      <p
                        data-ile-chapter-done-notice
                        className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500"
                      >
                        Chapter solved · final
                      </p>

                      <div data-ile-solved-solution-summary>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                            Solution
                          </p>
                          <p className="text-[10px] text-neutral-600">
                            {projectSolution.length} thought
                            {projectSolution.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        {projectSolution.length === 0 ? (
                          <p className="text-xs text-neutral-600">No solution thoughts submitted.</p>
                        ) : (
                          <ul className="max-h-[9rem] space-y-1.5 overflow-y-auto overscroll-y-contain sm:max-h-[11rem]">
                            {projectSolution.map((item, index) => (
                              <li
                                key={item.id}
                                data-ile-solved-solution-item={item.id}
                                className="rounded-lg border border-neutral-800/90 bg-black/40 px-2.5 py-2"
                              >
                                <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-600">
                                  Solution {index + 1}
                                </p>
                                <p className="mt-0.5 text-xs leading-snug text-neutral-200">
                                  {item.text}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div data-ile-solved-stash-summary>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                            Stash
                          </p>
                          <p className="text-[10px] text-neutral-600">
                            {projectStash.length} thought
                            {projectStash.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        {projectStash.length === 0 ? (
                          <p className="text-xs text-neutral-600">No stashed thoughts.</p>
                        ) : (
                          <ul className="max-h-[7rem] space-y-1.5 overflow-y-auto overscroll-y-contain sm:max-h-[9rem]">
                            {projectStash.map((item, index) => (
                              <li
                                key={item.id}
                                data-ile-solved-stash-item={item.id}
                                className="rounded-lg border border-neutral-800/70 bg-black/30 px-2.5 py-2"
                              >
                                <p className="font-mono text-[9px] uppercase tracking-wide text-neutral-600">
                                  Stash {index + 1}
                                </p>
                                <p className="mt-0.5 text-xs leading-snug text-neutral-400">
                                  {item.text}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div
                        data-ile-chapter-follow-ups
                        className="border-t border-neutral-800/80 pt-3"
                      >
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                          Next adjacent topics (Optional Follow-ups)
                        </p>
                        <p className="mb-2 text-[11px] leading-snug text-neutral-500">
                          Pick one to add as a new chapter on the closest empty square next to
                          this one. You can add more anytime.
                        </p>
                        {chapterFollowUpsLoading ? (
                          <p
                            className="text-xs text-neutral-500"
                            data-ile-follow-ups-loading
                          >
                            Generating follow-ups…
                          </p>
                        ) : null}
                        {chapterFollowUpsError ? (
                          <p className="text-xs text-neutral-300/90" data-ile-follow-ups-error>
                            {chapterFollowUpsError}
                          </p>
                        ) : null}
                        {!chapterFollowUpsLoading && chapterFollowUps.length > 0 ? (
                          <ul className="grid gap-2">
                            {chapterFollowUps.map((suggestion, index) => (
                              <li key={`${suggestion.title}-${index}`}>
                                <button
                                  type="button"
                                  data-ile-follow-up-topic={index}
                                  disabled={!onSelectChapterFollowUp}
                                  onClick={() => onSelectChapterFollowUp?.(suggestion)}
                                  className="w-full rounded-lg border border-neutral-600/30 bg-neutral-800/5 px-3 py-2.5 text-left transition hover:border-neutral-500/50 hover:bg-neutral-800/10 disabled:opacity-50"
                                >
                                  <p className="text-xs font-semibold text-neutral-200">
                                    {suggestion.title}
                                  </p>
                                  {suggestion.description &&
                                  suggestion.description !== suggestion.title ? (
                                    <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">
                                      {suggestion.description}
                                    </p>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[42vh] flex-1 flex-col" data-helios-bubbles="visible">
                <DialogueSplit
                  lastUserTurn={lastUserTurn}
                  lastAssistantTurn={lastAssistantTurn}
                  promptText={chapterPrompt}
                  isSending={thought.isSending || isAssistantPending}
                  heliosTurnMode={
                    heliosTurnMode === "interruption"
                      ? "interruption"
                      : thought.isSending || isAssistantPending
                        ? "responding"
                        : "idle"
                  }
                  error={thought.sendError}
                  userInitial={userInitial}
                  emptyUserTurnText=""
                />
              </div>
            )}

            <div className="min-w-0 shrink-0 overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
              {sessionControls && (
                <div className="mb-3 flex w-full flex-col items-center gap-2 border-b border-neutral-900/80 pb-3">
                  {sessionControls}
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300">
                    <SlidingTranscript
                      text={formatSpeechTranscriptDisplay({
                        text: thought.crystallizableText,
                        speechError: thought.speechError,
                        speechSupported: thought.speechSupported,
                        isListening: thought.isListening,
                        enabled: thought.speechEnabled,
                      })}
                      className={`w-full ${thought.speechError ? "text-neutral-300/90" : "text-neutral-300"}`}
                    />
                  </div>
                  {thought.speechEnabled &&
                  thought.speechSupported !== false &&
                  !thought.isListening ? (
                    <button
                      type="button"
                      onClick={() => void thought.retryMicrophone()}
                      className="shrink-0 rounded-md border border-neutral-600/40 bg-neutral-800/10 px-2 py-1 text-[10px] font-medium text-neutral-300 transition hover:border-neutral-500/60 hover:bg-neutral-800/20"
                    >
                      {thought.speechError ? "Retry" : "Start"}
                    </button>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5">
                    {projectMode ? (
                      <>
                        <ThoughtCompactAction
                          shortcut="↵"
                          label="Solution"
                          disabled={
                            chapterThoughtsLocked ||
                            !thought.crystallizableText ||
                            thought.isSending
                          }
                          onClick={() => onProjectSubmitToSolution?.()}
                        />
                        <ThoughtCompactAction
                          shortcut="Del"
                          label="Stash"
                          disabled={chapterThoughtsLocked || !thought.crystallizableText}
                          onClick={() => onProjectStash?.()}
                        />
                      </>
                    ) : (
                      <>
                        <ThoughtCompactAction
                          shortcut="↵"
                          label="Send"
                          disabled={!thought.crystallizableText || thought.isSending}
                          onClick={() => void thought.sendCurrentTranscription()}
                        />
                        <ThoughtCompactAction
                          shortcut="Del"
                          label="Stash"
                          disabled={!thought.crystallizableText}
                          onClick={thought.stashCurrentTranscription}
                        />
                        <ThoughtCompactAction
                          shortcut="E"
                          label="Edit"
                          disabled={!thought.crystallizableText}
                          onClick={thought.beginEditTranscription}
                        />
                      </>
                    )}
                  </div>
                </div>
                <AutoStashContextBar data-surface="ile" text={thought.crystallizableText} />
              </div>

              {!projectMode ? (
                <div className="mt-3 border-t border-neutral-900/80 pt-3">
                  <p className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-600">
                    {t("probes.stashedThoughts")}
                  </p>
                  <ActiveThoughtSlots
                    thoughts={thought.latestThoughts}
                    isSending={thought.isSending}
                    onSendThought={(text, thoughtId) => void thought.sendThought(text, [thoughtId])}
                  />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {thought.editingTranscription ? (
        <ThoughtEditPanel
          draft={thought.editingTranscription.draft}
          onDraftChange={thought.updateEditDraft}
          onCancel={thought.cancelEditTranscription}
          onSend={() => void thought.submitEditedTranscription()}
          isSending={thought.isSending}
        />
      ) : null}

      {aestheticName && <div className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700">{aestheticName}</div>}
    </div>
  );
}