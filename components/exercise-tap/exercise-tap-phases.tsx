"use client";

import { ThoughtCompactAction } from "@/components/thought-ui/ThoughtUi";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { AutoStashContextBar } from "@/components/thought-ui/AutoStashContextBar";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionIdentityBadge } from "@/components/SessionIdentityBadge";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { ExerciseTapShell } from "@/components/exercise-tap/ExerciseTapShell";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import type { TapStartingTopic } from "@/lib/tap-score";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type { ExerciseThought } from "@/lib/exercise-tap";
import {
  TAP_SESSION_PURITY_MAX,
  shouldFadeLiveBar,
  transcriptFadeOpacity,
} from "@/lib/tap-session-purity";
import {
  type Phase,
  formatCountdown,
  thoughtButtonClasses,
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
  submitted: ExerciseThought[];
  submitStashThought: (id: string) => void;
  handleUndoSubmissionToStash: (id: string) => void;
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
  submitCurrentOrLatestStash: () => void;
  sessionEndedImpure: boolean;
  resolvedWorkspaceId?: string;
  restartPractice: () => void;
  backToBriefing: () => void;
  onDone: () => void;
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
    submitted,
    submitStashThought,
    handleUndoSubmissionToStash,
    participantIdentity,
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
    stashCurrentTranscription,
    submitCurrentOrLatestStash,
    sessionEndedImpure,
    restartPractice,
    backToBriefing,
    onDone,
  } = props;

  return (
    <div data-exercise-tap-client className="relative min-h-screen bg-[#0a0a0a] text-white">
      {bgImage ? (
        <div
          className="pointer-events-none fixed inset-0 opacity-30"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-5">
        {phase === "briefing" && (
          <section
            className="relative flex min-h-[calc(100vh-2.5rem)] flex-1 py-4"
            data-exercise-briefing
            data-exercise-tap-intro
          >
            <div className="grid min-h-0 w-full flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-950/65 backdrop-blur-sm">
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
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-900/80 bg-neutral-950/55 backdrop-blur-md">
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
                  intro="Solo practice. Del stashes; Enter promotes to Solution."
                  shortcutRows={[
                    { keys: ["Del"], label: "Stash (System 1)" },
                    { keys: ["Enter"], label: "To Solution Stack (System 2)" },
                    { keys: ["1", "2", "3"], label: "Promote stashed slot" },
                    { keys: ["5s"], label: t("tap.briefing.shortcutSilence") },
                  ]}
                />
              </div>
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
            {isPracticeMode ? (
              <div
                data-tap-practice-banner
                className="mb-3 shrink-0 rounded-xl border border-neutral-500/40 bg-neutral-800/10 px-4 py-2.5 text-center"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/90">
                  {t("tap.practice.bannerKicker")}
                </p>
                <p className="mt-0.5 text-sm font-medium text-neutral-50">{t("tap.practice.bannerTitle")}</p>
                <p className="mt-0.5 text-xs text-neutral-200/70">{t("tap.practice.bannerHint")}</p>
              </div>
            ) : null}
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
          <ExerciseTapShell
            exerciseText={exerciseText}
            stash={stash}
            submitted={submitted}
            onSubmitStashThought={submitStashThought}
            onRemoveSubmission={handleUndoSubmissionToStash}
            identityBadge={
              participantIdentity ? (
                <SessionIdentityBadge identity={participantIdentity} />
              ) : undefined
            }
            controlStrip={
              <div
                className="flex w-full flex-wrap items-end justify-between gap-3 rounded-xl border border-neutral-800/90 bg-neutral-950/70 px-3 py-2"
                data-exercise-live-control-strip
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4 sm:gap-5">
                  <div className="flex shrink-0 flex-col gap-1">
                    <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                      Time
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
                    aria-label={t("tap.live.sessionPurityAria", {
                      purity: sessionPurity,
                      max: TAP_SESSION_PURITY_MAX,
                    })}
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
                  <div
                    className="flex h-[calc(0.625rem+0.25rem+1.75rem)] shrink-0 flex-wrap items-end gap-2"
                    data-tap-end-session
                  >
                    <TapThoughtButton size="sm" variant="primary" onClick={() => void endSession()}>
                      End session
                    </TapThoughtButton>
                  </div>
                ) : null}
              </div>
            }
            speechBar={
              <>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <div
                    className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-900 bg-black/70 px-2.5 text-xs text-neutral-300 transition-opacity duration-150"
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
                      shortcut="Del"
                      label="Stash"
                      disabled={!crystallizableText}
                      onClick={() => stashCurrentTranscription()}
                    />
                    <ThoughtCompactAction
                      shortcut="↵"
                      label="To solution"
                      disabled={!crystallizableText && stash.length === 0}
                      onClick={() => submitCurrentOrLatestStash()}
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

        {phase === "practice_done" && (
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

        {phase === "results" &&
          (sessionEndedImpure ? (
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
                onClick={() => window.location.reload()}
              >
                {t("tap.postSession.impureTryAgain")}
              </TapThoughtButton>
            </section>
          ) : privateToken ? (
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
                className="mt-8 inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
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
          ))}

        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-300">{error || "Something went wrong"}</p>
            <TapThoughtButton size="md" variant="primary" onClick={backToBriefing}>
              Back
            </TapThoughtButton>
          </section>
        )}
      </div>
    </div>
  );
}
