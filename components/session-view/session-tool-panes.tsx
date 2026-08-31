"use client";

import { DataInputTool } from "@/components/DataInputTool";
import { DantesTool } from "@/components/DantesTool";
import { ExcalidrawCanvas } from "@/components/ExcalidrawCanvas";
import { FacialDataPoint } from "@/components/FaceTracker";
import { GrokGrokipediaTool } from "@/components/GrokGrokipediaTool";
import { LogsTool, type LogEntry } from "@/components/LogsTool";
import type { TransferHealth } from "@/components/LogsTool";
import { NotebookSubmitButton } from "@/components/session/NotebookSubmitButton";
import { ThoughtMemoryPanel } from "@/components/thought-ui/ThoughtMemoryPanel";
import type { Tool } from "@/components/ToolsPanel";
import { WorkspaceResourcesPanel } from "@/components/WorkspaceResourcesPanel";
import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";
import type { IleSessionMode } from "@/lib/ile-mode";
import type { DeviceStatus } from "@/lib/muse-athena";
import type { Session, SessionPlan, SessionPlanStep } from "@/lib/storage";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import type { ExerciseDualLists } from "@/lib/ile-mode";
import type { SessionViewTranslate } from "@/components/session-view/types";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";

export type SessionToolPanesProps = {
  t: SessionViewTranslate;
  activeTool: Tool;
  shouldBlockTools: boolean;
  session: Session;
  sessionPlan: SessionPlan | null;
  ayclToken?: string;
  ileToken?: string;
  locale: string;
  planLoading: boolean;
  activeChapterIndex: number;
  chapterLoadingIndex: number | null;
  isRecording: boolean;
  activeStep: SessionPlanStep | undefined;
  participantIdentity: PowParticipantIdentity | null;
  activeChapterKey: string;
  whiteboardData: string | null;
  whiteboardSceneData: { elements: any[]; appState: any; files: any } | null;
  onCanvasChange: (data: string) => void;
  onSceneChange: (data: { elements: any[]; appState: any; files: any }) => void;
  onSubmitToHelios: (toolName: "canvas" | "notebook", canvasDataUrl?: string | null) => void;
  chapterThoughtsLocked: boolean;
  canvasDirtyForHelios: boolean;
  notebookDirtyForHelios: boolean;
  isProjectMode: boolean;
  activeChapterLabel: string;
  notebookContent: string;
  onNotebookChange: (value: string) => void;
  resolvedSessionMode: IleSessionMode;
  activeProjectLists: ExerciseDualLists;
  onProjectPromote: (thoughtId: string) => void;
  onProjectDemote: (thoughtId: string) => void;
  sessionThoughtHistory: SessionThoughtInterface["thoughts"];
  onSendThought: SessionThoughtInterface["sendThought"];
  thoughtIsSending?: boolean;
  stream: MediaStream | null;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  museError: string | null;
  museDeviceStatus: DeviceStatus | null;
  eegChannelData: Map<string, number[]>;
  bandPowers: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
  onConnectMuse: () => void;
  onDisconnectMuse: () => void;
  isWebcamEnabled: boolean;
  onWebcamToggle: () => void;
  latestFacialData: FacialDataPoint | null;
  onFacialData: (data: FacialDataPoint) => void;
  onFaceError: (error: string) => void;
  isScreenCapturing: boolean;
  onStartScreenCapture: () => Promise<boolean>;
  onStopScreenCapture: () => void;
  screenshotCount: number;
  logs: LogEntry[];
  transferHealth: TransferHealth;
  onClearLogs: () => void;
  isMobile: boolean;
  onLeaveIleTab: (reason: "grok" | "grokipedia") => void;
  toolPrefillQuery?: string;
  gatherBlockId?: string | null;
  gatheredResources?: WorkspaceExternalResource[];
};

export function SessionToolPanes(props: SessionToolPanesProps) {
  const {
    t,
    activeTool,
    shouldBlockTools,
    session,
    ayclToken,
    ileToken,
    isRecording,
    activeStep,
    whiteboardData,
    whiteboardSceneData,
    onCanvasChange,
    onSceneChange,
    onSubmitToHelios,
    chapterThoughtsLocked,
    canvasDirtyForHelios,
    notebookDirtyForHelios,
    isProjectMode,
    activeChapterLabel,
    notebookContent,
    onNotebookChange,
    resolvedSessionMode,
    sessionThoughtHistory,
    onSendThought,
    thoughtIsSending,
    stream,
    museStatus,
    museError,
    museDeviceStatus,
    eegChannelData,
    bandPowers,
    onConnectMuse,
    onDisconnectMuse,
    isWebcamEnabled,
    onWebcamToggle,
    latestFacialData,
    onFacialData,
    onFaceError,
    isScreenCapturing,
    onStartScreenCapture,
    onStopScreenCapture,
    screenshotCount,
    logs,
    transferHealth,
    onClearLogs,
    isMobile,
    onLeaveIleTab,
    toolPrefillQuery,
    gatherBlockId = null,
    gatheredResources = [],
  } = props;

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden p-3">
      {shouldBlockTools && !["data-input", "help", "logs", "chapters"].includes(activeTool) && (
        <div className="absolute inset-0 z-10 bg-black/30 cursor-not-allowed" />
      )}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={activeTool === "canvas" ? "h-full" : "hidden"}>
          <ExcalidrawCanvas
            key={session.id}
            initialData={whiteboardData || undefined}
            initialSceneData={whiteboardSceneData}
            onCanvasChange={onCanvasChange}
            onSceneChange={onSceneChange}
            onSubmitToHelios={(dataUrl) => onSubmitToHelios("canvas", dataUrl)}
            canSubmitToHelios={!chapterThoughtsLocked && canvasDirtyForHelios}
            submitLabel={isProjectMode ? "To solution" : undefined}
            chapterLabel={activeChapterLabel}
          />
        </div>
        {activeTool === "notebook" && (
          <div className="h-full rounded-none border border-neutral-800 bg-neutral-900/50 flex flex-col">
            <div className="shrink-0 px-3 py-2 border-b border-neutral-800 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[11px] text-neutral-500">Notes for {activeChapterLabel}</span>
              <NotebookSubmitButton
                onSubmit={() => onSubmitToHelios("notebook")}
                disabled={
                  chapterThoughtsLocked ||
                  notebookContent.trim().length === 0 ||
                  !notebookDirtyForHelios
                }
                disabledReason={
                  chapterThoughtsLocked
                    ? "Chapter marked Done"
                    : notebookContent.trim().length === 0
                      ? t("whiteboard.nothingToSubmit")
                      : t("whiteboard.alreadySubmitted")
                }
                label={isProjectMode ? "To solution" : undefined}
              />
            </div>
            <textarea
              value={notebookContent}
              onChange={(e) => onNotebookChange(e.target.value)}
              placeholder={t("session.notebookPlaceholder")}
              className="flex-1 w-full bg-transparent border-none resize-none p-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-0"
            />
            <div className="shrink-0 px-3 py-2 border-t border-neutral-800 flex items-center justify-between gap-3">
              <span className="text-[10px] text-neutral-600">{t("session.characters", { count: notebookContent.length })}</span>
            </div>
          </div>
        )}

        {activeTool === "thought-history" && (
          <div
            className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
            data-ile-session-mode={resolvedSessionMode}
          >
            <ThoughtMemoryPanel
              className="flex h-full min-h-0 max-h-full flex-col overflow-hidden px-1"
              listClassName="pr-2"
              thoughts={sessionThoughtHistory}
              workspaceId={session.metadata?.workspace_id ?? undefined}
              sessionId={session.id}
              insightSurface="ile"
              allowInsightGeneration={true}
              onSendThought={onSendThought}
              isSending={Boolean(thoughtIsSending) || chapterThoughtsLocked}
            />
          </div>
        )}

        {activeTool === "dantes" && (
          <DantesTool
            problem={session.problem}
            activeStepDescription={activeStep?.description}
            prefillQuery={toolPrefillQuery}
          />
        )}

        <div className={activeTool === "data-input" ? "mt-auto flex flex-col" : "hidden"}>
          <DataInputTool
            isRecording={isRecording}
            sessionId={session?.id}
            audioStream={stream}
            museStatus={museStatus}
            museError={museError}
            museDeviceStatus={museDeviceStatus}
            museChannelData={eegChannelData}
            bandPowers={bandPowers}
            onConnectMuse={onConnectMuse}
            onDisconnectMuse={onDisconnectMuse}
            isWebcamEnabled={isWebcamEnabled}
            onWebcamToggle={onWebcamToggle}
            latestFacialData={latestFacialData}
            onFacialData={onFacialData}
            onFaceError={onFaceError}
            isScreenCapturing={isScreenCapturing}
            onStartScreenCapture={onStartScreenCapture}
            onStopScreenCapture={onStopScreenCapture}
            screenshotCount={screenshotCount}
          />
        </div>
        {activeTool === "logs" && (
          <div
            className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
            data-ile-logs-pane
          >
            <LogsTool
              logs={logs}
              transferHealth={transferHealth}
              onClear={onClearLogs}
            />
          </div>
        )}
        {activeTool === "plan-resources" && session?.metadata?.workspace_id && !isMobile && (
          <div className="h-full overflow-hidden">
            <WorkspaceResourcesPanel
              workspaceId={session.metadata.workspace_id as string}
              blockId={gatherBlockId}
              gatheredResources={gatheredResources}
              ayclToken={ayclToken}
              ileToken={ileToken}
            />
          </div>
        )}
        {activeTool === "grokipedia" && (
          <GrokGrokipediaTool
            sessionProblem={session?.problem}
            activeStepDescription={activeStep?.description}
            activeProbes={session?.probes?.filter((probe) => !probe.archived).map((probe) => ({ text: probe.text }))}
            onLeaveIleTab={onLeaveIleTab}
            prefillQuery={toolPrefillQuery}
          />
        )}
      </div>
    </div>
  );
}
