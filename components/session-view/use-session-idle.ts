"use client";

import { useCallback, useEffect } from "react";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import { useTapPredictiveInterruption } from "@/lib/useTapPredictiveInterruption";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import type { ChatMessage } from "@/lib/session-chat-client";

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
    current: (interruption: ProofOfWorkApiInterruption | undefined) => void;
  };
};

export function useSessionIdle(input: SessionIdleInput) {
  const {
    activeChapterKey,
    updateChapterWorkspace,
    setHeliosTurnMode,
    handlePowInterruptionRef,
  } = input;

const { applyInterruption, clearPendingInterruption } = useTapPredictiveInterruption(
  useCallback(
    ({ message }) => {
      const chapterKey = activeChapterKey;
      updateChapterWorkspace(chapterKey, (workspace) => ({
        chatMessages: [
          ...workspace.chatMessages,
          { id: `int_${Date.now()}`, role: "assistant", content: message },
        ],
      }));
      setHeliosTurnMode("interruption");
    },
    [activeChapterKey, updateChapterWorkspace],
  ),
);

const handlePowInterruption = useCallback(
  (interruption: ProofOfWorkApiInterruption | undefined) => {
    if (interruption === undefined) return;
    applyInterruption(interruption);
  },
  [applyInterruption],
);

useEffect(() => {
  handlePowInterruptionRef.current = handlePowInterruption;
}, [handlePowInterruption, handlePowInterruptionRef]);

  return {
    handlePowInterruption,
    applyInterruption,
    clearPendingInterruption,
  };
}
