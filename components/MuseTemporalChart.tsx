"use client";

import { useEffect, useRef, useCallback } from "react";

interface MuseTemporalChartProps {
  channelData: Map<string, number[]>;
  isConnected: boolean;
}

const CHANNELS = ["TP9", "AF7", "AF8", "TP10", "FPz"];
const MAX_SAMPLES = 100;
const SMOOTHING_WINDOW = 3;
const CHANNEL_COLORS: Record<string, string> = {
  TP9: "#ef4444",
  AF7: "#f97316",
  AF8: "#eab308",
  TP10: "#22c55e",
  FPz: "#3b82f6",
};

export function MuseTemporalChart({ channelData, isConnected }: MuseTemporalChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<Map<string, number[]>>(new Map());
  const animationRef = useRef<number>(0);

  const smoothData = useCallback((data: number[]): number[] => {
    if (data.length < SMOOTHING_WINDOW) return data;
    
    const smoothed: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(SMOOTHING_WINDOW / 2));
      const end = Math.min(data.length, i + Math.ceil(SMOOTHING_WINDOW / 2));
      const window = data.slice(start, end);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      smoothed.push(avg);
    }
    return smoothed;
  }, []);

  useEffect(() => {
    if (!isConnected) {
      dataRef.current.clear();
      return;
    }

    for (const channel of CHANNELS) {
      const samples = channelData.get(channel) || [];
      if (samples.length > 0) {
        const newData = samples.slice(-MAX_SAMPLES);
        dataRef.current.set(channel, newData);
      }
    }
  }, [channelData, isConnected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const channelHeight = h / CHANNELS.length;

    ctx.clearRect(0, 0, w, h);

    if (!isConnected) {
      ctx.fillStyle = "#525252";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Muse not connected", w / 2, h / 2);
      return;
    }

    const baseRanges: Record<string, { min: number; max: number }> = {};
    for (const channel of CHANNELS) {
      const data = dataRef.current.get(channel) || [];
      if (data.length > 10) {
        const recentData = data.slice(-20);
        const min = Math.min(...recentData);
        const max = Math.max(...recentData);
        const padding = (max - min) * 0.15 || 1;
        baseRanges[channel] = { min: min - padding, max: max + padding };
      }
    }

    CHANNELS.forEach((channel, idx) => {
      const y = idx * channelHeight;
      const data = dataRef.current.get(channel) || [];
      
      if (data.length === 0) return;

      const smoothDataVals = smoothData(data);
      const displayData = smoothDataVals.slice(-MAX_SAMPLES);

      ctx.strokeStyle = "rgba(75, 85, 99, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + channelHeight / 2);
      ctx.lineTo(w, y + channelHeight / 2);
      ctx.stroke();

      ctx.fillStyle = "#a3a3a3";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(channel, 4, y + 12);

      if (displayData.length < 2) return;

      const baseRange = baseRanges[channel] || { min: -1, max: 1 };
      const range = baseRange.max - baseRange.min || 1;

      ctx.strokeStyle = CHANNEL_COLORS[channel];
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();

      const xStep = w / (MAX_SAMPLES - 1);
      const startIdx = Math.max(0, displayData.length - MAX_SAMPLES);

      for (let i = 0; i < displayData.length; i++) {
        const dataIdx = startIdx + i;
        const x = (dataIdx - startIdx) * xStep;
        const normalizedY = (displayData[i] - baseRange.min) / range;
        const plotY = y + channelHeight - normalizedY * channelHeight;
        
        if (i === 0) {
          ctx.moveTo(x, plotY);
        } else {
          ctx.lineTo(x, plotY);
        }
      }
      
      ctx.stroke();

      ctx.globalAlpha = 0.15;
      ctx.lineTo((displayData.length - 1) * xStep, y + channelHeight);
      ctx.lineTo(0, y + channelHeight);
      ctx.closePath();
      ctx.fillStyle = CHANNEL_COLORS[channel];
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    animationRef.current = requestAnimationFrame(() => {});
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [channelData, isConnected, smoothData]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-48 rounded-none bg-neutral-900"
    />
  );
}