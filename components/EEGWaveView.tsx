"use client";

import { useEffect, useRef, useCallback } from "react";

interface EEGWaveViewProps {
  /** Map of channel name -> rolling sample buffer (microvolts) */
  channelData: Map<string, number[]>;
  /** How many samples to show on screen (default 512 = ~2s at 256Hz) */
  visibleSamples?: number;
  /** Height per channel trace in px */
  traceHeight?: number;
  /** Which channels to render (default: AF7, AF8, TP9, TP10) */
  channels?: string[];
}

const DEFAULT_CHANNELS = ["TP9", "AF7", "AF8", "TP10"];

const CHANNEL_COLORS: Record<string, [string, string]> = {
  TP9:   ["#a78bfa", "rgba(167, 139, 250, 0.15)"], // purple
  AF7:   ["#60a5fa", "rgba(96, 165, 250, 0.15)"],   // blue
  AF8:   ["#34d399", "rgba(52, 211, 153, 0.15)"],   // green
  TP10:  ["#fbbf24", "rgba(251, 191, 36, 0.15)"],   // amber
  FPz:   ["#f472b6", "rgba(244, 114, 182, 0.15)"],  // pink
  AUX_R: ["#94a3b8", "rgba(148, 163, 184, 0.10)"],  // slate
  AUX_L: ["#94a3b8", "rgba(148, 163, 184, 0.10)"],  // slate
};

const FALLBACK_COLOR: [string, string] = ["#94a3b8", "rgba(148, 163, 184, 0.10)"];

export function EEGWaveView({
  channelData,
  visibleSamples = 512,
  traceHeight = 40,
  channels = DEFAULT_CHANNELS,
}: EEGWaveViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const totalHeight = channels.length * traceHeight;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(totalHeight * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(totalHeight * dpr);
      canvas.style.height = `${totalHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Dark background
    ctx.fillStyle = "rgba(5, 5, 15, 0.95)";
    ctx.fillRect(0, 0, width, totalHeight);

    channels.forEach((channelName, chIdx) => {
      const samples = channelData.get(channelName);
      const yCenter = chIdx * traceHeight + traceHeight / 2;
      const [color, glowColor] = CHANNEL_COLORS[channelName] || FALLBACK_COLOR;

      // Subtle separator
      if (chIdx > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, chIdx * traceHeight);
        ctx.lineTo(width, chIdx * traceHeight);
        ctx.stroke();
      }

      if (!samples || samples.length < 4) {
        // Flat line
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, yCenter);
        ctx.lineTo(width, yCenter);
        ctx.stroke();

        // Channel label
        ctx.font = "9px monospace";
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillText(channelName, 4, chIdx * traceHeight + 10);
        ctx.globalAlpha = 1;
        return;
      }

      const visible = samples.slice(-visibleSamples);

      // Downsample to ~150 points for smooth curves
      const targetPoints = Math.min(150, visible.length);
      const binSize = visible.length / targetPoints;
      const ampScale = traceHeight / 2 / 200; // ±200µV -> half trace

      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < targetPoints; i++) {
        const start = Math.floor(i * binSize);
        const end = Math.floor((i + 1) * binSize);
        let sum = 0;
        for (let j = start; j < end; j++) sum += visible[j];
        const avg = sum / (end - start);

        pts.push({
          x: (i / (targetPoints - 1)) * width,
          y: yCenter - avg * ampScale,
        });
      }

      // Draw glow layer (blurred, wider stroke)
      ctx.save();
      ctx.filter = "blur(4px)";
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 6;
      drawSmoothCurve(ctx, pts);
      ctx.restore();

      // Draw main line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      drawSmoothCurve(ctx, pts);
      ctx.globalAlpha = 1;

      // Channel label
      ctx.font = "9px monospace";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.fillText(channelName, 4, chIdx * traceHeight + 10);
      ctx.globalAlpha = 1;
    });

    animFrameRef.current = requestAnimationFrame(draw);
  }, [channelData, channels, traceHeight, visibleSamples]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  const totalHeight = channels.length * traceHeight;

  return (
    <div className="rounded-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${totalHeight}px` }}
      />
    </div>
  );
}

/**
 * Draw a smooth curve through points using Catmull-Rom -> Bezier conversion.
 */
function drawSmoothCurve(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.moveTo(pts[0].x, pts[0].y);

  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    return;
  }

  const tension = 0.3;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.stroke();
}
