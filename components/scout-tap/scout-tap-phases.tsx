"use client";

import { WorkCanvas } from "@/components/ExcalidrawCanvas";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import {
  prepareBriefingStep,
  releaseVoiceChallengeStartLatch,
  voiceChallengeStartSucceeded,
} from "@/lib/practice-voice-challenge";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type { SpokenLocale } from "@/lib/tutoring-languages";
import { coerceSpokenLocale } from "@/lib/tutoring-languages";
import {
  type Phase,
  formatCountdown,
} from "@/lib/tap-score-client-helpers";
import {
  tapWorkCanvasBoardId,
  tapWorkCanvasShouldAcceptSceneUpdate,
} from "@/lib/tap-work-canvas";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";
import {
  canGoBackScoutNode,
  scoutCurrentNode,
  scoutThinkAloudEnabled,
  type ScoutLiveState,
  type ScoutThankYouActions,
} from "@/lib/scout-session";
import { useEffect, useRef, useState, type MutableRefObject } from "react";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function ScoutTapPhases(props: {
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
  error: string;
  startSession: () => void;
  participantIdentity: PowParticipantIdentity | null;
  remainingSeconds: number;
  showEndSession: boolean;
  endSession: () => void;
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  tapSessionId?: string | null;
  resultsError: string;
  restartBriefingFlow: () => void;
  setPhase: (phase: Phase) => void;
  workCanvasSceneRef: MutableRefObject<IleWorkCanvasScene | null>;
  workCanvasScene: IleWorkCanvasScene;
  canvasApplyElements: IleWorkCanvasElement[];
  canvasApplyNonce: number;
  handleSceneChange: (scene: IleWorkCanvasScene) => void;
  scoutState: ScoutLiveState;
  questionsLoading: boolean;
  onPickQuestion: (index: number) => void;
  onGoBack: () => void;
  thankYouActions: ScoutThankYouActions;
  onJumpWork: () => void;
  onJumpDrill: () => void;
  onBackWorkspace: () => void;
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
    error,
    startSession,
    participantIdentity: _participantIdentity,
    remainingSeconds,
    showEndSession,
    endSession,
    tapSessionId,
    sessionId,
    resultsError,
    restartBriefingFlow,
    setPhase,
    workCanvasSceneRef,
    workCanvasScene,
    canvasApplyElements,
    canvasApplyNonce,
    handleSceneChange,
    scoutState,
    questionsLoading,
    onPickQuestion,
    onGoBack,
    thankYouActions,
    onJumpWork,
    onJumpDrill,
    onBackWorkspace,
  } = props;

  void scoutThinkAloudEnabled();

  const [startConfirmed, setStartConfirmed] = useState(false);
  const passGuard = useRef(false);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  useEffect(() => {
    if (phase !== "briefing") {
      setStartConfirmed(false);
      passGuard.current = false;
    }
  }, [phase]);

  function confirmPrepareStart() {
    const step = prepareBriefingStep({ startConfirmed: true, challengePassed: false });
    if (step === "challenge") setStartConfirmed(true);
  }

  function passPrepareChallenge() {
    if (passGuard.current) return;
    const step = prepareBriefingStep({ startConfirmed: true, challengePassed: true });
    if (step !== "live") return;
    passGuard.current = true;
    void Promise.resolve(startSession()).then((result) => {
      const release = releaseVoiceChallengeStartLatch({
        startSucceeded: voiceChallengeStartSucceeded(result),
      });
      if (!release.release) return;
      passGuard.current = false;
      setChallengeAttempt((attempt) => attempt + 1);
    });
  }

  const prepareStep = prepareBriefingStep({
    startConfirmed,
    challengePassed: false,
  });

  const current = scoutCurrentNode(scoutState);
  const canGoBack = canGoBackScoutNode(scoutState);
  const readOnly = phase === "results" || phase === "practice_done";

  const canvasPane = (
    <div
      data-scout-work-canvas-pane
      data-scout-canvas-readonly={readOnly ? "true" : "false"}
      className="relative min-h-0 min-w-0 overflow-hidden border-b border-neutral-800/60 lg:border-b-0 lg:border-r"
    >
      <WorkCanvas
        key={`scout-work-canvas:${phase}`}
        boardId={tapWorkCanvasBoardId(tapSessionId || sessionId)}
        initialSceneData={workCanvasScene}
        applyElements={canvasApplyElements}
        applyElementsNonce={canvasApplyNonce}
        viewModeEnabled={readOnly}
        heliosBusy={false}
        onSceneChange={(scene) => {
          if (readOnly) return;
          if (!tapWorkCanvasShouldAcceptSceneUpdate(workCanvasSceneRef.current, scene)) {
            return;
          }
          handleSceneChange(scene);
        }}
        onCanvasPowActions={() => {}}
        onAskSelected={async () => ({ text: "" })}
      />
      {error ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 px-3 text-center text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );

  const questionButtons = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-scout-questions-list>
      {canGoBack ? (
        <div className="shrink-0 px-3 pt-3">
          <button
            type="button"
            data-scout-go-back
            disabled={readOnly}
            onClick={() => onGoBack()}
            className="w-full rounded-none border border-dashed border-white/25 bg-transparent px-3 py-2 text-left text-xs font-medium text-neutral-300 transition hover:border-white/45 hover:text-white disabled:opacity-40"
          >
            {t("scout.live.goBack")}
          </button>
        </div>
      ) : null}
      {questionsLoading ? (
        <div
          className="flex min-h-0 flex-1 items-center justify-center px-4 py-8"
          data-scout-questions-loading
        >
          <LoadingStatusMessage
            message={t("scout.live.generating")}
            size="md"
            tone="light"
            className="text-center"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {scoutState.questions.map((q, index) => (
            <button
              key={`${index}:${q}`}
              type="button"
              data-scout-question={index}
              disabled={readOnly}
              onClick={() => onPickQuestion(index)}
              className="rounded-none border border-white/20 bg-black/40 px-3 py-2.5 text-left text-sm text-white transition hover:border-white/45 hover:bg-white/5 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main
      className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white selection:bg-zinc-700"
      data-scout-session
      data-scout-think-aloud={String(scoutThinkAloudEnabled())}
    >
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && prepareStep === "challenge" ? (
          <section
            className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0b] px-6"
            data-scout-briefing
            data-scout-voice-challenge=""
            data-prepare-briefing-step="challenge"
          >
            <div className="w-full max-w-xl">
              <PracticeVoiceChallenge key={challengeAttempt} variant="prepare" onPass={passPrepareChallenge} />
              {error ? (
                <p className="mt-4 text-center text-sm text-red-300">{error}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {phase === "briefing" && prepareStep === "confirm" && (
          <section className="relative flex min-h-0 flex-1" data-scout-briefing data-tap-briefing-layout="sections" data-prepare-briefing-step="confirm">
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
                <SessionOnboardingGuide
                  variant="scout"
                  hideStep3Quote
                  showStartAction
                  isStarting={isStartingSession}
                  onStart={confirmPrepareStart}
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
                  kicker={t("scout.briefing.kicker")}
                  title={t("scout.briefing.title")}
                  intro={t("scout.briefing.intro")}
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
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-scout-live>
            <div
              data-scout-live-split
              data-scout-split="70-30"
              className="grid min-h-0 flex-1 grid-rows-[minmax(0,7fr)_minmax(0,3fr)] overflow-hidden lg:grid-cols-[7fr_3fr] lg:grid-rows-1"
            >
              {canvasPane}
              <TapAestheticSection bgImage={bgImage} kind="convo-stash" className="min-h-0 min-w-0">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-scout-questions-pane>
                  <div
                    className="flex w-full shrink-0 items-center gap-3 border-b border-neutral-800/60 bg-black/35 px-3 py-2"
                    data-scout-live-control-strip
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600">
                          Time left
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
                        <div className="flex shrink-0 items-center" data-scout-end-session>
                          <TapThoughtButton size="sm" variant="primary" onClick={() => void endSession()}>
                            End session
                          </TapThoughtButton>
                        </div>
                      ) : null}
                    </div>

                  </div>
                  <div className="border-b border-neutral-800/60 bg-black/35 px-3 py-2" data-scout-seed-topic>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                      {t("scout.live.questionsHeading")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{current.text}</p>
                  </div>
                  {questionButtons}
                </div>
              </TapAestheticSection>
            </div>
          </section>
        )}

        {phase === "saving" ? (
          <section className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage message={t("tap.postSession.savingAndReturning")} />
          </section>
        ) : null}

        {phase === "results" ? (
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            data-scout-thank-you
            data-tap-session-thank-you
          >
            <div className="shrink-0 border-b border-neutral-800/60 px-4 py-4 text-center">
              <h1 className="text-2xl font-medium text-neutral-100">
                {t("scout.thankYou.title")}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-300">
                {t("scout.thankYou.body")}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <TapThoughtButton
                  size="md"
                  variant="primary"
                  data-scout-restart
                  onClick={restartBriefingFlow}
                >
                  {t("scout.thankYou.restart")}
                </TapThoughtButton>
                <TapThoughtButton
                  size="md"
                  data-scout-workspace
                  onClick={onBackWorkspace}
                >
                  {t("scout.thankYou.workspace")}
                </TapThoughtButton>
                {thankYouActions.work ? (
                  <TapThoughtButton size="md" data-scout-jump-work onClick={onJumpWork}>
                    {t("scout.thankYou.work")}
                  </TapThoughtButton>
                ) : null}
                {thankYouActions.drill ? (
                  <TapThoughtButton size="md" data-scout-jump-drill onClick={onJumpDrill}>
                    {t("scout.thankYou.drill")}
                  </TapThoughtButton>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1">{canvasPane}</div>
          </section>
        ) : null}

        {phase === "error" && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-medium">Could not end Scout session</h1>
            <p className="mt-3 max-w-md text-sm text-red-300">{resultsError || error}</p>
            <TapThoughtButton size="md" variant="primary" className="mt-6" onClick={() => setPhase("briefing")}>
              Try again
            </TapThoughtButton>
          </section>
        )}
      </div>
    </main>
  );
}
