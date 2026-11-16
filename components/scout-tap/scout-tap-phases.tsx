"use client";

import type { ReactNode } from "react";
import { PracticeVoiceChallenge } from "@/components/PracticeVoiceChallenge";
import { CalibrateSoundingSurface } from "@/components/calibrate/calibrate-sounding-surface";
import { ProductFlowSetupScreen } from "@/components/session-view/product-flow-setup-screen";
import type { AestheticPackage } from "@/lib/aesthetics";
import { SessionFinishedScreen } from "@/components/session-view/session-finished-screen";
import { SessionGuidePanel } from "@/components/session-view/session-guide-panel";
import { SessionWorkSurface } from "@/components/session-view/session-work-surface";
import { SessionTopicChapter } from "@/components/session-view/learn-work-dock-bar";
import { TapSessionSignals } from "@/components/session-view/session-signals";
import { IleStartLoading } from "@/components/session-view/learn-start-loading";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
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
  aestheticPackages: AestheticPackage[];
  aestheticsLoading: boolean;
  selectedAestheticId: string | null;
  selectedAesthetic: AestheticPackage | undefined;
  onSelectAesthetic: (id: string) => void;
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
  onSettingsBackToWorkspace?: () => void;
}) {
  const {
    phase,
    bgImage,
    t,
    workspaceTitle,
    conversationLanguage,
    setConversationLanguage,
    aestheticPackages,
    aestheticsLoading,
    selectedAestheticId,
    selectedAesthetic,
    onSelectAesthetic,
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
    setPhase,
    sounding,
    onCommitTaps,
    onSubmitProof,
    proofBusy = false,
    onSettingsBackToWorkspace,
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
          <div
            data-scout-briefing=""
            data-tap-briefing-layout="sections"
            data-calibrate-start=""
            data-onboarding-start=""
            className="flex min-h-0 flex-1 flex-col"
          >
            <ProductFlowSetupScreen
              t={t}
              title={FLOW_END_KICKERS.calibrate}
              tutoringLanguage={conversationLanguage}
              onTutoringLanguageChange={(locale) =>
                setConversationLanguage(coerceSpokenLocale(locale))
              }
              aestheticPackages={aestheticPackages}
              selectedAesthetic={selectedAesthetic}
              selectedAestheticId={selectedAestheticId}
              onSelectAesthetic={onSelectAesthetic}
              aestheticsLoading={aestheticsLoading}
              isPreparing={isStartingSession}
              planError={error || null}
              onConfirm={confirmStart}
              onBackToWorkspace={onSettingsBackToWorkspace}
            />
          </div>
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
              title={t("scout.thankYou.title")}
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
  title,
  actions,
}: {
  title: string;
  actions: ReactNode;
}) {
  return (
    <SessionFinishedScreen
      kicker={FLOW_END_KICKERS.calibrate}
      title={title}
      frameLabel={null}
      actions={actions}
    />
  );
}
