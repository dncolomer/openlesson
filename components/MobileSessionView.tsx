"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { SwipeableTabs } from "./SwipeableTabs";
import { MobileProbesTab } from "./MobileProbesTab";
import { MobilePlanTab } from "./MobilePlanTab";
import { MobileExcalidrawCanvas } from "./MobileExcalidrawCanvas";
import { AudioRecorder } from "@/lib/audio";
import { 
  type Probe, 
  type SessionPlan, 
  type Session,
  getSession,
  getSessionPlan,
  updateSessionPlan,
  saveAudioChunk,
  archiveProbe,
  toggleProbeFocused,
  logToolUsage,
  addProbe,
  addProbeToSession,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  saveSession,
  saveWithDedupString,
} from "@/lib/storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { isSessionWelcomeSeen, markSessionWelcomeSeen } from "@/lib/welcomeState";
import { playStepCompleteSound, playSessionCompleteSound } from "@/lib/sounds";
import { LocalInferenceManager, type InitProgress, type LocalAnalysisContext } from "@/lib/local-inference";
import { LocalContextBuffer } from "@/lib/local-context";
import { useSessionHeartbeat, type StorageHeartbeatResult, type AnalysisHeartbeatResult } from "@/lib/useSessionHeartbeat";
import { useInactivityAutoPause } from "@/lib/useInactivityAutoPause";
import { retryWithResult } from "@/lib/retry";
import { ConfirmDialog } from "./ui/ConfirmDialog";
// ModelLoadingModal no longer used -- loading UI is inline in welcome modal
import type { RequestType } from "@/lib/storage";

// Check if a new probe is a duplicate of any existing probe (normalized comparison)
function isDuplicateProbe(newText: string, existingProbes: { text: string; archived?: boolean }[]): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newNorm = normalize(newText);
  return existingProbes.some(p => {
    const existingNorm = normalize(p.text);
    if (newNorm === existingNorm) return true;
    if (newNorm.length > 20 && existingNorm.length > 20) {
      if (newNorm.includes(existingNorm) || existingNorm.includes(newNorm)) return true;
    }
    return false;
  });
}

interface MobileSessionViewProps {
  sessionId: string;
  initialSession?: Session | null;
  initialPlan?: SessionPlan | null;
}

import { tutoringLocales, tutoringLanguageNames, type TutoringLocale } from "@/lib/tutoring-languages";
const supportedLocales = tutoringLocales;
type SupportedLocale = TutoringLocale;
const languageNames = tutoringLanguageNames;

const tabIcons = [
  (
    <svg key="probes" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  (
    <svg key="plan" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  (
    <svg key="canvas" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
];

export function MobileSessionView({ 
  sessionId,
  initialSession,
  initialPlan,
}: MobileSessionViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  
  // Session state
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(initialPlan ?? null);
  const [probes, setProbes] = useState<Probe[]>(initialSession?.probes ?? []);
  
  // Preparation modal state
  // Active sessions that already have tutoringLanguage: skip modal
  // Paused sessions: always show modal to allow resume
  const [showWelcomeModal, setShowWelcomeModal] = useState(
    initialSession 
      ? initialSession.status === "paused" 
        ? true 
        : initialSession.status === "active" && initialSession.metadata?.tutoringLanguage 
          ? false 
          : true
      : true
  );
  const [languageConfirmed, setLanguageConfirmed] = useState(
    initialSession?.metadata?.tutoringLanguage && initialSession?.status !== "paused" ? true : false
  );
  const [tutoringLanguage, setTutoringLanguage] = useState<SupportedLocale>(
    (initialSession?.metadata?.tutoringLanguage as SupportedLocale) || 'en'
  );
  // Manual-advance by default: the student clicks Complete on a plan step
  // when they're done. Auto-advance mode is kept wired for future toggling
  // but the UI affordance is hidden (see note at the hidden toggles below).
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [openingProbeLoading, setOpeningProbeLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  
  // Recording state - initialize from session status if provided
  const [isRecording, setIsRecording] = useState(
    initialSession ? initialSession.status === "active" || initialSession.status === "paused" : false
  );
  const [isPaused, setIsPaused] = useState(
    initialSession ? initialSession.status === "paused" : false
  );
  const [autoPausedForInactivity, setAutoPausedForInactivity] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(
    initialSession?.durationMs ? Math.floor(initialSession.durationMs / 1000) : 0
  );
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);

  // In-panel tutor welcome (typed intro + Play button). Mirrors desktop.
  // Initialized from whether this session is "fresh" — no active probes AND
  // the welcome has never been acknowledged. This handles the case where
  // the settings modal is skipped entirely (active session, language set)
  // so we still greet new users.
  const [showWelcomePanel, setShowWelcomePanel] = useState(() => {
    if (!initialSession) return false;
    if (typeof window === "undefined") return false;
    const hasActive = (initialSession.probes ?? []).some(p => !p.archived);
    if (hasActive) return false;
    return !isSessionWelcomeSeen(initialSession.id);
  });
  const [isStartingSession, setIsStartingSession] = useState(false);

  // When the in-panel welcome opens, force the probes tab so the user sees
  // the tutor greeting immediately.
  useEffect(() => {
    if (showWelcomePanel) setActiveTab(0);
  }, [showWelcomePanel]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialSession);
  const [whiteboardData, setWhiteboardData] = useState<string | null>(null);
  // "Submit to Helios" dirty tracking — true when the user has edited the
  // canvas since the last submit. Initial true so the first submit is
  // allowed (provided there's canvas content). Lives in parent so it
  // survives remounts of the mobile whiteboard tab.
  const [canvasDirtyForHelios, setCanvasDirtyForHelios] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);

  // Local inference
  const [localInferenceEnabled, setLocalInferenceEnabled] = useState(false);
  const localInferenceEnabledRef = useRef(false);
  const localContextRef = useRef<LocalContextBuffer | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<InitProgress | null>(null);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [webGPUAvailable, setWebGPUAvailable] = useState(false);
  const [isGeneratingProbe, setIsGeneratingProbe] = useState(false);
  const [prepStage, setPrepStage] = useState<"plan" | "model" | "done">("plan");

  useEffect(() => { setWebGPUAvailable(LocalInferenceManager.isWebGPUAvailable()); }, []);
  useEffect(() => { localInferenceEnabledRef.current = localInferenceEnabled; }, [localInferenceEnabled]);

  // Camera state
  const [cameraMode, setCameraMode] = useState<'closed' | 'open' | 'preview'>('closed');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [pendingWhiteboardImage, setPendingWhiteboardImage] = useState<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerBaseRef = useRef<number>(0);
  const chunkIndexRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const whiteboardDataRef = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(session);
  const sessionPlanRef = useRef<SessionPlan | null>(sessionPlan);
  const lastProbeTimeRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);

  // Sync refs
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);

  // Load session data if not provided
  useEffect(() => {
    if (initialSession) return;
    
    const loadSession = async () => {
      try {
        const [sessionData, planData] = await Promise.all([
          getSession(sessionId),
          getSessionPlan(sessionId),
        ]);
        
        if (sessionData) {
          setSession(sessionData);
          setProbes(sessionData.probes);
          // Sync recording state with session status
          setIsRecording(sessionData.status === "active" || sessionData.status === "paused");
          setIsPaused(sessionData.status === "paused");
          // Sync elapsed time from session duration
          setElapsedSeconds(sessionData.durationMs ? Math.floor(sessionData.durationMs / 1000) : 0);
          // Paused sessions: show modal to resume. Active sessions with language: skip modal.
          if (sessionData.status === "active" && sessionData.metadata?.tutoringLanguage) {
            setShowWelcomeModal(false);
          }
          // Otherwise keep showWelcomeModal true (default) to show the modal
          if (sessionData.metadata?.tutoringLanguage) {
            setLanguageConfirmed(true);
            setTutoringLanguage(sessionData.metadata.tutoringLanguage as SupportedLocale);
          }
        }
        if (planData) {
          setSessionPlan(planData);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("Failed to load session data");
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, initialSession]);

  // Request wake lock when recording
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isRecording && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch (err) {
          console.warn("[MobileSession] Wake lock failed:", err);
        }
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    if (isRecording) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => releaseWakeLock();
  }, [isRecording]);

  // Auto-pause session on tab close/navigate away
  useEffect(() => {
    const handler = () => {
      if (sessionRef.current && isRecording && !isPaused) {
        pauseSession(sessionRef.current.id);
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRecording, isPaused]);

  // Attach camera stream to video element when camera opens
  useEffect(() => {
    if (cameraMode === 'open' && cameraStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      videoRef.current.play().catch(err => {
        console.error("[Camera] Failed to play video:", err);
      });
    }
  }, [cameraMode]);

  // Start/stop timer based on recording state (and paused state)
  useEffect(() => {
    if (isRecording && !isPaused && !timerRef.current) {
      const baseMs = timerBaseRef.current || (session?.durationMs ?? Date.now());
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - baseMs) / 1000));
      }, 1000);
      
      setMicStatus("ready");
    }
    
    if ((!isRecording || isPaused) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isRecording, isPaused, session?.durationMs, session?.id]);

  // Sync durationMs to elapsedSeconds when loading a paused session
  useEffect(() => {
    if (session?.durationMs) {
      setElapsedSeconds(Math.floor(session.durationMs / 1000));
    }
  }, [session?.durationMs]);

  // Helper to validate plan data
  const isValidPlan = (plan: SessionPlan | null | undefined): boolean => {
    return !!(plan && plan.steps && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.goal);
  };

  // Storage heartbeat - saves audio & whiteboard (every 5s)
  const runStorageHeartbeat = useCallback(async (): Promise<StorageHeartbeatResult> => {
    const currentSession = sessionRef.current;
    if (!currentSession) return {};

    const result: StorageHeartbeatResult = {};

    try {
      if (recorderRef.current) {
        const audio = recorderRef.current.getRecentAudio(5000);
        if (audio && audio.size > 100) {
          result.audio = { attempted: true, saved: false };
          const idx = chunkIndexRef.current++;
          const saveResult = await retryWithResult(
            () => saveAudioChunk(currentSession.id, audio, idx, Date.now()),
            { maxRetries: 2, baseDelayMs: 500 },
          );
          result.audio.saved = saveResult.success && !!saveResult.data;
        }
      }

      // Transcribe any pending audio chunks (decoupled from analysis)
      try {
        await fetch("/api/transcribe-chunks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSession.id }),
        });
      } catch (err) {
        console.warn("[Mobile] Background transcription error:", err);
      }

      if (whiteboardDataRef.current) {
        const dataStr = whiteboardDataRef.current;
        const whiteboardKey = `canvas_${currentSession.id}`;
        const whiteboardResult = await saveWithDedupString(dataStr, whiteboardKey);
        if (whiteboardResult.saved) {
          await logToolUsage(currentSession.id, 'canvas', 'canvas_draw', Date.now(), { data: dataStr });
        }
      }

      return result;
    } catch (err) {
      console.warn("[Mobile] Storage heartbeat error:", err);
      return { error: String(err) };
    }
  }, []);

  // Hard minimum cooldown between probes (ms) to prevent rapid slot filling
  const PROBE_COOLDOWN_MS = 30_000;

  // ---- Local Analysis Heartbeat (runs Gemma 4 E2B in-browser) ----
  const runLocalAnalysisHeartbeat = useCallback(async () => {
    const currentSession = sessionRef.current;
    const currentPlan = sessionPlanRef.current;
    const recorder = recorderRef.current;
    const manager = LocalInferenceManager.getInstance();

    if (!currentSession || !currentPlan || !manager.isReady()) return;
    if (isAnalyzingRef.current) return;

    isAnalyzingRef.current = true;

    try {
      if (!localContextRef.current) {
        localContextRef.current = new LocalContextBuffer();
      }
      const ctx = localContextRef.current;

      // Transcribe recent audio locally
      if (recorder) {
        try {
          const recentAudio = recorder.getRecentAudio(10000);
          if (recentAudio && recentAudio.size > 100) {
            const transcript = await manager.transcribe(recentAudio);
            if (transcript) ctx.addTranscript(transcript);
          }
        } catch (err) {
          console.warn("[Mobile][LocalInference] Transcription error:", err);
        }
      }

      // Generate probe locally
      const openProbes = currentSession.probes.filter((p: Probe) => !p.archived);
      if (openProbes.length >= 5) return;

      // Hard cooldown: don't generate probes too rapidly
      const timeSinceLastLocal = Date.now() - (lastProbeTimeRef.current || 0);
      if (lastProbeTimeRef.current !== 0 && timeSinceLastLocal < PROBE_COOLDOWN_MS) return;

      const currentStep = currentPlan.steps?.[currentPlan.currentStepIndex];
      const snapshot = ctx.getContext();

      const analysisContext: LocalAnalysisContext = {
        planGoal: currentPlan.goal || "",
        currentStep: currentStep?.description || "",
        recentTranscripts: snapshot.recentTranscripts,
        toolEvents: snapshot.toolEvents,
        facialSummary: snapshot.facialSummary,
        eegSummary: snapshot.eegSummary,
        previousProbes: currentSession.probes.map((p: Probe) => p.text),
        tutoringLanguage: tutoringLanguage,
      };

      setIsGeneratingProbe(true);
      const probeText = await manager.generateProbe(analysisContext);
      setIsGeneratingProbe(false);

      if (probeText && probeText.trim().length > 5 && !isDuplicateProbe(probeText, currentSession.probes)) {
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
        setProbes(updatedSession.probes);
        lastProbeTimeRef.current = Date.now();
      }
    } catch (err) {
      console.error("[Mobile][LocalInference] Analysis error:", err);
    } finally {
      isAnalyzingRef.current = false;
      setIsGeneratingProbe(false);
    }
  }, [tutoringLanguage]);

  // Analysis heartbeat - analyze, create probes, handle step transitions (every 10s)
  // Transcription is now decoupled — it runs on the storage heartbeat cycle.
  const runAnalysisHeartbeat = useCallback(async (): Promise<AnalysisHeartbeatResult> => {
    const startMs = Date.now();

    // Route to local analysis if enabled
    if (localInferenceEnabledRef.current) {
      await runLocalAnalysisHeartbeat();
      return { success: true, durationMs: Date.now() - startMs };
    }

    const currentSession = sessionRef.current;
    const currentPlan = sessionPlanRef.current;
    if (!currentSession || !currentPlan) return { success: true, durationMs: 0 };
    if (isAnalyzingRef.current) return { success: true, durationMs: 0 };

    isAnalyzingRef.current = true;

    try {
      const openProbes = currentSession.probes.filter((p: Probe) => !p.archived);
      const focusedProbes = openProbes.filter((p: Probe) => p.focused).map((p: Probe) => ({ id: p.id, text: p.text }));

      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          previousProbes: currentSession.probes.map((p: Probe) => p.text),
          // Send {id, text} so the LLM can echo real UUIDs in probes_to_archive.
          activeProbes: openProbes.map((p: Probe) => ({ id: p.id, text: p.text })),
          focusedProbes,
          openProbeCount: openProbes.length,
          lastProbeTimestamp: lastProbeTimeRef.current || 0,
        }),
      });

      if (!res.ok) {
        return { success: false, durationMs: Date.now() - startMs, error: "Analysis service unavailable" };
      }

      const planData = await res.json();
      if (!planData) return { success: true, durationMs: Date.now() - startMs };

      // --- Process plan update response (parity with desktop) ---

      // Step transition detection
      const previousStepIndex = sessionPlanRef.current?.currentStepIndex ?? 0;
      const newStepIndex = planData.plan?.currentStepIndex ?? 0;
      const llmWantsAdvance = newStepIndex > previousStepIndex && isValidPlan(planData.plan);
      const isStepTransition = llmWantsAdvance && autoAdvanceRef.current;

      // Update plan state
      if (isStepTransition && isValidPlan(planData.plan)) {
        setSessionPlan(planData.plan);
        sessionPlanRef.current = planData.plan;
      } else if (llmWantsAdvance && !autoAdvanceRef.current) {
        // Manual mode: suppress step advance, keep current index
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
      } else if (isValidPlan(planData.plan)) {
        setSessionPlan(planData.plan);
        sessionPlanRef.current = planData.plan;
      }

      // On step transition: archive ALL active probes and trigger celebration
      if (isStepTransition) {
        const activeProbesForArchive = currentSession.probes.filter((p: Probe) => !p.archived);
        if (activeProbesForArchive.length > 0) {
          let updatedSession = currentSession;
          for (const probe of activeProbesForArchive) {
            await archiveProbe(probe.id);
            updatedSession = {
              ...updatedSession,
              probes: updatedSession.probes.map(p =>
                p.id === probe.id ? { ...p, archived: true } : p
              ),
            };
          }
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          setProbes(updatedSession.probes);
        }

        // Detect if plan is fully complete
        const updatedPlan = sessionPlanRef.current;
        const isPlanComplete = updatedPlan?.steps?.every(
          (s: { status: string }) => s.status === "completed" || s.status === "skipped"
        );

        if (isPlanComplete) {
          setIsCelebrating(true);
          playSessionCompleteSound();
          setTimeout(() => {
            setIsCelebrating(false);
            setShowPlanCompleteModal(true);
            if (isRecording && !isPaused) {
              setIsPaused(true);
            }
          }, 1500);
        } else {
          setIsCelebrating(true);
          playStepCompleteSound();
          setTimeout(() => setIsCelebrating(false), 1500);
        }
      } else if (planData.probesToArchive && planData.probesToArchive.length > 0) {
        // Auto-archive specific probes
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
        setProbes(updatedSession.probes);
      }

      // Create probe from nextRequest
      if (planData.nextRequest) {
        const latestSession = sessionRef.current || currentSession;
        const currentOpenProbeCount = latestSession.probes.filter((p: Probe) => !p.archived).length;

        const timeSinceLastProbe = Date.now() - (lastProbeTimeRef.current || 0);
        const cooldownMet = lastProbeTimeRef.current === 0 || timeSinceLastProbe >= PROBE_COOLDOWN_MS;
        const isDupe = isDuplicateProbe(planData.nextRequest.text, latestSession.probes);

        if (planData.canGenerateProbe !== false && currentOpenProbeCount < 5 && cooldownMet && !isDupe) {
          const savedProbe = await addProbe(currentSession.id, {
            timestamp: Date.now() - new Date(currentSession.startedAt).getTime(),
            gapScore: planData.gapScore ?? 0.5,
            signals: planData.signals || [],
            text: planData.nextRequest.text,
            requestType: planData.nextRequest.type || "question",
            planStepId: currentPlan.steps?.[currentPlan.currentStepIndex]?.id,
          });

          const updatedSession = addProbeToSession(latestSession, savedProbe);
          setSession(updatedSession);
          sessionRef.current = updatedSession;
          setProbes(updatedSession.probes);
          lastProbeTimeRef.current = Date.now();
        }
      }

      return { success: true, durationMs: Date.now() - startMs, gapScore: planData.gapScore };
    } catch (err) {
      console.error("[Mobile] Analysis error:", err);
      return { success: false, durationMs: Date.now() - startMs, error: String(err) };
    } finally {
      isAnalyzingRef.current = false;
      setIsGeneratingProbe(false);
    }
  }, []);

  // ---- Mobile Heartbeat Hook ----
  const heartbeat = useSessionHeartbeat({
    storageIntervalMs: 5000,
    analysisIntervalMs: 10000,
    onStorageHeartbeat: runStorageHeartbeat,
    onAnalysisHeartbeat: runAnalysisHeartbeat,
  });

  /**
   * Manual "Submit to Helios" — mirror of the desktop handler. Forces a
   * storage flush (so the latest canvas is on the server) and then kicks
   * off an analysis heartbeat out of band from the 10s timer. Both
   * run-functions have internal reentrancy guards (`isAnalyzingRef`), so
   * racing with the periodic tick is safe.
   */
  const handleSubmitToHelios = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (currentSession) {
      // Fire-and-forget — we don't want the log round-trip to block submit.
      logToolUsage(currentSession.id, "canvas", "submit_to_helios", Date.now(), {
        hasCanvas: !!whiteboardDataRef.current,
      }).catch((err) => console.warn("[Mobile] logToolUsage failed:", err));
    }

    try {
      await runStorageHeartbeat();
    } catch (err) {
      console.warn("[Mobile SubmitToHelios] storage heartbeat failed:", err);
    }
    try {
      await runAnalysisHeartbeat();
    } catch (err) {
      console.warn("[Mobile SubmitToHelios] analysis heartbeat failed:", err);
    }

    // Disable the button until the user edits again. Applied even on
    // heartbeat failure: the submission was made, we don't want the user
    // to keep retrying with the exact same content.
    setCanvasDirtyForHelios(false);
  }, [runStorageHeartbeat, runAnalysisHeartbeat]);

  // Heartbeat lifecycle - managed by the hook, controlled by recording state
  useEffect(() => {
    if (isRecording && !isPaused) {
      heartbeat.resume();
    } else {
      heartbeat.pause();
    }
  }, [isRecording, isPaused, heartbeat]);

  // Check microphone permission
  const checkMicrophone = useCallback(async () => {
    setMicStatus("checking");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      stream.getTracks().forEach(t => t.stop());
      setMicStatus("ready");
    } catch (err) {
      setMicStatus("denied");
      setError("Microphone access denied. Please allow microphone permission and try again.");
    }
  }, []);

  // Start session directly (checks mic first)
  const handleStartSession = useCallback(async () => {
    if (!session) return;
    
    setMicStatus("checking");
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        setMicStatus("denied");
        setError("Could not access microphone. No audio track available. Please grant permission and try again.");
        return;
      }

      const track = audioTracks[0];
      if (track.readyState === 'ended') {
        stream.getTracks().forEach(t => t.stop());
        setMicStatus("denied");
        setError("Microphone permission denied. Please allow microphone access in your browser settings.");
        return;
      }

      chunkIndexRef.current = 0;

      const recorder = new AudioRecorder({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
      });

      recorderRef.current = recorder;
      await recorder.start(stream);
      setMicStream(stream);
      await startSession(session.id);
      timerBaseRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      setMicStatus("ready");
      // Timer is handled by the effect based on isRecording/isPaused state

    } catch (err) {
      setMicStatus("denied");
      setError("Could not access microphone. Please grant permission and try again.");
    }
  }, [session]);

  /**
   * Fetch the opening probe and persist it. Extracted so the in-panel
   * Tutor Welcome Play button can defer this network call.
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
          objectives: s.objectives,
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
      setSession(prev => (prev ? { ...prev, probes: [savedProbe] } : null));
      setProbes([savedProbe]);
    } catch (err) {
      console.error("[MobileSessionView] Opening probe fetch failed:", err);
    }
  }, [tutoringLanguage]);

  /**
   * The user clicked Play inside the tutor welcome panel. Fetch the opening
   * probe and mark welcome seen so a refresh doesn't re-play the intro.
   */
  const handleWelcomePlay = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    setIsStartingSession(true);
    try {
      // Bring the session to an actively-recording state. Three cases:
      //   1. Fresh session: startRecording via handleStartSession (mic req).
      //   2. Paused session (Help was clicked): resumeRecording restarts
      //      the recorder and flips status back to active.
      //   3. Already recording: no-op.
      if (!isRecording) {
        await handleStartSession();
      } else if (isPaused) {
        await resumeRecording();
      }
      // Only fetch the opening probe on fresh sessions. If probes already
      // exist (e.g. Help re-ran the welcome), preserve the history.
      const hasActive = (sessionRef.current?.probes ?? []).some(p => !p.archived);
      if (!hasActive) {
        await fetchAndSaveOpeningProbe();
      }
    } finally {
      markSessionWelcomeSeen(s.id);
      setShowWelcomePanel(false);
      setIsStartingSession(false);
    }
    // handleStartSession / resumeRecording are stable-ish and including
    // them as deps would cause noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAndSaveOpeningProbe, isRecording, isPaused]);

  // Prepare session with language selection
  const prepareSession = useCallback(async () => {
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
      const supabase = createClient();
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", session.id)
        .single();
      if (sessionData?.metadata) {
        await supabase
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
          const translateRes = await fetch("/api/session-plan/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              sessionId: session.id, 
              tutoringLanguage,
              objectives: session.objectives,
            }),
          });
          if (translateRes.ok) {
            const { plan } = await translateRes.json();
            newPlan = plan;
          }
        }
      }
      
      if (!newPlan) {
        // Create new plan with target language
        const planRes = await fetch("/api/session-plan/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sessionId: session.id, 
            problem: session.problem, 
            objectives: session.objectives,
            planningPrompt: session.planningPrompt,
            force: true,
            tutoringLanguage,
          }),
        });
        if (planRes.ok) {
          const { plan } = await planRes.json();
          newPlan = plan;
        } else {
          const errorData = await planRes.json().catch(() => ({}));
          setPlanError(errorData.error || "Failed to create session plan");
        }
      }
      
      if (newPlan) {
        setSessionPlan(newPlan);
      }
      
      // Archive existing probes. Opening-probe fetch is deferred to the
      // in-panel Play button on fresh sessions (mirrors desktop behavior).
      if (session.probes.length > 0) {
        for (const probe of session.probes) {
          await archiveProbe(probe.id);
        }
      }
      setSession({ ...session, probes: [] });
      setProbes([]);

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
      if (localInferenceEnabledRef.current) {
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

      // All done - Phase 2 will show "Get Started"
      setPrepStage("done");
    } catch (err) {
      console.error("Failed to prepare session:", err);
      setPlanError("Failed to prepare session");
    } finally {
      setPlanLoading(false);
      setOpeningProbeLoading(false);
      setIsPreparing(false);
    }
  }, [session, tutoringLanguage, isPreparing]);

  // Stop recording and end session
  const stopRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Clean up local inference if active
    if (localInferenceEnabledRef.current) {
      LocalInferenceManager.getInstance().dispose();
      localContextRef.current?.clear();
    }

    // Stop heartbeat system (waits for in-flight analysis, runs final flush)
    await heartbeat.stop();

    await recorderRef.current?.stop();
    recorderRef.current = null;
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      setMicStream(null);
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setIsSaving(true);
    
    if (!session) return;
    
    const finalSession = endSession(session, elapsedSeconds * 1000);
    finalSession.hasAudio = true;
    finalSession.metadata = {
      ...finalSession.metadata,
      whiteboardData: whiteboardData || undefined,
    };
    
    await saveSession(finalSession);
    
    router.push(`/results?id=${finalSession.id}`);
  }, [session, elapsedSeconds, router, heartbeat]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    if (!session) return;
    recorderRef.current?.pause();
    setIsPaused(true);
    timerBaseRef.current = Date.now() - elapsedSeconds * 1000;
    await pauseSession(session.id);
  }, [session, elapsedSeconds]);

  // Auto-pause after 5 min of silence + no input — cost-saving measure.
  const handleInactivityAutoPause = useCallback(() => {
    if (!isRecording || isPaused) return;
    setAutoPausedForInactivity(true);
    void pauseRecording();
  }, [isRecording, isPaused, pauseRecording]);

  useInactivityAutoPause({
    stream: micStream,
    isRecording,
    isPaused,
    onAutoPause: handleInactivityAutoPause,
    thresholdMs: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isPaused) setAutoPausedForInactivity(false);
  }, [isPaused]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    if (!session) return;

    if (recorderRef.current) {
      timerBaseRef.current = Date.now() - elapsedSeconds * 1000;
      recorderRef.current.resume();
      setIsPaused(false);
      await resumeSession(session.id);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        setMicStatus("denied");
        setError("Could not access microphone. Please grant permission and try again.");
        return;
      }

      const recorder = new AudioRecorder({
        chunkDurationMs: 60000,
        maxBufferDurationMs: 300000,
      });

      recorderRef.current = recorder;
      await recorder.start(stream);
      setMicStream(stream);
      setIsPaused(false);
      setIsRecording(true);
      timerBaseRef.current = Date.now() - elapsedSeconds * 1000;
      await resumeSession(session.id);
    } catch (err) {
      setMicStatus("denied");
      setError("Could not access microphone. Please grant permission and try again.");
    }
  }, [session, elapsedSeconds]);

  // Archive probe
  const handleArchiveProbe = useCallback(async (probeId: string) => {
    setArchivingProbeId(probeId);
    try {
      await archiveProbe(probeId);
      setProbes(prev => prev.map(p => 
        p.id === probeId ? { ...p, archived: true } : p
      ));
    } catch (err) {
      console.error("Failed to archive probe:", err);
    } finally {
      setArchivingProbeId(null);
    }
  }, []);

  // Toggle probe focus
  const handleToggleFocus = useCallback(async (probeId: string, focused: boolean) => {
    try {
      await toggleProbeFocused(probeId, focused);
      setProbes(prev => prev.map(p => 
        p.id === probeId ? { ...p, focused } : p
      ));
    } catch (err) {
      console.error("Failed to toggle focus:", err);
    }
  }, []);

  // Advance to next step
  const handleAdvanceStep = useCallback(async (forceAdvance = false) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;
    const openProbes = currentSession.probes.filter((p: Probe) => !p.archived);

    // --- Local inference mode: advance step entirely in-browser ---
    if (localInferenceEnabledRef.current) {
      const currentPlan = sessionPlanRef.current;
      if (!currentPlan?.steps?.length) return;

      const currentIdx = currentPlan.currentStepIndex ?? 0;
      const isLastStep = currentIdx >= currentPlan.steps.length - 1;

      // Mark current step completed and advance index
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
      }).catch(err => console.warn("[Mobile][LocalInference] Failed to sync plan to backend:", err));

      // Archive all active probes in-memory
      if (openProbes.length > 0) {
        const archivedSession = {
          ...currentSession,
          probes: currentSession.probes.map(p => !p.archived ? { ...p, archived: true } : p),
        };
        setSession(archivedSession);
        sessionRef.current = archivedSession;
        setProbes(archivedSession.probes);
      }

      if (isLastStep) {
        setIsCelebrating(true);
        playSessionCompleteSound();
        setTimeout(() => {
          setIsCelebrating(false);
          setShowPlanCompleteModal(true);
          if (isRecording && !isPaused) setIsPaused(true);
        }, 1500);
      } else {
        setIsCelebrating(true);
        playStepCompleteSound();
        setTimeout(() => setIsCelebrating(false), 1500);

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
                previousProbes: latestForProbe.probes.map((p: Probe) => p.text),
                tutoringLanguage,
              });
            } catch (err) {
              console.warn("[Mobile][LocalInference] Probe generation failed:", err);
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
            setProbes(updatedSession.probes);
            lastProbeTimeRef.current = Date.now();
          } else {
            setError("Local inference failed to generate a probe for this step.");
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
          previousProbes: currentSession.probes.map((p: Probe) => p.text),
          focusedProbes: openProbes.filter((p: Probe) => p.focused).map((p: Probe) => ({ id: p.id, text: p.text })),
          openProbeCount: openProbes.length,
        }),
      });

      if (!res.ok) throw new Error("Failed to advance step");

      const data = await res.json();

      // Handle blocked response — show reasoning as feedback probe
      if (data.blocked) {
        const reasoning = data.advanceReasoning || "You may not be ready to move on yet.";
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
        setProbes(updatedSession.probes);
        return;
      }

      const { plan: updatedPlan, allComplete } = data;
      if (!isValidPlan(updatedPlan)) return;

      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Archive all active probes
      if (openProbes.length > 0) {
        let updatedSession = currentSession;
        for (const probe of openProbes) {
          await archiveProbe(probe.id);
          updatedSession = {
            ...updatedSession,
            probes: updatedSession.probes.map(p =>
              p.id === probe.id ? { ...p, archived: true } : p
            ),
          };
        }
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setProbes(updatedSession.probes);
      }

      if (allComplete) {
        // Plan fully complete - celebrate and show modal
        setIsCelebrating(true);
        playSessionCompleteSound();
        setTimeout(() => {
          setIsCelebrating(false);
          setShowPlanCompleteModal(true);
          if (isRecording && !isPaused) {
            setIsPaused(true);
          }
        }, 1500);
        return;
      }

      // Regular step advance - celebrate
      setIsCelebrating(true);
      playStepCompleteSound();
      setTimeout(() => setIsCelebrating(false), 1500);

      // Generate a probe for the new step
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
              previousProbes: currentSession.probes.map((p: Probe) => p.text),
              archivedProbes: currentSession.probes.filter((p: Probe) => p.archived).map((p: Probe) => p.text),
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
              setProbes(updatedSession.probes);
              lastProbeTimeRef.current = Date.now();
            }
          }
        } catch (probeErr) {
          console.warn("[Mobile] Failed to generate probe for new step:", probeErr);
        } finally {
          setIsGeneratingProbe(false);
        }
      }
    } catch (err) {
      console.error("[Mobile] Advance step error:", err);
    }
  }, [session]);

  // Rollback to a specific step
  const handleRollbackToStep = useCallback(async (stepIndex: number) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    // --- Local inference mode: rollback entirely in-browser ---
    if (localInferenceEnabledRef.current) {
      const currentPlan = sessionPlanRef.current;
      if (!currentPlan?.steps?.length) return;

      const updatedSteps = currentPlan.steps.map((s, i) => {
        if (i < stepIndex) return s;
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
      }).catch(err => console.warn("[Mobile][LocalInference] Failed to sync rollback to backend:", err));

      // Archive all active probes in-memory
      const activeProbes = currentSession.probes.filter((p: Probe) => !p.archived);
      let latestSession = currentSession;
      if (activeProbes.length > 0) {
        latestSession = {
          ...currentSession,
          probes: currentSession.probes.map(p => !p.archived ? { ...p, archived: true } : p),
        };
        setSession(latestSession);
        sessionRef.current = latestSession;
        setProbes(latestSession.probes);
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
              previousProbes: latestSession.probes.map((p: Probe) => p.text),
              tutoringLanguage,
            });
          } catch (err) {
            console.warn("[Mobile][LocalInference] Probe generation failed on rollback:", err);
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
          setProbes(updatedSession.probes);
          lastProbeTimeRef.current = Date.now();
        } else {
          setError("Local inference failed to generate a probe for this step.");
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

      if (!res.ok) throw new Error("Failed to rollback step");

      const { plan: updatedPlan } = await res.json();
      if (!isValidPlan(updatedPlan)) return;

      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Archive all active probes
      const activeProbes = currentSession.probes.filter((p: Probe) => !p.archived);
      if (activeProbes.length > 0) {
        let updatedSession = currentSession;
        for (const probe of activeProbes) {
          await archiveProbe(probe.id);
          updatedSession = {
            ...updatedSession,
            probes: updatedSession.probes.map(p =>
              p.id === probe.id ? { ...p, archived: true } : p
            ),
          };
        }
        setSession(updatedSession);
        sessionRef.current = updatedSession;
        setProbes(updatedSession.probes);
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
              signals: ["rollback"],
              previousProbes: currentSession.probes.map((p: Probe) => p.text),
              archivedProbes: currentSession.probes.filter((p: Probe) => p.archived).map((p: Probe) => p.text),
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
                signals: ["rollback", "plan_step"],
                text: probeData.probe.trim(),
                requestType: probeData.requestType || targetStep.type || "question",
                planStepId: targetStep.id,
              });
              const updatedSession = addProbeToSession(latestSession, savedProbe);
              setSession(updatedSession);
              sessionRef.current = updatedSession;
              setProbes(updatedSession.probes);
              lastProbeTimeRef.current = Date.now();
            }
          }
        } catch (probeErr) {
          console.warn("[Mobile] Failed to generate probe for rollback step:", probeErr);
        } finally {
          setIsGeneratingProbe(false);
        }
      }
    } catch (err) {
      console.error("[Mobile] Rollback step error:", err);
    }
  }, [session]);

  // ── Skip to step ────────────────────────────────────────────────
  const handleSkipToStep = useCallback(async (stepIndex: number) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    try {
      const res = await fetch("/api/session-plan/skip-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, skipToIndex: stepIndex }),
      });

      if (!res.ok) throw new Error("Failed to skip steps");

      const { plan: updatedPlan } = await res.json();
      if (!isValidPlan(updatedPlan)) return;

      setSessionPlan(updatedPlan);
      sessionPlanRef.current = updatedPlan;

      // Reset probes for the new step
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
            probes: currentSession.probes.map((p: Probe) => ({ ...p, archived: true })),
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
            lastProbeTimeRef.current = Date.now();
          }

          setSession(finalSession);
          sessionRef.current = finalSession;
          setProbes(finalSession.probes);
        }
      } catch (probeErr) {
        console.warn("[Mobile] Failed to reset probes after skip:", probeErr);
      }
    } catch (err) {
      console.error("[Mobile] Skip to step error:", err);
    }
  }, [session]);

  // ── Regenerate remaining plan steps ────────────────────────────
  const handleRegeneratePlan = useCallback(async (reason?: string) => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    try {
      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, reason }),
      });

      if (!res.ok) throw new Error("Failed to regenerate plan");

      const { plan: updatedPlan } = await res.json();
      if (!isValidPlan(updatedPlan)) return;

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
            probes: currentSession.probes.map((p: Probe) => ({ ...p, archived: true })),
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
            lastProbeTimeRef.current = Date.now();
          }

          setSession(finalSession);
          sessionRef.current = finalSession;
          setProbes(finalSession.probes);
        }
      } catch (probeErr) {
        console.warn("[Mobile] Failed to reset probes after regenerate:", probeErr);
      }
    } catch (err) {
      console.error("[Mobile] Regenerate plan error:", err);
    } finally {
      setIsGeneratingProbe(false);
    }
  }, [session]);

  // ── Reset probes (standalone) ──────────────────────────────────
  const handleResetProbes = useCallback(async () => {
    if (!session) return;
    const currentSession = sessionRef.current || session;

    try {
      setIsGeneratingProbe(true);
      const res = await fetch("/api/session-plan/reset-probes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!res.ok) throw new Error("Failed to reset probes");

      const resetData = await res.json();
      const updatedSession: Session = {
        ...currentSession,
        probes: currentSession.probes.map((p: Probe) => ({ ...p, archived: true })),
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
        lastProbeTimeRef.current = Date.now();
      }

      setSession(finalSession);
      sessionRef.current = finalSession;
      setProbes(finalSession.probes);
    } catch (err) {
      console.error("[Mobile] Reset probes error:", err);
    } finally {
      setIsGeneratingProbe(false);
    }
  }, [session]);

  // Camera functions
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      cameraStreamRef.current = stream;
      setCameraMode('open');
    } catch (err) {
      console.error("Camera access failed:", err);
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    cameraStreamRef.current = null;
    setCapturedImage(null);
    setCameraMode('closed');
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    setCameraMode('preview');
  }, []);

  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;
    setPendingWhiteboardImage(capturedImage);
    closeCamera();
  }, [capturedImage, closeCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCameraMode('open');
  }, []);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-neutral-700 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-neutral-500">{t('session.loadingSession')}</p>
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-white mb-2">{t('session.sessionNotFound')}</h1>
        <p className="text-sm text-neutral-500 mb-6">
          {t('session.sessionNotFoundDesc')}
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white hover:bg-neutral-700 transition-colors"
        >
          {t('session.goToDashboard')}
        </Link>
      </div>
    );
  }

  // Welcome/Preparation Modal
  if (showWelcomeModal) {
    const isSessionReady = sessionPlan && !planLoading && !openingProbeLoading && probes.length > 0;
    const isButtonDisabled = planLoading || isPreparing;
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 mx-auto flex items-center justify-center">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/15 via-neutral-800 to-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
                <span className="text-xl font-serif text-neutral-200">T</span>
              </div>
              <div className="absolute inset-0 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.08)] pointer-events-none" />
            </div>
          </div>
          
          <h1 className="text-xl font-semibold text-white text-center mb-2">
            {t('session.welcomeTitle')}
          </h1>
          <p className="text-neutral-400 text-sm text-center mb-6">
            {t('session.welcomeMessage')}
          </p>
          
          {/* Step indicators (neutral) */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono tabular-nums transition-colors ${
              languageConfirmed
                ? 'bg-neutral-100 text-neutral-900'
                : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
            }`}>
              1
            </div>
            <div className={`w-12 h-px ${languageConfirmed ? 'bg-neutral-300' : 'bg-neutral-800'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono tabular-nums transition-colors ${
              languageConfirmed && isSessionReady
                ? 'bg-neutral-100 text-neutral-900'
                : languageConfirmed
                  ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                  : 'bg-neutral-900 text-neutral-600 border border-neutral-800'
            }`}>
              2
            </div>
          </div>

          {planError && (
            <div className="mb-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-400 leading-relaxed">{planError}</p>
            </div>
          )}

          {/* Phase 1: Language selection */}
          {!languageConfirmed && (
            <>
              <div className="mb-4">
                <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 mb-2">
                  {t('session.tutorLanguage')}
                </label>
                <select
                  value={tutoringLanguage}
                  onChange={(e) => {
                    setTutoringLanguage(e.target.value as SupportedLocale);
                  }}
                  disabled={isButtonDisabled}
                  className="w-full px-3 py-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 disabled:opacity-50 transition-colors"
                >
                  {supportedLocales.map((loc) => (
                    <option key={loc} value={loc}>
                      {languageNames[loc]}
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
                className="hidden w-full mb-3 p-3.5 rounded-xl border bg-neutral-900 border-neutral-800 active:bg-neutral-800/60 active:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors items-center gap-3 text-left"
              >
                <div className="relative shrink-0 w-11 h-6 rounded-full bg-neutral-700">
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-neutral-100 shadow transition-transform ${autoAdvance ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
                  downstream logic remain wired so we can bring it back
                  by removing the `hidden` wrapper. */}
              <button
                type="button"
                onClick={() => webGPUAvailable && !isButtonDisabled && setLocalInferenceEnabled(!localInferenceEnabled)}
                disabled={!webGPUAvailable || isButtonDisabled}
                aria-hidden="true"
                tabIndex={-1}
                className="hidden w-full mb-5 p-3.5 rounded-xl border bg-neutral-900 border-neutral-800 enabled:active:bg-neutral-800/60 enabled:active:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors items-center gap-3 text-left"
              >
                <div className="relative shrink-0 w-11 h-6 rounded-full bg-neutral-700">
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-neutral-100 shadow transition-transform ${localInferenceEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
                onClick={prepareSession}
                disabled={isButtonDisabled}
                className="w-full py-3.5 px-4 text-sm font-medium rounded-xl transition-colors bg-neutral-100 text-neutral-900 active:bg-white disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

                  {(planError || modelLoadError) && (
                    <div className="px-3 py-2.5 bg-red-500/5 border border-red-500/20 rounded-xl">
                      <p className="text-xs text-red-400 leading-relaxed">{planError || modelLoadError}</p>
                    </div>
                  )}

                  {modelLoadError && (
                    <button
                      onClick={() => {
                        LocalInferenceManager.getInstance().dispose();
                        setModelLoadError(null);
                        setLocalInferenceEnabled(false);
                        setIsPreparing(false);
                        setPrepStage("done");
                      }}
                      className="w-full py-2 text-xs text-neutral-400 active:text-neutral-200 transition-colors"
                    >
                      {t('session.continueWithoutBrowserInference')}
                    </button>
                  )}
                </div>
              )}

              {/* Ready to go */}
              {prepStage === "done" && languageConfirmed && !isPreparing && (
                <button
                  onClick={() => setShowWelcomeModal(false)}
                  className="mt-4 w-full py-3.5 px-4 text-sm font-medium rounded-xl transition-colors bg-neutral-100 text-neutral-900 active:bg-white"
                >
                  {t('session.getStarted')}
                </button>
              )}
            </>
          )}

          {/* Phase 2: Ready (already confirmed before) */}
          {languageConfirmed && (
            <button
              onClick={() => {
                // If user never clicked Play on this session, drop into
                // the in-panel tutor welcome rather than going straight
                // into the main UI.
                if (
                  session &&
                  !isSessionWelcomeSeen(session.id) &&
                  (probes.filter(p => !p.archived).length === 0)
                ) {
                  setShowWelcomePanel(true);
                  setActiveTab(0); // make sure probes tab is visible
                }
                setShowWelcomeModal(false);
              }}
              className="w-full py-3.5 px-4 text-sm font-medium rounded-xl transition-colors bg-neutral-100 text-neutral-900 active:bg-white"
            >
              {t('session.getStarted')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "probes",
      label: t('session.questions'),
      content: (
        <MobileProbesTab
          probes={probes}
          sessionPlan={sessionPlan}
          onArchiveProbe={handleArchiveProbe}
          onToggleFocus={handleToggleFocus}
          onResetProbes={handleResetProbes}
          archivingProbeId={archivingProbeId}
          isGeneratingProbe={isGeneratingProbe}
          showWelcome={showWelcomePanel}
          onWelcomePlay={handleWelcomePlay}
          onOpenSessionPlan={() => setActiveTab(1)}
          isStartingSession={isStartingSession}
          sessionId={session?.id}
          ttsLanguage={tutoringLanguage}
          isSessionActive={isRecording && !isPaused}
        />
      ),
    },
    {
      id: "plan",
      label: t('session.plan'),
      content: (
        <MobilePlanTab
          plan={sessionPlan}
          onAdvanceStep={handleAdvanceStep}
          onRollbackToStep={handleRollbackToStep}
          onSkipToStep={handleSkipToStep}
          onRegeneratePlan={handleRegeneratePlan}
          autoAdvance={autoAdvance}
          onToggleAutoAdvance={setAutoAdvance}
          sessionId={session?.id}
          isSessionActive={isRecording && !isPaused}
          onToolEvent={(action, metadata) => {
            if (!session?.id) return;
            // Fire-and-forget: mobile has no transfer-health UI so we
            // just persist to session_tool + xAI Files via the standard
            // path. Desktop uses logTool() which wraps this and also
            // updates the transfer-health counter + Logs UI.
            logToolUsage(session.id, "session_plan", action, Date.now(), metadata ?? {}).catch((err) =>
              console.warn("[MobileSessionView] logToolUsage failed:", err)
            );
          }}
        />
      ),
    },
    {
      id: "canvas",
      label: t('tools.canvas'),
      content: (
        <div className="h-full relative">
          <MobileExcalidrawCanvas
            initialData={whiteboardData || undefined}
            pendingImage={pendingWhiteboardImage}
            onPendingImageUsed={() => setPendingWhiteboardImage(null)}
            onCanvasChange={(dataUrl: string) => {
              console.log("[Mobile] Canvas changed, size:", dataUrl.length);
              whiteboardDataRef.current = dataUrl;
              setWhiteboardData(dataUrl);
              // Any edit re-arms the submit button.
              setCanvasDirtyForHelios(true);
            }}
            onOpenCamera={openCamera}
            onSubmitToHelios={handleSubmitToHelios}
            canSubmitToHelios={canvasDirtyForHelios}
          />
        </div>
      ),
    },
  ];

  return (
    <div 
      className="h-dvh bg-[#0a0a0a] flex flex-col overflow-hidden"
      style={{ 
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Celebration Overlay */}
      {isCelebrating && (
        <>
          {/* Flash overlay */}
          <div className="fixed inset-0 bg-gradient-to-b from-cyan-500/20 via-transparent to-transparent pointer-events-none z-40 animate-celebration-flash" />
          
          {/* Confetti explosion */}
          <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
            {[
              { x: 10, delay: 0, color: '#22d3ee', anim: 'animate-confetti-up-left' },
              { x: 20, delay: 0.05, color: '#34d399', anim: 'animate-confetti-up' },
              { x: 30, delay: 0.1, color: '#fbbf24', anim: 'animate-confetti-up-right' },
              { x: 40, delay: 0.03, color: '#f472b6', anim: 'animate-confetti-up-left' },
              { x: 50, delay: 0.08, color: '#a78bfa', anim: 'animate-confetti-up' },
              { x: 60, delay: 0.02, color: '#fb7185', anim: 'animate-confetti-up-right' },
              { x: 70, delay: 0.06, color: '#22d3ee', anim: 'animate-confetti-up-left' },
              { x: 80, delay: 0.04, color: '#34d399', anim: 'animate-confetti-up' },
              { x: 90, delay: 0.09, color: '#fbbf24', anim: 'animate-confetti-up-right' },
              { x: 15, delay: 0.07, color: '#f472b6', anim: 'animate-confetti-up' },
              { x: 35, delay: 0.01, color: '#a78bfa', anim: 'animate-confetti-up-left' },
              { x: 55, delay: 0.11, color: '#fb7185', anim: 'animate-confetti-up-right' },
              { x: 75, delay: 0.03, color: '#22d3ee', anim: 'animate-confetti-up' },
              { x: 85, delay: 0.08, color: '#34d399', anim: 'animate-confetti-up-left' },
              { x: 25, delay: 0.05, color: '#fbbf24', anim: 'animate-confetti-up-right' },
              { x: 45, delay: 0.02, color: '#f472b6', anim: 'animate-confetti-up' },
            ].map((particle, i) => (
              <div
                key={i}
                className={`absolute w-2.5 h-2.5 rounded-sm ${particle.anim}`}
                style={{
                  left: `${particle.x}%`,
                  top: '40%',
                  backgroundColor: particle.color,
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
            <div className="absolute left-1/2 top-[20%] w-3.5 h-3.5 animate-star-burst" style={{ animationDelay: '0.15s' }}>
              <svg viewBox="0 0 24 24" fill="#f472b6" className="w-full h-full">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        </>
      )}

      {/* Compact Header */}
      <header className={`shrink-0 px-3 py-1.5 border-b border-neutral-800/80 bg-[#0a0a0a] transition-all duration-300 ${isCelebrating ? 'animate-step-celebrate' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRecording && !isPaused ? (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            ) : isPaused ? (
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" />
            )}
            <span className="text-xs font-medium text-neutral-400 truncate">
              {isRecording && !isPaused ? t('session.recording') : isPaused ? t('session.paused') : t('session.session')}
            </span>
            {autoPausedForInactivity && isPaused && (
              <span className="ml-1 text-[10px] text-amber-400 truncate" title={t('session.autoPausedInactivity')}>
                · {t('session.autoPausedInactivity')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isRecording && (
              <>
                {/* Play / Resume — if the tutor welcome is showing,
                    behave like pressing Start session in the panel. */}
                <button
                  onClick={showWelcomePanel ? handleWelcomePlay : resumeRecording}
                  disabled={!isPaused}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-[0.95] ${
                    !isPaused
                      ? "text-green-500/20"
                      : "text-green-400 bg-green-500/10"
                  }`}
                  title={t('session.resume')}
                  aria-label={t('session.resume')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>

                {/* Pause */}
                <button
                  onClick={pauseRecording}
                  disabled={isPaused}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-[0.95] ${
                    isPaused
                      ? "text-amber-500/20"
                      : "text-amber-400 bg-amber-500/10"
                  }`}
                  title={t('session.pause')}
                  aria-label={t('session.pause')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                  </svg>
                </button>

                {/* Stop / End */}
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-[0.95] text-red-400 bg-red-500/10"
                  title={t('session.end')}
                  aria-label={t('session.end')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>

                <div className="w-px h-5 bg-neutral-800 mx-1" />
              </>
            )}

            {/* Help — pauses the session and re-opens the tutor welcome
                (typed greeting + Start session button). Preserves probes
                and session data; clicking Start session resumes recording. */}
            <button
              onClick={() => {
                if (isRecording && !isPaused) {
                  pauseRecording().catch(err =>
                    console.error("[MobileSessionView] Help pause failed:", err),
                  );
                }
                setShowWelcomePanel(true);
                setActiveTab(0); // ensure probes tab is visible
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 active:bg-neutral-800 transition-colors"
              title={t('tools.help')}
              aria-label={t('tools.help')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Pre-recording states (start / mic checks / errors) */}
        {(error || micStatus === "idle" || micStatus === "checking" || micStatus === "denied" || isSaving) && !isRecording && (
          <div className="mt-1.5">
            {error && (
              <div className="mb-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-[10px] text-red-400">{error}</p>
              </div>
            )}

            {micStatus === "idle" && (
              <button
                onClick={showWelcomePanel ? handleWelcomePlay : handleStartSession}
                className="w-full py-1.5 px-3 bg-neutral-100 text-neutral-900 rounded-xl text-xs font-medium flex items-center justify-center gap-2 active:bg-white active:scale-[0.98] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {t('session.startSession')}
              </button>
            )}

            {micStatus === "checking" && (
              <div className="w-full py-1.5 px-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center gap-2">
                <div className="w-4 h-4 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                <span className="text-xs text-neutral-400">{t('session.checkingMic')}</span>
              </div>
            )}

            {micStatus === "denied" && (
              <button
                onClick={checkMicrophone}
                className="w-full py-1.5 px-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs font-medium text-red-400 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {t('session.retryMicrophoneAccess')}
              </button>
            )}

            {isSaving && (
              <div className="flex items-center justify-center gap-2 py-1">
                <div className="w-4 h-4 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
                <span className="text-xs text-neutral-400">{t('session.savingSession')}</span>
              </div>
            )}
          </div>
        )}

        {isSaving && isRecording && (
          <div className="mt-1.5 flex items-center justify-center gap-2 py-1">
            <div className="w-4 h-4 border border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
            <span className="text-xs text-neutral-400">{t('session.savingSession')}</span>
          </div>
        )}
      </header>

      {/* End Session Confirmation Modal — ending is irreversible, so we
          warn and offer a non-destructive "pause + back to dashboard"
          alternative. */}
      <ConfirmDialog
        open={showEndConfirm}
        onCancel={() => setShowEndConfirm(false)}
        onConfirm={() => {
          setShowEndConfirm(false);
          stopRecording();
        }}
        onTertiary={async () => {
          setShowEndConfirm(false);
          if (!isPaused) {
            try { await pauseRecording(); } catch (e) { console.error(e); }
          }
          router.push("/dashboard");
        }}
        variant="destructive"
        title={t('sessionEnd.confirmEndTitle')}
        description={t('sessionEnd.confirmEndMessage')}
        confirmLabel={t('sessionEnd.endSession')}
        cancelLabel={t('common.keepGoing')}
        tertiaryLabel={t('sessionEnd.pauseAndLeave')}
        tertiaryIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        }
      />

      {/* Plan Complete Modal */}
      <ConfirmDialog
        open={showPlanCompleteModal}
        onCancel={() => setShowPlanCompleteModal(false)}
        onConfirm={() => {
          setShowPlanCompleteModal(false);
          stopRecording();
        }}
        variant="neutral"
        title={t('session.sessionComplete')}
        description={t('session.congratulationsComplete')}
        confirmLabel={t('sessionEnd.endSession')}
        cancelLabel={t('common.keepGoing')}
        confirmTone="primary"
      />

      {/* Camera Overlay - Full screen, outside tab content */}
      {cameraMode !== 'closed' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-4">
            <button
              onClick={closeCamera}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <button
              onClick={() => setFlashEnabled(!flashEnabled)}
              className={`w-10 h-10 flex items-center justify-center rounded-full ${
                flashEnabled ? "bg-neutral-100 text-neutral-900" : "bg-white/10 text-white"
              }`}
            >
              <svg className="w-6 h-6" fill={flashEnabled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {cameraMode === 'open' && cameraStreamRef.current && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            
            {cameraMode === 'preview' && capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className="max-w-full max-h-full object-contain"
              />
            )}
            
            <canvas ref={captureCanvasRef} className="hidden" />
          </div>

          <div className="shrink-0 px-6 py-8">
            {cameraMode === 'open' && (
              <div className="flex items-center justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-95"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-neutral-900" />
                </button>
              </div>
            )}
            
            {cameraMode === 'preview' && (
              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  className="flex-1 py-4 bg-white/10 text-white font-medium rounded-2xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retake
                </button>
                <button
                  onClick={confirmCapture}
                  className="flex-1 py-4 bg-neutral-100 text-neutral-900 font-medium rounded-2xl flex items-center justify-center gap-2 active:bg-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Use Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Swipeable */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <SwipeableTabContent
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Bottom Tab Bar */}
      <div
        className="shrink-0 py-2 px-4 bg-neutral-900 border-t border-neutral-800"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-around">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(index)}
                aria-label={tab.label}
                title={tab.label}
                className={`flex items-center justify-center w-14 h-12 rounded-lg transition-all active:scale-[0.95] ${
                  activeTab === index
                    ? "text-white"
                    : "text-neutral-500"
                }`}
              >
                {tabIcons[index]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SwipeableTabContentProps {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

function SwipeableTabContent({ tabs, activeTab, onTabChange }: SwipeableTabContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isFirstMove, setIsFirstMove] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-no-swipe="true"]')) {
        touchStartRef.current = null;
        return;
      }
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchCurrentRef.current = touch.clientX;
      setIsDragging(true);
      setIsFirstMove(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        touchStartRef.current = null;
        setIsDragging(false);
        setDragOffset(0);
        return;
      }

      if (isFirstMove && Math.abs(deltaX) > 10) {
        e.preventDefault();
        setIsFirstMove(false);
      }

      touchCurrentRef.current = touch.clientX;
      
      let offset = deltaX;
      if ((activeTab === 0 && deltaX > 0) || (activeTab === tabs.length - 1 && deltaX < 0)) {
        offset = deltaX * 0.3;
      }
      
      setDragOffset(offset);
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current) {
        setIsDragging(false);
        setDragOffset(0);
        return;
      }

      const deltaX = touchCurrentRef.current - touchStartRef.current.x;
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(deltaX) / deltaTime;

      const containerWidth = containerRef.current?.offsetWidth || 300;
      const threshold = containerWidth * 0.2;
      const velocityThreshold = 0.3;

      let newTab = activeTab;

      if (Math.abs(deltaX) > threshold || velocity > velocityThreshold) {
        if (deltaX < 0 && activeTab < tabs.length - 1) {
          newTab = activeTab + 1;
        } else if (deltaX > 0 && activeTab > 0) {
          newTab = activeTab - 1;
        }
      }

      onTabChange(newTab);
      touchStartRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      setIsFirstMove(false);
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [activeTab, onTabChange, tabs.length, isFirstMove]);

  const getContentTransform = () => {
    const stepPercent = 100 / tabs.length;
    const baseOffset = -activeTab * stepPercent;
    if (isDragging && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const dragPercent = (dragOffset / containerWidth) * stepPercent;
      return `translateX(calc(${baseOffset}% + ${dragPercent}%))`;
    }
    return `translateX(${baseOffset}%)`;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute top-0 bottom-0 left-0 flex"
        style={{
          transform: getContentTransform(),
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          width: `${tabs.length * 100}%`,
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="h-full overflow-hidden"
            style={{ width: `${100 / tabs.length}%` }}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
