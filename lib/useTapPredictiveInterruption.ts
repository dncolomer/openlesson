"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import {
  shouldSkipSilenceInterruptionWhileFormingThought,
  type FormingThoughtState,
  type TapInterruptionOrigin,
} from "@/lib/tap-interruption-gate";

export interface TapInterventionFirePayload {
  interruptionId: string;
  message: string;
}

export type ApplyInterruptionOptions = {
  /** Defaults to "other" (chat/trace — not silence-gated). */
  origin?: TapInterruptionOrigin;
};

export type GetFormingThoughtState = () => FormingThoughtState;

/**
 * Pure scheduling core (exported for unit tests) — mirrors hook fire/skip rules.
 */
export function createTapInterruptionScheduler(
  onIntervention: (payload: TapInterventionFirePayload) => void,
  getFormingThought: GetFormingThoughtState = () => ({
    hasPendingTranscription: false,
    isTranscriptionActive: false,
  }),
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingId: string | null = null;
  let pendingOrigin: TapInterruptionOrigin = "other";

  const clearPending = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingId = null;
    pendingOrigin = "other";
  };

  const applyInterruption = (
    interruption: ProofOfWorkApiInterruption,
    options: ApplyInterruptionOptions = {},
  ) => {
    const origin = options.origin ?? "other";

    // Explicit null supersedes any pending timer (TIM contract).
    if (!interruption) {
      clearPending();
      return;
    }

    const forming = getFormingThought();
    // Skipped silence-origin recs must not wipe a pending chat/send timer.
    if (
      shouldSkipSilenceInterruptionWhileFormingThought({
        origin,
        hasPendingTranscription: forming.hasPendingTranscription,
        isTranscriptionActive: forming.isTranscriptionActive,
      })
    ) {
      return;
    }

    // Only clear previous when we are actually scheduling a new intervention.
    clearPending();
    const interruptionId = interruption.interruption_id;
    pendingId = interruptionId;
    pendingOrigin = origin;
    timer = setTimeout(() => {
      if (pendingId !== interruptionId) return;
      const formingAtFire = getFormingThought();
      if (
        shouldSkipSilenceInterruptionWhileFormingThought({
          origin: pendingOrigin,
          hasPendingTranscription: formingAtFire.hasPendingTranscription,
          isTranscriptionActive: formingAtFire.isTranscriptionActive,
        })
      ) {
        pendingId = null;
        timer = null;
        pendingOrigin = "other";
        return;
      }
      onIntervention({
        interruptionId,
        message: interruption.intervention.message,
      });
      pendingId = null;
      timer = null;
      pendingOrigin = "other";
    }, interruption.delay_ms);
  };

  /** Drop a pending timer only if it was silence-originated (idle/speech). */
  const clearPendingSilenceInterruption = () => {
    if (pendingOrigin === "idle" || pendingOrigin === "speech") {
      clearPending();
    }
  };

  return {
    applyInterruption,
    clearPendingInterruption: clearPending,
    clearPendingSilenceInterruption,
  };
}

export function useTapPredictiveInterruption(
  onIntervention: (payload: TapInterventionFirePayload) => void,
  getFormingThought?: GetFormingThoughtState,
) {
  const onInterventionRef = useRef(onIntervention);
  const getFormingThoughtRef = useRef<GetFormingThoughtState>(
    getFormingThought ??
      (() => ({
        hasPendingTranscription: false,
        isTranscriptionActive: false,
      })),
  );
  const schedulerRef = useRef(
    createTapInterruptionScheduler(
      (payload) => onInterventionRef.current(payload),
      () => getFormingThoughtRef.current(),
    ),
  );

  useEffect(() => {
    onInterventionRef.current = onIntervention;
  }, [onIntervention]);

  useEffect(() => {
    getFormingThoughtRef.current =
      getFormingThought ??
      (() => ({
        hasPendingTranscription: false,
        isTranscriptionActive: false,
      }));
  }, [getFormingThought]);

  const clearPendingInterruption = useCallback(() => {
    schedulerRef.current.clearPendingInterruption();
  }, []);

  const clearPendingSilenceInterruption = useCallback(() => {
    schedulerRef.current.clearPendingSilenceInterruption();
  }, []);

  const applyInterruption = useCallback(
    (interruption: ProofOfWorkApiInterruption, options?: ApplyInterruptionOptions) => {
      schedulerRef.current.applyInterruption(interruption, options);
    },
    [],
  );

  useEffect(() => clearPendingInterruption, [clearPendingInterruption]);

  return {
    applyInterruption,
    clearPendingInterruption,
    clearPendingSilenceInterruption,
  };
}
