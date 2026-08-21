"use client";

import type { ReactNode, Ref } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ResizablePane, type ResizablePaneHandle } from "@/components/ResizablePane";
import { ToolsPanel, type Tool } from "@/components/ToolsPanel";
import type { DeviceStatus } from "@/lib/muse-athena";
import type { SessionViewTranslate } from "@/components/session-view/types";

export type SessionChromeProps = {
  t: SessionViewTranslate;
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  problem: string;
  workspaceId?: string;
  onBackToDashboard: () => void;
  isRecording: boolean;
  isPaused: boolean;
  isWebcamEnabled: boolean;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  museDeviceStatus: DeviceStatus | null;
  museChannelData: Map<string, number[]>;
  showOpenPicInPic: boolean;
  onOpenPicInPic: () => void;
  error: string | null;
  onDismissError: () => void;
  showWelcomeModal: boolean;
  resizablePaneRef: Ref<ResizablePaneHandle>;
  left: ReactNode;
  right: ReactNode;
  allowEndSession: boolean;
  showEndDialog: boolean;
  onCancelEnd: () => void;
  onConfirmEnd: () => void;
  endReason: string;
  showPlanCompleteModal: boolean;
  onCancelPlanComplete: () => void;
  onConfirmPlanComplete: () => void;
};

export function SessionChrome({
  t,
  activeTool,
  onToolChange,
  problem,
  workspaceId,
  onBackToDashboard,
  isRecording,
  isPaused,
  isWebcamEnabled,
  museStatus,
  museDeviceStatus,
  museChannelData,
  showOpenPicInPic,
  onOpenPicInPic,
  error,
  onDismissError,
  showWelcomeModal,
  resizablePaneRef,
  left,
  right,
  allowEndSession,
  showEndDialog,
  onCancelEnd,
  onConfirmEnd,
  endReason,
  showPlanCompleteModal,
  onCancelPlanComplete,
  onConfirmPlanComplete,
}: SessionChromeProps) {
  return (
    <>
      <ToolsPanel
        activeTool={activeTool}
        onToolChange={onToolChange}
        problem={problem}
        workspaceId={workspaceId}
        disabledTools={[]}
        onBackToDashboard={onBackToDashboard}
        isRecording={isRecording}
        isPaused={isPaused}
        isWebcamEnabled={isWebcamEnabled}
        museStatus={museStatus}
        museDeviceStatus={museDeviceStatus}
        museChannelData={museChannelData}
        showOpenPicInPic={showOpenPicInPic}
        onOpenPicInPic={onOpenPicInPic}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {error && !showWelcomeModal && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={onDismissError} className="ml-auto text-red-400/60 hover:text-red-400 text-xs">✕</button>
          </div>
        )}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <ResizablePane
              ref={resizablePaneRef}
              defaultLeftWidth={40}
              storageKey="session-split-tools-helios"
              left={left}
              right={right}
            />
          </div>
        </div>
      </div>

      {allowEndSession ? (
        <ConfirmDialog
          open={showEndDialog}
          onCancel={onCancelEnd}
          onConfirm={onConfirmEnd}
          variant="info"
          title={t("session.tutorSuggestsEnd")}
          description={endReason}
          confirmLabel={t("sessionEnd.endSession")}
          cancelLabel={t("common.keepGoing")}
          confirmTone="primary"
        />
      ) : null}

      <ConfirmDialog
        open={showPlanCompleteModal}
        onCancel={onCancelPlanComplete}
        onConfirm={onConfirmPlanComplete}
        variant="neutral"
        title={t("session.sessionComplete")}
        description={t("session.congratulationsComplete")}
        confirmLabel={
          allowEndSession ? t('sessionEnd.returnToWorkspace') : t("common.keepGoing")
        }
        confirmTone="primary"
        hideCancel
      />
    </>
  );
}
