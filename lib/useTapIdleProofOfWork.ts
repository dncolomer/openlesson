"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import { TAP_IDLE_POW_INTERVAL_MS } from "@/lib/tap-idle-proof-of-work";
import type { SessionPowContext } from "@/lib/session-pow-api-paths";
import { ILE_POW_API_PATHS, TAP_POW_API_PATHS } from "@/lib/session-pow-api-paths";
import { shouldSendIdleProofOfWork } from "@/lib/tap-interruption-gate";
import { postTutoringIdle } from "@/lib/tutoring-client";

const IDLE_CHECK_MS = 5_000;

export type TapIdleProofOfWorkContext = SessionPowContext;

export interface TapIdleProofOfWorkOptions {
  speechText?: string;
  /** True while the learner is actively speaking (live transcription in progress). */
  isTranscriptionActive?: boolean;
}

export function useTapIdleProofOfWork(
  enabled: boolean,
  context: SessionPowContext,
  onInterruption: (interruption: ProofOfWorkApiInterruption) => void,
  options: TapIdleProofOfWorkOptions = {},
  idleApiPath: string = TAP_POW_API_PATHS.idle,
) {
  const { speechText = "", isTranscriptionActive = false } = options;
  const lastActivityAtRef = useRef(Date.now());
  const lastIdleSentAtRef = useRef(0);
  const idleInFlightRef = useRef(false);
  const onInterruptionRef = useRef(onInterruption);
  const contextRef = useRef(context);
  const speechTextRef = useRef(speechText);
  const isTranscriptionActiveRef = useRef(isTranscriptionActive);
  const idleApiPathRef = useRef(idleApiPath);

  useEffect(() => {
    onInterruptionRef.current = onInterruption;
  }, [onInterruption]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    idleApiPathRef.current = idleApiPath;
  }, [idleApiPath]);

  useEffect(() => {
    speechTextRef.current = speechText;
    if (speechText.trim()) {
      lastActivityAtRef.current = Date.now();
    }
  }, [speechText]);

  useEffect(() => {
    isTranscriptionActiveRef.current = isTranscriptionActive;
    if (isTranscriptionActive) {
      lastActivityAtRef.current = Date.now();
    }
  }, [isTranscriptionActive]);

  const bumpUserActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  const resetIdleTracking = useCallback(() => {
    const now = Date.now();
    lastActivityAtRef.current = now;
    lastIdleSentAtRef.current = 0;
    idleInFlightRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const sendIdleProofOfWork = async () => {
      const activeContext = contextRef.current;
      const sessionKey = activeContext.tapSessionId || activeContext.sessionId;
      if (!sessionKey || idleInFlightRef.current) return;

      // Skip idle heartbeats while thought is forming (pending bar and/or speaking).
      const hasPendingTranscription = Boolean(speechTextRef.current.trim());
      if (
        !shouldSendIdleProofOfWork({
          hasPendingTranscription,
          isTranscriptionActive: isTranscriptionActiveRef.current,
        })
      ) {
        return;
      }

      const now = Date.now();
      const idleDurationMs = now - lastActivityAtRef.current;
      if (idleDurationMs < TAP_IDLE_POW_INTERVAL_MS) return;
      if (now - lastIdleSentAtRef.current < TAP_IDLE_POW_INTERVAL_MS) return;

      idleInFlightRef.current = true;
      lastIdleSentAtRef.current = now;

      try {
        const posted = await postTutoringIdle(
          activeContext,
          {
            idleDurationMs,
            hasPendingTranscription,
            timestampMs: now,
          },
          idleApiPathRef.current,
        );
        if (!posted.ok) return;
        onInterruptionRef.current(
          (posted.payload.interruption as ProofOfWorkApiInterruption) ?? null,
        );
      } catch {
        // ignore transient network errors; next interval will retry
      } finally {
        idleInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void sendIdleProofOfWork();
    }, IDLE_CHECK_MS);

    return () => window.clearInterval(interval);
  }, [enabled]);

  return { bumpUserActivity, resetIdleTracking };
}

export { ILE_POW_API_PATHS, TAP_POW_API_PATHS };