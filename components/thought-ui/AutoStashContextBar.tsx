"use client";

import {
  AUTO_STASH_CONTEXT_LABEL,
  THOUGHT_CONTEXT_AUTO_STASH_MAX_CHARS,
  thoughtContextBarTone,
  thoughtContextBarToneClass,
  thoughtContextFillRatio,
} from "@/lib/thought-context-auto-stash";

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
      className="w-full min-w-0"
      data-auto-stash-context-bar
      data-auto-stash-context-surface={dataSurface}
      data-auto-stash-context-tone={tone}
      data-auto-stash-context-full={atMax ? "true" : "false"}
      aria-label={`${AUTO_STASH_CONTEXT_LABEL}: ${pct}%`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className="font-mono text-[10px] uppercase leading-none tracking-[2px] text-neutral-600"
          data-auto-stash-context-label
        >
          {AUTO_STASH_CONTEXT_LABEL}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-neutral-500" data-auto-stash-context-pct>
          {pct}%
        </span>
      </div>
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
  );
}
