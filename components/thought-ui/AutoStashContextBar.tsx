"use client";

import {
  AUTO_STASH_CONTEXT_LABEL,
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  thoughtContextBarTone,
  thoughtContextBarToneClass,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";

/**
 * Progress toward context-capacity auto-stash.
 * Layout matches TAP purity markers: label row + h-7 content row for vertical alignment.
 */
export function AutoStashContextBar({
  text,
  maxChars = THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  "data-surface": dataSurface,
}: {
  text: string;
  maxChars?: number;
  "data-surface"?: "tap" | "ile";
}) {
  const ratio = thoughtContextFillRatio(text, maxChars);
  const tone = thoughtContextBarTone(ratio);
  const atMax = ratio >= 1;
  const pct = Math.round(ratio * 100);

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1"
      data-auto-stash-context-bar
      data-auto-stash-context-surface={dataSurface}
      data-auto-stash-context-tone={tone}
      data-auto-stash-context-full={atMax ? "true" : "false"}
      aria-label={`${AUTO_STASH_CONTEXT_LABEL}: ${pct}%`}
    >
      <div className="flex items-center justify-between gap-2 leading-none">
        <span
          className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600"
          data-auto-stash-context-label
        >
          {AUTO_STASH_CONTEXT_LABEL}
        </span>
        <span
          className="font-mono text-[10px] leading-none tabular-nums text-neutral-500"
          data-auto-stash-context-pct
        >
          {pct}%
        </span>
      </div>
      {/* Same h-7 content row as purity dots / time so the control strip aligns */}
      <div className="flex h-7 w-full items-center" data-auto-stash-context-track>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-150 ease-out ${thoughtContextBarToneClass(tone)} ${
              atMax ? "animate-pulse" : ""
            }`}
            style={{ width: `${pct}%` }}
            data-auto-stash-context-fill
          />
        </div>
      </div>
    </div>
  );
}
