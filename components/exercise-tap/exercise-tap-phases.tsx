"use client";

import { ThoughtCompactAction } from "@/components/thought-ui/ThoughtUi";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionIdentityBadge } from "@/components/SessionIdentityBadge";
import { TapPracticePill } from "@/components/tap-score/tap-practice-pill";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { ExerciseTapShell } from "@/components/exercise-tap/ExerciseTapShell";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type { ExerciseThought } from "@/lib/exercise-tap";
import type { TapSoloProblem } from "@/lib/tap-session-map";
import {
  type Phase,
  formatCountdown,
  thoughtButtonClasses,
  normalize,
} from "@/lib/tap-score-client-helpers";
import { cn } from "@/lib/utils";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function ExerciseTapPhases(props: {
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
  isPracticeMode: boolean;
  exerciseText: string;
  stash: ExerciseThought[];
  thoughtHistory: ExerciseThought[];
  sendThought: (text: string, thoughtIds: string[]) => void | Promise<void>;
  onEditThought: (thought: ExerciseThought, nextText: string) => void;
  onDeleteThought: (thought: ExerciseThought) => void;
  isSending?: boolean;
  participantIdentity: PowParticipantIdentity | null;
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
  stashCurrentTranscription: () => void;
  sendCurrentTranscription: () => void;
  beginEditTranscription: () => void;
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
  logExerciseTrace: (input: {
    traceType: "system1" | "system2";
    action: "pause_finalize" | "auto_stash" | "send" | "remove" | "edit" | "end_of_chain_of_thought";
    thoughtId?: string;
    originalText?: string;
    text?: string;
  }) => void;
  clearTranscriptionDisplay: () => void;
  restartSpeechRecognitionSession: () => void;
  sessionEndedImpure: boolean;
  resolvedWorkspaceId?: string;
  restartPractice: () => void;
  backToBriefing: () => void;
  onDone: () => void;
  soloProblems: TapSoloProblem[];
  activeSoloProblemId: string | null;
  onSelectSoloProblem: (id: string) => void;
  onSubmitSoloSolution: () => void;
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
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
    isPracticeMode,
    exerciseText,
    stash,
    thoughtHistory,
    sendThought,
    onEditThought,
    onDeleteThought,
    isSending = false,
    participantIdentity,
    remainingSeconds,
    crystallizableText,
    showEndSession,
    endSession,
    speechError,
    speechSupported,
    isListening,
    retryMicrophone,
    stashCurrentTranscription,
    editingTranscription,
    setEditingTranscription,
    logExerciseTrace,
    clearTranscriptionDisplay,
    restartSpeechRecognitionSession,
    sessionEndedImpure,
    restartPractice,
    backToBriefing,
    onDone,
    soloProblems,
    activeSoloProblemId,
    onSelectSoloProblem,
    onSubmitSoloSolution,
    workspaceId,
    blockId,
    sessionId,
  } = props;

  return (
    <div data-exercise-tap-client className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white">
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && (
          <section
            className="relative flex min-h-0 flex-1"
            data-exercise-briefing
            data-exercise-tap-intro
            data-tap-briefing-layout="sections"
          >
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
                  kicker="Exercise TAP"
                  workspaceTitle={workspaceTitle}
                  minutes={minutes}
                  onMinutesChange={setMinutes}
                  conversationLanguage={conversationLanguage}
                  onConversationLanguageChange={(locale) =>
                    setConversationLanguage(coerceSpokenLocale(locale))
                  }
                  showDurationPicker={!privateToken && !durationLocked}
                  disabled={isStartingSession}
                  intro="Solo practice. Speak your reasoning; I'm done answering closes your turn."
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
          <>
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <ExerciseTapShell
            exerciseText={exerciseText}
            stash={stash}
            thoughtHistory={thoughtHistory}
            sendThought={sendThought}
            onEditThought={onEditThought}
            onDeleteThought={onDeleteThought}
            isSending={isSending}
            formingText={crystallizableText}
            logEndOfChainOfThought={(event) => {
              logExerciseTrace({
                traceType: event.traceType,
                action: event.action,
                thoughtId: event.thoughtId,
                text: event.text,
              });
              onSubmitSoloSolution();
            }}
            onClearForming={() => {
              clearTranscriptionDisplay();
              restartSpeechRecognitionSession();
            }}
            problems={soloProblems}
            activeProblemId={activeSoloProblemId}
            onSelectProblem={onSelectSoloProblem}
            bgImage={bgImage}
            workspaceId={workspaceId}
            blockId={blockId}
            sessionId={sessionId}
            controlStrip={
              <div
                className="flex w-full shrink-0 items-center gap-3 border-b border-neutral-800/60 bg-black/35 px-3 py-2"
                data-exercise-live-control-strip
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                      Time
                    </div>
                    <div
                      className={`font-mono text-lg leading-none tabular-nums tracking-tight ${
                        remainingSeconds <= 60 ? "text-neutral-300" : "text-white"
                      }`}
                    >
                      {formatCountdown(remainingSeconds)}
                    </div>
                  </div>
                  {showEndSession ? (
                    <div className="flex shrink-0 items-center" data-tap-end-session>
                      <TapThoughtButton size="sm" variant="primary" onClick={() => void endSession()}>
                        End session
                      </TapThoughtButton>
                    </div>
                  ) : null}
                </div>
                {isPracticeMode || participantIdentity ? (
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {isPracticeMode ? (
                      <TapPracticePill label={t("tap.practice.bannerKicker")} />
                    ) : null}
                    <SessionIdentityBadge identity={participantIdentity} />
                  </div>
                ) : null}
              </div>
            }
            speechBar={
              <>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <div
                    className="flex h-8 min-w-0 flex-1 items-center rounded-none border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300"
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
                  {speechError && speechSupported !== false && !isListening ? (
                    <TapThoughtButton size="sm" variant="primary" onClick={() => void retryMicrophone()}>
                      Retry
                    </TapThoughtButton>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ThoughtCompactAction
                      shortcut="Del"
                      label="Stash"
                      disabled={!crystallizableText}
                      onClick={() => stashCurrentTranscription()}
                    />
                  </div>
                </div>
                {error ? <p className="mt-1.5 text-sm text-red-300">{error}</p> : null}
              </>
            }
          />
          </div>
          </>
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

        {phase === "practice_done" && !sessionEndedImpure && (
          <section
            className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
            data-tap-practice-done
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
              {t("tap.practice.doneKicker")}
            </p>
            <h2 className="mt-2 text-2xl font-medium text-white">{t("tap.practice.doneTitle")}</h2>
            <p className="mt-3 text-sm text-neutral-400">{t("tap.practice.doneBody")}</p>
            <button
              type="button"
              className={cn(thoughtButtonClasses({ size: "md", variant: "primary" }), "mt-8")}
              data-exercise-practice-retry
              onClick={restartPractice}
            >
              {t("tap.practice.restart")}
            </button>
          </section>
        )}

        {(phase === "results" || phase === "practice_done") && sessionEndedImpure ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-impure
              data-exercise-session-impure
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
                onClick={
                  phase === "practice_done"
                    ? restartPractice
                    : () => window.location.reload()
                }
              >
                {t("tap.postSession.impureTryAgain")}
              </TapThoughtButton>
            </section>
        ) : phase === "results" ? (
          privateToken ? (
            <section
              className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center"
              data-tap-session-thank-you
              data-exercise-session-thank-you
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
            <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
                Exercise TAP complete
              </p>
              <h2 className="mt-2 text-2xl font-medium text-white">
                {t("tap.postSession.resultsTitle")}
              </h2>
              <p className="mt-3 text-sm text-neutral-400">
                Your spoken exercise and submitted thoughts were recorded as proof of work.
              </p>
              <button
                type="button"
                className={cn(thoughtButtonClasses({ size: "md", variant: "primary" }), "mt-8")}
                onClick={onDone}
              >
                Done
              </button>
            </section>
          )
        ) : null}

        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-300">{error || "Something went wrong"}</p>
            <TapThoughtButton size="md" variant="primary" onClick={backToBriefing}>
              Back
            </TapThoughtButton>
          </section>
        )}
      </div>

      {editingTranscription ? (
        <ThoughtEditPanel
          draft={editingTranscription.draft}
          onDraftChange={(draft) =>
            setEditingTranscription((current) => (current ? { ...current, draft } : null))
          }
          onCancel={() => setEditingTranscription(null)}
          onSend={() => {
            const draft = normalize(editingTranscription.draft);
            if (!draft) return;
            logExerciseTrace({
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
    </div>
  );
}
