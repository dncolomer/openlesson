"use client";

import type { InsightSummary } from "@/lib/insights";
import { insightPublicPath } from "@/lib/insights";
import { clampIleMinInsightsPerChapter } from "@/lib/ile-turn-insights";

/** Custom unlock mark — not a stock trophy glyph. */
export function IleInsightTrophyIcon({
  className = "size-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      aria-hidden
      data-ile-insight-trophy-icon
    >
      <path
        d="M3.2 2.4h9.6v2.2c0 2.6-2.1 4.7-4.8 4.7S3.2 7.2 3.2 4.6V2.4Z"
        fill="currentColor"
        fillOpacity="0.92"
      />
      <path
        d="M2 3.1h1.2v1.3C2.5 5 2 5.8 2 6.7 2 7.7 2.7 8.4 3.6 8.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M14 3.1h-1.2v1.3c.7.6 1.2 1.4 1.2 2.3 0 1-.7 1.7-1.6 1.7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M8 9.2v1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.4 13.4h5.2L9.4 11H6.6L5.4 13.4Z" fill="currentColor" />
      <circle cx="8" cy="5.1" r="1.15" fill="#0a0a0a" />
    </svg>
  );
}

function IleInsightEmptyTile({
  sizeClass = "size-8",
  iconClassName = "size-5",
}: {
  sizeClass?: string;
  iconClassName?: string;
}) {
  return (
    <span
      data-ile-insight-slot-empty=""
      className={`inline-flex ${sizeClass} items-center justify-center rounded-none border border-dashed border-amber-200/45 bg-neutral-950 text-amber-200/30`}
    >
      <IleInsightTrophyIcon className={iconClassName} />
    </span>
  );
}

const ILE_INSIGHT_SLOT_CARD_CLASS =
  "flex w-full items-center gap-2.5 rounded-none px-3 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider";

export const ILE_MAP_INSIGHT_PLACEHOLDER_COUNT = 3;
export const ILE_INSIGHT_EMPTY_SLOT_LABEL = "Empty";

/** Widths for the silent loading shapes on the start/help cards. */
const ILE_WELCOME_SKELETON_TITLE = ["w-2/5", "w-3/5", "w-1/2", "w-2/3", "w-[46%]"] as const;
const ILE_WELCOME_SKELETON_LINE = ["w-4/5", "w-full", "w-3/4", "w-11/12", "w-2/3"] as const;

function IleInsightSlotCard({
  empty = false,
  insight,
  emptyLabel = ILE_INSIGHT_EMPTY_SLOT_LABEL,
}: {
  empty?: boolean;
  insight?: InsightSummary;
  emptyLabel?: string;
}) {
  if (empty || !insight) {
    return (
      <div
        data-ile-insight-slot-card="empty"
        data-ile-insight-slot-empty=""
        className={`${ILE_INSIGHT_SLOT_CARD_CLASS} border border-dashed border-amber-200/50 bg-neutral-950 text-amber-200/45`}
      >
        <IleInsightTrophyIcon className="size-4 shrink-0 opacity-40" />
        <span>{emptyLabel}</span>
      </div>
    );
  }
  return (
    <a
      href={insightPublicPath(insight)}
      target="_blank"
      rel="noreferrer"
      data-ile-insight-slot-card="filled"
      data-ile-insight-trophy={insight.id}
      title={insight.title}
      className={`${ILE_INSIGHT_SLOT_CARD_CLASS} border border-amber-200/80 bg-amber-300 text-neutral-950 hover:bg-amber-200`}
    >
      <IleInsightTrophyIcon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{insight.title}</span>
    </a>
  );
}

function IleWelcomeInsightPlaceholderCard({ variant }: { variant: number }) {
  const titleWidth = ILE_WELCOME_SKELETON_TITLE[variant % ILE_WELCOME_SKELETON_TITLE.length];
  const lineWidth = ILE_WELCOME_SKELETON_LINE[variant % ILE_WELCOME_SKELETON_LINE.length];
  return (
    <article
      data-ile-insight-slot-card="empty"
      data-ile-insight-slot-empty=""
      data-ile-welcome-insight-placeholder=""
      data-ile-welcome-insight-skeleton=""
      className="flex w-full items-start gap-3 border border-dashed border-amber-200/40 bg-neutral-950 px-4 py-4"
    >
      <span
        aria-hidden
        data-ile-welcome-insight-skeleton-mark=""
        className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center border border-amber-200/25 bg-amber-200/10 text-amber-200/35"
      >
        <IleInsightTrophyIcon className="size-4" />
      </span>
      <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <span data-ile-welcome-insight-skeleton-bar="title" className={`h-2.5 ${titleWidth} bg-neutral-600/80`} />
        <span data-ile-welcome-insight-skeleton-bar="line" className={`h-2 ${lineWidth} bg-neutral-800`} />
        <span data-ile-welcome-insight-skeleton-bar="line" className="h-2 w-1/2 bg-neutral-800/70" />
        <span
          data-ile-welcome-insight-skeleton-chip=""
          className="mt-1 h-4 w-14 border border-neutral-700 bg-neutral-900"
        />
      </span>
    </article>
  );
}

/** Elaborate placeholder cards for the ILE start/help surface — count from difficulty. */
export function IleInsightEmptySlots({
  count,
  label,
}: {
  count: number;
  label?: string;
  emptyLabel?: string;
}) {
  const quota = clampIleMinInsightsPerChapter(count);
  const n = Math.max(ILE_MAP_INSIGHT_PLACEHOLDER_COUNT, quota);
  return (
    <ul
      data-ile-welcome-insight-slots=""
      data-ile-welcome-insight-slot-count={n}
      className="mb-5 flex w-full flex-col gap-3"
      aria-label={label ?? `${n} empty insight slots`}
    >
      {Array.from({ length: n }, (_, index) => (
        <li key={index} data-ile-welcome-insight-slot="" className="w-full">
          <IleWelcomeInsightPlaceholderCard variant={index} />
        </li>
      ))}
    </ul>
  );
}

export function IleInsightTrophyStrip({
  insights,
  slotCount = 0,
  testId = "ile-work-canvas-insight-trophies",
}: {
  insights: readonly InsightSummary[];
  /** Empty placeholders for the chapter quota; filled trophies replace them. */
  slotCount?: number;
  testId?: string;
}) {
  const quota = slotCount > 0 ? clampIleMinInsightsPerChapter(slotCount) : 0;
  const emptyCount = Math.max(0, quota - insights.length);
  if (insights.length === 0 && emptyCount === 0) return null;
  return (
    <ul
      data-ile-insight-trophy-strip={testId}
      data-ile-work-canvas-insight-trophies={
        testId === "ile-work-canvas-insight-trophies" ? "" : undefined
      }
      data-ile-work-canvas-insight-slot-count={quota || undefined}
      className="flex max-w-[min(28rem,60vw)] items-center gap-1.5 overflow-x-auto"
      aria-label="Insight slots"
    >
      {insights.map((insight) => (
        <li key={insight.id}>
          <a
            href={insightPublicPath(insight)}
            target="_blank"
            rel="noreferrer"
            data-ile-insight-trophy={insight.id}
            title={insight.title}
            className="inline-flex size-8 items-center justify-center rounded-none border border-amber-200/80 bg-amber-300 text-neutral-950 shadow-[0_0_8px_rgba(251,191,36,0.45)] hover:bg-amber-200"
          >
            <IleInsightTrophyIcon className="size-5" />
            <span className="sr-only">{insight.title}</span>
          </a>
        </li>
      ))}
      {Array.from({ length: emptyCount }, (_, index) => (
        <li key={`empty-${index}`}>
          <IleInsightEmptyTile />
        </li>
      ))}
    </ul>
  );
}

export function IleMapInsightsWidget({
  insights,
  visible,
  slotCount = ILE_MAP_INSIGHT_PLACEHOLDER_COUNT,
}: {
  insights: readonly InsightSummary[];
  visible: boolean;
  /** Chapter insight goal. Empty slots match this count, not a fixed 3. */
  slotCount?: number;
}) {
  if (!visible) return null;
  const quota = clampIleMinInsightsPerChapter(slotCount);
  const emptyCount = Math.max(0, quota - insights.length);
  return (
    <div
      data-ile-map-insights-widget
      className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-1.5 rounded-none border border-amber-200/70 bg-neutral-950 px-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
    >
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
        <IleInsightTrophyIcon className="size-3.5 text-amber-300" />
        Insights
        <span
          data-ile-map-insights-count
          className="ml-auto bg-amber-300 px-1 py-0 font-mono text-[10px] text-neutral-950"
        >
          {insights.length}
        </span>
      </p>
      <ul
        data-ile-map-insights-slots=""
        data-ile-map-insights-slot-count={quota}
        className="flex max-h-[min(22rem,50vh)] w-full flex-col gap-1.5 overflow-y-auto"
      >
        {insights.map((insight) => (
          <li key={insight.id} className="w-full">
            <IleInsightSlotCard insight={insight} />
          </li>
        ))}
        {Array.from({ length: emptyCount }, (_, index) => (
          <li key={`empty-${index}`} className="w-full">
            <IleInsightSlotCard empty />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IleWorkCanvasTimer({
  remainingSeconds,
}: {
  remainingSeconds: number;
}) {
  const m = Math.floor(Math.max(0, remainingSeconds) / 60);
  const s = Math.max(0, remainingSeconds) % 60;
  const label = `${m}:${String(s).padStart(2, "0")}`;
  const urgent = remainingSeconds <= 15;
  return (
    <span
      data-ile-work-canvas-timer
      data-ile-work-canvas-timer-urgent={urgent ? "true" : undefined}
      className={`font-mono text-lg font-semibold uppercase tracking-wider tabular-nums ${
        urgent ? "text-amber-300" : "text-neutral-200"
      }`}
      title="Work canvas timer"
    >
      {label}
    </span>
  );
}

export function IleChapterInsightCountBadge({
  count,
}: {
  count: number;
}) {
  if (count <= 0) return null;
  return (
    <span
      data-ile-chapter-insight-count={count}
      title={`${count} insight${count === 1 ? "" : "s"} tracked`}
      className="absolute right-1 top-1 z-[2] inline-flex items-center gap-0.5 rounded-none border border-amber-200/80 bg-amber-300 px-1 py-px font-mono text-[9px] font-semibold text-neutral-950"
    >
      <IleInsightTrophyIcon className="size-2.5" />
      {count}
    </span>
  );
}
