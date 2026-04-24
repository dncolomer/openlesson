"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { AudioRecorder } from "@/lib/audio";
import { FacialDataPoint } from "./FaceTracker";
import {
  getSession,
  addProbe,
  addProbeToSession,
  endSession,
  saveSession,
  saveSessionEEG,
  saveFacialData,
  saveAudioChunk,
  pauseSession,
  resumeSession,
  updateSessionStatus,
  logToolUsage,
  getSessionPlan,
  archiveProbe,
  toggleProbeFocused,
  resetSessionProbes,
  saveWithDedupString,
  saveWithDedupBlob,
  type Session,
  type SessionPlan,
  type Probe,
  type ObserverMode,
  type Frequency,
  type ToolName,
  type ToolAction,
  type RequestType,
} from "@/lib/storage";
import { playArchiveSound, playStepCompleteSound, playSessionCompleteSound } from "@/lib/sounds";
import { formatTime } from "@/lib/utils";
import { ProbesPanel } from "./ProbesPanel";
import { SessionControlBar } from "./SessionControlBar";
import { SessionPlanViewer } from "./SessionPlanViewer";
import { ResizablePane, type ResizablePaneHandle } from "./ResizablePane";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas";
import { ToolsPanel, type Tool } from "./ToolsPanel";
import { LLMChat, type ChatMessage } from "./LLMChat";
import { DataInputTool } from "./DataInputTool";
import { LogsTool, type LogEntry } from "./LogsTool";
import { createScreenCapture } from "@/lib/screen-capture";
import { saveScreenshot, updateSessionPlan } from "@/lib/storage";
import { LocalInferenceManager, type InitProgress, type LocalAnalysisContext } from "@/lib/local-inference";
import { LocalContextBuffer } from "@/lib/local-context";
// ModelLoadingModal no longer used -- loading UI is inline in welcome modal

import { PopOutBanner } from "./PopOutBanner";
import { PlanResourcesPanel } from "./PlanResourcesPanel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { 
  useSessionSync, 
  openPopOutWindow, 
  type SessionAction 
} from "@/lib/broadcast-sync";
import { useSessionHeartbeat, type StorageHeartbeatResult, type AnalysisHeartbeatResult } from "@/lib/useSessionHeartbeat";
import { retryWithResult } from "@/lib/retry";
import { useI18n } from "@/lib/i18n";
import { tutoringLocales, tutoringLanguageNames } from "@/lib/tutoring-languages";
import { isSessionWelcomeSeen, markSessionWelcomeSeen } from "@/lib/welcomeState";


// Check if a new probe is a duplicate of any existing probe (normalized comparison)
function isDuplicateProbe(newText: string, existingProbes: { text: string; archived?: boolean }[]): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newNorm = normalize(newText);
  return existingProbes.some(p => {
    const existingNorm = normalize(p.text);
    // Exact match after normalization
    if (newNorm === existingNorm) return true;
    // One is a substring of the other (catches minor rewording)
    if (newNorm.length > 20 && existingNorm.length > 20) {
      if (newNorm.includes(existingNorm) || existingNorm.includes(newNorm)) return true;
    }
    return false;
  });
}

/**
 * Small inline button for the notebook footer. Kept as a separate component
 * so it can own its own `isSubmitting` state without bloating SessionView's
 * already-large state surface — the parent just passes an async onSubmit.
 *
 * The `disabled` prop covers two distinct reasons to block submission:
 *   1. Notebook empty (nothing to submit).
 *   2. Notebook content unchanged since last submit (no point re-asking).
 * The parent decides which; we just reflect the result.
 */
function NotebookSubmitButton({
  onSubmit,
  disabled,
  disabledReason,
}: {
  onSubmit: () => Promise<void> | void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleClick = async () => {
    if (isSubmitting || disabled) return;
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting || disabled}
      title={disabled ? (disabledReason ?? '') : t('whiteboard.submitHint')}
      aria-label={t('whiteboard.submitToHelios')}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-white bg-white/10 border border-white/30 hover:bg-white/20 hover:border-white/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
    >
      {isSubmitting ? (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
        </svg>
      )}
      <span>{isSubmitting ? t('whiteboard.submitting') : t('whiteboard.submitToHelios')}</span>
    </button>
  );
}

// Configuration
const STORAGE_INTERVAL_MS = 5000;
const ANALYSIS_INTERVAL_MS = 10000;

export function SessionView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { t, locale, supportedLocales } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutoringLanguage, setTutoringLanguage] = useState(locale);
  // Manual-advance by default: the student clicks Complete on a plan step
  // when they're done. Auto-advance mode is kept wired for future toggling
  // but the UI affordance is hidden (see note at the hidden toggles below).
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Mic check
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  const micStreamRef = useRef<MediaStream | null>(null);

  // Observer controls
  const [observerMode, setObserverMode] = useState<ObserverMode>("active");
  const [frequency, setFrequency] = useState<Frequency>("balanced");
  const [isMuted, setIsMuted] = useState(false);
  const [muteRemaining, setMuteRemaining] = useState(0);

  // Probes
  const [activeProbe, setActiveProbe] = useState<Probe | null>(null);
  const [viewingProbeIndex, setViewingProbeIndex] = useState<number>(-1);
  const [openingProbeLoading, setOpeningProbeLoading] = useState(false);

  // Session ending / saving
  const [isSaving, setIsSaving] = useState(false);

  // Tutor-end dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState("");

  // Prep material cards
  const [prepCards, setPrepCards] = useState<Array<{ id: string; title: string; content: string }>>([]);
  const [prepLoading, setPrepLoading] = useState<string | null>(null);

  // Whiteboard
  const [whiteboardData, setWhiteboardData] = useState<string | null>(null);

  // Notebook
  const [notebookContent, setNotebookContent] = useState("");

  // "Submit to Helios" dirty tracking — becomes true on any edit and is
  // cleared on a successful submit. Initial value `true` so the first-ever
  // submit is allowed (provided the tool has non-empty content). The state
  // lives here rather than inside the tool components so tool-switching
  // doesn't reset it.
  const [canvasDirtyForHelios, setCanvasDirtyForHelios] = useState(true);
  const [notebookDirtyForHelios, setNotebookDirtyForHelios] = useState(true);



  // Teaching Assistant Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null);

  // New 3-panel layout state
  const [activeTool, setActiveTool] = useState<Tool>("chat");
  const prevToolRef = useRef<Tool | null>(null);
  const resizablePaneRef = useRef<ResizablePaneHandle>(null);
  const resizablePaneRef2 = useRef<ResizablePaneHandle>(null);
  // Source-of-truth for which of the three workspace views are visible.
  // Kept in sync with the ResizablePane collapsed state via the toggle
  // UI in the top bar. At least one must be true at all times. Initialized
  // from the persisted pane layout so refreshes preserve user choice.
  type PaneVis = { tools: boolean; tutor: boolean; plan: boolean };
  const [paneVisibility, setPaneVisibility] = useState<PaneVis>(() => {
    if (typeof window === "undefined") return { tools: true, tutor: true, plan: true };
    const readCollapsed = (key: string): null | "left" | "right" => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.collapsedSide === "left" || parsed.collapsedSide === "right"
          ? parsed.collapsedSide
          : null;
      } catch {
        return null;
      }
    };
    const outer = readCollapsed("session-split");
    const inner = readCollapsed("session-split-right");
    return {
      tools: outer !== "left",
      // Tutor (Helios) pane is always visible — it cannot be hidden.
      tutor: true,
      plan: outer !== "right" && inner !== "right",
    };
  });
  // Canonical applier: writes both the toggle state AND the underlying
  // ResizablePane collapsed states, so the UI and the actual layout are
  // always in lockstep. At least one of the three must be true.
  const applyPaneVisibility = useCallback((next: PaneVis) => {
    // Helios (tutor) pane is always visible — force the invariant here so
    // no call site can ever hide it, regardless of persisted state.
    next = { ...next, tutor: true };
    if (!next.tools && !next.tutor && !next.plan) return;
    setPaneVisibility(next);
    // Outer pane: left = Tools, right = (Tutor + Plan combined)
    if (!next.tutor && !next.plan) {
      resizablePaneRef.current?.setLayout({ collapsedSide: "right" });
    } else if (!next.tools) {
      resizablePaneRef.current?.setLayout({ collapsedSide: "left" });
    } else {
      resizablePaneRef.current?.setLayout({ collapsedSide: null });
    }
    // Inner pane: left = Tutor, right = Plan
    if (!next.tutor && next.plan) {
      resizablePaneRef2.current?.setLayout({ collapsedSide: "left" });
    } else if (next.tutor && !next.plan) {
      resizablePaneRef2.current?.setLayout({ collapsedSide: "right" });
    } else {
      resizablePaneRef2.current?.setLayout({ collapsedSide: null });
    }
  }, []);
  // Turn a single view on without touching the other two.
  const ensureVisible = useCallback((view: keyof PaneVis) => {
    if (paneVisibility[view]) return;
    applyPaneVisibility({ ...paneVisibility, [view]: true });
  }, [paneVisibility, applyPaneVisibility]);

  // Helios (tutor) pane is always visible — on mount, if a persisted layout
  // from before this invariant existed has the tutor pane collapsed, force
  // it open so the underlying ResizablePane state matches paneVisibility.
  useEffect(() => {
    const id = window.setTimeout(() => {
      applyPaneVisibility({ ...paneVisibility, tutor: true });
    }, 0);
    return () => window.clearTimeout(id);
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);

  // Archive/Focus probe state
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  
  // Plan complete modal (shown when all steps are done)
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);
  // Stop-button confirmation — ending is irreversible so we gate the Stop
  // click through an explicit warning that also nudges users toward the
  // non-destructive "pause + back to dashboard" alternative.
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Local inference
  const [localInferenceEnabled, setLocalInferenceEnabled] = useState(false);
  const localInferenceEnabledRef = useRef(false);
  const localContextRef = useRef<LocalContextBuffer | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<InitProgress | null>(null);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [webGPUAvailable, setWebGPUAvailable] = useState(false);
  const [isGeneratingProbe, setIsGeneratingProbe] = useState(false);

  // Combined session prep modal (plan + optional model loading)
  const [prepStage, setPrepStage] = useState<"plan" | "model" | "done">("plan");

  // Detect WebGPU on mount
  useEffect(() => {
    setWebGPUAvailable(LocalInferenceManager.isWebGPUAvailable());
  }, []);

  // Welcome modal
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [showTutorialBanner, setShowTutorialBanner] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("tutorial-banner-dismissed") !== "true";
  });

  // In-panel tutor welcome (typed intro + Play button). Shown the first time
  // a user lands on a fresh session (no existing probes AND welcome not yet
  // acknowledged). Clicking Play inside the panel is what fetches the opening
  // probe — we defer that network call out of the settings modal.
  const [showWelcomePanel, setShowWelcomePanel] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  // Bumped every time we open the welcome panel so the collapse effect
  // re-fires even if `showWelcomePanel` was already true (e.g. clicking
  // Help twice in a row without closing in between).
  const [welcomeOpenNonce, setWelcomeOpenNonce] = useState(0);
  // Layout snapshot captured on Help click so clicking Play restores
  // the user's previous pane sizes instead of leaving the tools hidden.
  const helpPreviousLayoutRef = useRef<{
    outer: { leftWidth?: number; collapsedSide: null | "left" | "right" };
    inner: { leftWidth?: number; collapsedSide: null | "left" | "right" };
  } | null>(null);

  // When the in-panel welcome opens, collapse everything except the tutor
  // panel so the user's attention is on the greeting. We restore nothing on
  // exit — the user's last-used / persisted layout stays as configured by
  // the time they click Play (they can re-open tools manually or via the
  // existing layout preset buttons).
  useEffect(() => {
    if (!showWelcomePanel) return;
    if (showWelcomeModal) return; // wait until the settings modal is gone
    // Defer one frame so the ResizablePane refs are definitely attached,
    // and so that any competing layout effect (e.g. the auto-expand-left
    // triggered by activeTool changes) lands first and we collapse last.
    const id = window.setTimeout(() => {
      // Outer split: collapse Tools (left) so right-hand workspace is full width
      resizablePaneRef.current?.setLayout({ collapsedSide: "left" });
      // Inner split: collapse Plan (right) so tutor panel gets the full area
      resizablePaneRef2.current?.setLayout({ collapsedSide: "right" });
      // Keep the visibility toggles in sync with the actual layout.
      setPaneVisibility({ tools: false, tutor: true, plan: false });
    }, 80);
    return () => window.clearTimeout(id);
  }, [showWelcomePanel, showWelcomeModal, welcomeOpenNonce]);

  // Block ILE tools when not actively monitoring. Also allow interaction
  // during the in-panel tutor welcome — the user needs to click Play and
  // optionally Open Session Plan from the welcome surface before recording
  // has actually started.
  const shouldBlockTools =
    session &&
    !showWelcomeModal &&
    !showWelcomePanel &&
    (!isRecording || isPaused);

  // Mobile detection


  // Session Plan state
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const sessionPlanRef = useRef<SessionPlan | null>(null);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  // Prep material for tools
  const [prepToolContent, setPrepToolContent] = useState<{ title: string; content: string } | null>(null);
  const [prepToolLoading, setPrepToolLoading] = useState(false);
  const [showGrokipediaOnly, setShowGrokipediaOnly] = useState(false);

  // Grokipedia search suggestions
  const [grokipediaSuggestions, setGrokipediaSuggestions] = useState<string[]>([]);
  const [grokipediaSuggestionsLoading, setGrokipediaSuggestionsLoading] = useState(false);
  const [grokipediaManualTerm, setGrokipediaManualTerm] = useState("");

  // Pop-out window state
  const [isPopOutActive, setIsPopOutActive] = useState(false);
  const popOutWindowRef = useRef<Window | null>(null);
  const popOutDismissedRef = useRef<boolean>(false); // Track if user explicitly dismissed

  // Track tool open/close events + auto-expand tool panel if collapsed
  useEffect(() => {
    if (!session?.id || !activeTool) return;

    // Auto-show the tools view whenever a tool is selected. This keeps
    // the top-bar Tools toggle in sync with the user's intent.
    ensureVisible("tools");

    const prevTool = prevToolRef.current;
    const elapsedTime = session.startedAt 
      ? Date.now() - new Date(session.startedAt).getTime() 
      : 0;

    if (prevTool && prevTool !== activeTool) {
      logTool(prevTool as ToolName, "close", { via: "tool_switch" });
    }
    logTool(activeTool as ToolName, "open", { via: "tool_switch" });
    // Feed tool events into local context buffer
    if (localInferenceEnabledRef.current && localContextRef.current) {
      localContextRef.current.addToolEvent(`opened ${activeTool}`);
    }
    
    prevToolRef.current = activeTool;
  }, [activeTool, session?.id, session?.startedAt]);

  const loadPrepToolContent = async (type: string, stepContext?: string) => {
    if (!session?.problem) return;
    if (type === "grokipedia") {
      setShowGrokipediaOnly(true);
      setPrepToolContent(null);
      return;
    }
    setShowGrokipediaOnly(false);
    setPrepToolLoading(true);
    try {
      let url = `/api/prep-material?topic=${encodeURIComponent(session.problem)}&type=${type}`;
      if (stepContext) {
        url += `&step=${encodeURIComponent(stepContext)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPrepToolContent(data);
      }
    } catch (err) {
      console.error("Prep material error:", err);
    } finally {
      setPrepToolLoading(false);
    }
  };

  // Fetch Grokipedia search suggestions from LLM
  const fetchGrokipediaSuggestions = async () => {
    if (!session?.problem) return;
    
    setGrokipediaSuggestionsLoading(true);
    try {
      const currentStep = sessionPlanRef.current?.steps?.[sessionPlanRef.current.currentStepIndex];
      const activeProbes = session.probes?.filter(p => !p.archived) || [];
      
      const response = await fetch("/api/suggest-grokipedia-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionProblem: session.problem,
          currentPlanStep: currentStep?.description,
          activeProbes: activeProbes.map(p => ({ text: p.text })),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setGrokipediaSuggestions(data.terms || []);
      }
    } catch (err) {
      console.error("Grokipedia suggestions error:", err);
    } finally {
      setGrokipediaSuggestionsLoading(false);
    }
  };

  // Step action handlers — Resources, Practice, Ask Assistant
  const handleStepResources = (stepDescription: string) => {
    setActiveTool("reading");
    setPrepToolContent(null);
    loadPrepToolContent("reading", stepDescription);
  };

  const handleStepPractice = (stepDescription: string) => {
    setActiveTool("exercise");
    setPrepToolContent(null);
    loadPrepToolContent("exercise", stepDescription);
  };

  const handleStepAskAssistant = (stepDescription: string) => {
    // Make sure the tools pane is visible. The `activeTool` effect only
    // reopens the pane when the value actually changes, so if "chat" was
    // already the active tool before the user closed the tools pane,
    // calling setActiveTool("chat") here is a no-op and wouldn't reopen it.
    ensureVisible("tools");
    setActiveTool("chat");
    setPendingChatMessage(`Help me understand and work through this step: "${stepDescription}"`);
  };

  // Muse EEG
  const [museStatus, setMuseStatus] = useState<"disconnected" | "connecting" | "connected" | "streaming">("disconnected");
  const [museError, setMuseError] = useState<string | null>(null);
  const [eegChannelData, setEegChannelData] = useState<Map<string, number[]>>(new Map());
  const [bandPowers, setBandPowers] = useState<{ delta: number; theta: number; alpha: number; beta: number; gamma: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const museClientRef = useRef<any>(null);
  const eegIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bandIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eegBufferRef = useRef<Map<string, number[]>>(new Map());

  // Webcam
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [latestFacialData, setLatestFacialData] = useState<FacialDataPoint | null>(null);

  // Facial Data Tracking
  const [facialDataBuffer, setFacialDataBuffer] = useState<FacialDataPoint[]>([]);
  const facialBufferRef = useRef<FacialDataPoint[]>([]);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  // Refs for interval callbacks
  const recorderRef = useRef<AudioRecorder | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProbeTimeRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkIndexRef = useRef(0);
  const eegChunkIndexRef = useRef(0);
  const facialChunkIndexRef = useRef(0);
  const observerModeRef = useRef(observerMode);
  const frequencyRef = useRef(frequency);
  const isMutedRef = useRef(isMuted);
  const whiteboardDataRef = useRef(whiteboardData);
  const notebookContentRef = useRef(notebookContent);
  const activeToolRef = useRef(activeTool);
  const objectivesRef = useRef(objectives);
  const isRecordingRef = useRef(isRecording);
  const autoAdvanceRef = useRef(autoAdvance);
  const museStatusRef = useRef(museStatus);
  const isWebcamEnabledRef = useRef(isWebcamEnabled);

  // Screen capture
  const screenCaptureRef = useRef<{ captureNow: () => Promise<Blob | null>; start: () => Promise<boolean>; stop: () => void; isCapturing: () => boolean; getStream: () => MediaStream | null } | null>(null);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [screenshotCount, setScreenshotCount] = useState(0);

  // Pause/Resume state tracking
  const wasRecordingRef = useRef(false);
  const wasScreenCapturingRef = useRef(false);
  const wasWebcamEnabledRef = useRef(false);
  const wasMuseStreamingRef = useRef(false);
  const pausedAudioStreamRef = useRef<MediaStream | null>(null);
  const pausedScreenStreamRef = useRef<MediaStream | null>(null);
  const pausedWebcamStreamRef = useRef<MediaStream | null>(null);

  const handleFacialData = useCallback((data: FacialDataPoint) => {
    setLatestFacialData(data);
    facialBufferRef.current.push(data);
    if (facialBufferRef.current.length > 120) {
      facialBufferRef.current = facialBufferRef.current.slice(-120);
    }
    // Feed into local context buffer if local inference is active
    if (localInferenceEnabledRef.current && localContextRef.current) {
      localContextRef.current.addFacialData({
        confusionScore: data.confusionScore ?? 0,
        frustrationScore: data.frustrationScore ?? 0,
        emotion: data.emotion === "confused" ? 0.8 : data.emotion === "frustrated" ? 0.7 : 0.2,
        attention: data.attentionLevel === "high" ? 0.9 : data.attentionLevel === "medium" ? 0.5 : 0.2,
      });
    }
  }, []);

  const handleFaceError = useCallback((error: string) => {
    setWebcamError(error);
    const entry: LogEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      level: "error",
      message: error,
      source: "Face Tracker"
    };
    logsRef.current.push(entry);
    setLogs(prev => [...prev, entry]);
  }, []);

  // Keep refs in sync
  useEffect(() => { observerModeRef.current = observerMode; }, [observerMode]);
  useEffect(() => { frequencyRef.current = frequency; }, [frequency]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { whiteboardDataRef.current = whiteboardData; }, [whiteboardData]);
  useEffect(() => { notebookContentRef.current = notebookContent; }, [notebookContent]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { localInferenceEnabledRef.current = localInferenceEnabled; }, [localInferenceEnabled]);
  useEffect(() => { museStatusRef.current = museStatus; }, [museStatus]);
  useEffect(() => { isWebcamEnabledRef.current = isWebcamEnabled; }, [isWebcamEnabled]);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);

  // Ref for action handlers (populated later, used for pop-out communication)
  const actionHandlersRef = useRef<{
    startRecording?: () => void;
    stopRecording?: () => void;
    handlePause?: () => void;
    handleResume?: () => void;
    handleReset?: () => void;
    handleClose?: () => void;
    handleArchiveProbe?: (probeId: string) => Promise<void>;
    handleToggleFocus?: (probeId: string, focused: boolean) => void;
    handleAdvanceStep?: (forceAdvance?: boolean) => Promise<void>;
    handleRollbackToStep?: (stepIndex: number) => Promise<void>;
  }>({});

  // Handler for actions from pop-out window
  const handlePopOutAction = useCallback((action: SessionAction) => {
    const handlers = actionHandlersRef.current;
    switch (action.action) {
      case "start":
        handlers.startRecording?.();
        break;
      case "stop":
        handlers.stopRecording?.();
        break;
      case "pause":
        handlers.handlePause?.();
        break;
      case "resume":
        handlers.handleResume?.();
        break;
      case "reset":
        handlers.handleReset?.();
        break;
      case "close":
        handlers.handleClose?.();
        break;
      case "archive_probe":
        if (action.probeId) handlers.handleArchiveProbe?.(action.probeId);
        break;
      case "toggle_focus":
        if (action.probeId !== undefined) handlers.handleToggleFocus?.(action.probeId, action.focused ?? false);
        break;
      case "advance_step":
        handlers.handleAdvanceStep?.();
        break;
      case "rollback_step":
        if (action.stepIndex !== undefined) handlers.handleRollbackToStep?.(action.stepIndex);
        break;
    }
  }, []);

  // Broadcast sync for pop-out window communication
  const { 
    broadcastState, 
    broadcastProbes, 
    broadcastPlan, 
    broadcastRecordingStatus 
  } = useSessionSync({
    sessionId,
    isMainWindow: true,
    onAction: handlePopOutAction,
    onPeerConnected: () => {
      // Don't re-enable if user explicitly dismissed the popout
      if (popOutDismissedRef.current) return;
      setIsPopOutActive(true);
      // Send full state to the newly connected pop-out window
      if (sessionRef.current) {
        broadcastState({
          probes: sessionRef.current.probes,
          sessionPlan: sessionPlanRef.current,
          isRecording,
          isPaused,
          elapsedSeconds,
          cycleProgress: elapsedSeconds % 60,
          isAnalyzing,
          archivingProbeId,
          planLoading,
          planError,
          originalPrompt: sessionRef.current.problem,
          objectives,
          objectiveStatuses,
        });
      }
    },
    onPeerDisconnected: () => {
      setIsPopOutActive(false);
      popOutWindowRef.current = null;
    },
  });

  // Broadcast state updates when relevant state changes (excluding time-based updates)
  useEffect(() => {
    if (!isPopOutActive || !sessionRef.current) return;
    broadcastState({
      probes: sessionRef.current.probes,
      isRecording,
      isPaused,
      isAnalyzing,
      archivingProbeId,
      planLoading,
      planError,
      objectives,
      objectiveStatuses,
    });
  }, [isPopOutActive, isRecording, isPaused, isAnalyzing, archivingProbeId, planLoading, planError, objectives, objectiveStatuses, broadcastState]);

  // Broadcast time updates separately at a lower frequency (every 5 seconds)
  useEffect(() => {
    if (!isPopOutActive) return;
    if (elapsedSeconds % 5 !== 0) return; // Only broadcast every 5 seconds
    broadcastState({
      elapsedSeconds,
      cycleProgress: elapsedSeconds % 60,
    });
  }, [isPopOutActive, elapsedSeconds, broadcastState]);

  // Broadcast probes when session probes change
  useEffect(() => {
    if (!isPopOutActive || !session?.probes) return;
    broadcastProbes(session.probes);
  }, [isPopOutActive, session?.probes, broadcastProbes]);

  // Broadcast session plan when it changes
  useEffect(() => {
    if (!isPopOutActive) return;
    broadcastPlan(sessionPlan);
  }, [isPopOutActive, sessionPlan, broadcastPlan]);

  // Handle opening pop-out window
  const handlePopOut = useCallback(() => {
    if (popOutWindowRef.current && !popOutWindowRef.current.closed) {
      // Focus existing pop-out
      popOutWindowRef.current.focus();
    } else {
      // Clear dismissed state when user explicitly opens a new popout
      popOutDismissedRef.current = false;
      // Open new pop-out
      const popOut = openPopOutWindow(sessionId);
      popOutWindowRef.current = popOut;
      if (popOut) {
        setIsPopOutActive(true);
      }
    }
  }, [sessionId]);

  // Stable callback for focusing pop-out window (used by memoized overlay)
  const handleFocusPopOut = useCallback(() => {
    if (popOutWindowRef.current && !popOutWindowRef.current.closed) {
      popOutWindowRef.current.focus();
    }
  }, []);

  // Change tab title and warn on close when pop-out is active
  useEffect(() => {
    if (!isPopOutActive) return;

    // Store original title
    const originalTitle = document.title;
    
    // Change tab title to warning
    document.title = "⚠️ Keep Open - Session Active";

    // Warn user if they try to close/navigate away
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "The monitoring session is running in a separate window. Closing this tab will end your session.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.title = originalTitle;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isPopOutActive]);



  // Listen for probe events from ProbeNotifications
  useEffect(() => {
    const handleProbeRevealed = (e: Event) => {
      const probeId = (e as CustomEvent).detail;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          probes: prev.probes.map((p) =>
            p.id === probeId ? { ...p, isRevealed: true } : p
          ),
        };
      });
      if (sessionRef.current) {
        sessionRef.current = {
          ...sessionRef.current,
          probes: sessionRef.current.probes.map((p) =>
            p.id === probeId ? { ...p, isRevealed: true } : p
          ),
        };
      }
    };

    const handleProbeStarToggled = (e: Event) => {
      const { probeId, starred } = (e as CustomEvent).detail;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          probes: prev.probes.map((p) =>
            p.id === probeId ? { ...p, starred } : p
          ),
        };
      });
    };

    window.addEventListener("probe-revealed", handleProbeRevealed);
    window.addEventListener("probe-star-toggled", handleProbeStarToggled);

    return () => {
      window.removeEventListener("probe-revealed", handleProbeRevealed);
      window.removeEventListener("probe-star-toggled", handleProbeStarToggled);
    };
  }, []);

  // Load session on mount from Supabase + fire opening probe early
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const s = await getSession(sessionId);
      if (cancelled) return;
      if (s) {
        setSession(s);
        sessionRef.current = s;
        
        // Reset language confirmation for new session
        setLanguageConfirmed(false);
        
        // Load tutoring language from session metadata if set
        if (s.metadata?.tutoringLanguage) {
          setTutoringLanguage(s.metadata.tutoringLanguage as typeof tutoringLanguage);
        }
        
        // Set paused state if session was paused
        if (s.status === "paused") {
          setIsPaused(true);
        }
        
        // Load objectives from session or generate new ones
        let loadedObjectives: string[] = [];
        if (s.objectives && s.objectives.length > 0) {
          loadedObjectives = s.objectives;
        } else {
          try {
            const objRes = await fetch("/api/generate-objectives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ problem: s.problem }),
            });
            if (!cancelled && objRes.ok) {
              const { objectives: generatedObjectives } = await objRes.json();
              if (generatedObjectives && generatedObjectives.length > 0) {
                loadedObjectives = generatedObjectives;
              }
            }
          } catch { /* objectives are optional */ }
        }
        if (loadedObjectives.length > 0) {
          setObjectives(loadedObjectives);
          // Initialize all objectives with blue status
          setObjectiveStatuses(loadedObjectives.map(() => "blue"));
        }

        // Load or create session plan - but wait for language confirmation first
        setPlanLoading(true);
        setPlanError(null);
        try {
          // First try to load existing plan - use it but user will need to confirm language to translate if needed
          const existingPlan = await getSessionPlan(s.id);
          // Validate existing plan before using
          if (existingPlan && existingPlan.steps && Array.isArray(existingPlan.steps) && existingPlan.steps.length > 0 && existingPlan.goal) {
            setSessionPlan(existingPlan);
            sessionPlanRef.current = existingPlan;
          } else if (existingPlan) {
            console.warn("Loaded existing plan is invalid:", existingPlan);
          }
          // Don't create new plan here - wait for user to confirm language first
        } catch (err) {
          console.warn("Session plan loading failed:", err);
        } finally {
          if (!cancelled) setPlanLoading(false);
        }

        // Fire opening probe (now uses session plan context if available) - but only if session already has probes
        // Opening probe generation is now handled after language confirmation
        if (s.probes.length > 0) {
          // Session already has probes (e.g. page refresh) — show the latest
          const lastProbe = s.probes[s.probes.length - 1];
          setActiveProbe(lastProbe);
          setViewingProbeIndex(s.probes.length - 1);
        }
      } else {
        router.push("/");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  // Load prep material
  const loadPrepMaterial = async (type: string) => {
    if (!session?.problem) return;
    setPrepLoading(type);
    try {
      const response = await fetch(`/api/prep-material?topic=${encodeURIComponent(session.problem)}&type=${type}`);
      if (response.ok) {
        const data = await response.json();
        // Add card to list (avoid duplicates)
        setPrepCards(prev => {
          if (prev.some(c => c.id === type)) return prev;
          return [...prev, { id: type, title: data.title, content: data.content }];
        });
      }
    } catch (err) {
      console.error("Prep material error:", err);
    } finally {
      setPrepLoading(null);
    }
  };

  // ---- Muse EEG ----
  const handleConnectMuse = async () => {
    handleDisconnectMuse();
    setMuseStatus("connecting");
    setMuseError(null);
    try {
      const { MuseAthenaClient } = await import("@/lib/muse-athena");
      const muse = new MuseAthenaClient();

      muse.onEEG((sample: { channels: Record<string, number[]> }) => {
        for (const [channelName, samples] of Object.entries(sample.channels)) {
          const existing = eegBufferRef.current.get(channelName) || [];
          existing.push(...samples);
          if (existing.length > 512) {
            eegBufferRef.current.set(channelName, existing.slice(-512));
          } else {
            eegBufferRef.current.set(channelName, existing);
          }
        }
      });

      await muse.connect();
      museClientRef.current = muse;
      setMuseStatus("connected");

      await muse.startStreaming();
      setMuseStatus("streaming");

      eegIntervalRef.current = setInterval(() => {
        setEegChannelData(new Map(eegBufferRef.current));
      }, 100);

      bandIntervalRef.current = setInterval(() => {
        const af7 = eegBufferRef.current.get("AF7");
        const af8 = eegBufferRef.current.get("AF8");
        if (!af7 || af7.length < 256 || !af8 || af8.length < 256) return;
        const powers = computeBandPowers(af7.slice(-256), af8.slice(-256));
        setBandPowers(powers);
      }, 1000);
    } catch (err: unknown) {
      setMuseStatus("disconnected");
      const error = err as Error;
      if (error?.name === "NotFoundError" && error?.message?.includes("cancelled")) return;
      setMuseError(error?.message || "Connection failed.");
    }
  };

  const handleDisconnectMuse = () => {
    if (museClientRef.current) {
      try { museClientRef.current.disconnect(); } catch {}
      museClientRef.current = null;
    }
    if (eegIntervalRef.current) { clearInterval(eegIntervalRef.current); eegIntervalRef.current = null; }
    if (bandIntervalRef.current) { clearInterval(bandIntervalRef.current); bandIntervalRef.current = null; }
    eegBufferRef.current.clear();
    setEegChannelData(new Map());
    setBandPowers(null);
    setMuseStatus("disconnected");
  };

  // Hard minimum cooldown between probes (ms) to prevent rapid slot filling
  const PROBE_COOLDOWN_MS = 30_000;

  // ---- Local Analysis Heartbeat (runs Gemma 4 E2B in-browser) ----
  const runLocalAnalysisHeartbeat = useCallback(async () => {
    const currentSession = sessionRef.current;
    const currentPlan = sessionPlanRef.current;
    const recorder = recorderRef.current;
    const manager = LocalInferenceManager.getInstance();

    if (!currentSession || !currentPlan || !manager.isReady()) return;
    if (observerModeRef.current === "off") return;
    if (isMutedRef.current) return;
    if (isAnalyzingRef.current) return;

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      // Ensure local context buffer exists
      if (!localContextRef.current) {
        localContextRef.current = new LocalContextBuffer();
      }
      const ctx = localContextRef.current;

      // Step 1: Transcribe recent audio locally
      if (recorder && isRecordingRef.current) {
        try {
          const recentAudio = recorder.getRecentAudio(10000); // last 10s
          if (recentAudio && recentAudio.size > 100) {
            const transcript = await manager.transcribe(recentAudio);
            if (transcript) {
              ctx.addTranscript(transcript);
            }
          }
        } catch (err) {
          console.warn("[LocalInference] Transcription error:", err);
        }
      }

      // Step 2: Generate a probe locally (no plan update)
      const openProbes = currentSession.probes.filter(p => !p.archived);
      if (openProbes.length >= 5) {
        // Too many open probes, skip generation
        return;
      }

      // Hard cooldown: don't generate probes too rapidly
      const timeSinceLastLocal = Date.now() - (lastProbeTimeRef.current || 0);
      if (lastProbeTimeRef.current !== 0 && timeSinceLastLocal < PROBE_COOLDOWN_MS) {
        return;
      }

      const currentStep = currentPlan.steps?.[currentPlan.currentStepIndex];
      const snapshot = ctx.getContext();

      const analysisContext: LocalAnalysisContext = {
        planGoal: currentPlan.goal || "",
        currentStep: currentStep?.description || "",
        recentTranscripts: snapshot.recentTranscripts,
        toolEvents: snapshot.toolEvents,
        facialSummary: snapshot.facialSummary,
        eegSummary: snapshot.eegSummary,
        previousProbes: currentSession.probes.map(p => p.text),
        tutoringLanguage: tutoringLanguage,
      };

      setIsGeneratingProbe(true);
      const probeText = await manager.generateProbe(analysisContext);
      setIsGeneratingProbe(false);

      if (probeText && probeText.trim().length > 5 && !isDuplicateProbe(probeText, currentSession.probes)) {
        // Add probe in-memory only (not persisted to Supabase)
        const localProbe: Probe = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
          gapScore: 0.5,
          signals: ["local-inference"],
          text: probeText.trim(),
          requestType: "question" as RequestType,
          archived: false,
          starred: false,
          focused: false,
          isRevealed: false,
        };

        const updatedSession = {
          ...currentSession,
          probes: [...currentSession.probes, localProbe],
        };
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setActiveProbe(localProbe);
        setViewingProbeIndex(updatedSession.probes.length - 1);
        lastProbeTimeRef.current = Date.now();
      }
    } catch (err) {
      console.error("[LocalInference] Analysis error:", err);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsGeneratingProbe(false);
    }
  }, [tutoringLanguage]);

  // ---- Analysis Heartbeat (10s) ----
  // Returns structured result for the heartbeat hook to track health.
  // Transcription is now decoupled — it runs on the storage heartbeat cycle,
  // so transcripts are already available when analysis fires.
  const runAnalysisHeartbeat = useCallback(async (): Promise<AnalysisHeartbeatResult> => {
    const startMs = Date.now();

    // Route to local analysis if enabled
    if (localInferenceEnabledRef.current) {
      await runLocalAnalysisHeartbeat();
      return { success: true, durationMs: Date.now() - startMs };
    }

    const currentSession = sessionRef.current;

    if (!currentSession) return { success: true, durationMs: 0 };
    if (observerModeRef.current === "off") return { success: true, durationMs: 0 };
    if (isMutedRef.current) return { success: true, durationMs: 0 };
    if (isAnalyzingRef.current) return { success: true, durationMs: 0 };

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      const openProbes = currentSession.probes.filter(p => !p.archived);
      const focusedProbes = openProbes.filter(p => p.focused).map(p => ({ id: p.id, text: p.text }));
      const currentPlan = sessionPlanRef.current;

      if (!currentPlan) {
        return { success: true, durationMs: Date.now() - startMs };
      }

      // Helper to validate plan data
      const isValidPlan = (plan: SessionPlan | null | undefined): boolean => {
        return !!(plan && 
          plan.steps && 
          Array.isArray(plan.steps) && 
          plan.steps.length > 0 &&
          plan.goal);
      };

      // Single call to session-plan/update (now includes gap analysis)
      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          previousProbes: currentSession.probes.map((p) => p.text),
          // Send {id, text} so the LLM can echo real UUIDs in probes_to_archive.
          activeProbes: openProbes.map(p => ({ id: p.id, text: p.text })),
          focusedProbes,
          openProbeCount: openProbes.length,
          lastProbeTimestamp: lastProbeTimeRef.current || 0,
        }),
      });

      if (!res.ok) {
        return { success: false, durationMs: Date.now() - startMs, error: "Analysis service unavailable" };
      }

      const planData = await res.json();

      // Update objective statuses based on gap score from the unified response
      if (planData.gapScore !== undefined) {
        setObjectiveStatuses(prev => {
          if (prev.length === 0) return prev;
          const newStatuses = [...prev];
          const statusToSet: "red" | "yellow" | "green" = 
            planData.gapScore >= 0.7 ? "red" : 
            planData.gapScore >= 0.4 ? "yellow" : "green";
          
          const idxToUpdate = currentSession.probes.length % newStatuses.length;
          newStatuses[idxToUpdate] = statusToSet;
          return newStatuses;
        });
      }

      // Process plan update response
      if (planData) {
        // Check for step transition BEFORE updating state
        const previousStepIndex = sessionPlanRef.current?.currentStepIndex ?? 0;
        const newStepIndex = planData.plan?.currentStepIndex ?? 0;
        const totalSteps = planData.plan?.steps?.length ?? 0;
        const llmWantsAdvance = newStepIndex > previousStepIndex && isValidPlan(planData.plan);
        // Only allow automatic step transitions when autoAdvance is ON
        const isStepTransition = llmWantsAdvance && autoAdvanceRef.current;
        
        const allStepsCompleted = planData.plan?.steps?.every((s: { status: string }) => s.status === 'completed') ?? false;
        const isPlanComplete = isStepTransition && allStepsCompleted && totalSteps > 0;
        
        if (isStepTransition && isValidPlan(planData.plan)) {
          // Auto-advance: accept the new plan with advanced step
          setSessionPlan(planData.plan);
          sessionPlanRef.current = planData.plan;
          const nextStepDesc =
            planData.plan?.steps?.[newStepIndex]?.description?.slice(0, 80) ?? "";
          addHeartbeatLog({
            timestamp: Date.now(),
            level: "info",
            source: "plan",
            message: `Plan advanced: step ${previousStepIndex + 1} → ${newStepIndex + 1} of ${totalSteps}${nextStepDesc ? ` — ${nextStepDesc}` : ""}`,
          });
        } else if (llmWantsAdvance && !autoAdvanceRef.current) {
          // Manual mode: LLM says ready to advance, but user controls when
          // Keep current plan (don't advance), but update other fields
          const planWithoutAdvance = {
            ...planData.plan,
            currentStepIndex: previousStepIndex,
            steps: planData.plan.steps.map((s: { status: string }, idx: number) => ({
              ...s,
              status: idx < previousStepIndex ? "completed" 
                : idx === previousStepIndex ? "in_progress" 
                : s.status === "skipped" ? "skipped" : "pending",
            })),
          };
          if (isValidPlan(planWithoutAdvance)) {
            setSessionPlan(planWithoutAdvance);
            sessionPlanRef.current = planWithoutAdvance;
          }
          addHeartbeatLog({
            timestamp: Date.now(),
            level: "info",
            source: "plan",
            message: `LLM suggests advance (step ${previousStepIndex + 1} → ${newStepIndex + 1}) — manual mode, waiting for user`,
          });
        } else if (isValidPlan(planData.plan)) {
          setSessionPlan(planData.plan);
          sessionPlanRef.current = planData.plan;
        } else if (planData.plan) {
          console.warn('[Plan Update] Plan corrupted, keeping previous state:', planData.plan);
        }
        
        // On step transition: archive ALL active probes and trigger celebration
        if (isStepTransition) {
          const activeProbesForArchive = currentSession.probes.filter(p => !p.archived);
          if (activeProbesForArchive.length > 0) {
            let sessionWithArchivedProbes = currentSession;
            for (const probe of activeProbesForArchive) {
              await archiveProbe(probe.id);
              sessionWithArchivedProbes = {
                ...sessionWithArchivedProbes,
                probes: sessionWithArchivedProbes.probes.map(p => 
                  p.id === probe.id ? { ...p, archived: true } : p
                ),
              };
            }
            setSession(sessionWithArchivedProbes);
            sessionRef.current = sessionWithArchivedProbes;
          }
          
          if (isPlanComplete) {
            playSessionCompleteSound();
            addHeartbeatLog({
              timestamp: Date.now(),
              level: "info",
              source: "plan",
              message: `Plan complete (${totalSteps}/${totalSteps} steps) — session paused`,
            });
            setTimeout(() => {
              setShowPlanCompleteModal(true);
              if (isRecording && !isPaused) {
                setIsPaused(true);
              }
            }, 1500);
          } else {
            playStepCompleteSound();
          }
          if (activeProbesForArchive.length > 0) {
            addHeartbeatLog({
              timestamp: Date.now(),
              level: "info",
              source: "probe",
              message: `${activeProbesForArchive.length} probe${activeProbesForArchive.length === 1 ? "" : "s"} auto-archived (step transition)`,
            });
          }
        } else if (planData.probesToArchive && planData.probesToArchive.length > 0) {
          let updatedSession = currentSession;
          for (const probeId of planData.probesToArchive) {
            await archiveProbe(probeId);
            updatedSession = {
              ...updatedSession,
              probes: updatedSession.probes.map(p => 
                p.id === probeId ? { ...p, archived: true } : p
              ),
            };
          }
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          
          if (planData.probesToArchive.length > 0) {
            playArchiveSound();
            addHeartbeatLog({
              timestamp: Date.now(),
              level: "info",
              source: "probe",
              message: `${planData.probesToArchive.length} probe${planData.probesToArchive.length === 1 ? "" : "s"} auto-archived by analysis`,
            });
          }
        }
        
        // Use the next request from the plan update
        if (planData.nextRequest) {
          const currentOpenProbeCount = (sessionRef.current?.probes || currentSession.probes).filter(p => !p.archived).length;
          
          const timeSinceLastProbe = Date.now() - (lastProbeTimeRef.current || 0);
          const cooldownMet = lastProbeTimeRef.current === 0 || timeSinceLastProbe >= PROBE_COOLDOWN_MS;

          const allProbes = (sessionRef.current?.probes || currentSession.probes);
          const isDupe = isDuplicateProbe(planData.nextRequest.text, allProbes);

          if (planData.canGenerateProbe !== false && currentOpenProbeCount < 5 && cooldownMet && !isDupe) {
            const savedProbe = await addProbe(currentSession.id, {
              timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
              gapScore: planData.gapScore ?? 0.5,
              signals: planData.signals || [],
              text: planData.nextRequest.text,
              requestType: planData.nextRequest.type || "question",
              planStepId: currentPlan.steps?.[currentPlan.currentStepIndex]?.id,
            });
            
            if (planData.nextRequest.suggested_tools) {
              savedProbe.suggestedTools = planData.nextRequest.suggested_tools;
            }
            
            const updatedSession = addProbeToSession(currentSession, savedProbe);
            setSession(updatedSession);
            sessionRef.current = updatedSession;

            setActiveProbe(savedProbe);
            setViewingProbeIndex(updatedSession.probes.length - 1);
            lastProbeTimeRef.current = Date.now();

            const probePreview = planData.nextRequest.text.slice(0, 80);
            addHeartbeatLog({
              timestamp: Date.now(),
              level: "info",
              source: "probe",
              message: `New probe (${planData.nextRequest.type || "question"}, gap=${(planData.gapScore ?? 0.5).toFixed(2)}): ${probePreview}${planData.nextRequest.text.length > 80 ? "…" : ""}`,
            });
          } else if (planData.canGenerateProbe !== false) {
            // LLM wanted to send one but we rejected it — record the reason
            // so operators can debug why probes aren't landing.
            const reason = isDupe
              ? "duplicate"
              : currentOpenProbeCount >= 5
                ? `open-probe cap (${currentOpenProbeCount}/5)`
                : !cooldownMet
                  ? `cooldown (${Math.round((PROBE_COOLDOWN_MS - timeSinceLastProbe) / 1000)}s remaining)`
                  : "unknown";
            addHeartbeatLog({
              timestamp: Date.now(),
              level: "warning",
              source: "probe",
              message: `New probe suppressed: ${reason}`,
            });
          }
        }
      }

      return { success: true, durationMs: Date.now() - startMs, gapScore: planData.gapScore };
    } catch (err) {
      console.error("Analysis error:", err);
      return { success: false, durationMs: Date.now() - startMs, error: String(err) };
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
      setIsGeneratingProbe(false);
    }
  }, []);

  // ---- Storage Heartbeat (5s) ----
  // Returns structured result for the heartbeat hook to track health
  const runStorageHeartbeat = useCallback(async (): Promise<StorageHeartbeatResult> => {
    const currentSession = sessionRef.current;
    const recorder = recorderRef.current;
    const currentMuseStatus = museStatusRef.current;
    const currentWebcamEnabled = isWebcamEnabledRef.current;

    if (!currentSession || !isRecordingRef.current) {
      return {};
    }

    const result: StorageHeartbeatResult = {};

    try {
      // Audio: get recent 5 seconds and save (with retry)
      if (recorder) {
        const recentAudio = recorder.getRecentAudio(5000);
        if (recentAudio && recentAudio.size > 100) {
          result.audio = { attempted: true, saved: false };
          const idx = chunkIndexRef.current++;
          const saveResult = await retryWithResult(
            () => saveAudioChunk(currentSession.id, recentAudio, idx, Date.now()),
            { maxRetries: 2, baseDelayMs: 500 },
          );
          if (saveResult.success && saveResult.data === null) {
            // saveAudioChunk returns null when the chunk is below the
            // minimum size threshold (silence / near-silence). This is an
            // intentional skip, not a failure — don't count it as an error.
            result.audio = { attempted: false, saved: false };
          } else {
            result.audio.saved = saveResult.success && !!saveResult.data;
            if (!result.audio.saved) {
              // Surface the underlying error so the LogsTool shows an entry
              // next to the incremented `failed` counter.
              result.audio.error = saveResult.error
                ? String((saveResult.error as Error)?.message ?? saveResult.error)
                : "audio upload returned no data";
            }
          }
        }
      }

      // Transcribe any pending audio chunks (decoupled from analysis — runs on storage cycle)
      if (currentSession && isRecordingRef.current) {
        try {
          await fetch("/api/transcribe-chunks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: currentSession.id }),
          });
        } catch (err) {
          console.warn("Background transcription error:", err);
        }
      }

      // Tool data: save whiteboard and notebook content (with deduplication)
      if (whiteboardDataRef.current) {
        const whiteboardKey = `canvas_${currentSession.id}`;
        const whiteboardResult = await saveWithDedupString(whiteboardDataRef.current, whiteboardKey);
        if (whiteboardResult.saved) {
          await logTool("canvas", "canvas_draw", { data: whiteboardDataRef.current });
        }
      }
      if (notebookContentRef.current && notebookContentRef.current.trim().length > 0) {
        const notebookKey = `notebook_${currentSession.id}`;
        const notebookResult = await saveWithDedupString(notebookContentRef.current, notebookKey);
        if (notebookResult.saved) {
          await logTool("notebook", "notebook_edit", { data: notebookContentRef.current });
        }
      }

      // EEG: flush buffer if streaming (with retry)
      if (currentSession && currentMuseStatus === "streaming" && eegBufferRef.current.size > 0) {
        result.eeg = { attempted: true, saved: false };
        // Snapshot and CLEAR the buffer before async save to prevent duplicate data
        const channels: Record<string, number[]> = {};
        for (const [ch, samples] of eegBufferRef.current.entries()) {
          channels[ch] = samples.slice();
        }
        eegBufferRef.current.clear();

        const eegIdx = eegChunkIndexRef.current++;
        const saveResult = await retryWithResult(
          () => saveSessionEEG(currentSession.id, { channels, bandPowers }, museClientRef.current?.deviceName, eegIdx, Date.now()),
          { maxRetries: 2, baseDelayMs: 500 },
        );
        result.eeg.saved = saveResult.success;
        if (!result.eeg.saved && saveResult.error) {
          result.eeg.error = String((saveResult.error as Error)?.message ?? saveResult.error);
        }
      }

      // Facial: flush buffer if webcam enabled (with retry)
      if (currentSession && currentWebcamEnabled && facialBufferRef.current.length > 0) {
        result.facial = { attempted: true, saved: false };
        // Snapshot and CLEAR the buffer before async save to prevent duplicate data
        const facialSnapshot = [...facialBufferRef.current];
        facialBufferRef.current = [];

        const facialIdx = facialChunkIndexRef.current++;
        const saveResult = await retryWithResult(
          () => saveFacialData(currentSession.id, facialSnapshot, facialIdx, Date.now()),
          { maxRetries: 2, baseDelayMs: 500 },
        );
        result.facial.saved = saveResult.success;
        if (!result.facial.saved && saveResult.error) {
          result.facial.error = String((saveResult.error as Error)?.message ?? saveResult.error);
        }
      }

      return result;
    } catch (err) {
      console.error("Storage heartbeat error:", err);
      return { error: String(err) };
    }
  }, []);

  // ---- Heartbeat Hook ----
  // Centralizes scheduling, reentrancy guards, health tracking, adaptive throttling,
  // and structured logging. Replaces the inline setInterval logic.
  const addHeartbeatLog = useCallback((entry: Omit<LogEntry, "id">) => {
    const logEntry: LogEntry = { ...entry, id: `hb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    logsRef.current.push(logEntry);
    // Keep log buffer bounded
    if (logsRef.current.length > 500) {
      logsRef.current = logsRef.current.slice(-400);
    }
    setLogs([...logsRef.current]);
  }, []);

  // Forward ref for heartbeat.recordTransferEvent — the heartbeat object is
  // declared below, so we can't close over it directly inside `logTool`. The
  // ref is populated in an effect right after the heartbeat is created.
  const recordTransferEventRef = useRef<
    ((channel: "tools", saved: boolean, error?: string) => void) | null
  >(null);

  /**
   * Log a tool event. Does THREE things:
   *   1. Persists it to Supabase (`session-tool` bucket + `session_tool`
   *      table) via `logToolUsage`.
   *   2. Records a transfer event on the `tools` channel so sent/saved/failed
   *      counters in the Data Transfer Health table stay in sync (same
   *      pattern as audio / eeg / facial / screenshots).
   *   3. Emits a log entry with `source: "tool"` so the event appears in the
   *      Logs UI (filterable by source).
   */
  const logTool = useCallback(
    async (
      toolName: ToolName,
      action: ToolAction,
      metadata: Record<string, unknown> = {},
    ) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const now = Date.now();
      const elapsedMs = currentSession.startedAt
        ? now - new Date(currentSession.startedAt).getTime()
        : 0;

      // 1 + 2. Persist to Supabase, capture granular result for the counter.
      let persistError: string | undefined;
      let persistOk = false;
      try {
        const result = await logToolUsage(currentSession.id, toolName, action, now, metadata);
        persistOk = result.success;
        persistError = result.error;
      } catch (err) {
        persistError = String((err as Error)?.message ?? err);
      }

      recordTransferEventRef.current?.("tools", persistOk, persistError);

      // 3. Compact metadata preview (guard against huge payloads like full
      // whiteboard/notebook strings so we don't flood the UI).
      const metaKeys = Object.keys(metadata);
      let metaStr = "";
      if (metaKeys.length > 0) {
        try {
          const compact: Record<string, unknown> = {};
          for (const k of metaKeys) {
            const v = metadata[k];
            if (typeof v === "string" && v.length > 60) {
              compact[k] = `${v.slice(0, 60)}… (${v.length}c)`;
            } else if (Array.isArray(v)) {
              compact[k] = `Array(${v.length})`;
            } else {
              compact[k] = v;
            }
          }
          metaStr = ` ${JSON.stringify(compact).slice(0, 160)}`;
        } catch {
          metaStr = ` [${metaKeys.join(", ")}]`;
        }
      }

      // The per-channel failure log is already emitted by
      // `recordTransferEvent`, so here we only log the high-level success
      // event (keeps the log from double-reporting failures).
      if (persistOk) {
        addHeartbeatLog({
          timestamp: now,
          level: "info",
          source: "tool",
          message: `${toolName}/${action} @${Math.round(elapsedMs / 1000)}s${metaStr}`,
        });
      }
    },
    [addHeartbeatLog],
  );

  const heartbeat = useSessionHeartbeat({
    storageIntervalMs: STORAGE_INTERVAL_MS,
    analysisIntervalMs: ANALYSIS_INTERVAL_MS,
    onStorageHeartbeat: runStorageHeartbeat,
    onAnalysisHeartbeat: runAnalysisHeartbeat,
    onLog: addHeartbeatLog,
  });

  // Expose the heartbeat's transfer-event recorder to `logTool` (which is
  // defined above the heartbeat). Kept in a ref so we don't need to pass
  // `heartbeat` as a dep of every `logTool` caller.
  recordTransferEventRef.current = heartbeat.recordTransferEvent;

  /**
   * Manual "Submit to Helios" — triggered by the user from the canvas or
   * notebook toolbar. This is an out-of-band analysis request: the tutor
   * normally polls every `ANALYSIS_INTERVAL_MS`, but the user explicitly
   * wants attention *now* (e.g. "I've sketched my answer, please look").
   *
   * Two steps:
   *   1. Flush tool state to Supabase via `runStorageHeartbeat`. The
   *      analysis endpoint reads the most recent notebook/canvas uploads
   *      by `sessionId`, so we must ensure the latest edits are stored
   *      before asking Helios to look.
   *   2. Fire `runAnalysisHeartbeat`. Both run-functions are guarded
   *      against concurrent invocation (`isAnalyzingRef`, hook-level
   *      `isAnalysisRunningRef`), so racing with the 10s timer is safe.
   *
   * `logTool` is called up front so the click is always recorded, even if
   * the analysis early-exits (e.g. observer off, muted, already running).
   */
  const handleSubmitToHelios = useCallback(
    async (toolName: "canvas" | "notebook") => {
      const metadata: Record<string, unknown> = {};
      if (toolName === "notebook") {
        metadata.contentLength = notebookContentRef.current?.length ?? 0;
      } else {
        metadata.hasCanvas = !!whiteboardDataRef.current;
      }
      // Fire-and-forget the log; we don't want the network round-trip to
      // delay the user-perceived submit.
      void logTool(toolName, "submit_to_helios", metadata);

      try {
        // 1. Push latest tool state to storage so the backend has it.
        await runStorageHeartbeat();
      } catch (err) {
        console.warn("[SubmitToHelios] storage heartbeat failed:", err);
        // Continue anyway — analysis can still run against the previously
        // stored state; better than silently doing nothing.
      }

      try {
        // 2. Ask Helios to analyse now.
        await runAnalysisHeartbeat();
      } catch (err) {
        console.warn("[SubmitToHelios] analysis heartbeat failed:", err);
      }

      // Clear the dirty flag so the button disables until the user edits
      // again. We do this even if the analysis heartbeat threw — the user
      // has done everything they can; re-enabling the button would invite
      // spam retries without new content.
      if (toolName === "canvas") {
        setCanvasDirtyForHelios(false);
      } else {
        setNotebookDirtyForHelios(false);
      }
    },
    [logTool, runStorageHeartbeat, runAnalysisHeartbeat],
  );

  const checkMicrophone = async () => {
    setMicStatus("checking");
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      micStreamRef.current = mediaStream;
      setMicStatus("ready");
    } catch (err) {
      setMicStatus("denied");
      setError(t('session.micDenied'));
    }
  };

  const startRecording = async () => {
    try {
      setError(null);

      // Try to get mic — audio is optional, session can run without it
      let mediaStream: MediaStream | null = micStreamRef.current;
      try {
        if (!mediaStream || mediaStream.getTracks().some(t => t.readyState === "ended")) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 48000,
            },
          });
        }
        micStreamRef.current = null; // hand off ownership
        setStream(mediaStream);

        const recorder = new AudioRecorder({
          chunkDurationMs: 60000,
          maxBufferDurationMs: 300000,
        });
        recorderRef.current = recorder;
        await recorder.start(mediaStream);
      } catch (micErr) {
        console.warn("[SessionView] Mic unavailable, starting session without audio:", micErr);
        setError(t('session.micNotFound'));
        mediaStream = null;
        micStreamRef.current = null;
        recorderRef.current = null;
        setStream(null);
      }

      // Always start the session regardless of mic availability
      setIsRecording(true);
      setIsPaused(false);

      // Sync DB status to active
      if (session) {
        updateSessionStatus(session.id, "active").catch(() => {});
      }

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Start the heartbeat system (handles scheduling, reentrancy, health tracking)
      heartbeat.start();

    } catch (err) {
      console.error("[SessionView] startRecording failed:", err);
      setError(t('session.micError'));
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Clean up local inference if active
    if (localInferenceEnabledRef.current) {
      LocalInferenceManager.getInstance().dispose();
      localContextRef.current?.clear();
    }

    // Stop heartbeat system (waits for in-flight analysis, runs final flush)
    await heartbeat.stop();

    const recorder = recorderRef.current;
    
    const fullAudio = recorder?.getFullAudio() ?? null;
    
    await recorder?.stop();
    recorderRef.current = null;

    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setIsRecording(false);
    setIsSaving(true);
    if (!session) return;

    const finalSession = endSession(session, elapsedSeconds * 1000);
    finalSession.hasAudio = !!fullAudio;
    finalSession.metadata = {
      ...finalSession.metadata,
      whiteboardData: whiteboardData || undefined,
      notebookData: notebookContent || undefined,
    };

    // Persist to Supabase
    await saveSession(finalSession);

    // Save any remaining EEG data before navigating
    if (museStatus === "streaming" && eegBufferRef.current.size > 0) {
      const channels: Record<string, number[]> = {};
      for (const [ch, samples] of eegBufferRef.current.entries()) {
        channels[ch] = samples;
      }
      await saveSessionEEG(finalSession.id, { channels, bandPowers }, museClientRef.current?.deviceName);
    }

    handleDisconnectMuse();

    // Navigate after all data is saved
    router.push(`/results?id=${finalSession.id}`);
  };

  // ---- Screenshot Handlers ----
  // Screenshots run on their own interval (decoupled from the storage
  // heartbeat), so we report every save attempt directly to the heartbeat
  // hook via `recordTransferEvent`. That keeps the Data Transfer Health
  // table's `screenshots` row in sync and surfaces failures in the event log.
  const handleStartScreenCapture = useCallback(async () => {
    if (!screenCaptureRef.current) {
      screenCaptureRef.current = createScreenCapture({
        onScreenshotCaptured: async (blob: Blob, timestamp: number) => {
          const screenshotKey = `screenshot_${sessionId}`;
          try {
            const dedup = await saveWithDedupBlob(blob, screenshotKey);
            // Dedup hit (content unchanged) is a no-op, not an attempt.
            if (!dedup.saved) return;

            const path = await saveScreenshot(sessionId, blob, timestamp);
            if (path) {
              setScreenshotCount((c) => c + 1);
              heartbeat.recordTransferEvent("screenshots", true);
            } else {
              heartbeat.recordTransferEvent(
                "screenshots",
                false,
                "saveScreenshot returned null (upload rejected)",
              );
            }
          } catch (error) {
            console.error("[Screenshot] Failed to save:", error);
            heartbeat.recordTransferEvent(
              "screenshots",
              false,
              String((error as Error)?.message ?? error),
            );
          }
        },
        intervalMs: 5000,
        onStatusChange: (capturing: boolean) => {
          setIsScreenCapturing(capturing);
        },
      });
    }
    await screenCaptureRef.current.start();
  }, [sessionId, heartbeat]);

  const handleStopScreenCapture = useCallback(() => {
    screenCaptureRef.current?.stop();
  }, []);

  const handlePause = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    heartbeat.pause();

    // Track what was active before pause (for auto-resume)
    wasRecordingRef.current = !!recorderRef.current;
    wasScreenCapturingRef.current = isScreenCapturing;
    wasWebcamEnabledRef.current = isWebcamEnabled;
    wasMuseStreamingRef.current = museStatus === "streaming";

    // Store stream references for potential resume
    pausedAudioStreamRef.current = stream;
    pausedScreenStreamRef.current = screenCaptureRef.current?.getStream() || null;
    pausedWebcamStreamRef.current = null;

    const recorder = recorderRef.current;
    await recorder?.stop();
    recorderRef.current = null;

    // Stop all data flows
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    
    // Stop screen capture
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      setIsScreenCapturing(false);
    }

    // Stop EEG
    handleDisconnectMuse();

    // Stop webcam (FaceTracker manages its own stream internally)
    setIsWebcamEnabled(false);
    
    setIsRecording(false);
    setIsPaused(true);

    if (session) {
      await pauseSession(session.id);
    }
  };

  const handleResume = async () => {
    if (!session) return;

    try {
      // Try to resume audio stream — mic is optional
      try {
        let mediaStream = pausedAudioStreamRef.current;
        const tracksStillActive = mediaStream?.getTracks().some(t => t.readyState === "live");
        if (!mediaStream || !tracksStillActive) {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        setStream(mediaStream);

        const AudioRecorderClass = (await import("@/lib/audio")).AudioRecorder;
        const recorder = new AudioRecorderClass({
          chunkDurationMs: 60000,
          maxBufferDurationMs: 300000,
        });
        await recorder.start(mediaStream);
        recorderRef.current = recorder;
      } catch (micErr) {
        console.warn("[SessionView] Mic unavailable on resume, continuing without audio:", micErr);
        setError(t('session.micNotFound'));
        recorderRef.current = null;
        setStream(null);
      }

      setIsRecording(true);
      setIsPaused(false);

      await resumeSession(session.id);

      const startTime = Date.now() - (elapsedSeconds * 1000);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Resume heartbeat system (counter resets for immediate flush)
      heartbeat.resume();

      // Auto-resume data sources that were active before pause
      // Screen capture
      if (wasScreenCapturingRef.current) {
        if (screenCaptureRef.current) {
          const existingStream = pausedScreenStreamRef.current;
          const streamStillActive = existingStream?.getVideoTracks().some(t => t.readyState === "live");
          if (streamStillActive) {
            try {
              await screenCaptureRef.current.start();
              setIsScreenCapturing(true);
            } catch (e) {
              console.warn("[Resume] Could not restart screen capture:", e);
              wasScreenCapturingRef.current = false;
            }
          } else {
            wasScreenCapturingRef.current = false;
          }
        }
      }

      // Webcam (FaceTracker will auto-start when enabled)
      if (wasWebcamEnabledRef.current) {
        setIsWebcamEnabled(true);
      }

      // EEG (auto-reconnect)
      if (wasMuseStreamingRef.current) {
        handleConnectMuse();
      }

    } catch (err) {
      console.error("[SessionView] handleResume failed:", err);
      setError(t('session.micError'));
    }
  };

  const handleMute = (durationMs: number) => {
    setIsMuted(true);
    setMuteRemaining(durationMs);
    if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
    muteTimerRef.current = setTimeout(() => { setIsMuted(false); setMuteRemaining(0); }, durationMs);
  };

  // Reset session - deletes probes but keeps data chunks
  const handleReset = async () => {
    if (!session) return;
    
    try {
      // Clear probes from database
      await resetSessionProbes(session.id);
      
      // Clear local probe state
      const resetSession = { ...session, probes: [] };
      setSession(resetSession);
      sessionRef.current = resetSession;
      setActiveProbe(null);
      setViewingProbeIndex(-1);
      
      // Reset probe-related refs
      lastProbeTimeRef.current = 0;
    } catch (err) {
      console.error("Reset session error:", err);
    }
  };

  // Close session - navigate to dashboard without ending
  const handleClose = () => {
    // Session stays paused, just navigate away
    router.push("/");
  };

  /**
   * Fetch the opening probe from the API and persist it. Extracted so that
   * the in-panel Tutor Welcome flow can defer this network call until the
   * user clicks Play, rather than firing it inside the settings modal.
   */
  const fetchAndSaveOpeningProbe = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const probeRes = await fetch("/api/opening-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: s.problem,
          objectives,
          sessionId: s.id,
          tutoringLanguage,
        }),
      });
      if (!probeRes.ok) return;
      const { probe: probeText } = await probeRes.json();
      if (!probeText?.trim()) return;
      const savedProbe = await addProbe(s.id, {
        timestamp: 0,
        gapScore: 0,
        signals: ["opening"],
        text: probeText,
        requestType: "question",
      });
      const base = { ...s, probes: [] };
      const updated = addProbeToSession(base, savedProbe);
      setSession(updated);
      sessionRef.current = updated;
      setActiveProbe(savedProbe);
      setViewingProbeIndex(updated.probes.length - 1);
    } catch (err) {
      console.error("[SessionView] Opening probe fetch failed:", err);
    }
  }, [objectives, tutoringLanguage]);

  /**
   * The user clicked the Play button inside the tutor welcome panel. This
   * is the moment we actually fetch the opening probe. We also mark the
   * welcome as "seen" so a page refresh doesn't re-play the welcome.
   */
  const handleWelcomePlay = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    setIsStartingSession(true);
    try {
      // Bring the session back to an actively-recording state. Three cases:
      //   1. Fresh session: `!isRecording` → startRecording (first mic req).
      //   2. Paused session (e.g. Help was just clicked): `isPaused` →
      //      handleResume restarts the recorder/heartbeat/streams.
      //   3. Already active: no-op.
      if (!isRecording) {
        await startRecording();
      } else if (isPaused) {
        await handleResume();
      }
      // Only fetch the opening probe on fresh sessions. If the session
      // already has probes (e.g. Help button re-runs the welcome flow),
      // we preserve the existing probe history.
      const hasActive = s.probes.some(p => !p.archived);
      if (!hasActive) {
        await fetchAndSaveOpeningProbe();
      }
    } finally {
      markSessionWelcomeSeen(s.id);
      setShowWelcomePanel(false);
      setIsStartingSession(false);
      // If the welcome was opened via the Help button, restore the
      // user's previous pane layout so tools/plan don't stay hidden.
      const prev = helpPreviousLayoutRef.current;
      if (prev) {
        helpPreviousLayoutRef.current = null;
        // Give the welcome-panel collapse effect a beat to finish before
        // we overwrite it, otherwise its 80ms timer races us.
        window.setTimeout(() => {
          resizablePaneRef.current?.setLayout(prev.outer);
          resizablePaneRef2.current?.setLayout(prev.inner);
          // Reverse-map the collapsed states back to the 3 visibility
          // toggles so the UI controls match the restored layout.
          const outerLeft = prev.outer.collapsedSide === "left";
          const outerRight = prev.outer.collapsedSide === "right";
          const innerLeft = prev.inner.collapsedSide === "left";
          const innerRight = prev.inner.collapsedSide === "right";
          setPaneVisibility({
            tools: !outerLeft,
            // Helios (tutor) pane is always visible — it cannot be hidden.
            tutor: true,
            plan: !outerRight && !innerRight,
          });
        }, 120);
      }
    }
    // startRecording / handleResume are defined inline and reference many
    // setters/refs; including them as deps would cause noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAndSaveOpeningProbe, isRecording, isPaused]);

  // Archive a probe (immediately, without LLM validation)
  const handleArchiveProbe = async (probeId: string) => {
    if (!session) return;
    
    const probe = session.probes.find(p => p.id === probeId);
    if (!probe) return;
    
    setArchivingProbeId(probeId);
    
    try {
      // Archive the probe directly
      await archiveProbe(probeId);
      
      // Update local state
      const updatedProbes = session.probes.map(p => 
        p.id === probeId ? { ...p, archived: true } : p
      );
      const updatedSession = { ...session, probes: updatedProbes };
      setSession(updatedSession);
      sessionRef.current = updatedSession;
      
      // Play success sound
      playArchiveSound();
    } catch (err) {
      console.error("Archive probe error:", err);
    } finally {
      // Delay clearing to allow animation to complete
      setTimeout(() => setArchivingProbeId(null), 500);
    }
  };

  // Toggle focus on a probe
  const handleToggleFocus = async (probeId: string, focused: boolean) => {
    if (!session) return;
    
    try {
      await toggleProbeFocused(probeId, focused);
      
      // Update local state
      const updatedProbes = session.probes.map(p => 
        p.id === probeId ? { ...p, focused } : p
      );
      const updatedSession = { ...session, probes: updatedProbes };
      setSession(updatedSession);
      sessionRef.current = updatedSession;
    } catch (err) {
      console.error("Toggle focus error:", err);
    }
  };

  const handleConfirmEnd = async () => {
    setShowEndDialog(false);
    if (session) {
      const finalSession = endSession(session, elapsedSeconds * 1000, "completed");
      setSession(finalSession);
      sessionRef.current = finalSession;
    }
    await stopRecording();
  };

  const handleAdvanceStep = async (forceAdvance = false) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;
    const openProbes = currentSession.probes.filter(p => !p.archived);

    // --- Local inference mode: advance step entirely in-browser ---
    if (localInferenceEnabledRef.current) {
      const currentPlan = sessionPlanRef.current;
      if (!currentPlan?.steps?.length) return;

      const currentIdx = currentPlan.currentStepIndex ?? 0;
      const isLastStep = currentIdx >= currentPlan.steps.length - 1;

      // Mark current step completed, next step in_progress, and advance index
      const nextIdx = isLastStep ? currentIdx : currentIdx + 1;
      const updatedSteps = currentPlan.steps.map((s, i) => {
        if (i === currentIdx) return { ...s, status: "completed" as const };
        if (i === nextIdx && !isLastStep) return { ...s, status: "in_progress" as const };
        return s;
      });
      const updatedPlan = {
        ...currentPlan,
        steps: updatedSteps,
        currentStepIndex: nextIdx,
      };
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Sync step completion to backend
      updateSessionPlan(currentPlan.id, {
        steps: updatedSteps,
        currentStepIndex: updatedPlan.currentStepIndex,
      }).catch(err => console.warn("[LocalInference] Failed to sync plan to backend:", err));

      // Archive all active probes in-memory (not persisted since local mode)
      if (openProbes.length > 0) {
        const archivedSession = {
          ...currentSession,
          probes: currentSession.probes.map(p => !p.archived ? { ...p, archived: true } : p),
        };
        setSession(archivedSession);
        sessionRef.current = archivedSession;
      }

      if (isLastStep) {
        // All steps done
        playSessionCompleteSound();
        setTimeout(() => {
          setShowPlanCompleteModal(true);
          if (isRecording && !isPaused) setIsPaused(true);
        }, 1500);
      } else {
        // Step completed, generate local probe for next step
        playStepCompleteSound();

        const newStep = updatedPlan.steps[updatedPlan.currentStepIndex];
        if (newStep) {
          let probeText = "";
          const manager = LocalInferenceManager.getInstance();

          setIsGeneratingProbe(true);
          if (manager.isReady()) {
            try {
              const ctx = localContextRef.current;
              const snapshot = ctx?.getContext();
              const latestForProbe = sessionRef.current || currentSession;
              probeText = await manager.generateProbe({
                planGoal: updatedPlan.goal || "",
                currentStep: newStep.description || "",
                recentTranscripts: snapshot?.recentTranscripts || [],
                toolEvents: snapshot?.toolEvents || [],
                facialSummary: snapshot?.facialSummary,
                eegSummary: snapshot?.eegSummary,
                previousProbes: latestForProbe.probes.map(p => p.text),
                tutoringLanguage,
              });
            } catch (err) {
              console.warn("[LocalInference] Probe generation failed:", err);
            }
          }
          setIsGeneratingProbe(false);

          if (probeText && probeText.trim().length > 5) {
            const latestSession = sessionRef.current || currentSession;
            const localProbe: Probe = {
              id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
              gapScore: 0.5,
              signals: ["local-inference", "manual_step_advance"],
              text: probeText.trim(),
              requestType: (newStep.type || "question") as RequestType,
              archived: false,
              starred: false,
              focused: false,
              isRevealed: false,
            };
            const updatedSession = addProbeToSession(latestSession, localProbe);
            setSession(updatedSession);
            sessionRef.current = updatedSession;
            setActiveProbe(localProbe);
            setViewingProbeIndex(updatedSession.probes.length - 1);
            lastProbeTimeRef.current = Date.now();
          } else {
            console.warn("[LocalInference] Failed to generate a probe for this step.");
          }
        }
      }
      return;
    }

    // --- API mode (unchanged) ---
    try {
      const res = await fetch("/api/session-plan/advance-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          forceAdvance,
          previousProbes: currentSession.probes.map(p => p.text),
          focusedProbes: openProbes.filter(p => p.focused).map(p => ({ id: p.id, text: p.text })),
          openProbeCount: openProbes.length,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Advance step failed:", errorData);
        return;
      }
      
      const data = await res.json();
      
      // Handle blocked response — show reasoning and offer force-advance
      if (data.blocked) {
        const reasoning = data.advanceReasoning || "You may not be ready to move on yet.";
        // Create a feedback probe so the user sees WHY they can't advance
        const feedbackProbe = await addProbe(session.id, {
          timestamp: Date.now() - new Date(session.startedAt).getTime(),
          gapScore: data.gapScore ?? 0.6,
          signals: ["advance_blocked"],
          text: reasoning,
          requestType: "feedback",
          planStepId: sessionPlanRef.current?.steps?.[sessionPlanRef.current.currentStepIndex]?.id,
        });
        const updatedSession = addProbeToSession(currentSession, feedbackProbe);
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setActiveProbe(feedbackProbe);
        setViewingProbeIndex(updatedSession.probes.length - 1);
        
        // Also create the next request probe if the LLM suggested one
        if (data.nextRequest && openProbes.length < 4) {
          const nextProbe = await addProbe(session.id, {
            timestamp: Date.now() - new Date(session.startedAt).getTime(),
            gapScore: data.gapScore ?? 0.6,
            signals: ["advance_blocked_followup"],
            text: data.nextRequest.text,
            requestType: data.nextRequest.type || "question",
            planStepId: sessionPlanRef.current?.steps?.[sessionPlanRef.current.currentStepIndex]?.id,
          });
          const updatedSession2 = addProbeToSession(sessionRef.current || updatedSession, nextProbe);
          setSession(updatedSession2);
          sessionRef.current = updatedSession2;
        }
        return;
      }
      
      const { plan: updatedPlan, allComplete } = data;
      
      // Validate plan before updating
      if (!updatedPlan?.steps?.length || !updatedPlan?.goal) {
        console.warn('[Advance Step] Received invalid plan, keeping previous state');
        return;
      }
      
      // Update plan state
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;
      
      // Archive all active probes (same as automatic step transitions)
      const activeProbes = currentSession.probes.filter(p => !p.archived);
      if (activeProbes.length > 0) {
        let sessionWithArchivedProbes = currentSession;
        for (const probe of activeProbes) {
          await archiveProbe(probe.id);
          sessionWithArchivedProbes = {
            ...sessionWithArchivedProbes,
            probes: sessionWithArchivedProbes.probes.map(p => 
              p.id === probe.id ? { ...p, archived: true } : p
            ),
          };
        }
        setSession(sessionWithArchivedProbes);
        sessionRef.current = sessionWithArchivedProbes;
      }
      
      if (allComplete) {
        // Plan fully complete - celebrate and show modal
        playSessionCompleteSound();
        setTimeout(() => {
          setShowPlanCompleteModal(true);
          if (isRecording && !isPaused) {
            setIsPaused(true);
          }
        }, 1500);
      } else {
        // Regular step completion - generate probe for next step
        playStepCompleteSound();

        // Immediately generate a probe for the new step
        const newStep = updatedPlan.steps?.[updatedPlan.currentStepIndex];
        if (newStep) {
          setIsGeneratingProbe(true);
          try {
            const probeRes = await fetch("/api/generate-probe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                problem: session.problem,
                gapScore: 0.5,
                signals: ["manual_step_advance"],
                previousProbes: currentSession.probes.map(p => p.text),
                archivedProbes: currentSession.probes.filter(p => p.archived).map(p => p.text),
                sessionPlan: updatedPlan,
              }),
            });
            
            if (probeRes.ok) {
              const probeData = await probeRes.json();
              if (probeData.probe?.trim()) {
                const latestSession = sessionRef.current || currentSession;
                const savedProbe = await addProbe(session.id, {
                  timestamp: Date.now() - new Date(session.startedAt).getTime(),
                  gapScore: 0.5,
                  signals: ["manual_step_advance", "plan_step"],
                  text: probeData.probe.trim(),
                  requestType: probeData.requestType || newStep.type || "question",
                  planStepId: newStep.id,
                });
                
                const updatedSession = addProbeToSession(latestSession, savedProbe);
                setSession(updatedSession);
                sessionRef.current = updatedSession;
                setActiveProbe(savedProbe);
                setViewingProbeIndex(updatedSession.probes.length - 1);
              }
            }
          } catch (probeErr) {
            console.warn("Failed to generate probe for new step:", probeErr);
          } finally {
            setIsGeneratingProbe(false);
          }
        }
      }
    } catch (err) {
      console.error("Advance step error:", err);
    }
  };

  const handleRollbackToStep = async (stepIndex: number) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    // --- Local inference mode: rollback entirely in-browser ---
    if (localInferenceEnabledRef.current) {
      const currentPlan = sessionPlanRef.current;
      if (!currentPlan?.steps?.length) return;

      // Reset steps: target step becomes in_progress, everything after becomes pending
      const updatedSteps = currentPlan.steps.map((s, i) => {
        if (i < stepIndex) return s; // keep completed steps before target
        if (i === stepIndex) return { ...s, status: "in_progress" as const };
        return { ...s, status: "pending" as const };
      });
      const updatedPlan = { ...currentPlan, steps: updatedSteps, currentStepIndex: stepIndex };
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Sync to backend
      updateSessionPlan(currentPlan.id, {
        steps: updatedSteps,
        currentStepIndex: stepIndex,
      }).catch(err => console.warn("[LocalInference] Failed to sync rollback to backend:", err));

      // Archive all active probes in-memory
      const activeProbes = currentSession.probes.filter(p => !p.archived);
      let latestSession = currentSession;
      if (activeProbes.length > 0) {
        latestSession = {
          ...currentSession,
          probes: currentSession.probes.map(p => !p.archived ? { ...p, archived: true } : p),
        };
        setSession(latestSession);
        sessionRef.current = latestSession;
      }

      // Generate probe for rolled-back step
      const targetStep = updatedPlan.steps[stepIndex];
      if (targetStep) {
        let probeText = "";
        const manager = LocalInferenceManager.getInstance();
        setIsGeneratingProbe(true);
        if (manager.isReady()) {
          try {
            const ctx = localContextRef.current;
            const snapshot = ctx?.getContext();
            probeText = await manager.generateProbe({
              planGoal: updatedPlan.goal || "",
              currentStep: targetStep.description || "",
              recentTranscripts: snapshot?.recentTranscripts || [],
              toolEvents: snapshot?.toolEvents || [],
              facialSummary: snapshot?.facialSummary,
              eegSummary: snapshot?.eegSummary,
              previousProbes: latestSession.probes.map(p => p.text),
              tutoringLanguage,
            });
          } catch (err) {
            console.warn("[LocalInference] Probe generation failed on rollback:", err);
          }
        }
        setIsGeneratingProbe(false);
        if (probeText && probeText.trim().length > 5) {
          const localProbe: Probe = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
            gapScore: 0.5,
            signals: ["local-inference", "manual_step_rollback"],
            text: probeText.trim(),
            requestType: (targetStep.type || "question") as RequestType,
            archived: false,
            starred: false,
            focused: false,
            isRevealed: false,
          };
          const updatedSession = addProbeToSession(latestSession, localProbe);
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          setActiveProbe(localProbe);
          setViewingProbeIndex(updatedSession.probes.length - 1);
          lastProbeTimeRef.current = Date.now();
        } else {
          console.warn("[LocalInference] Failed to generate a probe for this step.");
        }
      }
      return;
    }

    // --- API mode (unchanged) ---
    try {
      const res = await fetch("/api/session-plan/rollback-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, targetStepIndex: stepIndex }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Rollback step failed:", errorData);
        return;
      }
      
      const { plan: updatedPlan } = await res.json();
      
      // Validate plan before updating
      if (!updatedPlan?.steps?.length || !updatedPlan?.goal) {
        console.warn('[Rollback Step] Received invalid plan, keeping previous state');
        return;
      }
      
      // Update plan state
      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;
      
      // Archive all active probes (clean slate for the rolled-back step)
      const activeProbes = currentSession.probes.filter(p => !p.archived);
      if (activeProbes.length > 0) {
        let sessionWithArchivedProbes = currentSession;
        for (const probe of activeProbes) {
          await archiveProbe(probe.id);
          sessionWithArchivedProbes = {
            ...sessionWithArchivedProbes,
            probes: sessionWithArchivedProbes.probes.map(p => 
              p.id === probe.id ? { ...p, archived: true } : p
            ),
          };
        }
        setSession(sessionWithArchivedProbes);
        sessionRef.current = sessionWithArchivedProbes;
      }
      
      // Generate a probe for the rolled-back step
      const targetStep = updatedPlan.steps?.[stepIndex];
      if (targetStep) {
        setIsGeneratingProbe(true);
        try {
          const probeRes = await fetch("/api/generate-probe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problem: session.problem,
              gapScore: 0.5,
              signals: ["manual_step_rollback"],
              previousProbes: currentSession.probes.map(p => p.text),
              archivedProbes: currentSession.probes.filter(p => p.archived).map(p => p.text),
              sessionPlan: updatedPlan,
            }),
          });
          
          if (probeRes.ok) {
            const probeData = await probeRes.json();
            if (probeData.probe?.trim()) {
              const latestSession = sessionRef.current || currentSession;
              const savedProbe = await addProbe(session.id, {
                timestamp: Date.now() - new Date(session.startedAt).getTime(),
                gapScore: 0.5,
                signals: ["manual_step_rollback", "plan_step"],
                text: probeData.probe.trim(),
                requestType: probeData.requestType || targetStep.type || "question",
                planStepId: targetStep.id,
              });
              
              const updatedSession = addProbeToSession(latestSession, savedProbe);
              setSession(updatedSession);
              sessionRef.current = updatedSession;
              setActiveProbe(savedProbe);
              setViewingProbeIndex(updatedSession.probes.length - 1);
            }
          }
        } catch (probeErr) {
          console.warn("Failed to generate probe for rolled-back step:", probeErr);
        } finally {
          setIsGeneratingProbe(false);
        }
      }
    } catch (err) {
      console.error("Rollback step error:", err);
    }
  };

  // ── Skip to step ────────────────────────────────────────────────
  const handleSkipToStep = async (stepIndex: number) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    try {
      const res = await fetch("/api/session-plan/skip-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, skipToIndex: stepIndex }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Skip steps failed:", errorData);
        return;
      }

      const { plan: updatedPlan } = await res.json();

      if (!updatedPlan?.steps?.length || !updatedPlan?.goal) {
        console.warn("[Skip Steps] Received invalid plan, keeping previous state");
        return;
      }

      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Archive all active probes + generate a fresh one for the new step
      try {
        const resetRes = await fetch("/api/session-plan/reset-probes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id }),
        });

        if (resetRes.ok) {
          const resetData = await resetRes.json();

          // Mark all local probes as archived
          const updatedSession: Session = {
            ...currentSession,
            probes: currentSession.probes.map(p => ({ ...p, archived: true })),
          };

          // Add the new probe if we got one
          let finalSession: Session = updatedSession;
          if (resetData.newProbe) {
            const newProbe: Probe = {
              id: resetData.newProbe.id,
              timestamp: resetData.newProbe.timestamp,
              gapScore: resetData.newProbe.gapScore,
              signals: resetData.newProbe.signals,
              text: resetData.newProbe.text,
              requestType: resetData.newProbe.requestType,
              planStepId: resetData.newProbe.planStepId,
              archived: false,
              focused: false,
            };
            finalSession = addProbeToSession(updatedSession, newProbe);
            setActiveProbe(newProbe);
            setViewingProbeIndex(finalSession.probes.length - 1);
            lastProbeTimeRef.current = Date.now();
          }

          setSession(finalSession);
          sessionRef.current = finalSession;
        }
      } catch (probeErr) {
        console.warn("Failed to reset probes after skip:", probeErr);
      }
    } catch (err) {
      console.error("Skip to step error:", err);
    }
  };

  // ── Regenerate remaining plan steps ────────────────────────────
  const handleRegeneratePlan = async (reason?: string) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    try {
      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, reason }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Regenerate plan failed:", errorData);
        return;
      }

      const { plan: updatedPlan } = await res.json();

      if (!updatedPlan?.steps?.length || !updatedPlan?.goal) {
        console.warn("[Regenerate] Received invalid plan, keeping previous state");
        return;
      }

      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Reset probes for the new current step
      try {
        const resetRes = await fetch("/api/session-plan/reset-probes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id }),
        });

        if (resetRes.ok) {
          const resetData = await resetRes.json();
          const updatedSession: Session = {
            ...currentSession,
            probes: currentSession.probes.map(p => ({ ...p, archived: true })),
          };

          let finalSession: Session = updatedSession;
          if (resetData.newProbe) {
            const newProbe: Probe = {
              id: resetData.newProbe.id,
              timestamp: resetData.newProbe.timestamp,
              gapScore: resetData.newProbe.gapScore,
              signals: resetData.newProbe.signals,
              text: resetData.newProbe.text,
              requestType: resetData.newProbe.requestType,
              planStepId: resetData.newProbe.planStepId,
              archived: false,
              focused: false,
            };
            finalSession = addProbeToSession(updatedSession, newProbe);
            setActiveProbe(newProbe);
            setViewingProbeIndex(finalSession.probes.length - 1);
            lastProbeTimeRef.current = Date.now();
          }

          setSession(finalSession);
          sessionRef.current = finalSession;
        }
      } catch (probeErr) {
        console.warn("Failed to reset probes after regenerate:", probeErr);
      }
    } catch (err) {
      console.error("Regenerate plan error:", err);
    } finally {
      setIsGeneratingProbe(false);
    }
  };

  // ── Reset probes (standalone) ──────────────────────────────────
  const handleResetProbes = async () => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    try {
      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/reset-probes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Reset probes failed:", errorData);
        return;
      }

      const resetData = await res.json();
      const updatedSession: Session = {
        ...currentSession,
        probes: currentSession.probes.map(p => ({ ...p, archived: true })),
      };

      let finalSession: Session = updatedSession;
      if (resetData.newProbe) {
        const newProbe: Probe = {
          id: resetData.newProbe.id,
          timestamp: resetData.newProbe.timestamp,
          gapScore: resetData.newProbe.gapScore,
          signals: resetData.newProbe.signals,
          text: resetData.newProbe.text,
          requestType: resetData.newProbe.requestType,
          planStepId: resetData.newProbe.planStepId,
          archived: false,
          focused: false,
        };
        finalSession = addProbeToSession(updatedSession, newProbe);
        setActiveProbe(newProbe);
        setViewingProbeIndex(finalSession.probes.length - 1);
        lastProbeTimeRef.current = Date.now();
      }

      setSession(finalSession);
      sessionRef.current = finalSession;
    } catch (err) {
      console.error("Reset probes error:", err);
    } finally {
      setIsGeneratingProbe(false);
    }
  };

  // Populate action handlers ref for pop-out window communication
  useEffect(() => {
    actionHandlersRef.current = {
      startRecording,
      stopRecording,
      handlePause,
      handleResume,
      handleReset,
      handleClose,
      handleArchiveProbe,
      handleToggleFocus,
      handleAdvanceStep,
      handleRollbackToStep,
    };
  }, [startRecording, stopRecording, handlePause, handleResume, handleReset, handleClose, handleArchiveProbe, handleToggleFocus, handleAdvanceStep, handleRollbackToStep]);

  // Auto-pause on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (isRecording && session) {
        e.preventDefault();
        await pauseSession(session.id);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isRecording, session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      heartbeat.pause(); // synchronous cleanup — stop interval immediately
      if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      handleDisconnectMuse();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile && sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center">
          <svg className="w-7 h-7 text-neutral-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">{t('session.mobileDetected')}</h2>
          <p className="text-sm text-neutral-400">{t('session.mobileDetectedDesc')}</p>
        </div>
        <a
          href={`/session/mobile/${sessionId}`}
          className="px-6 py-2.5 bg-neutral-100 hover:bg-white text-neutral-900 text-sm font-medium rounded-xl transition-colors"
        >
          {t('session.openMobileView')}
        </a>
        <button
          onClick={() => setIsMobile(false)}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          {t('session.continueDesktopAnyway')}
        </button>
      </div>
    );
  }

  if (!session || isSaving) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] gap-4">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-800 border-t-neutral-300 rounded-full" />
        {isSaving && (
          <p className="text-sm text-neutral-500 animate-pulse">{t('session.savingSession')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header with tutor-style avatar */}
            <div className="px-6 pt-6 pb-5 border-b border-neutral-800/70">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
                    <span className="text-lg font-serif text-neutral-200">T</span>
                  </div>
                  <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.08)] pointer-events-none" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="text-base font-semibold text-white leading-tight">{t('session.welcomeTitle')}</h2>
                  <p className="text-[12px] text-neutral-500 leading-tight mt-0.5">{t('session.welcomeMessage')}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
            {(() => {
              const isSessionReady = sessionPlan && !planLoading && !openingProbeLoading && session?.probes && session.probes.length > 0;

              // Phase 1: Language selection (before confirmation)
              if (!languageConfirmed) {
                const isButtonDisabled = planLoading || isPreparing;

                return (
                  <>
                    {/* Tutor language */}
                    <div className="mb-4">
                      <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 mb-2">
                        {t('session.tutorLanguage')}
                      </label>
                      <select
                        value={tutoringLanguage}
                        onChange={(e) => {
                          const newLang = e.target.value as typeof tutoringLanguage;
                          setTutoringLanguage(newLang);
                        }}
                        disabled={isButtonDisabled}
                        className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 hover:border-neutral-700 disabled:opacity-50 transition-colors"
                      >
                        {tutoringLocales.map((loc) => (
                          <option key={loc} value={loc}>
                            {tutoringLanguageNames[loc]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auto-advance toggle — hidden in UI (manual mode is the
                        default). Underlying state remains wired; remove the
                        `hidden` wrapper to bring the toggle back. */}
                    <button
                      type="button"
                      onClick={() => !isButtonDisabled && setAutoAdvance(!autoAdvance)}
                      disabled={isButtonDisabled}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="hidden w-full mb-3 p-3 rounded-xl border bg-neutral-900 border-neutral-800 hover:bg-neutral-800/60 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors items-center gap-3 text-left"
                    >
                      <div className="relative shrink-0 w-9 h-5 rounded-full bg-neutral-700">
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-100 shadow transition-transform ${autoAdvance ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-neutral-200 leading-tight">
                          {autoAdvance ? t('session.autoAdvanceOn') : t('session.manualMode')}
                        </span>
                        <span className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                          {autoAdvance
                            ? t('session.aiDecidesMoveForward')
                            : t('session.youClickToAdvance')}
                        </span>
                      </div>
                    </button>

                    {/* Browser Inference Toggle — hidden in UI while we
                        stabilise the feature, but the underlying state &
                        downstream logic remain wired so we can bring it
                        back by removing the `hidden` wrapper. */}
                    <button
                      type="button"
                      onClick={() => webGPUAvailable && !isButtonDisabled && setLocalInferenceEnabled(!localInferenceEnabled)}
                      disabled={!webGPUAvailable || isButtonDisabled}
                      aria-hidden="true"
                      tabIndex={-1}
                      className="hidden w-full mb-5 p-3 rounded-xl border bg-neutral-900 border-neutral-800 enabled:hover:bg-neutral-800/60 enabled:hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors items-center gap-3 text-left"
                    >
                      <div className="relative shrink-0 w-9 h-5 rounded-full bg-neutral-700">
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-100 shadow transition-transform ${localInferenceEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-neutral-200 leading-tight">
                          {localInferenceEnabled ? t('session.browserInferenceOn') : t('session.browserInference')}
                        </span>
                        <span className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                          {!webGPUAvailable
                            ? t('session.webGPUNotAvailable')
                            : t('session.browserInferenceDesc')}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={async () => {
                        if (!session || isPreparing) return;
                        
                        setPrepStage("plan");
                        setIsPreparing(true);
                        setPlanLoading(true);
                        setOpeningProbeLoading(true);
                        setPlanError(null);
                        setModelLoadError(null);
                        setModelLoadProgress(null);
                        
                        try {
                          // Save language to session metadata
                          const { data: sessionData } = await (await import("@/lib/supabase/client")).createClient()
                            .from("sessions")
                            .select("metadata")
                            .eq("id", session.id)
                            .single();
                          if (sessionData?.metadata) {
                            await (await import("@/lib/supabase/client")).createClient()
                              .from("sessions")
                              .update({ metadata: { ...sessionData.metadata, tutoringLanguage } })
                              .eq("id", session.id);
                          }
                          
                          // Check if plan exists - if so, translate it; otherwise create new
                          const existingPlan = await getSessionPlan(session.id);
                          let newPlan = null;
                          
                          if (existingPlan && existingPlan.steps && existingPlan.steps.length > 0 && existingPlan.goal) {
                            if (tutoringLanguage === "en") {
                              // English — no translation needed, use plan as-is
                              newPlan = existingPlan;
                            } else {
                              // Translate existing plan
                              console.log("[SessionView] Attempting to translate plan to:", tutoringLanguage);
                              const translateRes = await fetch("/api/session-plan/translate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  sessionId: session.id, 
                                  tutoringLanguage,
                                  objectives,
                                }),
                              });
                              console.log("[SessionView] Translate response status:", translateRes.status);
                              if (translateRes.ok) {
                                const { plan } = await translateRes.json();
                                newPlan = plan;
                                console.log("[SessionView] Translation succeeded, plan goal:", plan?.goal);
                              } else {
                                const err = await translateRes.json().catch(() => ({}));
                                console.error("[SessionView] Translation failed:", err);
                              }
                            }
                          } 
                          
                          if (!newPlan) {
                            // Create new plan with target language
                            console.log("[SessionView] Creating new plan with language:", tutoringLanguage);
                            const planRes = await fetch("/api/session-plan/create", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ 
                                sessionId: session.id, 
                                problem: session.problem, 
                                objectives,
                                planningPrompt: session.planningPrompt,
                                force: true,
                                tutoringLanguage,
                              }),
                            });
                            console.log("[SessionView] Create plan response status:", planRes.status);
                            if (planRes.ok) {
                              const { plan } = await planRes.json();
                              newPlan = plan;
                              console.log("[SessionView] Created plan goal:", plan?.goal);
                            } else {
                              const errorData = await planRes.json().catch(() => ({}));
                              console.error("[SessionView] Create plan failed:", errorData);
                              setPlanError(errorData.error || "Failed to create session plan");
                            }
                          }
                          
                          if (newPlan) {
                            setSessionPlan(newPlan);
                            sessionPlanRef.current = newPlan;
                          } else {
                            console.error("[SessionView] No plan could be created or translated!");
                            setPlanError("Failed to create session plan. Please try again.");
                          }
                          
                          // Archive existing probes. Whether we fetch the
                          // opening probe *now* or defer until the user
                          // clicks the in-panel Play button depends on
                          // whether this is a fresh, never-started session.
                          if (session.probes.length > 0) {
                            for (const probe of session.probes) {
                              await archiveProbe(probe.id);
                            }
                          }
                          const clearedSession = { ...session, probes: [] };
                          setSession(clearedSession);
                          sessionRef.current = clearedSession;
                          setActiveProbe(null);
                          setViewingProbeIndex(-1);

                          // A session is "fresh" if the user has not yet
                          // clicked Play for it. In that case we show the
                          // typed tutor welcome + Play button and defer the
                          // opening probe fetch until Play is clicked. We
                          // just archived any existing probes above, so
                          // welcome-seen is the single source of truth.
                          const isFreshSession = !isSessionWelcomeSeen(session.id);
                          if (isFreshSession) {
                            setShowWelcomePanel(true);
                          } else {
                            await fetchAndSaveOpeningProbe();
                          }
                          
                          // Plan prep done
                          setPlanLoading(false);
                          setOpeningProbeLoading(false);
                          setLanguageConfirmed(true);

                          // Stage 2: Load local model if enabled
                          if (localInferenceEnabled) {
                            setPrepStage("model");
                            try {
                              const manager = LocalInferenceManager.getInstance();
                              await manager.init((progress) => {
                                setModelLoadProgress(progress);
                              });
                              localContextRef.current = new LocalContextBuffer();
                            } catch (modelErr) {
                              setModelLoadError(modelErr instanceof Error ? modelErr.message : String(modelErr));
                              setIsPreparing(false);
                              return; // Keep modal open to show error
                            }
                          }

                          // All done - close modal and enter session
                          setPrepStage("done");
                          setIsPaused(false); // Reset paused state from previous session load
                          setShowWelcomeModal(false);
                        } catch (err) {
                          console.error("Failed to prepare session:", err);
                          setPlanError("Failed to prepare session");
                        } finally {
                          setPlanLoading(false);
                          setOpeningProbeLoading(false);
                          setIsPreparing(false);
                        }
                      }}
                      disabled={isButtonDisabled}
                      className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-colors bg-neutral-100 text-neutral-900 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isButtonDisabled ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t('session.preparing')}
                        </>
                      ) : t('session.confirmSettings')}
                    </button>

                    {/* Inline loading progress */}
                    {isPreparing && (
                      <div className="mt-4 space-y-2">
                        {/* Plan prep row */}
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums ${
                            prepStage !== "plan"
                              ? 'bg-neutral-100 text-neutral-900'
                              : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                          }`}>
                            {prepStage !== "plan" ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : '01'}
                          </div>
                          <span className={`flex-1 text-xs ${prepStage !== "plan" ? 'text-neutral-500' : 'text-neutral-300'}`}>
                            {prepStage === "plan" ? t('session.preparingPlan') : t('session.planReady')}
                          </span>
                          {prepStage === "plan" && (
                            <div className="w-3.5 h-3.5 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                          )}
                        </div>

                        {localInferenceEnabled && (
                          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums ${
                              prepStage === "done"
                                ? 'bg-neutral-100 text-neutral-900'
                                : prepStage === "model"
                                  ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                                  : 'bg-neutral-900 text-neutral-600 border border-neutral-800'
                            }`}>
                              {prepStage === "done" ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : '02'}
                            </div>
                            <span className={`flex-1 text-xs ${
                              prepStage === "done" ? 'text-neutral-500' : prepStage === "model" ? 'text-neutral-300' : 'text-neutral-600'
                            }`}>
                              {prepStage === "done" ? t('session.localModelLoaded') : prepStage === "model" ? t('session.loadingLocalModel') : t('session.loadLocalModel')}
                            </span>
                            {prepStage === "model" && !modelLoadProgress && (
                              <div className="w-3.5 h-3.5 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                            )}
                          </div>
                        )}

                        {/* Progress bar (only during model download) */}
                        {prepStage === "model" && modelLoadProgress && (
                          <div className="px-3 pt-1">
                            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-neutral-300 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${modelLoadProgress.progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[10px] text-neutral-500">
                                {modelLoadProgress.loaded && modelLoadProgress.total
                                  ? `${(modelLoadProgress.loaded / 1024 / 1024).toFixed(0)} / ${(modelLoadProgress.total / 1024 / 1024).toFixed(0)} MB`
                                  : t('session.downloading')}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{modelLoadProgress.progress}%</span>
                            </div>
                          </div>
                        )}

                        {/* Errors */}
                        {(planError || modelLoadError) && (
                          <div className="px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-xl">
                            <p className="text-xs text-red-400 leading-relaxed">{planError || modelLoadError}</p>
                          </div>
                        )}

                        {/* Cancel for model loading errors */}
                        {modelLoadError && (
                          <button
                            onClick={() => {
                              LocalInferenceManager.getInstance().dispose();
                              setModelLoadError(null);
                              setLocalInferenceEnabled(false);
                              setIsPreparing(false);
                              setPrepStage("done");
                            }}
                            className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                          >
                            {t('session.continueWithoutBrowserInference')}
                          </button>
                        )}
                      </div>
                    )}

                  </>
                );
              }

              // Phase 2: Ready (already confirmed before, e.g. page refresh).
              // If the user has never clicked Play on this session we drop
              // them into the in-panel tutor welcome. Otherwise straight in.
              return (
                <button
                  onClick={() => {
                    setIsPaused(false);
                    if (
                      session &&
                      !isSessionWelcomeSeen(session.id) &&
                      session.probes.filter(p => !p.archived).length === 0
                    ) {
                      setShowWelcomePanel(true);
                    }
                    setShowWelcomeModal(false);
                  }}
                  className="w-full py-3 px-4 text-sm font-medium rounded-xl transition-colors bg-neutral-100 text-neutral-900 hover:bg-white"
                >
                  {t('session.getStarted')}
                </button>
              );
            })()}
            </div>
          </div>
        </div>
      )}

      <ToolsPanel 
              activeTool={activeTool} 
              onToolChange={(tool) => {
                // "help" is a command, not a view: it pauses the session
                // and re-runs the tutor welcome (typed greeting + Play
                // button) with the layout collapsed to only-tutor-open.
                // Probes and session data are preserved — clicking Start
                // session from the welcome resumes recording.
                if (tool === "help") {
                  // Snapshot the current pane layout from localStorage
                  // so we can restore it when the user clicks Play. We
                  // only capture if we don't already have one in-flight
                  // (handles Help-clicked-again-while-welcome-open).
                  if (!helpPreviousLayoutRef.current) {
                    const readLayout = (key: string) => {
                      try {
                        const raw = localStorage.getItem(key);
                        if (!raw) return { collapsedSide: null as null | "left" | "right" };
                        const parsed = JSON.parse(raw);
                        return {
                          leftWidth: typeof parsed.leftWidth === "number" ? parsed.leftWidth : undefined,
                          collapsedSide: parsed.collapsedSide === "left" || parsed.collapsedSide === "right"
                            ? parsed.collapsedSide
                            : null,
                        };
                      } catch {
                        return { collapsedSide: null as null | "left" | "right" };
                      }
                    };
                    helpPreviousLayoutRef.current = {
                      outer: readLayout("session-split"),
                      inner: readLayout("session-split-right"),
                    };
                  }
                  if (isRecording && !isPaused) {
                    handlePause().catch(err =>
                      console.error("[SessionView] Help pause failed:", err),
                    );
                  }
                  setShowWelcomePanel(true);
                  // Force the collapse effect to re-fire even if the
                  // welcome panel was already open.
                  setWelcomeOpenNonce(n => n + 1);
                  return;
                }
                setActiveTool(tool);
                setShowGrokipediaOnly(tool === "grokipedia");
                if (tool === "grokipedia") {
                  setPrepToolContent(null);
                } else if (tool === "exercise" || tool === "reading") {
                  setPrepToolContent(null);
                  loadPrepToolContent(tool);
                }
              }} 
              problem={session.problem} 
              sessionId={session.id}
              planId={session.metadata?.plan_id as string | undefined}
              disabledTools={shouldBlockTools ? ["exercise", "reading"] as Tool[] : []}
            />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Error banner */}
        {error && !showWelcomeModal && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400 text-xs">✕</button>
          </div>
        )}
        {/* Session control bar + layout preset buttons */}
        {!showWelcomeModal && (
          <div className="relative flex items-center">
            <div className="flex-1 min-w-0">
              <SessionControlBar
                isRecording={isRecording}
                isPaused={isPaused}
                elapsedSeconds={elapsedSeconds}
                // If the tutor welcome is showing, pressing Play in the
                // top bar should behave identically to pressing Start
                // session in the panel: start/resume recording, fetch
                // the opening probe (fresh sessions only), and close
                // the welcome. Otherwise fall through to the normal
                // recording handlers.
                onStartRecording={showWelcomePanel ? handleWelcomePlay : startRecording}
                onStopRecording={() => setShowEndConfirm(true)}
                onPause={handlePause}
                onResume={showWelcomePanel ? handleWelcomePlay : handleResume}
              />
            </div>
            {/* Left-side: Back to Dashboard — always visible so users can
                leave the session without having to pause first. */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 shrink-0 z-10">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-colors"
                title={t('session.backToDashboard')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>{t('session.backToDashboard')}</span>
              </button>
            </div>
            {/* Quick layout preset buttons - absolute so they don't disturb centering of control bar */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 shrink-0 flex items-center gap-1 z-10">
              {/* Auto / Manual advance toggle — hidden in UI (manual mode is
                  the default). Underlying state remains wired so we can
                  restore the affordance by removing the `hidden` wrapper. */}
              <button
                onClick={() => setAutoAdvance(!autoAdvance)}
                className="hidden items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-colors"
                aria-hidden="true"
                tabIndex={-1}
                title={autoAdvance ? t('sessionPlan.aiControlsAdvancement') : t('sessionPlan.youControlAdvancement')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  {autoAdvance ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  )}
                </svg>
                <span>{autoAdvance ? t('sessionPlan.autoAdvance') : t('sessionPlan.manualMode')}</span>
                <div className="relative w-7 h-3.5 rounded-full bg-neutral-700">
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-neutral-100 shadow transition-transform ${autoAdvance ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
              </button>
              {/* Per-view visibility toggles. At least one view must stay
                  visible; the last-enabled toggle is disabled to prevent
                  a fully-empty workspace. Fixed width + icon so the three
                  pills are visually uniform regardless of translated label. */}
              {(() => {
                const { tools, tutor, plan } = paneVisibility;
                const countVisible = Number(tools) + Number(tutor) + Number(plan);
                const Toggle = ({
                  label, icon, active, onClick, disabled,
                }: {
                  label: string;
                  icon: React.ReactNode;
                  active: boolean;
                  onClick: () => void;
                  disabled: boolean;
                }) => (
                  <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    title={label}
                    className={`w-[104px] px-2 py-1 text-[10px] font-medium rounded-md border transition-colors flex items-center justify-center gap-1.5 ${
                      active
                        ? "bg-neutral-100 text-neutral-900 border-neutral-100 hover:bg-white"
                        : "bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800 hover:border-neutral-700"
                    } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {icon}
                    <span className="truncate">{label}</span>
                  </button>
                );
                const ToolsIcon = (
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                );
                const TutorIcon = (
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                );
                const PlanIcon = (
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                );
                return (
                  <div className="flex items-center gap-1">
                    <Toggle
                      label={t('tools.tools')}
                      icon={ToolsIcon}
                      active={tools}
                      disabled={tools && countVisible === 1}
                      onClick={() => applyPaneVisibility({ ...paneVisibility, tools: !tools })}
                    />
                    <Toggle
                      label={t('probes.tutor')}
                      icon={TutorIcon}
                      active={tutor}
                      // Helios pane is always visible and cannot be hidden.
                      disabled
                      onClick={() => applyPaneVisibility({ ...paneVisibility, tutor: !tutor })}
                    />
                    <Toggle
                      label={t('session.sessionPlan')}
                      icon={PlanIcon}
                      active={plan}
                      disabled={plan && countVisible === 1}
                      onClick={() => applyPaneVisibility({ ...paneVisibility, plan: !plan })}
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Resizable 3-pane split view */}
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <ResizablePane
              ref={resizablePaneRef}
              defaultLeftWidth={40}
              leftLabel={t('session.tools')}
              rightLabel={t('session.studentMonitoring')}
              storageKey="session-split"
              left={
                <div className="flex flex-col min-w-0 p-4 overflow-hidden h-full relative">
                  {shouldBlockTools && !["data-input", "help", "logs"].includes(activeTool) && (
                    <div className="absolute inset-0 z-10 bg-black/30 cursor-not-allowed" />
                  )}
                  <div className="flex-1 min-h-0 overflow-hidden relative">
                    {activeTool === "chat" && (
                      <LLMChat 
                        problem={session.problem}
                        messages={chatMessages}
                        onMessagesChange={setChatMessages}
                        sessionId={session.id}
                        tutoringLanguage={tutoringLanguage}
                        pendingMessage={pendingChatMessage}
                        onPendingMessageHandled={() => setPendingChatMessage(null)}
                      />
                    )}

                    {activeTool === "canvas" && (
                      <ExcalidrawCanvas
                        initialData={whiteboardData || undefined}
                        onCanvasChange={(data) => {
                          setWhiteboardData(data);
                          // Any canvas change re-arms the submit button.
                          setCanvasDirtyForHelios(true);
                          if (sessionRef.current) {
                            sessionRef.current = { ...sessionRef.current, metadata: { ...sessionRef.current.metadata, whiteboardData: data } };
                          }
                        }}
                        onSubmitToHelios={() => handleSubmitToHelios("canvas")}
                        canSubmitToHelios={canvasDirtyForHelios}
                      />
                    )}
                    {activeTool === "notebook" && (
                      <div className="h-full rounded-lg border border-neutral-800 bg-neutral-900/50 flex flex-col">
                        <textarea
                          value={notebookContent}
                          onChange={(e) => {
                            setNotebookContent(e.target.value);
                            // Any keystroke re-arms the submit button.
                            setNotebookDirtyForHelios(true);
                          }}
                          placeholder={t('session.notebookPlaceholder')}
                          className="flex-1 w-full bg-transparent border-none resize-none p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-0"
                        />
                        <div className="shrink-0 px-3 py-2 border-t border-neutral-800 flex items-center justify-between gap-3">
                          <span className="text-[10px] text-neutral-600">{t('session.characters', { count: notebookContent.length })}</span>
                          <NotebookSubmitButton
                            onSubmit={() => handleSubmitToHelios("notebook")}
                            disabled={notebookContent.trim().length === 0 || !notebookDirtyForHelios}
                            disabledReason={
                              notebookContent.trim().length === 0
                                ? t('whiteboard.nothingToSubmit')
                                : t('whiteboard.alreadySubmitted')
                            }
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom tools wrapper. Help is a command (restarts
                        the tutor welcome) rather than a view — handled in
                        the ToolsPanel onToolChange below. */}
                    <div className="mt-auto flex flex-col">
                      <div className={activeTool === "data-input" ? "h-full" : "hidden"}>
                      <DataInputTool
                        isRecording={isRecording}
                        sessionId={session?.id}
                        audioStream={stream}
                        museStatus={museStatus}
                        museError={museError}
                        museChannelData={eegChannelData}
                        bandPowers={bandPowers}
                        onConnectMuse={handleConnectMuse}
                        onDisconnectMuse={handleDisconnectMuse}
                        isWebcamEnabled={isWebcamEnabled}
                        onWebcamToggle={() => setIsWebcamEnabled(prev => !prev)}
                        latestFacialData={latestFacialData}
                        onFacialData={handleFacialData}
                        onFaceError={handleFaceError}
                        isScreenCapturing={isScreenCapturing}
                        onStartScreenCapture={handleStartScreenCapture}
                        onStopScreenCapture={handleStopScreenCapture}
                        screenshotCount={screenshotCount}
                      />
                    </div>
                    {activeTool === "logs" && (
                      <LogsTool
                        logs={logs}
                        transferHealth={heartbeat.transferHealth}
                        onClear={() => {
                          logsRef.current = [];
                          setLogs([]);
                        }}
                      />
                    )}
                    </div>
                    {activeTool === "plan-resources" && session?.metadata?.plan_id && !isMobile && (
                      <div className="h-full overflow-hidden">
                        <PlanResourcesPanel planId={session.metadata.plan_id as string} />
                      </div>
                    )}
                    {(activeTool === "grokipedia" || activeTool === "exercise" || activeTool === "reading") && (
                      <div className="h-full flex flex-col">
                        {activeTool === "grokipedia" && showGrokipediaOnly && session?.problem && (
                          <div className="flex-1 min-h-0 p-4 overflow-auto">
                            <div className="max-w-md mx-auto space-y-6">
                              {/* Header */}
                              <div className="text-center">
                                <h3 className="text-lg font-medium text-white mb-2">{t('session.grokipedia')}</h3>
                                <p className="text-sm text-neutral-400">{t('session.grokipediaDesc')}</p>
                              </div>

                              {/* Manual search input */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={grokipediaManualTerm}
                                  onChange={(e) => setGrokipediaManualTerm(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && grokipediaManualTerm.trim()) {
                                      window.open(`https://grokipedia.com/search?q=${encodeURIComponent(grokipediaManualTerm.trim())}`, '_blank');
                                    }
                                  }}
                                  placeholder={t('session.grokipediaSearchPlaceholder')}
                                  className="flex-1 px-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-neutral-500 transition-colors"
                                />
                                <a
                                  href={grokipediaManualTerm.trim() ? `https://grokipedia.com/search?q=${encodeURIComponent(grokipediaManualTerm.trim())}` : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!grokipediaManualTerm.trim()) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                                    grokipediaManualTerm.trim()
                                      ? 'bg-neutral-100 hover:bg-white text-neutral-900'
                                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                  }`}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  {t('session.grokipediaSearch')}
                                </a>
                              </div>

                              {/* Topic search shortcut */}
                              <div className="pt-2 border-t border-neutral-800">
                                <p className="text-xs text-neutral-500 mb-3">{t('session.grokipediaTopicSearch')}</p>
                                <a
                                  href={`https://grokipedia.com/search?q=${encodeURIComponent(session.problem)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                  </svg>
                                  <span className="truncate">{session.problem}</span>
                                </a>
                              </div>

                              {/* Suggested searches section */}
                              <div className="pt-2 border-t border-neutral-800">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs text-neutral-500">{t('session.grokipediaSuggestedSearches')}</p>
                                  <button
                                    onClick={fetchGrokipediaSuggestions}
                                    disabled={grokipediaSuggestionsLoading}
                                    className="text-xs text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {grokipediaSuggestionsLoading ? (
                                      <>
                                        <div className="w-3 h-3 border border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
                                        {t('common.loading')}
                                      </>
                                    ) : grokipediaSuggestions.length > 0 ? (
                                      <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        {t('session.grokipediaRefresh')}
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        {t('session.grokipediaGenerate')}
                                      </>
                                    )}
                                  </button>
                                </div>

                                {grokipediaSuggestions.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {grokipediaSuggestions.map((term, idx) => (
                                      <a
                                        key={idx}
                                        href={`https://grokipedia.com/search?q=${encodeURIComponent(term)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white text-sm rounded-lg transition-colors"
                                      >
                                        {term}
                                      </a>
                                    ))}
                                  </div>
                                ) : !grokipediaSuggestionsLoading && (
                                  <p className="text-xs text-neutral-600 text-center py-4">
                                    {t('session.grokipediaNoSuggestions')}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {((activeTool === "grokipedia" && !showGrokipediaOnly) || activeTool === "exercise" || activeTool === "reading") && !prepToolContent && !prepToolLoading && (
                          <div className="flex-1 min-h-0 p-4 flex flex-col items-center justify-center gap-4">
                            <button
                              onClick={() => loadPrepToolContent(activeTool)}
                              className="px-6 py-3 bg-neutral-100 hover:bg-white text-neutral-900 text-sm font-medium rounded-xl transition-colors"
                            >
                              {activeTool === "exercise" ? t('session.loadPractice') : t('session.loadTheory')}
                            </button>
                          </div>
                        )}
                        {prepToolLoading && (
                          <div className="flex-1 min-h-0 p-4 flex flex-col items-center justify-center">
                            <div className="w-6 h-6 border border-neutral-800 border-t-neutral-300 rounded-full animate-spin mb-3" />
                            <p className="text-sm text-neutral-500">{t('common.loading')}</p>
                          </div>
                        )}
                        {prepToolContent && !prepToolLoading && (
                          (activeTool === "exercise" || activeTool === "reading") ? (
                            <>
                              <div className="flex-1 min-h-0 overflow-auto p-4">
                                <h3 className="text-lg font-medium text-white mb-4">{prepToolContent.title}</h3>
                                <div className={`prose prose-invert prose-sm max-w-none text-neutral-300 ${activeTool === "exercise" ? "[&_p]:mb-4 [&_p]:leading-relaxed [&_ol]:mb-4 [&_ol]:pl-5 [&_ol]:space-y-3 [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:space-y-3 [&_li]:leading-relaxed [&_h1]:text-white [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-neutral-200 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 [&_strong]:text-white [&_hr]:my-4 [&_hr]:border-neutral-700" : ""}`}>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={activeTool === "reading" ? {
                                      a: ({ href, children }) => (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="no-underline inline-flex items-center gap-1.5 px-3 py-1.5 my-1 rounded-lg bg-neutral-900 text-white border border-neutral-700 hover:bg-neutral-800 hover:border-neutral-600 transition-all text-sm font-medium"
                                        >
                                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                          {children}
                                        </a>
                                      ),
                                    } : undefined}
                                  >
                                    {prepToolContent.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 min-h-0 p-4 overflow-auto">
                              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-lg font-medium text-white">{prepToolContent.title}</h3>
                                </div>
                                <div className="prose prose-invert prose-sm max-w-none text-neutral-300">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                  >
                                    {prepToolContent.content}
                                  </ReactMarkdown>
                                </div>
                                {activeTool === "grokipedia" && session?.problem && (
                                  <a
                                    href={`https://grokipedia.com/search?q=${encodeURIComponent(session.problem)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 inline-flex items-center gap-2 text-white hover:text-neutral-300 text-sm"
                                  >
                                    {t('session.openGrokipedia')}
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              }
              right={
                <ResizablePane
                  ref={resizablePaneRef2}
                  defaultLeftWidth={50}
                  leftLabel={t('probes.guidingTasks')}
                  rightLabel={t('session.sessionPlan')}
                  storageKey="session-split-right"
                  left={
                    <div className="relative h-full">
                      {shouldBlockTools && (
                        <div className="absolute inset-0 z-10 bg-black/30 cursor-not-allowed" />
                      )}
                      <ProbesPanel
                        probes={session.probes}
                        onArchiveProbe={handleArchiveProbe}
                        onToggleFocus={handleToggleFocus}
                        onToolSelect={(tool) => setActiveTool(tool as Tool)}
                        onOpenResources={handleStepResources}
                        onOpenPractice={handleStepPractice}
                        onAskAssistant={handleStepAskAssistant}
                        onResetProbes={handleResetProbes}
                        onToolEvent={(action, metadata) =>
                          logTool("probe", action, metadata ?? {})
                        }
                        archivingProbeId={archivingProbeId}
                        isInitializing={planLoading || openingProbeLoading}
                        isGeneratingProbe={isGeneratingProbe}
                        sessionPlan={sessionPlan}
                        isSessionActive={isRecording && !isPaused}
                        showWelcome={showWelcomePanel}
                        onWelcomePlay={handleWelcomePlay}
                        onOpenSessionPlan={() => ensureVisible("plan")}
                        onOpenTools={() => ensureVisible("tools")}
                        isStartingSession={isStartingSession}
                        sessionId={session.id}
                        ttsLanguage={tutoringLanguage}
                      />
                    </div>
                  }
                  right={
                    <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0a] h-full overflow-hidden relative">
                      {shouldBlockTools && (
                        <div className="absolute inset-0 z-10 bg-black/30 cursor-not-allowed" />
                      )}
                      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
                        <SessionPlanViewer
                          plan={sessionPlan ?? null}
                          loading={planLoading}
                          error={planError ?? null}
                          onAdvanceStep={handleAdvanceStep}
                          onRollbackToStep={handleRollbackToStep}
                          onSkipToStep={handleSkipToStep}
                          onRegeneratePlan={handleRegeneratePlan}
                          autoAdvance={autoAdvance}
                          onToggleAutoAdvance={setAutoAdvance}
                          sessionId={session.id}
                          onOpenResources={handleStepResources}
                          onOpenPractice={handleStepPractice}
                          onAskAssistant={handleStepAskAssistant}
                          onToolEvent={(action, metadata) =>
                            logTool("session_plan", action, metadata ?? {})
                          }
                          isSessionActive={isRecording && !isPaused}
                        />
                      </div>
                    </div>
                  }
                />
              }
            />
          </div>



          {/* Pop-out active banner - uses DOM manipulation to avoid re-renders */}
          <PopOutBanner 
            isVisible={isPopOutActive} 
            popOutWindowRef={popOutWindowRef}
            onDismiss={() => {
              popOutDismissedRef.current = true; // Prevent banner from re-appearing
              setIsPopOutActive(false);
              popOutWindowRef.current = null;
            }}
          />


        </div>
      </div>
      <ConfirmDialog
        open={showEndDialog}
        onCancel={() => setShowEndDialog(false)}
        onConfirm={handleConfirmEnd}
        variant="info"
        title={t('session.tutorSuggestsEnd')}
        description={endReason}
        confirmLabel={t('sessionEnd.endSession')}
        cancelLabel={t('common.keepGoing')}
        confirmTone="primary"
      />

      {/* SessionPrepModal removed -- loading progress now inline in welcome modal */}

      {/* End Session Confirmation — Stop is irreversible, so we warn and
          suggest the non-destructive pause + back-to-dashboard route. */}
      <ConfirmDialog
        open={showEndConfirm}
        onCancel={() => setShowEndConfirm(false)}
        onConfirm={async () => {
          setShowEndConfirm(false);
          try { await stopRecording(); } catch (e) { console.error(e); }
        }}
        onTertiary={async () => {
          setShowEndConfirm(false);
          if (!isPaused) {
            try { await handlePause(); } catch (e) { console.error(e); }
          }
          router.push("/dashboard");
        }}
        variant="destructive"
        title={t('sessionEnd.confirmEndTitle')}
        description={t('sessionEnd.confirmEndMessage')}
        confirmLabel={t('sessionEnd.endSession')}
        cancelLabel={t('sessionEnd.keepGoing')}
        tertiaryLabel={t('sessionEnd.pauseAndLeave')}
        tertiaryIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        }
      />

      {/* Plan Complete Modal - shown when all steps are done */}
      <ConfirmDialog
        open={showPlanCompleteModal}
        onCancel={() => setShowPlanCompleteModal(false)}
        onConfirm={() => {
          setShowPlanCompleteModal(false);
          handleConfirmEnd();
        }}
        variant="neutral"
        title={t('session.sessionComplete')}
        description={t('session.congratulationsComplete')}
        confirmLabel={t('sessionEnd.endSession')}
        confirmTone="primary"
        hideCancel
      />
    </div>
  );
}

// ---- Band Power Computation ----

function computeBandPowers(af7: number[], af8: number[]) {
  const n = 256;
  const sampleRate = 256;
  const bandRanges: Record<string, [number, number]> = {
    delta: [1, 4], theta: [4, 8], alpha: [8, 13], beta: [13, 30], gamma: [30, 44],
  };

  function channelBands(samples: number[]) {
    const windowed = samples.map((s, i) => s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
    const powers: Record<string, number> = {};
    for (const [band, [fLow, fHigh]] of Object.entries(bandRanges)) {
      let power = 0;
      const binLow = Math.floor((fLow * n) / sampleRate);
      const binHigh = Math.min(Math.ceil((fHigh * n) / sampleRate), n / 2);
      for (let k = binLow; k <= binHigh; k++) {
        let re = 0, im = 0;
        for (let j = 0; j < n; j++) {
          const angle = (2 * Math.PI * k * j) / n;
          re += windowed[j] * Math.cos(angle);
          im -= windowed[j] * Math.sin(angle);
        }
        power += (re * re + im * im) / (n * n);
      }
      powers[band] = power;
    }
    return powers;
  }

  const p1 = channelBands(af7.slice(-n));
  const p2 = channelBands(af8.slice(-n));
  const avg: Record<string, number> = {};
  for (const band of Object.keys(bandRanges)) avg[band] = ((p1[band] || 0) + (p2[band] || 0)) / 2;

  const total = Object.values(avg).reduce((s, v) => s + v, 0);
  if (total > 0) for (const band of Object.keys(avg)) avg[band] /= total;

  return { delta: avg.delta || 0, theta: avg.theta || 0, alpha: avg.alpha || 0, beta: avg.beta || 0, gamma: avg.gamma || 0 };
}


