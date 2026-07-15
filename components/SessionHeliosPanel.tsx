"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  stuckCheckText?: string | null;
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
  stuckCheckText = null,
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
}: SessionHeliosPanelProps) {
  const { t } = useI18n();

  const [bgImage, setBgImage] = useState("");

  useEffect(() => {
    const pool = aestheticImages?.length ? aestheticImages : THOUGHT_BACKGROUND_IMAGES;
    setBgImage(pool[Math.floor(Math.random() * pool.length)]);
  }, [aestheticImages, sessionId]);

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
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0a]/88 backdrop-blur-md">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-500/80" />
            <div className="absolute inset-0 animate-ping rounded-full border border-amber-500/20" />
          </div>
          <p className="mt-5 text-sm font-medium text-neutral-300">{t("chapterMap.loadingChapter")}</p>
          {loadingChapterLabel && (
            <p className="mt-2 max-w-md px-6 text-center text-base leading-relaxed text-neutral-400">{loadingChapterLabel}</p>
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
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="h-6 w-6 animate-spin rounded-full border border-neutral-800 border-t-amber-500/70" />
              <LoadingStatusMessage size="sm" tone="subtle" message={t("probes.preparing")} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-h-[42vh] flex-1 flex-col">
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

            <div className="min-w-0 overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 p-3 backdrop-blur-md">
              {sessionControls && (
                <div className="mb-3 flex w-full flex-col items-center gap-2 border-b border-neutral-900/80 pb-3">
                  {sessionControls}
                </div>
              )}
              <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300">
                  <SlidingTranscript
                    text={formatSpeechTranscriptDisplay({
                      text: thought.crystallizableText,
                      speechError: thought.speechError,
                      speechSupported: thought.speechSupported,
                      isListening: thought.isListening,
                    })}
                    className={`w-full ${thought.speechError ? "text-amber-300/90" : ""}`}
                  />
                </div>
                {thought.speechError === "not-allowed" ? (
                  <button
                    type="button"
                    onClick={() => void thought.retryMicrophone()}
                    className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/20"
                  >
                    Retry
                  </button>
                ) : null}
                <div className="flex shrink-0 items-center gap-0.5">
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
                </div>
              </div>

              <div className="mt-3 border-t border-neutral-900/80 pt-3">
                <p className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-600">{t("probes.stashedThoughts")}</p>
                <ActiveThoughtSlots
                  thoughts={thought.latestThoughts}
                  isSending={thought.isSending}
                  onSendThought={(text, thoughtId) => void thought.sendThought(text, [thoughtId])}
                />
              </div>
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