"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { type Probe, type SessionPlan, type RequestType, type ToolName } from "@/lib/storage";
import { SessionPlanViewer } from "./SessionPlanViewer";
import { QRCodeModal } from "./QRCodeModal";
import { useI18n } from "@/lib/i18n";

const MAX_OPEN_PROBES = 5;

// Tool labels for display - using translation function
function getToolLabel(tool: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    chat: t('tools.helios'),
    canvas: t('tools.canvas'),
    notebook: t('tools.notebook'),
    grokipedia: t('tools.grokipedia'),
    plan: t('probes.session'),
    exercise: t('tools.practice'),
    reading: t('tools.theory'),
    help: t('tools.help'),
  };
  return labels[tool] || tool;
}

interface ProbeNotificationsProps {
  sessionId: string;
  probes: Probe[];
  sessionPlan?: SessionPlan | null;
  objectives?: string[];
  objectiveStatuses?: ("red" | "yellow" | "green" | "blue")[];
  isRecording?: boolean;
  isPaused?: boolean;
  stream?: MediaStream | null;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onGetFeedback?: () => void;
  onArchiveProbe?: (probeId: string) => Promise<void>;
  onToggleFocus?: (probeId: string, focused: boolean) => void;
  onToolSelect?: (tool: ToolName) => void;
  onReset?: () => void;
  onClose?: () => void;
  feedbackLoading?: boolean;
  showControls?: boolean;
  elapsedSeconds?: number;
  storageBeat?: number;
  analysisBeat?: number;
  isAnalyzing?: boolean;
  archivingProbeId?: string | null;
  planLoading?: boolean;
  planError?: string | null;
  onAdvanceStep?: () => Promise<void>;
  onRollbackToStep?: (stepIndex: number) => Promise<void>;
  autoAdvance?: boolean;
  onToggleAutoAdvance?: (value: boolean) => void;
  onOpenResources?: (stepDescription: string) => void;
  onOpenPractice?: (stepDescription: string) => void;
  onAskAssistant?: (stepDescription: string) => void;
  // Loading and celebration states
  isInitializing?: boolean;
  isCelebrating?: boolean;
  isGeneratingProbe?: boolean;
}

// Type badge styling based on request type
function getTypeBadgeStyles(type: RequestType): { bg: string; text: string; border: string } {
  switch (type) {
    case "question":
      return { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/20" };
    case "task":
      return { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20" };
    case "suggestion":
      return { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/20" };
    case "checkpoint":
      return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/20" };
    case "feedback":
      return { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/20" };
    default:
      return { bg: "bg-neutral-500/15", text: "text-neutral-400", border: "border-neutral-500/20" };
  }
}

export function ProbeNotifications({ 
  sessionId, 
  probes,
  sessionPlan,
  objectives = [],
  objectiveStatuses = [],
  isRecording,
  isPaused,
  stream,
  onStartRecording,
  onStopRecording,
  onPause,
  onResume,
  onGetFeedback,
  onArchiveProbe,
  onToggleFocus,
  onToolSelect,
  onReset,
  onClose,
  feedbackLoading,
  showControls = true,
  elapsedSeconds = 0,
  storageBeat = 0,
  analysisBeat = 0,
  isAnalyzing = false,
  archivingProbeId,
  planLoading,
  planError,
  onAdvanceStep,
  onRollbackToStep,
  autoAdvance = true,
  onToggleAutoAdvance,
  onOpenResources,
  onOpenPractice,
  onAskAssistant,
  isInitializing = false,
  isCelebrating = false,
  isGeneratingProbe = false,
}: ProbeNotificationsProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const sessionMenuRef = useRef<HTMLDivElement>(null);

  // Close session menu on outside click
  useEffect(() => {
    if (!showSessionMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setShowSessionMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSessionMenu]);

  // Calculate active (non-archived) probes
  const activeProbes = useMemo(() => probes.filter(p => !p.archived), [probes]);
  const archivedProbes = useMemo(() => probes.filter(p => p.archived), [probes]);
  const openProbeCount = activeProbes.length;
  const isAtProbeCap = openProbeCount >= MAX_OPEN_PROBES;

  useEffect(() => {
    if (containerRef.current && probes.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [probes.length]);

  const filteredProbes = useMemo(() => {
    const baseProbes = viewMode === "active" ? activeProbes : archivedProbes;
    if (!searchQuery.trim()) return baseProbes;
    const query = searchQuery.toLowerCase();
    return baseProbes.filter(p => p.text.toLowerCase().includes(query));
  }, [activeProbes, archivedProbes, viewMode, searchQuery]);

  const formatTimestamp = (timestamp: number) => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Confetti particles for celebration
  const confettiColors = ['#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'];
  const confettiParticles = [
    { x: 10, delay: 0, color: 0, anim: 'animate-confetti-up-left' },
    { x: 20, delay: 0.05, color: 1, anim: 'animate-confetti-up' },
    { x: 30, delay: 0.1, color: 2, anim: 'animate-confetti-up-right' },
    { x: 40, delay: 0.03, color: 3, anim: 'animate-confetti-up-left' },
    { x: 50, delay: 0.08, color: 4, anim: 'animate-confetti-up' },
    { x: 60, delay: 0.02, color: 5, anim: 'animate-confetti-up-right' },
    { x: 70, delay: 0.06, color: 0, anim: 'animate-confetti-up-left' },
    { x: 80, delay: 0.04, color: 1, anim: 'animate-confetti-up' },
    { x: 90, delay: 0.09, color: 2, anim: 'animate-confetti-up-right' },
    { x: 15, delay: 0.07, color: 3, anim: 'animate-confetti-up' },
    { x: 35, delay: 0.01, color: 4, anim: 'animate-confetti-up-left' },
    { x: 55, delay: 0.11, color: 5, anim: 'animate-confetti-up-right' },
    { x: 75, delay: 0.03, color: 0, anim: 'animate-confetti-up' },
    { x: 85, delay: 0.08, color: 1, anim: 'animate-confetti-up-left' },
    { x: 25, delay: 0.05, color: 2, anim: 'animate-confetti-up-right' },
    { x: 45, delay: 0.02, color: 3, anim: 'animate-confetti-up' },
  ];

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden relative">
      {/* Celebration Overlay */}
      {isCelebrating && (
        <>
          {/* Flash overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 via-transparent to-transparent pointer-events-none z-10 animate-celebration-flash" />
          
          {/* Confetti explosion */}
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {confettiParticles.map((particle, i) => (
              <div
                key={i}
                className={`absolute w-2.5 h-2.5 rounded-sm ${particle.anim}`}
                style={{
                  left: `${particle.x}%`,
                  top: '30%',
                  backgroundColor: confettiColors[particle.color],
                  animationDelay: `${particle.delay}s`,
                  transform: `rotate(${i * 25}deg)`,
                }}
              />
            ))}
            {/* Star bursts */}
            <div className="absolute left-1/4 top-1/4 w-4 h-4 animate-star-burst" style={{ animationDelay: '0.1s' }}>
              <svg viewBox="0 0 24 24" fill="#fbbf24" className="w-full h-full">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="absolute right-1/4 top-1/3 w-3 h-3 animate-star-burst" style={{ animationDelay: '0.2s' }}>
              <svg viewBox="0 0 24 24" fill="#34d399" className="w-full h-full">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="absolute left-1/2 top-1/5 w-3.5 h-3.5 animate-star-burst" style={{ animationDelay: '0.15s' }}>
              <svg viewBox="0 0 24 24" fill="#f472b6" className="w-full h-full">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className={`px-3 py-2 border-b border-neutral-800 shrink-0 relative transition-all duration-300 ${isCelebrating ? 'animate-step-celebrate' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-1">
              {t('tools.studentMonitoring')}
              {isCelebrating && <span className="ml-2 text-amber-400">{t('probes.stepComplete')}</span>}
            </h2>
            <p className="text-[10px] text-neutral-500">
              {t('tools.guidingTasksDesc')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Smartphone */}
            <button
              onClick={() => setShowQRModal(true)}
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
              title={t('session.openOnSmartphone')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>

            {/* Session controls dropdown */}
            {showControls && (
              <div className="relative" ref={sessionMenuRef}>
                <button
                  onClick={() => setShowSessionMenu(!showSessionMenu)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    isRecording && !isPaused
                      ? "text-red-400 bg-red-500/10"
                      : isPaused
                      ? "text-amber-400 bg-amber-500/10"
                      : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
                  }`}
                  title={t('session.sessionControls')}
                >
                  {isRecording && !isPaused ? (
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  <span>{t('sessionEnd.endSession')}</span>
                  <svg className={`w-2.5 h-2.5 transition-transform ${showSessionMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {showSessionMenu && (
                  <div className="absolute right-0 top-full mt-1 w-36 py-1 rounded-lg bg-neutral-800 border border-neutral-700 shadow-xl z-50">
                    {!isRecording && !isPaused && (
                      <button
                        onClick={() => { onStartRecording?.(); setShowSessionMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                      >
                        {t('tools.startSession')}
                      </button>
                    )}
                    {isRecording && !isPaused && (
                      <>
                        <button
                          onClick={() => { onPause?.(); setShowSessionMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                        >
                          {t('tools.pause')}
                        </button>
                        <button
                          onClick={() => { onStopRecording?.(); setShowSessionMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-700 transition-colors"
                        >
                          {t('sessionEnd.endSession')}
                        </button>
                      </>
                    )}
                    {isPaused && (
                      <>
                        <button
                          onClick={() => { onResume?.(); setShowSessionMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                        >
                          {t('session.resume')}
                        </button>
                        <div className="my-1 border-t border-neutral-700" />
                        <button
                          onClick={() => { onReset?.(); setShowSessionMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                        >
                          {t('tools.reset')}
                        </button>
                        <button
                          onClick={() => { onClose?.(); setShowSessionMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                        >
                          {t('tools.close')}
                        </button>
                        <button
                          onClick={() => { onStopRecording?.(); setShowSessionMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-700 transition-colors"
                        >
                          {t('sessionEnd.endSession')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Probe Slots - Game-like UI */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => {
              const isFilled = i < openProbeCount;
              const probe = isFilled ? activeProbes[i] : null;
              return (
                <div
                  key={i}
                  className={`
                    w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all duration-300
                    ${isFilled 
                      ? probe?.focused 
                        ? "bg-amber-500/30 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" 
                        : "bg-cyan-500/20 border-cyan-500/60" 
                      : "bg-neutral-800/50 border-neutral-700/50"
                    }
                    ${isAtProbeCap && isFilled ? "animate-pulse" : ""}
                  `}
                  title={probe ? probe.text.slice(0, 50) + "..." : t('session.emptySlot')}
                >
                  {isFilled && (
                    <span className="text-[9px] font-bold text-cyan-400">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
          {isAtProbeCap && (
            <span className="text-[10px] text-amber-400 animate-pulse">
              {t('probes.resolveProbesToContinue')}
            </span>
          )}
        </div>
      </div>

      {/* Probes/Plan Split View - Scrollable Middle Section */}
      <div className="flex gap-2 flex-1 min-h-0 min-w-0 overflow-hidden px-3 py-2">
        {/* Left side - Probes */}
        <div className="w-1/2 flex flex-col min-w-0 min-h-0 overflow-hidden p-4">
            {/* Section Title */}
            <div className="mb-2 shrink-0">
              <h2 className="text-sm font-semibold text-white">{t('probes.guidingTasks')}</h2>
            </div>
            {/* Active/Archived Toggle */}
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <div className="flex rounded-md overflow-hidden border border-neutral-700">
                <button
                  onClick={() => setViewMode("active")}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    viewMode === "active"
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "bg-transparent text-neutral-500 hover:text-neutral-400"
                  }`}
                >
                  {t('probes.active')} ({activeProbes.length})
                </button>
                <button
                  onClick={() => setViewMode("archived")}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    viewMode === "archived"
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "bg-transparent text-neutral-500 hover:text-neutral-400"
                  }`}
                >
                  {t('probes.archived')} ({archivedProbes.length})
                </button>
              </div>

              {/* Search - Only in Archived view */}
              {viewMode === "archived" && (
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={t('probes.searchArchived')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-6 px-2 pr-6 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-400"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recording Status Bar */}
            {isRecording && (
              <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-3 shrink-0">
                <div className="text-xs font-mono text-neutral-300 tabular-nums">
                  {formatTime(elapsedSeconds)}
                </div>
                {/* Heartbeat indicators */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-neutral-500">{t('probes.status')}</span>
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={`st-${i}`} 
                      className={`w-1.5 h-1.5 rounded-sm ${i <= (storageBeat || 0) ? "bg-cyan-500" : "bg-neutral-700"}`}
                    />
                  ))}
                  <span className="text-[9px] text-neutral-500 ml-2">{t('probes.answer')}</span>
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={`an-${i}`}
                      className={`w-1.5 h-1.5 rounded-sm ${i <= (analysisBeat || 0) ? "bg-purple-500" : "bg-neutral-700"}`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Probes List */}
            {viewMode === "active" ? (
              <div ref={containerRef} className="flex-1 min-h-0 p-3 flex flex-col gap-2 overflow-hidden">
                {isInitializing && activeProbes.length === 0 ? (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    <p className="text-xs text-neutral-500">{t('probes.preparing')}</p>
                  </div>
                ) : (
                  Array.from({ length: MAX_OPEN_PROBES }).map((_, i) => {
                    const probe = activeProbes[i];
                    const isGeneratingThisSlot = isGeneratingProbe && !probe && i === activeProbes.length;

                    if (!probe) {
                      return (
                        <div
                          key={`empty-${i}`}
                          className="flex-1 min-h-0 p-3 rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-800/40 flex items-center justify-center gap-2"
                        >
                          {isGeneratingThisSlot ? (
                            <>
                              <div className="w-4 h-4 border-2 border-neutral-600 border-t-cyan-500 rounded-full animate-spin" />
                              <span className="text-xs text-neutral-400">{t('probes.generatingProbe')}</span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-700/60 text-[10px] font-bold text-neutral-400">
                                {i + 1}
                              </span>
                              <span className="text-xs text-neutral-400">{t('session.emptySlot')}</span>
                            </>
                          )}
                        </div>
                      );
                    }

                    const planStep = probe.planStepId
                      ? sessionPlan?.steps?.find(s => s.id === probe.planStepId)
                      : null;
                    const stepContext = planStep
                      ? t('probes.stepContext', { order: planStep.order, description: planStep.description })
                      : t('probes.general');

                    const requestType = probe.requestType || "question";
                    const typeBadge = getTypeBadgeStyles(requestType);
                    const isArchiving = archivingProbeId === probe.id;

                    return (
                      <div
                        key={probe.id}
                        onClick={() => onToggleFocus?.(probe.id, !probe.focused)}
                        className={`
                          group relative p-3 rounded-lg transition-all duration-300 cursor-pointer
                          flex-1 min-h-0 overflow-y-auto
                          ${probe.focused
                            ? "bg-amber-500/10 border border-amber-500/30"
                            : "bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700"
                          }
                          ${isArchiving ? "animate-slide-out-right opacity-0" : ""}
                        `}
                      >
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-neutral-500">
                            {formatTimestamp(probe.timestamp)}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border}`}>
                            {requestType}
                          </span>
                          <span className="text-[9px] text-neutral-600 truncate max-w-[100px]" title={stepContext}>
                            {stepContext}
                          </span>

                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchiveProbe?.(probe.id);
                              }}
                              disabled={isArchiving}
                              className="flex items-center gap-1 px-2 py-1 rounded text-neutral-500 hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50 text-xs"
                              title={t('session.markAsDone')}
                            >
                              {isArchiving ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span className="text-green-400">{t('probes.validating')}</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>{t('probes.done')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-sm text-neutral-300 leading-snug">
                          {probe.text}
                        </p>

                        {requestType === "task" && (
                          <p className="text-[10px] text-purple-400/70 mt-1.5 italic">
                            {t('probes.useToolsHint')}
                          </p>
                        )}

                        {probe.suggestedTools && probe.suggestedTools.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-[9px] text-neutral-500 self-center mr-1">{t('probes.tryHint')}</span>
                            {probe.suggestedTools.map(tool => (
                              <button
                                key={tool}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToolSelect?.(tool);
                                }}
                                className="px-2 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                              >
                                {getToolLabel(tool, t)}
                              </button>
                            ))}
                          </div>
                        )}

                        {probe.focused && (
                          <div className="mt-2 text-[9px] text-amber-400/80 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                            </svg>
                            {t('probes.focusedHint')}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {filteredProbes.length === 0 ? (
                  <p className="text-xs text-neutral-600 text-center py-4">
                    {searchQuery
                      ? t('probes.noMatchingProbes')
                      : t('probes.noArchivedProbes')
                    }
                  </p>
                ) : (
                  filteredProbes.map((probe) => {
                    const planStep = probe.planStepId
                      ? sessionPlan?.steps?.find(s => s.id === probe.planStepId)
                      : null;
                    const stepContext = planStep
                      ? t('probes.stepContext', { order: planStep.order, description: planStep.description })
                      : t('probes.general');

                    const requestType = probe.requestType || "question";
                    const typeBadge = getTypeBadgeStyles(requestType);
                    const isArchiving = archivingProbeId === probe.id;

                    return (
                      <div
                        key={probe.id}
                        className={`
                          group relative p-3 rounded-lg transition-all duration-300
                          ${probe.focused
                            ? "bg-amber-500/10 border border-amber-500/30"
                            : "bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700"
                          }
                          ${isArchiving ? "animate-slide-out-right opacity-0" : ""}
                        `}
                      >
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-neutral-500">
                            {formatTimestamp(probe.timestamp)}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border}`}>
                            {requestType}
                          </span>
                          <span className="text-[9px] text-neutral-600 truncate max-w-[100px]" title={stepContext}>
                            {stepContext}
                          </span>
                        </div>

                        <p className="text-sm text-neutral-300 leading-snug">
                          {probe.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Right side - Session Plan */}
          <div className="w-1/2 flex flex-col min-w-0 min-h-0 border-l border-neutral-800 overflow-hidden">
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
              <SessionPlanViewer 
                plan={sessionPlan ?? null} 
                loading={planLoading} 
                error={planError ?? null} 
                onAdvanceStep={onAdvanceStep}
                onRollbackToStep={onRollbackToStep}
                autoAdvance={autoAdvance}
                onToggleAutoAdvance={onToggleAutoAdvance}
                sessionId={sessionId}
                onOpenResources={onOpenResources}
                onOpenPractice={onOpenPractice}
                onAskAssistant={onAskAssistant}
                isSessionActive={isRecording && !isPaused}
              />
            </div>
          </div>
      </div>

      {/* QR Code Modal for mobile access */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        sessionId={sessionId}
      />
    </div>
  );
}
