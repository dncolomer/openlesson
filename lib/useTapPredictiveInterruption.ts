"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProofOfWorkApiInterruption } from "@/lib/agent-v2/predictive-interruption";

export interface TapInterventionFirePayload {
  interruptionId: string;
  message: string;
}

export function useTapPredictiveInterruption(
  onIntervention: (payload: TapInterventionFirePayload) => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const onInterventionRef = useRef(onIntervention);

  useEffect(() => {
    onInterventionRef.current = onIntervention;
  }, [onIntervention]);

  const clearPendingInterruption = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingIdRef.current = null;
  }, []);

  const applyInterruption = useCallback(
    (interruption: ProofOfWorkApiInterruption) => {
      clearPendingInterruption();
      if (!interruption) return;

      const interruptionId = interruption.interruption_id;
      pendingIdRef.current = interruptionId;
      timerRef.current = setTimeout(() => {
        if (pendingIdRef.current !== interruptionId) return;
        onInterventionRef.current({
          interruptionId,
          message: interruption.intervention.message,
        });
        pendingIdRef.current = null;
        timerRef.current = null;
      }, interruption.delay_ms);
    },
    [clearPendingInterruption],
  );

  useEffect(() => clearPendingInterruption, [clearPendingInterruption]);

  return { applyInterruption, clearPendingInterruption };
}