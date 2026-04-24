"use client";

import { useEffect, useMemo, useState } from "react";
import { type Probe, type SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { isProbeTyped, markProbeTyped } from "@/lib/welcomeState";
import { TutorWelcome } from "./TutorWelcome";
import { TutorBackground } from "./TutorBackground";
import { ListenButton } from "./ListenButton";
import { ConfirmDialog } from "./ui/ConfirmDialog";

const MAX_PROBES = 5;

interface MobileProbesTabProps {
  probes: Probe[];
  sessionPlan?: SessionPlan | null;
  onArchiveProbe?: (probeId: string) => Promise<void>;
  onToggleFocus?: (probeId: string, focused: boolean) => void;
  /**
   * Destructive — archives every active probe for this session and
   * generates a fresh one for the current plan step. Called with user
   * confirmation only.
   */
  onResetProbes?: () => Promise<void>;
  archivingProbeId?: string | null;
  isGeneratingProbe?: boolean;
  tutorName?: string;
  /** Show the fresh-session typed welcome + Play button. */
  showWelcome?: boolean;
  onWelcomePlay?: () => void;
  onOpenSessionPlan?: () => void;
  isStartingSession?: boolean;
  /** Session id — used to gate the one-time TTS narration of the welcome. */
  sessionId?: string;
  /** BCP-47 language override for TTS. */
  ttsLanguage?: string;
  /** True while recording + not paused — gates destructive reset. */
  isSessionActive?: boolean;
}

export function MobileProbesTab({
  probes,
  onArchiveProbe,
  onResetProbes,
  archivingProbeId,
  isGeneratingProbe = false,
  tutorName,
  showWelcome = false,
  onWelcomePlay,
  onOpenSessionPlan,
  isStartingSession = false,
  sessionId,
  ttsLanguage,
  isSessionActive = false,
}: MobileProbesTabProps) {
  const { t } = useI18n();

  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [resettingProbes, setResettingProbes] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

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
    if (currentIndex >= activeProbes.length && activeProbes.length > 0) {
      setCurrentIndex(activeProbes.length - 1);
    } else if (activeProbes.length === 0) {
      setCurrentIndex(0);
    }
  }, [activeProbes.length, currentIndex]);

  const displayTutorName = tutorName || t('probes.tutor');
  const currentProbe = activeProbes[currentIndex];
  const total = Math.max(activeProbes.length, 1);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < activeProbes.length - 1;

  const goPrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(activeProbes.length - 1, i + 1));

  const avatarInitial = displayTutorName.charAt(0).toUpperCase();

  // Typewriter for the currently-shown probe
  const currentProbeId = currentProbe?.id;
  const [probeTypingDone, setProbeTypingDone] = useState(true);
  const alreadyTyped = currentProbeId ? isProbeTyped(currentProbeId) : true;
  const { displayed: probeDisplayed } = useTypewriter(currentProbe?.text ?? "", {
    instant: alreadyTyped,
    speedMs: 45,
    enabled: !!currentProbe,
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

  // Fresh-session welcome takes precedence over the empty state
  // Parent-controlled welcome surface — overrides the probe carousel so
  // the Help button can re-open the welcome mid-session.
  if (showWelcome) {
    return (
      <div className="relative flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
        <TutorBackground />
        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          <TutorWelcome
            tutorName={displayTutorName}
            onPlay={() => onWelcomePlay?.()}
            onOpenSessionPlan={
              onOpenSessionPlan ? () => onOpenSessionPlan() : undefined
            }
            isStarting={isStartingSession}
            sessionId={sessionId}
            ttsLanguage={ttsLanguage}
            compactMobile
          />
        </div>
        <a
          href="https://x.com/piotrbinkowski"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-700 hover:text-neutral-500 transition-colors"
        >
          Art by Piotr Binkowski
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
      {/* Faint frosted-glass background image — one random pick per session. */}
      <TutorBackground />

      {/* Main message area */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col px-4 py-4 overflow-hidden">
        {!currentProbe ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            {/* Silent tutor avatar */}
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center opacity-50">
                <span className="text-3xl font-serif text-neutral-600">{avatarInitial}</span>
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
            {onResetProbes && !isGeneratingProbe && (
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
          </div>
        ) : (
          <>
            {/* Tutor + message group — centered vertically in available space */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 overflow-y-auto">
              {/* Avatar + flanking red nav arrows. The arrows replace the
                  edge-anchored grey chevrons and act as a notification
                  cue: they appear red-tinted only while active probes
                  exist, drawing the eye toward the tutor's new guidance. */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="flex items-center gap-3">
                  {/* Left arrow — floats next to avatar */}
                  <button
                    onClick={canGoPrev ? goPrev : undefined}
                    disabled={!canGoPrev}
                    aria-label={t('probes.previous')}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                      canGoPrev
                        ? "bg-red-500/15 border-red-500/60 text-red-300 active:bg-red-500/25 active:text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                        : "bg-neutral-900/40 border-neutral-800 text-neutral-700 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Avatar with notification ring + badge */}
                  <div className="relative">
                    <div
                      className={`w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 border flex items-center justify-center overflow-hidden transition-colors ${
                        activeProbes.length > 0
                          ? "border-red-500/70 ring-2 ring-red-500/40 ring-offset-2 ring-offset-[#0a0a0a]"
                          : "border-neutral-800"
                      }`}
                    >
                      <span className="text-3xl font-serif text-neutral-200">{avatarInitial}</span>
                    </div>
                    {/* Soft glow — shifts red when notifications are active */}
                    <div
                      className={`absolute inset-0 rounded-full pointer-events-none ${
                        activeProbes.length > 0
                          ? "shadow-[0_0_32px_rgba(239,68,68,0.35)]"
                          : "shadow-[0_0_30px_rgba(245,158,11,0.08)]"
                      }`}
                    />
                    {/* Notification badge — app-style red pill with count */}
                    {activeProbes.length > 0 && (
                      <div
                        className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 border-2 border-[#0a0a0a] flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                        aria-label={`${activeProbes.length} ${t('probes.tutor')}`}
                      >
                        <span className="text-[11px] font-bold text-white tabular-nums leading-none">
                          {activeProbes.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right arrow — floats next to avatar */}
                  <button
                    onClick={canGoNext ? goNext : undefined}
                    disabled={!canGoNext}
                    aria-label={t('probes.next')}
                    className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                      canGoNext
                        ? "bg-red-500/15 border-red-500/60 text-red-300 active:bg-red-500/25 active:text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
                        : "bg-neutral-900/40 border-neutral-800 text-neutral-700 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-200">{displayTutorName}</span>
                    {onResetProbes && (
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
                  {activeProbes.length > 0 && (
                    <span className="font-mono text-[10px] text-white tabular-nums">
                      {String(currentIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                    </span>
                  )}
                </div>
              </div>

              {/* The message */}
              <div className="relative max-w-[52ch] px-2">
                <span
                  className="absolute -top-4 -left-1 text-5xl font-serif text-neutral-800 select-none pointer-events-none leading-none"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <p className="relative text-xl leading-relaxed tracking-tight text-center text-neutral-200">
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
              <ListenButton
                text={currentProbe.text}
                language={ttsLanguage}
                cacheKey={`probe:${currentProbe.id}`}
              />
            </div>

            {/* Action row */}
            <div className="shrink-0 pt-4">
              <button
                onClick={() => onArchiveProbe?.(currentProbe.id)}
                disabled={archivingProbeId === currentProbe.id}
                className="w-full py-3.5 px-4 text-sm font-medium rounded-xl bg-neutral-100 text-neutral-900 active:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {archivingProbeId === currentProbe.id ? (
                  <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span>{t('probes.done')}</span>
              </button>

              {/* Reassurance hint — keep narrating while waiting for the
                  next guiding task. */}
              <p className="mt-2 px-1 text-center text-[11px] leading-snug text-neutral-500">
                {t('probes.thinkAloudHint', { name: displayTutorName })}
              </p>

              {/* Carousel dots — always rendered (placeholders for empty
                  slots) so the row reserves its vertical space and the
                  action button above doesn't shift when probes are added. */}
              <div className="flex items-center justify-center gap-1.5 mt-3 h-1.5">
                {activeProbes.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex
                        ? "w-5 bg-neutral-300"
                        : "w-1.5 bg-neutral-700 active:bg-neutral-600"
                    }`}
                    aria-label={`${t('probes.goToProbe')} ${i + 1}`}
                  />
                ))}
                {Array.from({ length: Math.max(0, MAX_PROBES - activeProbes.length) }).map((_, i) => (
                  <div
                    key={`ph-${i}`}
                    className="h-1.5 w-1.5 rounded-full bg-neutral-900 border border-neutral-800"
                  />
                ))}
              </div>

            </div>
          </>
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
