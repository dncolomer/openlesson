"use client";

import { AlertTriangle } from "lucide-react";
import type { IleDockChipStatus } from "@/lib/ile-work-dock-status";
import {
  FALLBACK_AESTHETIC_IMAGES,
  resolveIleWorkAestheticImage,
} from "@/lib/aesthetics";
import { useSurfaceAestheticImages } from "@/lib/use-surface-aesthetic-images";
import type { SessionViewTranslate } from "@/components/session-view/types";

export type IleWorkDockLabel = {
  id: string;
  label: string;
  keyword?: string;
  focused?: boolean;
  status?: IleDockChipStatus;
  image?: string;
};

export function IleWorkDockChip({
  work,
  expanded = false,
  compact = false,
  fill = false,
  aestheticImages = [],
  onClick,
  caption,
}: {
  work: IleWorkDockLabel;
  expanded?: boolean;
  compact?: boolean;
  /** Stretch to the grid cell. The sidebar dock uses this so chips do not form a scrolling row. */
  fill?: boolean;
  aestheticImages?: readonly string[];
  onClick?: () => void;
  caption?: string;
}) {
  const chipSize = compact ? "h-16 w-[5.5rem]" : "h-24 w-[7rem]";
  const sizeClass = fill ? "h-24 w-full min-w-0" : chipSize;
  const surface = useSurfaceAestheticImages(aestheticImages);
  const dockImages =
    surface.source === "fallback" ? FALLBACK_AESTHETIC_IMAGES : surface.images;
  const chipImage = resolveIleWorkAestheticImage({
    id: work.id,
    assigned: work.image,
    images: surface.source === "pending" ? undefined : dockImages,
  });
  const keyword = work.keyword?.trim();
  const status = work.status ?? "idle";
  const interactive = typeof onClick === "function";
  const className = `relative flex ${sizeClass} ${fill ? "max-w-full" : "shrink-0"} flex-col items-stretch justify-end overflow-hidden rounded-none border ${
    expanded
      ? "border-white shadow-[0_0_0_1px_#fff,0_12px_28px_rgba(0,0,0,0.55)]"
      : "border-white/25 hover:border-white/70"
  }`;
  const body = (
    <>
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
          {caption ?? (expanded ? "Open" : "Docked")}
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
    </>
  );
  if (interactive) {
    return (
      <button
        type="button"
        data-ile-open-work-chip={work.id}
        data-ile-open-work-focused={work.focused ? "true" : undefined}
        data-ile-chapter-minimized={expanded ? undefined : "true"}
        data-ile-chapter-chip-status={status}
        onClick={onClick}
        title={keyword ? `${work.label} · ${keyword}` : work.label}
        className={className}
      >
        {body}
      </button>
    );
  }
  return (
    <div
      data-ile-open-work-chip={work.id}
      data-ile-chapter-chip-status={status}
      title={keyword ? `${work.label} · ${keyword}` : work.label}
      className={className}
    >
      {body}
    </div>
  );
}

export function IleWorkDockBar({
  heliosOpen,
  openWorkLabels,
  onFocusOpenWork,
  aestheticImages = [],
  compact = false,
}: {
  t?: SessionViewTranslate;
  heliosOpen: boolean;
  openWorkLabels: IleWorkDockLabel[];
  onFocusOpenWork?: (id: string) => void;
  aestheticImages?: string[];
  compact?: boolean;
}) {
  const surface = useSurfaceAestheticImages(aestheticImages);
  const dockImages =
    surface.source === "fallback" ? FALLBACK_AESTHETIC_IMAGES : surface.images;

  return (
    <div
      data-ile-work-dock-bar
      className="pointer-events-auto w-full min-w-0 max-w-full border border-white/20 bg-neutral-950/95 p-2"
    >
      <div
        data-ile-chapter-dock-chapters
        data-ile-open-work-tabs={openWorkLabels.length > 0 ? "" : undefined}
        className="grid w-full min-w-0 grid-cols-2 gap-1.5"
      >
          {openWorkLabels.map((work) => (
            <IleWorkDockChip
              key={work.id}
              work={work}
              expanded={Boolean(work.focused && heliosOpen)}
              compact={compact}
              fill
              aestheticImages={dockImages}
              onClick={() => onFocusOpenWork?.(work.id)}
            />
          ))}
      </div>
    </div>
  );
}
