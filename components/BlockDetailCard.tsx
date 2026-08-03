"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  PRODUCT_INTENT_LABELS,
  resolveLaunchFromStyleAndTimebox,
  type LearningStyle,
  type ProductLaunchTarget,
} from "@/lib/product-intent";
import { DEFAULT_DURATION_MINUTES, DURATIONS } from "@/lib/tap-score-client-helpers";
import {
  blockAllowedDurations,
  blockAllowsLaunchTarget,
  blockAllowsPracticeStyle,
  clampPracticeDuration,
  normalizeBlockPracticeOptions,
  resolveDefaultPracticeLaunchUi,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";

type ProgressRing = "neutral" | "completed" | "in_progress";

/** Optional launch options (duration chosen on the card before TAP). */
export type ProductLaunchOptions = {
  /** Timed sessions only — minutes for the TAP clock. */
  minutes?: number;
};

type BlockDetailCardProps = {
  layout?: "horizontal" | "stacked" | "modal";
  title: string;
  description?: string;
  /** @deprecated Hero aesthetics image removed from detail launch card. */
  thumbnailSrc?: string;
  progressRing?: ProgressRing;
  isStart?: boolean;
  /** @deprecated unused — intent UI owns labels */
  evalLabel?: string;
  /** @deprecated unused */
  exerciseLabel?: string;
  isStarting?: boolean;
  isLocked?: boolean;
  showActions: boolean;
  /**
   * Launch by product intent (Explore/Drill × Open-ended/Timed).
   * Prefer this over the four technical callbacks.
   * Style buttons only select; Start triggers this.
   */
  onLaunchIntent?: (target: ProductLaunchTarget, options?: ProductLaunchOptions) => void;
  /** Open-ended Explore → ILE learning (fallback if onLaunchIntent omitted). */
  onStartIle?: () => void;
  /** Open-ended Drill → ILE project */
  onStartIleProject?: () => void;
  /** Timed Explore → TAP conversational */
  onStartEval?: (event: React.MouseEvent, minutes?: number) => void;
  /** Timed Drill → TAP exercise */
  onStartExercise?: (event: React.MouseEvent, minutes?: number) => void;
  /** When false, hide timed (TAP) options / timebox control. */
  allowTimed?: boolean;
  /**
   * Author limits on Explore/Drill × open/timed + durations.
   * When set, further constrains which styles/horizons/durations appear.
   */
  practiceOptions?: BlockPracticeOptions | null;
  forkCallout?: ReactNode;
  promptSection?: ReactNode;
  highlighted?: boolean;
  highlightOpacity?: number;
};

const HERO_RING_CLASS: Record<ProgressRing, string> = {
  neutral: "ring-white/20",
  completed: "ring-white/20",
  in_progress: "ring-white/20",
};

function ExploreIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      data-style-icon="explore"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      {/* Compass / open exploration */}
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5l-2.2 5.3-5.3 2.2 2.2-5.3 5.3-2.2z" />
    </svg>
  );
}

function DrillIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      data-style-icon="drill"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      {/* Target / focused practice */}
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Text-only block header (no aesthetics/thumbnail image).
 * Keeps title + description + optional start badge for launch chrome.
 */
function BlockDetailHero({
  title,
  description,
  isStart,
  layout,
  className = "",
}: {
  thumbnailSrc?: string;
  title: string;
  description?: string;
  progressRing?: ProgressRing;
  isStart?: boolean;
  layout: "modal" | "stacked" | "horizontal";
  className?: string;
}) {
  const { t } = useI18n();
  const titleClamp =
    layout === "stacked" ? "line-clamp-2" : layout === "modal" ? "line-clamp-2" : "line-clamp-2";
  const descriptionClamp =
    layout === "stacked" ? "line-clamp-3" : layout === "modal" ? "line-clamp-4" : "line-clamp-3";

  return (
    <div
      data-block-detail-header
      data-block-detail-no-hero-image
      className={`relative ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold leading-snug tracking-tight text-white ${titleClamp} ${
              layout === "stacked" ? "text-lg" : "text-sm"
            }`}
          >
            {title}
          </h3>
          <p
            className={`mt-1 leading-relaxed text-neutral-400 ${descriptionClamp} ${
              layout === "stacked" ? "text-sm" : "text-xs"
            }`}
          >
            {description || t("sessionItem.noDescription")}
          </p>
        </div>
        {isStart ? (
          <span className="shrink-0 rounded-full border border-white/20 bg-neutral-900/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-neutral-300">
            {t("sessionItem.startBlock")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function BlockDetailCard({
  layout = "horizontal",
  title,
  description,
  thumbnailSrc,
  progressRing,
  isStart,
  isStarting = false,
  isLocked = false,
  showActions,
  onLaunchIntent,
  onStartIle,
  onStartIleProject,
  onStartEval,
  onStartExercise,
  allowTimed = true,
  practiceOptions = null,
  forkCallout,
  promptSection,
  highlighted,
  highlightOpacity = 1,
}: BlockDetailCardProps) {
  const { t } = useI18n();
  const practiceLimits = useMemo(
    () => normalizeBlockPracticeOptions(practiceOptions ?? null),
    [practiceOptions],
  );
  const defaults = useMemo(
    () => resolveDefaultPracticeLaunchUi(practiceLimits),
    [practiceLimits],
  );
  const [style, setStyle] = useState<LearningStyle>(defaults.style);
  const [timebox, setTimebox] = useState(defaults.timebox);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    defaults.durationMinutes,
  );
  const isStacked = layout === "stacked";
  const isModal = layout === "modal";

  // Re-seed when author limits change (e.g. after Edit save).
  useEffect(() => {
    setStyle(defaults.style);
    setTimebox(defaults.timebox);
    setDurationMinutes(defaults.durationMinutes);
  }, [defaults.style, defaults.timebox, defaults.durationMinutes]);

  const allowedDurations = useMemo(() => {
    const list = blockAllowedDurations(practiceLimits);
    return list.length > 0 ? list : [...DURATIONS];
  }, [practiceLimits]);

  const timedAllowed = allowTimed && practiceLimits.allowTimed;
  const openEndedAllowed = practiceLimits.allowOpenEnded;
  // If only timed is allowed, force timebox on; if only open-ended, force off.
  const effectiveTimebox =
    timedAllowed && openEndedAllowed
      ? timebox
      : timedAllowed
        ? true
        : false;

  const resolvedTarget = useMemo(
    () => resolveLaunchFromStyleAndTimebox(style, effectiveTimebox),
    [style, effectiveTimebox],
  );

  const canLaunchStyle = (s: LearningStyle) => {
    if (!blockAllowsPracticeStyle(practiceLimits, s)) return false;
    if (!blockAllowsLaunchTarget(practiceLimits, s, effectiveTimebox)) {
      return false;
    }
    const target = resolveLaunchFromStyleAndTimebox(s, effectiveTimebox);
    if (onLaunchIntent) return true;
    if (target.id === "open_ended_explore") return Boolean(onStartIle);
    if (target.id === "open_ended_drill") return Boolean(onStartIleProject);
    if (target.id === "timed_explore") return Boolean(onStartEval);
    if (target.id === "timed_drill") return Boolean(onStartExercise);
    return false;
  };

  const canStart = canLaunchStyle(style);

  const launch = (target: ProductLaunchTarget, event?: React.MouseEvent) => {
    const minutes =
      target.product === "tap"
        ? clampPracticeDuration(practiceLimits, durationMinutes)
        : undefined;
    if (onLaunchIntent) {
      onLaunchIntent(target, minutes != null ? { minutes } : undefined);
      return;
    }
    if (target.id === "open_ended_explore") {
      onStartIle?.();
      return;
    }
    if (target.id === "open_ended_drill") {
      onStartIleProject?.();
      return;
    }
    if (target.id === "timed_explore") {
      onStartEval?.(event as React.MouseEvent, minutes);
      return;
    }
    if (target.id === "timed_drill") {
      onStartExercise?.(event as React.MouseEvent, minutes);
    }
  };

  // Flat shell — avoid deep nested card chrome in the narrow right pane.
  const cardShellClass = isStacked || isModal
    ? "relative"
    : `relative ${highlighted ? "ring-1 ring-white/15" : ""}`;

  const cardShellStyle = highlighted
    ? { boxShadow: `0 0 12px rgba(255,255,255,${highlightOpacity * 0.06})` }
    : undefined;

  void thumbnailSrc;
  void progressRing;
  const heroLayout = isModal ? "modal" : isStacked ? "stacked" : "horizontal";
  const blockHero = (
    <BlockDetailHero
      title={title}
      description={description}
      isStart={isStart}
      layout={heroLayout}
    />
  );

  const actionButtons = showActions ? (
    <div data-product-intent="workspace-start" data-product-intent-ui="style-timebox">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {PRODUCT_INTENT_LABELS.chooseStyle}
      </p>

      {/* Select-only style tools — same chrome for Explore and Drill; launch via Start */}
      <div
        className="grid grid-cols-2 gap-2"
        data-block-mode-tools
        data-product-intent-style-grid
        data-practice-allow-explore={practiceLimits.allowExplore ? "true" : "false"}
        data-practice-allow-drill={practiceLimits.allowDrill ? "true" : "false"}
      >
        {(
          [
            {
              id: "explore" as const,
              label: PRODUCT_INTENT_LABELS.styleExplore,
              Icon: ExploreIcon,
            },
            {
              id: "drill" as const,
              label: "Drill",
              Icon: DrillIcon,
            },
          ] as const
        )
          .filter(({ id }) => blockAllowsPracticeStyle(practiceLimits, id))
          .map(({ id, label, Icon }) => {
          const selected = style === id;
          const target = resolveLaunchFromStyleAndTimebox(id, effectiveTimebox);
          return (
            <button
              key={id}
              type="button"
              data-style-option={id}
              data-style-select
              data-product-intent-id={target.id}
              data-product-tech={target.product}
              data-block-tool={target.id}
              aria-pressed={selected}
              disabled={isStarting || isLocked || !canLaunchStyle(id)}
              onClick={() => setStyle(id)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border-2 px-3 text-left transition disabled:opacity-40 ${
                selected
                  ? "border-white/55 bg-white/10 text-white"
                  : "border-white/25 bg-transparent text-white hover:border-white/45 hover:bg-white/5"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-90" />
              <span className="text-xs font-semibold tracking-tight">{label}</span>
            </button>
          );
        })}
      </div>

      {timedAllowed && openEndedAllowed ? (
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2"
          data-timebox-control
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-200">Timebox</p>
            <p className="text-[10px] leading-snug text-neutral-500">
              {effectiveTimebox
                ? "Timed session (clock on)"
                : "Open-ended session (no clock)"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={effectiveTimebox}
            data-timebox-toggle
            data-timebox-on={effectiveTimebox ? "true" : "false"}
            disabled={isStarting || isLocked}
            onClick={() => setTimebox((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
              effectiveTimebox
                ? "border-white/40 bg-white/25"
                : "border-neutral-600 bg-neutral-800"
            } disabled:opacity-40`}
          >
            <span
              className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition ${
                effectiveTimebox ? "left-5" : "left-0.5"
              }`}
              style={{ width: 18, height: 18 }}
            />
          </button>
        </div>
      ) : timedAllowed ? (
        <p
          className="mt-2 text-[10px] text-neutral-500"
          data-timebox-forced="timed"
        >
          Timed sessions only for this block.
        </p>
      ) : openEndedAllowed ? (
        <p
          className="mt-2 text-[10px] text-neutral-500"
          data-timebox-forced="open"
        >
          Open-ended only (no timer) for this block.
        </p>
      ) : null}

      {effectiveTimebox && timedAllowed ? (
        <div className="mt-3" data-launch-duration-picker>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Session length
          </p>
          <div
            className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
            role="group"
            aria-label="Session length"
            data-launch-duration-options
          >
            {allowedDurations.map((mins) => {
              const selected = durationMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  data-launch-duration={mins}
                  aria-pressed={selected}
                  disabled={isStarting || isLocked}
                  onClick={() => setDurationMinutes(mins)}
                  className={`h-8 rounded-lg border-2 text-[11px] font-semibold tracking-tight transition disabled:opacity-40 ${
                    selected
                      ? "border-white/55 bg-white/10 text-white"
                      : "border-white/25 bg-transparent text-neutral-300 hover:border-white/45 hover:bg-white/5"
                  }`}
                >
                  {mins}m
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        data-launch-start
        data-resolved-intent-id={resolvedTarget.id}
        disabled={isStarting || isLocked || !canStart}
        onClick={(e) => launch(resolvedTarget, e)}
        className="mt-3 w-full rounded-lg bg-white px-3 py-2.5 text-xs font-semibold tracking-tight text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {isStarting
          ? t("sessionItem.starting")
          : effectiveTimebox
            ? `Start · ${durationMinutes} min`
            : "Start"}
      </button>
    </div>
  ) : null;

  if (isModal) {
    const hasFloatingActions = !forkCallout && actionButtons;

    return (
      <div className={cardShellClass} style={cardShellStyle}>
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col">{blockHero}</div>

          {forkCallout ? <div className="shrink-0">{forkCallout}</div> : null}

          {hasFloatingActions ? (
            <div className="shrink-0 rounded-xl border border-white/15 bg-neutral-950/92 p-3 shadow-[0_-10px_36px_rgba(0,0,0,0.5)] backdrop-blur-md">
              {actionButtons}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isStacked) {
    return (
      <div className={cardShellClass} style={cardShellStyle}>
        <div className="space-y-4">
          {blockHero}

          {forkCallout ? <div>{forkCallout}</div> : actionButtons}

          {promptSection ? <div className="border-t border-white/10 pt-4">{promptSection}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cardShellClass} style={cardShellStyle} data-block-detail-launch>
      <div className="space-y-3">
        {blockHero}

        {forkCallout ? <div>{forkCallout}</div> : actionButtons ? <div>{actionButtons}</div> : null}

        {promptSection ? (
          <div className="border-t border-neutral-800/80 pt-2.5" data-customize-session-slot>
            {promptSection}
          </div>
        ) : null}
      </div>
    </div>
  );
}
