"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChapterMiniMap } from "@/components/ChapterMiniMap";
import { dummyDensityCells } from "@/lib/ile-chapter-mini-map";
import {
  INITIAL_CHAPTERS_CATALOG,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import {
  defaultMapTypePickerCatalog,
  pickRandomMapType,
  stepMapTypeCatalog,
  type MapTypePickerItem,
} from "@/lib/workspace-map-types";

export function InitialChaptersPicker({
  value,
  onChange,
  disabled = false,
  t,
  i18nPrefix = "session",
  showCountHint = false,
  fillHeight = false,
  catalog,
}: {
  value: string;
  onChange: (level: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
  i18nPrefix?: "session" | "planMode";
  showCountHint?: boolean;
  /** Stretch to the parent column (welcome modal left-column match). */
  fillHeight?: boolean;
  /**
   * Workspace-resolved picker catalog (enabled built-ins + custom types).
   * When omitted, the frozen eight-id built-in catalog is used.
   */
  catalog?: MapTypePickerItem[] | null;
}) {
  const items = useMemo(() => {
    if (Array.isArray(catalog) && catalog.length > 0) return catalog;
    return defaultMapTypePickerCatalog();
  }, [catalog]);
  const ids = items.map((item) => item.id);
  const option =
    items.find((item) => item.id === value) ??
    items[0] ??
    defaultMapTypePickerCatalog()[0];
  const band = option.band;
  const index = Math.max(0, ids.indexOf(option.id));
  const title =
    option.titleKey && option.source === "builtin"
      ? t(`${i18nPrefix}.${option.titleKey}`)
      : option.label;
  const description =
    option.descKey && option.source === "builtin"
      ? t(`${i18nPrefix}.${option.descKey}`)
      : option.description;
  const randomLabel =
    i18nPrefix === "planMode"
      ? t("planMode.initialChaptersPickRandom")
      : t("session.initialChaptersPickRandom");
  const [randomPick, setRandomPick] = useState(false);
  const miniCells =
    option.cells && option.cells.length > 0
      ? option.cells
      : dummyDensityCells(option.id as InitialChaptersLevel);

  function slide(delta: -1 | 1) {
    if (disabled) return;
    setRandomPick(false);
    onChange(stepMapTypeCatalog(ids, option.id, delta));
  }

  function toggleRandom(checked: boolean) {
    if (disabled) return;
    if (!checked) {
      setRandomPick(false);
      return;
    }
    setRandomPick(true);
    onChange(pickRandomMapType(ids));
  }

  return (
    <div
      data-initial-chapters-picker
      data-initial-chapters-carousel
      data-initial-chapters-fill={fillHeight ? "true" : "false"}
      data-map-type-catalog-count={items.length}
    >
      {showCountHint && band ? (
        <p className="mb-2 text-[11px] text-neutral-500">
          About {band.target} tiles ({band.min}–{band.max})
        </p>
      ) : null}
      <label
        data-initial-chapters-random
        className={`mb-2 flex cursor-pointer items-start gap-2.5 rounded-none border border-neutral-800 bg-neutral-900/70 px-3 py-2.5 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <input
          type="checkbox"
          data-initial-chapters-random-pick
          checked={randomPick}
          disabled={disabled}
          onChange={(e) => toggleRandom(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-none border-neutral-600 bg-neutral-950 text-white focus:ring-1 focus:ring-neutral-500"
        />
        <span className="min-w-0 text-xs font-medium leading-tight text-neutral-200">
          {randomLabel}
        </span>
      </label>
      <div
        className={`flex items-stretch gap-2 ${
          fillHeight ? "min-h-0 flex-1" : ""
        }`}
      >
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
          data-map-type-id={option.id}
          data-initial-chapters-card
          className={`min-w-0 flex-1 rounded-none border border-neutral-200 bg-neutral-900 px-4 py-4 ring-1 ring-neutral-200/30 ${
            fillHeight ? "flex min-h-0 flex-col" : ""
          }`}
        >
          <div
            className={
              fillHeight
                ? "min-h-0 w-full flex-1"
                : "mx-auto aspect-square w-full max-w-[14rem]"
            }
          >
            <ChapterMiniMap
              cells={miniCells}
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
            {index + 1} / {items.length || INITIAL_CHAPTERS_CATALOG.length}
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
