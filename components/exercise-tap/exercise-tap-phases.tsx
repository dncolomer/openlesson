"use client";

import { ThoughtCompactAction } from "@/components/thought-ui/ThoughtUi";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import { SlidingTranscript } from "@/components/thought-ui/SlidingTranscript";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import { TapPracticePill } from "@/components/tap-score/tap-practice-pill";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { TapStartingTopicCards } from "@/components/TapStartingTopicCards";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { ExerciseTapShell } from "@/components/exercise-tap/ExerciseTapShell";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
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
  normalize,
} from "@/lib/tap-score-client-helpers";
import { useEffect, useRef, useState } from "react";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import {
  releaseVoiceChallengeStartLatch,
  scoredTapBriefingStep,
  voiceChallengeStartSucceeded,
} from "@/lib/practice-voice-challenge";

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
    participantIdentity: _participantIdentity,
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

  const [pendingStart, setPendingStart] = useState<
    { kind: "topic"; topic: TapStartingTopic } | { kind: "practice" } | null
  >(null);
  const passGuard = useRef(false);
  const [challengeAttempt, setChallengeAttempt] = useState(0);

  useEffect(() => {
    if (phase !== "briefing") {
      setPendingStart(null);
      passGuard.current = false;
    }
  }, [phase]);

  function chooseTopic(topic: TapStartingTopic) {
    const step = scoredTapBriefingStep({ choice: "topic", challengePassed: false });
    if (step === "challenge") setPendingStart({ kind: "topic", topic });
  }

  function choosePractice() {
    const step = scoredTapBriefingStep({ choice: "practice", challengePassed: false });
    if (step === "challenge") setPendingStart({ kind: "practice" });
  }

  function passDrillChallenge() {
    if (!pendingStart || passGuard.current) return;
    const step = scoredTapBriefingStep({
      choice: pendingStart.kind,
      challengePassed: true,
    });
    if (step !== "live") return;
    passGuard.current = true;
    const run =
      pendingStart.kind === "practice"
        ? startSession({ practice: true })
        : startSession(pendingStart.topic);
    void Promise.resolve(run).then((result) => {
      const release = releaseVoiceChallengeStartLatch({
        startSucceeded: voiceChallengeStartSucceeded(result),
      });
      if (!release.release) return;
      passGuard.current = false;
      setChallengeAttempt((attempt) => attempt + 1);
    });
  }

  const briefingStep = scoredTapBriefingStep({
    choice: pendingStart?.kind ?? null,
    challengePassed: false,
  });

  return (
    <div data-exercise-tap-client className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white">
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && isStartingSession ? (
          <SessionPageLoading
            message={
              isPracticeMode ? t("tap.practice.starting") : t("session.startLoading")
            }
          />
        ) : null}

        {phase === "briefing" && !isStartingSession && briefingStep === "challenge" && pendingStart ? (
          <section
            className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0b] px-6"
            data-exercise-voice-challenge=""
            data-drill-briefing-step="challenge"
          >
            <div className="w-full max-w-xl">
              <PracticeVoiceChallenge
                key={challengeAttempt}
                variant="drill"
                onPass={passDrillChallenge}
              />
              {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
            </div>
          </section>
        ) : null}

        {phase === "briefing" && !isStartingSession && briefingStep === "pick" && (
          <section
            className="relative flex min-h-0 flex-1"
            data-exercise-briefing
            data-exercise-tap-intro
            data-tap-briefing-layout="sections"
            data-drill-briefing-step="pick"
          >
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
                <SessionOnboardingGuide
                  variant="tap"
                  omitIntroSlide
                  hideStep3Quote
                  renderStep3Action={() => (
                    <>
                      <TapStartingTopicCards
                        topics={startingTopics}
                        isStarting={isStartingSession}
                        startingTopicId={startingTopicId}
                        onStartTopic={chooseTopic}
                        onPracticeFirst={choosePractice}
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
            clock={
              <div className="flex w-full min-w-0 flex-col gap-2 px-1 py-1">
                <TapLiveClock
                  label="Time"
                  remainingSeconds={remainingSeconds}
                  waiting={isSending}
                  listening={isListening}
                  placement="card"
                />
                {isPracticeMode ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <TapPracticePill label={t("tap.practice.bannerKicker")} />
                  </div>
                ) : null}
              </div>
            }
            actions={
              showEndSession ? (
                <div className="flex w-full min-w-0" data-tap-end-session>
                  <button
                    type="button"
                    onClick={() => void endSession()}
                    className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} w-full`}
                  >
                    End session
                  </button>
                </div>
              ) : null
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
          <SessionPageLoading
            message={
              isPracticeMode
                ? t("tap.practice.saving")
                : t("tap.postSession.savingAndReturning")
            }
          />
        )}

        {phase === "practice_done" && !sessionEndedImpure && (
          <SessionFinishedScreen
            data-tap-practice-done=""
            kicker={t("tap.practice.doneKicker")}
            title={t("tap.practice.doneTitle")}
            body={t("tap.practice.doneBody")}
            actions={
              <button
                type="button"
                data-exercise-practice-retry
                onClick={restartPractice}
                className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} h-9 px-4 text-sm normal-case tracking-normal`}
              >
                {t("tap.practice.restart")}
              </button>
            }
          />
        )}

        {(phase === "results" || phase === "practice_done") && sessionEndedImpure ? (
          <SessionFinishedScreen
            data-tap-session-impure=""
            data-exercise-session-impure=""
            title={t("tap.postSession.impureTitle")}
            body={t("tap.postSession.impureBody")}
            actions={
              <TapThoughtButton
                size="md"
                variant="primary"
                data-tap-impure-retry
                onClick={
                  phase === "practice_done"
                    ? restartPractice
                    : () => window.location.reload()
                }
              >
                {t("tap.postSession.impureTryAgain")}
              </TapThoughtButton>
            }
          />
        ) : phase === "results" ? (
          privateToken ? (
            <SessionFinishedScreen
              data-tap-session-thank-you=""
              data-exercise-session-thank-you=""
              title={t("tap.postSession.thankYouTitle")}
              body={t("tap.postSession.thankYouBody")}
              actions={
                <a
                  href="/"
                  data-tap-explore-uncertain-systems
                  className="inline-flex items-center justify-center rounded-none bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
                >
                  {t("tap.postSession.exploreUncertainSystems")}
                </a>
              }
            />
          ) : (
            <SessionFinishedScreen
              kicker="Exercise TAP complete"
              title={t("tap.postSession.resultsTitle")}
              body="Your spoken exercise and submitted thoughts were recorded as proof of work."
              actions={
                <button
                  type="button"
                  onClick={onDone}
                  className={`${SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS} h-9 px-4 text-sm normal-case tracking-normal`}
                >
                  Done
                </button>
              }
            />
          )
        ) : null}

        {phase === "error" && (
          <SessionFinishedScreen
            title="Something went wrong"
            body={error || undefined}
            actions={
              <TapThoughtButton size="md" variant="primary" onClick={backToBriefing}>
                Back
              </TapThoughtButton>
            }
          />
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
