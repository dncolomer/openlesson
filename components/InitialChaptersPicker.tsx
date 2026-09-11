"use client";

import { useMemo } from "react";
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
import { ileMapTypeSessionExplanation } from "@/lib/ile-pregame-settings";

export function InitialChaptersPicker({
  value,
  onChange,
  disabled = false,
  t,
  i18nPrefix = "session",
  showCountHint = false,
  fillHeight = false,
  catalog,
  explainFully = false,
  catalogStrip = false,
}: {
  value: string;
  onChange: (level: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
  i18nPrefix?: "session" | "planMode";
  showCountHint?: boolean;
  /** Stretch to the parent column (welcome modal left-column match). */
  fillHeight?: boolean;
  /** Pre-game settings: full shape + use-when + play-rule, no three-line clamp. */
  explainFully?: boolean;
  /** Compact preview plus a horizontally scrollable row of the other map types. */
  catalogStrip?: boolean;
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
  const explain = ileMapTypeSessionExplanation({
    id: option.id,
    description,
    playRule: option.playRule,
    useWhen: option.useWhen,
  });
  const randomLabel =
    i18nPrefix === "planMode"
      ? t("planMode.initialChaptersPickRandom")
      : t("session.initialChaptersPickRandom");
  const miniCells =
    option.cells && option.cells.length > 0
      ? option.cells
      : dummyDensityCells(option.id as InitialChaptersLevel);
  const compact = catalogStrip || explainFully;
  const fill = fillHeight || catalogStrip;

  function slide(delta: -1 | 1) {
    if (disabled) return;
    onChange(stepMapTypeCatalog(ids, option.id, delta));
  }

  function pickRandom() {
    if (disabled) return;
    onChange(pickRandomMapType(ids));
  }

  return (
    <div
      data-initial-chapters-picker
      data-initial-chapters-carousel
      data-initial-chapters-fill={fill ? "true" : "false"}
      data-map-type-catalog-count={items.length}
      className={fill ? "flex h-full min-h-0 flex-col overflow-hidden" : undefined}
    >
      {showCountHint && band ? (
        <p className="mb-2 text-[11px] text-neutral-500">
          About {band.target} tiles ({band.min}–{band.max})
        </p>
      ) : null}
      <button
        type="button"
        data-initial-chapters-random
        data-initial-chapters-random-pick
        disabled={disabled}
        onClick={pickRandom}
        className="mb-2 w-full rounded-none border border-neutral-800 bg-neutral-900/70 px-3 py-2.5 text-left text-xs font-medium leading-tight text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {randomLabel}
      </button>
      <div
        className={`flex min-h-0 items-stretch gap-2 overflow-hidden ${
          fill ? "h-0 flex-1" : ""
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
          className={`min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border border-neutral-200 bg-neutral-900 px-4 py-4 ring-1 ring-neutral-200/30 ${
            compact
              ? "flex h-full min-h-0 flex-col sm:flex-row sm:items-stretch sm:gap-4"
              : fill
                ? "flex min-h-0 flex-col"
                : ""
          }`}
        >
          <div
            data-map-type-preview
            className={
              compact
                ? "mx-auto aspect-square h-[min(100%,20rem)] w-[min(100%,20rem)] shrink-0 self-start sm:mx-0"
                : fill
                ? "flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]"
                : "mx-auto aspect-square w-full max-w-[14rem]"
            }
          >
            <div
              className={
                compact
                  ? "h-full w-full"
                  : fill
                ? "aspect-square w-full max-w-[100cqmin]"
                : "h-full w-full"
              }
            >
              <ChapterMiniMap
                cells={miniCells}
                dummy
                density={option.id}
              />
            </div>
          </div>
          <div
            data-ile-map-type-copy
            className={
              compact
                ? "mt-3 min-h-0 min-w-0 max-h-full flex-1 overflow-y-auto overscroll-contain sm:mt-0"
                : fill
                  ? "min-h-0 overflow-hidden"
                  : undefined
            }
          >
          <p className="truncate text-sm font-medium leading-tight text-neutral-100">
            {title}
          </p>
          <p
            data-ile-map-type-shape
            className={
              explainFully
                ? "mt-1.5 text-[12px] leading-snug text-neutral-400"
                : "mt-1.5 min-h-[3.6rem] text-[12px] leading-snug text-neutral-400 line-clamp-3"
            }
          >
            {explain.shape || description}
          </p>
          {explainFully && explain.useWhen ? (
            <p
              data-ile-map-type-use-when
              className="mt-2 text-[12px] leading-snug text-neutral-400"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                {t(`${i18nPrefix}.mapTypeUseWhen`)}
              </span>
              <span className="mt-0.5 block">{explain.useWhen}</span>
            </p>
          ) : null}
          {explainFully &&
          explain.playRule &&
          explain.playRule !== explain.shape ? (
            <p
              data-ile-map-type-play-rule
              className="mt-2 text-[12px] leading-snug text-neutral-400"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                {t(`${i18nPrefix}.mapTypePlayRule`)}
              </span>
              <span className="mt-0.5 block">{explain.playRule}</span>
            </p>
          ) : null}
          <p className="mt-2 text-[10px] uppercase tracking-wider text-neutral-600">
            {index + 1} / {items.length || INITIAL_CHAPTERS_CATALOG.length}
          </p>
          </div>
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
      {catalogStrip ? (
        <div
          data-ile-map-type-strip
          className="mt-3 flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain pb-1"
        >
          {items.map((item) => {
            const selected = item.id === option.id;
            const label =
              item.titleKey && item.source === "builtin"
                ? t(`${i18nPrefix}.${item.titleKey}`)
                : item.label;
            const cells =
              item.cells && item.cells.length > 0
                ? item.cells
                : dummyDensityCells(item.id as InitialChaptersLevel);
            return (
              <button
                key={item.id}
                type="button"
                data-ile-map-type-option={item.id}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onChange(item.id)}
                className={`w-[5.75rem] shrink-0 rounded-none border px-1.5 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? "border-white bg-neutral-900 ring-1 ring-white/40"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-500"
                }`}
              >
                <div className="aspect-square w-full">
                  <ChapterMiniMap cells={cells} dummy density={item.id} />
                </div>
                <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-wide text-neutral-300">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
