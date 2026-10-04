"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ChatMessage, PendingChatMessage } from "@/components/HeliosChat";
import type { SessionPlan } from "@/lib/domain/types";
import type { ChapterWorkspace } from "@/components/session/sessionViewHelpers";
import {
  adoptIleSingleLiveCanvas,
  applyIleSessionContextWrite,
  boundIleSessionLiveState,
  ileSingleCanvasChapterWorkspaces,
  ILE_SESSION_GLOBAL_CONTEXT_KEY,
  ileChapterCanvasInitialScene,
  ileLegacyChapterWorkspacesStorageKey,
  ileSessionContextStorageKey,
  parseIleSessionContextStored,
  persistIleChapterColdWorkspace,
  hydrateIleFocusedChapterLiveState,
  readIleFocusedChapterWorkspace,
  type IleSessionContext,
  type IleSessionContextMap,
} from "@/lib/ile-session-global-context";
import { ileBlockSessionFrame } from "@/lib/ile-canvas-session";

export function useSessionChapterWorkspaces(
  sessionId: string,
  sessionPlan: SessionPlan | null
) {
  const frame = ileBlockSessionFrame(sessionPlan);
  const activeChapterIndex = frame?.index ?? 0;
  const activeChapterKey = frame?.id ?? null;
  const activeChapterIndexRef = useRef(activeChapterIndex);
  activeChapterIndexRef.current = activeChapterIndex;
  const setActiveChapterIndex = useCallback((_index: number) => {
    // The live chapter is `frame`. This does not retarget the canvas.
  }, []);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterLoadingIndex, setChapterLoadingIndex] = useState<number | null>(null);
  const chapterFocusSinceRef = useRef<Record<number, number>>({ 0: Date.now() });
  const [sessionContext, setSessionContext] = useState<IleSessionContextMap>({});
  const coldContextRef = useRef<IleSessionContextMap>({});
  const [chapterWorkspacesLoaded, setChapterWorkspacesLoaded] = useState(false);

  useEffect(() => {
    chapterFocusSinceRef.current = { 0: Date.now() };
    setSessionContext({});
    coldContextRef.current = {};
    setChapterWorkspacesLoaded(false);
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored =
        window.sessionStorage.getItem(ileSessionContextStorageKey(sessionId)) ||
        window.sessionStorage.getItem(ileLegacyChapterWorkspacesStorageKey(sessionId));
      const parsed = parseIleSessionContextStored(stored);
      if (parsed) {
        coldContextRef.current = parsed;
        setSessionContext(parsed);
      }
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
        JSON.stringify(coldContextRef.current),
      );
    } catch {
      /* Session storage can fail on quota, especially with canvas data. */
    }
  }, [sessionContext, chapterWorkspacesLoaded, sessionId]);

  const activeStep = frame ? sessionPlan?.steps?.[frame.index] : undefined;

  // One canvas. Restore the current chapter once; a later chapter id does not swap it.
  const activeWorkspace = readIleFocusedChapterWorkspace(
    sessionContext,
    coldContextRef.current,
    sessionContext[ILE_SESSION_GLOBAL_CONTEXT_KEY]
      ? ILE_SESSION_GLOBAL_CONTEXT_KEY
      : activeChapterKey,
  );

  useEffect(() => {
    if (!chapterWorkspacesLoaded || !activeChapterKey) return;
    setSessionContext((prev) => {
      if (prev[ILE_SESSION_GLOBAL_CONTEXT_KEY]) return prev;
      const adopted = adoptIleSingleLiveCanvas(
        prev,
        coldContextRef.current,
        activeChapterKey,
      );
      if (!adopted) return prev;
      coldContextRef.current = adopted;
      return adopted;
    });
  }, [activeChapterKey, chapterWorkspacesLoaded]);

  const updateChapterWorkspace = useCallback(
    (
      chapterKey: string,
      update:
        | Partial<ChapterWorkspace>
        | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>)
    ) => {
      setSessionContext((prev) => {
        const key = ILE_SESSION_GLOBAL_CONTEXT_KEY;
        const hydratedPrev = hydrateIleFocusedChapterLiveState(
          prev,
          coldContextRef.current,
          prev[key] ? key : chapterKey,
        );
        const next = applyIleSessionContextWrite(hydratedPrev, chapterKey, update);
        const written = next[key];
        if (written) {
          coldContextRef.current = persistIleChapterColdWorkspace(
            { [key]: coldContextRef.current[key] },
            key,
            written,
          );
        }
        return next;
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
      if (!activeChapterKey) return;
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
    () => ileSingleCanvasChapterWorkspaces(activeWorkspace),
    [activeWorkspace],
  );

  const setChapterWorkspaces = useCallback(
    (
      value:
        | Record<string, ChapterWorkspace>
        | ((prev: Record<string, ChapterWorkspace>) => Record<string, ChapterWorkspace>),
    ) => {
      setSessionContext((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        const key = ILE_SESSION_GLOBAL_CONTEXT_KEY;
        const adopted =
          next[key] || prev[key]
            ? { [key]: next[key] ?? prev[key]! }
            : activeChapterKey
              ? adoptIleSingleLiveCanvas(next, coldContextRef.current, activeChapterKey)
              : null;
        const live = adopted ?? next;
        coldContextRef.current = live[key] ? { [key]: live[key] } : live;
        return boundIleSessionLiveState(live, key);
      });
    },
    [activeChapterKey],
  );

  return {
    activeChapterIndex,
    setActiveChapterIndex,
    activeChapterIndexRef,
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
    whiteboardSceneData: ileChapterCanvasInitialScene(activeWorkspace),
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
    coldContextRef,
  };
}

export type { IleSessionContext };
