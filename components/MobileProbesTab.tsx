"use client";

import { useEffect, useMemo, useState } from "react";
import { type Probe, type SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { isProbeTyped, markProbeTyped } from "@/lib/welcomeState";
import { SessionOnboardingGuide } from "./SessionOnboardingGuide";
import { TutorBackground } from "./TutorBackground";
import { ListenButton } from "./ListenButton";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ThinkAloudTraces } from "./ThinkAloudTraces";
import { type ThinkAloudThought } from "@/lib/useThinkAloudTranscript";

interface MobileProbesTabProps {
  probes: Probe[];
  sessionPlan?: SessionPlan | null;
  activeChapterIndex?: number;
  onActiveChapterIndexChange?: (index: number) => void;
  onArchiveProbe?: (probeId: string) => Promise<void>;
  onToggleFocus?: (probeId: string, focused: boolean) => void;
  onOpenResources?: (text: string) => void;
  onOpenPractice?: (text: string) => void;
  onAskAssistant?: (text: string) => void;
  onAdvanceStep?: (forceAdvance?: boolean) => Promise<void> | void;
  stuckCheckText?: string | null;
  onDismissStuckCheck?: () => void;
  onShareScreen?: () => void;
  /**
   * Destructive — archives every active probe for this session and
   * generates a fresh one for the current plan step. Called with user
   * confirmation only.
   */
  onResetProbes?: () => Promise<void>;
  archivingProbeId?: string | null;
  isGeneratingProbe?: boolean;
  tutorName?: string;
  /** Show the fresh-session onboarding guide + Start button. */
  showWelcome?: boolean;
  onWelcomePlay?: () => void;
  isStartingSession?: boolean;
  welcomeResetKey?: number;
  /** Session id — used to gate the one-time TTS narration of the welcome. */
  sessionId?: string;
  /** BCP-47 language override for TTS. */
  ttsLanguage?: string;
  /** True while recording + not paused — gates destructive reset. */
  isSessionActive?: boolean;
  /** True while the mic picks up speech-level audio. Drives the
   *  background tile-reveal animation. */
  isSpeaking?: boolean;
  thinkAloudThoughts?: ThinkAloudThought[];
  thinkAloudInterimText?: string;
  thinkAloudListening?: boolean;
  thinkAloudSupported?: boolean;
  thinkAloudError?: string | null;
  onThinkAloudThoughtClick?: (thought: ThinkAloudThought) => void;
  onManualChatSubmit?: (text: string) => void;
  onClearThinkAloudThoughts?: () => void;
  showThinkAloudTraces?: boolean;
  sessionControls?: React.ReactNode;
  aestheticImages?: string[];
  aestheticName?: string;
}

export function MobileProbesTab({
  probes,
  sessionPlan,
  activeChapterIndex,
  onActiveChapterIndexChange,
  onArchiveProbe,
  onOpenResources,
  onOpenPractice,
  onAskAssistant,
  onAdvanceStep,
  stuckCheckText,
  onDismissStuckCheck,
  onShareScreen,
  onResetProbes,
  archivingProbeId,
  isGeneratingProbe = false,
  tutorName,
  showWelcome = false,
  onWelcomePlay,
  isStartingSession = false,
  welcomeResetKey = 0,
  sessionId,
  ttsLanguage,
  isSessionActive = false,
  isSpeaking = false,
  thinkAloudThoughts = [],
  thinkAloudInterimText = "",
  thinkAloudListening = false,
  thinkAloudSupported = false,
  thinkAloudError,
  onThinkAloudThoughtClick,
  onManualChatSubmit,
  onClearThinkAloudThoughts,
  showThinkAloudTraces = true,
  sessionControls,
  aestheticImages,
  aestheticName,
}: MobileProbesTabProps) {
  const { t } = useI18n();

  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);
  const planSteps = sessionPlan?.steps ?? [];

  const [uncontrolledCurrentIndex, setUncontrolledCurrentIndex] = useState(0);
  const currentIndex = activeChapterIndex ?? uncontrolledCurrentIndex;
  const setCurrentIndex = onActiveChapterIndexChange ?? setUncontrolledCurrentIndex;
  const [resettingProbes, setResettingProbes] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Reset Helios — destructive. We archive every active probe and blow
  // away the guiding-question chain Helios has built up for this
  // session, so we require explicit confirmation through the shared
  // ConfirmDialog (matches desktop).
  const handleResetHelios = () => {
    if (!onResetProbes || resettingProbes) return;
    setResetConfirmOpen(true);
  };

  const confirmResetHelios = async () => {
    if (!onResetProbes || resettingProbes) return;
    setResetConfirmOpen(false);
    setResettingProbes(true);
    try {
      await onResetProbes();
    } finally {
      setResettingProbes(false);
    }
  };

  // Keep index in bounds when list changes
  useEffect(() => {
    if (currentIndex >= planSteps.length && planSteps.length > 0) {
      setCurrentIndex(planSteps.length - 1);
    } else if (planSteps.length === 0) {
      setCurrentIndex(0);
    }
  }, [planSteps.length, currentIndex]);

  const displayTutorName = tutorName || t('probes.tutor');
  const currentStep = planSteps[currentIndex];
  const currentStepText = currentStep?.description ?? "";
  const currentStepId = currentStep?.id ?? `step-${currentIndex}`;
  const isCurrentPlanStep = true;
  const isCurrentStepCompleted = currentStep?.status === "completed";
  const total = Math.max(planSteps.length, 1);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < planSteps.length - 1;

  const goPrev = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const goNext = () => setCurrentIndex(Math.min(planSteps.length - 1, currentIndex + 1));

  const avatarInitial = displayTutorName.charAt(0).toUpperCase();

  const handleDone = async () => {
    if (!onAdvanceStep || advancing) return;
    setAdvancing(true);
    try {
      await onAdvanceStep();
    } finally {
      setAdvancing(false);
    }
  };

  // Typewriter for the currently-shown probe
  const currentProbeId = currentStepId;
  const [probeTypingDone, setProbeTypingDone] = useState(true);
  const alreadyTyped = currentProbeId ? isProbeTyped(currentProbeId) : true;
  const { displayed: probeDisplayed } = useTypewriter(currentStepText, {
    instant: alreadyTyped,
    speedMs: 45,
    enabled: !!currentStep,
    onDone: () => {
      if (currentProbeId) markProbeTyped(currentProbeId);
      setProbeTypingDone(true);
    },
  });

  useEffect(() => {
    if (!currentProbeId) {
      setProbeTypingDone(true);
    } else {
      setProbeTypingDone(isProbeTyped(currentProbeId));
    }
  }, [currentProbeId]);

  const actionButtonClass = `py-2.5 px-2 text-[11px] font-medium rounded-md border disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center ${
    stuckCheckText
      ? "bg-red-500/10 border-red-400/35 text-red-100 active:bg-red-500/15"
      : "bg-neutral-800 border-neutral-700 text-neutral-200 active:bg-neutral-700"
  }`;

  // Fresh-session welcome takes precedence over the empty state
  // Parent-controlled welcome surface — overrides the probe carousel so
  // the Help button can re-open the welcome mid-session.
  if (showWelcome) {
    return (
      <div className="relative flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
        <TutorBackground isSpeaking={isSpeaking} stepIndex={sessionPlan?.currentStepIndex} images={aestheticImages} />
        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
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
        {aestheticName && (
          <div className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700">
            {aestheticName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
      {/* Faint frosted-glass background image — one random pick per session. */}
      <TutorBackground isSpeaking={isSpeaking} stepIndex={sessionPlan?.currentStepIndex} images={aestheticImages} />

      {/* Main message area */}
      {sessionControls && (
        <div className="relative z-10 shrink-0 px-3 pt-3">
          {sessionControls}
        </div>
      )}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col px-3 py-3 overflow-hidden">
        {!currentStep ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center overflow-y-auto">
            {/* Silent tutor avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center opacity-50">
                <span className="text-2xl font-serif text-neutral-600">{avatarInitial}</span>
              </div>
            </div>
            {isGeneratingProbe ? (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border border-neutral-700 border-t-amber-500/70 rounded-full animate-spin" />
                <span className="text-xs text-neutral-500">{t('probes.generatingProbe')}</span>
              </div>
            ) : (
              <p className="text-xs text-neutral-600 max-w-[240px]">
                {t('probes.waitingForTutor')}
              </p>
            )}
            {/* Reset Helios — allow forcing a fresh probe even when the panel
                is empty (e.g., the tutor stalled or we want a different
                question). The handler already handles the zero-probe case. */}
            {false && onResetProbes && !isGeneratingProbe && (
              <button
                onClick={handleResetHelios}
                disabled={resettingProbes}
                aria-label="Reset Helios"
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-xs text-neutral-300 active:text-neutral-100 active:border-neutral-600 active:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resettingProbes ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span>Reset {displayTutorName}</span>
              </button>
            )}
            {showThinkAloudTraces && <ThinkAloudTraces
              thoughts={thinkAloudThoughts}
              interimText={thinkAloudInterimText}
              isListening={thinkAloudListening}
              isSupported={thinkAloudSupported}
              error={thinkAloudError}
              onThoughtClick={(thought) => onThinkAloudThoughtClick?.(thought)}
              onManualSubmit={onManualChatSubmit}
              onClearThoughts={onClearThinkAloudThoughts}
              compact
            />}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 overflow-y-auto overscroll-contain pb-2">
            {/* Tutor + message group — compact enough for small screens. */}
            <div className="flex flex-col items-center gap-3">
              {/* Avatar + flanking red nav arrows. The arrows replace the
                  edge-anchored grey chevrons and act as a notification
                  cue: they appear red-tinted only while active probes
                  exist, drawing the eye toward the tutor's new guidance. */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-red-100/90">
                  Chapter {currentIndex + 1}
                </div>
                <div className="flex items-center gap-3">
                  {/* Left arrow — floats next to avatar */}
                  <button
                    onClick={canGoPrev ? goPrev : undefined}
                    disabled={!canGoPrev}
                    aria-label={t('probes.previous')}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                      canGoPrev
                        ? "bg-red-500/15 border-red-500/60 text-red-300 active:bg-red-500/25 active:text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                        : "bg-neutral-900/40 border-neutral-800 text-neutral-700 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Avatar with notification ring + badge */}
                  <div className="relative">
                    <div
                      className={`w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 border flex items-center justify-center overflow-hidden transition-colors ${
                        isCurrentPlanStep
                          ? "border-red-500/70 ring-2 ring-red-500/40 ring-offset-2 ring-offset-[#0a0a0a]"
                          : "border-neutral-800"
                      }`}
                    >
                      <span className="text-2xl font-serif text-neutral-200">{avatarInitial}</span>
                    </div>
                    {/* Soft glow — shifts red when notifications are active */}
                    <div
                      className={`absolute inset-0 rounded-full pointer-events-none ${
                        isCurrentPlanStep
                          ? "shadow-[0_0_32px_rgba(239,68,68,0.35)]"
                          : "shadow-[0_0_30px_rgba(245,158,11,0.08)]"
                      }`}
                    />
                  </div>

                  {/* Right arrow — floats next to avatar */}
                  <button
                    onClick={canGoNext ? goNext : undefined}
                    disabled={!canGoNext}
                    aria-label={t('probes.next')}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                      canGoNext
                        ? "bg-red-500/15 border-red-500/60 text-red-300 active:bg-red-500/25 active:text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                        : "bg-neutral-900/40 border-neutral-800 text-neutral-700 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-200">{displayTutorName}</span>
                    {false && onResetProbes && (
                      <button
                        onClick={handleResetHelios}
                        disabled={resettingProbes}
                        aria-label="Reset Helios"
                        className="p-1.5 rounded-md text-neutral-400 active:text-neutral-100 active:bg-neutral-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {resettingProbes ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {planSteps.length > 0 && (
                    <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-neutral-800" aria-label={`Step ${currentIndex + 1} of ${total}`}>
                      <div
                        className="h-full rounded-full bg-red-400 transition-all duration-300 ease-out"
                        style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* The message */}
              <div className="relative max-w-[38ch] px-2">
                <span
                  className="absolute -top-3 -left-1 text-4xl font-serif text-neutral-800 select-none pointer-events-none leading-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <p className="relative text-base leading-relaxed tracking-tight text-center text-neutral-200">
                  {probeDisplayed}
                  {!probeTypingDone && (
                    <span
                      className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-0.5 bg-amber-400/80 animate-pulse"
                      aria-hidden="true"
                    />
                  )}
                </p>
              </div>

              {/* Listen-to-tutor TTS. cacheKey bound to the probe id so
                  navigating probes invalidates the cached audio. */}
              <div className="scale-90 origin-center">
                <ListenButton
                  text={currentStepText}
                  language={ttsLanguage}
                  cacheKey={`step:${currentStepId}`}
                />
              </div>
            </div>

            {/* Action row */}
            <div className="shrink-0 pt-1">
              {isCurrentStepCompleted ? (
                <div className="rounded-md border border-neutral-800 bg-neutral-950/40 px-4 py-3 text-center text-sm font-medium text-neutral-200">
                  Chapter Completed - check next chapter
                </div>
              ) : (
                <>
                  <div className={`grid grid-cols-4 gap-1.5 rounded-md border p-1.5 transition-colors ${stuckCheckText ? "border-red-400/40 bg-red-500/10" : "border-neutral-800 bg-neutral-950/40"}`}>
                    {stuckCheckText && (
                      <div className="col-span-4 flex items-start justify-between gap-2 rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                        <p className="leading-relaxed">{stuckCheckText}</p>
                        <button type="button" onClick={onDismissStuckCheck} className="shrink-0 rounded-md px-2 py-1 text-[11px] text-red-100/80 active:bg-red-300/10">{t("common.dismiss")}</button>
                      </div>
                    )}
                    <button
                      onClick={() => onOpenResources?.(currentStepText)}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.resources')}
                      className={actionButtonClass}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onOpenPractice?.(currentStepText)}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.practice')}
                      className={actionButtonClass}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onAskAssistant?.(currentStepText)}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.ask')}
                      className={actionButtonClass}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onShareScreen?.()}
                      disabled={!isSessionActive}
                      title={t('probes.shareScreen')}
                      className={actionButtonClass}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={handleDone}
                    disabled={advancing || !isSessionActive || isCurrentStepCompleted || !!stuckCheckText}
                    title={t('session.markAsDone')}
                    className="mt-2 w-full py-2.5 px-3 text-xs font-medium rounded-md bg-neutral-100 text-neutral-900 active:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                  >
                    {advancing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('sessionPlan.evaluating')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{t('session.markAsDone')}</span>
                      </>
                    )}
                  </button>

                  {showThinkAloudTraces && <div className="mt-3 min-w-0">
                    <ThinkAloudTraces
                      thoughts={thinkAloudThoughts}
                      interimText={thinkAloudInterimText}
                      isListening={thinkAloudListening}
                      isSupported={thinkAloudSupported}
                      error={thinkAloudError}
                      onThoughtClick={(thought) => onThinkAloudThoughtClick?.(thought)}
                      onManualSubmit={onManualChatSubmit}
                      onClearThoughts={onClearThinkAloudThoughts}
                      compact
                    />
                  </div>}
                </>
              )}

              {/* Carousel dots — always rendered (placeholders for empty
                  slots) so the row reserves its vertical space and the
                  action button above doesn't shift when probes are added. */}
              <div className="flex items-center justify-center gap-1.5 mt-3 h-1.5">
                {planSteps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex
                        ? "w-5 bg-neutral-300"
                        : "w-1.5 bg-neutral-700 active:bg-neutral-600"
                    }`}
                    aria-label={t("probes.goToStep", { number: i + 1 })}
                  />
                ))}
              </div>

            </div>
          </div>
        )}
      </div>
      <a
        href="https://x.com/piotrbinkowski"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700 hover:text-neutral-500 transition-colors"
      >
        Art by Piotr Binkowski
      </a>

      {/* Reset Helios confirmation — see desktop twin for rationale. */}
      <ConfirmDialog
        open={resetConfirmOpen}
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={confirmResetHelios}
        variant="destructive"
        title="Reset Helios?"
        description={
          activeProbes.length > 0
            ? `This will permanently archive the ${activeProbes.length} current ${activeProbes.length === 1 ? "probe" : "probes"} and generate a fresh question for the current step. This action cannot be undone.`
            : "This will generate a fresh question for the current step. Any in-flight probe will be archived."
        }
        confirmLabel="Reset Helios"
        cancelLabel="Cancel"
      />
    </div>
  );
}
