"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DeviceStatus } from "@/lib/muse-athena";
import { museEegPreviewState, type MuseEegPreviewState } from "@/lib/muse-eeg-quality";

export const SESSION_DATA_TABS = ["audio", "muse", "video", "screen"] as const;

export type SessionDataTab = (typeof SESSION_DATA_TABS)[number];

type BandPowers = {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
};

const TAB_META: Record<SessionDataTab, { index: string; label: string }> = {
  audio: { index: "01", label: "Audio" },
  muse: { index: "02", label: "Muse" },
  video: { index: "03", label: "Video" },
  screen: { index: "04", label: "Screen" },
};

const MUSE_LANES = ["TP9", "AF7", "AF8", "TP10"] as const;

const MUSE_BANDS = [
  { key: "delta", label: "δ" },
  { key: "theta", label: "θ" },
  { key: "alpha", label: "α" },
  { key: "beta", label: "β" },
  { key: "gamma", label: "γ" },
] as const;

/** Room left above the transcript strip that sits on the audio tab. */
const AUDIO_OVERLAY_PX = 56;

function museConsoleWord(status: string, device: DeviceStatus | null): string {
  if (status === "connecting") return "SYNC";
  if (status === "connected") return "LINK";
  const preview: MuseEegPreviewState = museEegPreviewState(status, device);
  if (preview === "good") return "LOCK";
  if (preview === "fair") return "FAIR";
  if (preview === "poor") return "WEAK";
  if (preview === "checking") return "SYNC";
  return "LIVE";
}

function ConsoleGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    />
  );
}

function Scanlines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[12]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.045) 3px)",
      }}
    />
  );
}

function CornerBrackets() {
  const arm = "pointer-events-none absolute z-[14] h-2.5 w-2.5 border-white/80";
  return (
    <>
      <span aria-hidden className={`${arm} left-1.5 top-1.5 border-l border-t`} />
      <span aria-hidden className={`${arm} right-1.5 top-1.5 border-r border-t`} />
      <span aria-hidden className={`${arm} bottom-1.5 left-1.5 border-b border-l`} />
      <span aria-hidden className={`${arm} bottom-1.5 right-1.5 border-b border-r`} />
    </>
  );
}

function Standby({
  tab,
  note,
  onEnable,
}: {
  tab: SessionDataTab;
  note?: string | null;
  onEnable?: () => void;
}) {
  return (
    <div
      data-session-data-standby={tab}
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black ${
        tab === "audio" ? "pb-14" : ""
      }`}
    >
      <ConsoleGrid />
      <p className="relative font-mono text-[9px] uppercase tracking-[0.32em] text-neutral-500">
        {TAB_META[tab].index} / {TAB_META[tab].label} / standby
      </p>
      {note ? (
        <p className="relative max-w-[14rem] px-3 text-center font-mono text-[10px] leading-snug text-neutral-300">
          {note}
        </p>
      ) : null}
      <button
        type="button"
        data-session-data-enable={tab}
        onClick={onEnable}
        className="relative rounded-none border border-white/80 bg-black px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-white hover:bg-white hover:text-black"
      >
        Enable
      </button>
    </div>
  );
}

function StopControl({
  tab,
  label = "Stop",
  onDisable,
}: {
  tab: SessionDataTab;
  label?: string;
  onDisable?: () => void;
}) {
  if (!onDisable) return null;
  return (
    <button
      type="button"
      data-session-data-stop={tab}
      onClick={onDisable}
      className="absolute right-1.5 top-1.5 z-[16] rounded-none border border-white/50 bg-black/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white hover:bg-white hover:text-black"
    >
      {label}
    </button>
  );
}

function AudioScope({
  stream,
  active,
  reserveBottom = AUDIO_OVERLAY_PX,
}: {
  stream: MediaStream | null;
  active: boolean;
  /** Pixels kept clear at the bottom. The Data card leaves room for its transcript strip. */
  reserveBottom?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animation = 0;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let bins = new Uint8Array(0);
    const live = streamRef.current;
    if (live) {
      try {
        audioContext = new AudioContext();
        void audioContext.resume();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(live).connect(analyser);
        bins = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        analyser = null;
      }
    }

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      const plot = Math.max(24, height - reserveBottom);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let row = 1; row <= 3; row += 1) {
        const y = (plot / 4) * row;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, plot - 0.5);
      ctx.lineTo(width, plot - 0.5);
      ctx.stroke();

      const bars = 36;
      const gap = 2;
      const barWidth = Math.max(1, width / bars - gap);
      if (analyser) {
        analyser.getByteFrequencyData(bins);
        let peak = 0;
        for (let i = 0; i < bars; i += 1) {
          const magnitude = bins[i * 3] ?? 0;
          peak = Math.max(peak, magnitude);
          const barHeight = Math.max(1, (magnitude / 255) * (plot - 8));
          const x = i * (barWidth + gap) + 1;
          ctx.fillStyle = "rgba(255,255,255,0.38)";
          ctx.fillRect(x, plot - barHeight, barWidth, barHeight);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x, plot - barHeight, barWidth, 1.5);
        }
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText(String(peak).padStart(3, "0"), Math.max(52, width - 78), 14);
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath();
        ctx.moveTo(0, plot * 0.55);
        ctx.lineTo(width, plot * 0.55);
        ctx.stroke();
      }
      animation = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animation);
      void audioContext?.close();
    };
  }, [active, reserveBottom, stream]);

  return (
    <canvas
      ref={canvasRef}
      data-session-data-audio
      className="absolute inset-0 h-full w-full"
    />
  );
}

/** The Data-card audio scope, without the four-tab frame. Bars follow `stream`. */
export function SessionAudioMonitor({ stream }: { stream: MediaStream | null }) {
  return (
    <div
      data-session-audio-monitor
      className="relative h-40 w-full overflow-hidden border border-white/35 bg-black"
    >
      <AudioScope stream={stream} active reserveBottom={12} />
      <p className="pointer-events-none absolute left-3 top-1.5 z-[5] font-mono text-[8px] uppercase tracking-[0.28em] text-white/70">
        MIC-01
      </p>
      <Scanlines />
      <CornerBrackets />
    </div>
  );
}

function MuseScope({
  active,
  channels,
  status,
}: {
  active: boolean;
  channels: Map<string, number[]> | undefined;
  status: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animation = 0;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = rect.width;
      const height = rect.height;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      const laneH = height / MUSE_LANES.length;
      const labelBand = 12;
      const map = channelsRef.current;
      let any = false;
      ctx.font = "8px ui-monospace, monospace";
      ctx.lineWidth = 1;
      MUSE_LANES.forEach((name, index) => {
        const top = index * laneH;
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.beginPath();
        ctx.moveTo(0, top + laneH - 0.5);
        ctx.lineTo(width, top + laneH - 0.5);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(name, 6, top + 9);
        const samples = map?.get(name);
        if (!samples || samples.length < 2) return;
        any = true;
        const windowSamples = samples.slice(-120);
        let max = 1;
        for (const value of windowSamples) max = Math.max(max, Math.abs(value));
        const plotTop = top + labelBand;
        const plotH = Math.max(8, laneH - labelBand - 2);
        const mid = plotTop + plotH / 2;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        const step = (width - 36) / Math.max(1, windowSamples.length - 1);
        for (let i = 0; i < windowSamples.length; i += 1) {
          const x = 32 + i * step;
          const y = mid - (windowSamples[i] / max) * (plotH * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      if (!any) {
        const sweep = (performance.now() / 18) % width;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.moveTo(sweep, 0);
        ctx.lineTo(sweep, height);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText(status === "streaming" ? "SYNC" : "WAIT", width / 2 - 14, height - 16);
      }
      animation = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animation);
  }, [active, status]);

  return (
    <canvas
      ref={canvasRef}
      data-session-data-muse
      className="absolute inset-0 h-full w-full"
    />
  );
}

function PictureFeed({
  active,
  stream,
  selfCapture,
}: {
  active: boolean;
  stream?: MediaStream | null;
  selfCapture: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return;
    let cancelled = false;
    let owned: MediaStream | null = null;
    const attach = (next: MediaStream | null) => {
      video.srcObject = next;
      if (next) void video.play().catch(() => undefined);
    };
    if (stream) {
      attach(stream);
      return () => {
        video.srcObject = null;
      };
    }
    if (!selfCapture) {
      attach(null);
      return;
    }
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        owned = next;
        attach(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      owned?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [active, selfCapture, stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      data-session-data-picture
      className="absolute inset-0 h-full w-full object-cover grayscale contrast-125"
    />
  );
}

function PictureHud({
  code,
  live,
  waiting,
}: {
  code: string;
  live: string;
  waiting: boolean;
}) {
  return (
    <>
      <Scanlines />
      <CornerBrackets />
      <div className="pointer-events-none absolute inset-3 border border-white/25" />
      <p className="pointer-events-none absolute left-5 top-1.5 font-mono text-[8px] uppercase tracking-[0.28em] text-white">
        {code}
      </p>
      <p className="pointer-events-none absolute bottom-2 left-5 font-mono text-[8px] uppercase tracking-[0.28em] text-white/80">
        {waiting ? "WAIT" : live}
      </p>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 border border-white/60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 bg-white/70" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-px -translate-y-1/2 bg-white/70" />
    </>
  );
}

/**
 * One full-width console for the sidebar Data block.
 * Four streams. A disabled stream shows Enable. A live stream fills the card.
 */
export function SessionDataCard({
  defaultTab = "audio",
  audioEnabled,
  onEnableAudio,
  onDisableAudio,
  audioNote = null,
  audioStream = null,
  audioDisableLabel = "Stop",
  museEnabled,
  onEnableMuse,
  onDisableMuse,
  museNote = null,
  museStatus = "disconnected",
  museDeviceStatus = null,
  museChannelData,
  bandPowers = null,
  videoEnabled,
  onEnableVideo,
  onDisableVideo,
  videoNote = null,
  videoStream,
  captureVideo = false,
  screenEnabled,
  onEnableScreen,
  onDisableScreen,
  screenNote = null,
  screenStream = null,
}: {
  defaultTab?: SessionDataTab;
  audioEnabled: boolean;
  onEnableAudio?: () => void;
  onDisableAudio?: () => void;
  audioNote?: string | null;
  audioStream?: MediaStream | null;
  /** Learn mutes the session mic. Other modes stop the stream they opened. */
  audioDisableLabel?: string;
  museEnabled: boolean;
  onEnableMuse?: () => void;
  onDisableMuse?: () => void;
  museNote?: string | null;
  museStatus?: string;
  museDeviceStatus?: DeviceStatus | null;
  museChannelData?: Map<string, number[]>;
  bandPowers?: BandPowers | null;
  videoEnabled: boolean;
  onEnableVideo?: () => void;
  onDisableVideo?: () => void;
  videoNote?: string | null;
  /** Omitted: the card opens the camera when `captureVideo` is set. Null: waiting on the caller. */
  videoStream?: MediaStream | null;
  captureVideo?: boolean;
  screenEnabled: boolean;
  onEnableScreen?: () => void;
  onDisableScreen?: () => void;
  screenNote?: string | null;
  screenStream?: MediaStream | null;
}) {
  const [active, setActive] = useState<SessionDataTab>(defaultTab);
  const enabled: Record<SessionDataTab, boolean> = {
    audio: audioEnabled,
    muse: museEnabled,
    video: videoEnabled,
    screen: screenEnabled,
  };
  const enable: Record<SessionDataTab, (() => void) | undefined> = {
    audio: onEnableAudio,
    muse: onEnableMuse,
    video: onEnableVideo,
    screen: onEnableScreen,
  };
  const disable: Record<SessionDataTab, (() => void) | undefined> = {
    audio: onDisableAudio,
    muse: onDisableMuse,
    video: onDisableVideo,
    screen: onDisableScreen,
  };
  const notes: Record<SessionDataTab, string | null> = {
    audio: audioNote,
    muse: museNote,
    video: videoNote,
    screen: screenNote,
  };
  const cover = active !== "audio";
  const maxBand = bandPowers
    ? Math.max(bandPowers.delta, bandPowers.theta, bandPowers.alpha, bandPowers.beta, bandPowers.gamma, 0.0001)
    : 1;

  let panel: ReactNode = (
    <Standby tab={active} note={notes[active]} onEnable={enable[active]} />
  );
  if (enabled[active] && active === "audio") {
    panel = (
      <>
        <AudioScope stream={audioStream} active />
        <p className="pointer-events-none absolute left-5 top-1.5 z-[5] font-mono text-[8px] uppercase tracking-[0.28em] text-white/70">
          MIC-01
        </p>
        <StopControl tab="audio" label={audioDisableLabel} onDisable={onDisableAudio} />
      </>
    );
  } else if (enabled[active] && active === "muse") {
    panel = (
      <>
        <MuseScope active channels={museChannelData} status={museStatus} />
        <p
          data-session-data-muse-state
          className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 font-mono text-[8px] uppercase tracking-[0.28em] text-white/80"
        >
          {museConsoleWord(museStatus, museDeviceStatus)}
        </p>
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-end gap-1" data-session-data-bands>
          {MUSE_BANDS.map((band) => {
            const value = bandPowers?.[band.key] ?? 0;
            const height = bandPowers ? Math.max(8, Math.round((value / maxBand) * 100)) : 8;
            return (
              <div key={band.key} className="flex h-10 w-2 flex-col items-center justify-end gap-0.5">
                <div className="relative w-full flex-1 bg-white/10">
                  <div
                    data-session-data-band={band.key}
                    className="absolute inset-x-0 bottom-0 bg-white/85"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="font-mono text-[7px] leading-none text-white/70">{band.label}</span>
              </div>
            );
          })}
        </div>
        <StopControl tab="muse" onDisable={onDisableMuse} />
      </>
    );
  } else if (enabled[active] && active === "video") {
    panel = (
      <div data-session-data-video className="absolute inset-0 bg-black">
        <PictureFeed active stream={videoStream} selfCapture={captureVideo && videoStream == null} />
        <PictureHud code="CAM-01" live="LIVE" waiting={videoStream == null && !captureVideo} />
        <StopControl tab="video" onDisable={onDisableVideo} />
      </div>
    );
  } else if (enabled[active] && active === "screen") {
    panel = (
      <div data-session-data-screen className="absolute inset-0 bg-black">
        <PictureFeed active stream={screenStream} selfCapture={false} />
        <PictureHud code="SCR-01" live="CAP" waiting={!screenStream} />
        <StopControl tab="screen" onDisable={onDisableScreen} />
      </div>
    );
  }

  return (
    <div
      data-session-data-card
      data-session-data-active={active}
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-black text-white"
    >
      <div role="tablist" className="relative z-[70] flex shrink-0 border-b border-white/25 bg-black">
        {SESSION_DATA_TABS.map((tab) => {
          const selected = active === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              data-session-data-tab={tab}
              aria-selected={selected}
              onClick={() => setActive(tab)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-none border-r border-white/15 px-1 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] last:border-r-0 ${
                selected ? "bg-white text-black" : "bg-black text-neutral-500 hover:text-white"
              }`}
            >
              <span className={selected ? "text-black/60" : "text-neutral-600"}>{TAB_META[tab].index}</span>
              {TAB_META[tab].label}
            </button>
          );
        })}
      </div>
      <div className={`relative min-h-0 flex-1 ${cover ? "z-[60]" : "z-0"}`}>
        {panel}
        {enabled[active] ? <Scanlines /> : null}
        {enabled[active] && active === "audio" ? <CornerBrackets /> : null}
      </div>
    </div>
  );
}
