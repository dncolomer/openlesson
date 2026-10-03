"use client";

import type { ReactNode } from "react";
import { IleCollapsibleOverlay } from "@/components/session-view/ile-collapsible-overlay";
import { SessionSidebar } from "@/components/session-view/session-sidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  AudioMiniPreview,
  EegMiniPreview,
  ScreenShareMiniPreview,
  WebcamMiniPreview,
  type Tool,
} from "@/components/ToolsPanel";
import type { DeviceStatus } from "@/lib/muse-athena";
import type { SessionViewTranslate } from "@/components/session-view/types";
import {
  ILE_MAP_WIDGET_FRAME_CLASS,
  ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS,
  isIleMapOverlayTool,
  isIleSessionModalTool,
} from "@/lib/ile-map-chrome";
import { ileSidebarSignalCount } from "@/lib/session-sidebar";
import { IleWorkDockBar } from "@/components/session-view/ile-work-dock-bar";
import {
  emptyIlePowDisplayCounts,
  type IlePowDisplayCounts,
} from "@/lib/ile-pow-counters";
import { ILE_REVIEW_WORK_LABEL, ILE_REVIEW_WORK_TOOL } from "@/lib/ile-review-work";

export type SessionChromeProps = {
  t: SessionViewTranslate;
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
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
  bandPowers?: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
  error: string | null;
  onDismissError: () => void;
  showWelcomeModal: boolean;
  map: ReactNode;
  toolOverlay: ReactNode;
  workCanvas: ReactNode;
  heliosWidget: ReactNode;
  heliosOpen: boolean;
  onCloseHelios: () => void;
  onMinimizeHelios?: () => void;
  insightCraftOpen?: boolean;
  onMinimizeInsightCraft?: () => void;
  workCanvasHeaderLeading?: ReactNode;
  mapInsightsWidget?: ReactNode;
  insightCount?: number;
  introOpen: boolean;
  introWidget: ReactNode;
  onCloseSessionModal?: () => void;
  voiceBar: ReactNode;
  powCounts: IlePowDisplayCounts;
  unsubmittedPowCounts?: IlePowDisplayCounts;
  openWorkCount?: number;
  openWorkLabels?: Array<{
    id: string;
    label: string;
    keyword?: string;
    focused?: boolean;
    image?: string;
  }>;
  aestheticImages?: string[];
  onFocusOpenWork?: (id: string) => void;
  onOpenGlobalResources?: () => void;
  onSubmitTurn?: () => void;
  submitTurnLabel?: string;
  submitTurnBusy?: boolean;
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
  onDiscardSaveExitName?: () => void;
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
  bandPowers = null,
  error,
  onDismissError,
  showWelcomeModal,
  map,
  toolOverlay,
  workCanvas,
  heliosWidget: _heliosWidget,
  heliosOpen,
  onCloseHelios,
  onMinimizeHelios,
  insightCraftOpen = false,
  onMinimizeInsightCraft,
  workCanvasHeaderLeading = null,
  mapInsightsWidget = null,
  insightCount = 0,
  introOpen,
  introWidget,
  onCloseSessionModal,
  voiceBar,
  powCounts,
  unsubmittedPowCounts = emptyIlePowDisplayCounts(),
  openWorkCount = 0,
  openWorkLabels = [],
  aestheticImages = [],
  onFocusOpenWork,
  onOpenGlobalResources,
  onSubmitTurn: _onSubmitTurn,
  submitTurnLabel: _submitTurnLabel,
  submitTurnBusy: _submitTurnBusy = false,
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
  onDiscardSaveExitName,
  gatherWarning = null,
  onDismissGatherWarning,
  closeReviewBlocked = false,
  closeReviewReason = null,
  onChapterDoneOverride,
  onDismissCloseReview,
}: SessionChromeProps) {
  const overlayOpen = isIleMapOverlayTool(activeTool);
  const modalTool = introOpen
    ? "help"
    : isIleSessionModalTool(activeTool)
      ? activeTool
      : null;
  const modalTitle = introOpen
    ? t("session.beforeYouStart")
    : modalTool === "data-input"
      ? "Data"
      : modalTool === "logs"
        ? "Logs"
        : "";
  const overlayTitle =
    activeTool === ILE_REVIEW_WORK_TOOL
      ? t("session.reviewWork") || ILE_REVIEW_WORK_LABEL
      : activeTool === "plan-resources"
        ? "session resources"
        : activeTool;

  return (
    <>
      <div
        data-ile-session-stage
        data-ile-canvas-stage="true"
        data-ile-work-covers-map="true"
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {modalTool === "help" ? (
          <div
            data-ile-session-modal="help"
            data-ile-intro-widget="true"
            data-ile-help-fullscreen=""
            className="pointer-events-auto absolute inset-0 z-[80] flex h-full w-full flex-col bg-neutral-950"
          >
            <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
              {introWidget}
            </div>
          </div>
        ) : null}

        <div
          data-ile-session-inner
          data-ile-canvas-sidebar-split
          className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden"
        >
        <div data-ile-canvas-stage className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 min-h-0">{workCanvas}</div>
        </div>
        <SessionSidebar
          mode="ile"
          counts={{
            insights: insightCount,
            chapters: openWorkLabels.length,
            signals: ileSidebarSignalCount({
              eegStreaming: museStatus === "streaming",
              screenCapturing: isScreenCapturing,
              webcamEnabled: isWebcamEnabled,
            }),
          }}
          onOpenGlobalResources={onOpenGlobalResources}
          globalResourcesOpen={activeTool === "plan-resources"}
          insights={
            mapInsightsWidget ? (
              <IleCollapsibleOverlay
                id="insights"
                title="Insights"
                className="pointer-events-none w-full"
              >
                {mapInsightsWidget}
              </IleCollapsibleOverlay>
            ) : null
          }
          chapters={
            <div data-ile-work-dock className="w-full min-w-0">
              <IleCollapsibleOverlay id="chapters" title="Chapters" className="w-full">
                <IleWorkDockBar
                  t={t}
                  heliosOpen={heliosOpen}
                  openWorkLabels={openWorkLabels}
                  onFocusOpenWork={onFocusOpenWork}
                  aestheticImages={aestheticImages}
                />
              </IleCollapsibleOverlay>
            </div>
          }
          signals={
            <div data-ile-tools-widget className="w-full min-w-0">
              <IleCollapsibleOverlay id="sensors" title="Signals">
                <div
                  data-ile-sensor-pair
                  className="grid w-full max-w-[20rem] grid-cols-2 gap-1.5"
                >
                  <AudioMiniPreview
                    stream={audioStream}
                    muted={audioMuted}
                    onToggleMute={onToggleAudioMute}
                  />
                  {museStatus === "streaming" ? (
                    <EegMiniPreview
                      museChannelData={museChannelData}
                      museStatus={museStatus}
                      museDeviceStatus={museDeviceStatus}
                      bandPowers={bandPowers}
                    />
                  ) : null}
                  {isScreenCapturing ? (
                    <ScreenShareMiniPreview stream={screenShareStream} onTurnOff={onStopScreenCapture} />
                  ) : null}
                  {isWebcamEnabled ? <WebcamMiniPreview onTurnOff={onTurnOffWebcam} /> : null}
                </div>
              </IleCollapsibleOverlay>
            </div>
          }
          transcript={voiceBar}
        />

        {error && !showWelcomeModal ? (
          <div className={`pointer-events-auto absolute left-2 top-2 ${ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS} flex items-center gap-2 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-1.5`}>
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={onDismissError} className="text-xs text-red-400/60 hover:text-red-400">✕</button>
          </div>
        ) : null}

        {modalTool && modalTool !== "help" ? (
          <div
            data-ile-session-modal={modalTool}
            className="pointer-events-auto absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 cursor-default"
              onClick={() => onCloseSessionModal?.()}
            />
            <div
              className={`relative z-10 flex max-h-[min(88vh,44rem)] w-[min(42rem,calc(100%-2rem))] flex-col overflow-hidden rounded-none border border-neutral-700 bg-neutral-950 shadow-[0_28px_90px_rgba(0,0,0,0.65)] ${
                modalTool === "logs" ? "h-[min(88vh,44rem)]" : ""
              }`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  {modalTitle}
                </span>
                {introOpen ? null : (
                  <button
                    type="button"
                    data-ile-session-modal-close
                    onClick={() => onCloseSessionModal?.()}
                    className="rounded-none px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {modalTool === "logs" ? (
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    {toolOverlay}
                  </div>
                ) : (
                  toolOverlay
                )}
              </div>
            </div>
          </div>
        ) : null}

        {overlayOpen ? (
          <div
            data-ile-tool-overlay
            className={`pointer-events-auto ${ILE_MAP_WIDGET_FRAME_CLASS} z-[45] overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{overlayTitle}</span>
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
        open={showSaveExitNameDialog}
        onCancel={() => onCancelSaveExitName?.()}
        onConfirm={() => onConfirmSaveExitName?.()}
        onTertiary={onDiscardSaveExitName ? () => onDiscardSaveExitName() : undefined}
        variant="neutral"
        title={t("session.nameSessionTitle")}
        description={t("session.nameSessionBody")}
        confirmLabel={t("session.nameSessionConfirm")}
        cancelLabel={t("session.nameSessionStay")}
        tertiaryLabel={t("session.nameSessionDiscard")}
        tertiaryTone="ghost"
        tertiaryTestId="ile-exit-without-saving"
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
