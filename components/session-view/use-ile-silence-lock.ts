"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampIleSilenceLockMinutes,
  ileRestUnlock,
  ileSilenceLockOutcome,
  nextIleSilenceLock,
  type IleSilenceLockOutcome,
} from "@/lib/practice-voice-challenge";

export function useIleSilenceLock(input: {
  armed: boolean;
  speaking: boolean;
  minutes: number;
}) {
  const minutes = clampIleSilenceLockMinutes(input.minutes);
  const [lockCount, setLockCount] = useState(0);
  const [holding, setHolding] = useState(false);
  const lastSoundAt = useRef(Date.now());
  const lockCountRef = useRef(0);
  const holdingRef = useRef(false);
  const speakingRef = useRef(input.speaking);
  speakingRef.current = input.speaking;
  const wasArmed = useRef(false);

  useEffect(() => {
    if (!input.armed) {
      wasArmed.current = false;
      return;
    }
    if (holdingRef.current) return;
    if (!wasArmed.current) {
      wasArmed.current = true;
      lastSoundAt.current = Date.now();
    }
    // Only real speech restarts the quiet clock. A muted mic stays silent.
    if (input.speaking) lastSoundAt.current = Date.now();
  }, [input.armed, input.speaking]);

  useEffect(() => {
    if (!input.armed || holding) return;
    const id = window.setInterval(() => {
      if (holdingRef.current) return;
      if (speakingRef.current) {
        lastSoundAt.current = Date.now();
        return;
      }
      const step = nextIleSilenceLock({
        lockCount: lockCountRef.current,
        silenceMs: Date.now() - lastSoundAt.current,
        minutes,
        alreadyLatched: false,
      });
      if (step.lockCount === lockCountRef.current) return;
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
