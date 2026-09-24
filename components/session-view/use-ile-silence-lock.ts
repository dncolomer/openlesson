"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceIleSilenceClock,
  clampIleSilenceLockMinutes,
  ileRestUnlock,
  ileSilenceLockOutcome,
  type IleSilenceLockOutcome,
} from "@/lib/practice-voice-challenge";

export function useIleSilenceLock(input: {
  armed: boolean;
  /** Live transcript. A change to new text is speech. */
  speechText: string;
  /** Muted, missing, or ended mic. Leftover text must not keep the clock alive. */
  micSilent: boolean;
  minutes: number;
}) {
  const minutes = clampIleSilenceLockMinutes(input.minutes);
  const [lockCount, setLockCount] = useState(0);
  const [holding, setHolding] = useState(false);
  const lastSoundAt = useRef(Date.now());
  const lockCountRef = useRef(0);
  const holdingRef = useRef(false);
  const speechTextRef = useRef(input.speechText);
  const micSilentRef = useRef(input.micSilent);
  const heardRef = useRef("");
  speechTextRef.current = input.speechText;
  micSilentRef.current = input.micSilent;
  const wasArmed = useRef(false);

  useEffect(() => {
    if (!input.armed) {
      wasArmed.current = false;
      heardRef.current = "";
      return;
    }
    if (holdingRef.current) return;
    if (!wasArmed.current) {
      wasArmed.current = true;
      lastSoundAt.current = Date.now();
      heardRef.current = speechTextRef.current.trim();
    }
  }, [input.armed]);

  useEffect(() => {
    if (!input.armed || holding) return;
    const id = window.setInterval(() => {
      if (holdingRef.current) return;
      const step = advanceIleSilenceClock({
        now: Date.now(),
        lastSoundAt: lastSoundAt.current,
        lockCount: lockCountRef.current,
        minutes,
        holding: false,
        micSilent: micSilentRef.current,
        previousSpeech: heardRef.current,
        speechText: speechTextRef.current,
      });
      lastSoundAt.current = step.lastSoundAt;
      heardRef.current = step.speech;
      if (!step.holding) return;
      lockCountRef.current = step.lockCount;
      holdingRef.current = true;
      setLockCount(step.lockCount);
      setHolding(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [input.armed, holding, minutes]);

  const unlock = useCallback((challengePassed: boolean) => {
    const next = ileRestUnlock({
      challengePassed,
      lockCount: lockCountRef.current,
    });
    if (next.locked) return;
    holdingRef.current = false;
    lastSoundAt.current = Date.now();
    setHolding(false);
  }, []);

  const outcome: IleSilenceLockOutcome = holding
    ? ileSilenceLockOutcome(lockCount)
    : "continue";

  return { lockCount, outcome, unlock, minutes };
}
