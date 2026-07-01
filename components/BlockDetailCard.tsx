"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

type ProgressRing = "neutral" | "completed" | "in_progress";

type BlockDetailCardProps = {
  layout?: "horizontal" | "stacked";
  title: string;
  description?: string;
  index: number;
  thumbnailSrc: string;
  progressRing: ProgressRing;
  isStart?: boolean;
  evalLabel: string;
  isStarting?: boolean;
  isLocked?: boolean;
  showActions: boolean;
  onStartIle: () => void;
  onStartEval: (event: React.MouseEvent) => void;
  forkCallout?: ReactNode;
  promptSection?: ReactNode;
  highlighted?: boolean;
  highlightOpacity?: number;
};

const RING_CLASS: Record<ProgressRing, string> = {
  neutral: "ring-white/25",
  completed: "ring-emerald-400/60",
  in_progress: "ring-amber-400/70",
};

export function BlockDetailCard({
  layout = "horizontal",
  title,
  description,
  index,
  thumbnailSrc,
  progressRing,
  isStart,
  evalLabel,
  isStarting = false,
  isLocked = false,
  showActions,
  onStartIle,
  onStartEval,
  forkCallout,
  promptSection,
  highlighted,
  highlightOpacity = 1,
}: BlockDetailCardProps) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  const isStacked = layout === "stacked";

  const cardShellClass = isStacked
    ? "relative"
    : `relative overflow-hidden rounded-xl border border-white/15 bg-neutral-950/95 shadow-[0_10px_40px_rgba(0,0,0,0.45)] ${
        highlighted ? "ring-1 ring-white/25" : ""
      }`;

  const cardShellStyle = highlighted
    ? { boxShadow: `0 10px 40px rgba(0,0,0,0.45), 0 0 20px rgba(255,255,255,${highlightOpacity * 0.1})` }
    : undefined;

  const helpSections = [
    {
      titleKey: "sessionItem.ileHelpTitle",
      summaryKey: "sessionItem.ileHelpSummary",
      pointKeys: [
        "sessionItem.ileHelpPoint1",
        "sessionItem.ileHelpPoint2",
        "sessionItem.ileHelpPoint3",
      ],
    },
    {
      titleKey: "sessionItem.evalHelpTitle",
      summaryKey: "sessionItem.evalHelpSummary",
      pointKeys: [
        "sessionItem.evalHelpPoint1",
        "sessionItem.evalHelpPoint2",
        "sessionItem.evalHelpPoint3",
      ],
    },
  ] as const;

  const actionButtons = showActions ? (
    <div className={isStacked ? "space-y-2.5" : ""}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          {t("sessionItem.chooseMode")}
        </p>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-neutral-900/80 text-xs font-semibold text-neutral-400 transition hover:border-white/35 hover:bg-neutral-800 hover:text-white"
          aria-label={t("sessionItem.modesHelpTitle")}
        >
          ?
        </button>
      </div>

      <div className={`grid gap-2.5 ${isStacked ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <button
          type="button"
          onClick={onStartIle}
          disabled={isStarting || isLocked}
          className="group flex flex-col items-start gap-1.5 rounded-xl border-2 border-white bg-white px-4 py-3.5 text-left transition hover:bg-neutral-200 disabled:opacity-40"
        >
          <span className="text-sm font-semibold tracking-tight text-black">{t("sessionItem.ileCtaLabel")}</span>
          <span className="text-[11px] leading-snug text-neutral-600 group-hover:text-neutral-700">
            {isStarting ? t("sessionItem.starting") : t("sessionItem.ileCtaHint")}
          </span>
        </button>
        <button
          type="button"
          onClick={onStartEval}
          className="group flex flex-col items-start gap-1.5 rounded-xl border-2 border-white/40 bg-transparent px-4 py-3.5 text-left transition hover:border-white/70 hover:bg-white/5"
        >
          <span className="text-sm font-semibold tracking-tight text-white">{evalLabel}</span>
          <span className="text-[11px] leading-snug text-neutral-500 group-hover:text-neutral-400">
            {t("sessionItem.evalCtaHint")}
          </span>
        </button>
      </div>
    </div>
  ) : null;

  if (showHelp) {
    return (
      <div className={cardShellClass} style={cardShellStyle}>
        {!isStacked && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}

        <div className={isStacked ? "space-y-4" : "p-4 sm:p-5"}>
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

          <div className="mt-4 space-y-4">
            {helpSections.map((section) => (
              <div
                key={section.titleKey}
                className="rounded-lg border border-white/15 bg-neutral-900/50 p-4"
              >
                <p className="text-sm font-semibold text-white">{t(section.titleKey)}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-300">{t(section.summaryKey)}</p>
                <ul className="mt-3 space-y-2.5">
                  {section.pointKeys.map((pointKey) => (
                    <li key={pointKey} className="flex gap-2.5 text-[12px] leading-relaxed text-neutral-400">
                      <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-white/35" aria-hidden />
                      <span>{t(pointKey)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isStacked) {
    return (
      <div className={cardShellClass} style={cardShellStyle}>
        <div className="space-y-4">
          <div
            className={`relative aspect-[5/3] overflow-hidden rounded-xl border border-white/10 ring-2 ring-offset-2 ring-offset-[#0b0b0b] ${RING_CLASS[progressRing]}`}
          >
            <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <span className="absolute bottom-2 left-3 font-mono text-xs font-semibold text-white drop-shadow">
              {index + 1}
            </span>
            {isStart && (
              <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-200 backdrop-blur-sm">
                {t("sessionItem.startBlock")}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold leading-snug tracking-tight text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {description || t("sessionItem.noDescription")}
            </p>
          </div>

          {forkCallout ? <div>{forkCallout}</div> : actionButtons}

          {promptSection ? <div className="border-t border-white/10 pt-4">{promptSection}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cardShellClass} style={cardShellStyle}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="p-3.5 sm:p-4">
        <div className="flex gap-3.5">
          <div
            className={`relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-white/10 ring-2 ring-offset-2 ring-offset-neutral-950 ${RING_CLASS[progressRing]}`}
          >
            <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <span className="absolute bottom-1 left-1.5 font-mono text-[10px] font-semibold text-white/90 drop-shadow">
              {index + 1}
            </span>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold leading-snug tracking-tight text-white">{title}</h3>
              {isStart && (
                <span className="shrink-0 rounded-full border border-white/20 bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
                  {t("sessionItem.startBlock")}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-400">
              {description || t("sessionItem.noDescription")}
            </p>
          </div>
        </div>

        {forkCallout ? <div className="mt-3.5">{forkCallout}</div> : actionButtons ? <div className="mt-4">{actionButtons}</div> : null}

        {promptSection ? <div className="mt-3.5 border-t border-white/10 pt-3">{promptSection}</div> : null}
      </div>
    </div>
  );
}