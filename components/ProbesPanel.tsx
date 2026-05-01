"use client";

import { useEffect, useMemo, useState } from "react";
import { type Probe, type ToolName, type ToolAction } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { isProbeTyped, markProbeTyped } from "@/lib/welcomeState";
import { TutorWelcome } from "./TutorWelcome";
import { TutorBackground } from "./TutorBackground";
import { ListenButton } from "./ListenButton";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ThinkAloudTraces } from "./ThinkAloudTraces";
import { type ThinkAloudThought } from "@/lib/useThinkAloudTranscript";

const MAX_PROBES = 5;

/**
 * Telemetry callback: fires on every user interaction in this panel.
 * SessionView wires this to `logTool("probe", action, metadata)` so events
 * are persisted to Supabase `session_tool` AND surfaced in the Logs UI.
 */
export type ProbesPanelToolEvent = (
  action: ToolAction,
  metadata?: Record<string, unknown>,
) => void;

interface ProbesPanelProps {
  probes: Probe[];
  onArchiveProbe?: (probeId: string) => Promise<void>;
  onToggleFocus?: (probeId: string, focused: boolean) => void;
  onToolSelect?: (tool: ToolName) => void;
  onOpenResources?: (text: string) => void;
  onOpenPractice?: (text: string) => void;
  onAskAssistant?: (text: string) => void;
  thinkAloudThoughts?: ThinkAloudThought[];
  thinkAloudInterimText?: string;
  thinkAloudListening?: boolean;
  thinkAloudSupported?: boolean;
  thinkAloudError?: string | null;
  onThinkAloudThoughtClick?: (thought: ThinkAloudThought) => void;
  onClearThinkAloudThoughts?: () => void;
  /**
   * Clears all active probes for the current session and generates a
   * fresh probe for the current plan step. Destructive — callers should
   * confirm before firing; this panel also asks the user for explicit
   * confirmation before invoking.
   */
  onResetProbes?: () => Promise<void>;
  onToolEvent?: ProbesPanelToolEvent;
  archivingProbeId?: string | null;
  isInitializing?: boolean;
  isGeneratingProbe?: boolean;
  sessionPlan?: {
    steps?: Array<{ id: string; order: number; description: string }>;
    currentStepIndex?: number;
  } | null;
  isSessionActive?: boolean;
  tutorName?: string;
  /**
   * Fresh-session onboarding. When true the panel shows the typed welcome
   * text + Play button instead of the normal empty state. Parent is
   * responsible for tracking welcome-seen state and passing `false` after
   * the user clicks play (or on a refresh after play).
   */
  showWelcome?: boolean;
  /** Fired when the user clicks the welcome Play button. */
  onWelcomePlay?: () => void;
  /** Fired when the user clicks the welcome "Open Session Plan" button. */
  onOpenSessionPlan?: () => void;
  /** Fired when the user clicks the welcome "Open Tools" button. */
  onOpenTools?: () => void;
  /** Parent is currently fetching the opening probe (shows spinner on Play). */
  isStartingSession?: boolean;
  /** Session id — used to gate the one-time TTS narration of the welcome. */
  sessionId?: string;
  /** BCP-47 language override for TTS. */
  ttsLanguage?: string;
  /** True while the mic picks up speech-level audio. Drives the
   *  background tile-reveal animation. */
  isSpeaking?: boolean;
}

export function ProbesPanel({
  probes,
  onArchiveProbe,
  onToolSelect,
  onOpenResources,
  onOpenPractice,
  onAskAssistant,
  thinkAloudThoughts = [],
  thinkAloudInterimText = "",
  thinkAloudListening = false,
  thinkAloudSupported = false,
  thinkAloudError,
  onThinkAloudThoughtClick,
  onClearThinkAloudThoughts,
  onResetProbes,
  onToolEvent,
  archivingProbeId,
  isInitializing = false,
  isGeneratingProbe = false,
  sessionPlan,
  isSessionActive = false,
  tutorName,
  showWelcome = false,
  onWelcomePlay,
  onOpenSessionPlan,
  onOpenTools,
  isStartingSession = false,
  sessionId,
  ttsLanguage,
  isSpeaking = false,
}: ProbesPanelProps) {
  const { t } = useI18n();

  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [resettingProbes, setResettingProbes] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Reset Helios — destructive. Archives every active probe in this
  // session and generates a fresh one for the current plan step. We
  // require explicit confirmation because users lose the chain of
  // guiding questions Helios has built up.
  const handleResetHelios = () => {
    if (!onResetProbes || resettingProbes) return;
    setResetConfirmOpen(true);
  };

  const confirmResetHelios = async () => {
    if (!onResetProbes || resettingProbes) return;
    const probeCount = activeProbes.length;
    onToolEvent?.("reset", {
      activeProbesCleared: probeCount,
      currentProbeId: activeProbes[currentIndex]?.id,
    });
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

  const goPrev = () => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    onToolEvent?.("nav_prev", {
      fromIndex: currentIndex,
      total: activeProbes.length,
      probeId: activeProbes[currentIndex]?.id,
    });
  };
  const goNext = () => {
    setCurrentIndex((i) => Math.min(activeProbes.length - 1, i + 1));
    onToolEvent?.("nav_next", {
      fromIndex: currentIndex,
      total: activeProbes.length,
      probeId: activeProbes[currentIndex]?.id,
    });
  };

  // Tutor avatar — stylized monogram placeholder
  const avatarInitial = displayTutorName.charAt(0).toUpperCase();

  // Typewriter for the currently-shown probe. Only animates probes the user
  // hasn't seen before; revisits render instantly.
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

  // Reset the "done" flag whenever we move to a new, un-typed probe
  useEffect(() => {
    if (!currentProbeId) {
      setProbeTypingDone(true);
    } else {
      setProbeTypingDone(isProbeTyped(currentProbeId));
    }
  }, [currentProbeId]);

  // Parent-controlled welcome surface. Takes precedence over both the
  // empty state and the active-probe carousel — this lets the Help
  // button re-open the welcome even when probes already exist.
  if (showWelcome) {
    return (
      <div className="relative flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
        {/* Faint frosted-glass background image — one random pick per session. */}
        <TutorBackground isSpeaking={isSpeaking} stepIndex={sessionPlan?.currentStepIndex} />
        <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">
          <TutorWelcome
            tutorName={displayTutorName}
            onPlay={() => onWelcomePlay?.()}
            onOpenSessionPlan={
              onOpenSessionPlan ? () => onOpenSessionPlan() : undefined
            }
            onOpenTools={
              onOpenTools ? () => onOpenTools() : undefined
            }
            isStarting={isStartingSession}
            sessionId={sessionId}
            ttsLanguage={ttsLanguage}
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
      <TutorBackground isSpeaking={isSpeaking} stepIndex={sessionPlan?.currentStepIndex} />

      {/* Main message area */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col px-4 py-4 overflow-hidden">
        {isInitializing && activeProbes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border border-neutral-800 border-t-amber-500/70 rounded-full animate-spin" />
            <p className="text-xs text-neutral-500">{t('probes.preparing')}</p>
          </div>
        ) : !currentProbe ? (
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
            {onResetProbes && isSessionActive && !isGeneratingProbe && (
              <button
                onClick={handleResetHelios}
                disabled={resettingProbes}
                title="Reset Helios — generates a fresh question for the current step"
                aria-label="Reset Helios"
                className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-neutral-800 text-[11px] text-neutral-500 hover:text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resettingProbes ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span>Reset {displayTutorName}</span>
              </button>
            )}
            <div className="w-full max-w-[680px] px-2">
              <ThinkAloudTraces
                thoughts={thinkAloudThoughts}
                interimText={thinkAloudInterimText}
                isListening={thinkAloudListening}
                isSupported={thinkAloudSupported}
                error={thinkAloudError}
                onThoughtClick={(thought) => onThinkAloudThoughtClick?.(thought)}
                onClearThoughts={onClearThinkAloudThoughts}
              />
            </div>
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
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                      canGoPrev
                        ? "bg-red-500/15 border-red-500/60 text-red-300 hover:bg-red-500/25 hover:text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
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
                    className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                      canGoNext
                        ? "bg-red-500/15 border-red-500/60 text-red-300 hover:bg-red-500/25 hover:text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
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
                    {onResetProbes && isSessionActive && (
                      <button
                        onClick={handleResetHelios}
                        disabled={resettingProbes}
                        title="Reset Helios — clears all active probes and generates a fresh one"
                        aria-label="Reset Helios"
                        className="p-1 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {resettingProbes ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                {/* Subtle decorative quote mark */}
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

              {/* Listen-to-tutor TTS for the current probe. cacheKey bound
                  to the probe id so navigating probes invalidates playback. */}
              <ListenButton
                text={currentProbe.text}
                language={ttsLanguage}
                cacheKey={`probe:${currentProbe.id}`}
              />

              {/* Action row — framed card with a subtle "stuck?" hint.
                  Lives inside the centered tutor+message group so it sits
                  right after the probe text rather than being anchored to
                  the bottom of the panel with a big empty gap above. */}
              <div className="shrink-0 w-full max-w-[680px] px-2">
                <div className="actions-box rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
                  <div className="grid grid-cols-5 gap-2.5 @container">
                    <button
                      onClick={() => {
                        onToolEvent?.("open_resources", {
                          probeId: currentProbe.id,
                          probePreview: currentProbe.text.slice(0, 60),
                        });
                        onOpenResources?.(currentProbe.text);
                      }}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.resources')}
                      className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="hidden @[20rem]:inline truncate">{t('sessionPlan.resources')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onToolEvent?.("open_practice", {
                          probeId: currentProbe.id,
                          probePreview: currentProbe.text.slice(0, 60),
                        });
                        onOpenPractice?.(currentProbe.text);
                      }}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.practice')}
                      className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="hidden @[20rem]:inline truncate">{t('sessionPlan.practice')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onToolEvent?.("ask_assistant", {
                          probeId: currentProbe.id,
                          probePreview: currentProbe.text.slice(0, 60),
                        });
                        onAskAssistant?.(currentProbe.text);
                      }}
                      disabled={!isSessionActive}
                      title={t('sessionPlan.ask')}
                      className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span className="hidden @[20rem]:inline truncate">{t('sessionPlan.ask')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onToolEvent?.("open", {
                          probeId: currentProbe.id,
                          probePreview: currentProbe.text.slice(0, 60),
                          via: "share_screen_button",
                        });
                        onToolSelect?.("data-input");
                      }}
                      disabled={!isSessionActive}
                      title={t('probes.shareScreen')}
                      className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:border-neutral-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden @[20rem]:inline truncate">{t('probes.shareScreen')}</span>
                    </button>
                    <button
                      onClick={() => {
                        onToolEvent?.("archive", {
                          probeId: currentProbe.id,
                          probePreview: currentProbe.text.slice(0, 60),
                          via: "done_button",
                        });
                        onArchiveProbe?.(currentProbe.id);
                      }}
                      disabled={archivingProbeId === currentProbe.id}
                      title={t('session.markAsDone')}
                      className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                      <span className="hidden @[20rem]:inline truncate">{t('probes.done')}</span>
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <ThinkAloudTraces
                    thoughts={thinkAloudThoughts}
                    interimText={thinkAloudInterimText}
                    isListening={thinkAloudListening}
                    isSupported={thinkAloudSupported}
                    error={thinkAloudError}
                    onThoughtClick={(thought) => onThinkAloudThoughtClick?.(thought)}
                    onClearThoughts={onClearThinkAloudThoughts}
                  />
                </div>
              </div>
            </div>

            {/* Carousel dots — always rendered (placeholders for empty
                slots) so the row reserves its vertical space. */}
            <div className="shrink-0 flex items-center justify-center gap-1.5 py-3 h-1.5">
              {activeProbes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (i !== currentIndex) {
                      onToolEvent?.("nav_jump", {
                        fromIndex: currentIndex,
                        toIndex: i,
                        total: activeProbes.length,
                        probeId: activeProbes[i]?.id,
                      });
                    }
                    setCurrentIndex(i);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentIndex
                      ? "w-5 bg-neutral-300"
                      : "w-1.5 bg-neutral-700 hover:bg-neutral-600"
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

      {/* Reset Helios confirmation — destructive, archives the full
          chain of guiding questions built up in this session. */}
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
