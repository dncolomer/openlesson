"use client";

import type { Tool } from "@/components/ToolsPanel";
import type { InsightSummary } from "@/lib/insights";
import type { Session } from "@/lib/storage";
import { IleMapInsightsWidget } from "@/components/session-view/ile-insight-trophies";
import { IleSessionImpurityScreen, IleSilenceRestScreen, mountIleSilenceScreen } from "@/components/session-view/ile-silence-lock-screen";
import { IleVoiceBar, IleVoiceBarActions } from "@/components/session-view/ile-voice-bar";
import { SessionChrome } from "@/components/session-view/session-chrome";
import { SessionOnboardingGuide } from "@/components/SessionOnboardingGuide";
import { WorkspaceResourcesPanel } from "@/components/WorkspaceResourcesPanel";
import { countIleUnsubmittedPowDisplay, toIlePowDisplayCounts } from "@/lib/ile-pow-counters";
import { ileImpurityExitPlan } from "@/lib/practice-voice-challenge";
import { ileSessionNameFromMetadata } from "@/lib/ile-session-name";
import { sessionSidebarHasSection } from "@/lib/session-sidebar";
import { toSpeechBcp47 } from "@/lib/tutoring-languages";

export type SessionLiveStageProps = {
  activeStep: import("/Users/dncolomer/UncertainSystems/openlesson/lib/storage").SessionPlanStep | undefined;
  activeTool: Tool;
  allowEndSession: boolean;
  availableCounts: import("/Users/dncolomer/UncertainSystems/openlesson/lib/ile-pow-counters").IlePowTypeCounts;
  ayclToken: string | undefined;
  bandPowers: { delta: number; theta: number; alpha: number; beta: number; gamma: number; } | null;
  canvasDirtyForHelios: boolean;
  chapterCloseReview: { canClose: boolean; reason: string; } | null;
  completeTargetStepIdRef: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").RefObject<string | null>;
  craftingInsightsOpen: boolean;
  dismissGatherWarning: () => void;
  eegChannelData: Map<string, number[]>;
  endReason: string;
  error: string | null;
  gatherWarning: string | null;
  gatheredResources: import("/Users/dncolomer/UncertainSystems/openlesson/lib/workspace-external-resources").WorkspaceExternalResource[];
  handleConfirmEnd: () => Promise<void>;
  handleConnectMuse: () => Promise<void>;
  handleDisconnectMuse: () => void;
  handleIleSessionToolChange: (tool: Tool) => void;
  handleMarkChapterDone: (opts?: { closeOverride?: boolean; stepId?: string | null; }) => Promise<boolean>;
  handleStartScreenCapture: () => Promise<boolean>;
  handleStopScreenCapture: () => void;
  handleWelcomePlay: () => Promise<void>;
  heliosWidgetOpen: boolean;
  ileToken: string | undefined;
  isMuted: boolean;
  isProjectMode: boolean;
  isScreenCapturing: boolean;
  isStartingSession: boolean;
  isWebcamEnabled: boolean;
  minInsightsPerChapter: number;
  museDeviceStatus: import("/Users/dncolomer/UncertainSystems/openlesson/lib/muse-athena").DeviceStatus | null;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  muteTimerRef: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").RefObject<NodeJS.Timeout | null>;
  openWorkDockLabels: { id: string; label: string; keyword: string | undefined; description: string | undefined; focused: boolean; status: "idle" | "loading" | "attention"; image: string; }[];
  openWorkCount: number;
  pauseAndGoToDashboard: (sessionName?: string | null, options?: { persistSession?: boolean; }) => Promise<void>;
  renderChapterThoughtPane: (replica: boolean) => import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/jsx-runtime").JSX.Element | null;
  renderSessionToolPanes: () => import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/jsx-runtime").JSX.Element | null;
  renderWorkCanvas: () => import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/jsx-runtime").JSX.Element;
  resourceScopeChapterId: string | null;
  saveExitName: string;
  screenCaptureRef: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").RefObject<{ captureNow: () => Promise<Blob | null>; start: () => Promise<boolean>; stop: () => void; isCapturing: () => boolean; getStream: () => MediaStream | null; } | null>;
  selectedAesthetic: import("/Users/dncolomer/UncertainSystems/openlesson/lib/aesthetics").AestheticPackage;
  session: Session;
  sessionBlockId: string | undefined;
  sessionInsights: InsightSummary[];
  sessionPowArtifacts: import("/Users/dncolomer/UncertainSystems/openlesson/lib/ile-pow-counters").IlePowCounterArtifact[];
  sessionResourcesOpen: boolean;
  sessionThoughtInterface: { thoughts: import("/Users/dncolomer/UncertainSystems/openlesson/lib/useSessionThoughtInterface").SessionThought[]; interimText: string; crystallizableText: string; isListening: boolean; pauseLiveSpeech: () => void; resumeLiveSpeech: () => void; speechEnabled: boolean; speechError: string | null; isSending: boolean; sendError: string; stashedThoughts: import("/Users/dncolomer/UncertainSystems/openlesson/lib/useSessionThoughtInterface").SessionThought[]; latestThoughts: import("/Users/dncolomer/UncertainSystems/openlesson/lib/useSessionThoughtInterface").SessionThought[]; sentThoughtIds: Set<string>; memoryThoughtIds: Set<string>; speechSupported: boolean | null; getFormingText: () => string; ingestStashedThought: (thought: import("/Users/dncolomer/UncertainSystems/openlesson/lib/useSessionThoughtInterface").SessionThought) => void; stashCurrentTranscription: (providedText?: string) => void; clearCurrentTranscription: () => void; sendCurrentTranscription: () => Promise<void>; sendThought: (text: string, thoughtIds?: string[], options?: { skipTrace?: boolean; chapterId?: string | null; }) => Promise<void>; logTrace: (payload: import("/Users/dncolomer/UncertainSystems/openlesson/lib/useSessionThoughtInterface").SessionThoughtTracePayload) => void; beginEditTranscription: () => void; cancelEditTranscription: () => void; updateEditDraft: (draft: string) => void; submitEditedTranscription: () => Promise<void>; retryMicrophone: () => void; editingTranscription: { draft: string; originalText: string; } | null; };
  setActiveTool: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<Tool>>;
  setChapterCloseReview: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<{ canClose: boolean; reason: string; } | null>>;
  setCraftingInsightsOpen: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setError: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<string | null>>;
  setHeliosWidgetOpen: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setIsMuted: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setIsWebcamEnabled: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setMuteRemaining: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<number>>;
  setSaveExitName: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<string>>;
  setSessionResourcesOpen: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setShowEndDialog: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setShowPlanCompleteModal: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setShowSaveExitNameDialog: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  setShowWelcomePanel: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").Dispatch<import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/index").SetStateAction<boolean>>;
  showEndDialog: boolean;
  showPlanCompleteModal: boolean;
  showSaveExitNameDialog: boolean;
  showWelcomeModal: boolean;
  showWelcomePanel: boolean;
  silenceLock: { lockCount: number; outcome: import("/Users/dncolomer/UncertainSystems/openlesson/lib/practice-voice-challenge").IleSilenceLockOutcome; unlock: (challengePassed: boolean) => void; minutes: number; };
  stream: MediaStream | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  tutoringLanguage: "en" | "vi" | "zh" | "es" | "de" | "pl" | "ca";
  welcomeOpenNonce: number;
  workCanvasInsightSlots: import("/Users/dncolomer/UncertainSystems/openlesson/node_modules/@types/react/jsx-runtime").JSX.Element;
  workspaceId: string | undefined;
};

export function SessionLiveStage({
    activeStep,
    activeTool,
    allowEndSession,
    availableCounts,
    ayclToken,
    bandPowers,
    canvasDirtyForHelios,
    chapterCloseReview,
    completeTargetStepIdRef,
    craftingInsightsOpen,
    dismissGatherWarning,
    eegChannelData,
    endReason,
    error,
    gatherWarning,
    gatheredResources,
    handleConfirmEnd,
    handleConnectMuse,
    handleDisconnectMuse,
    handleIleSessionToolChange,
    handleMarkChapterDone,
    handleStartScreenCapture,
    handleStopScreenCapture,
    handleWelcomePlay,
    heliosWidgetOpen,
    ileToken,
    isMuted,
    isProjectMode,
    isScreenCapturing,
    isStartingSession,
    isWebcamEnabled,
    minInsightsPerChapter,
    museDeviceStatus,
    museStatus,
    muteTimerRef,
    openWorkDockLabels,
    openWorkCount,
    pauseAndGoToDashboard,
    renderChapterThoughtPane,
    renderSessionToolPanes,
    renderWorkCanvas,
    resourceScopeChapterId,
    saveExitName,
    screenCaptureRef,
    selectedAesthetic,
    session,
    sessionBlockId,
    sessionInsights,
    sessionPowArtifacts,
    sessionResourcesOpen,
    sessionThoughtInterface,
    setActiveTool,
    setChapterCloseReview,
    setCraftingInsightsOpen,
    setError,
    setHeliosWidgetOpen,
    setIsMuted,
    setIsWebcamEnabled,
    setMuteRemaining,
    setSaveExitName,
    setSessionResourcesOpen,
    setShowEndDialog,
    setShowPlanCompleteModal,
    setShowSaveExitNameDialog,
    setShowWelcomePanel,
    showEndDialog,
    showPlanCompleteModal,
    showSaveExitNameDialog,
    showWelcomeModal,
    showWelcomePanel,
    silenceLock,
    stream,
    t,
    tutoringLanguage,
    welcomeOpenNonce,
    workCanvasInsightSlots,
    workspaceId,
}: SessionLiveStageProps) {
  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {silenceLock.outcome === "rest"
        ? mountIleSilenceScreen(
            <IleSilenceRestScreen
              lockCount={silenceLock.lockCount}
              speechLang={toSpeechBcp47(tutoringLanguage)}
              onUnlock={() => silenceLock.unlock(true)}
              onSaveAndLeave={() => {
                const plan = ileImpurityExitPlan("save");
                if (!plan.persistSession) return;
                setShowSaveExitNameDialog(true);
              }}
            />,
          )
        : null}
      {silenceLock.outcome === "impurity"
        ? mountIleSilenceScreen(
            <IleSessionImpurityScreen
              lockCount={silenceLock.lockCount}
              onSave={() => {
                const plan = ileImpurityExitPlan("save");
                if (!plan.persistSession) return;
                setShowSaveExitNameDialog(true);
              }}
              onLogOff={() => {
                const plan = ileImpurityExitPlan("logoff");
                if (!plan.leave) return;
                void pauseAndGoToDashboard(null, { persistSession: plan.persistSession });
              }}
            />,
          )
        : null}
      <SessionChrome
        t={t}
        activeTool={activeTool}
        onToolChange={handleIleSessionToolChange}
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
        isWebcamEnabled={isWebcamEnabled}
        isScreenCapturing={isScreenCapturing}
        screenShareStream={isScreenCapturing ? screenCaptureRef.current?.getStream() ?? null : null}
        onStopScreenCapture={handleStopScreenCapture}
        onStartScreenCapture={handleStartScreenCapture}
        onTurnOffWebcam={() => setIsWebcamEnabled(false)}
        onEnableWebcam={() => setIsWebcamEnabled(true)}
        onConnectMuse={handleConnectMuse}
        onDisconnectMuse={handleDisconnectMuse}
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
        error={error}
        onDismissError={() => setError(null)}
        showWelcomeModal={showWelcomeModal}
        powCounts={toIlePowDisplayCounts(availableCounts, sessionPowArtifacts)}
        unsubmittedPowCounts={countIleUnsubmittedPowDisplay({
          unflaggedThoughtCount: sessionThoughtInterface.stashedThoughts.length,
          formingThought: Boolean(
            (
              sessionThoughtInterface.getFormingText?.() ||
              sessionThoughtInterface.crystallizableText ||
              ""
            ).trim(),
          ),
          canvasDirty: canvasDirtyForHelios,
        })}
        openWorkCount={openWorkCount}
        aestheticImages={selectedAesthetic?.images}
        aestheticPackageId={selectedAesthetic?.id}
        openWorkLabels={openWorkDockLabels}
        sessionStartedAt={session?.startedAt ?? null}
        resources={
          workspaceId ? (
            <WorkspaceResourcesPanel
              workspaceId={workspaceId}
              blockId={sessionBlockId}
              chapterId={resourceScopeChapterId || activeStep?.id}
              gatheredResources={gatheredResources}
              ayclToken={ayclToken}
              ileToken={ileToken}
            />
          ) : null
        }
        resourcesOpen={sessionResourcesOpen}
        onResourcesOpenChange={setSessionResourcesOpen}
        onCloseToolOverlay={() => setActiveTool("chapters")}
        heliosOpen={heliosWidgetOpen}
        onCloseHelios={() => setHeliosWidgetOpen(false)}
        onMinimizeHelios={() => setHeliosWidgetOpen(false)}
        insightCraftOpen={craftingInsightsOpen}
        onMinimizeInsightCraft={() => setCraftingInsightsOpen(false)}
        workCanvasHeaderLeading={workCanvasInsightSlots}
        mapInsightsWidget={
          <IleMapInsightsWidget
            insights={sessionInsights}
            slotCount={minInsightsPerChapter}
            visible
          />
        }
        introOpen={showWelcomePanel}
        onCloseSessionModal={() => {
          setShowWelcomePanel(false);
          setActiveTool("chapters");
        }}
        introWidget={
          <SessionOnboardingGuide
            key={welcomeOpenNonce}
            variant="ile"
            presentation="sidebar"
            className="min-h-0"
            language={tutoringLanguage}
            showStartAction
            projectMode={isProjectMode}
            insightGoalCount={minInsightsPerChapter}
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
        map={null}
        toolOverlay={renderSessionToolPanes()}
        workCanvas={renderWorkCanvas()}
        heliosWidget={renderChapterThoughtPane(false)}
        voiceBar={<IleVoiceBar thought={sessionThoughtInterface} />}
        actions={
          <IleVoiceBarActions
            onBackToDashboard={() => {
              setSaveExitName(ileSessionNameFromMetadata(session.metadata) ?? "");
              setShowSaveExitNameDialog(true);
            }}
            showSave={sessionSidebarHasSection("ile", "save")}
          />
        }
      />
    </div>
  );
}
