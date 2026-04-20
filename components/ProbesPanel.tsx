"use client";

import { useEffect, useMemo, useState } from "react";
import { type Probe, type ToolName, type ToolAction } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import { isProbeTyped, markProbeTyped } from "@/lib/welcomeState";
import { TutorWelcome } from "./TutorWelcome";
import { ListenButton } from "./ListenButton";

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
  onToolEvent?: ProbesPanelToolEvent;
  archivingProbeId?: string | null;
  isInitializing?: boolean;
  isGeneratingProbe?: boolean;
  sessionPlan?: { steps?: Array<{ id: string; order: number; description: string }> } | null;
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
  /** Parent is currently fetching the opening probe (shows spinner on Play). */
  isStartingSession?: boolean;
  /** Session id — used to gate the one-time TTS narration of the welcome. */
  sessionId?: string;
  /** BCP-47 language override for TTS. */
  ttsLanguage?: string;
}

export function ProbesPanel({
  probes,
  onArchiveProbe,
  onOpenResources,
  onOpenPractice,
  onAskAssistant,
  onToolEvent,
  archivingProbeId,
  isInitializing = false,
  isGeneratingProbe = false,
  isSessionActive = false,
  tutorName,
  showWelcome = false,
  onWelcomePlay,
  onOpenSessionPlan,
  isStartingSession = false,
  sessionId,
  ttsLanguage,
}: ProbesPanelProps) {
  const { t } = useI18n();

  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);

  const [currentIndex, setCurrentIndex] = useState(0);

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
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <TutorWelcome
            tutorName={displayTutorName}
            onPlay={() => onWelcomePlay?.()}
            onOpenSessionPlan={
              onOpenSessionPlan ? () => onOpenSessionPlan() : undefined
            }
            isStarting={isStartingSession}
            sessionId={sessionId}
            ttsLanguage={ttsLanguage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden">
      {/* Position counter (top-right corner) */}
      {activeProbes.length > 0 && (
        <div className="absolute top-3 right-4 z-10 font-mono text-[10px] text-neutral-600 tabular-nums pointer-events-none">
          {String(currentIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      )}

      {/* Main message area */}
      <div className="relative flex-1 min-h-0 flex flex-col px-4 py-4 overflow-hidden">
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
          </div>
        ) : (
          <>
            {/* Carousel nav arrows - left */}
            {canGoPrev && (
              <button
                onClick={goPrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-white backdrop-blur-sm transition-all flex items-center justify-center"
                aria-label={t('probes.previous')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {/* Carousel nav arrows - right */}
            {canGoNext && (
              <button
                onClick={goNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-white backdrop-blur-sm transition-all flex items-center justify-center"
                aria-label={t('probes.next')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Tutor + message group — centered vertically in available space */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 overflow-y-auto">
              {/* Avatar - stylized placeholder that can be replaced with a real image later */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
                    <span className="text-3xl font-serif text-neutral-200">{avatarInitial}</span>
                  </div>
                  {/* Soft glow */}
                  <div className="absolute inset-0 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.08)] pointer-events-none" />
                </div>
                <div className="mt-2">
                  <span className="text-sm font-medium text-neutral-200">{displayTutorName}</span>
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
            </div>

            {/* Action row */}
            <div className="shrink-0 pt-4">
              <div className="grid grid-cols-4 gap-2.5 @container">
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
                  className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                  className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                  className="py-3 px-3 text-[12px] font-medium rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span className="hidden @[20rem]:inline truncate">{t('sessionPlan.ask')}</span>
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

              {/* Carousel dots — always rendered (placeholders for empty
                  slots) so the row reserves its vertical space and the
                  action buttons don't shift when probes are added. */}
              <div className="flex items-center justify-center gap-1.5 mt-3 h-1.5">
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

              {/* Generating indicator — always takes its slot to prevent
                  a layout shift when a new probe is being fetched. */}
              <div className="flex items-center justify-center gap-2 mt-2 h-3">
                {isGeneratingProbe && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-500/70 animate-pulse" />
                    <span className="text-[10px] text-neutral-500">{t('probes.generatingProbe')}</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
