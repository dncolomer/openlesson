"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TAP_SESSION_PURITY_MAX,
  TAP_SILENCE_AUTO_STASH_MS,
  isSessionPurityDepleted,
  isWithinTapPurityGrace,
  nextSessionPurityAfterAutoStash,
  shouldAutoStashOnSilence,
  shouldEvaluateSessionPurity,
  shouldPenalizeEmptyBarSilence,
} from "@/lib/tap-session-purity";

export function useIleSessionPurity(input: {
  armed: boolean;
  formingText: string;
  waitingForHelios: boolean;
  canvasLoadingRef: { current: boolean };
  xaiReplyWaitRef: { current: boolean };
  stashCurrentTranscription: (options?: { auto?: boolean; fromContext?: boolean }) => void;
  onDepleted: () => void;
}) {
  const [sessionPurity, setSessionPurity] = useState(TAP_SESSION_PURITY_MAX);
  const [sessionEndedImpure, setSessionEndedImpure] = useState(false);
  const lastSpeechActivityAtRef = useRef(Date.now());
  const autoStashInFlightRef = useRef(false);
  const isSendingRef = useRef(false);
  const prevHadTextRef = useRef(false);
  const formingTextRef = useRef(input.formingText);
  const onDepletedRef = useRef(input.onDepleted);
  const stashRef = useRef(input.stashCurrentTranscription);
  const canvasLoadingRef = input.canvasLoadingRef;
  const xaiReplyWaitRef = input.xaiReplyWaitRef;
  onDepletedRef.current = input.onDepleted;
  stashRef.current = input.stashCurrentTranscription;
  isSendingRef.current = input.waitingForHelios;
  formingTextRef.current = input.formingText;

  const applyPurityHit = useCallback(() => {
    setSessionPurity((current) => {
      const next = nextSessionPurityAfterAutoStash(current);
      if (isSessionPurityDepleted(next)) {
        window.setTimeout(() => {
          setSessionEndedImpure(true);
          onDepletedRef.current();
        }, 0);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (input.waitingForHelios) {
      lastSpeechActivityAtRef.current = Date.now();
      autoStashInFlightRef.current = false;
    }
  }, [input.waitingForHelios]);

  useEffect(() => {
    const next = input.formingText.trim();
    if (next) {
      lastSpeechActivityAtRef.current = Date.now();
      prevHadTextRef.current = true;
      return;
    }
    if (prevHadTextRef.current) {
      lastSpeechActivityAtRef.current = Date.now();
      prevHadTextRef.current = false;
    }
  }, [input.formingText]);

  useEffect(() => {
    if (!input.armed || sessionEndedImpure) {
      autoStashInFlightRef.current = false;
      return;
    }

    const liveEnteredAt = Date.now();
    lastSpeechActivityAtRef.current = liveEnteredAt;
    canvasLoadingRef.current = true;

    const tick = window.setInterval(() => {
      if (isWithinTapPurityGrace(liveEnteredAt)) {
        lastSpeechActivityAtRef.current = Date.now();
        return;
      }
      if (
        !shouldEvaluateSessionPurity({
          waitingForHelios: isSendingRef.current,
          canvasLoading: canvasLoadingRef.current,
          waitingForXaiReply: xaiReplyWaitRef.current,
        })
      ) {
        lastSpeechActivityAtRef.current = Date.now();
        autoStashInFlightRef.current = false;
        return;
      }
      const silenceMs = Date.now() - lastSpeechActivityAtRef.current;
      const hasTranscript = Boolean(formingTextRef.current.trim());

      if (
        shouldAutoStashOnSilence(silenceMs, hasTranscript, TAP_SILENCE_AUTO_STASH_MS) &&
        !autoStashInFlightRef.current
      ) {
        autoStashInFlightRef.current = true;
        stashRef.current({ auto: true });
        applyPurityHit();
        lastSpeechActivityAtRef.current = Date.now();
        autoStashInFlightRef.current = false;
        return;
      }

      if (
        shouldPenalizeEmptyBarSilence(silenceMs, hasTranscript, TAP_SILENCE_AUTO_STASH_MS) &&
        !autoStashInFlightRef.current
      ) {
        autoStashInFlightRef.current = true;
        applyPurityHit();
        lastSpeechActivityAtRef.current = Date.now();
        autoStashInFlightRef.current = false;
      }
    }, 100);

    return () => window.clearInterval(tick);
  }, [applyPurityHit, canvasLoadingRef, input.armed, sessionEndedImpure, xaiReplyWaitRef]);

  return { sessionPurity, sessionEndedImpure, applyPurityHit };
}
