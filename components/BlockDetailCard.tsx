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
  blockAllowsLaunchTarget,
  blockAllowsPracticeStyle,
  clampPracticeDuration,
  normalizeBlockPracticeOptions,
  resolveDefaultPracticeLaunchUi,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";

type ProgressRing = "neutral" | "completed" | "in_progress";

/** Optional launch options (duration chosen on the card before TAP/Drill). */
export type ProductLaunchOptions = {
  /** Drill (TAP) sessions only — minutes for the TAP clock. */
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
   * Launch by product intent (Explore/Drill × Dialog/Solo).
   * Prefer this over the four technical callbacks.
   * Style buttons only select; Start triggers this.
   * Drill always → TAP; Explore always → ILE.
   */
  onLaunchIntent?: (target: ProductLaunchTarget, options?: ProductLaunchOptions) => void;
  /** Explore · Dialog → ILE learning (fallback if onLaunchIntent omitted). */
  onStartIle?: () => void;
  /** Explore · Solo → ILE project */
  onStartIleProject?: () => void;
  /** Drill · Dialog → TAP conversational */
  onStartEval?: (event: React.MouseEvent, minutes?: number) => void;
  /** Drill · Solo → TAP exercise */
  onStartExercise?: (event: React.MouseEvent, minutes?: number) => void;
  /**
   * When false, hide Drill (TAP) options / duration control.
   * @deprecated Prefer practiceOptions.allowDrill
   */
  allowTimed?: boolean;
  /**
   * Author limits on Explore/Drill × Dialog/Solo + durations.
   * When set, further constrains which styles/modalities/durations appear.
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

function WithAiIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      data-modality-icon="dialog"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      {/* Speech bubbles — dialog with AI */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8h6m-6 3h4m-5 7l2-2h7a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v7a2 2 0 002 2h1l2 2z"
      />
    </svg>
  );
}

function SoloIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      data-modality-icon="solo"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      {/* Pencil — solo exercise */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536M4 20h4.5L19.5 9 15 4.5 4 15.5V20z"
      />
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
  /** Second axis: solo exercise (true) vs LLM dialog (false). */
  const [solo, setSolo] = useState(defaults.solo);
  const [durationMinutes, setDurationMinutes] = useState<number>(
    defaults.durationMinutes,
  );
  const isStacked = layout === "stacked";
  const isModal = layout === "modal";

  // Re-seed when author limits change (e.g. after Edit save).
  useEffect(() => {
    setStyle(defaults.style);
    setSolo(defaults.solo);
    setDurationMinutes(defaults.durationMinutes);
  }, [defaults.style, defaults.solo, defaults.durationMinutes]);

  const allowedDurations = useMemo(() => {
    const list = blockAllowedDurations(practiceLimits);
    return list.length > 0 ? list : [...DURATIONS];
  }, [practiceLimits]);

  const dialogAllowed = practiceLimits.allowDialog;
  const soloAllowed = practiceLimits.allowSolo;
  // Drill family may be disabled entirely via allowTimed legacy prop (hide TAP).
  const drillFamilyAllowed = allowTimed && practiceLimits.allowDrill;
  // If only one modality is allowed, force it.
  const effectiveSolo =
    soloAllowed && dialogAllowed
      ? solo
      : soloAllowed
        ? true
        : false;

  const resolvedTarget = useMemo(
    () => resolveLaunchFromStyleAndModality(style, effectiveSolo),
    [style, effectiveSolo],
  );

  const canLaunchStyle = (s: LearningStyle) => {
    if (!blockAllowsPracticeStyle(practiceLimits, s)) return false;
    if (s === "drill" && !drillFamilyAllowed) return false;
    if (!blockAllowsLaunchTarget(practiceLimits, s, effectiveSolo)) {
      return false;
    }
    const target = resolveLaunchFromStyleAndModality(s, effectiveSolo);
    if (onLaunchIntent) return true;
    if (target.id === "explore_dialog") return Boolean(onStartIle);
    if (target.id === "explore_solo") return Boolean(onStartIleProject);
    if (target.id === "drill_dialog") return Boolean(onStartEval);
    if (target.id === "drill_solo") return Boolean(onStartExercise);
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
    if (target.id === "explore_dialog") {
      onStartIle?.();
      return;
    }
    if (target.id === "explore_solo") {
      onStartIleProject?.();
      return;
    }
    if (target.id === "drill_dialog") {
      onStartEval?.(event as React.MouseEvent, minutes);
      return;
    }
    if (target.id === "drill_solo") {
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
    <div data-product-intent="workspace-start" data-product-intent-ui="style-modality">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {PRODUCT_INTENT_LABELS.chooseStyle}
      </p>

      {/* Select-only style tools — Explore = ILE, Drill = TAP; launch via Start */}
      <div
        className="grid grid-cols-2 gap-2"
        data-block-mode-tools
        data-product-intent-style-grid
        data-practice-allow-explore={practiceLimits.allowExplore ? "true" : "false"}
        data-practice-allow-drill={drillFamilyAllowed ? "true" : "false"}
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
          .filter(({ id }) => {
            if (id === "drill" && !drillFamilyAllowed) return false;
            return blockAllowsPracticeStyle(practiceLimits, id);
          })
          .map(({ id, label, Icon }) => {
          const selected = style === id;
          const target = resolveLaunchFromStyleAndModality(id, effectiveSolo);
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

      {dialogAllowed || soloAllowed ? (
        <div className="mt-3" data-modality-control data-timebox-control>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            {PRODUCT_INTENT_LABELS.chooseModality}
          </p>
          <div
            className="grid grid-cols-2 gap-2"
            data-product-intent-modality-grid
            data-modality-toggle
            data-timebox-toggle
            data-timebox-on={effectiveSolo ? "true" : "false"}
            data-modality={effectiveSolo ? "solo" : "dialog"}
            role="group"
            aria-label={PRODUCT_INTENT_LABELS.chooseModality}
          >
            {(
              [
                {
                  id: "dialog" as const,
                  solo: false,
                  label: PRODUCT_INTENT_LABELS.modalityDialog,
                  Icon: WithAiIcon,
                },
                {
                  id: "solo" as const,
                  solo: true,
                  label: PRODUCT_INTENT_LABELS.modalitySolo,
                  Icon: SoloIcon,
                },
              ] as const
            )
              .filter(({ solo: isSolo }) =>
                isSolo ? soloAllowed : dialogAllowed,
              )
              .map(({ id, solo: isSolo, label, Icon }) => {
                const selected = effectiveSolo === isSolo;
                return (
                  <button
                    key={id}
                    type="button"
                    data-modality-option={id}
                    data-modality-select
                    data-modality={id}
                    aria-pressed={selected}
                    disabled={isStarting || isLocked}
                    onClick={() => setSolo(isSolo)}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border-2 px-3 text-left transition disabled:opacity-40 ${
                      selected
                        ? "border-white/55 bg-white/10 text-white"
                        : "border-white/25 bg-transparent text-white hover:border-white/45 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 opacity-90" />
                    <span className="text-xs font-semibold tracking-tight">
                      {label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}

      {/* Duration only for Drill (TAP) launches */}
      {style === "drill" && drillFamilyAllowed ? (
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
          : resolvedTarget.product === "tap"
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
