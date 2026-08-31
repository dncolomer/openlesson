"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  PredictiveInterruption,
  ProofOfWorkApiInterruption,
} from "@/lib/pow-api/predictive-interruption";
import { useTapPredictiveInterruption } from "@/lib/useTapPredictiveInterruption";
import {
  applyIleHeliosAutoFire,
  ileHeliosTriggerKindFromPowOrigin,
  type IleHeliosPowOrigin,
  type IleHeliosTriggerKind,
} from "@/lib/ile-helios-trigger";
import {
  createIleMapInterruptionScheduler,
  isChapterMapExpandInterruption,
} from "@/lib/ile-tim-chapter-complete";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import type { ChatMessage } from "@/lib/session-chat-client";

export type IlePowInterruptionHandler = (
  interruption: ProofOfWorkApiInterruption | undefined,
  origin?: IleHeliosPowOrigin,
) => void;

export type SessionIdleInput = {
  activeChapterKey: string;
  updateChapterWorkspace: (
    key: string,
    update:
      | Partial<{ chatMessages: ChatMessage[] }>
      | ((workspace: { chatMessages: ChatMessage[] }) => Partial<{ chatMessages: ChatMessage[] }>),
  ) => void;
  setHeliosTurnMode: (mode: HeliosTurnMode) => void;
  handlePowInterruptionRef: {
    current: IlePowInterruptionHandler;
  };
  onChapterMapExpand?: (interruption: PredictiveInterruption) => void;
};

export function useSessionIdle(input: SessionIdleInput) {
  const {
    activeChapterKey,
    updateChapterWorkspace,
    setHeliosTurnMode,
    handlePowInterruptionRef,
    onChapterMapExpand,
  } = input;

  const pendingKindRef = useRef<Exclude<IleHeliosTriggerKind, "user_send">>("interruption");
  const onChapterMapExpandRef = useRef(onChapterMapExpand);
  onChapterMapExpandRef.current = onChapterMapExpand;

  const mapSchedulerRef = useRef(
    createIleMapInterruptionScheduler((interruption) => {
      onChapterMapExpandRef.current?.(interruption);
    }),
  );

const { applyInterruption, clearPendingInterruption } = useTapPredictiveInterruption(
  useCallback(
    ({ message }) => {
      const fired = applyIleHeliosAutoFire({ kind: pendingKindRef.current });
      if (!fired.applied) return;
      const chapterKey = activeChapterKey;
      updateChapterWorkspace(chapterKey, (workspace) => ({
        chatMessages: [
          ...workspace.chatMessages,
          { id: `int_${Date.now()}`, role: "assistant", content: message },
        ],
      }));
      setHeliosTurnMode("interruption");
    },
    [activeChapterKey, updateChapterWorkspace, setHeliosTurnMode],
  ),
);

const handlePowInterruption = useCallback<IlePowInterruptionHandler>(
  (interruption, origin = "other") => {
    if (interruption === undefined) return;
    if (isChapterMapExpandInterruption(interruption)) {
      mapSchedulerRef.current.apply(interruption);
      return;
    }
    pendingKindRef.current = ileHeliosTriggerKindFromPowOrigin(origin);
    applyInterruption(interruption, { origin });
  },
  [applyInterruption],
);

useEffect(() => {
  handlePowInterruptionRef.current = handlePowInterruption;
}, [handlePowInterruption, handlePowInterruptionRef]);

useEffect(() => () => mapSchedulerRef.current.clear(), []);

  return {
    handlePowInterruption,
    applyInterruption,
    clearPendingInterruption,
  };
}
