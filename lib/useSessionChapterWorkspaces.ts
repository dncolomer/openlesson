"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ChatMessage, PendingChatMessage } from "@/components/HeliosChat";
import type { SessionPlan } from "@/lib/domain/types";
import type { ChapterWorkspace } from "@/components/session/sessionViewHelpers";
import {
  applyIleSessionContextWrite,
  createIleSessionContext,
  ileLegacyChapterWorkspacesStorageKey,
  ileSessionContextStorageKey,
  parseIleSessionContextStored,
  type IleSessionContext,
} from "@/lib/ile-session-global-context";

export function useSessionChapterWorkspaces(
  sessionId: string,
  sessionPlan: SessionPlan | null
) {
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const activeChapterIndexRef = useRef(0);
  const planInitializedRef = useRef(false);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterLoadingIndex, setChapterLoadingIndex] = useState<number | null>(null);
  const chapterFocusSinceRef = useRef<Record<number, number>>({ 0: Date.now() });
  const [sessionContext, setSessionContext] = useState<IleSessionContext>(createIleSessionContext);
  const [chapterWorkspacesLoaded, setChapterWorkspacesLoaded] = useState(false);

  useEffect(() => {
    setActiveChapterIndex(0);
    activeChapterIndexRef.current = 0;
    planInitializedRef.current = false;
    chapterFocusSinceRef.current = { 0: Date.now() };
    setSessionContext(createIleSessionContext());
    setChapterWorkspacesLoaded(false);
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored =
        window.sessionStorage.getItem(ileSessionContextStorageKey(sessionId)) ||
        window.sessionStorage.getItem(ileLegacyChapterWorkspacesStorageKey(sessionId));
      const parsed = parseIleSessionContextStored(stored);
      if (parsed) setSessionContext(parsed);
    } catch {
      /* Ignore corrupt local workspace snapshots. */
    } finally {
      setChapterWorkspacesLoaded(true);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!chapterWorkspacesLoaded) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        ileSessionContextStorageKey(sessionId),
        JSON.stringify(sessionContext),
      );
    } catch {
      /* Session storage can fail on quota, especially with canvas data. */
    }
  }, [sessionContext, chapterWorkspacesLoaded, sessionId]);

  useEffect(() => {
    if (!sessionPlan?.steps?.length || planInitializedRef.current) return;
    const idx = Math.min(
      Math.max(0, sessionPlan.currentStepIndex ?? 0),
      sessionPlan.steps.length - 1
    );
    setActiveChapterIndex(idx);
    activeChapterIndexRef.current = idx;
    planInitializedRef.current = true;
  }, [sessionPlan]);

  useEffect(() => {
    if (!sessionPlan?.steps?.length) return;
    if (activeChapterIndex > sessionPlan.steps.length - 1) {
      setActiveChapterIndex(sessionPlan.steps.length - 1);
    }
  }, [activeChapterIndex, sessionPlan?.steps?.length]);

  const activeStep = sessionPlan?.steps?.[activeChapterIndex];
  const activeChapterKey = activeStep?.id ?? `step-${activeChapterIndex}`;
  const activeWorkspace = sessionContext;

  const updateChapterWorkspace = useCallback(
    (
      chapterKey: string,
      update:
        | Partial<ChapterWorkspace>
        | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>)
    ) => {
      setSessionContext((prev) => applyIleSessionContextWrite(prev, chapterKey, update));
    },
    []
  );

  const updateActiveChapterWorkspace = useCallback(
    (
      update:
        | Partial<ChapterWorkspace>
        | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>)
    ) => {
      updateChapterWorkspace(activeChapterKey, update);
    },
    [activeChapterKey, updateChapterWorkspace]
  );

  const setChatMessages = useCallback(
    (value: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => {
      updateActiveChapterWorkspace((workspace) => ({
        chatMessages: typeof value === "function" ? value(workspace.chatMessages) : value,
      }));
    },
    [updateActiveChapterWorkspace]
  );

  const setPendingChatMessage = useCallback(
    (value: string | PendingChatMessage | null) => {
      updateActiveChapterWorkspace({ pendingChatMessage: value });
    },
    [updateActiveChapterWorkspace]
  );

  const setWhiteboardData = useCallback(
    (value: string | null) => {
      updateActiveChapterWorkspace({ whiteboardData: value });
    },
    [updateActiveChapterWorkspace]
  );

  const setNotebookContent = useCallback(
    (value: string) => {
      updateActiveChapterWorkspace({ notebookContent: value });
    },
    [updateActiveChapterWorkspace]
  );

  const setCanvasDirtyForHelios = useCallback(
    (value: boolean) => {
      updateActiveChapterWorkspace({ canvasDirtyForHelios: value });
    },
    [updateActiveChapterWorkspace]
  );

  const setNotebookDirtyForHelios = useCallback(
    (value: boolean) => {
      updateActiveChapterWorkspace({ notebookDirtyForHelios: value });
    },
    [updateActiveChapterWorkspace]
  );

  const chapterWorkspaces = useMemo(
    (): Record<string, ChapterWorkspace> => ({ [activeChapterKey]: sessionContext }),
    [activeChapterKey, sessionContext],
  );

  const setChapterWorkspaces = useCallback(
    (
      value:
        | Record<string, ChapterWorkspace>
        | ((prev: Record<string, ChapterWorkspace>) => Record<string, ChapterWorkspace>),
    ) => {
      setSessionContext((prev) => {
        const asRecord = { [activeChapterKey]: prev };
        const next = typeof value === "function" ? value(asRecord) : value;
        const first = Object.values(next)[0];
        return first ?? prev;
      });
    },
    [activeChapterKey],
  );

  return {
    activeChapterIndex,
    setActiveChapterIndex,
    activeChapterIndexRef,
    planInitializedRef,
    chapterLoading,
    setChapterLoading,
    chapterLoadingIndex,
    setChapterLoadingIndex,
    chapterFocusSinceRef,
    chapterWorkspaces,
    setChapterWorkspaces,
    chapterWorkspacesLoaded,
    activeStep,
    activeChapterKey,
    activeWorkspace,
    chatMessages: activeWorkspace.chatMessages,
    pendingChatMessage: activeWorkspace.pendingChatMessage,
    whiteboardData: activeWorkspace.whiteboardData,
    whiteboardSceneData: activeWorkspace.whiteboardSceneData,
    notebookContent: activeWorkspace.notebookContent,
    canvasDirtyForHelios: activeWorkspace.canvasDirtyForHelios,
    notebookDirtyForHelios: activeWorkspace.notebookDirtyForHelios,
    updateChapterWorkspace,
    updateActiveChapterWorkspace,
    setChatMessages,
    setPendingChatMessage,
    setWhiteboardData,
    setNotebookContent,
    setCanvasDirtyForHelios,
    setNotebookDirtyForHelios,
    sessionContext,
  };
}
