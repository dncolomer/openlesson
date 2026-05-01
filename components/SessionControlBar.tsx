"use client";

import { useI18n } from "@/lib/i18n";

interface SessionControlBarProps {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPause: () => void;
  onResume: () => void;
  variant?: "top" | "panel";
}

export function SessionControlBar({
  isRecording,
  isPaused,
  elapsedSeconds,
  onStartRecording,
  onStopRecording,
  onPause,
  onResume,
  variant = "top",
}: SessionControlBarProps) {
  const { t } = useI18n();
  const isStopped = !isRecording && !isPaused;
  const isPlaying = isRecording && !isPaused;

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const isPanel = variant === "panel";

  return (
    <div className="w-full shrink-0 flex flex-col items-center">
      {/* The bar itself */}
      <div className={`${isPanel ? "w-full max-w-[680px] rounded-2xl border border-neutral-800 bg-neutral-950/55 px-3 py-2 shadow-lg shadow-black/30" : "w-full px-4 py-2.5 bg-neutral-900/95 border-b border-neutral-700/80 shadow-2xl shadow-black/50"} flex items-center justify-center gap-3 backdrop-blur-md`}>
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`rounded-full transition-all ${
            isPlaying
              ? "w-2.5 h-2.5 bg-red-500 animate-pulse"
              : isPaused
              ? "w-2.5 h-2.5 bg-amber-500"
              : "w-2 h-2 bg-neutral-600"
          }`} />

          {/* Timer */}
          <span className={`text-xs font-mono tabular-nums transition-colors ${
            isPlaying ? "text-red-400" : isPaused ? "text-amber-400" : "text-neutral-500"
          }`}>
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        {/* Transport controls */}
        <div className="w-px h-6 bg-neutral-700/50" />

        <div className="flex items-center gap-1.5">
          {/* Play / Resume */}
          <button
            onClick={() => {
              if (isStopped) onStartRecording();
              else if (isPaused) onResume();
            }}
            disabled={isPlaying}
            className={`flex items-center justify-center ${isPanel ? "w-8 h-8" : "w-9 h-9"} rounded-lg transition-all ${
              isPlaying
                ? "text-green-500/20 cursor-default"
                : "text-green-400 hover:bg-green-500/20 hover:text-green-300"
            }`}
            title={isStopped ? t('tools.startSession') : t('session.resume')}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          {/* Pause */}
          <button
            onClick={() => onPause()}
            disabled={!isPlaying}
            className={`flex items-center justify-center ${isPanel ? "w-8 h-8" : "w-9 h-9"} rounded-lg transition-all ${
              !isPlaying
                ? "text-amber-500/20 cursor-default"
                : "text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
            }`}
            title={t('tools.pause')}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          </button>

          {/* Stop / End */}
          <button
            onClick={() => onStopRecording()}
            disabled={isStopped}
            className={`flex items-center justify-center ${isPanel ? "w-8 h-8" : "w-9 h-9"} rounded-lg transition-all ${
              isStopped
                ? "text-red-500/20 cursor-default"
                : "text-red-400 hover:bg-red-500/20 hover:text-red-300"
            }`}
            title={t('sessionEnd.endSession')}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        </div>

        {/* Status label */}
        <div className="w-px h-6 bg-neutral-700/50" />
        <span className={`text-[10px] font-medium uppercase tracking-wider min-w-[60px] ${
          isPlaying ? "text-red-400" : isPaused ? "text-amber-400" : "text-neutral-500"
        }`}>
          {isPlaying ? t('session.recording') : isPaused ? t('session.paused') : t('session.stopped')}
        </span>
      </div>
    </div>
  );
}
