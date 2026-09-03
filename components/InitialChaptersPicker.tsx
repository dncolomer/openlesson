"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChapterMiniMap } from "@/components/ChapterMiniMap";
import { dummyDensityCells } from "@/lib/ile-chapter-mini-map";
import {
  INITIAL_CHAPTERS_CATALOG,
  INITIAL_CHAPTERS_LEVELS,
  getInitialChaptersBand,
  getInitialChaptersOption,
  stepInitialChaptersCatalog,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";

export function InitialChaptersPicker({
  value,
  onChange,
  disabled = false,
  t,
  i18nPrefix = "session",
  showCountHint = false,
}: {
  value: InitialChaptersLevel;
  onChange: (level: InitialChaptersLevel) => void;
  disabled?: boolean;
  t: (key: string) => string;
  i18nPrefix?: "session" | "planMode";
  showCountHint?: boolean;
}) {
  const option = getInitialChaptersOption(value);
  const band = getInitialChaptersBand(value);
  const index = Math.max(0, INITIAL_CHAPTERS_LEVELS.indexOf(option.id));
  const title = t(`${i18nPrefix}.${option.titleKey}`);
  const description = t(`${i18nPrefix}.${option.descKey}`);

  function slide(delta: -1 | 1) {
    if (disabled) return;
    onChange(stepInitialChaptersCatalog(option.id, delta));
  }

  return (
    <div data-initial-chapters-picker data-initial-chapters-carousel>
      {showCountHint ? (
        <p className="mb-2 text-[11px] text-neutral-500">
          About {band.target} tiles ({band.min}–{band.max})
        </p>
      ) : null}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          data-initial-chapters-prev
          aria-label="Previous map"
          disabled={disabled}
          onClick={() => slide(-1)}
          className="flex w-9 shrink-0 items-center justify-center rounded-none border border-neutral-800 bg-neutral-950 text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden />
        </button>
        <div
          data-density-level={option.id}
          data-initial-chapters-card
          className="min-w-0 flex-1 rounded-none border border-neutral-200 bg-neutral-900 px-4 py-4 ring-1 ring-neutral-200/30"
        >
          <div className="mx-auto aspect-square w-full max-w-[14rem]">
            <ChapterMiniMap
              cells={dummyDensityCells(option.id)}
              dummy
              density={option.id}
            />
          </div>
          <p className="mt-3 truncate text-sm font-medium leading-tight text-neutral-100">
            {title}
          </p>
          <p className="mt-1.5 min-h-[3.6rem] text-[12px] leading-snug text-neutral-400 line-clamp-3">
            {description}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-neutral-600">
            {index + 1} / {INITIAL_CHAPTERS_CATALOG.length}
          </p>
        </div>
        <button
          type="button"
          data-initial-chapters-next
          aria-label="Next map"
          disabled={disabled}
          onClick={() => slide(1)}
          className="flex w-9 shrink-0 items-center justify-center rounded-none border border-neutral-800 bg-neutral-950 text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-5" strokeWidth={2.2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
