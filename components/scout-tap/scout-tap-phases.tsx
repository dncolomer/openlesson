"use client";

import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { CalibrateLiveSurface } from "@/components/calibrate/calibrate-live-surface";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type { SpokenLocale } from "@/lib/tutoring-languages";
import { coerceSpokenLocale } from "@/lib/tutoring-languages";
import { type Phase } from "@/lib/tap-score-client-helpers";
import { tapWorkCanvasBoardId } from "@/lib/tap-work-canvas";
import type { IleWorkCanvasElement, IleWorkCanvasScene } from "@/lib/ile-work-canvas";
import type { IleWorkCanvasPowEvent } from "@/lib/ile-work-canvas-pow";
import {
  calibrateRegionCounts,
  canFinishClassifying,
  canFinishComfortableAnswer,
  canFinishUncertainty,
  readCalibrateResponseTexts,
  type CalibrateState,
} from "@/lib/calibrate-session";
import { scoutThinkAloudEnabled, type ScoutThankYouActions } from "@/lib/scout-session";
import type { MutableRefObject } from "react";

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
  clockPaused?: boolean;
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
  onCanvasPowActions: (events: IleWorkCanvasPowEvent[]) => void;
  calibrate: CalibrateState;
  seedText: string;
  questionsLoading: boolean;
  onAdvance: () => void;
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
    clockPaused = false,
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
    onCanvasPowActions,
    calibrate,
    seedText,
    questionsLoading,
    onAdvance,
    thankYouActions,
    onJumpWork,
    onJumpDrill,
    onBackWorkspace,
  } = props;

  void scoutThinkAloudEnabled();

  const counts = calibrateRegionCounts(calibrate);
  const texts = readCalibrateResponseTexts(workCanvasScene, calibrate);
  const canAdvance =
    calibrate.phase === "classifying"
      ? canFinishClassifying(calibrate)
      : calibrate.phase === "answer"
        ? canFinishComfortableAnswer(calibrate, texts)
        : calibrate.phase === "explain"
          ? canFinishUncertainty(calibrate, texts)
          : false;

  return (
    <main
      className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white selection:bg-zinc-700"
      data-scout-session
      data-scout-think-aloud={String(scoutThinkAloudEnabled())}
    >
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && isStartingSession ? (
          <SessionPageLoading message={t("session.startLoading")} />
        ) : null}

        {phase === "briefing" && !isStartingSession && (
          <section className="relative flex min-h-0 flex-1" data-scout-briefing data-tap-briefing-layout="sections">
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
                <SessionOnboardingGuide
                  variant="scout"
                  hideStep3Quote
                  showStartAction
                  isStarting={isStartingSession}
                  onStart={() => void startSession()}
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
            <CalibrateLiveSurface
              boardId={tapWorkCanvasBoardId(tapSessionId || sessionId)}
              phase={calibrate.phase}
              poolLoading={questionsLoading}
              comfortableCount={counts.comfortable}
              unconfidentCount={counts.unconfident}
              canAdvance={canAdvance}
              readOnly={false}
              scene={workCanvasScene}
              sceneRef={workCanvasSceneRef}
              applyElements={canvasApplyElements}
              applyNonce={canvasApplyNonce}
              onSceneChange={handleSceneChange}
              onCanvasPowActions={onCanvasPowActions}
              onAdvance={onAdvance}
              error={error}
              clock={
                <div
                  className="flex w-full min-w-0 flex-col gap-2 px-1 py-1"
                  data-scout-live-control-strip
                >
                  <TapLiveClock
                    label="Time left"
                    remainingSeconds={remainingSeconds}
                    waiting={clockPaused || questionsLoading}
                    listening={false}
                    placement="card"
                  />
                </div>
              }
              actions={
                showEndSession ? (
                  <div className="flex w-full min-w-0" data-scout-end-session>
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
              topicId="calibrate"
              topicText={seedText}
              focusLabel={t("scout.live.questionsHeading")}
            />
          </section>
        )}

        {phase === "saving" ? (
          <SessionPageLoading message={t("tap.postSession.savingAndReturning")} />
        ) : null}

        {phase === "results" ? (
          <SessionFinishedScreen
            data-scout-thank-you=""
            data-tap-session-thank-you=""
            title={t("scout.thankYou.title")}
            body={t("scout.thankYou.body")}
            actions={
              <>
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
              </>
            }
          />
        ) : null}

        {phase === "error" && (
          <SessionFinishedScreen
            title="Could not end the calibration session"
            body={resultsError || error}
            actions={
              <TapThoughtButton size="md" variant="primary" onClick={() => setPhase("briefing")}>
                Try again
              </TapThoughtButton>
            }
          />
        )}
      </div>
    </main>
  );
}
