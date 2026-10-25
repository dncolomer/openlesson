"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  endSession,
  getIlePostSessionPath,
  pauseSession,
  resumeSession,
  updateSessionStatus,
  type Session,
} from "@/lib/storage";
import { applyIleOpenWorkIdsToMetadata } from "@/lib/learn-pow-spend";
import { persistIleSessionRow } from "@/lib/learn-session-persist";
import { releaseSessionLocalMemory } from "@/lib/session-local-memory";
import type { GuestAccessKind } from "@/components/session-view/types";

export type SessionRecordingRuntime = {
  flushRemainingIlePow: (options?: { force?: boolean }) => Promise<void>;
  handleDisconnectMuse: () => void;
  handleConnectMuse: () => void;
  isScreenCapturing: boolean;
  isWebcamEnabled: boolean;
  setIsWebcamEnabled: (v: boolean) => void;
  setIsScreenCapturing: (v: boolean) => void;
  museStatus: string;
  screenCaptureRef: {
    current: {
      start: () => Promise<boolean>;
      stop: () => void;
      getStream: () => MediaStream | null;
    } | null;
  };
};

export type SessionRecordingState = {
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  elapsedSeconds: number;
  setElapsedSeconds: (v: number | ((n: number) => number)) => void;
  elapsedSecondsRef: { current: number };
  stream: MediaStream | null;
  setStream: (s: MediaStream | null) => void;
  micStatus: "idle" | "checking" | "ready" | "denied";
  setMicStatus: (s: "idle" | "checking" | "ready" | "denied") => void;
  micStreamRef: { current: MediaStream | null };
  isMuted: boolean;
  setIsMuted: Dispatch<SetStateAction<boolean>>;
  muteRemaining: number;
  setMuteRemaining: Dispatch<SetStateAction<number>>;
  muteTimerRef: { current: ReturnType<typeof setTimeout> | null };
  timerRef: { current: ReturnType<typeof setInterval> | null };
  isRecordingRef: { current: boolean };
  wasRecordingRef: { current: boolean };
  wasScreenCapturingRef: { current: boolean };
  wasWebcamEnabledRef: { current: boolean };
  wasMuseStreamingRef: { current: boolean };
  pausedAudioStreamRef: { current: MediaStream | null };
  pausedScreenStreamRef: { current: MediaStream | null };
  pausedWebcamStreamRef: { current: MediaStream | null };
};

export function useSessionRecordingState(): SessionRecordingState {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  const micStreamRef = useRef<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [muteRemaining, setMuteRemaining] = useState(0);
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedSecondsRef = useRef(0);
  const isRecordingRef = useRef(false);
  const wasRecordingRef = useRef(false);
  const wasScreenCapturingRef = useRef(false);
  const wasWebcamEnabledRef = useRef(false);
  const wasMuseStreamingRef = useRef(false);
  const pausedAudioStreamRef = useRef<MediaStream | null>(null);
  const pausedScreenStreamRef = useRef<MediaStream | null>(null);
  const pausedWebcamStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);
  useEffect(() => {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [stream, isMuted]);

  return {
    isRecording,
    setIsRecording,
    isPaused,
    setIsPaused,
    elapsedSeconds,
    setElapsedSeconds,
    elapsedSecondsRef,
    stream,
    setStream,
    micStatus,
    setMicStatus,
    micStreamRef,
    isMuted,
    setIsMuted,
    muteRemaining,
    setMuteRemaining,
    muteTimerRef,
    timerRef,
    isRecordingRef,
    wasRecordingRef,
    wasScreenCapturingRef,
    wasWebcamEnabledRef,
    wasMuseStreamingRef,
    pausedAudioStreamRef,
    pausedScreenStreamRef,
    pausedWebcamStreamRef,
  };
}

export type SessionRecordingInput = SessionRecordingState &
  SessionRecordingRuntime & {
    session: Session | null;
    setSession: (s: Session | null | ((prev: Session | null) => Session | null)) => void;
    sessionRef: { current: Session | null };
    guestAccessKind: GuestAccessKind;
    ayclToken?: string;
    ileToken?: string;
    router: ReturnType<typeof useRouter>;
    t: (key: string) => string;
    setError: (e: string | null) => void;
    setIsSaving: (v: boolean) => void;
    whiteboardData: string | null;
    notebookContent: string;
    handlePauseRef: { current: () => Promise<void> };
    openWorkIdsRef: { current: string[] };
  };

export function useSessionRecording(input: SessionRecordingInput) {
  const {
    session,
    setSession,
    sessionRef,
    guestAccessKind,
    ayclToken,
    ileToken,
    router,
    t,
    setError,
    setIsSaving,
    whiteboardData,
    notebookContent,
    handlePauseRef,
    openWorkIdsRef,
    isRecording,
    setIsRecording,
    isPaused,
    setIsPaused,
    elapsedSeconds,
    setElapsedSeconds,
    elapsedSecondsRef,
    stream,
    setStream,
    setMicStatus,
    micStreamRef,
    setIsMuted,
    setMuteRemaining,
    muteTimerRef,
    timerRef,
    isRecordingRef,
    wasRecordingRef,
    wasScreenCapturingRef,
    wasWebcamEnabledRef,
    wasMuseStreamingRef,
    pausedAudioStreamRef,
    pausedScreenStreamRef,
    pausedWebcamStreamRef,
    flushRemainingIlePow,
    handleDisconnectMuse,
    handleConnectMuse,
    isScreenCapturing,
    isWebcamEnabled,
    setIsWebcamEnabled,
    setIsScreenCapturing,
    museStatus,
    screenCaptureRef,
  } = input;

  useEffect(() => {
    if (!session || !isRecording || isPaused) return;
    const interval = window.setInterval(() => {
      void updateSessionStatus(session.id, "active", elapsedSecondsRef.current * 1000);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [elapsedSecondsRef, isPaused, isRecording, session]);

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
    } catch {
      setMicStatus("denied");
      setError(t("session.micDenied"));
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      let mediaStream: MediaStream | null = micStreamRef.current;
      try {
        if (!mediaStream || mediaStream.getTracks().some((track) => track.readyState === "ended")) {
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
        setError(t("session.micNotFound"));
        mediaStream = null;
        micStreamRef.current = null;
        setStream(null);
      }

      setIsRecording(true);
      setIsPaused(false);

      if (session) {
        updateSessionStatus(session.id, "active").catch(() => {});
      }

      const startTime = Date.now() - elapsedSeconds * 1000;
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      console.error("[SessionView] startRecording failed:", err);
      setError(t("session.micError"));
    }
  };

  const stopRecording = async (options?: { stayOnScreen?: boolean }) => {
    if (timerRef.current) clearInterval(timerRef.current);

    await flushRemainingIlePow({ force: true });

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsRecording(false);
    if (!options?.stayOnScreen) setIsSaving(true);
    if (!session) {
      releaseSessionLocalMemory();
      return;
    }

    const finalSession = endSession(sessionRef.current ?? session, elapsedSeconds * 1000);
    finalSession.hasAudio = false;
    finalSession.metadata = applyIleOpenWorkIdsToMetadata(
      {
        ...finalSession.metadata,
        whiteboardData: whiteboardData || undefined,
        notebookData: notebookContent || undefined,
      } as Record<string, unknown>,
      openWorkIdsRef.current,
    ) as Session["metadata"];
    sessionRef.current = finalSession;

    await persistIleSessionRow(() => sessionRef.current, { ayclToken, ileToken });

    handleDisconnectMuse();
    if (options?.stayOnScreen) return;
    releaseSessionLocalMemory(finalSession.id);

    router.push(
      guestAccessKind === "aycl" && ayclToken
        ? `/learn/${ayclToken}`
        : guestAccessKind === "ile"
          ? `/learn/session/${ileToken}`
          : getIlePostSessionPath(finalSession),
    );
  };

  const handlePause = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    wasRecordingRef.current = isRecordingRef.current;
    wasScreenCapturingRef.current = isScreenCapturing;
    wasWebcamEnabledRef.current = isWebcamEnabled;
    wasMuseStreamingRef.current = museStatus === "streaming";

    pausedAudioStreamRef.current = stream;
    pausedScreenStreamRef.current = screenCaptureRef.current?.getStream() || null;
    pausedWebcamStreamRef.current = null;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      setIsScreenCapturing(false);
    }

    handleDisconnectMuse();
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
      try {
        let mediaStream = pausedAudioStreamRef.current;
        const tracksStillActive = mediaStream?.getTracks().some((track) => track.readyState === "live");
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
        setError(t("session.micNotFound"));
        setStream(null);
      }

      setIsRecording(true);
      setIsPaused(false);

      await resumeSession(session.id);
      const activeSession = { ...session, status: "active" as const };
      setSession(activeSession);
      sessionRef.current = activeSession;

      const startTime = Date.now() - elapsedSeconds * 1000;
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      if (wasScreenCapturingRef.current) {
        if (screenCaptureRef.current) {
          const existingStream = pausedScreenStreamRef.current;
          const streamStillActive = existingStream
            ?.getVideoTracks()
            .some((track) => track.readyState === "live");
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

      if (wasWebcamEnabledRef.current) {
        setIsWebcamEnabled(true);
      }

      if (wasMuseStreamingRef.current) {
        handleConnectMuse();
      }
    } catch (err) {
      console.error("[SessionView] handleResume failed:", err);
      setError(t("session.micError"));
    }
  };

  const handleMute = (durationMs: number) => {
    setIsMuted(true);
    setMuteRemaining(durationMs);
    if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
    muteTimerRef.current = setTimeout(() => {
      setIsMuted(false);
      setMuteRemaining(0);
    }, durationMs);
  };

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
  }, [elapsedSecondsRef, isRecording, session]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    checkMicrophone,
    startRecording,
    stopRecording,
    handlePause,
    handleResume,
    handleMute,
  };
}
