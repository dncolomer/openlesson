"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FacialDataPoint } from "./FaceTracker";
import {
  getSession,
  addProbe,
  addProbeToSession,
  endSession,
  getIlePostSessionPath,
  saveSession,
  pauseSession,
  resumeSession,
  updateSessionStatus,
  getSessionPlan,
  createSessionPlan,
  archiveProbe,
  toggleProbeFocused,
  resetSessionProbes,
  type Session,
  type SessionPlan,
  type SessionPlanStep,
  type Probe,
  type ToolName,
  type ToolAction,
  type RequestType,
} from "@/lib/storage";
import { playArchiveSound, playStepCompleteSound, playSessionCompleteSound } from "@/lib/sounds";
import { formatTime } from "@/lib/utils";
import { SessionHeliosPanel } from "./SessionHeliosPanel";
import { ChapterMapPanel } from "./ChapterMapPanel";
import { createClient } from "@/lib/supabase/client";
import { useSessionThoughtInterface, type SessionThoughtTracePayload } from "@/lib/useSessionThoughtInterface";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import { GrokGrokipediaTool } from "@/components/GrokGrokipediaTool";
import { ResizablePane, type ResizablePaneHandle } from "./ResizablePane";
import { ExcalidrawCanvas } from "./ExcalidrawCanvas";
import { ToolsPanel, type Tool } from "./ToolsPanel";
import { MobileBlockScreen } from "./MobileBlockScreen";
import { type ChatMessage, type PendingChatMessage, type StuckAction } from "./HeliosChat";
import { DataInputTool } from "./DataInputTool";
import { LogsTool, type LogEntry } from "./LogsTool";
import { createScreenCapture } from "@/lib/screen-capture";
import { updateSessionPlan } from "@/lib/storage";
import type { DeviceStatus } from "@/lib/muse-athena";
import { LocalInferenceManager, type InitProgress, type LocalAnalysisContext } from "@/lib/local-inference";
import { LocalContextBuffer } from "@/lib/local-context";
// ModelLoadingModal no longer used -- loading UI is inline in welcome modal

import { WorkspaceResourcesPanel } from "./WorkspaceResourcesPanel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import type { TransferHealth } from "@/components/LogsTool";
import { useVoiceActivity } from "@/lib/useVoiceActivity";
import { useThinkAloudTranscript, type SpeechTranscriptEntry } from "@/lib/useThinkAloudTranscript";
import { useHeliosVoicePlaybackActive } from "@/lib/useHeliosVoicePlayback";
import { IleEvidenceBuffer } from "@/lib/ile-evidence-buffer";
import {
  uploadIleEvidenceItem,
  uploadIleProofOfWork,
  uploadIleScreenshot,
  textToBase64,
} from "@/lib/ile-proof-of-work-client";
import {
  buildIleThoughtTracePayload,
  ILE_TRACE_TOOL_NAME,
  type IleSystem1Action,
  type IleSystem2Action,
} from "@/lib/ile-thought-traces";
import { isChapterSlotAvailable } from "@/lib/chapter-skill-grid";
import { translateWithLocale, useI18n } from "@/lib/i18n";
import { tutoringLocales, tutoringLanguageNames } from "@/lib/tutoring-languages";
import { isSessionWelcomeSeen, markSessionWelcomeSeen } from "@/lib/welcomeState";
import { fetchAestheticPackages, type AestheticPackage } from "@/lib/aesthetics";
import { AestheticPicker } from "./AestheticPicker";


import { DantesTool } from "./DantesTool";

type ChapterWorkspace = {
  chatMessages: ChatMessage[];
  pendingChatMessage: string | PendingChatMessage | null;
  whiteboardData: string | null;
   
  whiteboardSceneData: { elements: any[]; appState: any; files: any } | null;
  notebookContent: string;
  canvasDirtyForHelios: boolean;
  notebookDirtyForHelios: boolean;
};

const createChapterWorkspace = (): ChapterWorkspace => ({
  chatMessages: [],
  pendingChatMessage: null,
  whiteboardData: null,
  whiteboardSceneData: null,
  notebookContent: "",
  canvasDirtyForHelios: true,
  notebookDirtyForHelios: true,
});


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

async function readErrorResponse(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return `${fallback} (HTTP ${response.status})`;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message = parsed.error || parsed.message;
    if (typeof message === "string" && message.trim()) {
      return `${message} (HTTP ${response.status})`;
    }
  } catch {
    // Non-JSON error body; include a short preview for debugging.
  }
  return `${fallback} (HTTP ${response.status}): ${text.slice(0, 300)}`;
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
const CHAPTER_LOAD_DURATION_MS = 900;

function createEmptyTransferHealth(): TransferHealth {
  return {
    audio: { sent: 0, saved: 0, failed: 0 },
    eeg: { sent: 0, saved: 0, failed: 0 },
    facial: { sent: 0, saved: 0, failed: 0 },
    screenshots: { sent: 0, saved: 0, failed: 0 },
    tools: { sent: 0, saved: 0, failed: 0 },
  };
}
const EEG_SAMPLE_RATE_HZ = 256;
const EEG_DISPLAY_MAX_SAMPLES = 512;
const EEG_PERSIST_MAX_SAMPLES = EEG_SAMPLE_RATE_HZ * 30;


export function SessionView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { t, locale, supportedLocales } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutoringLanguage, setTutoringLanguage] = useState(locale);
  // Manual-advance by default: the student clicks Complete on a plan step
  // when they're done. Auto-advance mode is kept wired for future toggling
  // but the UI affordance is hidden (see note at the hidden toggles below).
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Mic check
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  const micStreamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [muteRemaining, setMuteRemaining] = useState(0);

  // Probes
  const [activeProbe, setActiveProbe] = useState<Probe | null>(null);
  const [viewingProbeIndex, setViewingProbeIndex] = useState<number>(-1);

  // Session ending / saving
  const [isSaving, setIsSaving] = useState(false);
  // Tutor-end dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState("");

  // Chapter-scoped workspace. Chat, canvas, notes, and submit-dirty state
  // switch together when the focused chapter changes. This is intentionally
  // browser-local; it is not persisted to the backend.
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const activeChapterIndexRef = useRef(0);
  const planInitializedRef = useRef(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterLoadingIndex, setChapterLoadingIndex] = useState<number | null>(null);
  const chapterFocusSinceRef = useRef<Record<number, number>>({ 0: Date.now() });
  const [chapterWorkspaces, setChapterWorkspaces] = useState<Record<string, ChapterWorkspace>>({});
  const [chapterWorkspacesLoaded, setChapterWorkspacesLoaded] = useState(false);
  useEffect(() => {
    setActiveChapterIndex(0);
    activeChapterIndexRef.current = 0;
    planInitializedRef.current = false;
    chapterFocusSinceRef.current = { 0: Date.now() };
    setChapterWorkspaces({});
    setChapterWorkspacesLoaded(false);
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(`openlesson:${sessionId}:chapter-workspaces`);
      if (stored) setChapterWorkspaces(JSON.parse(stored));
    } catch {
      /* Ignore corrupt local workspace snapshots. */
    } finally {
      setChapterWorkspacesLoaded(true);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!chapterWorkspacesLoaded) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(`openlesson:${sessionId}:chapter-workspaces`, JSON.stringify(chapterWorkspaces));
    } catch {
      /* Session storage can fail on quota, especially with canvas data. */
    }
  }, [chapterWorkspaces, chapterWorkspacesLoaded, sessionId]);

  // New 3-panel layout state
  const [activeTool, setActiveTool] = useState<Tool>("chapters");
  const [userInitial, setUserInitial] = useState("Y");
  const prevToolRef = useRef<Tool | null>(null);
  const resizablePaneRef = useRef<ResizablePaneHandle>(null);
  // Source-of-truth for which of the three workspace views are visible.
  // Kept in sync with the ResizablePane collapsed state via the toggle
  // UI in the top bar. At least one must be true at all times.
  type PaneVis = { tools: boolean; tutor: boolean; plan: boolean };
  const [paneVisibility, setPaneVisibility] = useState<PaneVis>({
    tools: true,
    tutor: true,
    plan: true,
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
    // Left = Tools, right = Helios
    if (!next.tools) {
      resizablePaneRef.current?.setLayout({ collapsedSide: "left" });
    } else if (!next.tutor) {
      resizablePaneRef.current?.setLayout({ collapsedSide: "right" });
    } else {
      resizablePaneRef.current?.setLayout({ collapsedSide: null });
    }
  }, []);
  // Turn a single view on without touching the other two.
  const ensureVisible = useCallback((view: keyof PaneVis) => {
    if (paneVisibility[view]) return;
    applyPaneVisibility({ ...paneVisibility, [view]: true });
  }, [paneVisibility, applyPaneVisibility]);

  const applyIleChapterGridStartup = useCallback(() => {
    prevToolRef.current = null;
    setActiveTool("chapters");
    applyPaneVisibility({ tools: true, tutor: true, plan: true });
  }, [applyPaneVisibility]);

  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);

  // Archive/Focus probe state
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  
  // Plan complete modal (shown when all steps are done)
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);
  // Stop-button confirmation — ending is irreversible so we gate the Stop
  // click through an explicit warning that also nudges users toward the
  // non-destructive "pause + back to dashboard" alternative.


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

  // In-panel onboarding guide (3 slides + Start block). Shown the first time
  // a user lands on a fresh session (no existing probes AND welcome not yet
  // acknowledged). Clicking Start inside the panel fetches the opening probe.
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

  // ILE always opens with the chapter grid tool selected and the tools pane expanded.
  useEffect(() => {
    if (!session?.id || showWelcomeModal) return;
    const id = window.setTimeout(() => {
      applyIleChapterGridStartup();
    }, 100);
    return () => window.clearTimeout(id);
  }, [session?.id, showWelcomeModal, applyIleChapterGridStartup]);

  // Block ILE tools when not actively monitoring. Also allow interaction
  // during the in-panel onboarding guide — the user needs to click Start and
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
  useEffect(() => {
    if (!sessionPlan?.steps?.length || planInitializedRef.current) return;
    planInitializedRef.current = true;
    const idx = Math.min(
      Math.max(0, sessionPlan.currentStepIndex ?? 0),
      sessionPlan.steps.length - 1,
    );
    setActiveChapterIndex(idx);
    activeChapterIndexRef.current = idx;
    chapterFocusSinceRef.current[idx] = Date.now();
  }, [sessionPlan]);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [aestheticPackages, setAestheticPackages] = useState<AestheticPackage[]>([]);
  const [aestheticsLoading, setAestheticsLoading] = useState(true);
  const [selectedAestheticId, setSelectedAestheticId] = useState<string | null>(null);

  const activeStep = sessionPlan?.steps?.[activeChapterIndex];
  const activeChapterKey = activeStep?.id ?? `step-${activeChapterIndex}`;
  const activeWorkspace = chapterWorkspaces[activeChapterKey] ?? createChapterWorkspace();
  const chatMessages = activeWorkspace.chatMessages;
  const pendingChatMessage = activeWorkspace.pendingChatMessage;

  const lastDialogueUserTurn = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "user" && message.content.trim()) {
        return { id: message.id, content: message.content };
      }
    }
    return null;
  }, [chatMessages]);

  const lastDialogueAssistantTurn = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "assistant" && !message.pending && message.content.trim()) {
        return { id: message.id, content: message.content };
      }
    }
    return null;
  }, [chatMessages]);

  const isHeliosAssistantPending = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "assistant" && message.pending) return true;
      if (message.role === "assistant" && !message.pending) break;
    }
    return false;
  }, [chatMessages]);

  const chapterDialoguePrompt = activeStep?.description?.trim() || t("session.chapterPromptFallback");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string | null; user_metadata?: Record<string, unknown> } | null } }) => {
      const user = data.user;
      if (!user) return;
      const name =
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
        user.email?.split("@")[0] ||
        "";
      const initial = name.charAt(0).toUpperCase();
      if (initial) setUserInitial(initial);
    });
  }, []);
  const whiteboardData = activeWorkspace.whiteboardData;
  const whiteboardSceneData = activeWorkspace.whiteboardSceneData;
  const notebookContent = activeWorkspace.notebookContent;
  const canvasDirtyForHelios = activeWorkspace.canvasDirtyForHelios;
  const notebookDirtyForHelios = activeWorkspace.notebookDirtyForHelios;
  const activeChapterLabel = activeStep ? `Chapter ${activeChapterIndex + 1}` : "this chapter";

  const updateChapterWorkspace = useCallback((chapterKey: string, update: Partial<ChapterWorkspace> | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>)) => {
    setChapterWorkspaces(prev => {
      const current = prev[chapterKey] ?? createChapterWorkspace();
      const patch = typeof update === "function" ? update(current) : update;
      return { ...prev, [chapterKey]: { ...current, ...patch } };
    });
  }, []);

  const updateActiveChapterWorkspace = useCallback((update: Partial<ChapterWorkspace> | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>)) => {
    updateChapterWorkspace(activeChapterKey, update);
  }, [activeChapterKey, updateChapterWorkspace]);

  const setChatMessages = useCallback((value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => {
    updateActiveChapterWorkspace(workspace => ({
      chatMessages: typeof value === "function" ? value(workspace.chatMessages) : value,
    }));
  }, [updateActiveChapterWorkspace]);

  const setPendingChatMessage = useCallback((value: string | PendingChatMessage | null) => {
    updateActiveChapterWorkspace({ pendingChatMessage: value });
  }, [updateActiveChapterWorkspace]);

  const setWhiteboardData = useCallback((value: string | null) => {
    updateActiveChapterWorkspace({ whiteboardData: value });
  }, [updateActiveChapterWorkspace]);

  const setNotebookContent = useCallback((value: string) => {
    updateActiveChapterWorkspace({ notebookContent: value });
  }, [updateActiveChapterWorkspace]);

  const setCanvasDirtyForHelios = useCallback((value: boolean) => {
    updateActiveChapterWorkspace({ canvasDirtyForHelios: value });
  }, [updateActiveChapterWorkspace]);

  const setNotebookDirtyForHelios = useCallback((value: boolean) => {
    updateActiveChapterWorkspace({ notebookDirtyForHelios: value });
  }, [updateActiveChapterWorkspace]);

  useEffect(() => {
    if (!sessionPlan?.steps?.length) return;
    if (activeChapterIndex > sessionPlan.steps.length - 1) {
      setActiveChapterIndex(sessionPlan.steps.length - 1);
    }
  }, [activeChapterIndex, sessionPlan?.steps?.length]);

  useEffect(() => {
    let cancelled = false;
    setAestheticsLoading(true);
    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        setAestheticPackages(packages);
        setSelectedAestheticId((current) => current ?? packages[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setAestheticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // (Prep material state used to live here for the now-removed
  // Practice/Theory side panels. That content has been merged into
  // the Helios chat surface — see fetchAndInjectPrepIntoChat below.)

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

  // Step action handlers — Resources (Theory), Practice, Ask Helios.
  const fetchAndInjectPrepIntoChat = async (
    type: "reading" | "exercise",
    stepDescription: string,
    userStub: string,
    fallbackTitle: string,
  ) => {
    if (!session?.problem) return;
    const targetChapterKey = activeChapterKey;
    ensureVisible("tools");
    setActiveTool("notebook");

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: userStub,
    };
    const placeholderId = `${Date.now()}-a`;
    const placeholder: ChatMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      pending: true,
    };

    updateChapterWorkspace(targetChapterKey, workspace => ({
      chatMessages: [...workspace.chatMessages, userMsg, placeholder],
    }));

    try {
      const url =
        `/api/prep-material?topic=${encodeURIComponent(session.problem)}` +
        `&type=${type}` +
        `&step=${encodeURIComponent(stepDescription)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`prep-material ${response.status}`);
      const data = (await response.json()) as { title?: string; content?: string };

      const title = (data.title ?? fallbackTitle).trim();
      const body = (data.content ?? "").trim();
      const content = body ? `${title}\n\n${body}` : title;

      updateChapterWorkspace(targetChapterKey, workspace => ({
        chatMessages: workspace.chatMessages.map(m =>
          m.id === placeholderId
            ? { ...m, content, pending: false }
            : m,
        ),
      }));
    } catch (err) {
      console.error("Prep material → chat error:", err);
      updateChapterWorkspace(targetChapterKey, workspace => ({
        chatMessages: workspace.chatMessages.map(m =>
          m.id === placeholderId
            ? {
                ...m,
                content:
                  type === "exercise"
                    ? "I couldn't pull together a practice set just now. Try again in a moment, or tell me what specifically you'd like to practice."
                    : "I couldn't pull the theory for this step right now. Try again, or ask me a specific question and I'll explain.",
                pending: false,
              }
            : m,
        ),
      }));
    }
  };

  const handleStepResources = (stepDescription: string) => {
    void fetchAndInjectPrepIntoChat(
      "reading",
      stepDescription,
      `Give me the theory for this step: "${stepDescription}"`,
      "Theory",
    );
  };

  const handleStepPractice = (stepDescription: string) => {
    void fetchAndInjectPrepIntoChat(
      "exercise",
      stepDescription,
      `Give me practice tasks for this step: "${stepDescription}"`,
      "Practice",
    );
  };

  const openHeliosChatWithMessage = useCallback((message: string | PendingChatMessage) => {
    const targetChapterKey = activeChapterKey;
    updateChapterWorkspace(targetChapterKey, { pendingChatMessage: message });
  }, [activeChapterKey, updateChapterWorkspace]);

  const submitHeliosChatMessageNow = useCallback(async (message: string, imageDataUrl?: string) => {
    const text = message.trim();
    if (!text || !session) return;

    const chapterKey = activeChapterKey;
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: text,
      imageDataUrl,
    };
    const placeholderId = `${Date.now()}-pending`;
    updateChapterWorkspace(chapterKey, workspace => ({
      chatMessages: [
        ...workspace.chatMessages,
        userMsg,
        { id: placeholderId, role: "assistant", content: "", pending: true },
      ],
    }));

    try {
      const existingMessages = chapterWorkspaces[chapterKey]?.chatMessages ?? [];
      const response = await fetch("/api/session-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: session.problem,
          activeStepIndex: activeChapterIndex,
          activeStepId: activeStep?.id,
          activeStepDescription: activeStep?.description,
          sessionPlan,
          sessionId: session.id,
          tutoringLanguage,
          messages: [...existingMessages, userMsg].map(m => ({ role: m.role, content: m.content, imageDataUrl: m.imageDataUrl })),
        }),
      });
      const data = response.ok ? await response.json() : null;
      const content = typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : t('heliosChat.errorMessage');
      updateChapterWorkspace(chapterKey, workspace => ({
        chatMessages: workspace.chatMessages.map(message =>
          message.id === placeholderId
            ? { ...message, content, pending: false }
            : message
        ),
      }));
    } catch (error) {
      console.error("Helios direct chat error:", error);
      updateChapterWorkspace(chapterKey, workspace => ({
        chatMessages: workspace.chatMessages.map(message =>
          message.id === placeholderId
            ? { ...message, content: t('heliosChat.errorMessage'), pending: false }
            : message
        ),
      }));
    }
  }, [activeChapterIndex, activeChapterKey, activeStep, chapterWorkspaces, session, sessionPlan, t, tutoringLanguage, updateChapterWorkspace]);

  useEffect(() => {
    if (!pendingChatMessage) return;
    const text = typeof pendingChatMessage === "string"
      ? pendingChatMessage
      : pendingChatMessage.text;
    if (!text?.trim()) {
      setPendingChatMessage(null);
      return;
    }
    const imageDataUrl = typeof pendingChatMessage === "string"
      ? undefined
      : pendingChatMessage.imageDataUrl;
    void submitHeliosChatMessageNow(text, imageDataUrl).finally(() => setPendingChatMessage(null));
  }, [pendingChatMessage, setPendingChatMessage, submitHeliosChatMessageNow]);

  const addProbeToHeliosChat = useCallback((text: string) => {
    const content = text.trim();
    if (!content) return;
    const prefix = translateWithLocale(tutoringLanguage, "heliosChat.probeLeadIn");
    const conversationalContent = `${prefix}\n\n${content}`;
    setChatMessages(prev => [
      ...prev,
      {
        id: `probe_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: "assistant",
        content: conversationalContent,
      },
    ]);
  }, []);

  const handleStepAskHelios = (stepDescription: string) => {
    // Make sure the tools pane is visible. The `activeTool` effect only
    // reopens the pane when the value actually changes, so if "chat" was
    // already the active tool before the user closed the tools pane,
    // calling setActiveTool("chat") here is a no-op and wouldn't reopen it.
    openHeliosChatWithMessage(`Help me understand and work through this step: "${stepDescription}"`);
  };

  const handleStuckAction = useCallback((action: StuckAction) => {
    const currentStep =
      sessionPlanRef.current?.steps?.[activeChapterIndexRef.current]?.description
      || sessionRef.current?.problem
      || "this step";

    if (action === "theory") {
      handleStepResources(currentStep);
      return;
    }

    if (action === "practice") {
      handleStepPractice(currentStep);
      return;
    }

    if (action === "canvas") {
      ensureVisible("tools");
      setActiveTool("canvas");
      return;
    }

    if (action === "notebook") {
      ensureVisible("tools");
      setActiveTool("notebook");
      return;
    }

    if (action === "break") {
      if (isRecordingRef.current && !isPaused) {
        setIsPaused(true);
        const currentSession = sessionRef.current;
        if (currentSession) {
          pauseSession(currentSession.id).catch(err => console.error("Failed to pause for stuck break:", err));
        }
      }
      setChatMessages(prev => [...prev, {
        id: `stuck_break_${Date.now()}`,
        role: "assistant",
        content: "Take two minutes away from the problem. When you come back, write the single smallest thing you know for sure, then we will restart from there.",
      }]);
      return;
    }

    openHeliosChatWithMessage(`I'm stuck on this step: "${currentStep}". Help me identify the next small move without giving away the answer.`);
  }, [ensureVisible, handleStepPractice, handleStepResources, isPaused, openHeliosChatWithMessage]);

  // Muse EEG
  const [museStatus, setMuseStatus] = useState<"disconnected" | "connecting" | "connected" | "streaming">("disconnected");
  const [museError, setMuseError] = useState<string | null>(null);
  const [museDeviceStatus, setMuseDeviceStatus] = useState<DeviceStatus | null>(null);
  const [eegChannelData, setEegChannelData] = useState<Map<string, number[]>>(new Map());
  const [bandPowers, setBandPowers] = useState<{ delta: number; theta: number; alpha: number; beta: number; gamma: number } | null>(null);
   
  const museClientRef = useRef<any>(null);
  const eegIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bandIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eegBufferRef = useRef<Map<string, number[]>>(new Map());
  const eegPendingBufferRef = useRef<Map<string, number[]>>(new Map());
  const eegPendingStartMsRef = useRef<number | null>(null);
  const eegLastSampleMsRef = useRef<number | null>(null);
  const museDeviceStatusRef = useRef<DeviceStatus | null>(null);

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
  const sessionRef = useRef<Session | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedSecondsRef = useRef(0);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const consumeSpeechTranscriptEntriesRef = useRef<() => SpeechTranscriptEntry[]>(() => []);
  const requeueSpeechTranscriptEntriesRef = useRef<(entries: SpeechTranscriptEntry[]) => void>(() => {});
  const eegChunkIndexRef = useRef(0);
  const facialChunkIndexRef = useRef(0);
  const ileEvidenceBufferRef = useRef(new IleEvidenceBuffer());
  const [transferHealth, setTransferHealth] = useState<TransferHealth>(createEmptyTransferHealth);
  const transferHealthRef = useRef<TransferHealth>(createEmptyTransferHealth());
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
  useEffect(() => { whiteboardDataRef.current = whiteboardData; }, [whiteboardData]);
  useEffect(() => { notebookContentRef.current = notebookContent; }, [notebookContent]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { localInferenceEnabledRef.current = localInferenceEnabled; }, [localInferenceEnabled]);
  useEffect(() => { museStatusRef.current = museStatus; }, [museStatus]);
  useEffect(() => { museDeviceStatusRef.current = museDeviceStatus; }, [museDeviceStatus]);
  useEffect(() => { isWebcamEnabledRef.current = isWebcamEnabled; }, [isWebcamEnabled]);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);
  useEffect(() => { activeChapterIndexRef.current = activeChapterIndex; }, [activeChapterIndex]);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);

  const handleActiveChapterIndexChange = useCallback((index: number) => {
    const now = Date.now();
    chapterFocusSinceRef.current[index] = now;
    setActiveChapterIndex(index);
    activeChapterIndexRef.current = index;
    const step = sessionPlanRef.current?.steps?.[index];
    void logToolRef.current?.("session_plan", "chapter_focus", {
      stepIndex: index,
      stepId: step?.id,
      stepDescription: step?.description?.slice(0, 120),
    });
  }, []);

  const ensureSessionPlan = useCallback(async (): Promise<SessionPlan | null> => {
    const currentSession = sessionRef.current;
    if (!currentSession) return null;

    const existing = await getSessionPlan(currentSession.id);
    if (existing?.goal) {
      setSessionPlan(existing);
      sessionPlanRef.current = existing;
      return existing;
    }

    const created = await createSessionPlan(currentSession.id, {
      goal: currentSession.problem,
      strategy: "chapter_grid",
      description: currentSession.planningPrompt || undefined,
      steps: [],
    });
    setSessionPlan(created);
    sessionPlanRef.current = created;
    return created;
  }, []);

  const persistPlanSteps = useCallback(async (
    updatedPlan: SessionPlan,
    options?: { toolAction?: ToolAction; toolData?: Record<string, unknown> },
  ) => {
    setSessionPlan(updatedPlan);
    sessionPlanRef.current = updatedPlan;
    try {
      await updateSessionPlan(updatedPlan.id, {
        steps: updatedPlan.steps,
        currentStepIndex: updatedPlan.currentStepIndex,
      });
    } catch (err) {
      console.warn("[SessionView] Failed to sync plan:", err);
    }
    if (options?.toolAction) {
      void logToolRef.current?.("session_plan", options.toolAction, options.toolData ?? {});
    }
  }, []);

  const handleEnsureChapterPositions = useCallback((plan: SessionPlan) => {
    void persistPlanSteps(plan, {
      toolAction: "chapter_position",
      toolData: {
        via: "auto_grid_placement",
        stepCount: plan.steps.length,
      },
    });
  }, [persistPlanSteps]);

  const handleLoadChapter = useCallback((index: number) => {
    if (chapterLoading) return;
    if (index === activeChapterIndex) return;
    const currentPlan = sessionPlanRef.current;
    const step = currentPlan?.steps?.[index];
    if (!currentPlan || !step) return;

    setChapterLoading(true);
    setChapterLoadingIndex(index);
    const startedAt = Date.now();

    const updatedSteps = currentPlan.steps.map((s, i) => {
      if (i === index && s.status === "pending") return { ...s, status: "in_progress" as const };
      return s;
    });
    const updatedPlan = { ...currentPlan, steps: updatedSteps, currentStepIndex: index };
    void persistPlanSteps(updatedPlan);
    handleActiveChapterIndexChange(index);

    const remaining = Math.max(0, CHAPTER_LOAD_DURATION_MS - (Date.now() - startedAt));
    window.setTimeout(() => {
      setChapterLoading(false);
      setChapterLoadingIndex(null);
    }, remaining);

    void logToolRef.current?.("session_plan", "chapter_load", {
      stepIndex: index,
      stepId: step.id,
      stepDescription: step.description?.slice(0, 120),
    });
  }, [activeChapterIndex, chapterLoading, handleActiveChapterIndexChange, persistPlanSteps]);

  const handleAddChapter = useCallback(async (description: string, position: { row: number; col: number }) => {
    const currentPlan = sessionPlanRef.current;
    if (!currentPlan) return;
    const trimmed = description.trim();
    if (!trimmed) return;
    if (!isChapterSlotAvailable(currentPlan, position.row, position.col)) {
      throw new Error("That grid slot is already occupied.");
    }
    const newStep: SessionPlanStep = {
      id: crypto.randomUUID(),
      description: trimmed,
      status: "pending",
      type: "task",
      order: currentPlan.steps.length,
      position_x: position.col,
      position_y: position.row,
    };
    const updatedPlan = {
      ...currentPlan,
      steps: [...currentPlan.steps, newStep],
    };
    await persistPlanSteps(updatedPlan, {
      toolAction: "chapter_add",
      toolData: {
        stepId: newStep.id,
        description: trimmed.slice(0, 120),
        position_x: position.col,
        position_y: position.row,
      },
    });
  }, [persistPlanSteps]);

  const handleUpdateChapter = useCallback(async (stepId: string, description: string) => {
    const currentPlan = sessionPlanRef.current;
    if (!currentPlan) return;
    const trimmed = description.trim();
    if (!trimmed) return;
    const updatedSteps = currentPlan.steps.map((step) =>
      step.id === stepId ? { ...step, description: trimmed } : step,
    );
    const updatedPlan = { ...currentPlan, steps: updatedSteps };
    await persistPlanSteps(updatedPlan, {
      toolAction: "chapter_edit",
      toolData: {
        stepId,
        description: trimmed.slice(0, 120),
      },
    });
  }, [persistPlanSteps]);

  const loadingChapterLabel = chapterLoadingIndex != null
    ? sessionPlan?.steps?.[chapterLoadingIndex]?.description ?? null
    : null;

  useEffect(() => {
    if (!session || !isRecording || isPaused) return;
    const interval = window.setInterval(() => {
      void updateSessionStatus(session.id, "active", elapsedSecondsRef.current * 1000);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [session?.id, isRecording, isPaused]);

  // Listen for probe-revealed custom events (e.g. from legacy probe UI)
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
        setElapsedSeconds(Math.floor((s.durationMs || 0) / 1000));
        
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
          if (existingPlan?.goal) {
            setSessionPlan(existingPlan);
            sessionPlanRef.current = existingPlan;
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

  // ---- Muse EEG ----
  const handleConnectMuse = async () => {
    handleDisconnectMuse();
    setMuseStatus("connecting");
    setMuseError(null);
    try {
      const { MuseAthenaClient } = await import("@/lib/muse-athena");
      const muse = new MuseAthenaClient();

      muse.onStatusChange((status: "disconnected" | "connecting" | "connected" | "streaming") => {
        setMuseStatus(status);
      });

      muse.onDeviceStatus((status: DeviceStatus) => {
        setMuseDeviceStatus(status);
      });

      muse.onDisconnected(() => {
        if (eegIntervalRef.current) { clearInterval(eegIntervalRef.current); eegIntervalRef.current = null; }
        if (bandIntervalRef.current) { clearInterval(bandIntervalRef.current); bandIntervalRef.current = null; }
        museClientRef.current = null;
        setMuseStatus("disconnected");
        setMuseError("Muse disconnected. Reconnect it from the Muse tab.");
      });

      muse.onEEG((sample: { channels: Record<string, number[]> }) => {
        const now = Date.now();
        if (eegPendingStartMsRef.current === null) eegPendingStartMsRef.current = now;
        eegLastSampleMsRef.current = now;

        for (const [channelName, samples] of Object.entries(sample.channels)) {
          const existing = eegBufferRef.current.get(channelName) || [];
          existing.push(...samples);
          if (existing.length > EEG_DISPLAY_MAX_SAMPLES) {
            eegBufferRef.current.set(channelName, existing.slice(-EEG_DISPLAY_MAX_SAMPLES));
          } else {
            eegBufferRef.current.set(channelName, existing);
          }

          const pending = eegPendingBufferRef.current.get(channelName) || [];
          pending.push(...samples);
          if (pending.length > EEG_PERSIST_MAX_SAMPLES) {
            eegPendingBufferRef.current.set(channelName, pending.slice(-EEG_PERSIST_MAX_SAMPLES));
          } else {
            eegPendingBufferRef.current.set(channelName, pending);
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
        if (localInferenceEnabledRef.current && localContextRef.current) {
          localContextRef.current.addEEGData(powers);
        }
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
    eegPendingBufferRef.current.clear();
    eegPendingStartMsRef.current = null;
    eegLastSampleMsRef.current = null;
    setEegChannelData(new Map());
    setBandPowers(null);
    setMuseDeviceStatus(null);
    setMuseStatus("disconnected");
  };

  const addSessionLog = useCallback((entry: Omit<LogEntry, "id">) => {
    const logEntry: LogEntry = { ...entry, id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    logsRef.current.push(logEntry);
    if (logsRef.current.length > 500) {
      logsRef.current = logsRef.current.slice(-400);
    }
    setLogs([...logsRef.current]);
  }, []);

  const recordTransferEvent = useCallback(
    (channel: keyof TransferHealth, saved: boolean, error?: string) => {
      transferHealthRef.current[channel].sent++;
      if (saved) transferHealthRef.current[channel].saved++;
      else transferHealthRef.current[channel].failed++;
      setTransferHealth({ ...transferHealthRef.current });
      if (!saved && error) {
        addSessionLog({
          timestamp: Date.now(),
          level: "warning",
          source: channel,
          message: error,
        });
      }
    },
    [addSessionLog],
  );

  const getWorkspaceId = useCallback(() => {
    const workspaceId = sessionRef.current?.metadata?.workspace_id;
    return typeof workspaceId === "string" && workspaceId ? workspaceId : undefined;
  }, []);

  const stageEvidenceFromRefs = useCallback(() => {
    const buffer = ileEvidenceBufferRef.current;
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    buffer.setCanvasData(whiteboardDataRef.current);
    buffer.setNotebookContent(notebookContentRef.current);

    const transcriptEntries = consumeSpeechTranscriptEntriesRef.current();
    if (transcriptEntries.length > 0) {
      buffer.pushTranscript(transcriptEntries.map((entry) => entry.text).join(" "));
    }

    if (facialBufferRef.current.length > 0) {
      const snapshot = facialBufferRef.current.splice(0);
      buffer.pushFacialPoints(snapshot);
    }

    if (museStatusRef.current === "streaming" && eegPendingBufferRef.current.size > 0) {
      const channels: Record<string, number[]> = {};
      for (const [ch, samples] of eegPendingBufferRef.current.entries()) {
        channels[ch] = samples.slice();
      }
      buffer.pushEegChunk({
        channels,
        bandPowers,
        sampleRateHz: EEG_SAMPLE_RATE_HZ,
        startedAtMs: eegPendingStartMsRef.current ?? Date.now(),
        endedAtMs: eegLastSampleMsRef.current ?? Date.now(),
        sampleCounts: Object.fromEntries(
          Object.entries(channels).map(([ch, samples]) => [ch, samples.length]),
        ),
        deviceStatus: museDeviceStatusRef.current as unknown as Record<string, unknown> | null,
        deviceName: museClientRef.current?.deviceName,
        timestampMs: eegLastSampleMsRef.current ?? Date.now(),
      });
      for (const [ch, savedSamples] of Object.entries(channels)) {
        const current = eegPendingBufferRef.current.get(ch) || [];
        const remaining = current.slice(savedSamples.length);
        if (remaining.length > 0) {
          eegPendingBufferRef.current.set(ch, remaining);
        } else {
          eegPendingBufferRef.current.delete(ch);
        }
      }
      if (eegPendingBufferRef.current.size === 0) {
        eegPendingStartMsRef.current = null;
        eegLastSampleMsRef.current = null;
      }
    }
  }, [bandPowers]);

  const flushIleEvidence = useCallback(
    async (options?: { force?: boolean }) => {
      const workspaceId = getWorkspaceId();
      const currentSession = sessionRef.current;
      if (!workspaceId || !currentSession) return;

      stageEvidenceFromRefs();
      const { uploads, screenshots } = ileEvidenceBufferRef.current.drainForSubmit(
        currentSession.id,
        Date.now(),
        options?.force,
      );

      for (const item of uploads) {
        const channel: keyof TransferHealth =
          item.kind === "eeg" ? "eeg" : item.toolName === "facial" ? "facial" : "tools";
        const result = await uploadIleEvidenceItem(workspaceId, currentSession.id, item);
        recordTransferEvent(channel, result.ok, result.error);
      }

      for (const shot of screenshots) {
        const result = await uploadIleScreenshot(workspaceId, currentSession.id, shot);
        recordTransferEvent("screenshots", result.ok, result.error);
        if (result.ok) setScreenshotCount((c) => c + 1);
      }
    },
    [getWorkspaceId, recordTransferEvent, stageEvidenceFromRefs],
  );

  const uploadIleThoughtTrace = useCallback(
    async (payload: SessionThoughtTracePayload) => {
      const workspaceId = getWorkspaceId();
      const currentSession = sessionRef.current;
      if (!workspaceId || !currentSession) return;

      const tracePayload = buildIleThoughtTracePayload({
        traceType: payload.traceType,
        action: payload.action as IleSystem1Action | IleSystem2Action,
        sessionId: currentSession.id,
        workspaceId,
        thoughtId: payload.thoughtId,
        thoughtIds: payload.thoughtIds,
        chainId: payload.chainId,
        text: payload.text,
        originalText: payload.originalText,
        combined: payload.combined,
        timestampMs: payload.timestampMs,
      });

      const fileName = `ile-trace-${payload.traceType}-${payload.action}-${payload.thoughtId || Date.now()}.json`;
      const result = await uploadIleProofOfWork({
        workspaceId,
        sessionId: currentSession.id,
        type: "tool",
        mime_type: "application/json",
        data: textToBase64(JSON.stringify(tracePayload, null, 2)),
        file_name: fileName,
        timestamp_ms: payload.timestampMs ?? Date.now(),
        tool_name: ILE_TRACE_TOOL_NAME,
        tool_action: `${payload.traceType}:${payload.action}`,
        metadata: {
          trace_type: payload.traceType,
          action: payload.action,
          thought_id: payload.thoughtId ?? null,
          thought_ids: payload.thoughtIds ?? null,
          chain_id: payload.chainId ?? null,
          text: payload.text ?? null,
          original_text: payload.originalText ?? null,
          combined: payload.combined ?? false,
        },
      });
      recordTransferEvent("tools", result.ok, result.error);
    },
    [getWorkspaceId, recordTransferEvent],
  );

  const logToolRef = useRef<
    ((toolName: ToolName, action: ToolAction, metadata?: Record<string, unknown>) => Promise<void>) | null
  >(null);

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

      ileEvidenceBufferRef.current.pushToolEvent({
        toolName,
        action,
        timestampMs: now,
        metadata,
      });

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

      addSessionLog({
        timestamp: now,
        level: "info",
        source: "tool",
        message: `${toolName}/${action} @${Math.round(elapsedMs / 1000)}s${metaStr}`,
      });
    },
    [addSessionLog],
  );

  useEffect(() => {
    logToolRef.current = logTool;
  }, [logTool]);

  const logSessionThoughtTrace = useCallback(
    (payload: SessionThoughtTracePayload) => {
      void uploadIleThoughtTrace(payload);
    },
    [uploadIleThoughtTrace],
  );

  const sessionSpeechLang =
    ({ en: "en-US", es: "es-ES", de: "de-DE", pl: "pl-PL", vi: "vi-VN", zh: "zh-CN" } as Record<string, string>)[
      tutoringLanguage
    ] || "en-US";

  const sessionThoughtInterface = useSessionThoughtInterface({
    enabled: isRecording && !isPaused && !showWelcomePanel,
    speechLang: sessionSpeechLang,
    sessionId: session?.id,
    onLogTrace: logSessionThoughtTrace,
    onSendToProbe: async (text) => {
      await flushIleEvidence();
      await submitHeliosChatMessageNow(text);
    },
  });

  const sessionThoughtHistory = useMemo(
    () => sessionThoughtInterface.thoughts.slice().reverse(),
    [sessionThoughtInterface.thoughts],
  );

  const handleSubmitToHelios = useCallback(
    async (toolName: "canvas" | "notebook", canvasDataUrl?: string | null) => {
      const targetChapterKey = activeChapterKey;
      const targetWorkspace = chapterWorkspaces[targetChapterKey] ?? activeWorkspace;
      const targetNotebookContent = targetWorkspace.notebookContent;
      const targetCanvasData = canvasDataUrl || targetWorkspace.whiteboardData || null;
      if (toolName === "canvas" && canvasDataUrl) {
        whiteboardDataRef.current = canvasDataUrl;
        updateChapterWorkspace(targetChapterKey, { whiteboardData: canvasDataUrl });
      } else if (toolName === "canvas") {
        whiteboardDataRef.current = targetCanvasData;
      } else {
        notebookContentRef.current = targetNotebookContent;
      }
      const metadata: Record<string, unknown> = {};
      if (toolName === "notebook") {
        metadata.contentLength = targetNotebookContent.length;
      } else {
        metadata.hasCanvas = !!targetCanvasData;
      }
      void logTool(toolName, "submit_to_helios", metadata);

      try {
        await flushIleEvidence();
      } catch (err) {
        console.warn("[SubmitToHelios] evidence flush failed:", err);
      }

      if (toolName === "canvas") {
        updateChapterWorkspace(targetChapterKey, { canvasDirtyForHelios: false });
        const imageDataUrl = targetCanvasData || undefined;
        void submitHeliosChatMessageNow(
          "Here is my current canvas. Help me reason through what I have drawn without just giving me the answer.",
          imageDataUrl,
        );
      } else {
        updateChapterWorkspace(targetChapterKey, { notebookDirtyForHelios: false });
        const content = targetNotebookContent.trim();
        if (content) {
          void submitHeliosChatMessageNow(
            `Here are my notebook notes. Help me reason through them without just giving me the answer:\n\n${content}`,
          );
        }
      }
    },
    [activeChapterKey, activeWorkspace, chapterWorkspaces, logTool, flushIleEvidence, submitHeliosChatMessageNow, updateChapterWorkspace],
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

      // Request mic for browser speech recognition (transcripts only — no audio storage).
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
        micStreamRef.current = null;
        setStream(mediaStream);
      } catch (micErr) {
        console.warn("[SessionView] Mic unavailable, starting session without live speech:", micErr);
        setError(t('session.micNotFound'));
        mediaStream = null;
        micStreamRef.current = null;
        setStream(null);
      }

      // Always start the session regardless of mic availability
      setIsRecording(true);
      setIsPaused(false);

      // Sync DB status to active
      if (session) {
        updateSessionStatus(session.id, "active").catch(() => {});
      }

      const startTime = Date.now() - (elapsedSeconds * 1000);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

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

    await flushIleEvidence({ force: true });

    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setIsRecording(false);
    setIsSaving(true);
    if (!session) return;

    const finalSession = endSession(session, elapsedSeconds * 1000);
    finalSession.hasAudio = false;
    finalSession.metadata = {
      ...finalSession.metadata,
      whiteboardData: whiteboardData || undefined,
      notebookData: notebookContent || undefined,
    };

    // Persist to Supabase
    await saveSession(finalSession);

    handleDisconnectMuse();

    // Navigate after all data is saved — scoring lives on workspace Performance tab
    router.push(getIlePostSessionPath(finalSession));
  };

  // ---- Screenshot Handlers ----
  const handleStartScreenCapture = useCallback(async () => {
    if (!screenCaptureRef.current) {
      screenCaptureRef.current = createScreenCapture({
        onScreenshotCaptured: async (blob: Blob, timestamp: number) => {
          ileEvidenceBufferRef.current.pushScreenshot({ blob, timestampMs: timestamp });
        },
        intervalMs: 5000,
        onStatusChange: (capturing: boolean) => {
          setIsScreenCapturing(capturing);
        },
      });
    }
    await screenCaptureRef.current.start();
  }, []);

  const handleStopScreenCapture = useCallback(() => {
    screenCaptureRef.current?.stop();
  }, []);

  const handlePause = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Track what was active before pause (for auto-resume)
    wasRecordingRef.current = isRecordingRef.current;
    wasScreenCapturingRef.current = isScreenCapturing;
    wasWebcamEnabledRef.current = isWebcamEnabled;
    wasMuseStreamingRef.current = museStatus === "streaming";

    // Store stream references for potential resume
    pausedAudioStreamRef.current = stream;
    pausedScreenStreamRef.current = screenCaptureRef.current?.getStream() || null;
    pausedWebcamStreamRef.current = null;

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
      const durationMs = elapsedSeconds * 1000;
      const pausedSession = { ...session, durationMs, status: "paused" as const };
      setSession(pausedSession);
      sessionRef.current = pausedSession;
      await pauseSession(session.id, durationMs);
    }
  };

  const handleResume = async () => {
    if (!session) return;

    try {
      // Resume mic stream for speech recognition (no audio storage).
      try {
        let mediaStream = pausedAudioStreamRef.current;
        const tracksStillActive = mediaStream?.getTracks().some(t => t.readyState === "live");
        if (!mediaStream || !tracksStillActive) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 48000,
            },
          });
        }
        setStream(mediaStream);
      } catch (micErr) {
        console.warn("[SessionView] Mic unavailable on resume, continuing without live speech:", micErr);
        setError(t('session.micNotFound'));
        setStream(null);
      }

      setIsRecording(true);
      setIsPaused(false);

      await resumeSession(session.id);
      const activeSession = { ...session, status: "active" as const };
      setSession(activeSession);
      sessionRef.current = activeSession;

      const startTime = Date.now() - (elapsedSeconds * 1000);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

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

  // Real-time voice activity for Helios background tile-reveal + action
  // box highlight. Shares the same mic stream as inactivity detection.
  const isSpeaking = useVoiceActivity({
    stream,
    isRecording,
    isPaused,
  });
  const isHeliosVoicePlaying = useHeliosVoicePlaybackActive();

  const thinkAloudTranscript = useThinkAloudTranscript({
    enabled: false,
    tutoringLanguage,
  });
  consumeSpeechTranscriptEntriesRef.current = thinkAloudTranscript.consumePendingTranscriptEntries;
  requeueSpeechTranscriptEntriesRef.current = thinkAloudTranscript.requeueTranscriptEntries;

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
      
    } catch (err) {
      console.error("Reset session error:", err);
    }
  };

  // Close session - return to workspace without ending
  const pauseAndGoToDashboard = useCallback(async () => {
    if (session && isRecording && !isPaused) {
      await handlePause();
    } else if (session && isPaused) {
      await pauseSession(session.id, elapsedSeconds * 1000);
    }
    const current = sessionRef.current ?? session;
    router.push(current ? getIlePostSessionPath(current) : "/dashboard");
  }, [session, isRecording, isPaused, elapsedSeconds, handlePause, router]);

  const handleClose = () => {
    void pauseAndGoToDashboard();
  };

  /**
   * The user clicked the Play button inside the tutor welcome panel. Mark the
   * welcome as "seen" so a page refresh doesn't re-play the welcome.
   */
  const handleWelcomePlay = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    setIsStartingSession(true);
    let didRevealChat = false;
    const revealChat = () => {
      if (didRevealChat) return;
      didRevealChat = true;
      setShowWelcomePanel(false);
      applyIleChapterGridStartup();
    };
    try {
      // Bring the session back to an actively-recording state. Three cases:
      //   1. Fresh session: `!isRecording` → startRecording (first mic req).
      //   2. Paused session (e.g. Help was just clicked): `isPaused` →
      //      handleResume restarts the recorder/streams.
      //   3. Already active: no-op.
      if (!isRecording) {
        await startRecording();
      } else if (isPaused) {
        await handleResume();
      }
      revealChat();
    } finally {
      markSessionWelcomeSeen(s.id);
      revealChat();
      setIsStartingSession(false);
      // If the welcome was opened via the Help button, restore the
      // user's previous pane layout so tools/plan don't stay hidden.
      const prev = helpPreviousLayoutRef.current;
      if (prev) {
        helpPreviousLayoutRef.current = null;
        // Give the welcome-panel collapse effect a beat to finish before
        // we overwrite it, otherwise its 80ms timer races us.
        window.setTimeout(() => {
          resizablePaneRef.current?.setLayout(prev.inner);
          const innerLeft = prev.inner.collapsedSide === "left";
          const innerRight = prev.inner.collapsedSide === "right";
          setPaneVisibility({
            tools: !innerLeft,
            // Helios (tutor) pane is always visible — it cannot be hidden.
            tutor: true,
            plan: !innerRight,
          });
        }, 120);
      }
    }
    // startRecording / handleResume are defined inline and reference many
    // setters/refs; including them as deps would cause noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isPaused]);

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

  const handleMarkChapterDone = useCallback(async () => {
    const currentPlan = sessionPlanRef.current;
    if (!currentPlan?.steps?.length) return;

    const idx = activeChapterIndexRef.current;
    const step = currentPlan.steps[idx];
    if (!step || step.status === "completed" || step.status === "skipped") return;

    const updatedSteps = currentPlan.steps.map((s, i) =>
      i === idx ? { ...s, status: "completed" as const } : s,
    );
    const updatedPlan = {
      ...currentPlan,
      steps: updatedSteps,
      currentStepIndex: idx,
    };

    await persistPlanSteps(updatedPlan, {
      toolAction: "chapter_done",
      toolData: {
        stepIndex: idx,
        stepId: step.id,
        stepDescription: step.description?.slice(0, 120),
        via: "chapter_map_mark_done",
      },
    });

    playStepCompleteSound();

    if (updatedSteps.every((s) => s.status === "completed" || s.status === "skipped")) {
      playSessionCompleteSound();
      setTimeout(() => {
        setShowPlanCompleteModal(true);
        if (isRecording && !isPaused) setIsPaused(true);
      }, 1500);
    }
  }, [isPaused, isRecording, persistPlanSteps]);

  // Auto-pause on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (isRecording && session) {
        e.preventDefault();
        await pauseSession(session.id, elapsedSecondsRef.current * 1000);
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

      if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      handleDisconnectMuse();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile) {
    return <MobileBlockScreen />;
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

  const selectedAesthetic = aestheticPackages.find((pkg) => pkg.id === selectedAestheticId) ?? aestheticPackages[0];

  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="border-b border-neutral-800/70 px-6 pt-6 pb-5">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-neutral-800 bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900">
                    <span className="font-serif text-lg text-neutral-200">H</span>
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.08)]" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-base font-semibold leading-tight text-white">{t('session.welcomeTitle')}</h2>
                  <p className="mt-0.5 text-[12px] leading-tight text-neutral-500">{t('session.welcomeMessage')}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
            {(() => {
              const isSessionReady = sessionPlan && !planLoading;

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

                    <AestheticPicker
                      packages={aestheticPackages}
                      selectedId={selectedAesthetic?.id ?? selectedAestheticId}
                      onSelect={setSelectedAestheticId}
                      disabled={isButtonDisabled}
                      loading={aestheticsLoading}
                    />

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
                          
                          const newPlan = await ensureSessionPlan();
                          if (!newPlan) {
                            setPlanError("Failed to prepare chapter map. Please try again.");
                          }
                          
                          // Archive existing probes; the chapter question is
                          // enough to start the discussion.
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
                          // typed tutor welcome + Play button.
                          const isFreshSession = !isSessionWelcomeSeen(session.id);
                          if (isFreshSession) {
                            setShowWelcomePanel(true);
                          }
                          
                          // Plan prep done
                          setPlanLoading(false);
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
                          setPlanError("Failed to prepare block");
                        } finally {
                          setPlanLoading(false);
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
                // "help" is a command, not a view: it pauses the session,
                // opens the chapter grid, and re-opens the 3-step onboarding
                // guide in the Helios panel. Probes and session data are
                // preserved — clicking Start from the welcome resumes recording.
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
                    const layout = readLayout("session-split-tools-helios");
                    helpPreviousLayoutRef.current = {
                      outer: layout,
                      inner: layout,
                    };
                  }
                  if (isRecording && !isPaused) {
                    handlePause().catch(err =>
                      console.error("[SessionView] Help pause failed:", err),
                    );
                  }
                  applyIleChapterGridStartup();
                  setShowWelcomePanel(true);
                  setWelcomeOpenNonce(n => n + 1);
                  return;
                }
                setActiveTool(tool);
              }} 
              problem={session.problem} 
              workspaceId={session.metadata?.workspace_id as string | undefined}
              disabledTools={[]}
              onBackToDashboard={pauseAndGoToDashboard}
              isRecording={isRecording}
              isPaused={isPaused}
              isWebcamEnabled={isWebcamEnabled}
              museStatus={museStatus}
              museDeviceStatus={museDeviceStatus}
              museChannelData={eegChannelData}
            />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Error banner */}
        {error && !showWelcomeModal && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400 text-xs">✕</button>
          </div>
        )}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Tools | Helios */}
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <ResizablePane
              ref={resizablePaneRef}
              defaultLeftWidth={40}
              leftLabel={t('session.tools')}
              rightLabel={t('session.studentMonitoring')}
              storageKey="session-split-tools-helios"
              left={
                <div className="flex flex-col min-w-0 p-4 overflow-hidden h-full relative">
                  {shouldBlockTools && !["data-input", "help", "logs", "chapters"].includes(activeTool) && (
                    <div className="absolute inset-0 z-10 bg-black/30 cursor-not-allowed" />
                  )}
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    {activeTool === "chapters" && (
                      <div className="h-full overflow-hidden rounded-lg border border-neutral-800">
                        <ChapterMapPanel
                          plan={sessionPlan}
                          sessionId={session.id}
                          loading={planLoading}
                          activeChapterIndex={activeChapterIndex}
                          loadingChapterIndex={chapterLoadingIndex}
                          onLoadChapter={handleLoadChapter}
                          onChapterDone={() => {
                            void handleMarkChapterDone();
                          }}
                          onAddChapter={handleAddChapter}
                          onUpdateChapter={handleUpdateChapter}
                          onEnsurePositions={handleEnsureChapterPositions}
                          isSessionActive={isRecording}
                          isCurrentStepCompleted={activeStep?.status === "completed" || activeStep?.status === "skipped"}

                        />
                      </div>
                    )}
                    <div className={activeTool === "canvas" ? "h-full" : "hidden"}>
                      <ExcalidrawCanvas
                        key={activeChapterKey}
                        initialData={whiteboardData || undefined}
                        initialSceneData={whiteboardSceneData}
                        onCanvasChange={(data) => {
                          setWhiteboardData(data);
                          // Any canvas change re-arms the submit button.
                          setCanvasDirtyForHelios(true);
                          if (sessionRef.current) {
                            sessionRef.current = { ...sessionRef.current, metadata: { ...sessionRef.current.metadata, whiteboardData: data } };
                          }
                        }}
                        onSceneChange={(data) => updateActiveChapterWorkspace({ whiteboardSceneData: data })}
                        onSubmitToHelios={(dataUrl) => handleSubmitToHelios("canvas", dataUrl)}
                        canSubmitToHelios={canvasDirtyForHelios}
                        chapterLabel={activeChapterLabel}
                      />
                    </div>
                    {activeTool === "notebook" && (
                      <div className="h-full rounded-lg border border-neutral-800 bg-neutral-900/50 flex flex-col">
                        <div className="shrink-0 px-3 py-2 border-b border-neutral-800 flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-[11px] text-neutral-500">Notes for {activeChapterLabel}</span>
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
                        </div>
                      </div>
                    )}

                    {activeTool === "thought-history" && (
                      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
                        <ThoughtMemoryPanel
                          className="flex h-full min-h-0 max-h-full flex-col overflow-hidden px-1"
                          listClassName="pr-2"
                          thoughts={sessionThoughtHistory}
                          workspaceId={session.metadata?.workspace_id ?? undefined}
                          sessionId={session.id}
                        />
                      </div>
                    )}

                    {activeTool === "dantes" && (
                      <DantesTool
                        problem={session.problem}
                        activeStepDescription={activeStep?.description}
                      />
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
                        museDeviceStatus={museDeviceStatus}
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
                        transferHealth={transferHealth}
                        onClear={() => {
                          logsRef.current = [];
                          setLogs([]);
                        }}
                      />
                    )}
                    </div>
                    {activeTool === "plan-resources" && session?.metadata?.workspace_id && !isMobile && (
                      <div className="h-full overflow-hidden">
                        <WorkspaceResourcesPanel workspaceId={session.metadata.workspace_id as string} />
                      </div>
                    )}
                    {/* Grokipedia search shortcut. Practice/Theory used to
                        share this render block when they had their own
                        panels — they've since been merged into the
                        Helios chat surface, so this block is now
                        Grokipedia-only. */}
                    {activeTool === "grokipedia" && (
                      <GrokGrokipediaTool
                        sessionProblem={session?.problem}
                        activeStepDescription={activeStep?.description}
                        activeProbes={session?.probes?.filter((probe) => !probe.archived).map((probe) => ({ text: probe.text }))}
                      />
                    )}
                  </div>
                </div>
              }
              right={
                    <div className="relative h-full">
                      <SessionHeliosPanel
                        lastUserTurn={lastDialogueUserTurn}
                        lastAssistantTurn={lastDialogueAssistantTurn}
                        isAssistantPending={isHeliosAssistantPending}
                        chapterPrompt={chapterDialoguePrompt}
                        userInitial={userInitial}
                        isSessionActive={isRecording && !isPaused}
                        isInitializing={planLoading}
                        isChapterLoading={chapterLoading}
                        loadingChapterLabel={loadingChapterLabel}
                        hasPlanSteps={(sessionPlan?.steps?.length ?? 0) > 0}

                        showWelcome={showWelcomePanel}
                        onWelcomePlay={handleWelcomePlay}
                        isStartingSession={isStartingSession}
                        welcomeResetKey={welcomeOpenNonce}
                        sessionId={session.id}
                        ttsLanguage={tutoringLanguage}
                        aestheticImages={selectedAesthetic?.images}
                        aestheticName={selectedAesthetic?.name}
                        thought={sessionThoughtInterface}
                      />
                    </div>
              }
            />
          </div>



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
        confirmLabel={t('sessionEnd.returnToWorkspace')}
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
