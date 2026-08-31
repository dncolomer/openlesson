"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { ILE_OPEN_PIC_IN_PIC_LABEL } from "@/lib/ile-compact-window";
import type { DeviceStatus, MuseAthenaStatus } from "@/lib/muse-athena";

const EEG_CHANNELS = ["TP9", "AF7", "AF8", "TP10", "FPz"] as const;

// Note: "exercise" (Practice) and "reading" (Theory) have been folded
// into the Helios chat surface — those buttons now inject a rich
// assistant message into the chat instead of opening their own panel.
// They no longer appear in the desktop sidebar. The Tool union still
// keeps them around as accepted values *only* if other call sites
// reference them historically; here we drop them entirely so the
// compiler will surface anything still trying to set them.
export type Tool = "chat" | "chapters" | "canvas" | "notebook" | "thought-history" | "grokipedia" | "dantes" | "help" | "data-input" | "logs" | "plan-resources";

interface ToolsPanelProps {
  activeTool: Tool | null;
  onToolChange: (tool: Tool) => void;
  problem: string;
  className?: string;
  errorNotification?: boolean;
  workspaceId?: string;
  disabledTools?: Tool[];
  onBackToDashboard?: () => void;
  isRecording?: boolean;
  isPaused?: boolean;
  isWebcamEnabled?: boolean;
  museStatus?: MuseAthenaStatus;
  museDeviceStatus?: DeviceStatus | null;
  museChannelData?: Map<string, number[]>;
  /** No Meet-style Document PiP: show the manual popup control above Help. */
  showOpenPicInPic?: boolean;
  onOpenPicInPic?: () => void;
}

function ToolIcon({ id }: { id: Tool }) {
  switch (id) {
    case "chat":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      );
    case "chapters":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
    case "dantes":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v10.5m0-10.5C10.6 5.817 8.713 5.25 6.75 5.25S2.9 5.817 1.5 6.75v10.5c1.4-.933 3.287-1.5 5.25-1.5S10.6 16.317 12 17.25m0-10.5c1.4-.933 3.287-1.5 5.25-1.5s3.85.567 5.25 1.5v10.5c-1.4-.933-3.287-1.5-5.25-1.5s-3.85.567-5.25 1.5" />
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

const utilityTools: Tool[] = ["help", "data-input", "logs"];

export function VoiceBarUtilityRow({
  activeTool,
  onToolChange,
  onBackToDashboard,
  errorNotification = false,
}: {
  activeTool: Tool | null;
  onToolChange: (tool: Tool) => void;
  onBackToDashboard?: () => void;
  errorNotification?: boolean;
}) {
  const { t } = useI18n();
  const getToolLabel = (id: Tool): string => {
    switch (id) {
      case "help": return t("tools.help");
      case "data-input": return t("tools.dataInput");
      case "logs": return t("tools.logs");
      default: return id;
    }
  };

  return (
    <div data-ile-voice-utility className="flex justify-end">
      <div className="inline-grid grid-cols-4 gap-1">
      {utilityTools.map((toolId) => (
        <button
          key={toolId}
          type="button"
          onClick={() => onToolChange(toolId)}
          className={`flex h-8 w-full items-center justify-center gap-1 rounded-none px-2 text-[11px] font-medium ${
            activeTool === toolId
              ? "border border-neutral-600 bg-neutral-700/70 text-white"
              : "border border-neutral-700/50 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300"
          }`}
        >
          <ToolIcon id={toolId} />
          <span className="truncate">{getToolLabel(toolId)}</span>
          {toolId === "logs" && errorNotification ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
          ) : null}
        </button>
      ))}
      {onBackToDashboard ? (
        <button
          type="button"
          data-save-and-exit
          onClick={onBackToDashboard}
          className="flex h-8 w-full items-center justify-center rounded-none bg-neutral-100 px-2 text-[11px] font-semibold text-neutral-900 hover:bg-white"
          title={t("session.saveAndExit")}
        >
          <span className="truncate">{t("session.saveAndExit")}</span>
        </button>
      ) : (
        <span />
      )}
      </div>
    </div>
  );
}

export function ToolsPanel({ 
  activeTool, onToolChange, problem, className = "", errorNotification = false,
  workspaceId, disabledTools = [], onBackToDashboard,
  isRecording = false, isPaused = false, isWebcamEnabled = false,
  museStatus = "disconnected", museDeviceStatus = null, museChannelData,
  showOpenPicInPic = false, onOpenPicInPic,
}: ToolsPanelProps) {
  const { t } = useI18n();
  // Practice (exercise) and Theory (reading) used to live here as their
  // own panels. They've been merged into the Helios chat surface — the
  // action buttons in ProbesPanel / SessionPlanViewer now inject a rich
  // assistant message into chat instead. Keep this list lean.
  const baseMainTools: Tool[] = ["chapters", "canvas", "notebook", "thought-history", "grokipedia", "dantes"];
  const mainTools: Tool[] = workspaceId ? [...baseMainTools, "plan-resources"] : baseMainTools;
  const getToolLabel = (id: Tool): string => {
    switch (id) {
      case "chat": return t('tools.helios');
      case "chapters": return t('tools.chapters');
      case "canvas": return t('tools.canvas');
      case "notebook": return t('tools.notebook');
      case "thought-history": return "Thoughts";

      case "grokipedia": return t('tools.grokipedia');
      case "dantes": return t('tools.dantes');
      case "help": return t('tools.help');
      case "data-input": return t('tools.dataInput');
      case "logs": return t('tools.logs');
      case "plan-resources": return t('tools.planResources');
    }
  };

  const toolCellClass = (isActive = false, isDisabled = false) =>
    `flex h-[3.25rem] min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-none px-1 text-[10px] font-medium leading-tight transition-all ${
      isDisabled
        ? "cursor-not-allowed border border-neutral-800/30 bg-neutral-800/30 text-neutral-600"
        : isActive
          ? "border border-neutral-600 bg-neutral-700/70 text-white"
          : "border border-neutral-700/50 bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300"
    }`;

  return (
    <div
      data-ile-tools-widget
      data-ile-tools-layout="compact"
      className={`pointer-events-auto flex w-[min(20rem,calc(100vw-1rem))] max-w-[20rem] shrink-0 flex-col overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95 p-1.5 ${className}`}
    >
      <div data-ile-tools-grid className="grid grid-cols-4 auto-rows-[3.25rem] gap-1">
        {mainTools.map((toolId) => {
          const isDisabled = disabledTools.includes(toolId);
          return (
          <button
            key={toolId}
            onClick={() => !isDisabled && onToolChange(toolId)}
            disabled={isDisabled}
            className={toolCellClass(activeTool === toolId, isDisabled)}
          >
            <ToolIcon id={toolId} />
            <span className="min-w-0 max-w-full truncate px-0.5">{getToolLabel(toolId)}</span>
            {toolId === "logs" && errorNotification && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
          );
        })}
        {showOpenPicInPic && onOpenPicInPic ? (
          <button
            type="button"
            data-ile-open-pic-in-pic
            onClick={onOpenPicInPic}
            className={toolCellClass()}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V6.75A2.25 2.25 0 015.25 4.5h1.5M3 15.75v1.5A2.25 2.25 0 005.25 19.5h1.5M15.75 4.5h1.5A2.25 2.25 0 0119.5 6.75v1.5M19.5 15.75v1.5a2.25 2.25 0 01-2.25 2.25h-1.5M8.25 9.75h7.5v4.5h-7.5v-4.5z" />
            </svg>
            <span className="min-w-0 max-w-full truncate px-0.5">{ILE_OPEN_PIC_IN_PIC_LABEL}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

const sensorHalfWidgetShell =
  "pointer-events-auto relative min-w-0 w-full overflow-hidden rounded-none border border-neutral-700 bg-neutral-950/95";

export function AudioMiniPreview({
  stream,
  muted,
  onToggleMute,
}: {
  stream: MediaStream | null;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animation = 0;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    const dataArray = { current: new Uint8Array(0) };

    const paintIdle = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    if (!stream || muted) {
      paintIdle();
      return;
    }

    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      paintIdle();
      return;
    }

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !analyser) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      analyser.getByteFrequencyData(dataArray.current);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, rect.width, rect.height);
      const bars = 20;
      const barWidth = rect.width / bars;
      for (let i = 0; i < bars; i += 1) {
        const magnitude = dataArray.current[i * 4] ?? 0;
        const barHeight = (magnitude / 255) * rect.height;
        ctx.fillStyle = "rgba(229,229,229,0.85)";
        ctx.fillRect(i * barWidth + 1, rect.height - barHeight, Math.max(1, barWidth - 2), barHeight);
      }
      animation = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animation);
      void audioContext?.close();
    };
  }, [stream, muted]);

  return (
    <div
      data-ile-audio-preview
      className={`${sensorHalfWidgetShell} aspect-video`}
      title={muted ? "Microphone muted" : "Live audio"}
    >
      <button
        type="button"
        data-ile-audio-mute
        onClick={onToggleMute}
        className="absolute right-1 top-1 z-10 rounded-none border border-neutral-600 bg-neutral-950/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-200 hover:border-neutral-400 hover:text-white"
      >
        {muted ? "Unmute" : "Mute"}
      </button>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full grayscale" />
    </div>
  );
}

function SensorPreviewOffButton({
  onTurnOff,
  testId,
}: {
  onTurnOff: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-ile-sensor-off={testId}
      onClick={onTurnOff}
      className="absolute right-1 top-1 z-10 rounded-none border border-neutral-600 bg-neutral-950/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-200 hover:border-neutral-400 hover:text-white"
    >
      Turn off
    </button>
  );
}

export function WebcamMiniPreview({
  onTurnOff,
}: {
  onTurnOff?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 320, height: 180 }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((error) => {
        console.warn("Webcam preview failed:", error);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return (
    <div
      data-ile-webcam-preview
      className={sensorHalfWidgetShell}
      title="Live webcam preview"
    >
      {onTurnOff ? <SensorPreviewOffButton onTurnOff={onTurnOff} testId="webcam" /> : null}
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

export function EegMiniPreview({
  museChannelData,
}: {
  museChannelData?: Map<string, number[]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      const lane = h / EEG_CHANNELS.length;
      EEG_CHANNELS.forEach((channel, idx) => {
        const samples = museChannelData?.get(channel) ?? [];
        const y0 = idx * lane;
        ctx.strokeStyle = "rgba(163,163,163,0.2)";
        ctx.beginPath();
        ctx.moveTo(0, y0 + lane / 2);
        ctx.lineTo(w, y0 + lane / 2);
        ctx.stroke();
        if (samples.length < 2) return;
        const slice = samples.slice(-80);
        const min = Math.min(...slice);
        const max = Math.max(...slice);
        const range = max - min || 1;
        ctx.strokeStyle = "rgba(229,229,229,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        slice.forEach((value, i) => {
          const x = (i / (slice.length - 1)) * w;
          const y = y0 + lane - ((value - min) / range) * lane;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [museChannelData]);

  return (
    <div
      data-ile-eeg-preview
      className={`${sensorHalfWidgetShell} aspect-video`}
      title="Live EEG"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full grayscale" />
    </div>
  );
}

export function ScreenShareMiniPreview({
  stream,
  onTurnOff,
}: {
  stream: MediaStream | null;
  onTurnOff?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div
      data-ile-screenshare-preview
      className={sensorHalfWidgetShell}
      title="Live screenshare"
    >
      {onTurnOff ? <SensorPreviewOffButton onTurnOff={onTurnOff} testId="screenshare" /> : null}
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

export function SensorStrip({
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
    <div
      data-ile-signal-strip
      className="flex flex-wrap items-center gap-1.5"
    >
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

function AudioMiniMeter({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-none border border-neutral-800 bg-neutral-950/50 px-2 py-1" title={active ? "Audio recording is active" : "Audio recording is off"}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-neutral-200 animate-pulse" : "bg-neutral-700"}`} />
      <span className={`text-[10px] uppercase tracking-wide ${active ? "text-neutral-300" : "text-neutral-600"}`}>Audio {active ? "on" : "off"}</span>
      <div className="ml-auto flex items-end gap-0.5 h-3">
        {[4, 8, 12, 7].map((height, index) => (
          <div
            key={index}
            className={`w-1 rounded-full ${active ? "bg-neutral-800/80" : "bg-neutral-700"}`}
            style={{ height: active ? height : 3 }}
          />
        ))}
      </div>
    </div>
  );
}

function WebcamMiniStatus({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-none border border-neutral-800 bg-neutral-950/50 px-2 py-1" title={active ? "Webcam tracking is active" : "Webcam tracking is off"}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-neutral-200 animate-pulse" : "bg-neutral-700"}`} />
      <span className={`text-[10px] uppercase tracking-wide ${active ? "text-neutral-300" : "text-neutral-600"}`}>Webcam {active ? "on" : "off"}</span>
      <svg className={`ml-auto w-3.5 h-3.5 ${active ? "text-neutral-300" : "text-neutral-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
  const textColor = quality === "good" ? "text-green-400" : quality === "fair" ? "text-neutral-300" : "text-red-400";
  const dotColor = quality === "good" ? "bg-green-400" : quality === "fair" ? "bg-neutral-200" : "bg-red-400";

  return (
    <div className="flex items-center gap-2 rounded-none border border-neutral-800 bg-neutral-950/50 px-2 py-1" title="EEG health: green means most channels are receiving data, yellow means partial signal, red means poor/off.">
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
                ? "bg-neutral-200"
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
