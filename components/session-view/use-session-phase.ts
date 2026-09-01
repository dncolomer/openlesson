"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveProbe,
  endSession,
  getIlePostSessionPath,
  getSession,
  getSessionPlan,
  pauseSession,
  resetSessionProbes,
  resumeSession,
  saveSession,
  toggleProbeFocused,
  updateSessionStatus,
  type Session,
  type SessionPlan,
  type Probe,
} from "@/lib/storage";
import { playArchiveSound } from "@/lib/sounds";
import { isSessionWelcomeSeen, markSessionWelcomeSeen } from "@/lib/welcomeState";
import { LocalInferenceManager, type InitProgress } from "@/lib/local-inference";
import { LocalContextBuffer } from "@/lib/local-context";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import { readErrorResponse } from "@/components/session/sessionViewHelpers";
import {
  chapterStatusAfterHydrate,
  createForceFromChapterStatus,
  fetchSessionPlanChaptersStatus,
  fetchWelcomeChapterSnapshot,
} from "@/lib/session-plan-chapters-status";
import { ileWelcomeShowsRegenerate } from "@/lib/ile-welcome-chapters";
import { applyIleSessionNameToMetadata } from "@/lib/ile-session-name";
import type { GuestAccessKind, ChapterPlanStatus, PrepStage, HelpPreviousLayout } from "@/components/session-view/types";
import type { InitialChaptersLevel } from "@/lib/initial-chapters";
import type { IleSessionMode } from "@/lib/ile-mode";


export type SessionPhaseInput = {
  session: Session | null;
  setSession: (s: Session | null | ((prev: Session | null) => Session | null)) => void;
  sessionRef: { current: Session | null };
  sessionId: string;
  guestAccessKind: GuestAccessKind;
  ayclToken?: string;
  ileToken?: string;
  guestAccessBody: Record<string, unknown>;
  entryParamsKey: string;
  router: ReturnType<typeof useRouter>;
  t: (key: string) => string;
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  elapsedSeconds: number;
  setElapsedSeconds: (v: number | ((n: number) => number)) => void;
  elapsedSecondsRef: { current: number };
  stream: MediaStream | null;
  setStream: (s: MediaStream | null) => void;
  setError: (e: string | null) => void;
  tutoringLanguage: SpokenLocale;
  setTutoringLanguage: (l: SpokenLocale) => void;
  setLanguageConfirmed: (v: boolean) => void;
  setSessionPlan: (p: SessionPlan | null) => void;
  sessionPlanRef: { current: SessionPlan | null };
  setPlanLoading: (v: boolean) => void;
  setPlanError: (e: string | null) => void;
  setChapterPlanStatus: (s: ChapterPlanStatus) => void;
  setRegenerateChapters: (v: boolean) => void;
  regenerateChapters: boolean;
  objectives: string[];
  setObjectives: (o: string[]) => void;
  setObjectiveStatuses: (s: Array<"red" | "yellow" | "green" | "blue">) => void;
  setActiveProbe: (p: Probe | null) => void;
  setViewingProbeIndex: (n: number) => void;
  setArchivingProbeId: (id: string | null) => void;
  isPreparing: boolean;
  setIsPreparing: (v: boolean) => void;
  setPrepStage: (s: PrepStage) => void;
  setModelLoadError: (e: string | null) => void;
  setModelLoadProgress: (p: InitProgress | null) => void;
  localInferenceEnabled: boolean;
  setLocalInferenceEnabled: (v: boolean) => void;
  localInferenceEnabledRef: { current: boolean };
  localContextRef: { current: LocalContextBuffer | null };
  initialChapters: InitialChaptersLevel;
  resolvedSessionMode: IleSessionMode;
  setShowWelcomeModal: (v: boolean) => void;
  setShowWelcomePanel: (v: boolean) => void;
  setIsStartingSession: (v: boolean) => void;
  applyIleChapterGridStartup: () => void;
  helpPreviousLayoutRef: { current: HelpPreviousLayout | null };
  setPaneVisibility: (v: { tools: boolean; tutor: boolean; plan: boolean }) => void;
  timerRef: { current: ReturnType<typeof setInterval> | null };
  muteTimerRef: { current: ReturnType<typeof setTimeout> | null };
  micStreamRef: { current: MediaStream | null };
  setMicStatus: (s: "idle" | "checking" | "ready" | "denied") => void;
  setIsMuted: (v: boolean) => void;
  setMuteRemaining: (n: number) => void;
  setIsSaving: (v: boolean) => void;
  setShowEndDialog: (v: boolean) => void;
  whiteboardData: string | null;
  notebookContent: string;
  handleDisconnectMuse: () => void;
  handleConnectMuse: () => void;
  flushRemainingIlePow: (options?: { force?: boolean }) => Promise<void>;
  isScreenCapturing: boolean;
  isWebcamEnabled: boolean;
  setIsWebcamEnabled: (v: boolean) => void;
  setIsScreenCapturing: (v: boolean) => void;
  museStatus: string;
  screenCaptureRef: { current: { start: () => Promise<boolean>; stop: () => void; getStream: () => MediaStream | null } | null };
  wasRecordingRef: { current: boolean };
  wasScreenCapturingRef: { current: boolean };
  wasWebcamEnabledRef: { current: boolean };
  wasMuseStreamingRef: { current: boolean };
  isRecordingRef: { current: boolean };
  pausedAudioStreamRef: { current: MediaStream | null };
  pausedScreenStreamRef: { current: MediaStream | null };
  pausedWebcamStreamRef: { current: MediaStream | null };
  handlePauseRef: { current: () => Promise<void> };
};

export function useSessionPhase(input: SessionPhaseInput) {
  const {
    session, setSession, sessionRef, sessionId, guestAccessKind, ayclToken, ileToken,
    guestAccessBody, entryParamsKey, router, t, isRecording, setIsRecording, isPaused,
    setIsPaused, elapsedSeconds, setElapsedSeconds, elapsedSecondsRef, stream, setStream,
    setError, tutoringLanguage, setTutoringLanguage, setLanguageConfirmed, setSessionPlan,
    sessionPlanRef, setPlanLoading, setPlanError, setChapterPlanStatus, setRegenerateChapters,
    regenerateChapters, objectives, setObjectives, setObjectiveStatuses, setActiveProbe,
    setViewingProbeIndex, setArchivingProbeId, isPreparing, setIsPreparing, setPrepStage,
    setModelLoadError, setModelLoadProgress, localInferenceEnabled, setLocalInferenceEnabled,
    localInferenceEnabledRef, localContextRef, initialChapters, resolvedSessionMode,
    setShowWelcomeModal, setShowWelcomePanel, setIsStartingSession, applyIleChapterGridStartup,
    helpPreviousLayoutRef, setPaneVisibility, timerRef, muteTimerRef,
    micStreamRef, setMicStatus, setIsMuted, setMuteRemaining, setIsSaving, setShowEndDialog,
    whiteboardData, notebookContent, handleDisconnectMuse, handleConnectMuse, flushRemainingIlePow,
    isScreenCapturing, isWebcamEnabled, setIsWebcamEnabled, setIsScreenCapturing, museStatus,
    screenCaptureRef, wasRecordingRef, wasScreenCapturingRef, wasWebcamEnabledRef,
    wasMuseStreamingRef, isRecordingRef, pausedAudioStreamRef, pausedScreenStreamRef,
    pausedWebcamStreamRef, handlePauseRef,
  } = input;

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
    // Cheap existence check starts immediately — do not wait on session
    // fetch, objectives generation, or full-plan hydrate to leave "unknown".
    const chapterStatusPromise = fetchWelcomeChapterSnapshot(
      sessionId,
      guestAccessBody,
    );
    void chapterStatusPromise.then((snapshot) => {
      if (cancelled) return;
      setChapterPlanStatus(snapshot.status);
      if (snapshot.plan && (snapshot.plan.steps?.length ?? 0) > 0) {
        setSessionPlan(snapshot.plan);
        sessionPlanRef.current = snapshot.plan;
      }
    });

    const s =
      guestAccessKind === "aycl" && ayclToken
        ? await (await import("@/lib/aycl-storage")).getAyclSession(ayclToken, sessionId)
        : guestAccessKind === "ile" && ileToken
          ? await (await import("@/lib/ile-link-storage")).getIleLinkSession(ileToken, sessionId)
          : await getSession(sessionId);
    if (cancelled) return;
    if (s) {
      setSession(s);
      sessionRef.current = s;
      setElapsedSeconds(Math.floor((s.durationMs || 0) / 1000));
      
      // Reset language confirmation for new session
      setLanguageConfirmed(false);
      
      // Load tutoring language from session metadata if set
      if (s.metadata?.tutoringLanguage) {
        setTutoringLanguage(coerceSpokenLocale(String(s.metadata.tutoringLanguage)));
      }
      
      // Set paused state if session was paused
      if (s.status === "paused") {
        setIsPaused(true);
      }
      
      setPlanError(null);
      setRegenerateChapters(false);

      const objectivesPromise = (async () => {
        let loadedObjectives: string[] = [];
        if (s.objectives && s.objectives.length > 0) {
          loadedObjectives = s.objectives;
        } else {
          try {
            const objRes = await fetch("/api/generate-objectives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                problem: s.problem,
                ...guestAccessBody,
              }),
            });
            if (!cancelled && objRes.ok) {
              const { objectives: generatedObjectives } = await objRes.json();
              if (generatedObjectives && generatedObjectives.length > 0) {
                loadedObjectives = generatedObjectives;
              }
            }
          } catch { /* objectives are optional */ }
        }
        if (loadedObjectives.length > 0 && !cancelled) {
          setObjectives(loadedObjectives);
          setObjectiveStatuses(loadedObjectives.map(() => "blue"));
        }
      })();

      setPlanLoading(true);
      try {
        const snapshot = await chapterStatusPromise;
        if (cancelled) return;
        let status = snapshot.status;
        let existingPlan = snapshot.plan;
        if (snapshot.plan && (snapshot.plan.steps?.length ?? 0) > 0) {
          setSessionPlan(snapshot.plan);
          sessionPlanRef.current = snapshot.plan;
        }
        // Browser hydrate is best-effort; API plan is preferred.
        if (status === "exists" && !(existingPlan?.steps?.length)) {
          try {
            existingPlan = await getSessionPlan(s.id);
            if (
              !cancelled &&
              existingPlan &&
              (existingPlan.steps?.length ?? 0) > 0
            ) {
              setSessionPlan(existingPlan);
              sessionPlanRef.current = existingPlan;
            }
          } catch (err) {
            console.warn("Session plan hydrate failed:", err);
          }
        }
        if (!cancelled) {
          setChapterPlanStatus(chapterStatusAfterHydrate(status, existingPlan));
        }
      } catch (err) {
        console.warn("Session plan existence check failed:", err);
        if (!cancelled) setChapterPlanStatus("failed");
      } finally {
        if (!cancelled) setPlanLoading(false);
      }

      await objectivesPromise;

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
  // guestAccessBody is derived from tokens + entryParamsKey; include key not object identity.
}, [sessionId, router, guestAccessKind, ayclToken, ileToken, entryParamsKey, guestAccessBody]);

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

  await flushRemainingIlePow({ force: true });

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

  if (guestAccessKind === "aycl" && ayclToken) {
    const { saveAyclSession } = await import("@/lib/aycl-storage");
    await saveAyclSession(ayclToken, finalSession);
  } else if (guestAccessKind === "ile" && ileToken) {
    const { saveIleLinkSession } = await import("@/lib/ile-link-storage");
    await saveIleLinkSession(ileToken, finalSession);
  } else {
    await saveSession(finalSession);
  }

  // LWM Snapshot is manual (Knowledge UI) or Snapshot API POST .../lwm-snapshot —
  // not auto-run on ILE end. PoW is already flushed above.

  handleDisconnectMuse();

  router.push(
    guestAccessKind === "aycl" && ayclToken
      ? `/learn/${ayclToken}`
      : guestAccessKind === "ile"
        ? `/ile/session/${ileToken}`
        : getIlePostSessionPath(finalSession)
  );
};

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
handlePauseRef.current = handlePause;

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
const pauseAndGoToDashboard = useCallback(async (sessionName?: string | null) => {
  const current = sessionRef.current ?? session;
  if (current) {
    const metadata = applyIleSessionNameToMetadata(
      current.metadata as Record<string, unknown>,
      sessionName,
    ) as Session["metadata"];
    const named = { ...current, metadata };
    setSession(named);
    sessionRef.current = named;
    try {
      if (guestAccessKind === "aycl" && ayclToken) {
        const { saveAyclSession } = await import("@/lib/aycl-storage");
        await saveAyclSession(ayclToken, named);
      } else if (guestAccessKind === "ile" && ileToken) {
        const { saveIleLinkSession } = await import("@/lib/ile-link-storage");
        await saveIleLinkSession(ileToken, named);
      } else {
        await saveSession(named);
      }
    } catch {
      /* Still pause and leave — name is best-effort. */
    }
  }
  if (session && isRecording && !isPaused) {
    await handlePause();
  } else if (session && isPaused) {
    await pauseSession(session.id, elapsedSeconds * 1000);
  }
  const next = sessionRef.current ?? session;
  router.push(next ? getIlePostSessionPath(next) : "/dashboard");
}, [
  session,
  isRecording,
  isPaused,
  elapsedSeconds,
  handlePause,
  router,
  guestAccessKind,
  ayclToken,
  ileToken,
  setSession,
]);

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
        const innerLeft = prev.inner.collapsedSide === "left";
        const innerRight = prev.inner.collapsedSide === "right";
        setPaneVisibility({
          tools: !innerLeft,
          tutor: true,
          plan: !innerRight,
        });
      }, 120);
    }
  }
  // startRecording / handleResume are defined inline and reference many
  // setters/refs; including them as deps would cause noise.
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

const handleConfirmSettings = useCallback(async () => {
if (!session || isPreparing) return;

setPrepStage("plan");
setIsPreparing(true);
setPlanLoading(true);
setPlanError(null);
setModelLoadError(null);
setModelLoadProgress(null);

try {
if (guestAccessKind === "aycl" && ayclToken) {
  const { saveAyclSession } = await import("@/lib/aycl-storage");
  await saveAyclSession(ayclToken, {
    ...session,
    metadata: { ...(session.metadata || {}), tutoringLanguage },
  });
} else if (guestAccessKind === "ile" && ileToken) {
  const { saveIleLinkSession } = await import("@/lib/ile-link-storage");
  await saveIleLinkSession(ileToken, {
    ...session,
    metadata: { ...(session.metadata || {}), tutoringLanguage },
  });
} else {
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
}

const chapterStatus = await fetchSessionPlanChaptersStatus(
  session.id,
  guestAccessBody,
);
setChapterPlanStatus(chapterStatus);
const forceDecision = createForceFromChapterStatus(
  chapterStatus,
  ileWelcomeShowsRegenerate(chapterStatus) ? regenerateChapters : false,
);
if (forceDecision.action === "abort") {
  setPlanError(
    "Could not check for existing chapters. Existing chapters were not replaced.",
  );
  return;
}
const hasExistingChapters = chapterStatus === "exists";
let newPlan: SessionPlan | null = null;
const shouldReuseExisting = hasExistingChapters && !regenerateChapters;
if (shouldReuseExisting) {
  if (tutoringLanguage === "en") {
    if (!guestAccessKind) {
      const existingPlan = await getSessionPlan(session.id);
      if (existingPlan && (existingPlan.steps?.length ?? 0) > 0) {
        newPlan = existingPlan;
      }
    }
    // ILE/AYCL: skip browser SELECT; create with force:false returns the stored plan.
  } else {
    const translateRes = await fetch("/api/session-plan/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        tutoringLanguage,
        objectives,
        ...guestAccessBody,
      }),
    });
    if (translateRes.ok) {
      const { plan } = await translateRes.json();
      newPlan = plan;
    } else {
      const err = await translateRes.json().catch(() => ({}));
      console.error("[SessionView] Translation failed:", err);
      // Do not force-recreate on translate failure when the user
      // did not opt into regeneration — keep existing chapters.
      setPlanError(
        typeof err?.error === "string"
          ? err.error
          : "Failed to translate chapter map. Try again or regenerate chapters.",
      );
      return;
    }
  }
}
if (!newPlan) {
  const planRes = await fetch("/api/session-plan/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: session.id,
      problem: session.problem,
      objectives,
      planningPrompt: session.planningPrompt,
      // Only force-replace when user opted in or no chapters exist.
      force: forceDecision.force,
      tutoringLanguage,
      initialChapters,
      sessionMode: resolvedSessionMode,
      session_mode: resolvedSessionMode,
      ...guestAccessBody,
    }),
  });
  if (planRes.ok) {
    const { plan } = await planRes.json();
    newPlan = plan;
    setRegenerateChapters(false);
  } else {
    const errorMessage = await readErrorResponse(planRes, "Failed to create block plan");
    console.error("[SessionView] Create plan failed:", errorMessage);
    setPlanError(errorMessage);
    return;
  }
}
if (!newPlan) {
  setPlanError("Failed to prepare chapter map. Please try again.");
  return;
}
setSessionPlan(newPlan);
sessionPlanRef.current = newPlan;
setChapterPlanStatus(
  (newPlan.steps?.length ?? 0) > 0 ? "exists" : "empty",
);

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
// typed tutor welcome + Play button. Returning
// sessions skip that guide and must arm capture now.
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
// Arm monitoring + speech when the welcome guide is not shown.
// Fresh sessions wait for Play inside the guide (handleWelcomePlay).
if (!isFreshSession) {
  await startRecording();
}
} catch (err) {
console.error("Failed to prepare session:", err);
setPlanError("Failed to prepare block");
} finally {
setPlanLoading(false);
setIsPreparing(false);
}
}, [
  session,
  isPreparing,
  guestAccessKind,
  ayclToken,
  ileToken,
  tutoringLanguage,
  guestAccessBody,
  regenerateChapters,
  objectives,
  initialChapters,
  resolvedSessionMode,
  localInferenceEnabled,
]);

const handleContinueWithoutInference = useCallback(() => {
  LocalInferenceManager.getInstance().dispose();
  setModelLoadError(null);
  setLocalInferenceEnabled(false);
  setIsPreparing(false);
  setPrepStage("done");
}, []);

const handleWelcomeReadyStart = useCallback(async () => {
  setIsPaused(false);
  const needsWelcome =
    !!session &&
    !isSessionWelcomeSeen(session.id) &&
    session.probes.filter((p) => !p.archived).length === 0;
  if (needsWelcome) {
    setShowWelcomePanel(true);
  } else {
    await startRecording();
  }
  setShowWelcomeModal(false);
}, [session]);

  return {
    checkMicrophone,
    startRecording,
    stopRecording,
    handlePause,
    handleResume,
    handleMute,
    handleReset,
    pauseAndGoToDashboard,
    handleClose,
    handleWelcomePlay,
    handleArchiveProbe,
    handleToggleFocus,
    handleConfirmEnd,
    handleConfirmSettings,
    handleContinueWithoutInference,
    handleWelcomeReadyStart,
  };
}
