import type { HTMLAttributes } from "react";
import type { SalesSlide } from "@/lib/sales/solution-slide-decks";

export type SlideRendererProps = {
  slide: SalesSlide;
  deckSlides?: SalesSlide[];
  onGoToSlide?: (slideIndex: number) => void;
};

/**
 * Slide stage: full width/height. Top-left single-column copy.
 * Semi-transparent black so aesthetic BGs show through.
 * overflow-y-auto only as safety so dense slides never clip narrative.
 */
export const CONTENT_PANEL_CLASS =
  "flex h-full min-h-0 w-full max-w-none flex-col items-stretch justify-start overflow-y-auto overflow-x-hidden rounded-none border border-white/10 bg-black/50 p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-6 md:p-7 lg:p-8";

/**
 * Larger responsive type scale (raised vs prior ~0.85–3rem compact clamps).
 * Single-column layout relies on readable projector sizes.
 */
export const TITLE_H2 =
  "w-full text-left text-[clamp(1.5rem,2vw+0.7rem,2.75rem)] font-medium leading-[1.15] tracking-[-0.03em] text-white";
/** Tighter title for dense 2×2 product stack (no-scroll). */
export const TITLE_H2_COMPACT =
  "w-full shrink-0 text-left text-[clamp(1.25rem,1.5vw+0.65rem,2.1rem)] font-medium leading-[1.15] tracking-[-0.03em] text-white";
export const SUBTITLE =
  "mt-3 w-full text-left text-[clamp(1.05rem,0.7vw+0.85rem,1.4rem)] leading-snug text-zinc-200";
export const SUBTITLE_COMPACT =
  "mt-2 w-full shrink-0 text-left text-[clamp(0.9rem,0.45vw+0.78rem,1.15rem)] leading-snug text-zinc-200";
export const BODY =
  "text-left text-[clamp(1rem,0.45vw+0.88rem,1.25rem)] leading-snug text-zinc-50";
export const SECTION_LABEL =
  "mb-3 self-start font-mono text-[11px] font-medium uppercase tracking-[1.6px] text-zinc-300 sm:text-xs";

export function ContentPanel({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-pitch-content-panel
      className={`${CONTENT_PANEL_CLASS} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-block self-start rounded-none border border-zinc-600/80 bg-black/50 px-2.5 py-0.5 text-left font-mono text-[10px] uppercase tracking-[2px] text-zinc-300 sm:mb-3.5 sm:text-[11px]">
      {children}
    </p>
  );
}

/** Always single-column — no multi-col bullet grids inside content panels. */
export function BulletList({
  items,
  variant = "dot",
  itemTargets,
  onGoToSlide,
}: {
  items: string[];
  variant?: "dot" | "number";
  /** When set, items with a non-negative target index become clickable jump links. */
  itemTargets?: Array<number | null | undefined>;
  onGoToSlide?: (slideIndex: number) => void;
}) {
  return (
    <ul
      data-pitch-bullet-list
      data-pitch-single-column
      className="mt-4 flex w-full flex-col gap-3 text-left sm:mt-5 sm:gap-3.5"
    >
      {items.map((item, bulletIndex) => {
        const target = itemTargets?.[bulletIndex];
        const clickable =
          typeof target === "number" && target >= 0 && typeof onGoToSlide === "function";
        const marker =
          variant === "number" ? (
            <span className="mt-0.5 shrink-0 font-mono text-[0.85em] text-zinc-300">
              {bulletIndex + 1}.
            </span>
          ) : (
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-200/90" />
          );

        return (
          <li key={`${bulletIndex}-${item}`} className={BODY}>
            {clickable ? (
              <button
                type="button"
                data-pitch-toc-link
                data-pitch-toc-target={target}
                onClick={() => onGoToSlide(target)}
                className="flex w-full gap-3 rounded-none border border-transparent px-1 py-1 text-left transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                {marker}
                <span className="min-w-0 underline decoration-white/25 underline-offset-4">
                  {item}
                </span>
              </button>
            ) : (
              <div className="flex gap-3">
                {marker}
                <span className="min-w-0">{item}</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Emphasized thesis callouts (science hypothesis + PoW proxy).
 * Stronger border, brighter fill, larger type than regular bullets.
 * Optional left image + source credit (same index as items).
 */
export function HighlightCallouts({
  items,
  labels,
  images,
  imageAlts,
  imageSources,
}: {
  items: string[];
  labels?: string[];
  images?: (string | undefined)[];
  imageAlts?: (string | undefined)[];
  imageSources?: (string | undefined)[];
}) {
  return (
    <div
      data-pitch-highlights
      className="mt-4 flex w-full flex-col gap-3 text-left sm:mt-5 sm:gap-3.5"
    >
      {items.map((item, index) => {
        const image = images?.[index];
        const imageSource = imageSources?.[index];
        return (
          <div
            key={`${index}-${item.slice(0, 48)}`}
            data-pitch-highlight
            className="rounded-none border border-white/25 bg-white/[0.08] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-5 sm:py-3.5"
          >
            <div className={image ? "flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4" : undefined}>
              {image ? (
                <div
                  data-pitch-highlight-image
                  className="flex w-full shrink-0 flex-col items-start gap-1.5 sm:w-[min(32%,11rem)]"
                >
                  <div className="w-full overflow-hidden rounded border border-white/15 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pitch deck public assets */}
                    <img
                      src={image}
                      alt={imageAlts?.[index] ?? labels?.[index] ?? "Highlight illustration"}
                      className="mx-auto h-auto w-full max-h-28 object-contain object-center sm:max-h-32"
                    />
                  </div>
                  {imageSource ? (
                    <p
                      data-pitch-highlight-source
                      className="font-mono text-[9px] uppercase tracking-[1.4px] text-zinc-400 sm:text-[10px]"
                    >
                      {imageSource}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                {labels?.[index] && (
                  <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[1.8px] text-white/70 sm:text-[11px]">
                    {labels[index]}
                  </p>
                )}
                <p className="text-left text-[clamp(1.05rem,0.55vw+0.9rem,1.3rem)] font-medium leading-snug text-white">
                  {item}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SlideFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
