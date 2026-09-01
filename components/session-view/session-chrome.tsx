"use client";

import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  AudioMiniPreview,
  EegMiniPreview,
  ScreenShareMiniPreview,
  ToolsPanel,
  WebcamMiniPreview,
  type Tool,
} from "@/components/ToolsPanel";
import { SessionIdentityBadge } from "@/components/SessionIdentityBadge";
import type { PowParticipantIdentity } from "@/lib/session-participant-identity";
import type { DeviceStatus } from "@/lib/muse-athena";
import type { SessionViewTranslate } from "@/components/session-view/types";
import {
  ILE_HELIOS_WIDGET_TOP_PX,
  ILE_HELIOS_WIDGET_WIDTH_PX,
  ILE_MAP_VOICE_BAR_CLEARANCE_CLASS,
  isIleMapOverlayTool,
} from "@/lib/ile-map-chrome";
import { IleChapterWidgetFrame } from "@/components/session-view/ile-chapter-widget-frame";
import {
  Activity,
  MessageCircle,
  Monitor,
  Video,
  Wrench,
} from "lucide-react";
import {
  ILE_POW_COUNTER_LABELS,
  ILE_POW_DISPLAY_COUNTER_TYPES,
  type IlePowDisplayCounts,
  type IlePowDisplayCounterType,
} from "@/lib/ile-pow-counters";

const ILE_POW_COUNTER_ICONS: Record<IlePowDisplayCounterType, ReactNode> = {
  tool: <Wrench className="size-3.5" strokeWidth={2.2} aria-hidden />,
  screen: <Monitor className="size-3.5" strokeWidth={2.2} aria-hidden />,
  video: <Video className="size-3.5" strokeWidth={2.2} aria-hidden />,
  eeg: <Activity className="size-3.5" strokeWidth={2.2} aria-hidden />,
  thoughts: <MessageCircle className="size-3.5" strokeWidth={2.2} aria-hidden />,
};

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
  isScreenCapturing: boolean;
  screenShareStream: MediaStream | null;
  onStopScreenCapture: () => void;
  onTurnOffWebcam: () => void;
  audioStream: MediaStream | null;
  audioMuted: boolean;
  onToggleAudioMute: () => void;
  museStatus: "disconnected" | "connecting" | "connected" | "streaming";
  museDeviceStatus: DeviceStatus | null;
  museChannelData: Map<string, number[]>;
  showOpenPicInPic: boolean;
  onOpenPicInPic: () => void;
  error: string | null;
  onDismissError: () => void;
  showWelcomeModal: boolean;
  map: ReactNode;
  toolOverlay: ReactNode;
  heliosWidget: ReactNode;
  heliosOpen: boolean;
  onCloseHelios: () => void;
  introOpen: boolean;
  introWidget: ReactNode;
  voiceBar: ReactNode;
  powCounts: IlePowDisplayCounts;
  participantIdentity?: PowParticipantIdentity | null;
  onCloseToolOverlay: () => void;
  allowEndSession: boolean;
  showEndDialog: boolean;
  onCancelEnd: () => void;
  onConfirmEnd: () => void;
  endReason: string;
  showPlanCompleteModal: boolean;
  onCancelPlanComplete: () => void;
  onConfirmPlanComplete: () => void;
  showSaveExitNameDialog?: boolean;
  saveExitName?: string;
  onSaveExitNameChange?: (value: string) => void;
  onCancelSaveExitName?: () => void;
  onConfirmSaveExitName?: () => void;
  gatherWarning?: string | null;
  onDismissGatherWarning?: () => void;
  closeReviewBlocked?: boolean;
  closeReviewReason?: string | null;
  onChapterDoneOverride?: () => void;
  onDismissCloseReview?: () => void;
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
  isScreenCapturing,
  screenShareStream,
  onStopScreenCapture,
  onTurnOffWebcam,
  audioStream,
  audioMuted,
  onToggleAudioMute,
  museStatus,
  museDeviceStatus,
  museChannelData,
  showOpenPicInPic,
  onOpenPicInPic,
  error,
  onDismissError,
  showWelcomeModal,
  map,
  toolOverlay,
  heliosWidget,
  heliosOpen,
  onCloseHelios,
  introOpen,
  introWidget,
  voiceBar,
  powCounts,
  participantIdentity = null,
  onCloseToolOverlay,
  allowEndSession,
  showEndDialog,
  onCancelEnd,
  onConfirmEnd,
  endReason,
  showPlanCompleteModal,
  onCancelPlanComplete,
  onConfirmPlanComplete,
  showSaveExitNameDialog = false,
  saveExitName = "",
  onSaveExitNameChange,
  onCancelSaveExitName,
  onConfirmSaveExitName,
  gatherWarning = null,
  onDismissGatherWarning,
  closeReviewBlocked = false,
  closeReviewReason = null,
  onChapterDoneOverride,
  onDismissCloseReview,
}: SessionChromeProps) {
  const overlayOpen = isIleMapOverlayTool(activeTool);

  return (
    <>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div data-ile-map-stage className="absolute inset-0 z-0">
          {map}
        </div>

        <div
          data-ile-pow-resource-bar
          className="pointer-events-auto absolute left-2 top-2 z-30 flex items-center gap-3 rounded-none border border-neutral-700 bg-neutral-950/95 px-3 py-1.5"
        >
          <span
            data-ile-pow-resource-label
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-neutral-500"
          >
            Proof of Work Resources
          </span>
          {ILE_POW_DISPLAY_COUNTER_TYPES.map((type) => (
            <div
              key={type}
              data-ile-pow-count={type}
              title={ILE_POW_COUNTER_LABELS[type]}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-300"
            >
              <span className="text-neutral-400" aria-hidden>
                {ILE_POW_COUNTER_ICONS[type]}
              </span>
              <span className="sr-only">{ILE_POW_COUNTER_LABELS[type]}</span>
              <span className="text-neutral-100">{powCounts[type]}</span>
            </div>
          ))}
          {participantIdentity ? (
            <>
              <div className="h-4 w-px shrink-0 bg-neutral-700" aria-hidden />
              <div data-ile-identity-row className="flex shrink-0 items-center">
                <SessionIdentityBadge identity={participantIdentity} />
              </div>
            </>
          ) : null}
        </div>

        {error && !showWelcomeModal ? (
          <div className="pointer-events-auto absolute left-2 top-12 z-30 flex items-center gap-2 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-1.5">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={onDismissError} className="text-xs text-red-400/60 hover:text-red-400">✕</button>
          </div>
        ) : null}

        {introOpen ? (
          <div
            data-ile-intro-widget
            className="pointer-events-auto absolute left-1/2 top-1/2 z-40 flex max-h-[min(88vh,44rem)] w-[min(40rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95"
          >
            <div className="min-h-0 overflow-y-auto">{introWidget}</div>
          </div>
        ) : null}

        {heliosOpen ? (
          <IleChapterWidgetFrame
            onClose={onCloseHelios}
            className={`pointer-events-auto absolute right-2 ${ILE_MAP_VOICE_BAR_CLEARANCE_CLASS} z-30`}
            style={{
              top: ILE_HELIOS_WIDGET_TOP_PX,
              width: ILE_HELIOS_WIDGET_WIDTH_PX,
            }}
          >
            {heliosWidget}
          </IleChapterWidgetFrame>
        ) : null}

        {overlayOpen ? (
          <div
            data-ile-tool-overlay
            className={`pointer-events-auto absolute left-2 top-14 ${ILE_MAP_VOICE_BAR_CLEARANCE_CLASS} z-40 flex w-[min(720px,calc(100%-18rem))] flex-col overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{activeTool}</span>
              <button
                type="button"
                data-ile-tool-overlay-close
                onClick={onCloseToolOverlay}
                className="rounded-none px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{toolOverlay}</div>
          </div>
        ) : null}

        <div
          data-ile-tools-widget
          className={`pointer-events-none absolute ${ILE_MAP_VOICE_BAR_CLEARANCE_CLASS} left-2 z-30 flex flex-col items-stretch gap-1.5 rounded-none`}
        >
          <div
            data-ile-sensor-pair
            className="grid w-[min(20rem,calc(100vw-1rem))] max-w-[20rem] grid-cols-2 gap-1.5"
          >
            <AudioMiniPreview
              stream={audioStream}
              muted={audioMuted}
              onToggleMute={onToggleAudioMute}
            />
            {museStatus === "streaming" ? (
              <EegMiniPreview museChannelData={museChannelData} />
            ) : null}
            {isScreenCapturing ? (
              <ScreenShareMiniPreview stream={screenShareStream} onTurnOff={onStopScreenCapture} />
            ) : null}
            {isWebcamEnabled ? <WebcamMiniPreview onTurnOff={onTurnOffWebcam} /> : null}
          </div>
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
        </div>

        {voiceBar}
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
        open={showSaveExitNameDialog}
        onCancel={() => onCancelSaveExitName?.()}
        onConfirm={() => onConfirmSaveExitName?.()}
        variant="neutral"
        title={t("session.nameSessionTitle")}
        description={t("session.nameSessionBody")}
        confirmLabel={t("session.nameSessionConfirm")}
        cancelLabel={t("session.nameSessionStay")}
        confirmTone="primary"
        autoFocusConfirm={false}
        confirmOnEnter={false}
        testId="ile-save-exit-name"
      >
        <input
          data-ile-session-name
          value={saveExitName}
          onChange={(e) => onSaveExitNameChange?.(e.target.value)}
          placeholder={t("session.nameSessionPlaceholder")}
          maxLength={80}
          className="w-full rounded-none border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={showPlanCompleteModal}
        onCancel={onCancelPlanComplete}
        onConfirm={onConfirmPlanComplete}
        variant="neutral"
        title={t("session.sessionComplete")}
        description={t("session.congratulationsComplete")}
        confirmLabel={
          allowEndSession ? t("sessionEnd.returnToWorkspace") : t("common.keepGoing")
        }
        confirmTone="primary"
        hideCancel
      />

      <div data-ile-gather-warning={gatherWarning ? "true" : undefined}>
        <ConfirmDialog
          open={Boolean(gatherWarning)}
          variant="warning"
          title={t("chapterMap.gatherInsufficientTitle")}
          description={gatherWarning || ""}
          confirmLabel={t("chapterMap.gatherWarningConfirm")}
          hideCancel
          onConfirm={() => onDismissGatherWarning?.()}
          onCancel={() => onDismissGatherWarning?.()}
        />
      </div>

      <div data-ile-chapter-close-blocked={closeReviewBlocked ? "true" : undefined}>
        <ConfirmDialog
          open={closeReviewBlocked}
          variant="warning"
          title={t("chapterMap.closeBlockedTitle")}
          description={
            closeReviewReason ||
            "Session proof of work is not enough to close this chapter."
          }
          confirmLabel={t("chapterMap.closeOverride")}
          cancelLabel={t("common.keepGoing")}
          confirmTone="warning"
          testId="ile-close-override"
          onConfirm={() => onChapterDoneOverride?.()}
          onCancel={() => onDismissCloseReview?.()}
        />
      </div>
    </>
  );
}
