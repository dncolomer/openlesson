"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  applyIleProjectThoughtMutation,
  emptyIleProjectDualLists,
  type ExerciseDualLists,
} from "@/lib/ile-mode";
import {
  buildIleThoughtTracePayload,
  ILE_TRACE_TOOL_NAME,
  type IleSystem1Action,
  type IleSystem2Action,
} from "@/lib/ile-thought-traces";
import {
  uploadIleProofOfWork,
  textToBase64,
} from "@/lib/ile-proof-of-work-client";
import { ILE_POW_API_PATHS } from "@/lib/session-pow-api-paths";
import type { Session, SessionPlanStep, ToolAction, ToolName } from "@/lib/storage";
import { toSpeechBcp47, type SpokenLocale } from "@/lib/tutoring-languages";
import {
  useSessionThoughtInterface,
  type SessionThoughtTracePayload,
} from "@/lib/useSessionThoughtInterface";
import { useTapSpeechProofOfWork } from "@/lib/useTapSpeechProofOfWork";
import { useTapIdleProofOfWork } from "@/lib/useTapIdleProofOfWork";
import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import type { TransferHealth } from "@/components/LogsTool";

export type SessionSpeechInput = {
  powSessionEnabled: boolean;
  ilePowContext: {
    workspaceId?: string;
    sessionId: string | null;
    privateToken?: string;
    blockId?: string;
    entryQueryParams?: Record<string, string | string[]>;
  };
  handlePowInterruption: (interruption: ProofOfWorkApiInterruption | undefined) => void;
  getWorkspaceId: () => string | undefined;
  sessionRef: { current: Session | null };
  sessionId: string | undefined;
  ileToken?: string;
  entryQueryParams?: Record<string, string | string[]>;
  recordTransferEvent: (channel: keyof TransferHealth, saved: boolean, error?: string) => void;
  tutoringLanguage: SpokenLocale;
  isProjectMode: boolean;
  chapterThoughtsLocked: boolean;
  activeStep: SessionPlanStep | undefined;
  activeChapterKey: string;
  projectThoughtsByChapterRef: { current: Record<string, ExerciseDualLists> };
  setProjectThoughtsByChapter: (
    next: Record<string, ExerciseDualLists> | ((prev: Record<string, ExerciseDualLists>) => Record<string, ExerciseDualLists>),
  ) => void;
  setHeliosTurnMode: (mode: HeliosTurnMode) => void;
  flushRemainingIlePow: (options?: { force?: boolean }) => Promise<void>;
  submitHeliosChatMessageNow: (message: string, imageDataUrl?: string) => Promise<void>;
  bumpUserActivityRef: { current: () => void };
  clearPendingInterruption: () => void;
  chapterWorkspaces: Record<string, {
    notebookContent: string;
    whiteboardData: string | null;
  }>;
  activeWorkspace: {
    notebookContent: string;
    whiteboardData: string | null;
  };
  updateChapterWorkspace: (key: string, update: Record<string, unknown>) => void;
  whiteboardDataRef: { current: string | null };
  notebookContentRef: { current: string };
  logTool: (toolName: ToolName, action: ToolAction, metadata?: Record<string, unknown>) => Promise<void> | void;
};

export function useSessionSpeech(input: SessionSpeechInput) {
  const {
    powSessionEnabled,
    ilePowContext,
    handlePowInterruption,
    getWorkspaceId,
    sessionRef,
    sessionId,
    ileToken,
    entryQueryParams,
    recordTransferEvent,
    tutoringLanguage,
    isProjectMode,
    chapterThoughtsLocked,
    activeStep,
    activeChapterKey,
    projectThoughtsByChapterRef,
    setProjectThoughtsByChapter,
    setHeliosTurnMode,
    flushRemainingIlePow,
    submitHeliosChatMessageNow,
    bumpUserActivityRef,
    clearPendingInterruption,
    chapterWorkspaces,
    activeWorkspace,
    updateChapterWorkspace,
    whiteboardDataRef,
    notebookContentRef,
    logTool,
  } = input;

  const notifySpeechResultRef = useRef<(text: string) => void>(() => {});

const {
  isTranscriptionActive,
  notifySpeechResult,
  flushSpeechSegment,
  resetSpeechTracking,
} = useTapSpeechProofOfWork(
  powSessionEnabled,
  ilePowContext,
  handlePowInterruption,
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
      tool_action: `${payload.traceType}:${payload.action}`,
      metadata: {
        trace_type: payload.traceType,
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
      handlePowInterruption(result.interruption);
    }
  },
  [getWorkspaceId, recordTransferEvent, handlePowInterruption, ileToken, entryQueryParams],
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
  enabled: powSessionEnabled && !(isProjectMode && chapterThoughtsLocked),
  speechLang: sessionSpeechLang,
  sessionId,
  onLogTrace: (payload) => {
    logSessionThoughtTrace(payload);
  },
  onSpeechTranscript: (text) => notifySpeechResultRef.current(text),
  onUserActivity: () => bumpUserActivityRef.current(),
  onSendToProbe: async (text) => {
    setHeliosTurnMode("idle");
    await flushRemainingIlePow();
    await submitHeliosChatMessageNow(text);
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
    handlePowInterruption,
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
    if (!powSessionEnabled) {
      clearPendingInterruption();
      flushSpeechSegment();
      resetIdleTracking();
      resetSpeechTracking();
      setHeliosTurnMode("idle");
    }
  }, [
    powSessionEnabled,
    clearPendingInterruption,
    flushSpeechSegment,
    resetIdleTracking,
    resetSpeechTracking,
    setHeliosTurnMode,
  ]);

const sessionThoughtHistory = useMemo(
  () => sessionThoughtInterface.thoughts.slice().reverse(),
  [sessionThoughtInterface.thoughts],
);

const handleSubmitToHelios = useCallback(
  async (toolName: "canvas" | "notebook", canvasDataUrl?: string | null) => {
    const targetChapterKey = activeChapterKey;
    const targetWorkspace = chapterWorkspaces[targetChapterKey] ?? activeWorkspace;
    const targetNotebookContent = targetWorkspace.notebookContent;
    const targetCanvasData = canvasDataUrl || targetWorkspace.whiteboardData || null;
    if (toolName === "canvas" && canvasDataUrl) {
      whiteboardDataRef.current = canvasDataUrl;
      updateChapterWorkspace(targetChapterKey, { whiteboardData: canvasDataUrl });
    } else if (toolName === "canvas") {
      whiteboardDataRef.current = targetCanvasData;
    } else {
      notebookContentRef.current = targetNotebookContent;
    }

    // Project Mode: no Helios chat — notebook/canvas submit becomes a Solution stack card.
    if (isProjectMode) {
      if (chapterThoughtsLocked) return;

      let solutionText = "";
      if (toolName === "notebook") {
        const content = targetNotebookContent.trim();
        if (!content) return;
        solutionText =
          content.length > 1800
            ? `Notebook notes:\n${content.slice(0, 1800)}…`
            : `Notebook notes:\n${content}`;
        updateChapterWorkspace(targetChapterKey, { notebookDirtyForHelios: false });
      } else {
        if (!targetCanvasData) return;
        // Keep a compact marker (full PNG lives in chapter workspace / PoW).
        solutionText = `Canvas diagram submitted (${new Date().toLocaleString()})`;
        updateChapterWorkspace(targetChapterKey, { canvasDirtyForHelios: false });
      }

      void logTool(toolName, "submit_to_solution", {
        ...(toolName === "notebook"
          ? { contentLength: targetNotebookContent.length }
          : { hasCanvas: true }),
        session_mode: "project",
      });

      mutateActiveProjectThoughts({ type: "submit_direct", text: solutionText });

      try {
        await flushRemainingIlePow();
      } catch (err) {
        console.warn("[SubmitToSolution] pow flush failed:", err);
      }
      return;
    }

    const metadata: Record<string, unknown> = {};
    if (toolName === "notebook") {
      metadata.contentLength = targetNotebookContent.length;
    } else {
      metadata.hasCanvas = !!targetCanvasData;
    }
    void logTool(toolName, "submit_to_helios", metadata);

    try {
      await flushRemainingIlePow();
    } catch (err) {
      console.warn("[SubmitToHelios] pow flush failed:", err);
    }

    if (toolName === "canvas") {
      updateChapterWorkspace(targetChapterKey, { canvasDirtyForHelios: false });
      const imageDataUrl = targetCanvasData || undefined;
      void submitHeliosChatMessageNow(
        "Here is my current canvas. Help me reason through what I have drawn without just giving me the answer.",
        imageDataUrl,
      );
    } else {
      updateChapterWorkspace(targetChapterKey, { notebookDirtyForHelios: false });
      const content = targetNotebookContent.trim();
      if (content) {
        void submitHeliosChatMessageNow(
          `Here are my notebook notes. Help me reason through them without just giving me the answer:\n\n${content}`,
        );
      }
    }
  },
  [
    isProjectMode,
    chapterThoughtsLocked,
    activeChapterKey,
    activeWorkspace,
    chapterWorkspaces,
    logTool,
    flushRemainingIlePow,
    submitHeliosChatMessageNow,
    updateChapterWorkspace,
    mutateActiveProjectThoughts,
  ],
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
    handleSubmitToHelios,
  };
}
