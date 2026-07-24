"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import { TAP_SPEECH_SEGMENT_GAP_MS } from "@/lib/tap-speech-proof-of-work";
import type { SessionPowContext } from "@/lib/session-pow-api-paths";
import { ILE_POW_API_PATHS, TAP_POW_API_PATHS } from "@/lib/session-pow-api-paths";

export function useTapSpeechProofOfWork(
  enabled: boolean,
  context: SessionPowContext,
  onInterruption: (interruption: ProofOfWorkApiInterruption) => void,
  speechApiPath: string = TAP_POW_API_PATHS.speech,
) {
  const [isTranscriptionActive, setIsTranscriptionActive] = useState(false);
  const isActiveRef = useRef(false);
  const segmentStartedAtRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef("");
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const onInterruptionRef = useRef(onInterruption);
  const contextRef = useRef(context);
  const speechApiPathRef = useRef(speechApiPath);

  useEffect(() => {
    onInterruptionRef.current = onInterruption;
  }, [onInterruption]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    speechApiPathRef.current = speechApiPath;
  }, [speechApiPath]);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const sendSpeechProofOfWork = useCallback(
    async (input: {
      event: "start" | "stop";
      segmentDurationMs?: number;
      transcriptSnapshot?: string;
      timestampMs?: number;
    }) => {
      const activeContext = contextRef.current;
      const sessionKey = activeContext.tapSessionId || activeContext.sessionId;
      if (!enabled || !sessionKey || inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        const response = await fetch(speechApiPathRef.current, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: activeContext.workspaceId,
            blockId: activeContext.blockId,
            sessionId: activeContext.sessionId,
            privateToken: activeContext.privateToken,
            ileToken: activeContext.privateToken,
            tapSessionId: activeContext.tapSessionId,
            entryQueryParams: activeContext.entryQueryParams,
            event: input.event,
            segmentDurationMs: input.segmentDurationMs,
            transcriptSnapshot: input.transcriptSnapshot,
            timestampMs: input.timestampMs ?? Date.now(),
          }),
        });
        const payload = await response.json();
        if (!response.ok) return;
        onInterruptionRef.current(payload.interruption ?? null);
      } catch {
        // ignore transient network errors
      } finally {
        inFlightRef.current = false;
      }
    },
    [enabled],
  );

  const endSpeechSegment = useCallback(
    (timestampMs = Date.now()) => {
      if (!isActiveRef.current) return;

      const startedAt = segmentStartedAtRef.current ?? timestampMs;
      const segmentDurationMs = Math.max(0, timestampMs - startedAt);
      const transcriptSnapshot = latestTranscriptRef.current;

      isActiveRef.current = false;
      segmentStartedAtRef.current = null;
      setIsTranscriptionActive(false);

      void sendSpeechProofOfWork({
        event: "stop",
        segmentDurationMs,
        transcriptSnapshot,
        timestampMs,
      });
    },
    [sendSpeechProofOfWork],
  );

  const notifySpeechResult = useCallback(
    (transcript: string) => {
      if (!enabled) return;

      const clean = transcript.trim();
      latestTranscriptRef.current = clean;

      if (!clean) return;

      const now = Date.now();
      clearStopTimer();

      if (!isActiveRef.current) {
        isActiveRef.current = true;
        segmentStartedAtRef.current = now;
        setIsTranscriptionActive(true);
        void sendSpeechProofOfWork({ event: "start", timestampMs: now });
      }

      stopTimerRef.current = setTimeout(() => {
        endSpeechSegment(Date.now());
      }, TAP_SPEECH_SEGMENT_GAP_MS);
    },
    [enabled, clearStopTimer, sendSpeechProofOfWork, endSpeechSegment],
  );

  const flushSpeechSegment = useCallback(() => {
    clearStopTimer();
    endSpeechSegment();
  }, [clearStopTimer, endSpeechSegment]);

  const resetSpeechTracking = useCallback(() => {
    clearStopTimer();
    isActiveRef.current = false;
    segmentStartedAtRef.current = null;
    latestTranscriptRef.current = "";
    setIsTranscriptionActive(false);
  }, [clearStopTimer]);

  useEffect(() => {
    if (!enabled) {
      resetSpeechTracking();
    }
  }, [enabled, resetSpeechTracking]);

  useEffect(() => () => clearStopTimer(), [clearStopTimer]);

  return {
    isTranscriptionActive,
    notifySpeechResult,
    flushSpeechSegment,
    resetSpeechTracking,
  };
}