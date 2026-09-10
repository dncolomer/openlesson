"use client";

import type { ReactNode } from "react";
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
  ILE_CHAPTER_DOCK_PANEL_HEIGHT_CLASS,
  ILE_MAP_VOICE_BAR_CLEARANCE_CLASS,
  ILE_MAP_WIDGET_FRAME_CLASS,
  isIleChapterWidgetTool,
  isIleMapOverlayTool,
  isIleSessionModalTool,
} from "@/lib/ile-map-chrome";
import { IleChapterWidgetFrame } from "@/components/session-view/ile-chapter-widget-frame";
import { IleChapterToolTabs } from "@/components/session-view/ile-chapter-tool-tabs";
import { IleWorkDockBar } from "@/components/session-view/ile-work-dock-bar";
import { ILE_POW_COUNTER_ICONS } from "@/components/session-view/ile-pow-icons";
import {
  emptyIlePowDisplayCounts,
  ILE_POW_COUNTER_LABELS,
  ILE_POW_DISPLAY_COUNTER_TYPES,
  type IlePowDisplayCounts,
} from "@/lib/ile-pow-counters";
import { ILE_REVIEW_WORK_LABEL, ILE_REVIEW_WORK_TOOL } from "@/lib/ile-review-work";
import { Lightbulb, Boxes } from "lucide-react";

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
  heliosWidget: ReactNode;
  heliosOpen: boolean;
  onCloseHelios: () => void;
  onMinimizeHelios?: () => void;
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
  sessionInsightCount?: number;
  onOpenSessionInsights?: () => void;
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
  heliosWidget,
  heliosOpen,
  onCloseHelios,
  onMinimizeHelios,
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
  onSubmitTurn,
  submitTurnLabel = "End turn",
  submitTurnBusy = false,
  sessionInsightCount = 0,
  onOpenSessionInsights,
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
  const chapterToolOpen = isIleChapterWidgetTool(activeTool);
  const modalTool = introOpen
    ? "help"
    : isIleSessionModalTool(activeTool)
      ? activeTool
      : null;
  const modalTitle =
    modalTool === "help" ? "Help" : modalTool === "data-input" ? "Data" : modalTool === "logs" ? "Logs" : "";
  const overlayTitle =
    activeTool === ILE_REVIEW_WORK_TOOL
      ? t("session.reviewWork") || ILE_REVIEW_WORK_LABEL
      : activeTool === "plan-resources"
        ? "Global resources"
        : activeTool;

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
          {ILE_POW_DISPLAY_COUNTER_TYPES.map((type) => {
            const submitted = powCounts[type];
            const unsubmitted = unsubmittedPowCounts[type] ?? 0;
            return (
            <div
              key={type}
              data-ile-pow-count={type}
              title={`${ILE_POW_COUNTER_LABELS[type]}: ${submitted} submitted, ${unsubmitted} unsubmitted`}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-300"
            >
              <span className="text-neutral-400" aria-hidden>
                {ILE_POW_COUNTER_ICONS[type]}
              </span>
              <span className="sr-only">{ILE_POW_COUNTER_LABELS[type]}</span>
              <span
                data-ile-pow-dual-pill
                className="inline-flex overflow-hidden rounded-none border border-white font-mono text-[11px] leading-none"
              >
                <span
                  data-ile-pow-submitted
                  className="bg-white px-1.5 py-0.5 text-neutral-950"
                >
                  {submitted}
                </span>
                <span
                  data-ile-pow-unsubmitted
                  className="bg-black px-1.5 py-0.5 text-white"
                >
                  {unsubmitted}
                </span>
              </span>
            </div>
            );
          })}
          <>
            <div className="h-4 w-px shrink-0 bg-neutral-700" aria-hidden />
            <button
              type="button"
              data-ile-session-insights-count
              title="Session insights"
              aria-label="Session insights"
              onClick={() => onOpenSessionInsights?.()}
              className="flex shrink-0 items-center gap-1.5 rounded-none border border-white bg-white px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-950 shadow-[0_0_18px_rgba(255,255,255,0.28)] hover:bg-neutral-100"
            >
              <Lightbulb className="size-3.5" strokeWidth={2.3} aria-hidden />
              Insights
              <span data-ile-session-insights-value className="bg-neutral-950 px-1.5 py-0.5 text-white">
                {sessionInsightCount}
              </span>
            </button>
            {onOpenGlobalResources ? (
              <button
                type="button"
                data-ile-global-resources
                title={t("tools.planResources")}
                aria-label={t("tools.planResources")}
                aria-pressed={overlayOpen}
                onClick={() => onOpenGlobalResources()}
                className={`flex shrink-0 items-center gap-1 rounded-none border px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                  overlayOpen && activeTool === "plan-resources"
                    ? "border-neutral-400 bg-neutral-800 text-neutral-100"
                    : "border-neutral-700 bg-transparent text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
                }`}
              >
                <Boxes className="size-3" strokeWidth={2} aria-hidden />
                {t("tools.planResources")}
              </button>
            ) : null}
          </>
        </div>

        {error && !showWelcomeModal ? (
          <div className="pointer-events-auto absolute left-2 top-12 z-30 flex items-center gap-2 rounded-none border border-red-500/30 bg-red-500/10 px-3 py-1.5">
            <span className="text-xs text-red-400">{error}</span>
            <button onClick={onDismissError} className="text-xs text-red-400/60 hover:text-red-400">✕</button>
          </div>
        ) : null}

        {modalTool ? (
          <div
            data-ile-session-modal={modalTool}
            data-ile-intro-widget={modalTool === "help" ? "true" : undefined}
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
                <button
                  type="button"
                  data-ile-session-modal-close
                  onClick={() => onCloseSessionModal?.()}
                  className="rounded-none px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {modalTool === "help" ? (
                  <div className="h-full min-h-0 overflow-y-auto">{introWidget}</div>
                ) : modalTool === "logs" ? (
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

        {heliosOpen ? (
          <div
            data-ile-chapter-dock-panel
            className={`pointer-events-auto ${ILE_MAP_WIDGET_FRAME_CLASS} z-40`}
          >
            <div className={`relative flex h-full min-h-0 ${ILE_CHAPTER_DOCK_PANEL_HEIGHT_CLASS} flex-col shadow-[0_28px_90px_rgba(0,0,0,0.65)]`}>
              <IleChapterWidgetFrame
                fill
                onMinimize={onMinimizeHelios ?? onCloseHelios}
                toolbar={
                  <IleChapterToolTabs activeTool={activeTool} onToolChange={onToolChange} />
                }
              >
                {chapterToolOpen ? toolOverlay : heliosWidget}
              </IleChapterWidgetFrame>
            </div>
          </div>
        ) : null}

        <div
          data-ile-work-dock
          className={`pointer-events-none absolute right-2 ${ILE_MAP_VOICE_BAR_CLEARANCE_CLASS} z-50 flex flex-col items-end`}
        >
          <IleWorkDockBar
            t={t}
            heliosOpen={heliosOpen}
            openWorkLabels={openWorkLabels}
            onFocusOpenWork={onFocusOpenWork}
            onSubmitTurn={onSubmitTurn}
            submitTurnLabel={submitTurnLabel}
            submitTurnBusy={submitTurnBusy}
            submitTurnDisabled={submitTurnBusy || openWorkCount < 1}
            aestheticImages={aestheticImages}
          />
        </div>

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
