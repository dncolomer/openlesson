"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { QRCodeModal } from "./QRCodeModal";
import type { DeviceStatus, MuseAthenaStatus } from "@/lib/muse-athena";

const EEG_CHANNELS = ["TP9", "AF7", "AF8", "TP10", "FPz"] as const;

// Note: "exercise" (Practice) and "reading" (Theory) have been folded
// into the Helios chat surface — those buttons now inject a rich
// assistant message into the chat instead of opening their own panel.
// They no longer appear in the desktop sidebar. The Tool union still
// keeps them around as accepted values *only* if other call sites
// reference them historically; here we drop them entirely so the
// compiler will surface anything still trying to set them.
export type Tool = "chat" | "canvas" | "notebook" | "thought-history" | "grokipedia" | "help" | "data-input" | "logs" | "plan-resources";

interface ToolsPanelProps {
  activeTool: Tool | null;
  onToolChange: (tool: Tool) => void;
  problem: string;
  className?: string;
  errorNotification?: boolean;
  sessionId?: string;
  planId?: string;
  disabledTools?: Tool[];
  onBackToDashboard?: () => void;
  isRecording?: boolean;
  isPaused?: boolean;
  isWebcamEnabled?: boolean;
  museStatus?: MuseAthenaStatus;
  museDeviceStatus?: DeviceStatus | null;
  museChannelData?: Map<string, number[]>;
}

function ToolIcon({ id }: { id: Tool }) {
  switch (id) {
    case "chat":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    case "canvas":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      );
    case "notebook":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case "grokipedia":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "thought-history":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-2.636-6.364M21 3v5h-5" />
        </svg>
      );
    case "help":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "data-input":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "logs":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "plan-resources":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
      );
  }
}

const bottomTools: Tool[] = ["help", "data-input", "logs"];

export function ToolsPanel({ 
  activeTool, onToolChange, problem, className = "", errorNotification = false,
  sessionId, planId, disabledTools = [], onBackToDashboard,
  isRecording = false, isPaused = false, isWebcamEnabled = false,
  museStatus = "disconnected", museDeviceStatus = null, museChannelData,
}: ToolsPanelProps) {
  const { t } = useI18n();
  // Practice (exercise) and Theory (reading) used to live here as their
  // own panels. They've been merged into the Helios chat surface — the
  // action buttons in ProbesPanel / SessionPlanViewer now inject a rich
  // assistant message into chat instead. Keep this list lean.
  const baseMainTools: Tool[] = ["chat", "canvas", "notebook", "thought-history", "grokipedia"];
  const mainTools: Tool[] = planId ? [...baseMainTools, "plan-resources"] : baseMainTools;
  const [showQRModal, setShowQRModal] = useState(false);

  const getToolLabel = (id: Tool): string => {
    switch (id) {
      case "chat": return t('tools.helios');
      case "canvas": return t('tools.canvas');
      case "notebook": return t('tools.notebook');
      case "thought-history": return "Thoughts";

      case "grokipedia": return t('tools.grokipedia');
      case "help": return t('tools.help');
      case "data-input": return t('tools.dataInput');
      case "logs": return t('tools.logs');
      case "plan-resources": return t('tools.planResources');
    }
  };

  return (
    <div className={`w-52 shrink-0 flex flex-col p-3 bg-neutral-900/50 border-r border-neutral-800 ${className}`}>
      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-1 px-1">
          {t('tools.tools')}
        </div>
        {mainTools.map((toolId) => {
          const isDisabled = disabledTools.includes(toolId);
          return (
          <button
            key={toolId}
            onClick={() => !isDisabled && onToolChange(toolId)}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              isDisabled
                ? "bg-neutral-800/30 text-neutral-600 border border-neutral-800/30 cursor-not-allowed"
                : activeTool === toolId
                ? "bg-neutral-700/70 text-white border border-neutral-600"
                : "bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            }`}
          >
            <ToolIcon id={toolId} />
            <span>{getToolLabel(toolId)}</span>
            {toolId === "logs" && errorNotification && (
              <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
          );
        })}
      </div>

      <SensorStrip
        audioActive={isRecording && !isPaused}
        webcamActive={isWebcamEnabled}
        museStatus={museStatus}
        museDeviceStatus={museDeviceStatus}
        museChannelData={museChannelData}
      />

      <div className="flex flex-col gap-1 pt-3 border-t border-neutral-800">
        {bottomTools.map((toolId) => (
          <button
            key={toolId}
            onClick={() => onToolChange(toolId)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTool === toolId
                ? "bg-neutral-700/70 text-white border border-neutral-600"
                : "bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            }`}
          >
            <ToolIcon id={toolId} />
            <span>{getToolLabel(toolId)}</span>
            {toolId === "logs" && errorNotification && (
              <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        ))}

        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            title={t('session.backToDashboard')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>{t('session.backToDashboard')}</span>
          </button>
        )}

        {/* Mobile / QR button */}
        {sessionId && (
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all bg-neutral-800/50 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 hover:text-neutral-300"
            title={t('session.openOnSmartphone')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>{t('tools.mobile')}</span>
          </button>
        )}
      </div>

      {/* QR Code Modal */}
      {sessionId && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}

function SensorStrip({
  audioActive,
  webcamActive,
  museStatus,
  museDeviceStatus,
  museChannelData,
}: {
  audioActive: boolean;
  webcamActive: boolean;
  museStatus: MuseAthenaStatus;
  museDeviceStatus: DeviceStatus | null;
  museChannelData?: Map<string, number[]>;
}) {
  return (
    <div className="mt-auto mb-2 space-y-1.5">
      {webcamActive && <WebcamMiniPreview />}
      <AudioMiniMeter active={audioActive} />
      <WebcamMiniStatus active={webcamActive} />
      <EEGMiniStatus
        museStatus={museStatus}
        museDeviceStatus={museDeviceStatus}
        museChannelData={museChannelData}
      />
    </div>
  );
}

function WebcamMiniPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices?.getUserMedia({ video: { width: 320, height: 180 }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((error) => {
        console.warn("Sidebar webcam preview failed:", error);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/70 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]" title="Live webcam preview">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full object-cover opacity-80 grayscale"
      />
    </div>
  );
}

function AudioMiniMeter({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2 py-1" title={active ? "Audio recording is active" : "Audio recording is off"}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-blue-400 animate-pulse" : "bg-neutral-700"}`} />
      <span className={`text-[10px] uppercase tracking-wide ${active ? "text-blue-400" : "text-neutral-600"}`}>Audio {active ? "on" : "off"}</span>
      <div className="ml-auto flex items-end gap-0.5 h-3">
        {[4, 8, 12, 7].map((height, index) => (
          <div
            key={index}
            className={`w-1 rounded-full ${active ? "bg-blue-400/80" : "bg-neutral-700"}`}
            style={{ height: active ? height : 3 }}
          />
        ))}
      </div>
    </div>
  );
}

function WebcamMiniStatus({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2 py-1" title={active ? "Webcam tracking is active" : "Webcam tracking is off"}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-violet-400 animate-pulse" : "bg-neutral-700"}`} />
      <span className={`text-[10px] uppercase tracking-wide ${active ? "text-violet-400" : "text-neutral-600"}`}>Webcam {active ? "on" : "off"}</span>
      <svg className={`ml-auto w-3.5 h-3.5 ${active ? "text-violet-400" : "text-neutral-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function EEGMiniStatus({
  museStatus,
  museDeviceStatus,
  museChannelData,
}: {
  museStatus: MuseAthenaStatus;
  museDeviceStatus: DeviceStatus | null;
  museChannelData?: Map<string, number[]>;
}) {
  const isStreaming = museStatus === "streaming";
  const activeChannels = EEG_CHANNELS.filter((channel) => (museChannelData?.get(channel)?.length ?? 0) > 0).length;
  const inferredQuality = activeChannels >= 4 ? "good" : activeChannels >= 2 ? "fair" : "poor";
  const quality = isStreaming ? (museDeviceStatus?.signalQuality || inferredQuality) : "poor";
  const label = !isStreaming ? "EEG off" : quality === "good" ? "EEG good" : quality === "fair" ? "EEG fair" : "EEG poor";
  const textColor = quality === "good" ? "text-green-400" : quality === "fair" ? "text-amber-400" : "text-red-400";
  const dotColor = quality === "good" ? "bg-green-400" : quality === "fair" ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2 py-1" title="EEG health: green means most channels are receiving data, yellow means partial signal, red means poor/off.">
      <div className="flex items-center gap-2 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? `${dotColor} animate-pulse` : "bg-neutral-700"}`} />
        <span className={`text-[10px] uppercase tracking-wide ${isStreaming ? textColor : "text-neutral-600"}`}>{label}</span>
      </div>
      <div className="ml-auto flex items-center justify-end gap-1">
        {EEG_CHANNELS.map((channel) => {
          const samples = museChannelData?.get(channel)?.length ?? 0;
          const channelQuality = museDeviceStatus?.electrodeQuality?.[channel];
          const isActive = samples > 0;
          const isGood = typeof channelQuality === "number" ? channelQuality > 0.5 : isActive;
          const isFair = typeof channelQuality === "number" ? channelQuality > 0.2 && channelQuality <= 0.5 : false;
          const color = !isStreaming || !isActive
            ? "bg-neutral-700"
            : isGood
              ? "bg-green-400"
              : isFair
                ? "bg-amber-400"
                : "bg-red-400";
          return (
            <div key={channel} className="flex items-center gap-0.5" title={`${channel}: ${isActive ? `${samples} recent samples` : "no recent samples"}`}>
              <div className={`h-1 w-1 rounded-full ${color}`} />
              <span className="text-[6px] leading-none text-neutral-500">{channel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
