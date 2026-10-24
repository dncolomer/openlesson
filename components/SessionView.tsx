"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import { usePathname, useRouter } from "next/navigation";
import { pauseSession, type Session, type SessionPlan, type ToolAction, type ToolName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { MobileBlockScreen } from "./MobileBlockScreen";
import { useSessionChrome } from "@/components/session-view/use-session-chrome";
import { useSessionRuntime } from "@/components/session-view/use-session-runtime";
import { useSessionMutate } from "@/components/session-view/use-session-mutate";
import { useSessionSpeech } from "@/components/session-view/use-session-speech";
import { useSessionIdle, type IlePowInterruptionHandler } from "@/components/session-view/use-session-idle";
import { useSessionPhase } from "@/components/session-view/use-session-phase";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import {
  buildPowParticipantIdentity,
  type PowParticipantIdentity,
} from "@/lib/session-participant-identity";
import { type ChatMessage, postIleSessionChat } from "@/lib/session-chat-client";
import type { Tool } from "@/components/ToolsPanel";

import {
  clampIlePowExpense,
  ILE_POW_EXPENSE_DEFAULT,
  parseIleOpenWorkIdsFromMetadata,
  restoreIleOpenWorkIds,
} from "@/lib/learn-pow-spend";
import {
  clampIleMinInsightsPerChapter,
  ileChapterInsightCounts,
  ileInsightsForChapter,
  ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  ILE_TURN_INSIGHT_SLOT_MAX,
  clampIleTurnInsightSlotMax,
} from "@/lib/learn-turn-insights";
import {
  ILE_GATHER_MAX_PER_SESSION,
  clampIleGatherMaxPerSession,
} from "@/lib/learn-gather-resources";
import {
  decideIleSettingsEnterMap,
  ileSessionMapPath,
  ileSessionSettingsPath,
  ileWelcomeRouteSync,
  isIleSessionSettingsPath,
} from "@/lib/learn-session-routes";
import {
  isIleSessionSettingsConfirmed,
  isSessionWelcomeSeen,
} from "@/lib/welcomeState";
import { insightsSessionListUrl, type InsightSummary } from "@/lib/insights";
import { useHeliosVoicePlaybackActive } from "@/lib/useHeliosVoicePlayback";
import { translateWithLocale, useI18n } from "@/lib/i18n";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import {
  ileBlockSessionChapter,
  ileBlockSessionFrame,
  ileBlockSessionOpenWorkIds,
  ILE_SESSION_CHAPTER_COUNT_DEFAULT,
  readIleCanvasSessionConfig,
  writeIleCanvasSessionConfig,
} from "@/lib/learn-canvas-session";
import { SessionWelcomeModal } from "@/components/session-view/session-welcome-modal";
import { SessionToolPanes } from "@/components/session-view/session-tool-panes";
import { SessionChapterWorkCanvas } from "@/components/session-view/session-chapter-canvas";
import { emptySessionPolicySnapshot } from "@/components/session-view/session-policy-context";
import { learnSessionFieldInput } from "@/lib/session-branch-prepare";
import { SessionLiveStage } from "@/components/session-view/session-live-stage";
import {
  isIleMapOverlayTool,
  isIleSessionModalTool,
} from "@/lib/learn-map-chrome";
import { useIleGatherResources } from "@/components/session-view/use-learn-gather-resources";
import {
  blockHasUnseenGatherNotification,
  ileGatherJobTileId,
  markGatherResourcesSeen,
  parseGatherSeenBlockIds,
  type BlockCircularMenuActionId,
  type IleVoicePadSpec,
} from "@/lib/block-circular-menu";
import {
  assignIleWorkAestheticImages,
  ileChapterAestheticIds,
  ileWorkAestheticStorageKey,
  parseIleWorkAestheticStored,
} from "@/lib/aesthetics";

import { resolveBlockMapGlyph } from "@/lib/block-map-glyph";

import { ileTimProgressByTileId } from "@/lib/learn-tim-chapter-complete";
import {
  isIleChapterThoughtsLocked,
  isIleProjectMode,
  resolveIleDurableSessionMode,
  type IleSessionMode,
} from "@/lib/learn-mode";
import { useSessionChapterWorkspaces } from "@/lib/useSessionChapterWorkspaces";
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
import { useIleSessionPurity } from "@/components/session-view/use-learn-session-purity";
import { IleInsightTrophyStrip } from "@/components/session-view/learn-insight-trophies";
import {
  shouldLogIleSidebarToolSwitch,
  type IleWorkCanvasPowEvent,
} from "@/lib/learn-work-canvas-pow";


/** Stable empty map — never use `= {}` as a prop default (new identity every render). */
const EMPTY_ENTRY_QUERY_PARAMS: Record<string, string | string[]> = Object.freeze({});

export function SessionView({
  sessionId,
  resumeSession = false,
  ayclToken,
  ileToken,
  showEndSession = true,
  entryQueryParams,
  participantIdentity: participantIdentityProp = null,
  sessionMode: sessionModeProp,
}: {
  sessionId: string;
  /** Resume query — continue stored chapters, no density picker. */
  resumeSession?: boolean;
  ayclToken?: string;
  /** Private token for guest TAP Learning practice links (`/ile/session/{token}`). */
  ileToken?: string;
  /**
   * When false, hide End Session / stop-end chrome for this session
   * (guest TAP Learning links can configure this; default true).
   */
  showEndSession?: boolean;
  /** Share URL query params → param-scoped guest identity for PoW. */
  entryQueryParams?: Record<string, string | string[]>;
  /** Server-resolved guest/assigned identity for share links. */
  participantIdentity?: PowParticipantIdentity | null;
  /**
   * TAP Learning shell mode from durable link/session. learning (default) | project.
   * When omitted, resolved from session.metadata (legacy → Learning Mode).
   */
  sessionMode?: IleSessionMode | string;
}) {
  const guestAccessKind: "aycl" | "ile" | null = ayclToken ? "aycl" : ileToken ? "ile" : null;
  const allowEndSession = showEndSession !== false;
  // Stabilize query-param identity so load effects do not re-fire every render.
  const entryParamsKey = JSON.stringify(entryQueryParams ?? EMPTY_ENTRY_QUERY_PARAMS);
  const stableEntryQueryParams = useMemo((): Record<string, string | string[]> => {
    if (!entryParamsKey || entryParamsKey === "{}") {
      return EMPTY_ENTRY_QUERY_PARAMS;
    }
    try {
      return JSON.parse(entryParamsKey) as Record<string, string | string[]>;
    } catch {
      return EMPTY_ENTRY_QUERY_PARAMS;
    }
  }, [entryParamsKey]);

  const [participantIdentity, setParticipantIdentity] = useState<PowParticipantIdentity | null>(
    participantIdentityProp,
  );

  useEffect(() => {
    if (participantIdentityProp) {
      setParticipantIdentity(participantIdentityProp);
      return;
    }
    // Map UI / owner session: signed-in user.
    if (ileToken || ayclToken) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }: { data: { user: { id?: string } | null } }) => {
      if (cancelled) return;
      const id = data.user?.id ?? null;
      if (id) setParticipantIdentity(buildPowParticipantIdentity({ userId: id }));
    });
    return () => {
      cancelled = true;
    };
  }, [participantIdentityProp, ileToken, ayclToken]);
  const guestAccessBody = useMemo(
    () =>
      guestAccessKind === "aycl" && ayclToken
        ? { ayclToken }
        : guestAccessKind === "ile" && ileToken
          ? {
              ileToken,
              ...(Object.keys(stableEntryQueryParams).length > 0
                ? { entryQueryParams: stableEntryQueryParams }
                : {}),
            }
          : EMPTY_ENTRY_QUERY_PARAMS,
    [guestAccessKind, ayclToken, ileToken, stableEntryQueryParams],
  );
  const router = useRouter();
  const pathname = usePathname();
  const settingsRoute = isIleSessionSettingsPath(pathname);
  const { t, locale, supportedLocales } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutoringLanguage, setTutoringLanguage] = useState<SpokenLocale>(() =>
    coerceSpokenLocale(locale),
  );
  // Manual-advance by default: the student clicks Complete on a plan step
  // when they're done. Auto-advance mode is kept wired for future toggling
  // but the UI affordance is hidden (see note at the hidden toggles below).
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Mic check
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "denied">("idle");
  const micStreamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [muteRemaining, setMuteRemaining] = useState(0);

  // Session ending / saving
  const [isSaving, setIsSaving] = useState(false);
  // Tutor-end dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState("");

  // Session Plan state (needed before chapter workspaces hook)
  // Session Plan state
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const sessionPlanRef = useRef<SessionPlan | null>(null);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);

  const {
    activeChapterIndex,
    setActiveChapterIndex,
    activeChapterIndexRef,
    chapterLoading,
    setChapterLoading,
    setChapterLoadingIndex,
    chapterFocusSinceRef,
    chapterWorkspaces,
    setChapterWorkspaces,
    chapterWorkspacesLoaded,
    activeStep,
    activeChapterKey: framedChapterId,
    activeWorkspace,
    chatMessages,
    whiteboardData,
    whiteboardSceneData,
    notebookContent,
    canvasDirtyForHelios,
    notebookDirtyForHelios,
    updateChapterWorkspace,
    updateActiveChapterWorkspace,
    setWhiteboardData,
    setNotebookContent,
    setCanvasDirtyForHelios,
    setNotebookDirtyForHelios,
    sessionContext,
    coldContextRef,
  } = useSessionChapterWorkspaces(sessionId, sessionPlan);
  const activeChapterKey = framedChapterId || sessionId;

  const whiteboardSceneDataRef = useRef(whiteboardSceneData);
  useEffect(() => {
    whiteboardSceneDataRef.current = whiteboardSceneData;
  }, [whiteboardSceneData]);
  const [canvasApplyNonce, setCanvasApplyNonce] = useState(0);
  const [canvasApplyElements, setCanvasApplyElements] = useState<IleWorkCanvasElement[]>([]);

  const activeChapterLabel = activeStep ? `Chapter ${activeChapterIndex + 1}` : "this chapter";

  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);

  // Plan complete modal (shown when all steps are done)
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);

  const [showWelcomeModal, setShowWelcomeModal] = useState(
    () => !isIleSessionSettingsConfirmed(sessionId),
  );
  const mapEntryTailDoneRef = useRef(false);
  const [powExpense, setPowExpense] = useState(ILE_POW_EXPENSE_DEFAULT);
  const [insightSlotMax, setInsightSlotMax] = useState(ILE_TURN_INSIGHT_SLOT_MAX);
  const [gatherMaxPerSession, setGatherMaxPerSession] = useState(
    ILE_GATHER_MAX_PER_SESSION,
  );
  const [allowThoughtsPoolInsights, setAllowThoughtsPoolInsights] = useState(true);
  const [allowParallelWork, setAllowParallelWork] = useState(true);
  const [allowGatherResources, setAllowGatherResources] = useState(true);
  const [minInsightsPerChapter, setMinInsightsPerChapter] = useState(
    ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  );
  const [openWorkIds, setOpenWorkIds] = useState<string[]>([]);
  const [mapSelectedChapterId, setMapSelectedChapterId] = useState<string | null>(null);
  const [mapSelectedEmpty, setMapSelectedEmpty] = useState(false);
  const [mapSelectedBlocked, setMapSelectedBlocked] = useState(false);
  const [voicePad, setVoicePad] = useState<IleVoicePadSpec | null>(null);
  const voicePadActionRef = useRef<(id: BlockCircularMenuActionId) => void>(() => {});
  const [workAestheticById, setWorkAestheticById] = useState<Record<string, string>>(
    {},
  );
  const openWorkIdsRef = useRef<string[]>([]);
  const [sessionInsights, setSessionInsights] = useState<InsightSummary[]>([]);
  const [keptInsight, setKeptInsight] = useState<InsightSummary | null>(null);
  const [chapterCloseReview, setChapterCloseReview] = useState<{
    canClose: boolean;
    reason: string;
  } | null>(null);
  const handlePauseRef = useRef<() => Promise<void>>(async () => {});
  const {
    isMobile,
    userInitial,
    showTutorialBanner,
    setShowTutorialBanner,
    showWelcomePanel,
    setShowWelcomePanel,
    isStartingSession,
    setIsStartingSession,
    welcomeOpenNonce,
    helpPreviousLayoutRef,
    aestheticPackages,
    aestheticsLoading,
    selectedAestheticId,
    setSelectedAestheticId,
    selectedAesthetic: chromeSelectedAesthetic,
    activeTool,
    setActiveTool,
    prevToolRef,
    paneVisibility,
    setPaneVisibility,
    applyPaneVisibility,
    ensureVisible,
    applyIleChapterGridStartup,
    shouldBlockTools,
    handleToolChange,
  } = useSessionChrome({
    sessionId: session?.id,
    showWelcomeModal,
    isRecording,
    isPaused,
    onHelpPauseRef: handlePauseRef,
  });

  const [isPreparing, setIsPreparing] = useState(false);
  const [toolPrefillQuery, setToolPrefillQuery] = useState("");
  /**
   * Whether a persisted chapter map already exists for this session.
   * Tracked separately from `sessionPlan` so continue-welcome stays stable
   * even while plan state is loading / briefly cleared.
   */
  const [chapterPlanStatus, setChapterPlanStatus] = useState<"unknown" | "empty" | "exists" | "failed">("unknown");

  const isHeliosAssistantPending = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "assistant" && message.pending) return true;
      if (message.role === "assistant" && !message.pending) break;
    }
    return false;
  }, [chatMessages]);

  const blockFrame = useMemo(() => ileBlockSessionFrame(sessionPlan), [sessionPlan]);
  const chapterDialoguePrompt =
    blockFrame?.prompt || activeStep?.description?.trim() || t("session.chapterPromptFallback");

  /** Durable Learning vs Project mode — prop wins, then session metadata, else learning. */
  const resolvedSessionMode: IleSessionMode = useMemo(() => {
    return resolveIleDurableSessionMode({
      sessionModeProp,
      metadata: (session?.metadata as Record<string, unknown> | undefined) ?? null,
    });
  }, [sessionModeProp, session?.metadata]);
  const isProjectMode = isIleProjectMode(resolvedSessionMode);
  const chapterThoughtsLocked =
    isProjectMode && isIleChapterThoughtsLocked(activeStep?.status);

  // Track tool open/close events + auto-expand tool panel if collapsed
  useEffect(() => {
    if (!session?.id || !activeTool) return;

    // Auto-show the tools view whenever a tool is selected. This keeps
    // the top-bar Tools toggle in sync with the user's intent.
    ensureVisible("tools");

    const prevTool = prevToolRef.current;
    const elapsedTime = session.startedAt 
      ? Date.now() - new Date(session.startedAt).getTime() 
      : 0;

    if (prevTool && prevTool !== activeTool && shouldLogIleSidebarToolSwitch(prevTool)) {
      logTool(prevTool as ToolName, "close", { via: "tool_switch" });
    }
    if (shouldLogIleSidebarToolSwitch(activeTool)) {
      logTool(activeTool as ToolName, "open", { via: "tool_switch" });
    }

    prevToolRef.current = activeTool;
  }, [activeTool, session?.id, session?.startedAt]);

  const handlePowInterruptionRef = useRef<IlePowInterruptionHandler>(() => {});

  const sessionRef = useRef<Session | null>(null);
  const {
    museStatus,
    museError,
    museDeviceStatus,
    eegChannelData,
    bandPowers,
    isWebcamEnabled,
    setIsWebcamEnabled,
    webcamError,
    latestFacialData,
    isScreenCapturing,
    setIsScreenCapturing,
    screenshotCount,
    screenCaptureRef,
    museStatusRef,
    isWebcamEnabledRef,
    whiteboardDataRef,
    notebookContentRef,
    handleFacialData,
    handleFaceError,
    handleConnectMuse,
    handleDisconnectMuse,
    recordTransferEvent,
    getWorkspaceId,
    logTool,
    logToolRef,
    flushRemainingIlePow,
    powSessionEnabled,
    powSessionEnabledRef,
    ilePowContext,
    handleStartScreenCapture,
    handleStopScreenCapture,
    sessionPowArtifacts,
    sessionPowArtifactsRef,
    sessionPowTypedRef,
    sessionPowThoughts,
    recordSessionPowArtifact,
  } = useSessionRuntime({
    sessionRef,
    sessionId: session?.id,
    sessionBlockId:
      typeof session?.metadata?.block_id === "string" ? session.metadata.block_id : undefined,
    ileToken,
    entryQueryParams,
    whiteboardData,
    notebookContent,
    activeChapterKey,
    isRecording,
    isPaused,
    showWelcomePanel,
    handlePowInterruptionRef,
  });

  const sessionBlockId =
    typeof session?.metadata?.block_id === "string" ? session.metadata.block_id : undefined;
  const [resourceScopeChapterId, setResourceScopeChapterId] = useState<string | null>(null);
  const [sessionResourcesOpen, setSessionResourcesOpen] = useState(false);
  const completeTargetStepIdRef = useRef<string | null>(null);
  const insightWorkMarkRef = useRef(0);
  const [gatherSeenIds, setGatherSeenIds] = useState<string[]>(() => parseGatherSeenBlockIds([]));
  const {
    availableCounts,
    gatherJobs,
    gatherWarning,
    gatherBusy,
    gatheredResources,
    onGatherResources,
    dismissGatherWarning,
    openGatheredResources,
    tryStartWork,
    spent,
    spentUnits,
  } = useIleGatherResources({
    sessionId: session?.id,
    workspaceId:
      typeof session?.metadata?.workspace_id === "string"
        ? session.metadata.workspace_id
        : undefined,
    blockId: sessionBlockId,
    chapterId: activeStep?.id,
    chapterDescription: activeStep?.description || "",
    artifacts: sessionPowArtifacts,
    counts: sessionPowTypedRef.current,
    recordSessionPowArtifact,
    onOpenResources: () => setSessionResourcesOpen(true),
    ileToken,
    ayclToken,
    expense: powExpense,
    maxPerSession: gatherMaxPerSession,
    allowGatherResources,
    allowParallelWork,
  });

  const gatherReadyCountByBlock = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of gatherJobs) {
      if (job.status !== "completed") continue;
      const tile = ileGatherJobTileId(job);
      if (tile) counts[tile] = (counts[tile] || 0) + 1;
    }
    for (const row of gatheredResources) {
      const meta = row.meta || {};
      const bid = typeof meta.block_id === "string" ? meta.block_id.trim() : "";
      const cid = typeof meta.chapter_id === "string" ? meta.chapter_id.trim() : "";
      const tile = cid || bid;
      if (tile) counts[tile] = (counts[tile] || 0) + 1;
    }
    return counts;
  }, [gatherJobs, gatheredResources]);

  const unseenGatherBlockIds = useMemo(
    () =>
      Object.keys(gatherReadyCountByBlock).filter((id) =>
        blockHasUnseenGatherNotification({
          readyCount: gatherReadyCountByBlock[id],
          seen: gatherSeenIds.includes(id),
        }),
      ),
    [gatherReadyCountByBlock, gatherSeenIds],
  );

  const {
    persistPlanSteps,
    handleActiveChapterIndexChange,
    handleEnsureChapterPositions,
    handleLoadChapter,
    handleAcceptTimChapter,
    handleRejectTimChapter,
    handleAddChapter,
    handleUpdateChapter,
    handleMarkChapterDone,
    handleMarkChapterUndone,
    handleTimChapterMapExpansion,
    ilePromptMaterials,
    displayProjectChapterExercise,
    setProjectThoughtsByChapter,
    projectThoughtsByChapterRef,
  } = useSessionMutate({
    session,
    sessionRef,
    sessionPlanRef,
    setSessionPlan,
    resolvedSessionMode,
    isProjectMode,
    activeStep,
    activeChapterKey,
    activeChapterIndexRef,
    setActiveChapterIndex,
    chapterFocusSinceRef,
    chapterLoading,
    setChapterLoading,
    setChapterLoadingIndex,
    guestAccessBody,
    logToolRef,
    locale,
    isRecording,
    isPaused,
    setIsPaused,
    setShowPlanCompleteModal,
    chapterDialoguePrompt,
    sessionPowArtifactsRef,
    sessionPowTypedRef,
    setChapterCloseReview,
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

  const bumpUserActivityRef = useRef<() => void>(() => {});
  const { handlePowInterruption, clearPendingInterruption, mapDelay, mapDelayList, beginMapDelay, clearMapDelay } = useSessionIdle({
    activeChapterKey,
    updateChapterWorkspace,
    handlePowInterruptionRef,
    onChapterMapExpand: handleTimChapterMapExpansion,
  });

  const [timDelayNow, setTimDelayNow] = useState(() => Date.now());
  useEffect(() => {
    if (!mapDelay && mapDelayList.length === 0) return;
    const id = window.setInterval(() => setTimDelayNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [mapDelay, mapDelayList.length]);
  const timBlockActionProgress = useMemo(
    () => ileTimProgressByTileId(mapDelayList.length ? mapDelayList : mapDelay, timDelayNow),
    [mapDelay, mapDelayList, timDelayNow],
  );

  const {
    sessionThoughtInterface,
  } = useSessionSpeech({
    powSessionEnabled,
    micMuted: isMuted,
    ilePowContext,
    handlePowInterruption,
    getWorkspaceId,
    sessionRef,
    sessionId: session?.id,
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
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedSecondsRef = useRef(0);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeToolRef = useRef(activeTool);
  const objectivesRef = useRef(objectives);
  const isRecordingRef = useRef(isRecording);

  const wasRecordingRef = useRef(false);
  const wasScreenCapturingRef = useRef(false);
  const wasWebcamEnabledRef = useRef(false);
  const wasMuseStreamingRef = useRef(false);
  const pausedAudioStreamRef = useRef<MediaStream | null>(null);
  const pausedScreenStreamRef = useRef<MediaStream | null>(null);
  const pausedWebcamStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { objectivesRef.current = objectives; }, [objectives]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);
  useEffect(() => { openWorkIdsRef.current = openWorkIds; }, [openWorkIds]);
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
  useEffect(() => {
    if (!session?.id) return;
    const saved = readIleCanvasSessionConfig(session.id);
    if (!saved) return;
    setMinInsightsPerChapter(saved.insightGoal);
  }, [session?.id]);
  useEffect(() => { activeChapterIndexRef.current = activeChapterIndex; }, [activeChapterIndex]);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [stream, isMuted]);

  const policyRef = useRef(emptySessionPolicySnapshot());
  const {
    checkMicrophone,
    startRecording,
    stopRecording,
    handlePause,
    handleResume,
    handleMute,
    handleReset,
    pauseAndGoToDashboard,
    handleClose,
    handleWelcomePlay,
    handleConfirmEnd,
    handleConfirmSettings: handleConfirmSettingsPhase,
    handleWelcomeReadyStart: handleWelcomeReadyStartPhase,
  } = useSessionPhase({
    session,
    policyRef,
    setSession,
    sessionRef,
    sessionId,
    guestAccessKind,
    ayclToken,
    ileToken,
    guestAccessBody,
    entryQueryParams: stableEntryQueryParams,
    entryParamsKey,
    router,
    t,
    isRecording,
    setIsRecording,
    isPaused,
    setIsPaused,
    elapsedSeconds,
    setElapsedSeconds,
    elapsedSecondsRef,
    stream,
    setStream,
    setError,
    tutoringLanguage,
    setTutoringLanguage,
    setLanguageConfirmed,
    setSessionPlan,
    sessionPlanRef,
    setPlanLoading,
    setPlanError,
    setChapterPlanStatus,
    objectives,
    setObjectives,
    setObjectiveStatuses,
    isPreparing,
    setIsPreparing,
    setShowWelcomeModal,
    setShowWelcomePanel,
    setIsStartingSession,
    applyIleChapterGridStartup,
    helpPreviousLayoutRef,
    setPaneVisibility,
    timerRef,
    muteTimerRef,
    micStreamRef,
    setMicStatus,
    setIsMuted,
    setMuteRemaining,
    setIsSaving,
    setShowEndDialog,
    whiteboardData,
    notebookContent,
    handleDisconnectMuse,
    handleConnectMuse,
    flushRemainingIlePow,
    isScreenCapturing,
    isWebcamEnabled,
    setIsWebcamEnabled,
    setIsScreenCapturing,
    museStatus,
    screenCaptureRef,
    wasRecordingRef,
    wasScreenCapturingRef,
    wasWebcamEnabledRef,
    wasMuseStreamingRef,
    isRecordingRef,
    pausedAudioStreamRef,
    pausedScreenStreamRef,
    pausedWebcamStreamRef,
    handlePauseRef,
    openWorkIdsRef,
  });

  const handleConfirmSettings = useCallback(async () => {
    mapEntryTailDoneRef.current = true;
    if (session?.id) {
      writeIleCanvasSessionConfig(session.id, {
        chapterCount: ILE_SESSION_CHAPTER_COUNT_DEFAULT,
        insightGoal: minInsightsPerChapter,
      });
    }
    await handleConfirmSettingsPhase();
  }, [handleConfirmSettingsPhase, minInsightsPerChapter, session?.id]);

  const handleWelcomeReadyStart = useCallback(async () => {
    mapEntryTailDoneRef.current = true;
    await handleWelcomeReadyStartPhase();
  }, [handleWelcomeReadyStartPhase]);

  const handleChapterDone = useCallback(
    (opts?: { closeOverride?: boolean; stepId?: string | null }) => {
      if (!activeStep) return Promise.resolve(false);
      beginMapDelay(activeStep.id);
      return (async () => {
        try {
          await flushRemainingIlePow();
        } catch {
          /* Review still runs on whatever was already recorded. */
        }
        const closed = await handleMarkChapterDone(opts);
        if (!closed) clearMapDelay();
        return closed;
      })();
    },
    [activeStep, beginMapDelay, clearMapDelay, flushRemainingIlePow, handleMarkChapterDone],
  );

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
    [openWorkIds, seedChapterWorkCanvas, sessionPlan?.steps, tryStartWork],
  );

  const handleIleSessionToolChange = useCallback(
    (tool: Tool) => {
      if (isIleSessionModalTool(tool)) {
        if (tool === "help") {
          handleToolChange("help");
          setActiveTool("help");
          return;
        }
        if (tool === activeTool) {
          setActiveTool("chapters");
          return;
        }
        setShowWelcomePanel(false);
        setActiveTool(tool);
        return;
      }
      if (tool === activeTool && isIleMapOverlayTool(tool)) {
        setActiveTool("chapters");
        return;
      }
      handleToolChange(tool);
    },
    [activeTool, handleToolChange],
  );

  const workspaceId =
    typeof session?.metadata?.workspace_id === "string"
      ? session.metadata.workspace_id
      : undefined;
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

  useEffect(() => {
    if (!sessionId) return;
    const routeInput = {
      sessionId,
      ileToken,
      ayclToken,
      resume: resumeSession,
    };
    const sync = ileWelcomeRouteSync({
      showWelcome: showWelcomeModal,
      browserPath: window.location.pathname,
      routerPath: pathname ?? "",
      settingsHref: ileSessionSettingsPath(routeInput),
      mapHref: ileSessionMapPath(routeInput),
    });
    if (sync.kind === "replace-state") {
      window.history.replaceState(window.history.state, "", sync.href);
      return;
    }
    if (sync.kind === "router-replace") {
      router.replace(sync.href);
    }
  }, [
    ayclToken,
    ileToken,
    pathname,
    resumeSession,
    router,
    sessionId,
    showWelcomeModal,
  ]);

  useEffect(() => {
    if (!session?.id || showWelcomeModal || settingsRoute) return;
    if (mapEntryTailDoneRef.current) return;
    const action = decideIleSettingsEnterMap({
      settingsConfirmed: isIleSessionSettingsConfirmed(session.id),
      onSettingsRoute: settingsRoute,
      welcomeSeen: isSessionWelcomeSeen(session.id),
      recording: isRecording,
    });
    if (action === "idle") return;
    mapEntryTailDoneRef.current = true;
    if (action === "help") {
      setShowWelcomePanel(true);
      return;
    }
    void startRecording();
  }, [
    isRecording,
    session?.id,
    setShowWelcomePanel,
    settingsRoute,
    showWelcomeModal,
    startRecording,
  ]);

  const mapSelectedStep = useMemo(
    () => sessionPlan?.steps?.find((row) => row.id === mapSelectedChapterId) ?? null,
    [mapSelectedChapterId, sessionPlan?.steps],
  );

  const openWorkDockLabels = useMemo(
    () => {
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
    },
    [
      activeStep?.id,
      openWorkIds,
      session?.id,
      session?.problem,
      sessionPlan?.steps,
      workAestheticById,
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

  const focusedChapterInsights = ileInsightsForChapter(
    sessionInsights,
    activeStep?.id,
  );
  const insightCountByChapterId = ileChapterInsightCounts(sessionInsights);
  const workCanvasInsightSlots = (
    <IleInsightTrophyStrip
      insights={focusedChapterInsights}
      slotCount={minInsightsPerChapter}
    />
  );

  const learnField = learnSessionFieldInput({
    sessionId: session?.id,
    problem: session?.problem,
    ileToken,
    ayclToken,
    blockId: sessionBlockId,
    workspaceId,
    metadata: session?.metadata,
  });

  const renderWorkCanvas = () => (
    <SessionChapterWorkCanvas
      session={session}
      activeChapterKey={activeChapterKey}
      whiteboardData={whiteboardData}
      whiteboardSceneData={whiteboardSceneData}
      isHeliosAssistantPending={isHeliosAssistantPending}
      setWhiteboardData={setWhiteboardData}
      setCanvasDirtyForHelios={setCanvasDirtyForHelios}
      sessionRef={sessionRef}
      whiteboardSceneDataRef={whiteboardSceneDataRef}
      updateActiveChapterWorkspace={updateActiveChapterWorkspace}
      canvasApplyElements={canvasApplyElements}
      canvasApplyNonce={canvasApplyNonce}
      handleCanvasPowActions={handleCanvasPowActions}
      handleAskCanvasSelection={handleAskCanvasSelection}
      sessionThoughtInterface={sessionThoughtInterface}
      activeStep={activeStep}
      activeChapterLabel={activeChapterLabel}
      chapterTitle={learnField?.chapterTitle || ""}
      chapterBrief={learnField?.chapterBrief || ""}
      fieldScope={learnField?.scope}
      workspaceId={learnField?.workspaceId || workspaceId}
      blockId={learnField?.blockId || sessionBlockId}
      ileToken={ileToken}
      ayclToken={ayclToken}
      recordSessionPowArtifact={recordSessionPowArtifact}
      sessionPowArtifactsRef={sessionPowArtifactsRef}
      insightWorkMarkRef={insightWorkMarkRef}
      setSessionInsights={setSessionInsights}
      onInsightKept={setKeptInsight}
      policyRef={policyRef}
      onLearnerWaitChange={onLearnerWaitChange}
    />
  );

  const renderSessionToolPanes = () => {
    if (!session) return null;
    return (
      <SessionToolPanes
        t={t}
        activeTool={activeTool}
        shouldBlockTools={Boolean(shouldBlockTools)}
        session={session}
        isRecording={isRecording}
        activeStep={activeStep}
        activeChapterLabel={activeChapterLabel}
        activeChapterKey={activeChapterKey}
        resolvedSessionMode={resolvedSessionMode}
        unsubmittedThoughts={sessionThoughtInterface.stashedThoughts}
        formingThoughtText={
          sessionThoughtInterface.getFormingText?.() ||
          sessionThoughtInterface.crystallizableText
        }
        canvasDirtyForHelios={canvasDirtyForHelios}
        stream={stream}
        museStatus={museStatus}
        museError={museError}
        museDeviceStatus={museDeviceStatus}
        eegChannelData={eegChannelData}
        bandPowers={bandPowers}
        onConnectMuse={handleConnectMuse}
        onDisconnectMuse={handleDisconnectMuse}
        isWebcamEnabled={isWebcamEnabled}
        onWebcamToggle={() => setIsWebcamEnabled((prev) => !prev)}
        latestFacialData={latestFacialData}
        onFacialData={handleFacialData}
        onFaceError={handleFaceError}
        isScreenCapturing={isScreenCapturing}
        onStartScreenCapture={handleStartScreenCapture}
        onStopScreenCapture={handleStopScreenCapture}
        screenshotCount={screenshotCount}
      />
    );
  };

  const canvasLoadingRef = useRef(true);
  const xaiReplyWaitRef = useRef(false);
  const onLearnerWaitChange = useCallback((wait: {
    canvasLoading: boolean;
    waitingForXaiReply: boolean;
  }) => {
    canvasLoadingRef.current = wait.canvasLoading;
    xaiReplyWaitRef.current = wait.waitingForXaiReply;
  }, []);
  const handleConfirmEndRef = useRef(handleConfirmEnd);
  handleConfirmEndRef.current = handleConfirmEnd;
  const sessionPurity = useIleSessionPurity({
    armed: Boolean(session && !showWelcomeModal && !showWelcomePanel && !isSaving),
    formingText: sessionThoughtInterface.crystallizableText,
    waitingForHelios: sessionThoughtInterface.isSending,
    canvasLoadingRef,
    xaiReplyWaitRef,
    stashCurrentTranscription: sessionThoughtInterface.stashCurrentTranscription,
    onDepleted: () => {
      void handleConfirmEndRef.current({ impure: true });
    },
  });
  const isHeliosVoicePlaying = useHeliosVoicePlaybackActive();

  if (isMobile) {
    return (
      <MobileBlockScreen
        product={ileToken ? "ile" : "session"}
        showDashboardLink={!ileToken && !ayclToken}
      />
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <LoadingStatusMessage message={t("common.loading")} />
      </div>
    );
  }

  if (isSaving && !sessionPurity.sessionEndedImpure) {
    return (
      <SessionPageLoading className="min-h-screen" message={t("session.savingSession")} />
    );
  }

  const selectedAesthetic = chromeSelectedAesthetic;

  if (showWelcomeModal) {
    return (
      <SessionWelcomeModal
        t={t}
        languageConfirmed={languageConfirmed}
        planLoading={planLoading}
        isPreparing={isPreparing}
        tutoringLanguage={tutoringLanguage}
        onTutoringLanguageChange={setTutoringLanguage}
        aestheticPackages={aestheticPackages}
        selectedAesthetic={selectedAesthetic}
        selectedAestheticId={selectedAestheticId}
        onSelectAesthetic={setSelectedAestheticId}
        aestheticsLoading={aestheticsLoading}
        chapterPlanStatus={chapterPlanStatus}
        powExpense={powExpense}
        onPowExpenseChange={(value) => setPowExpense(clampIlePowExpense(value))}
        insightSlotMax={insightSlotMax}
        onInsightSlotMaxChange={(value) =>
          setInsightSlotMax(clampIleTurnInsightSlotMax(value))
        }
        gatherMaxPerSession={gatherMaxPerSession}
        onGatherMaxPerSessionChange={(value) =>
          setGatherMaxPerSession(clampIleGatherMaxPerSession(value))
        }
        allowThoughtsPoolInsights={allowThoughtsPoolInsights}
        onAllowThoughtsPoolInsightsChange={setAllowThoughtsPoolInsights}
        allowParallelWork={allowParallelWork}
        onAllowParallelWorkChange={setAllowParallelWork}
        allowGatherResources={allowGatherResources}
        onAllowGatherResourcesChange={setAllowGatherResources}
        minInsightsPerChapter={minInsightsPerChapter}
        onMinInsightsPerChapterChange={(value) =>
          setMinInsightsPerChapter(clampIleMinInsightsPerChapter(value))
        }
        autoAdvance={autoAdvance}
        onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
        planError={planError}
        onConfirmSettings={handleConfirmSettings}
        onBackToWorkspace={() => {
          void pauseAndGoToDashboard();
        }}
        onReadyStart={handleWelcomeReadyStart}
        hasSessionPlan={Boolean(sessionPlan)}
        sessionId={session.id}
        sessionStartedAt={session.startedAt}
        sessionPlan={sessionPlan}
        resumeSession={resumeSession}
      />
    );
  }

  return (
    <SessionLiveStage
      activeStep={activeStep}
      activeTool={activeTool}
      allowEndSession={allowEndSession}
      availableCounts={availableCounts}
      ayclToken={ayclToken}
      bandPowers={bandPowers}
      canvasDirtyForHelios={canvasDirtyForHelios}
      chapterCloseReview={chapterCloseReview}
      completeTargetStepIdRef={completeTargetStepIdRef}
      dismissGatherWarning={dismissGatherWarning}
      eegChannelData={eegChannelData}
      endReason={endReason}
      error={error}
      gatherWarning={gatherWarning}
      gatheredResources={gatheredResources}
      handleConfirmEnd={handleConfirmEnd}
      handleConnectMuse={handleConnectMuse}
      handleDisconnectMuse={handleDisconnectMuse}
      handleIleSessionToolChange={handleIleSessionToolChange}
      handleMarkChapterDone={handleChapterDone}
      handleStartScreenCapture={handleStartScreenCapture}
      handleStopScreenCapture={handleStopScreenCapture}
      handleWelcomePlay={handleWelcomePlay}
      ileToken={ileToken}
      isMuted={isMuted}
      isProjectMode={isProjectMode}
      isScreenCapturing={isScreenCapturing}
      isStartingSession={isStartingSession}
      isWebcamEnabled={isWebcamEnabled}
      minInsightsPerChapter={minInsightsPerChapter}
      museDeviceStatus={museDeviceStatus}
      museStatus={museStatus}
      muteTimerRef={muteTimerRef}
      openWorkDockLabels={openWorkDockLabels}
      openWorkCount={openWorkIds.length}
      pauseAndGoToDashboard={pauseAndGoToDashboard}
      renderSessionToolPanes={renderSessionToolPanes}
      renderWorkCanvas={renderWorkCanvas}
      resourceScopeChapterId={resourceScopeChapterId}
      screenCaptureRef={screenCaptureRef}
      selectedAesthetic={selectedAesthetic}
      session={session}
      sessionBlockId={sessionBlockId}
      sessionInsights={sessionInsights}
      keptInsight={keptInsight}
      sessionPowArtifacts={sessionPowArtifacts}
      sessionPowThoughts={sessionPowThoughts}
      sessionResourcesOpen={sessionResourcesOpen}
      sessionThoughtInterface={sessionThoughtInterface}
      setActiveTool={setActiveTool}
      setChapterCloseReview={setChapterCloseReview}
      setError={setError}
      setIsMuted={setIsMuted}
      setIsWebcamEnabled={setIsWebcamEnabled}
      setMuteRemaining={setMuteRemaining}
      setSessionResourcesOpen={setSessionResourcesOpen}
      setShowEndDialog={setShowEndDialog}
      setShowPlanCompleteModal={setShowPlanCompleteModal}
      setShowWelcomePanel={setShowWelcomePanel}
      showEndDialog={showEndDialog}
      showPlanCompleteModal={showPlanCompleteModal}
      showWelcomeModal={showWelcomeModal}
      showWelcomePanel={showWelcomePanel}
      sessionEndedImpure={sessionPurity.sessionEndedImpure}
      stream={stream}
      t={t}
      tutoringLanguage={tutoringLanguage}
      welcomeOpenNonce={welcomeOpenNonce}
      workCanvasInsightSlots={workCanvasInsightSlots}
      workspaceId={workspaceId}
    />
  );
}
