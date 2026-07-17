"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { ChatMessage, PendingChatMessage } from "@/components/HeliosChat";
import type { SessionPlan } from "@/lib/domain/types";
import {
  createChapterWorkspace,
  type ChapterWorkspace,
} from "@/components/session/sessionViewHelpers";

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
  const [chapterWorkspaces, setChapterWorkspaces] = useState<Record<string, ChapterWorkspace>>({});
  const [chapterWorkspacesLoaded, setChapterWorkspacesLoaded] = useState(false);

  useEffect(() => {
    setActiveChapterIndex(0);
    activeChapterIndexRef.current = 0;
    planInitializedRef.current = false;
    chapterFocusSinceRef.current = { 0: Date.now() };
    setChapterWorkspaces({});
    setChapterWorkspacesLoaded(false);
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(`uncertain-systems:${sessionId}:chapter-workspaces`);
      if (stored) setChapterWorkspaces(JSON.parse(stored));
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
        `uncertain-systems:${sessionId}:chapter-workspaces`,
        JSON.stringify(chapterWorkspaces)
      );
    } catch {
      /* Session storage can fail on quota, especially with canvas data. */
    }
  }, [chapterWorkspaces, chapterWorkspacesLoaded, sessionId]);

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
  const activeWorkspace = chapterWorkspaces[activeChapterKey] ?? createChapterWorkspace();

  const updateChapterWorkspace = useCallback(
    (
      chapterKey: string,
      update:
        | Partial<ChapterWorkspace>
        | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>)
    ) => {
      setChapterWorkspaces((prev) => {
        const current = prev[chapterKey] ?? createChapterWorkspace();
        const patch = typeof update === "function" ? update(current) : update;
        return { ...prev, [chapterKey]: { ...current, ...patch } };
      });
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
  };
}
