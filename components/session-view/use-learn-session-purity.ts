"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { practiceVoiceChallengeLocalSkipAllowed } from "@/lib/practice-voice-challenge";
import {
  DEFAULT_FLOW_ENFORCED_CHANNELS,
  type FlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  anySensorChannelEnforced,
  emptyFlowChannelLive,
  enforcedSensorChannelsMissing,
  shouldPenalizeEnforcedChannelIdle,
  type FlowChannelLive,
} from "@/lib/flow-channel-purity";
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

function learnPurityDisabledOnLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  return practiceVoiceChallengeLocalSkipAllowed({
    nodeEnv: process.env.NODE_ENV,
    hostname: window.location.hostname,
  });
}

export function useIleSessionPurity(input: {
  armed: boolean;
  formingText: string;
  getFormingText?: () => string;
  waitingForHelios: boolean;
  canvasLoadingRef: { current: boolean };
  xaiReplyWaitRef: { current: boolean };
  stashCurrentTranscription: (options?: { auto?: boolean; fromContext?: boolean }) => void;
  onDepleted: () => void;
  enforcedChannels?: FlowEnforcedChannels;
  getSensorLive?: () => FlowChannelLive;
  skipLocal?: boolean;
}) {
  const [sessionPurity, setSessionPurity] = useState(TAP_SESSION_PURITY_MAX);
  const [sessionEndedImpure, setSessionEndedImpure] = useState(false);
  const [localSkip] = useState(() =>
    input.skipLocal === false ? false : learnPurityDisabledOnLocalhost(),
  );
  const lastSpeechActivityAtRef = useRef(Date.now());
  const lastSensorOkAtRef = useRef(Date.now());
  const enforcedChannelsRef = useRef(input.enforcedChannels ?? DEFAULT_FLOW_ENFORCED_CHANNELS);
  const getSensorLiveRef = useRef(input.getSensorLive);
  enforcedChannelsRef.current = input.enforcedChannels ?? DEFAULT_FLOW_ENFORCED_CHANNELS;
  getSensorLiveRef.current = input.getSensorLive;
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
  formingTextRef.current = input.getFormingText?.() ?? input.formingText;

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
      lastSensorOkAtRef.current = Date.now();
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
    if (!input.armed || sessionEndedImpure || localSkip) {
      autoStashInFlightRef.current = false;
      return;
    }

    const liveEnteredAt = Date.now();
    lastSpeechActivityAtRef.current = liveEnteredAt;
    canvasLoadingRef.current = true;

    const tick = window.setInterval(() => {
      if (isWithinTapPurityGrace(liveEnteredAt)) {
        lastSpeechActivityAtRef.current = Date.now();
        lastSensorOkAtRef.current = Date.now();
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
        lastSensorOkAtRef.current = Date.now();
        autoStashInFlightRef.current = false;
        return;
      }
      const channels = enforcedChannelsRef.current;
      if (anySensorChannelEnforced(channels)) {
        const live = getSensorLiveRef.current?.() ?? emptyFlowChannelLive();
        const missing = enforcedSensorChannelsMissing(channels, live);
        if (missing.length === 0) {
          lastSensorOkAtRef.current = Date.now();
        } else if (
          shouldPenalizeEnforcedChannelIdle(
            Date.now() - lastSensorOkAtRef.current,
            missing.length,
            TAP_SILENCE_AUTO_STASH_MS,
          ) &&
          !autoStashInFlightRef.current
        ) {
          autoStashInFlightRef.current = true;
          applyPurityHit();
          lastSensorOkAtRef.current = Date.now();
          autoStashInFlightRef.current = false;
          return;
        }
      }
      if (!channels.audio) return;
      formingTextRef.current = input.getFormingText?.() ?? formingTextRef.current;
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
  }, [
    applyPurityHit,
    canvasLoadingRef,
    input.armed,
    localSkip,
    sessionEndedImpure,
    xaiReplyWaitRef,
  ]);

  return { sessionPurity, sessionEndedImpure, applyPurityHit };
}
