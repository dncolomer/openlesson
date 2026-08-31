"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import {
  ThoughtBackgroundLayers,
  DialogueSplit,
  type DialogueMessage,
  type HeliosTurnMode,
  THOUGHT_BACKGROUND_IMAGES,
} from "@/components/thought-ui/ThoughtUi";

import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";

import { ImDoneAnsweringControl } from "@/components/thought-ui/ImDoneAnsweringButton";
import {
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  shouldAutoStashOnContextFull,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";
import { applyIleContextFullAutoStash } from "@/lib/ile-context-auto-stash";
import type { ExerciseThought } from "@/lib/exercise-tap";
import type { ChapterFollowUpSuggestion } from "@/lib/ile-chapter-follow-ups";
import { IleWordBoxText } from "@/components/thought-ui/IleWordBoxText";
import type { IleWordBoxMenuAction } from "@/lib/ile-word-boxes";
import {
  IleChapterHeliosActions,
  type IleChapterHeliosActionsProps,
} from "@/components/session-view/ile-chapter-helios-actions";

import type { PowParticipantIdentity } from "@/lib/session-participant-identity";

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
  sessionId: string;
  ttsLanguage?: string;
  tutorName?: string;
  aestheticImages?: string[];
  aestheticName?: string;
  sessionControls?: ReactNode;
  thought: SessionThoughtInterface;
  participantIdentity?: PowParticipantIdentity | null;
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
  /** Open Grok or Dantes with the word-box selection prefilled. */
  onOpenWordBoxTool?: (action: IleWordBoxMenuAction) => void;
  chapterActions?: IleChapterHeliosActionsProps | null;
  /** PiP clone — skip auto-stash so the live Chapter widget owns side effects. */
  replica?: boolean;
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
  sessionId,
  ttsLanguage,
  tutorName = "Helios",
  aestheticImages,
  aestheticName,
  sessionControls,
  thought,
  participantIdentity = null,
  hasPlanSteps = true,
  projectMode = false,
  chapterThoughtsLocked = false,
  projectStash = [],
  projectSolution = [],
  chapterFollowUps = [],
  chapterFollowUpsLoading = false,
  chapterFollowUpsError = null,
  onSelectChapterFollowUp,
  onOpenWordBoxTool,
  chapterActions = null,
  replica = false,
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
    if (replica) return;
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
    if (typeof thought.ingestStashedThought === "function") {
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
    projectStash,
    projectSolution,
    replica,
  ]);

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

      <div className="relative z-10 flex h-full min-h-0 flex-col p-3">
        {isInitializing && !hasPlanSteps ? (
          <div className="rounded-none border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
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
                className="flex min-h-0 w-full flex-1 flex-col"
              >
                <div
                  data-ile-project-exercise-prompt
                  data-chapter-solved={chapterThoughtsLocked ? "true" : "false"}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 sm:px-6 sm:py-5"
                >
                  <p
                    className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] ${
                      chapterThoughtsLocked ? "text-neutral-500" : "text-neutral-300/85"
                    }`}
                  >
                    Explore Solo · Exercise
                  </p>
                  <p
                    className="mt-2.5 min-h-0 flex-1 overflow-y-auto text-base font-medium leading-relaxed text-neutral-50 sm:text-lg sm:leading-relaxed"
                  >
                    <IleWordBoxText
                      text={chapterPrompt}
                      onOpenTool={onOpenWordBoxTool}
                    />
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
                                className="rounded-none border border-neutral-800/90 bg-black/40 px-2.5 py-2"
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
                                className="rounded-none border border-neutral-800/70 bg-black/30 px-2.5 py-2"
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
                                  className="w-full rounded-none border border-neutral-600/30 bg-neutral-800/5 px-3 py-2.5 text-left transition hover:border-neutral-500/50 hover:bg-neutral-800/10 disabled:opacity-50"
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
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-helios-bubbles="visible">
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
                  onOpenWordBoxTool={onOpenWordBoxTool}
                />
              </div>
            )}

            <IleChapterHeliosActions
              {...(chapterActions ?? {
                chapterId: null,
                chapterIndex: -1,
                chapterDescription: "",
                chapterCompleted: false,
                activeChapterIndex: -1,
                onChapterDone: () => {},
                onUpdateChapter: async () => {},
              })}
              doneAnswering={
                <div
                  data-ile-im-done-answering-overlay
                  className="relative z-20 min-w-0"
                >
                  <ImDoneAnsweringControl
                    sessionId={sessionId}
                    thoughts={thought.stashedThoughts}
                    formingText={
                      typeof thought.getFormingText === "function"
                        ? thought.getFormingText()
                        : thought.crystallizableText
                    }
                    sendThought={(text, ids) =>
                      thought.sendThought(text, ids, { skipTrace: true })
                    }
                    logEndOfChainOfThought={(event) => thought.logTrace(event)}
                    onClearForming={thought.clearCurrentTranscription}
                    disabled={chapterThoughtsLocked || thought.isSending}
                  />
                </div>
              }
            />
            {sessionControls ? (
              <div className="mt-2 flex w-full shrink-0 flex-col items-center gap-2">
                {sessionControls}
              </div>
            ) : null}
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