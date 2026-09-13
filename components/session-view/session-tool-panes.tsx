"use client";

import { DataInputTool } from "@/components/DataInputTool";
import { FacialDataPoint } from "@/components/FaceTracker";
import { LogsTool, type LogEntry } from "@/components/LogsTool";
import type { TransferHealth } from "@/components/LogsTool";
import { IleReviewWorkPanel } from "@/components/session-view/ile-review-work-panel";
import type { Tool } from "@/components/ToolsPanel";
import { WorkspaceResourcesPanel } from "@/components/WorkspaceResourcesPanel";
import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";
import type { IleSessionMode } from "@/lib/ile-mode";
import type { DeviceStatus } from "@/lib/muse-athena";
import type { Session, SessionPlanStep } from "@/lib/storage";
import type { SessionThoughtInterface } from "@/lib/useSessionThoughtInterface";
import type { SessionViewTranslate } from "@/components/session-view/types";

export type SessionToolPanesProps = {
  t: SessionViewTranslate;
  activeTool: Tool;
  shouldBlockTools: boolean;
  session: Session;
  ayclToken?: string;
  ileToken?: string;
  isRecording: boolean;
  activeStep: SessionPlanStep | undefined;
  activeChapterLabel: string;
  activeChapterKey: string;
  resolvedSessionMode: IleSessionMode;
  unsubmittedThoughts?: SessionThoughtInterface["stashedThoughts"];
  formingThoughtText?: string | null;
  canvasDirtyForHelios?: boolean;
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
  gatherBlockId?: string | null;
  gatherChapterId?: string | null;
  gatheredResources?: WorkspaceExternalResource[];
};

export function SessionToolPanes(props: SessionToolPanesProps) {
  const {
    activeTool,
    shouldBlockTools,
    session,
    ayclToken,
    ileToken,
    isRecording,
    resolvedSessionMode,
    unsubmittedThoughts,
    formingThoughtText,
    canvasDirtyForHelios = false,
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
    gatherBlockId = null,
    gatherChapterId = null,
    gatheredResources = [],
  } = props;

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden p-3">
      {shouldBlockTools && !["data-input", "help", "logs", "chapters"].includes(activeTool) && (
        <div className="absolute inset-0 z-10 bg-black/30 cursor-not-allowed" />
      )}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTool === "thought-history" && (
          <div
            className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
            data-ile-session-mode={resolvedSessionMode}
            data-ile-review-work-host
          >
            <IleReviewWorkPanel
              thoughts={unsubmittedThoughts ?? []}
              formingText={formingThoughtText}
              canvasDirty={canvasDirtyForHelios}
            />
          </div>
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
              chapterId={gatherChapterId}
              gatheredResources={gatheredResources}
              ayclToken={ayclToken}
              ileToken={ileToken}
            />
          </div>
        )}
      </div>
    </div>
  );
}
