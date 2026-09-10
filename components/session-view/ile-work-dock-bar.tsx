"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import type { IleDockChipStatus } from "@/lib/ile-work-dock-status";
import {
  FALLBACK_AESTHETIC_IMAGES,
  resolveIleWorkAestheticImage,
} from "@/lib/aesthetics";
import type { SessionViewTranslate } from "@/components/session-view/types";

export type IleWorkDockLabel = {
  id: string;
  label: string;
  keyword?: string;
  focused?: boolean;
  status?: IleDockChipStatus;
  image?: string;
};

export function IleSubmitWorkButton({
  label,
  onClick,
  busy = false,
  disabled = false,
  square = false,
  compact = false,
  sizeClass,
}: {
  label: string;
  onClick?: () => void;
  busy?: boolean;
  disabled?: boolean;
  square?: boolean;
  compact?: boolean;
  /** Match docked chapter chips (`h-24 w-[7rem]` / compact `h-16 w-[5.5rem]`). */
  sizeClass?: string;
}) {
  const box = sizeClass ?? (compact ? "h-16 w-[5.5rem]" : "h-24 w-[7rem]");
  return (
    <button
      type="button"
      data-ile-submit-turn
      data-ile-end-turn=""
      onClick={onClick}
      disabled={disabled || busy}
      className={
        square
          ? `relative flex ${box} shrink-0 flex-col items-center justify-center gap-1 rounded-none border-2 border-white bg-white p-[4px] text-center font-mono text-[11px] font-semibold uppercase leading-tight tracking-wider text-neutral-950 shadow-[0_14px_40px_rgba(255,255,255,0.32)] hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`
          : "flex shrink-0 items-center gap-1.5 rounded-none border border-white bg-white px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-950 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {square ? (
        <span
          data-ile-end-turn-double-border
          aria-hidden
          className="pointer-events-none absolute inset-[4px] border-2 border-neutral-950"
        />
      ) : null}
      <ArrowRight className={`relative z-10 ${square ? "size-4" : "size-3.5"}`} strokeWidth={2.3} aria-hidden />
      <span className="relative z-10">{label}</span>
    </button>
  );
}

export function IleWorkDockBar({
  heliosOpen,
  openWorkLabels,
  onFocusOpenWork,
  onSubmitTurn,
  submitTurnLabel,
  submitTurnBusy,
  submitTurnDisabled = false,
  aestheticImages = [],
  compact = false,
}: {
  t?: SessionViewTranslate;
  heliosOpen: boolean;
  openWorkLabels: IleWorkDockLabel[];
  onFocusOpenWork?: (id: string) => void;
  onSubmitTurn?: () => void;
  submitTurnLabel: string;
  submitTurnBusy?: boolean;
  submitTurnDisabled?: boolean;
  aestheticImages?: string[];
  compact?: boolean;
}) {
  const dockImages = aestheticImages.length > 0 ? aestheticImages : FALLBACK_AESTHETIC_IMAGES;
  const chipSize = compact ? "h-16 w-[5.5rem]" : "h-24 w-[7rem]";
  const showSubmit = Boolean(onSubmitTurn);

  return (
    <div
      data-ile-work-dock-bar
      className={`pointer-events-auto flex max-w-[min(100vw-1rem,56rem)] items-end gap-2 border border-white/20 bg-neutral-950/95 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.62)] ${
        compact ? "w-full max-w-none" : ""
      }`}
    >
      <div
        data-ile-end-turn-cluster
        data-ile-open-work-tabs={openWorkLabels.length > 0 ? "" : undefined}
        className="flex min-w-0 flex-1 items-end justify-end gap-1.5 overflow-x-auto"
      >
          {openWorkLabels.map((work) => {
            const expanded = Boolean(work.focused && heliosOpen);
            const chipImage = resolveIleWorkAestheticImage({
              id: work.id,
              assigned: work.image,
              images: dockImages,
            });
            const keyword = work.keyword?.trim();
            const status = work.status ?? "idle";
            return (
              <button
                key={work.id}
                type="button"
                data-ile-open-work-chip={work.id}
                data-ile-open-work-focused={work.focused ? "true" : undefined}
                data-ile-chapter-minimized={expanded ? undefined : "true"}
                data-ile-chapter-chip-status={status}
                onClick={() => onFocusOpenWork?.(work.id)}
                title={keyword ? `${work.label} · ${keyword}` : work.label}
                className={`relative flex ${chipSize} shrink-0 flex-col items-stretch justify-end overflow-hidden rounded-none border ${
                  expanded
                    ? "border-white shadow-[0_0_0_1px_#fff,0_12px_28px_rgba(0,0,0,0.55)]"
                    : "border-white/25 hover:border-white/70"
                }`}
              >
                <span
                  data-ile-chapter-chip-image
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${chipImage})` }}
                />
                <span
                  aria-hidden
                  className={`absolute inset-0 ${
                    expanded
                      ? "bg-gradient-to-t from-black/80 via-black/25 to-black/5"
                      : "bg-gradient-to-t from-black/90 via-black/50 to-black/20"
                  }`}
                />
                {status === "attention" && !expanded ? (
                  <span
                    data-ile-chapter-chip-attention
                    title="Needs attention"
                    className="absolute right-1 top-1 z-20 flex size-5 items-center justify-center border border-amber-300/80 bg-black/75 text-amber-300"
                  >
                    <AlertTriangle className="size-3" strokeWidth={2.4} aria-hidden />
                    <span className="sr-only">Needs attention</span>
                  </span>
                ) : null}
                <span className="relative z-10 flex flex-col items-start px-1.5 pb-1.5 pt-6">
                  <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-white/75">
                    {work.label}
                  </span>
                  {keyword ? (
                    <span
                      data-ile-chapter-chip-keyword
                      className="line-clamp-2 max-w-full text-left font-mono text-[11px] font-semibold uppercase leading-tight tracking-wide text-white"
                    >
                      {keyword}
                    </span>
                  ) : null}
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/70">
                    {expanded ? "Open" : "Docked"}
                  </span>
                </span>
                {status === "loading" ? (
                  <span
                    data-ile-chapter-chip-loading
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 z-20 h-1 overflow-hidden bg-white/15"
                  >
                    <span className="block h-full w-1/3 animate-ile-dock-indeterminate bg-white" />
                  </span>
                ) : null}
              </button>
            );
          })}
      {showSubmit ? (
        <IleSubmitWorkButton
          square
          compact={compact}
          sizeClass={chipSize}
          label={submitTurnLabel}
          onClick={onSubmitTurn}
          busy={submitTurnBusy}
          disabled={submitTurnDisabled}
        />
      ) : null}
      </div>
    </div>
  );
}
