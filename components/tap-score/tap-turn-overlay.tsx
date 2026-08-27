"use client";

import type { ReactNode } from "react";
import { HeliosMarkdown } from "@/components/thought-ui/HeliosMarkdown";

export function TapTurnOverlay({
  kind,
  kicker,
  body,
  waiting = false,
  waitingText = "Helios is thinking",
  markdown = false,
  extra,
}: {
  kind: "dialog" | "solo";
  kicker?: string;
  body: string;
  waiting?: boolean;
  waitingText?: string;
  markdown?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div
      data-tap-turn-overlay
      data-tap-turn-overlay-kind={kind}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/95 to-transparent pt-10"
    >
      <div className="pointer-events-auto mx-3 mb-3 rounded-none border border-neutral-700/80 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-md">
        {waiting ? (
          <div
            className="flex min-h-[4.5rem] flex-col items-center justify-center text-center"
            data-tap-turn-waiting
          >
            <div className="flex justify-center gap-1.5 py-1">
              <div className="size-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: "0ms" }} />
              <div className="size-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: "150ms" }} />
              <div className="size-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="mt-2 text-sm text-neutral-300">{waitingText}</p>
          </div>
        ) : (
          <>
            {kicker ? (
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
                {kicker}
              </p>
            ) : null}
            <div
              data-tap-turn-overlay-body
              data-exercise-prompt={kind === "solo" ? "" : undefined}
              className="max-h-[min(28vh,12rem)] min-h-[4.5rem] overflow-y-auto overscroll-contain text-sm leading-relaxed text-neutral-100 sm:text-base sm:leading-relaxed"
            >
              {markdown ? (
                <HeliosMarkdown className="text-neutral-100">{body}</HeliosMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{body}</p>
              )}
            </div>
          </>
        )}
        {extra}
      </div>
    </div>
  );
}
