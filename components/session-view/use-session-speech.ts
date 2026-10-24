"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  applyIleProjectThoughtMutation,
  emptyIleProjectDualLists,
  type ExerciseDualLists,
} from "@/lib/learn-mode";
import {
  buildIleThoughtTracePayload,
  ileTabUnfocusPowFromFocusEvent,
  ILE_TAB_UNFOCUS_TOOL_ACTION,
  ILE_TAB_UNFOCUS_TOOL_NAME,
  ILE_TRACE_TOOL_NAME,
  type IleSystem1Action,
  type IleSystem2Action,
} from "@/lib/learn-thought-traces";
import { storedTraceFamily, storedTraceToolAction } from "@/lib/pow-trace-family";
import {
  uploadIleProofOfWork,
  textToBase64,
} from "@/lib/learn-proof-of-work-client";
import { ILE_POW_API_PATHS } from "@/lib/session-pow-api-paths";
import type { Session, SessionPlanStep } from "@/lib/storage";
import { toSpeechBcp47, type SpokenLocale } from "@/lib/tutoring-languages";
import {
  useSessionThoughtInterface,
  type SessionThoughtTracePayload,
} from "@/lib/useSessionThoughtInterface";
import { useTapSpeechProofOfWork } from "@/lib/useTapSpeechProofOfWork";
import { useTapIdleProofOfWork } from "@/lib/useTapIdleProofOfWork";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import type { IlePowInterruptionHandler } from "@/components/session-view/use-session-idle";
import type { TransferHealth } from "@/components/session/sessionViewHelpers";
import type { IlePowCounterArtifact } from "@/lib/learn-pow-counters";

export type SessionSpeechInput = {
  powSessionEnabled: boolean;
  micMuted?: boolean;
  ilePowContext: {
    workspaceId?: string;
    sessionId: string | null;
    privateToken?: string;
    blockId?: string;
    entryQueryParams?: Record<string, string | string[]>;
  };
  handlePowInterruption: IlePowInterruptionHandler;
  getWorkspaceId: () => string | undefined;
  sessionRef: { current: Session | null };
  sessionId: string | undefined;
  ileToken?: string;
  entryQueryParams?: Record<string, string | string[]>;
  recordTransferEvent: (channel: keyof TransferHealth, saved: boolean, error?: string) => void;
  recordSessionPowArtifact?: (artifact: IlePowCounterArtifact) => void;
  tutoringLanguage: SpokenLocale;
  isProjectMode: boolean;
  chapterThoughtsLocked: boolean;
  activeStep: SessionPlanStep | undefined;
  activeChapterKey: string;
  projectThoughtsByChapterRef: { current: Record<string, ExerciseDualLists> };
  setProjectThoughtsByChapter: (
    next: Record<string, ExerciseDualLists> | ((prev: Record<string, ExerciseDualLists>) => Record<string, ExerciseDualLists>),
  ) => void;
  flushRemainingIlePow: (options?: { force?: boolean }) => Promise<void>;
  bumpUserActivityRef: { current: () => void };
  clearPendingInterruption: () => void;
};

export function useSessionSpeech(input: SessionSpeechInput) {
  const {
    powSessionEnabled,
    micMuted = false,
    ilePowContext,
    handlePowInterruption,
    getWorkspaceId,
    sessionRef,
    sessionId,
    ileToken,
    entryQueryParams,
    recordTransferEvent,
    recordSessionPowArtifact,
    tutoringLanguage,
    isProjectMode,
    chapterThoughtsLocked,
    activeStep,
    activeChapterKey,
    projectThoughtsByChapterRef,
    setProjectThoughtsByChapter,
    flushRemainingIlePow,
    bumpUserActivityRef,
    clearPendingInterruption,
  } = input;

  const notifySpeechResultRef = useRef<(text: string) => void>(() => {});

const handleIdleInterruption = useCallback(
  (interruption: ProofOfWorkApiInterruption) => {
    handlePowInterruption(interruption, "idle");
  },
  [handlePowInterruption],
);

const handleSpeechInterruption = useCallback(
  (interruption: ProofOfWorkApiInterruption) => {
    handlePowInterruption(interruption, "speech");
  },
  [handlePowInterruption],
);

const {
  isTranscriptionActive,
  notifySpeechResult,
  flushSpeechSegment,
  resetSpeechTracking,
} = useTapSpeechProofOfWork(
  powSessionEnabled,
  ilePowContext,
  handleSpeechInterruption,
  ILE_POW_API_PATHS.speech,
);

useEffect(() => {
  notifySpeechResultRef.current = notifySpeechResult;
}, [notifySpeechResult]);

const uploadIleThoughtTrace = useCallback(
  async (payload: SessionThoughtTracePayload) => {
    const workspaceId = getWorkspaceId();
    const currentSession = sessionRef.current;
    if (!workspaceId || !currentSession) return;

    const tracePayload = buildIleThoughtTracePayload({
      traceType: payload.traceType,
      action: payload.action as IleSystem1Action | IleSystem2Action,
      sessionId: currentSession.id,
      workspaceId,
      thoughtId: payload.thoughtId,
      thoughtIds: payload.thoughtIds,
      chainId: payload.chainId,
      text: payload.text,
      originalText: payload.originalText,
      combined: payload.combined,
      timestampMs: payload.timestampMs,
    });

    const fileName = `ile-trace-${payload.traceType}-${payload.action}-${payload.thoughtId || Date.now()}.json`;
    const result = await uploadIleProofOfWork({
      workspaceId,
      sessionId: currentSession.id,
      type: "tool",
      mime_type: "application/json",
      data: textToBase64(JSON.stringify(tracePayload, null, 2)),
      file_name: fileName,
      timestamp_ms: payload.timestampMs ?? Date.now(),
      tool_name: ILE_TRACE_TOOL_NAME,
      tool_action: storedTraceToolAction(payload.traceType, payload.action),
      metadata: {
        trace_type: storedTraceFamily(payload.traceType),
        action: payload.action,
        thought_id: payload.thoughtId ?? null,
        thought_ids: payload.thoughtIds ?? null,
        chain_id: payload.chainId ?? null,
        text: payload.text ?? null,
        original_text: payload.originalText ?? null,
        combined: payload.combined ?? false,
      },
      ...(ileToken ? { ileToken } : {}),
      ...(entryQueryParams && Object.keys(entryQueryParams).length > 0
        ? { entryQueryParams }
        : {}),
    });
    recordTransferEvent("tools", result.ok, result.error);
    if (result.ok) {
      recordSessionPowArtifact?.({
        type: "tool",
        tool_name: ILE_TRACE_TOOL_NAME,
        tool_action: storedTraceToolAction(payload.traceType, payload.action),
        metadata: {
          type: "uncertain_systems_thought_trace",
          trace_type: storedTraceFamily(payload.traceType),
          action: payload.action,
        },
      });
      handlePowInterruption(result.interruption);
    }
  },
  [getWorkspaceId, recordTransferEvent, recordSessionPowArtifact, handlePowInterruption, ileToken, entryQueryParams],
);

const logSessionThoughtTrace = useCallback(
  (payload: SessionThoughtTracePayload) => {
    void uploadIleThoughtTrace(payload);
  },
  [uploadIleThoughtTrace],
);

const sessionSpeechLang = toSpeechBcp47(tutoringLanguage);

const logProjectThoughtTrace = useCallback(
  (
    traceType: "system1" | "system2",
    action: IleSystem1Action | IleSystem2Action,
    thought: { id: string; text: string; chainId: string; timestamp: number },
  ) => {
    void logSessionThoughtTrace({
      traceType,
      action,
      thoughtId: thought.id,
      chainId: thought.chainId,
      text: thought.text,
      timestampMs: thought.timestamp,
    });
  },
  [logSessionThoughtTrace],
);

const mutateActiveProjectThoughts = useCallback(
  (mutation: Parameters<typeof applyIleProjectThoughtMutation>[2]) => {
    const chapterId = activeStep?.id ?? activeChapterKey ?? "default";
    const status = activeStep?.status;
    const current =
      projectThoughtsByChapterRef.current[chapterId] ?? emptyIleProjectDualLists();
    const result = applyIleProjectThoughtMutation(current, status, mutation);
    if (result.rejected === "chapter_locked" || result.rejected === "invalid") {
      return result;
    }
    setProjectThoughtsByChapter((prev) => ({
      ...prev,
      [chapterId]: result.lists,
    }));
    if (result.thought) {
      if (mutation.type === "stash") {
        logProjectThoughtTrace(
          "system1",
          mutation.auto ? "auto_stash" : "pause_finalize",
          result.thought,
        );
      } else if (mutation.type === "demote") {
        logProjectThoughtTrace("system2", "remove", result.thought);
      } else {
        logProjectThoughtTrace("system2", "send", result.thought);
      }
    }
    return result;
  },
  [activeStep?.id, activeStep?.status, activeChapterKey, logProjectThoughtTrace],
);

const sessionThoughtInterface = useSessionThoughtInterface({
  enabled: powSessionEnabled && !micMuted && !(isProjectMode && chapterThoughtsLocked),
  speechLang: sessionSpeechLang,
  sessionId,
  getActiveChapterId: () => activeStep?.id ?? activeChapterKey ?? null,
  onLogTrace: (payload) => {
    logSessionThoughtTrace(payload);
  },
  onSpeechTranscript: (text) => notifySpeechResultRef.current(text),
  onUserActivity: () => bumpUserActivityRef.current(),
  onSendToProbe: async () => {
    await flushRemainingIlePow();
  },
});

const handleProjectStash = useCallback((providedText?: string) => {
  if (chapterThoughtsLocked) return;
  const text = (
    providedText ||
    sessionThoughtInterface.getFormingText?.() ||
    sessionThoughtInterface.crystallizableText ||
    ""
  ).trim();
  if (!text) return;
  sessionThoughtInterface.clearCurrentTranscription();
  mutateActiveProjectThoughts({ type: "stash", text });
}, [
  chapterThoughtsLocked,
  sessionThoughtInterface,
  mutateActiveProjectThoughts,
]);

const handleProjectSubmitToSolution = useCallback(() => {
  if (chapterThoughtsLocked) return;
  const text = (
    sessionThoughtInterface.getFormingText?.() ||
    sessionThoughtInterface.crystallizableText ||
    ""
  ).trim();
  if (!text) return;
  sessionThoughtInterface.clearCurrentTranscription();
  mutateActiveProjectThoughts({ type: "submit_direct", text });
}, [
  chapterThoughtsLocked,
  sessionThoughtInterface,
  mutateActiveProjectThoughts,
]);

const handleProjectPromote = useCallback(
  (thoughtId: string) => {
    mutateActiveProjectThoughts({ type: "promote", thoughtId });
  },
  [mutateActiveProjectThoughts],
);

const handleProjectDemote = useCallback(
  (thoughtId: string) => {
    mutateActiveProjectThoughts({ type: "demote", thoughtId });
  },
  [mutateActiveProjectThoughts],
);

  const { bumpUserActivity, resetIdleTracking } = useTapIdleProofOfWork(
    powSessionEnabled,
    ilePowContext,
    handleIdleInterruption,
    {
      speechText: sessionThoughtInterface.crystallizableText,
      isTranscriptionActive,
    },
    ILE_POW_API_PATHS.idle,
  );

  useEffect(() => {
    bumpUserActivityRef.current = bumpUserActivity;
  }, [bumpUserActivity, bumpUserActivityRef]);

  useEffect(() => {
    if (!powSessionEnabled) return;
    let lastSentAt = 0;
    const sendUnfocus = (type: "visibilitychange" | "blur") => {
      const event = ileTabUnfocusPowFromFocusEvent({
        type,
        hidden: typeof document !== "undefined" ? document.hidden : true,
        sessionId: ilePowContext.sessionId ?? sessionId ?? "",
        workspaceId: ilePowContext.workspaceId ?? getWorkspaceId() ?? "",
        blockId: ilePowContext.blockId ?? null,
      });
      if (!event) return;
      const now = Date.now();
      if (now - lastSentAt < 2_000) return;
      lastSentAt = now;
      const workspaceId = ilePowContext.workspaceId ?? getWorkspaceId();
      const liveSessionId = ilePowContext.sessionId ?? sessionId;
      if (!workspaceId || !liveSessionId) return;
      void uploadIleProofOfWork({
        workspaceId,
        sessionId: liveSessionId,
        type: "tool",
        mime_type: "application/json",
        data: textToBase64(JSON.stringify(event.payload)),
        file_name: `ile-tab-unfocus-${now}.json`,
        timestamp_ms: now,
        tool_name: ILE_TAB_UNFOCUS_TOOL_NAME,
        tool_action: ILE_TAB_UNFOCUS_TOOL_ACTION,
        metadata: { reason: event.reason, action: ILE_TAB_UNFOCUS_TOOL_ACTION },
        ileToken,
        entryQueryParams,
      }).then((result) => {
        if (result.interruption) handlePowInterruption(result.interruption, "other");
      });
    };
    const onVisibility = () => sendUnfocus("visibilitychange");
    const onBlur = () => sendUnfocus("blur");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    powSessionEnabled,
    ilePowContext.sessionId,
    ilePowContext.workspaceId,
    ilePowContext.blockId,
    sessionId,
    getWorkspaceId,
    ileToken,
    entryQueryParams,
    handlePowInterruption,
  ]);

  useEffect(() => {
    if (!powSessionEnabled) {
      clearPendingInterruption();
      flushSpeechSegment();
      resetIdleTracking();
      resetSpeechTracking();
    }
  }, [
    powSessionEnabled,
    clearPendingInterruption,
    flushSpeechSegment,
    resetIdleTracking,
    resetSpeechTracking,
  ]);

const sessionThoughtHistory = useMemo(
  () => sessionThoughtInterface.thoughts.slice().reverse(),
  [sessionThoughtInterface.thoughts],
);

  return {
    isTranscriptionActive,
    notifySpeechResult,
    flushSpeechSegment,
    resetSpeechTracking,
    notifySpeechResultRef,
    sessionThoughtInterface,
    sessionThoughtHistory,
    handleProjectStash,
    handleProjectSubmitToSolution,
    handleProjectPromote,
    handleProjectDemote,
    mutateActiveProjectThoughts,
    logSessionThoughtTrace,
  };
}
