"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  PRODUCT_INTENT_LABELS,
  resolveLaunchFromStyleAndModality,
  type LearningStyle,
  type ProductLaunchTarget,
} from "@/lib/product-intent";
import { DEFAULT_DURATION_MINUTES, DURATIONS } from "@/lib/tap-score-client-helpers";
import {
  blockAllowedDurations,
  blockAllowsPracticeStyle,
  clampPracticeDuration,
  normalizeBlockPracticeOptions,
  resolveDefaultPracticeLaunchUi,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";

type ProgressRing = "neutral" | "completed" | "in_progress";

/** Drawer launch picker: Calibrate / Learn / Verify. Verify is select-only like Calibrate. */
type LaunchStyle = LearningStyle | "verify";

/** Optional launch options (duration chosen on the card before TAP/Calibrate/Verify). */
export type ProductLaunchOptions = {
  /** Session length in minutes for Calibrate, Verify, and Drill. */
  minutes?: number;
  /** Learning-workspace Verify launch. Same canvas, verification marks. */
  verification?: boolean;
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
   * Launch by product intent (Explore / Drill — always With AI).
   * Prefer this over the four technical callbacks.
   * Style buttons only select; Start triggers this.
   * Drill always → TAP conversational; Explore always → TAP Learning learning.
   */
  onLaunchIntent?: (target: ProductLaunchTarget, options?: ProductLaunchOptions) => void;
  /** Explore → TAP Learning learning (fallback if onLaunchIntent omitted). */
  onStartIle?: () => void;
  /** @deprecated New launches never use TAP Learning project. Kept so stored tokens still compile. */
  onStartIleProject?: () => void;
  /** Drill → TAP conversational */
  onStartEval?: (event: React.MouseEvent, minutes?: number) => void;
  /** @deprecated New launches never use TAP exercise. Kept so stored tokens still compile. */
  onStartExercise?: (event: React.MouseEvent, minutes?: number) => void;
  /**
   * When false, hide Drill (TAP) options / duration control.
   * @deprecated Prefer practiceOptions.allowDrill
   */
  allowTimed?: boolean;
  /**
   * Author limits on Explore/Drill + durations.
   * When set, further constrains which styles/durations appear.
   */
  practiceOptions?: BlockPracticeOptions | null;
  forkCallout?: ReactNode;
  promptSection?: ReactNode;
  highlighted?: boolean;
  highlightOpacity?: number;
  /** TAP Learning (non-TAP) Start label. TAP copy stays `Start · N min`. */
  ileStartLabel?: string;
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

function ScoutIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      data-style-icon="scout"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      <circle cx="10" cy="10" r="6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 14.5L20 20" />
      <circle cx="10" cy="10" r="2.2" />
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
  ileStartLabel,
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
  const [style, setStyle] = useState<LaunchStyle>(defaults.style);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    defaults.durationMinutes,
  );
  const isStacked = layout === "stacked";
  const isModal = layout === "modal";

  // Re-seed when author limits change (e.g. after Edit save).
  useEffect(() => {
    setStyle(defaults.style);
    setDurationMinutes(defaults.durationMinutes);
  }, [defaults.style, defaults.durationMinutes]);

  const allowedDurations = useMemo(() => {
    const list = blockAllowedDurations(practiceLimits);
    return list.length > 0 ? list : [...DURATIONS];
  }, [practiceLimits]);

  // Drill family may be disabled entirely via allowTimed legacy prop (hide TAP).
  const drillFamilyAllowed = allowTimed && practiceLimits.allowDrill;

  const resolvedTarget = useMemo(
    () =>
      resolveLaunchFromStyleAndModality(
        style === "verify" ? "explore" : style,
        false,
      ),
    [style],
  );
  const verifySelected = style === "verify";
  const showDurationPicker =
    (style === "drill" && drillFamilyAllowed) ||
    style === "scout" ||
    verifySelected;

  const canLaunchStyle = (s: LaunchStyle) => {
    if (s === "verify") return Boolean(onLaunchIntent);
    if (s === "drill") return false;
    if (!blockAllowsPracticeStyle(practiceLimits, s)) return false;
    const target = resolveLaunchFromStyleAndModality(s, false);
    if (onLaunchIntent) return true;
    if (target.id === "explore_dialog") return Boolean(onStartIle);
    if (target.id === "drill_dialog") return Boolean(onStartEval);
    if (target.id === "scout_dialog") return Boolean(onLaunchIntent || onStartEval);
    return false;
  };

  const canStart = canLaunchStyle(style);

  const launch = (target: ProductLaunchTarget, event?: React.MouseEvent) => {
    const minutes = clampPracticeDuration(practiceLimits, durationMinutes);
    if (verifySelected) {
      onLaunchIntent?.(target, { verification: true, minutes });
      return;
    }
    const tapMinutes = target.product === "tap" ? minutes : undefined;
    if (target.id === "drill_dialog" || target.interaction_kind === "conversational" || target.interaction_kind === "exercise") {
      return;
    }
    if (onLaunchIntent) {
      onLaunchIntent(target, tapMinutes != null ? { minutes: tapMinutes } : undefined);
      return;
    }
    if (target.id === "explore_dialog") {
      onStartIle?.();
      return;
    }
    if (target.id === "scout_dialog") {
      onStartEval?.(event as React.MouseEvent, tapMinutes);
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
    <div data-product-intent="workspace-start" data-product-intent-ui="style">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {PRODUCT_INTENT_LABELS.chooseStyle}
      </p>

      {/* Select-only style tools — Explore = TAP Learning, Drill = TAP; launch via Start */}
      <div
        className={`grid gap-2 ${onLaunchIntent ? "grid-cols-3" : "grid-cols-2"}`}
        data-block-mode-tools
        data-product-intent-style-grid
        data-practice-allow-explore="true"
        data-practice-allow-drill="false"
        data-practice-allow-scout="true"
      >
        {(
          [
            {
              id: "scout" as const,
              label: PRODUCT_INTENT_LABELS.styleScout,
              Icon: ScoutIcon,
            },
            {
              id: "explore" as const,
              label: PRODUCT_INTENT_LABELS.styleExplore,
              Icon: ExploreIcon,
            },
          ] as const
        )
          .filter(({ id }) => blockAllowsPracticeStyle(practiceLimits, id))
          .map(({ id, label, Icon }) => {
          const selected = style === id;
          const target = resolveLaunchFromStyleAndModality(id, false);
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
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-none border-2 px-3 text-left transition disabled:opacity-40 ${
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
        {onLaunchIntent ? (
          <button
            type="button"
            data-style-option="verify"
            data-style-select
            data-session-launch="verification"
            aria-pressed={verifySelected}
            disabled={isStarting || isLocked || !canLaunchStyle("verify")}
            onClick={() => setStyle("verify")}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-none border-2 px-3 text-left transition disabled:opacity-40 ${
              verifySelected
                ? "border-white/55 bg-white/10 text-white"
                : "border-white/25 bg-transparent text-white hover:border-white/45 hover:bg-white/5"
            }`}
          >
            <span className="text-xs font-semibold tracking-tight">Verify</span>
          </button>
        ) : null}
      </div>

      {/* Duration for Calibrate, Verify, and Drill. Learn has no clock. */}
      {showDurationPicker ? (
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
                  className={`h-8 rounded-none border-2 text-[11px] font-semibold tracking-tight transition disabled:opacity-40 ${
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
        data-start-new-session={
          resolvedTarget.product !== "tap" && ileStartLabel ? "true" : undefined
        }
        data-resolved-intent-id={verifySelected ? "verification" : resolvedTarget.id}
        data-session-launch={verifySelected ? "verification" : undefined}
        disabled={isStarting || isLocked || !canStart}
        onClick={(e) => launch(resolvedTarget, e)}
        className="mt-3 w-full rounded-none bg-white px-3 py-2.5 text-xs font-semibold tracking-tight text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {isStarting
          ? t("sessionItem.starting")
          : verifySelected || resolvedTarget.product === "tap"
            ? `Start · ${durationMinutes} min`
            : ileStartLabel || "Start"}
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
            <div className="shrink-0 rounded-none border border-white/15 bg-neutral-950/92 p-3 shadow-[0_-10px_36px_rgba(0,0,0,0.5)] backdrop-blur-md">
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
