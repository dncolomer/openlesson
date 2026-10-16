"use client";

import type { ReactNode } from "react";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { CalibrateSoundingSurface } from "@/components/calibrate/calibrate-sounding-surface";
import { TapBriefingConfig } from "@/components/TapBriefingConfig";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionSoundingResult } from "@/components/session-view/session-sounding-result";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { SessionTopicChapter } from "@/components/session-view/ile-work-dock-bar";
import { TapSessionSignals } from "@/components/session-view/session-signals";
import { IleStartLoading } from "@/components/session-view/ile-start-loading";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import { SessionStartShell } from "@/components/session-view/session-start-shell";
import { TapAestheticSection } from "@/components/tap-score/tap-aesthetic-section";
import { TapLiveClock } from "@/components/tap-score/tap-live-clock";
import { TapThoughtButton } from "@/components/tap-score/tap-thought-button";
import { FLOW_END_KICKERS } from "@/lib/session-stage-progress";
import { SESSION_SIDEBAR_PRIMARY_BUTTON_CLASS } from "@/lib/session-sidebar";
import type { SpokenLocale } from "@/lib/tutoring-languages";
import { coerceSpokenLocale } from "@/lib/tutoring-languages";
import { type Phase } from "@/lib/tap-score-client-helpers";
import { prepareBriefingStep } from "@/lib/practice-voice-challenge";
import { scoutThinkAloudEnabled, type ScoutThankYouActions } from "@/lib/scout-session";
import {
  soundingResultPresentation,
  type SoundingClassification,
  type SoundingState,
} from "@/lib/calibrate-sounding";

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
  confirmStart: () => void;
  passChallenge: () => void;
  startConfirmed: boolean;
  challengePassed: boolean;
  remainingSeconds: number;
  clockPaused?: boolean;
  showEndSession: boolean;
  endSession: () => void;
  resultsError: string;
  restartBriefingFlow: () => void;
  setPhase: (phase: Phase) => void;
  sounding: SoundingState | null;
  onCommitTaps: (tappedIds: readonly string[]) => void;
  onSubmitProof: (transcript: string) => void;
  proofBusy?: boolean;
  classification: SoundingClassification | null;
  thankYouActions: ScoutThankYouActions;
  onJumpWork: () => void;
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
    confirmStart,
    passChallenge,
    startConfirmed,
    challengePassed,
    remainingSeconds,
    clockPaused = false,
    showEndSession,
    endSession,
    resultsError,
    restartBriefingFlow,
    setPhase,
    sounding,
    onCommitTaps,
    onSubmitProof,
    proofBusy = false,
    classification,
    thankYouActions,
    onJumpWork,
    onBackWorkspace,
  } = props;

  void scoutThinkAloudEnabled();
  const briefingStep = prepareBriefingStep({ startConfirmed, challengePassed });

  return (
    <main
      className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0b0b] text-white selection:bg-zinc-700"
      data-scout-session
      data-scout-think-aloud={String(scoutThinkAloudEnabled())}
    >
      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {phase === "briefing" && isStartingSession ? (
          <SessionPageLoading>
            <IleStartLoading t={t} fieldStatus="preparing" />
          </SessionPageLoading>
        ) : null}

        {phase === "briefing" && !isStartingSession && briefingStep === "challenge" ? (
          <section
            className="relative flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0b] px-6"
            data-calibrate-voice-challenge=""
            data-prepare-briefing-step="challenge"
          >
            <div className="w-full max-w-xl">
              <PracticeVoiceChallenge variant="prepare" onPass={passChallenge} />
              {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
            </div>
          </section>
        ) : null}

        {phase === "briefing" && !isStartingSession && briefingStep === "confirm" && (
          <SessionStartShell data-scout-briefing="" data-tap-briefing-layout="sections">
            <div className="grid h-full min-h-0 w-full flex-1 lg:grid-cols-2">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0b] lg:border-r lg:border-neutral-800/60">
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
                  title={t("scout.briefing.title")}
                  intro={t("scout.briefing.intro")}
                  wideLanguage
                />
                <div className="mt-auto shrink-0 border-t border-neutral-800 p-3">
                  <button
                    type="button"
                    data-onboarding-start
                    data-calibrate-start
                    onClick={confirmStart}
                    disabled={isStartingSession}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-none bg-neutral-100 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-900 transition-colors hover:bg-white disabled:cursor-wait disabled:bg-neutral-800 disabled:text-neutral-500"
                  >
                    {isStartingSession ? t("onboardingGuide.scout.step3.starting") : t("onboardingGuide.scout.step3.start")}
                  </button>
                </div>
              </div>
              <TapAestheticSection bgImage={bgImage} kind="shortcuts" />
              {error ? (
                <p className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5 text-center text-sm text-red-300 lg:col-span-2">
                  {error}
                </p>
              ) : null}
            </div>
          </SessionStartShell>
        )}

        {phase === "live" && sounding ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden" data-scout-live>
            <SessionWorkSurface
              mode="calibrate"
              stage={
                <CalibrateSoundingSurface
                  sounding={sounding}
                  error={error}
                  proofBusy={proofBusy}
                  onCommitTaps={onCommitTaps}
                  onSubmitProof={onSubmitProof}
                />
              }
              clock={
                <div
                  className="flex w-full min-w-0 flex-col gap-2 px-1 py-1"
                  data-scout-live-control-strip
                >
                  <TapLiveClock
                    label="Time left"
                    remainingSeconds={remainingSeconds}
                    waiting={clockPaused}
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
              chapters={
                <SessionTopicChapter id="calibrate" keyword={workspaceTitle} image={bgImage} />
              }
              signals={<TapSessionSignals />}
              focus={<SessionGuidePanel guide="calibrate" />}
            />
          </section>
        ) : null}

        {phase === "saving" ? (
          <SessionPageLoading message={t("tap.postSession.savingAndReturning")} />
        ) : null}

        {phase === "results" ? (
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            data-scout-thank-you=""
            data-tap-session-thank-you=""
          >
            <ScoutSoundingFinished
              classification={classification}
              fallbackTitle={t("scout.thankYou.title")}
              fallbackBody={t("scout.thankYou.body")}
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
                </>
              }
            />
          </section>
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

function ScoutSoundingFinished({
  classification,
  fallbackTitle,
  fallbackBody,
  actions,
}: {
  classification: SoundingClassification | null;
  fallbackTitle: string;
  fallbackBody: string;
  actions: ReactNode;
}) {
  const presentation = soundingResultPresentation(classification);
  return (
    <SessionFinishedScreen
      kicker={presentation?.kicker ?? FLOW_END_KICKERS.calibrate}
      title={presentation?.title ?? fallbackTitle}
      body={presentation?.body ?? fallbackBody}
      frameLabel={null}
      actions={actions}
    >
      <SessionSoundingResult classification={classification} />
    </SessionFinishedScreen>
  );
}
