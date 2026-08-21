"use client";

import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  audioBlob: Blob;
}

export function AudioPlayer({ audioBlob }: AudioPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const waveformDataRef = useRef<number[]>([]);
  const phaseRef = useRef(0);

  useEffect(() => {
    const audio = new Audio(URL.createObjectURL(audioBlob));
    audioRef.current = audio;

    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      phaseRef.current = 0;
    });

    const loadWaveform = async () => {
      try {
        const response = await fetch(URL.createObjectURL(audioBlob));
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        
        const samples = 80;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }
        
        const max = Math.max(...waveform, 0.001);
        waveformDataRef.current = waveform.map(v => v / max);
        audioContext.close();
      } catch (e) {
        console.error("Failed to load waveform:", e);
      }
    };
    
    loadWaveform();

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [audioBlob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      const waveform = waveformDataRef.current;
      const mid = h / 2;
      const maxAmp = h * 0.35;

      if (isPlaying) {
        phaseRef.current += 0.06;
      }

      if (waveform.length === 0) {
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.strokeStyle = "rgba(96, 165, 250, 0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, "rgba(96, 165, 250, 0.6)");
        gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.9)");
        gradient.addColorStop(1, "rgba(96, 165, 250, 0.6)");
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";

        for (let i = 0; i <= waveform.length; i++) {
          const x = (i / waveform.length) * w;
          const idx = Math.min(i, waveform.length - 1);
          const val = waveform[idx] || 0;
          const phase = phaseRef.current + i * 0.15;
          
          const y = mid + Math.sin(phase) * maxAmp * val;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      if (audio.currentTime === audio.duration) {
        audio.currentTime = 0;
        phaseRef.current = 0;
      }
      audio.play();
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-white text-black transition-colors"
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <canvas
        ref={canvasRef}
        className="w-full h-12 rounded-none"
      />
    </div>
  );
}
