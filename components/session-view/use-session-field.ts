"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Tool } from "@/components/ToolsPanel";
import type { AestheticPackage } from "@/lib/aesthetics";
import {
  assignIleWorkAestheticImages,
  ileChapterAestheticIds,
  ileWorkAestheticStorageKey,
  parseIleWorkAestheticStored,
} from "@/lib/aesthetics";
import { resolveBlockMapGlyph } from "@/lib/block-map-glyph";
import { insightsSessionListUrl, type InsightSummary } from "@/lib/insights";
import {
  ileBlockSessionChapter,
  ileBlockSessionFrame,
  ileBlockSessionOpenWorkIds,
  type IleBlockSessionFrame,
} from "@/lib/learn-canvas-session";
import { archiveProbe, type Session, type SessionPlan, type SessionPlanStep, type ToolAction, type ToolName } from "@/lib/storage";
import { decideIleSettingsEnterMap } from "@/lib/learn-session-routes";
import {
  isSessionWelcomeSeen,
  markIleSessionSettingsConfirmed,
} from "@/lib/welcomeState";
import { loadSessionBranchField, sessionClockMayStart } from "@/lib/session-branch-field-load";
import { learnSessionFieldInput } from "@/lib/session-branch-prepare";
import { learnFieldFromStoredPolicy } from "@/lib/session-policy-store";
import { type ChatMessage, postIleSessionChat } from "@/lib/session-chat-client";
import { buildIleWorkCanvasCommandUserMessage } from "@/lib/learn-work-canvas-prompts";
import {
  ileWorkCanvasAskFromSessionChat,
  ileWorkCanvasScenesFromWorkspaces,
  pickIleWorkCanvasTurnScene,
  seedIleChapterWorkCanvas,
  serializeIleWorkCanvasScene,
  type IleWorkCanvasAskKind,
  type IleWorkCanvasElement,
  type IleWorkCanvasScene,
  type IleWorkCanvasWorkspaceInput,
} from "@/lib/learn-work-canvas";
import { type IleWorkCanvasPowEvent } from "@/lib/learn-work-canvas-pow";
import type { ChapterWorkspace } from "@/components/session/sessionViewHelpers";
import type { IleSessionContextMap } from "@/lib/learn-session-global-context";
import type { GuestAccessKind, IlePromptMaterials } from "@/components/session-view/types";
import type { IleWorkStartDecision } from "@/lib/learn-pow-spend";

export type SessionFieldInput = {
  session: Session | null;
  setSession: (s: Session | null | ((prev: Session | null) => Session | null)) => void;
  sessionRef: { current: Session | null };
  sessionId: string;
  ileToken?: string;
  ayclToken?: string;
  guestAccessKind: GuestAccessKind;
  guestAccessBody: Record<string, unknown>;
  tutoringLanguage: string;
  isPreparing: boolean;
  setIsPreparing: (v: boolean) => void;
  setPlanLoading: (v: boolean) => void;
  setPlanError: (e: string | null) => void;
  sessionPlan: SessionPlan | null;
  sessionPlanRef: { current: SessionPlan | null };
  setLanguageConfirmed: (v: boolean) => void;
  setShowWelcomeModal: (v: boolean) => void;
  setShowWelcomePanel: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  startRecording: () => Promise<void>;
  activeChapterKey: string;
  activeChapterIndex: number;
  activeChapterIndexRef: { current: number };
  activeStep: SessionPlanStep | undefined;
  sessionContext: IleSessionContextMap;
  coldContextRef: { current: IleSessionContextMap };
  whiteboardSceneData: IleWorkCanvasScene | null;
  updateChapterWorkspace: (
    chapterKey: string,
    update:
      | Partial<ChapterWorkspace>
      | ((workspace: ChapterWorkspace) => Partial<ChapterWorkspace>),
  ) => void;
  chapterWorkspaces: Record<string, ChapterWorkspace>;
  displayProjectChapterExercise: string;
  isProjectMode: boolean;
  blockFrame: IleBlockSessionFrame | null;
  chapterDialoguePrompt: string;
  ilePromptMaterials: IlePromptMaterials | null;
  t: (key: string) => string;
  logTool: (
    toolName: ToolName,
    action: ToolAction,
    metadata?: Record<string, unknown>,
  ) => Promise<void> | void;
  handleLoadChapter: (index: number) => Promise<void> | void;
  tryStartWork: (chapterId: string, openWorkIds: readonly string[]) => IleWorkStartDecision;
  setActiveTool: (tool: Tool) => void;
  chromeSelectedAesthetic: AestheticPackage | null | undefined;
  openWorkIdsRef: { current: string[] };
};

export function useSessionField(input: SessionFieldInput) {
  const {
    session,
    setSession,
    sessionRef,
    sessionId,
    ileToken,
    ayclToken,
    guestAccessKind,
    guestAccessBody,
    tutoringLanguage,
    isPreparing,
    setIsPreparing,
    setPlanLoading,
    setPlanError,
    sessionPlan,
    sessionPlanRef,
    setLanguageConfirmed,
    setShowWelcomeModal,
    setShowWelcomePanel,
    setIsPaused,
    startRecording,
    activeChapterKey,
    activeChapterIndex,
    activeChapterIndexRef,
    activeStep,
    sessionContext,
    coldContextRef,
    whiteboardSceneData,
    updateChapterWorkspace,
    chapterWorkspaces,
    displayProjectChapterExercise,
    isProjectMode,
    blockFrame,
    chapterDialoguePrompt,
    ilePromptMaterials,
    t,
    logTool,
    handleLoadChapter,
    tryStartWork,
    setActiveTool,
    chromeSelectedAesthetic,
    openWorkIdsRef,
  } = input;

  const whiteboardSceneDataRef = useRef(whiteboardSceneData);
  useEffect(() => {
    whiteboardSceneDataRef.current = whiteboardSceneData;
  }, [whiteboardSceneData]);
  const [canvasApplyNonce, setCanvasApplyNonce] = useState(0);
  const [canvasApplyElements, setCanvasApplyElements] = useState<IleWorkCanvasElement[]>([]);
  const [openWorkIds, setOpenWorkIds] = useState<string[]>([]);
  const [workAestheticById, setWorkAestheticById] = useState<Record<string, string>>({});
  const [mapSelectedChapterId, setMapSelectedChapterId] = useState<string | null>(null);
  const [sessionInsights, setSessionInsights] = useState<InsightSummary[]>([]);
  const [keptInsight, setKeptInsight] = useState<InsightSummary | null>(null);

  useEffect(() => {
    openWorkIdsRef.current = openWorkIds;
  }, [openWorkIds]);

  useEffect(() => {
    const ids = ileChapterAestheticIds({
      stepIds: sessionPlan?.steps?.map((step) => step.id),
      openWorkIds,
      selectedId: mapSelectedChapterId,
    });
    setWorkAestheticById((current) => {
      const next = assignIleWorkAestheticImages({
        ids,
        current,
        images: chromeSelectedAesthetic?.images,
      });
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((id) => current[id] === next[id])
      ) {
        return current;
      }
      return next;
    });
  }, [
    chromeSelectedAesthetic?.images,
    mapSelectedChapterId,
    openWorkIds,
    sessionPlan?.steps,
  ]);

  useEffect(() => {
    if (!session?.id || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        ileWorkAestheticStorageKey(session.id),
        JSON.stringify(workAestheticById),
      );
    } catch {
      /* quota */
    }
  }, [session?.id, workAestheticById]);

  useEffect(() => {
    if (!session?.id) return;
    let restored: Record<string, string> = {};
    if (typeof window !== "undefined") {
      try {
        restored =
          parseIleWorkAestheticStored(
            window.sessionStorage.getItem(ileWorkAestheticStorageKey(session.id)),
          ) ?? {};
      } catch {
        restored = {};
      }
    }
    setWorkAestheticById((current) =>
      Object.keys(restored).length === 0 ? current : { ...current, ...restored },
    );
    const opened = ileBlockSessionFrame(sessionPlanRef.current);
    setOpenWorkIds(
      opened
        ? ileBlockSessionOpenWorkIds(sessionPlanRef.current?.steps, opened.index)
        : sessionId
          ? [sessionId]
          : [],
    );
    // Restore docked Work once per session load, not on later metadata writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    const ids = blockFrame
      ? ileBlockSessionOpenWorkIds(sessionPlan?.steps, blockFrame.index)
      : session?.id
        ? [session.id]
        : [];
    setOpenWorkIds((current) => {
      if (current.length === ids.length && current.every((id, index) => id === ids[index])) {
        return current;
      }
      return ids;
    });
  }, [blockFrame, session?.id, sessionPlan?.steps]);

  const clampedActiveChapterRef = useRef<string | null>(null);
  useEffect(() => {
    const steps = sessionPlan?.steps ?? [];
    if (steps[activeChapterIndex]?.id) {
      clampedActiveChapterRef.current = null;
      return;
    }
    const first = ileBlockSessionChapter(steps, activeChapterIndex);
    if (!first) return;
    if (clampedActiveChapterRef.current === first.id) return;
    clampedActiveChapterRef.current = first.id;
    const nextIndex = steps.findIndex((step) => step.id === first.id);
    if (nextIndex < 0 || nextIndex === activeChapterIndex) return;
    void handleLoadChapter(nextIndex);
  }, [activeChapterIndex, handleLoadChapter, sessionPlan?.steps]);

  const workspaceId =
    typeof session?.metadata?.workspace_id === "string"
      ? session.metadata.workspace_id
      : undefined;
  const sessionBlockId =
    typeof session?.metadata?.block_id === "string" ? session.metadata.block_id : undefined;

  const learnField = learnSessionFieldInput({
    sessionId: session?.id,
    problem: session?.problem,
    ileToken,
    ayclToken,
    blockId: sessionBlockId,
    workspaceId,
    metadata: session?.metadata,
  });

  const canvasWorkspaceContext = useMemo((): IleWorkCanvasWorkspaceInput => {
    return {
      workspaceTitle: ilePromptMaterials?.workspaceTitle || session?.problem || null,
      workspaceGoal: ilePromptMaterials?.workspaceGoal ?? null,
      workspaceDescription: null,
      rootTopic: ilePromptMaterials?.rootTopic ?? null,
      notes: ilePromptMaterials?.notes ?? null,
      blockTitle: ilePromptMaterials?.blockTitle || session?.problem || null,
      blockDescription: ilePromptMaterials?.blockDescription ?? null,
      chapterDescription: activeStep?.description || null,
      files: ilePromptMaterials?.files ?? null,
      blocks: ilePromptMaterials?.blocks ?? null,
      focusedBlockId: ilePromptMaterials?.focusedBlockId ?? null,
      blockLocalContext: ilePromptMaterials?.blockLocalContext ?? null,
      unusableCells: ilePromptMaterials?.unusableCells ?? null,
      scoutArtifacts: ilePromptMaterials?.scoutArtifacts ?? null,
    };
  }, [activeStep?.description, ilePromptMaterials, session?.problem]);

  const seedChapterWorkCanvas = useCallback(
    (chapterId: string, text: string | null | undefined) => {
      const picked = pickIleWorkCanvasTurnScene({
        targetChapterId: chapterId,
        focusedChapterId: activeChapterKey,
        liveSceneByChapter: ileWorkCanvasScenesFromWorkspaces(sessionContext),
        coldSceneByChapter: ileWorkCanvasScenesFromWorkspaces(coldContextRef.current),
        focusedSceneRef: whiteboardSceneDataRef,
      });
      const { scene, seeded } = seedIleChapterWorkCanvas(picked.sceneToSend, {
        text,
        chapterId,
      });
      if (!seeded) return;
      updateChapterWorkspace(chapterId, { whiteboardSceneData: scene });
      if (picked.applyLive || chapterId === activeChapterKey) {
        whiteboardSceneDataRef.current = scene;
        const appended = scene.elements.slice(picked.sceneToSend.elements.length);
        if (appended.length) {
          setCanvasApplyElements(appended);
          setCanvasApplyNonce((n) => n + 1);
        }
      }
    },
    [activeChapterKey, coldContextRef, sessionContext, updateChapterWorkspace],
  );

  useEffect(() => {
    const boardId = session?.id;
    if (!boardId) return;
    const text =
      (session.problem || "").trim() ||
      (isProjectMode ? displayProjectChapterExercise : blockFrame?.prompt || chapterDialoguePrompt);
    seedChapterWorkCanvas(boardId, text);
  }, [
    blockFrame?.prompt,
    chapterDialoguePrompt,
    displayProjectChapterExercise,
    isProjectMode,
    seedChapterWorkCanvas,
    session?.id,
    session?.problem,
  ]);

  const handleWorkChapter = useCallback(
    (stepId: string) => {
      const steps = sessionPlanRef.current?.steps ?? sessionPlan?.steps;
      const idx = steps?.findIndex((s) => s.id === stepId) ?? -1;
      const decision = tryStartWork(stepId, openWorkIds);
      if (!decision.allowed) return;
      const step = idx >= 0 ? steps?.[idx] : undefined;
      seedChapterWorkCanvas(stepId, step?.description);
      if (idx >= 0 && idx !== activeChapterIndexRef.current) {
        void handleLoadChapter(idx);
      }
      setActiveTool("chapters");
    },
    [
      activeChapterIndexRef,
      handleLoadChapter,
      openWorkIds,
      seedChapterWorkCanvas,
      sessionPlan?.steps,
      sessionPlanRef,
      setActiveTool,
      tryStartWork,
    ],
  );

  const handleCanvasPowActions = useCallback(
    (events: IleWorkCanvasPowEvent[]) => {
      for (const event of events) {
        void logTool("canvas", event.toolAction as ToolAction, event.metadata);
      }
    },
    [logTool],
  );

  const handleAskCanvasSelection = useCallback(
    async (input: {
      prompt: string;
      selectedElements: IleWorkCanvasElement[];
      scene: IleWorkCanvasScene;
      kind?: IleWorkCanvasAskKind;
    }) => {
      if (!session) return { text: "" };
      const chapterKey = activeChapterKey;
      const userText = buildIleWorkCanvasCommandUserMessage({
        kind: input.kind,
        prompt: input.prompt,
        selectedElements: input.selectedElements,
        scene: input.scene,
        workspace: canvasWorkspaceContext,
      });
      const userMsg: ChatMessage = {
        id: `${Date.now()}-u`,
        role: "user",
        content: userText,
      };
      const placeholderId = `${Date.now()}-pending`;
      updateChapterWorkspace(chapterKey, (workspace) => ({
        chatMessages: [
          ...workspace.chatMessages,
          userMsg,
          { id: placeholderId, role: "assistant", content: "", pending: true },
        ],
      }));
      try {
        const existingMessages = chapterWorkspaces[chapterKey]?.chatMessages ?? [];
        const { ok, data, errorMessage } = await postIleSessionChat({
          problem: session.problem,
          activeStepIndex: activeChapterIndex,
          activeStepId: activeStep?.id,
          activeStepDescription: activeStep?.description,
          sessionPlan,
          sessionId: session.id,
          tutoringLanguage,
          ...guestAccessBody,
          workCanvasScene: serializeIleWorkCanvasScene(input.scene),
          workspaceContext: canvasWorkspaceContext,
          messages: [...existingMessages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
            imageDataUrl: m.imageDataUrl,
          })),
        });
        const asked = ileWorkCanvasAskFromSessionChat({
          ok,
          message: data?.message,
          canvasElements: data?.canvasElements,
          raw: data?.raw,
          errorMessage: errorMessage || t("heliosChat.errorMessage"),
        });
        updateChapterWorkspace(chapterKey, (workspace) => ({
          chatMessages: workspace.chatMessages.map((message) =>
            message.id === placeholderId
              ? { ...message, content: asked.text, pending: false }
              : message,
          ),
        }));
        return asked;
      } catch (error) {
        console.error("Canvas ask XAI error:", error);
        const fail = t("heliosChat.errorMessage");
        updateChapterWorkspace(chapterKey, (workspace) => ({
          chatMessages: workspace.chatMessages.map((message) =>
            message.id === placeholderId
              ? { ...message, content: fail, pending: false }
              : message,
          ),
        }));
        return { text: fail };
      }
    },
    [
      activeChapterIndex,
      activeChapterKey,
      activeStep,
      canvasWorkspaceContext,
      chapterWorkspaces,
      guestAccessBody,
      session,
      sessionPlan,
      t,
      tutoringLanguage,
      updateChapterWorkspace,
    ],
  );

  const loadSessionInsights = useCallback(async () => {
    if (!session?.id) return;
    try {
      const response = await fetch(insightsSessionListUrl(session.id));
      const data = await response.json();
      if (!response.ok) return;
      setSessionInsights(Array.isArray(data.insights) ? data.insights : []);
    } catch {
      /* Guest sessions cannot list insights. */
    }
  }, [session?.id]);

  useEffect(() => {
    void loadSessionInsights();
  }, [loadSessionInsights]);

  const openWorkDockLabels = useMemo(() => {
    const topic = (session?.problem || "").trim();
    const ids = openWorkIds.length > 0 ? openWorkIds : session?.id ? [session.id] : [];
    return ids.map((id) => {
      const idx = sessionPlan?.steps?.findIndex((row) => row.id === id) ?? -1;
      const step = idx >= 0 ? sessionPlan?.steps?.[idx] : undefined;
      return {
        id,
        label: idx >= 0 ? `Ch ${idx + 1}` : "Topic",
        keyword: step
          ? resolveBlockMapGlyph({
              map_keyword: step.map_keyword,
              title: step.description,
            }).keyword
          : undefined,
        description: topic || String(step?.description || "").trim() || undefined,
        focused: id === activeStep?.id || ids.length === 1,
        image: workAestheticById[id],
      };
    });
  }, [
    activeStep?.id,
    openWorkIds,
    session?.id,
    session?.problem,
    sessionPlan?.steps,
    workAestheticById,
  ]);

  const handleConfirmSettings = useCallback(async () => {
    if (!session || isPreparing) return;

    setIsPreparing(true);
    setPlanLoading(true);
    setPlanError(null);

    try {
      if (guestAccessKind === "aycl" && ayclToken) {
        const { saveAyclSession } = await import("@/lib/aycl-storage");
        await saveAyclSession(ayclToken, {
          ...session,
          metadata: { ...(session.metadata || {}), tutoringLanguage },
        });
      } else if (guestAccessKind === "ile" && ileToken) {
        const { saveIleLinkSession } = await import("@/lib/learn-link-storage");
        await saveIleLinkSession(ileToken, {
          ...session,
          metadata: { ...(session.metadata || {}), tutoringLanguage },
        });
      } else {
        const { data: sessionData } = await (await import("@/lib/supabase/client"))
          .createClient()
          .from("sessions")
          .select("metadata")
          .eq("id", session.id)
          .single();
        if (sessionData?.metadata) {
          await (await import("@/lib/supabase/client"))
            .createClient()
            .from("sessions")
            .update({ metadata: { ...sessionData.metadata, tutoringLanguage } })
            .eq("id", session.id);
        }
      }

      if (session.probes.length > 0) {
        for (const probe of session.probes) {
          await archiveProbe(probe.id);
        }
      }
      const clearedSession = { ...session, probes: [] };
      setSession(clearedSession);
      sessionRef.current = clearedSession;
      setPlanLoading(false);
      const fieldInput = learnSessionFieldInput({
        sessionId: session.id,
        problem: session.problem,
        ileToken,
        ayclToken,
        metadata: session.metadata,
      });
      const storedField = learnFieldFromStoredPolicy(session.metadata, fieldInput);
      const field = storedField
        ? storedField
        : fieldInput
          ? await loadSessionBranchField(fieldInput)
          : { ok: false as const, error: "The field could not be prepared.", key: null };
      if (!sessionClockMayStart({ mode: "learn", fieldReady: field.ok })) {
        setPlanError(field.ok ? "The field could not be prepared." : field.error);
        return;
      }
      setIsPaused(false);
      setLanguageConfirmed(true);
      markIleSessionSettingsConfirmed(session.id);
      setShowWelcomeModal(false);
      const enterMap = decideIleSettingsEnterMap({
        settingsConfirmed: true,
        onSettingsRoute: false,
        welcomeSeen: isSessionWelcomeSeen(session.id),
        recording: false,
      });
      if (enterMap === "help") setShowWelcomePanel(true);
      if (enterMap === "record") await startRecording();
    } catch (err) {
      console.error("Failed to prepare session:", err);
      setPlanError("Failed to prepare block");
    } finally {
      setPlanLoading(false);
      setIsPreparing(false);
    }
  }, [
    ayclToken,
    guestAccessKind,
    ileToken,
    isPreparing,
    session,
    sessionRef,
    setIsPaused,
    setIsPreparing,
    setLanguageConfirmed,
    setPlanError,
    setPlanLoading,
    setSession,
    setShowWelcomeModal,
    setShowWelcomePanel,
    startRecording,
    tutoringLanguage,
  ]);

  const handleWelcomeReadyStart = useCallback(async () => {
    if (!session || isPreparing) return;
    setIsPreparing(true);
    setPlanError(null);
    try {
      const fieldInput = learnSessionFieldInput({
        sessionId: session.id,
        problem: session.problem,
        ileToken,
        ayclToken,
        metadata: session.metadata,
      });
      const storedField = learnFieldFromStoredPolicy(session.metadata, fieldInput);
      const field = storedField
        ? storedField
        : fieldInput
          ? await loadSessionBranchField(fieldInput)
          : { ok: false as const, error: "The field could not be prepared.", key: null };
      if (!sessionClockMayStart({ mode: "learn", fieldReady: field.ok })) {
        setPlanError(field.ok ? "The field could not be prepared." : field.error);
        return;
      }
      setIsPaused(false);
      const needsWelcome =
        !isSessionWelcomeSeen(session.id) &&
        session.probes.filter((p) => !p.archived).length === 0;
      if (needsWelcome) {
        setShowWelcomePanel(true);
      } else {
        await startRecording();
      }
      markIleSessionSettingsConfirmed(session.id);
      setShowWelcomeModal(false);
    } finally {
      setIsPreparing(false);
    }
  }, [
    ayclToken,
    ileToken,
    isPreparing,
    session,
    setIsPaused,
    setIsPreparing,
    setPlanError,
    setShowWelcomeModal,
    setShowWelcomePanel,
    startRecording,
  ]);

  return {
    whiteboardSceneDataRef,
    canvasApplyNonce,
    canvasApplyElements,
    openWorkIds,
    mapSelectedChapterId,
    setMapSelectedChapterId,
    sessionInsights,
    setSessionInsights,
    keptInsight,
    setKeptInsight,
    learnField,
    workspaceId,
    sessionBlockId,
    seedChapterWorkCanvas,
    handleWorkChapter,
    handleCanvasPowActions,
    handleAskCanvasSelection,
    openWorkDockLabels,
    handleConfirmSettings,
    handleWelcomeReadyStart,
  };
}
