"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import { usePathname, useRouter } from "next/navigation";
import { type Session, type SessionPlan, type ToolName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { MobileBlockScreen } from "./MobileBlockScreen";
import { useSessionChrome } from "@/components/session-view/use-session-chrome";
import { useSessionRuntime } from "@/components/session-view/use-session-runtime";
import { useSessionMutate } from "@/components/session-view/use-session-mutate";
import { useSessionSpeech } from "@/components/session-view/use-session-speech";
import { useSessionIdle, type IlePowInterruptionHandler } from "@/components/session-view/use-session-idle";
import { useSessionPhase } from "@/components/session-view/use-session-phase";
import {
  useSessionRecording,
  useSessionRecordingState,
} from "@/components/session-view/use-session-recording";
import { useSessionField } from "@/components/session-view/use-session-field";
import {
  useSessionWelcome,
  useSessionWelcomeState,
} from "@/components/session-view/use-session-welcome";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionPageLoading } from "@/components/session-view/session-page-loading";
import {
  buildPowParticipantIdentity,
  type PowParticipantIdentity,
} from "@/lib/session-participant-identity";
import type { Tool } from "@/components/ToolsPanel";

import {
  type BlockCircularMenuActionId,
  type IleVoicePadSpec,
} from "@/lib/block-circular-menu";
import { ileInsightsForChapter } from "@/lib/learn-turn-insights";
import { isIleSessionSettingsPath } from "@/lib/learn-session-routes";
import { useI18n } from "@/lib/i18n";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import { ileBlockSessionFrame } from "@/lib/learn-canvas-session";
import { SessionWelcomeModal } from "@/components/session-view/session-welcome-modal";
import { SessionToolPanes } from "@/components/session-view/session-tool-panes";
import { SessionChapterWorkCanvas } from "@/components/session-view/session-chapter-canvas";
import { emptySessionPolicySnapshot } from "@/components/session-view/session-policy-context";
import { SessionLiveStage } from "@/components/session-view/session-live-stage";
import {
  isIleMapOverlayTool,
  isIleSessionModalTool,
} from "@/lib/learn-map-chrome";
import { useIleGatherResources } from "@/components/session-view/use-learn-gather-resources";

import {
  isIleChapterThoughtsLocked,
  isIleProjectMode,
  resolveIleDurableSessionMode,
  type IleSessionMode,
} from "@/lib/learn-mode";
import { useSessionChapterWorkspaces } from "@/lib/useSessionChapterWorkspaces";
import { useIleSessionPurity } from "@/components/session-view/use-learn-session-purity";
import { IleInsightTrophyStrip } from "@/components/session-view/learn-insight-trophies";
import { shouldLogIleSidebarToolSwitch } from "@/lib/learn-work-canvas-pow";
import { ileTimProgressByTileId } from "@/lib/learn-tim-chapter-complete";


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
  const { t, locale } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutoringLanguage, setTutoringLanguage] = useState<SpokenLocale>(() =>
    coerceSpokenLocale(locale),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState("");
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const sessionPlanRef = useRef<SessionPlan | null>(null);
  const recordingState = useSessionRecordingState();
  const {
    isRecording,
    isPaused,
    elapsedSeconds,
    elapsedSecondsRef,
    stream,
    setStream,
    isMuted,
    setIsMuted,
    setMuteRemaining,
    muteTimerRef,
  } = recordingState;
  const welcomeState = useSessionWelcomeState(sessionId);
  const {
    showWelcomeModal,
    setShowWelcomeModal,
    languageConfirmed,
    setLanguageConfirmed,
    isPreparing,
    setIsPreparing,
    chapterPlanStatus,
    setChapterPlanStatus,
    powExpense,
    setPowExpense,
    insightSlotMax,
    setInsightSlotMax,
    gatherMaxPerSession,
    setGatherMaxPerSession,
    allowThoughtsPoolInsights,
    setAllowThoughtsPoolInsights,
    allowParallelWork,
    setAllowParallelWork,
    allowGatherResources,
    setAllowGatherResources,
    minInsightsPerChapter,
    setMinInsightsPerChapter,
    autoAdvance,
    setAutoAdvance,
  } = welcomeState;

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

  const activeChapterLabel = activeStep ? `Chapter ${activeChapterIndex + 1}` : "this chapter";

  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);
  const [voicePad, setVoicePad] = useState<IleVoicePadSpec | null>(null);
  const voicePadActionRef = useRef<(id: BlockCircularMenuActionId) => void>(() => {});
  const openWorkIdsRef = useRef<string[]>([]);
  const [chapterCloseReview, setChapterCloseReview] = useState<{
    canClose: boolean;
    reason: string;
  } | null>(null);
  const handlePauseRef = useRef<() => Promise<void>>(async () => {});
  const {
    isMobile,
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
    setPaneVisibility,
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

  const resolvedSessionMode: IleSessionMode = useMemo(() => {
    return resolveIleDurableSessionMode({
      sessionModeProp,
      metadata: (session?.metadata as Record<string, unknown> | undefined) ?? null,
    });
  }, [sessionModeProp, session?.metadata]);
  const isProjectMode = isIleProjectMode(resolvedSessionMode);
  const chapterThoughtsLocked =
    isProjectMode && isIleChapterThoughtsLocked(activeStep?.status);

  useEffect(() => {
    if (!session?.id || !activeTool) return;
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

  const [resourceScopeChapterId, setResourceScopeChapterId] = useState<string | null>(null);
  const [sessionResourcesOpen, setSessionResourcesOpen] = useState(false);
  const completeTargetStepIdRef = useRef<string | null>(null);
  const insightWorkMarkRef = useRef(0);
  const {
    availableCounts,
    gatherWarning,
    gatheredResources,
    dismissGatherWarning,
    tryStartWork,
  } = useIleGatherResources({
    sessionId: session?.id,
    workspaceId:
      typeof session?.metadata?.workspace_id === "string"
        ? session.metadata.workspace_id
        : undefined,
    blockId:
      typeof session?.metadata?.block_id === "string" ? session.metadata.block_id : undefined,
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

  const {
    handleLoadChapter,
    handleMarkChapterDone,
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
    setIsPaused: recordingState.setIsPaused,
    setShowPlanCompleteModal,
    chapterDialoguePrompt,
    sessionPowArtifactsRef,
    sessionPowTypedRef,
    setChapterCloseReview,
  });

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

  const { startRecording, stopRecording, handlePause, handleResume } = useSessionRecording({
    ...recordingState,
    session,
    setSession,
    sessionRef,
    guestAccessKind,
    ayclToken,
    ileToken,
    router,
    t,
    setError,
    setIsSaving,
    whiteboardData,
    notebookContent,
    handlePauseRef,
    openWorkIdsRef,
    flushRemainingIlePow,
    handleDisconnectMuse,
    handleConnectMuse,
    isScreenCapturing,
    isWebcamEnabled,
    setIsWebcamEnabled,
    setIsScreenCapturing,
    museStatus,
    screenCaptureRef,
  });

  const policyRef = useRef(emptySessionPolicySnapshot());
  const {
    pauseAndGoToDashboard,
    handleConfirmEnd,
  } = useSessionPhase({
    session,
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
    isRecording,
    isPaused,
    elapsedSeconds,
    setElapsedSeconds: recordingState.setElapsedSeconds,
    setIsPaused: recordingState.setIsPaused,
    setTutoringLanguage,
    setLanguageConfirmed,
    setSessionPlan,
    sessionPlanRef,
    setPlanLoading,
    setPlanError,
    setChapterPlanStatus,
    setObjectives,
    setObjectiveStatuses,
    setShowEndDialog,
    handleDisconnectMuse,
    flushRemainingIlePow,
    handlePause,
    stopRecording,
    openWorkIdsRef,
    policyRef,
  });

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

  const {
    whiteboardSceneDataRef,
    canvasApplyNonce,
    canvasApplyElements,
    openWorkIds,
    sessionInsights,
    setSessionInsights,
    keptInsight,
    setKeptInsight,
    learnField,
    workspaceId,
    sessionBlockId,
    handleCanvasPowActions,
    handleAskCanvasSelection,
    openWorkDockLabels,
    handleConfirmSettings: handleConfirmSettingsField,
    handleWelcomeReadyStart: handleWelcomeReadyStartField,
  } = useSessionField({
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
    setIsPaused: recordingState.setIsPaused,
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
  });

  const { handleConfirmSettings, handleWelcomeReadyStart, handleWelcomePlay } = useSessionWelcome({
    sessionId,
    session,
    sessionRef,
    ileToken,
    ayclToken,
    resumeSession,
    pathname,
    router,
    settingsRoute,
    showWelcomeModal,
    setShowWelcomeModal,
    setShowWelcomePanel,
    setIsStartingSession,
    applyIleChapterGridStartup,
    helpPreviousLayoutRef,
    setPaneVisibility,
    isRecording,
    isPaused,
    startRecording,
    handleResume,
    minInsightsPerChapter,
    handleConfirmSettingsField,
    handleWelcomeReadyStartField,
  });

  useEffect(() => {
    sessionPlanRef.current = sessionPlan;
  }, [sessionPlan]);
  useEffect(() => {
    activeChapterIndexRef.current = activeChapterIndex;
  }, [activeChapterIndex]);

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
    [activeTool, handleToolChange, setActiveTool, setShowWelcomePanel],
  );

  const focusedChapterInsights = ileInsightsForChapter(
    sessionInsights,
    activeStep?.id,
  );
  const workCanvasInsightSlots = (
    <IleInsightTrophyStrip
      insights={focusedChapterInsights}
      slotCount={minInsightsPerChapter}
    />
  );

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
        onPowExpenseChange={setPowExpense}
        insightSlotMax={insightSlotMax}
        onInsightSlotMaxChange={setInsightSlotMax}
        gatherMaxPerSession={gatherMaxPerSession}
        onGatherMaxPerSessionChange={setGatherMaxPerSession}
        allowThoughtsPoolInsights={allowThoughtsPoolInsights}
        onAllowThoughtsPoolInsightsChange={setAllowThoughtsPoolInsights}
        allowParallelWork={allowParallelWork}
        onAllowParallelWorkChange={setAllowParallelWork}
        allowGatherResources={allowGatherResources}
        onAllowGatherResourcesChange={setAllowGatherResources}
        minInsightsPerChapter={minInsightsPerChapter}
        onMinInsightsPerChapterChange={setMinInsightsPerChapter}
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
