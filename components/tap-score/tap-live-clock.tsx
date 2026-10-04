"use client";

import { formatCountdown } from "@/lib/tap-score-client-helpers";

/**
 * TAP session countdown.
 * Waiting for an answer freezes the digits and shows a pause icon.
 * An active mic shows a pulsing red dot beside the running time.
 */
export function TapLiveClock({
  label,
  remainingSeconds,
  waiting,
  listening,
  placement = "row",
}: {
  label: string;
  remainingSeconds: number;
  waiting: boolean;
  listening: boolean;
  /** `card` sits on the topic still, so the label stays light. */
  placement?: "row" | "card";
}) {
  const showListening = listening && !waiting;
  const onCard = placement === "card";
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      data-tap-live-clock
      data-tap-clock-placement={onCard ? "card" : "row"}
      data-tap-clock-waiting={waiting ? "true" : "false"}
      data-tap-clock-listening={showListening ? "true" : "false"}
    >
      <div
        className={`font-mono text-[10px] uppercase leading-none tracking-[2px] ${
          onCard ? "text-white/80" : "text-neutral-600"
        }`}
      >
        {label}
      </div>
      <div
        className={`flex items-center gap-1.5 font-mono text-lg leading-none tabular-nums tracking-tight ${
          remainingSeconds <= 60 ? (onCard ? "text-amber-200" : "text-neutral-300") : "text-white"
        }`}
      >
        {waiting ? (
          <span
            data-tap-clock-paused
            className="inline-flex text-neutral-300"
            aria-label="Paused"
            title="Paused"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          </span>
        ) : showListening ? (
          <span
            data-tap-clock-listening-dot
            className="relative inline-flex h-2 w-2"
            aria-label="Listening"
            title="Listening"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        ) : null}
        <span data-tap-clock-time>{formatCountdown(remainingSeconds)}</span>
      </div>
    </div>
  );
}
