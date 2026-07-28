"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  allProductLaunchTargets,
  productIntentClusterHint,
  productIntentClusterLabel,
  PRODUCT_INTENT_LABELS,
  type ProductLaunchTarget,
} from "@/lib/product-intent";

type ProgressRing = "neutral" | "completed" | "in_progress";

type BlockDetailCardProps = {
  layout?: "horizontal" | "stacked" | "modal";
  title: string;
  description?: string;
  thumbnailSrc: string;
  progressRing: ProgressRing;
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
   */
  onLaunchIntent?: (target: ProductLaunchTarget) => void;
  /** Open-ended Explore → ILE learning (fallback if onLaunchIntent omitted). */
  onStartIle?: () => void;
  /** Open-ended Drill → ILE project */
  onStartIleProject?: () => void;
  /** Timed Explore → TAP conversational */
  onStartEval?: (event: React.MouseEvent) => void;
  /** Timed Drill → TAP exercise */
  onStartExercise?: (event: React.MouseEvent) => void;
  /** When false, hide timed (TAP) options. */
  allowTimed?: boolean;
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

function BlockDetailHero({
  thumbnailSrc,
  title,
  description,
  progressRing,
  isStart,
  layout,
  className = "",
}: {
  thumbnailSrc: string;
  title: string;
  description?: string;
  progressRing: ProgressRing;
  isStart?: boolean;
  layout: "modal" | "stacked" | "horizontal";
  className?: string;
}) {
  const { t } = useI18n();
  const sizeClass =
    layout === "stacked"
      ? "aspect-[5/3] shrink-0"
      : layout === "modal"
        ? "min-h-[8.75rem] flex-1"
        : "aspect-[2.65/1] min-h-[6.5rem] shrink-0";

  const titleClamp =
    layout === "stacked" ? "line-clamp-2" : layout === "modal" ? "line-clamp-2" : "line-clamp-1";
  const descriptionClamp =
    layout === "stacked" ? "line-clamp-2" : layout === "modal" ? "line-clamp-4" : "line-clamp-2";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 ring-1 ring-inset ${HERO_RING_CLASS[progressRing]} ${sizeClass} ${className}`}
    >
      <img src={thumbnailSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/50 to-black/20" />
      <div className="absolute inset-0 flex flex-col justify-end overflow-hidden p-3 sm:p-3.5">
        <div className="flex min-h-0 max-h-full items-end justify-between gap-2 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <h3
              className={`font-semibold leading-snug tracking-tight text-white drop-shadow-md ${titleClamp} ${
                layout === "stacked" ? "text-lg" : "text-base"
              }`}
            >
              {title}
            </h3>
            <p
              className={`mt-1 leading-relaxed text-neutral-200/90 drop-shadow-sm ${descriptionClamp} ${
                layout === "stacked" ? "text-sm" : "text-xs"
              }`}
            >
              {description || t("sessionItem.noDescription")}
            </p>
          </div>
          {isStart ? (
            <span className="shrink-0 rounded-full border border-white/25 bg-black/45 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-neutral-100 backdrop-blur-sm">
              {t("sessionItem.startBlock")}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BlockDetailGuidePanel() {
  const { t } = useI18n();
  const hints = [
    "sessionItem.blockDetailGuideHint1",
    "sessionItem.blockDetailGuideHint2",
    "sessionItem.blockDetailGuideHint3",
    "sessionItem.blockDetailGuideHint4",
    "sessionItem.blockDetailGuideHint5",
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-lg border border-white/10 bg-neutral-900/35 p-3.5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          {t("sessionItem.blockDetailGuideTitle")}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-300">{t("sessionItem.blockDetailGuideIntro")}</p>
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="text-xs font-medium text-neutral-200">{t("sessionItem.blockDetailGuideSourcesTitle")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            {t("sessionItem.blockDetailGuideSourcesBody")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-200">{t("sessionItem.blockDetailGuideMaterialsTitle")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            {t("sessionItem.blockDetailGuideMaterialsBody")}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">
          {t("sessionItem.blockDetailGuideHintsTitle")}
        </p>
        <ul className="mt-2 space-y-1.5">
          {hints.map((key) => (
            <li key={key} className="flex gap-2 text-[11px] leading-snug text-neutral-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" aria-hidden />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
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
  forkCallout,
  promptSection,
  highlighted,
  highlightOpacity = 1,
}: BlockDetailCardProps) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  const isStacked = layout === "stacked";
  const isModal = layout === "modal";

  const targets = allProductLaunchTargets().filter((target) => {
    if (target.product === "tap" && !allowTimed) return false;
    if (target.id === "open_ended_drill" && !onStartIleProject && !onLaunchIntent) return false;
    if (target.product === "tap" && !onStartEval && !onStartExercise && !onLaunchIntent) return false;
    return true;
  });

  const launch = (target: ProductLaunchTarget, event?: React.MouseEvent) => {
    if (onLaunchIntent) {
      onLaunchIntent(target);
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
      onStartEval?.(event as React.MouseEvent);
      return;
    }
    if (target.id === "timed_drill") {
      onStartExercise?.(event as React.MouseEvent);
    }
  };

  const cardShellClass = isStacked || isModal
    ? "relative"
    : `relative overflow-hidden rounded-xl border border-white/15 bg-neutral-950/95 shadow-[0_10px_40px_rgba(0,0,0,0.45)] ${
        highlighted ? "ring-1 ring-white/25" : ""
      }`;

  const cardShellStyle = highlighted
    ? { boxShadow: `0 10px 40px rgba(0,0,0,0.45), 0 0 20px rgba(255,255,255,${highlightOpacity * 0.1})` }
    : undefined;

  const helpSections = [
    {
      title: PRODUCT_INTENT_LABELS.openEndedExplore,
      summary: PRODUCT_INTENT_LABELS.openEndedExploreHint,
    },
    {
      title: PRODUCT_INTENT_LABELS.openEndedDrill,
      summary: PRODUCT_INTENT_LABELS.openEndedDrillHint,
    },
    ...(allowTimed
      ? [
          {
            title: PRODUCT_INTENT_LABELS.timedExplore,
            summary: PRODUCT_INTENT_LABELS.timedExploreHint,
          },
          {
            title: PRODUCT_INTENT_LABELS.timedDrill,
            summary: PRODUCT_INTENT_LABELS.timedDrillHint,
          },
        ]
      : []),
  ];

  const heroLayout = isModal ? "modal" : isStacked ? "stacked" : "horizontal";
  const blockHero = (
    <BlockDetailHero
      thumbnailSrc={thumbnailSrc}
      title={title}
      description={description}
      progressRing={progressRing}
      isStart={isStart}
      layout={heroLayout}
      className={heroLayout === "horizontal" ? "rounded-none border-x-0 border-t-0" : ""}
    />
  );

  const actionButtons = showActions ? (
    <div data-product-intent="workspace-start">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          {PRODUCT_INTENT_LABELS.chooseStyle}
        </p>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-neutral-900/80 text-[10px] font-semibold text-neutral-400 transition hover:border-white/35 hover:bg-neutral-800 hover:text-white"
          aria-label={t("sessionItem.modesHelpTitle")}
        >
          ?
        </button>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-neutral-500">
        {PRODUCT_INTENT_LABELS.questionExplore} {PRODUCT_INTENT_LABELS.questionDrill}{" "}
        {PRODUCT_INTENT_LABELS.questionOpen} {PRODUCT_INTENT_LABELS.questionTimed}
      </p>

      <div
        className={`grid gap-2 ${
          targets.length >= 4
            ? isStacked
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2"
            : targets.length === 2
              ? isModal
                ? "grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1"
        }`}
        data-block-mode-tools
        data-product-intent-grid
      >
        {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={(e) => launch(target, e)}
              disabled={isStarting || isLocked}
              data-block-tool={target.id}
              data-product-intent-id={target.id}
              data-product-tech={target.product}
              className="group flex flex-col items-start gap-1 rounded-lg border-2 border-white/35 bg-transparent px-3 py-2.5 text-left transition hover:border-white/60 hover:bg-white/5 disabled:opacity-40"
            >
              <span className="text-xs font-semibold tracking-tight text-white">
                {productIntentClusterLabel(target)}
              </span>
              <span className="text-[10px] leading-snug text-neutral-500 group-hover:text-neutral-400">
                {isStarting ? t("sessionItem.starting") : productIntentClusterHint(target)}
              </span>
            </button>
          ))}
      </div>
    </div>
  ) : null;

  if (showHelp) {
    return (
      <div className={cardShellClass} style={cardShellStyle}>
        {!isStacked && !isModal && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}

        <div className={isStacked || isModal ? "space-y-3" : "p-4 sm:p-5"}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-white">{t("sessionItem.modesHelpTitle")}</p>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-neutral-900/80 text-sm text-neutral-400 transition hover:border-white/35 hover:bg-neutral-800 hover:text-white"
              aria-label={t("sessionItem.modesHelpClose")}
            >
              ×
            </button>
          </div>

          <div
            className={`grid gap-3 ${
              helpSections.length >= 4
                ? "sm:grid-cols-2"
                : helpSections.length >= 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2"
            }`}
          >
            {helpSections.map((section) => (
              <div
                key={section.title}
                className="rounded-lg border border-white/15 bg-neutral-900/50 p-3"
              >
                <p className="text-xs font-semibold text-white">{section.title}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-300">{section.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isModal) {
    const hasFloatingActions = !forkCallout && actionButtons;

    return (
      <div className={cardShellClass} style={cardShellStyle}>
        <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col">{blockHero}</div>

            {forkCallout ? <div className="shrink-0">{forkCallout}</div> : null}

            {hasFloatingActions ? (
              <div className="shrink-0 rounded-xl border border-white/15 bg-neutral-950/92 p-3 shadow-[0_-10px_36px_rgba(0,0,0,0.5)] backdrop-blur-md">
                {actionButtons}
              </div>
            ) : null}
          </div>

          <BlockDetailGuidePanel />
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
    <div className={cardShellClass} style={cardShellStyle}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {blockHero}

      <div className="p-3.5 sm:p-4">
        {forkCallout ? <div>{forkCallout}</div> : actionButtons ? <div className="mt-4">{actionButtons}</div> : null}

        {promptSection ? <div className="mt-3.5 border-t border-white/10 pt-3">{promptSection}</div> : null}
      </div>
    </div>
  );
}
