"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import { useRouter } from "next/navigation";
import { pauseSession, type Session, type SessionPlan, type Probe, type ToolName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { MobileBlockScreen } from "./MobileBlockScreen";
import { useSessionChrome } from "@/components/session-view/use-session-chrome";
import { useSessionRuntime } from "@/components/session-view/use-session-runtime";
import { useSessionMutate } from "@/components/session-view/use-session-mutate";
import { useSessionSpeech } from "@/components/session-view/use-session-speech";
import { useSessionIdle, type IlePowInterruptionHandler } from "@/components/session-view/use-session-idle";
import { useSessionPhase } from "@/components/session-view/use-session-phase";
import { useSessionHeliosPrep } from "@/components/session-view/use-session-helios-prep";
import { LoadingStatusMessage } from "./LoadingStatusMessage";
import {
  buildPowParticipantIdentity,
  type PowParticipantIdentity,
} from "@/lib/session-participant-identity";
import { type ChatMessage, type PendingChatMessage, type StuckAction, postIleSessionChat } from "@/lib/session-chat-client";
import { useIleBlurScreenshare } from "@/lib/useIleBlurScreenshare";
import { closeIleImDoneAnswering } from "@/lib/ile-im-done-answering";
import { formatSpeechTranscriptDisplay } from "@/lib/useSessionThoughtInterface";
import { LocalInferenceManager, type InitProgress } from "@/lib/local-inference";
import { LocalContextBuffer } from "@/lib/local-context";
import { useVoiceActivity } from "@/lib/useVoiceActivity";
import { useThinkAloudTranscript, type SpeechTranscriptEntry } from "@/lib/useThinkAloudTranscript";
import { useHeliosVoicePlaybackActive } from "@/lib/useHeliosVoicePlayback";
import type { HeliosTurnMode } from "@/components/thought-ui/ThoughtUi";
import { translateWithLocale, useI18n } from "@/lib/i18n";
import { coerceSpokenLocale, type SpokenLocale } from "@/lib/tutoring-languages";
import { DEFAULT_INITIAL_CHAPTERS, type InitialChaptersLevel } from "@/lib/initial-chapters";
import { SessionWelcomeModal } from "@/components/session-view/session-welcome-modal";
import { SessionToolPanes } from "@/components/session-view/session-tool-panes";
import { SessionThoughtPane } from "@/components/session-view/session-thought-pane";
import { SessionChrome } from "@/components/session-view/session-chrome";
import { IleVoiceBar } from "@/components/session-view/ile-voice-bar";
import { ChapterMapPanel } from "@/components/ChapterMapPanel";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { isIleMapOverlayTool } from "@/lib/ile-map-chrome";
import { useIleGatherResources } from "@/components/session-view/use-ile-gather-resources";
import {
  blockHasUnseenGatherNotification,
  ileGatherJobTileId,
  markGatherResourcesSeen,
  parseGatherSeenBlockIds,
} from "@/lib/block-circular-menu";
import { toIlePowDisplayCounts } from "@/lib/ile-pow-counters";
import { ileTimDelayProgressFraction } from "@/lib/ile-tim-chapter-complete";
import { ileSessionNameFromMetadata } from "@/lib/ile-session-name";
import {
  isIleChapterThoughtsLocked,
  isIleProjectMode,
  resolveIleDurableSessionMode,
  type IleSessionMode,
} from "@/lib/ile-mode";
import { openIleWordBoxTool } from "@/lib/ile-word-boxes";
import { shouldShowHeliosReplyForChapter } from "@/lib/chapter-load-control";
import { useSessionChapterWorkspaces } from "@/lib/useSessionChapterWorkspaces";

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
  /** Opened from Previous Sessions — continue stored chapters, no density picker. */
  resumeSession?: boolean;
  ayclToken?: string;
  /** Private token for guest ILE practice links (`/ile/session/{token}`). */
  ileToken?: string;
  /**
   * When false, hide End Session / stop-end chrome for this session
   * (guest ILE links can configure this; default true).
   */
  showEndSession?: boolean;
  /** Share URL query params → param-scoped guest identity for PoW. */
  entryQueryParams?: Record<string, string | string[]>;
  /** Server-resolved guest/assigned identity for share links. */
  participantIdentity?: PowParticipantIdentity | null;
  /**
   * ILE shell mode from durable link/session. learning (default) | project.
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

  // Probes
  const [activeProbe, setActiveProbe] = useState<Probe | null>(null);
  const [viewingProbeIndex, setViewingProbeIndex] = useState<number>(-1);

  // Session ending / saving
  const [isSaving, setIsSaving] = useState(false);
  // Tutor-end dialog
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endReason, setEndReason] = useState("");
  const [showSaveExitNameDialog, setShowSaveExitNameDialog] = useState(false);
  const [saveExitName, setSaveExitName] = useState("");

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
    chatMessages,
    pendingChatMessage,
    whiteboardData,
    whiteboardSceneData,
    notebookContent,
    canvasDirtyForHelios,
    notebookDirtyForHelios,
    updateChapterWorkspace,
    updateActiveChapterWorkspace,
    setChatMessages,
    setPendingChatMessage,
    setWhiteboardData,
    setNotebookContent,
    setCanvasDirtyForHelios,
    setNotebookDirtyForHelios,
  } = useSessionChapterWorkspaces(sessionId, sessionPlan);

  const activeChapterLabel = activeStep ? `Chapter ${activeChapterIndex + 1}` : "this chapter";

  const [objectives, setObjectives] = useState<string[]>([]);
  const [objectiveStatuses, setObjectiveStatuses] = useState<("red" | "yellow" | "green" | "blue")[]>([]);

  // Archive/Focus probe state
  const [archivingProbeId, setArchivingProbeId] = useState<string | null>(null);
  
  // Plan complete modal (shown when all steps are done)
  const [showPlanCompleteModal, setShowPlanCompleteModal] = useState(false);

  // Local inference
  const [localInferenceEnabled, setLocalInferenceEnabled] = useState(false);
  const localInferenceEnabledRef = useRef(false);
  const localContextRef = useRef<LocalContextBuffer | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<InitProgress | null>(null);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [webGPUAvailable, setWebGPUAvailable] = useState(false);
  const [prepStage, setPrepStage] = useState<"plan" | "model" | "done">("plan");

  useEffect(() => {
    setWebGPUAvailable(LocalInferenceManager.isWebGPUAvailable());
  }, []);

  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [heliosWidgetOpen, setHeliosWidgetOpen] = useState(false);
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
  const [initialChapters, setInitialChapters] = useState<InitialChaptersLevel>(DEFAULT_INITIAL_CHAPTERS);
  /**
   * Whether a persisted chapter map already exists for this session.
   * Tracked separately from `sessionPlan` so the regenerate UI stays stable
   * even while plan state is loading / briefly cleared.
   * - unknown: still loading from DB
   * - empty: no chapters yet → size picker is interactive
   * - exists: chapters present → size picker grayed + regenerate checkbox
   */
  const [chapterPlanStatus, setChapterPlanStatus] = useState<"unknown" | "empty" | "exists" | "failed">("unknown");
  /** When a chapter set already exists, keep size controls grayed until user opts in. */
  const [regenerateChapters, setRegenerateChapters] = useState(false);


  const lastDialogueUserTurn = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "user" && message.content.trim()) {
        return { id: message.id, content: message.content };
      }
    }
    return null;
  }, [chatMessages]);

  const lastDialogueAssistantTurn = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "assistant" && !message.pending && message.content.trim()) {
        return { id: message.id, content: message.content };
      }
    }
    return null;
  }, [chatMessages]);

  const [heliosReplyChapterId, setHeliosReplyChapterId] = useState<string | null>(null);
  const lastAssistantTurnIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = lastDialogueAssistantTurn?.id ?? null;
    if (id && id !== lastAssistantTurnIdRef.current) {
      lastAssistantTurnIdRef.current = id;
      setHeliosReplyChapterId(activeChapterKey);
    }
  }, [activeChapterKey, lastDialogueAssistantTurn?.id]);
  const chapterWidgetAssistantTurn = shouldShowHeliosReplyForChapter({
    activeChapterId: activeChapterKey,
    replyChapterId: heliosReplyChapterId,
  })
    ? lastDialogueAssistantTurn
    : null;

  const isHeliosAssistantPending = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role === "assistant" && message.pending) return true;
      if (message.role === "assistant" && !message.pending) break;
    }
    return false;
  }, [chatMessages]);

  const chapterDialoguePrompt = activeStep?.description?.trim() || t("session.chapterPromptFallback");

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

  // (Prep material state used to live here for the now-removed
  // Practice/Theory side panels. That content has been merged into
  // the Helios chat surface — see fetchAndInjectPrepIntoChat below.)

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

    if (prevTool && prevTool !== activeTool) {
      logTool(prevTool as ToolName, "close", { via: "tool_switch" });
    }
    logTool(activeTool as ToolName, "open", { via: "tool_switch" });
    // Feed tool events into local context buffer
    if (localInferenceEnabledRef.current && localContextRef.current) {
      localContextRef.current.addToolEvent(`opened ${activeTool}`);
    }
    
    prevToolRef.current = activeTool;
  }, [activeTool, session?.id, session?.startedAt]);

  const handlePowInterruptionRef = useRef<IlePowInterruptionHandler>(() => {});

  const sessionRef = useRef<Session | null>(null);
  useSessionHeliosPrep({
    session,
    sessionRef,
    sessionPlanRef,
    activeChapterKey,
    activeChapterIndexRef,
    ensureVisible,
    setActiveTool,
    updateChapterWorkspace,
    setChatMessages,
    tutoringLanguage,
    isPaused,
    isRecording,
    setIsPaused,
  });
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
    logs,
    setLogs,
    logsRef,
    transferHealth,
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
    addSessionLog,
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
    recordSessionPowArtifact,
  } = useSessionRuntime({
    sessionRef,
    sessionId: session?.id,
    sessionBlockId:
      typeof session?.metadata?.block_id === "string" ? session.metadata.block_id : undefined,
    ileToken,
    entryQueryParams,
    localInferenceEnabledRef,
    localContextRef,
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
  const completeTargetStepIdRef = useRef<string | null>(null);
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
    recordSessionPowArtifact,
    onOpenResources: () => setActiveTool("plan-resources"),
    ileToken,
    ayclToken,
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

  const [heliosTurnMode, setHeliosTurnMode] = useState<HeliosTurnMode>("idle");
  const {
    persistPlanSteps,
    handleActiveChapterIndexChange,
    handleEnsureChapterPositions,
    handleLoadChapter,
    handleAcceptTimChapter,
    handleRejectTimChapter,
    handleAddChapter,
    handleUpdateChapter,
    chapterReloadNonce,
    fetchChapterFollowUps,
    handleSelectChapterFollowUp,
    handleMarkChapterDone,
    handleMarkChapterUndone,
    handleTimChapterMapExpansion,
    chapterFollowUpsById,
    chapterFollowUpsLoadingId,
    chapterFollowUpsErrorById,
    ilePromptMaterials,
    displayProjectChapterExercise,
    projectThoughtsByChapter,
    setProjectThoughtsByChapter,
    projectThoughtsByChapterRef,
    activeProjectChapterId,
    activeProjectLists,
  } = useSessionMutate({
    session,
    sessionRef,
    sessionPlanRef,
    setSessionPlan,
    resolvedSessionMode,
    isProjectMode,
    chapterThoughtsLocked,
    activeStep,
    activeChapterKey,
    activeChapterIndexRef,
    setActiveChapterIndex,
    chapterFocusSinceRef,
    chapterLoading,
    setChapterLoading,
    setChapterLoadingIndex,
    chapterWorkspaces,
    updateChapterWorkspace,
    guestAccessBody,
    logToolRef,
    t,
    tutoringLanguage,
    locale,
    setHeliosTurnMode,
    isRecording,
    isPaused,
    setIsPaused,
    setShowPlanCompleteModal,
    chapterDialoguePrompt,
    sessionPowArtifactsRef,
    setChapterCloseReview,
  });
  const activeChapterFollowUps = chapterFollowUpsById[activeProjectChapterId] ?? [];
  const activeChapterFollowUpsLoading = chapterFollowUpsLoadingId === activeProjectChapterId;
  const activeChapterFollowUpsError = chapterFollowUpsErrorById[activeProjectChapterId] ?? null;

  const bumpUserActivityRef = useRef<() => void>(() => {});
  const { handlePowInterruption, clearPendingInterruption, mapDelay, beginMapDelay, clearMapDelay } = useSessionIdle({
    activeChapterKey,
    updateChapterWorkspace,
    setHeliosTurnMode,
    handlePowInterruptionRef,
    onChapterMapExpand: handleTimChapterMapExpansion,
  });

  const [timDelayNow, setTimDelayNow] = useState(() => Date.now());
  useEffect(() => {
    if (!mapDelay) return;
    const id = window.setInterval(() => setTimDelayNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [mapDelay]);
  const timDelayProgress = ileTimDelayProgressFraction(mapDelay, timDelayNow);
  const timBlockActionProgress = useMemo(() => {
    if (!mapDelay?.stepId || !(timDelayProgress > 0)) return {};
    return {
      [mapDelay.stepId]: {
        running: true,
        completed: timDelayProgress,
        total: 1,
      },
    };
  }, [mapDelay, timDelayProgress]);

  const submitHeliosChatMessageNow = useCallback(async (
    message: string,
    imageDataUrl?: string,
  ) => {
    const text = message.trim();
    if (!text || !session) return;

    const chapterKey = activeChapterKey;
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: text,
      imageDataUrl,
    };
    const placeholderId = `${Date.now()}-pending`;
    updateChapterWorkspace(chapterKey, workspace => ({
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
          messages: [...existingMessages, userMsg].map(m => ({ role: m.role, content: m.content, imageDataUrl: m.imageDataUrl })),
        });
      const content = ok && typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : errorMessage || t('heliosChat.errorMessage');
      updateChapterWorkspace(chapterKey, workspace => ({
        chatMessages: workspace.chatMessages.map(message =>
          message.id === placeholderId
            ? { ...message, content, pending: false }
            : message
        ),
      }));
    } catch (error) {
      console.error("Helios direct chat error:", error);
      updateChapterWorkspace(chapterKey, workspace => ({
        chatMessages: workspace.chatMessages.map(message =>
          message.id === placeholderId
            ? { ...message, content: t('heliosChat.errorMessage'), pending: false }
            : message
        ),
      }));
    }
  }, [activeChapterIndex, activeChapterKey, activeStep, chapterWorkspaces, session, sessionPlan, t, tutoringLanguage, updateChapterWorkspace, resolvedSessionMode, guestAccessBody]);

  useEffect(() => {
    if (!pendingChatMessage) return;
    const text = typeof pendingChatMessage === "string"
      ? pendingChatMessage
      : pendingChatMessage.text;
    if (!text?.trim()) {
      setPendingChatMessage(null);
      return;
    }
    const imageDataUrl = typeof pendingChatMessage === "string"
      ? undefined
      : pendingChatMessage.imageDataUrl;
    void submitHeliosChatMessageNow(text, imageDataUrl).finally(() => setPendingChatMessage(null));
  }, [pendingChatMessage, setPendingChatMessage, submitHeliosChatMessageNow]);

  const {
    sessionThoughtInterface,
    sessionThoughtHistory,
    handleProjectStash,
    handleProjectSubmitToSolution,
    handleProjectPromote,
    handleProjectDemote,
    mutateActiveProjectThoughts,
    handleSubmitToHelios,
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
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedSecondsRef = useRef(0);
  const muteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const consumeSpeechTranscriptEntriesRef = useRef<() => SpeechTranscriptEntry[]>(() => []);
  const requeueSpeechTranscriptEntriesRef = useRef<(entries: SpeechTranscriptEntry[]) => void>(() => {});
  const activeToolRef = useRef(activeTool);
  const objectivesRef = useRef(objectives);
  const isRecordingRef = useRef(isRecording);
  const autoAdvanceRef = useRef(autoAdvance);

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
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { localInferenceEnabledRef.current = localInferenceEnabled; }, [localInferenceEnabled]);
  useEffect(() => { sessionPlanRef.current = sessionPlan; }, [sessionPlan]);
  useEffect(() => { activeChapterIndexRef.current = activeChapterIndex; }, [activeChapterIndex]);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, [stream, isMuted]);

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
    handleArchiveProbe,
    handleToggleFocus,
    handleConfirmEnd,
    handleConfirmSettings,
    handleContinueWithoutInference,
    handleWelcomeReadyStart,
  } = useSessionPhase({
    session,
    setSession,
    sessionRef,
    sessionId,
    guestAccessKind,
    ayclToken,
    ileToken,
    guestAccessBody,
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
    setRegenerateChapters,
    regenerateChapters,
    objectives,
    setObjectives,
    setObjectiveStatuses,
    setActiveProbe,
    setViewingProbeIndex,
    setArchivingProbeId,
    isPreparing,
    setIsPreparing,
    setPrepStage,
    setModelLoadError,
    setModelLoadProgress,
    localInferenceEnabled,
    setLocalInferenceEnabled,
    localInferenceEnabledRef,
    localContextRef,
    initialChapters,
    resolvedSessionMode,
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
  });


  const loadingChapterLabel = chapterLoadingIndex != null
    ? sessionPlan?.steps?.[chapterLoadingIndex]?.description ?? null
    : null;

  const handleCompactDoneAnswering = useCallback(async () => {
    await closeIleImDoneAnswering({
      thoughts: sessionThoughtInterface.stashedThoughts,
      formingText:
        sessionThoughtInterface.getFormingText?.() ||
        sessionThoughtInterface.crystallizableText,
      sendThought: (text, ids) =>
        sessionThoughtInterface.sendThought(text, ids, { skipTrace: true }),
      logEndOfChainOfThought: (event) => sessionThoughtInterface.logTrace(event),
      onClearForming: () => sessionThoughtInterface.clearCurrentTranscription(),
    });
  }, [sessionThoughtInterface]);

  const renderChapterThoughtPane = (replica: boolean) => {
    if (!session) return null;
    return (
    <SessionThoughtPane
      replica={replica}
      activeChapterKey={activeChapterKey}
      chapterReloadNonce={chapterReloadNonce}
      isProjectMode={isProjectMode}
      participantIdentity={participantIdentity}
      lastUserTurn={lastDialogueUserTurn}
      lastAssistantTurn={isProjectMode ? null : chapterWidgetAssistantTurn}
      isAssistantPending={isHeliosAssistantPending}
      heliosTurnMode={heliosTurnMode}
      chapterPrompt={isProjectMode ? displayProjectChapterExercise : chapterDialoguePrompt}
      userInitial={userInitial}
      isSessionActive={isRecording && !isPaused}
      isInitializing={planLoading}
      isChapterLoading={chapterLoading}
      loadingChapterLabel={loadingChapterLabel}
      hasPlanSteps={(sessionPlan?.steps?.length ?? 0) > 0}
      sessionId={session.id}
      ttsLanguage={tutoringLanguage}
      selectedAesthetic={chromeSelectedAesthetic}
      thought={sessionThoughtInterface}
      chapterThoughtsLocked={chapterThoughtsLocked}
      projectStash={activeProjectLists.stash}
      projectSolution={activeProjectLists.submitted}
      chapterFollowUps={activeChapterFollowUps}
      chapterFollowUpsLoading={activeChapterFollowUpsLoading}
      chapterFollowUpsError={activeChapterFollowUpsError}
      onSelectChapterFollowUp={(s) => void handleSelectChapterFollowUp(s)}
      onProjectStash={handleProjectStash}
      onProjectSubmitToSolution={handleProjectSubmitToSolution}
      onOpenWordBoxTool={(action) => {
        const payload = openIleWordBoxTool({
          tool: action.tool,
          query: action.query,
          setActiveTool,
          setPrefillQuery: setToolPrefillQuery,
        });
        if (payload?.query) ensureVisible("tools");
      }}
      chapterActions={
        activeStep
          ? {
              sessionId: session.id,
              ayclToken,
              ileToken,
              locale,
              chapterId: activeStep.id,
              chapterIndex: activeChapterIndex,
              chapterDescription: activeStep.description || "",
              chapterCompleted:
                activeStep.status === "completed" || activeStep.status === "skipped",
              activeChapterIndex,
              onChapterDone: (opts) => {
                beginMapDelay(activeStep.id);
                void (async () => {
                  try {
                    await flushRemainingIlePow();
                  } catch {
                    /* Review still runs on whatever was already recorded. */
                  }
                  const closed = await handleMarkChapterDone(opts);
                  if (!closed) clearMapDelay();
                })();
              },
              onUpdateChapter: handleUpdateChapter,
              closeReviewBlocked: Boolean(chapterCloseReview && !chapterCloseReview.canClose),
              closeReviewReason: chapterCloseReview?.reason ?? null,
              onGatherResources,
              gatherBusy,
              gatherWarning,
              onDismissGatherWarning: dismissGatherWarning,
            }
          : null
      }
    />
    );
  };

  const {
    notifyLeaveTab,
    openManualPicInPic,
    showManualPicInPic,
  } =
    useIleBlurScreenshare({
    enabled: Boolean(isRecording && !isPaused),
    isScreenSharing: isScreenCapturing,
    startScreenshare: handleStartScreenCapture,
    onDoneAnswering: handleCompactDoneAnswering,
    captureStream: stream,
    compact: {
      formingText: sessionThoughtInterface.crystallizableText,
      speechDisplay: formatSpeechTranscriptDisplay({
        text: sessionThoughtInterface.crystallizableText,
        speechError: sessionThoughtInterface.speechError,
        speechSupported: sessionThoughtInterface.speechSupported,
        isListening: sessionThoughtInterface.isListening,
        enabled: sessionThoughtInterface.speechEnabled,
      }),
      speechError: sessionThoughtInterface.speechError,
      speechSupported: sessionThoughtInterface.speechSupported,
      isListening: sessionThoughtInterface.isListening,
      speechEnabled: sessionThoughtInterface.speechEnabled,
      isScreenSharing: isScreenCapturing,
    },
    renderCompact: () => renderChapterThoughtPane(true),
  });

  const isSpeaking = useVoiceActivity({
    stream,
    isRecording,
    isPaused,
  });
  const isHeliosVoicePlaying = useHeliosVoicePlaybackActive();

  const thinkAloudTranscript = useThinkAloudTranscript({
    enabled: false,
    tutoringLanguage,
  });
  consumeSpeechTranscriptEntriesRef.current = thinkAloudTranscript.consumePendingTranscriptEntries;
  requeueSpeechTranscriptEntriesRef.current = thinkAloudTranscript.requeueTranscriptEntries;

  if (isMobile) {
    return (
      <MobileBlockScreen
        product={ileToken ? "ile" : "session"}
        showDashboardLink={!ileToken && !ayclToken}
      />
    );
  }

  if (!session || isSaving) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
        <LoadingStatusMessage
          message={isSaving ? t("session.savingSession") : t("common.loading")}
        />
      </div>
    );
  }

  const selectedAesthetic = chromeSelectedAesthetic;

  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {showWelcomeModal && (
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
          regenerateChapters={regenerateChapters}
          onRegenerateChaptersChange={setRegenerateChapters}
          initialChapters={initialChapters}
          onInitialChaptersChange={setInitialChapters}
          autoAdvance={autoAdvance}
          onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
          localInferenceEnabled={localInferenceEnabled}
          onToggleLocalInference={() => setLocalInferenceEnabled(!localInferenceEnabled)}
          webGPUAvailable={webGPUAvailable}
          planError={planError}
          modelLoadError={modelLoadError}
          modelLoadProgress={modelLoadProgress}
          prepStage={prepStage}
          onConfirmSettings={handleConfirmSettings}
          onContinueWithoutInference={handleContinueWithoutInference}
          onReadyStart={handleWelcomeReadyStart}
          hasSessionPlan={Boolean(sessionPlan)}
          sessionId={session.id}
          sessionStartedAt={session.startedAt}
          sessionPlan={sessionPlan}
          resumeSession={resumeSession}
        />
      )}

      <SessionChrome
        t={t}
        activeTool={activeTool}
        onToolChange={(tool) => {
          if (tool === activeTool && isIleMapOverlayTool(tool)) {
            setActiveTool("chapters");
            return;
          }
          handleToolChange(tool);
        }}
        problem={session.problem}
        workspaceId={session.metadata?.workspace_id as string | undefined}
        onBackToDashboard={() => {
          setSaveExitName(ileSessionNameFromMetadata(session.metadata) ?? "");
          setShowSaveExitNameDialog(true);
        }}
        showSaveExitNameDialog={showSaveExitNameDialog}
        saveExitName={saveExitName}
        onSaveExitNameChange={setSaveExitName}
        onCancelSaveExitName={() => setShowSaveExitNameDialog(false)}
        onConfirmSaveExitName={() => {
          setShowSaveExitNameDialog(false);
          void pauseAndGoToDashboard(saveExitName);
        }}
        onDiscardSaveExitName={() => {
          setShowSaveExitNameDialog(false);
          void pauseAndGoToDashboard(null, { persistSession: false });
        }}
        isRecording={isRecording}
        isPaused={isPaused}
        isWebcamEnabled={isWebcamEnabled}
        isScreenCapturing={isScreenCapturing}
        screenShareStream={isScreenCapturing ? screenCaptureRef.current?.getStream() ?? null : null}
        onStopScreenCapture={handleStopScreenCapture}
        onTurnOffWebcam={() => setIsWebcamEnabled(false)}
        audioStream={stream}
        audioMuted={isMuted}
        onToggleAudioMute={() => {
          if (muteTimerRef.current) {
            clearTimeout(muteTimerRef.current);
            muteTimerRef.current = null;
          }
          setMuteRemaining(0);
          setIsMuted((muted) => !muted);
        }}
        museStatus={museStatus}
        museDeviceStatus={museDeviceStatus}
        museChannelData={eegChannelData}
        bandPowers={bandPowers}
        showOpenPicInPic={showManualPicInPic}
        onOpenPicInPic={openManualPicInPic}
        error={error}
        onDismissError={() => setError(null)}
        showWelcomeModal={showWelcomeModal}
        powCounts={toIlePowDisplayCounts(availableCounts, sessionPowArtifacts)}
        participantIdentity={participantIdentity}
        onCloseToolOverlay={() => setActiveTool("chapters")}
        heliosOpen={heliosWidgetOpen}
        onCloseHelios={() => setHeliosWidgetOpen(false)}
        introOpen={showWelcomePanel}
        introWidget={
          <SessionOnboardingGuide
            key={welcomeOpenNonce}
            variant="ile"
            presentation="sidebar"
            className="min-h-0"
            language={tutoringLanguage}
            showStartAction
            projectMode={isProjectMode}
            onStart={() => { void handleWelcomePlay(); }}
            isStarting={isStartingSession}
          />
        }
        allowEndSession={allowEndSession}
        showEndDialog={showEndDialog}
        onCancelEnd={() => setShowEndDialog(false)}
        onConfirmEnd={handleConfirmEnd}
        endReason={endReason}
        showPlanCompleteModal={showPlanCompleteModal}
        onCancelPlanComplete={() => setShowPlanCompleteModal(false)}
        onConfirmPlanComplete={() => {
          setShowPlanCompleteModal(false);
          if (allowEndSession) {
            handleConfirmEnd();
          }
        }}
        gatherWarning={gatherWarning}
        onDismissGatherWarning={dismissGatherWarning}
        closeReviewBlocked={Boolean(chapterCloseReview && !chapterCloseReview.canClose)}
        closeReviewReason={chapterCloseReview?.reason ?? null}
        onChapterDoneOverride={() => {
          void handleMarkChapterDone({
            closeOverride: true,
            stepId: completeTargetStepIdRef.current || activeStep?.id,
          });
        }}
        onDismissCloseReview={() => setChapterCloseReview(null)}
        map={
          <ChapterMapPanel
            plan={sessionPlan}
            sessionId={session.id}
            ayclToken={ayclToken}
            ileToken={ileToken}
            locale={locale}
            loading={planLoading}
            activeChapterIndex={activeChapterIndex}
            onWorkChapter={(stepId) => {
              const steps = sessionPlanRef.current?.steps ?? sessionPlan?.steps;
              const idx = steps?.findIndex((s) => s.id === stepId) ?? -1;
              if (idx >= 0 && idx !== activeChapterIndexRef.current) {
                void handleLoadChapter(idx);
              }
              setHeliosWidgetOpen(true);
            }}
            onAcceptTimChapter={(stepId) => {
              void handleAcceptTimChapter(stepId);
            }}
            onRejectTimChapter={(stepId) => {
              void handleRejectTimChapter(stepId);
            }}
            onUndoChapterDone={(stepId) => handleMarkChapterUndone(stepId)}
            onAddChapter={handleAddChapter}
            onEnsurePositions={handleEnsureChapterPositions}
            learnerScopeId={
              participantIdentity?.userId ||
              participantIdentity?.guestUserId ||
              ayclToken ||
              ileToken ||
              "local"
            }
            gatherJobs={gatherJobs}
            onOpenGatherResources={openGatheredResources}
            blockActionProgress={timBlockActionProgress}
            onMarkChapterCompleted={(stepId) => {
              completeTargetStepIdRef.current = stepId;
              beginMapDelay(stepId);
              void (async () => {
                const idx = sessionPlan?.steps?.findIndex((s) => s.id === stepId) ?? -1;
                if (idx >= 0 && idx !== activeChapterIndex) {
                  await handleLoadChapter(idx);
                }
                try {
                  await flushRemainingIlePow();
                } catch {
                  /* Review still runs on whatever was already recorded. */
                }
                const closed = await handleMarkChapterDone({ stepId });
                if (!closed) clearMapDelay();
              })();
            }}
            onGatherChapterResources={(stepId, description) => {
              void onGatherResources({
                blockId: sessionBlockId,
                chapterId: stepId,
                chapterDescription: description,
              });
            }}
            onSeeChapterResources={(stepId) => {
              setResourceScopeChapterId(stepId);
              setGatherSeenIds((prev) => markGatherResourcesSeen(prev, stepId));
              openGatheredResources({ tileId: stepId });
            }}
            onUpdateChapter={handleUpdateChapter}
            unseenGatherBlockIds={unseenGatherBlockIds}
            gatherReadyCountByBlock={gatherReadyCountByBlock}
          />
        }
        toolOverlay={
          <SessionToolPanes
            t={t}
            activeTool={activeTool}
            shouldBlockTools={Boolean(shouldBlockTools)}
            session={session}
            sessionPlan={sessionPlan}
            ayclToken={ayclToken}
            ileToken={ileToken}
            gatherBlockId={sessionBlockId}
            gatherChapterId={resourceScopeChapterId || activeStep?.id}
            gatheredResources={gatheredResources}
            locale={locale}
            planLoading={planLoading}
            activeChapterIndex={activeChapterIndex}
            chapterLoadingIndex={chapterLoadingIndex}
            isRecording={isRecording}
            activeStep={activeStep}
            participantIdentity={participantIdentity}
            activeChapterKey={activeChapterKey}
            whiteboardData={whiteboardData}
            whiteboardSceneData={whiteboardSceneData}
            onCanvasChange={(data) => {
              setWhiteboardData(data);
              setCanvasDirtyForHelios(true);
              if (sessionRef.current) {
                sessionRef.current = { ...sessionRef.current, metadata: { ...sessionRef.current.metadata, whiteboardData: data } };
              }
            }}
            onSceneChange={(data) => updateActiveChapterWorkspace({ whiteboardSceneData: data })}
            onSubmitToHelios={handleSubmitToHelios}
            chapterThoughtsLocked={chapterThoughtsLocked}
            canvasDirtyForHelios={canvasDirtyForHelios}
            notebookDirtyForHelios={notebookDirtyForHelios}
            isProjectMode={isProjectMode}
            activeChapterLabel={activeChapterLabel}
            notebookContent={notebookContent}
            onNotebookChange={(value) => {
              setNotebookContent(value);
              setNotebookDirtyForHelios(true);
            }}
            resolvedSessionMode={resolvedSessionMode}
            activeProjectLists={activeProjectLists}
            onProjectPromote={handleProjectPromote}
            onProjectDemote={handleProjectDemote}
            sessionThoughtHistory={sessionThoughtHistory}
            onSendThought={sessionThoughtInterface.sendThought}
            thoughtIsSending={sessionThoughtInterface.isSending}
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
            logs={logs}
            transferHealth={transferHealth}
            onClearLogs={() => {
              logsRef.current = [];
              setLogs([]);
            }}
            isMobile={isMobile}
            onLeaveIleTab={notifyLeaveTab}
            toolPrefillQuery={toolPrefillQuery}
          />
        }
        heliosWidget={renderChapterThoughtPane(false)}
        voiceBar={
          <IleVoiceBar
            thought={sessionThoughtInterface}
            activeTool={activeTool}
            onToolChange={(tool) => {
              if (tool === activeTool && isIleMapOverlayTool(tool)) {
                setActiveTool("chapters");
                return;
              }
              handleToolChange(tool);
            }}
            onBackToDashboard={() => {
              setSaveExitName(ileSessionNameFromMetadata(session.metadata) ?? "");
              setShowSaveExitNameDialog(true);
            }}
            errorNotification={Boolean(error)}
          />
        }
      />
    </div>
  );
}
