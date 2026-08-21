"use client";

import { useEffect, useMemo, useState } from "react";
import { ThoughtCompactAction, type HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { TapSessionMap } from "@/components/tap-score/tap-session-map";
import { TapTurnOverlay } from "@/components/tap-score/tap-turn-overlay";
import { tapConvoBlocksFromAssistantTurns } from "@/lib/tap-session-map";
import { ExerciseStashHistory } from "@/components/exercise-tap/ExerciseStashHistory";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { AutoStashContextBar } from "@/components/thought-ui/AutoStashContextBar";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionIdentityBadge } from "@/components/SessionIdentityBadge";
import { TapPracticePill } from "@/components/tap-score/tap-practice-pill";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { PerformanceReport } from "@/lib/pow-api/performance-report";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import {
  TAP_SESSION_PURITY_MAX,
  shouldFadeLiveBar,
  transcriptFadeOpacity,
} from "@/lib/tap-session-purity";
import {
  type Phase,
  type Thought,
  type TapChatMessage as ChatMessage,
  formatCountdown,
  normalize,
} from "@/lib/tap-score-client-helpers";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function TapScorePhases(props: {
  phase: Phase;
  bgImage: string | null;
  t: Translate;
  workspaceTitle: string;
  minutes: number;
  setMinutes: (n: number) => void;
  conversationLanguage: SpokenLocale;
  setConversationLanguage: (locale: SpokenLocale) => void;
  privateToken?: string;
  durationLocked: boolean;
  isStartingSession: boolean;
  startingTopics: TapStartingTopic[];
  startingTopicId: string | null;
  topicsError: string;
  error: string;
  startSession: (topicOrOptions?: TapStartingTopic | { practice: true; topic?: TapStartingTopic }) => void;
  participantIdentity: PowParticipantIdentity | null;
  isPracticeMode: boolean;
  lastUserTurn: ChatMessage | null;
  lastAssistantTurn: ChatMessage | null;
  messages: ChatMessage[];
  isSending: boolean;
  heliosTurnMode: HeliosTurnMode;
  userInitial: string;
  remainingSeconds: number;
  sessionPurity: number;
  crystallizableText: string;
  showEndSession: boolean;
  endSession: () => void;
  speechError: string | null;
  speechSupported: boolean | null;
  isListening: boolean;
  transcriptSilenceMs: number;
  retryMicrophone: () => void;
  sendCurrentTranscription: () => void;
  stashCurrentTranscription: () => void;
  beginEditTranscription: () => void;
  latestThoughts: Thought[];
  stashedThoughts: Thought[];
  sendThought: (text: string, thoughtIds: string[]) => void;
  thoughtHistory: Thought[];
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  resultsError: string;
  performanceReport: PerformanceReport | null;
  sessionEndedImpure: boolean;
  restartBriefingFlow: () => void;
  setPhase: (phase: Phase) => void;
  editingTranscription: { draft: string; originalText: string } | null;
  setEditingTranscription: (
    next:
      | { draft: string; originalText: string }
      | null
      | ((current: { draft: string; originalText: string } | null) => {
          draft: string;
          originalText: string;
        } | null),
  ) => void;
  logTapTrace: (input: {
    traceType: "system1" | "system2";
    action: "crystallize" | "pause_finalize" | "auto_stash" | "send" | "skip" | "select" | "deselect" | "resend" | "edit";
    originalText?: string;
    text?: string;
  }) => void;
  clearTranscriptionDisplay: () => void;
  restartSpeechRecognitionSession: () => void;
}) {
  const {
    phase,
    bgImage,
    t,
    workspaceTitle,
    minutes,
    setMinutes,
    conversationLanguage,
    setConversationLanguage,
    privateToken,
    durationLocked,
    isStartingSession,
    startingTopics,
    startingTopicId,
    topicsError,
    error,
    startSession,
    participantIdentity,
    isPracticeMode,
    lastAssistantTurn,
    messages,
    isSending,
    remainingSeconds,
    sessionPurity,
    crystallizableText,
    showEndSession,
    endSession,
    speechError,
    speechSupported,
    isListening,
    transcriptSilenceMs,
    retryMicrophone,
    sendCurrentTranscription,
    stashCurrentTranscription,
    beginEditTranscription,
    stashedThoughts,
    sendThought,
    resultsError,
    performanceReport,
    sessionEndedImpure,
    restartBriefingFlow,
    setPhase,
    editingTranscription,
    setEditingTranscription,
    logTapTrace,
    clearTranscriptionDisplay,
    restartSpeechRecognitionSession,
  } = props;

  const assistantTurns = useMemo(
    () => messages.filter((message) => message.role === "assistant"),
    [messages],
  );
  const convoBlocks = useMemo(
    () => tapConvoBlocksFromAssistantTurns(assistantTurns),
    [assistantTurns],
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  useEffect(() => {
    if (lastAssistantTurn?.id) setSelectedBlockId(lastAssistantTurn.id);
  }, [lastAssistantTurn?.id]);
  const selectedBlock =
    convoBlocks.find((block) => block.id === selectedBlockId) ??
    convoBlocks[convoBlocks.length - 1] ??
    null;
  const overlayWaiting = isSending || (isStartingSession && !lastAssistantTurn);

  return (
    <main className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white selection:bg-zinc-700">
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && (
          <section className="relative flex min-h-0 flex-1" data-tap-briefing-layout="sections">
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
                <SessionOnboardingGuide
                  variant="tap"
                  hideStep3Quote
                  renderStep3Action={() => (
                    <>
                      <TapStartingTopicCards
                        topics={startingTopics}
                        isStarting={isStartingSession}
                        startingTopicId={startingTopicId}
                        onStartTopic={(selectedTopic) => void startSession(selectedTopic)}
                        onPracticeFirst={() => void startSession({ practice: true })}
                        practiceTitle={t("tap.practice.practiceFirst")}
                        practiceSubtitle={t("tap.practice.practiceFirstHint")}
                        practiceStartLabel={t("tap.practice.cardStart")}
                        practiceStartingLabel={t("tap.practice.starting")}
                        loadingLabel={t("tap.briefing.topicsLoading")}
                        startLabel={t("onboardingGuide.tap.step3.start")}
                        startingLabel={t("onboardingGuide.tap.step3.starting")}
                      />
                      {topicsError ? (
                        <p className="mt-2 text-center text-xs text-neutral-300/90">{topicsError}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>
              <TapAestheticSection bgImage={bgImage} kind="shortcuts">
                <TapBriefingConfig
                  workspaceTitle={workspaceTitle}
                  minutes={minutes}
                  onMinutesChange={setMinutes}
                  conversationLanguage={conversationLanguage}
                  onConversationLanguageChange={(locale) =>
                    setConversationLanguage(coerceSpokenLocale(locale))
                  }
                  showDurationPicker={!privateToken && !durationLocked}
                  disabled={isStartingSession}
                />
              </TapAestheticSection>
              {error ? (
                <p className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5 text-center text-sm text-red-300 lg:col-span-2">
                  {error}
                </p>
              ) : null}
            </div>
          </section>
        )}

        {phase === "live" && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              data-tap-convo-live-split
              className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden lg:grid-cols-2 lg:grid-rows-1"
            >
              <div
                data-tap-convo-map-pane
                className="relative min-h-0 min-w-0 overflow-hidden border-b border-neutral-800/60 lg:border-b-0 lg:border-r"
              >
                <TapSessionMap
                  blocks={convoBlocks}
                  selectedId={selectedBlock?.id ?? null}
                  onSelect={setSelectedBlockId}
                  currentId={convoBlocks[convoBlocks.length - 1]?.id ?? null}
                  overlay={
                    <TapTurnOverlay
                      kind="dialog"
                      kicker={selectedBlock?.title || "Question"}
                      body={selectedBlock?.prompt || ""}
                      waiting={overlayWaiting}
                      markdown
                      extra={
                        error ? (
                          <p className="mt-2 text-xs text-red-300">{error}</p>
                        ) : null
                      }
                    />
                  }
                />
              </div>

              <TapAestheticSection
                bgImage={bgImage}
                kind="convo-stash"
                className="min-h-0 min-w-0"
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  {participantIdentity || isPracticeMode ? (
                    <div className="flex shrink-0 items-center justify-end gap-2 border-b border-neutral-800/60 bg-black/35 px-3 py-1.5">
                      {isPracticeMode ? (
                        <TapPracticePill label={t("tap.practice.bannerKicker")} />
                      ) : null}
                      <SessionIdentityBadge identity={participantIdentity} />
                    </div>
                  ) : null}
                  <div
                    className="flex w-full shrink-0 flex-wrap items-end justify-between gap-3 border-b border-neutral-800/60 bg-black/35 px-3 py-2"
                    data-tap-live-control-strip
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4 sm:gap-5">
                      <div className="flex shrink-0 flex-col gap-1">
                        <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                          Time left
                        </div>
                        <div
                          className={`flex h-7 items-center font-mono text-lg leading-none tabular-nums tracking-tight ${
                            remainingSeconds <= 60 ? "text-neutral-300" : "text-white"
                          }`}
                        >
                          {formatCountdown(remainingSeconds)}
                        </div>
                      </div>
                      <div
                        className="flex shrink-0 flex-col gap-1"
                        data-tap-session-purity
                        aria-label={t("tap.live.sessionPurityAria", { purity: sessionPurity, max: TAP_SESSION_PURITY_MAX })}
                      >
                        <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                          {t("tap.live.sessionPurity")}
                        </div>
                        <div className="flex h-7 items-center gap-1.5">
                          {Array.from({ length: TAP_SESSION_PURITY_MAX }, (_, index) => {
                            const filled = index < sessionPurity;
                            return (
                              <span
                                key={index}
                                className={`h-2.5 w-2.5 shrink-0 rounded-full border transition-colors ${
                                  filled
                                    ? sessionPurity === 1
                                      ? "border-neutral-600/80 bg-neutral-300"
                                      : "border-emerald-400/70 bg-emerald-400"
                                    : "border-neutral-700 bg-transparent"
                                }`}
                                aria-hidden
                              />
                            );
                          })}
                          <span
                            className={`ml-0.5 font-mono text-sm leading-none tabular-nums ${
                              sessionPurity <= 1 ? "text-neutral-300" : "text-neutral-400"
                            }`}
                          >
                            {sessionPurity}/{TAP_SESSION_PURITY_MAX}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-[8rem] max-w-md flex-1">
                        <AutoStashContextBar data-surface="tap" text={crystallizableText} />
                      </div>
                    </div>
                    {showEndSession ? (
                      <div className="flex h-[calc(0.625rem+0.25rem+1.75rem)] shrink-0 flex-wrap items-end gap-2" data-tap-end-session>
                        <TapThoughtButton size="sm" variant="primary" onClick={() => void endSession()}>
                          End session
                        </TapThoughtButton>
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 border-b border-neutral-800/60 bg-black/35 p-2.5">
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                      <div
                        className="flex h-8 min-w-0 flex-1 items-center rounded-none border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300 transition-opacity duration-150"
                        style={{
                          opacity: shouldFadeLiveBar(transcriptSilenceMs)
                            ? transcriptFadeOpacity(transcriptSilenceMs)
                            : 1,
                        }}
                        data-tap-transcript-fade
                      >
                        <SlidingTranscript
                          text={formatSpeechTranscriptDisplay({
                            text: crystallizableText,
                            speechError,
                            speechSupported,
                            isListening,
                            enabled: phase === "live",
                          })}
                          className={`w-full ${speechError ? "text-neutral-300/90" : "text-neutral-300"}`}
                        />
                      </div>
                      {speechSupported !== false && !isListening ? (
                        <TapThoughtButton size="sm" variant="primary" onClick={() => void retryMicrophone()}>
                          {speechError ? "Retry" : "Start"}
                        </TapThoughtButton>
                      ) : null}
                      <div className="flex shrink-0 items-center gap-0.5">
                        <ThoughtCompactAction
                          shortcut="↵"
                          label="Send"
                          disabled={!crystallizableText || isSending}
                          onClick={() => void sendCurrentTranscription()}
                        />
                        <ThoughtCompactAction
                          shortcut="Del"
                          label="Stash"
                          disabled={!crystallizableText}
                          onClick={() => stashCurrentTranscription()}
                        />
                        <ThoughtCompactAction
                          shortcut="E"
                          label="Edit"
                          disabled={!crystallizableText}
                          onClick={beginEditTranscription}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ExerciseStashHistory
                      thoughts={stashedThoughts}
                      onSubmitThought={(thoughtId) => {
                        const thought = stashedThoughts.find((item) => item.id === thoughtId);
                        if (!thought) return;
                        void sendThought(thought.text, [thought.id]);
                      }}
                      emptyMessage="Del or silence stashes speech here."
                      actionLabel="Submit"
                      actionTitle="Submit this thought"
                      actionDisabled={isSending}
                      className="bg-black/35 lg:border-r-0"
                    />
                  </div>
                </div>
              </TapAestheticSection>
            </div>
          </section>
        )}

        {phase === "saving" && (
          <section className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage
              tone="muted"
              message={
                isPracticeMode
                  ? t("tap.practice.saving")
                  : t("tap.postSession.savingAndReturning")
              }
            />
          </section>
        )}
        {phase === "practice_done" ? (
          <section
            className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
            data-tap-practice-done
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
              {t("tap.practice.doneKicker")}
            </p>
            <h1 className="mt-2 text-2xl font-medium text-neutral-100 sm:text-3xl">
              {t("tap.practice.doneTitle")}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
              {t("tap.practice.doneBody")}
            </p>
            <TapThoughtButton
              size="md"
              variant="primary"
              className="mt-8"
              data-tap-practice-restart
              onClick={restartBriefingFlow}
            >
              {t("tap.practice.restart")}
            </TapThoughtButton>
          </section>
        ) : null}
        {phase === "results" ? (
          sessionEndedImpure ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-impure
            >
              <h1 className="text-2xl font-medium text-neutral-100 sm:text-3xl">
                {t("tap.postSession.impureTitle")}
              </h1>
              <p className="mt-4 max-w-lg whitespace-pre-line text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t("tap.postSession.impureBody")}
              </p>
              <TapThoughtButton
                size="md"
                variant="primary"
                className="mt-8"
                data-tap-impure-retry
                onClick={() => window.location.reload()}
              >
                {t("tap.postSession.impureTryAgain")}
              </TapThoughtButton>
            </section>
          ) : privateToken ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-thank-you
            >
              <h1 className="text-2xl font-medium text-neutral-100 sm:text-3xl">
                {t("tap.postSession.thankYouTitle")}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t("tap.postSession.thankYouBody")}
              </p>
              <a
                href="/"
                data-tap-explore-uncertain-systems
                className="mt-8 inline-flex items-center justify-center rounded-none bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
              >
                {t("tap.postSession.exploreUncertainSystems")}
              </a>
            </section>
          ) : (
            <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto py-6">
              <h1 className="text-2xl font-medium text-neutral-100">{t("tap.postSession.resultsTitle")}</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">{t("tap.postSession.resultsHint")}</p>
              {performanceReport ? (
                <div className="mt-6 min-h-0 flex-1 rounded-none border border-neutral-800 bg-neutral-950/50 p-4 md:p-5">
                  <PerformanceReportCard
                    report={performanceReport}
                    layout="spacious"
                    fillHeight
                    label={t("tap.postSession.verificationResultsTitle")}
                  />
                </div>
              ) : null}
            </section>
          )
        ) : null}
        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-medium">Could not end TAP session</h1>
            <p className="mt-3 max-w-md text-sm text-red-300">{resultsError || error}</p>
            <TapThoughtButton size="md" variant="primary" className="mt-6" onClick={() => setPhase("briefing")}>
              Try again
            </TapThoughtButton>
          </section>
        )}
      </div>

      {editingTranscription ? (
        <ThoughtEditPanel
          draft={editingTranscription.draft}
          onDraftChange={(draft) => setEditingTranscription((current) => (current ? { ...current, draft } : null))}
          onCancel={() => setEditingTranscription(null)}
          onSend={() => {
            const draft = normalize(editingTranscription.draft);
            if (!draft) return;
            logTapTrace({
              traceType: "system2",
              action: "edit",
              originalText: editingTranscription.originalText,
              text: draft,
            });
            setEditingTranscription(null);
            clearTranscriptionDisplay();
            restartSpeechRecognitionSession();
            void sendThought(draft, []);
          }}
          isSending={isSending}
        />
      ) : null}
    </main>
  );
}
