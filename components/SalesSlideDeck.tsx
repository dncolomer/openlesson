"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from "react";
import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";

type SalesSlideDeckProps = {
  deck: SolutionSlideDeck;
};

/**
 * Pitch media video: full frame (no zoom/crop), muted autoplay.
 * object-contain shows the whole clip; column width drives size, max-height caps stage scroll.
 */
function PitchMediaVideo({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    const tryPlay = () => {
      void el.play().catch(() => {
        /* Autoplay blocked — still show first frame */
      });
    };
    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    return () => el.removeEventListener("loadeddata", tryPlay);
  }, [src]);

  return (
    <div data-pitch-media-video-frame className="relative w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        data-pitch-media-video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label={label}
        className="pointer-events-none block h-auto w-full max-h-[min(52vh,28rem)] object-contain object-center bg-black"
      />
    </div>
  );
}

/**
 * Slide stage: full width/height. Top-left single-column copy.
 * Semi-transparent black so aesthetic BGs show through.
 * overflow-y-auto only as safety so dense slides never clip narrative.
 */
const CONTENT_PANEL_CLASS =
  "flex h-full min-h-0 w-full max-w-none flex-col items-stretch justify-start overflow-y-auto overflow-x-hidden rounded-md border border-white/10 bg-black/50 p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-6 md:p-7 lg:p-8";

/**
 * Larger responsive type scale (raised vs prior ~0.85–3rem compact clamps).
 * Single-column layout relies on readable projector sizes.
 */
const TITLE_H1 =
  "w-full text-left text-[clamp(1.85rem,2.8vw+0.85rem,3.5rem)] font-medium leading-[1.12] tracking-[-0.04em] text-white";
const TITLE_H2 =
  "w-full text-left text-[clamp(1.5rem,2vw+0.7rem,2.75rem)] font-medium leading-[1.15] tracking-[-0.03em] text-white";
/** Tighter title for dense 2×2 product stack (no-scroll). */
const TITLE_H2_COMPACT =
  "w-full shrink-0 text-left text-[clamp(1.25rem,1.5vw+0.65rem,2.1rem)] font-medium leading-[1.15] tracking-[-0.03em] text-white";
const SUBTITLE =
  "mt-3 w-full text-left text-[clamp(1.05rem,0.7vw+0.85rem,1.4rem)] leading-snug text-zinc-200";
const SUBTITLE_COMPACT =
  "mt-2 w-full shrink-0 text-left text-[clamp(0.9rem,0.45vw+0.78rem,1.15rem)] leading-snug text-zinc-200";
const BODY =
  "text-left text-[clamp(1rem,0.45vw+0.88rem,1.25rem)] leading-snug text-zinc-50";
const SECTION_LABEL =
  "mb-3 self-start font-mono text-[11px] font-medium uppercase tracking-[1.6px] text-zinc-300 sm:text-xs";

function ContentPanel({
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-block self-start rounded-sm border border-zinc-600/80 bg-black/50 px-2.5 py-0.5 text-left font-mono text-[10px] uppercase tracking-[2px] text-zinc-300 sm:mb-3.5 sm:text-[11px]">
      {children}
    </p>
  );
}

/** Always single-column — no multi-col bullet grids inside content panels. */
function BulletList({
  items,
  variant = "dot",
}: {
  items: string[];
  variant?: "dot" | "number";
}) {
  return (
    <ul
      data-pitch-bullet-list
      data-pitch-single-column
      className="mt-4 flex w-full flex-col gap-3 text-left sm:mt-5 sm:gap-3.5"
    >
      {items.map((item, bulletIndex) => (
        <li key={`${bulletIndex}-${item}`} className={`flex gap-3 ${BODY}`}>
          {variant === "number" ? (
            <span className="mt-0.5 shrink-0 font-mono text-[0.85em] text-zinc-300">
              {bulletIndex + 1}.
            </span>
          ) : (
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-200/90" />
          )}
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Emphasized thesis callouts (science hypothesis + PoW proxy).
 * Stronger border, brighter fill, larger type than regular bullets.
 */
function HighlightCallouts({
  items,
  labels,
}: {
  items: string[];
  labels?: string[];
}) {
  return (
    <div
      data-pitch-highlights
      className="mt-4 flex w-full flex-col gap-3 text-left sm:mt-5 sm:gap-3.5"
    >
      {items.map((item, index) => (
        <div
          key={`${index}-${item.slice(0, 48)}`}
          data-pitch-highlight
          className="rounded-md border border-white/25 bg-white/[0.08] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-5 sm:py-3.5"
        >
          {labels?.[index] && (
            <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[1.8px] text-cyan-200/90 sm:text-[11px]">
              {labels[index]}
            </p>
          )}
          <p className="text-left text-[clamp(1.05rem,0.55vw+0.9rem,1.3rem)] font-medium leading-snug text-white">
            {item}
          </p>
        </div>
      ))}
    </div>
  );
}

function IdeaIcon() {
  return (
    <span
      data-pitch-idea-icon
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 text-cyan-200"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 18h5M10 21h4M8.2 15.2A5.8 5.8 0 1 1 15.8 15.2c-.7.9-1.3 1.7-1.6 2.8H9.8c-.3-1.1-.9-1.9-1.6-2.8Z"
        />
      </svg>
    </span>
  );
}

/** Equal framed boxes for pillars / synergy steps (e.g. three verticals, 2×2 products). */
function CardGrid({
  cards,
  fill = false,
  /** Force a 2×2 layout (products stack) instead of a 1×4 row. */
  twoByTwo = false,
}: {
  cards: Array<{
    label: string;
    body?: string;
    ideas?: Array<{ title: string; body: string }>;
    image?: string;
    imageAlt?: string;
  }>;
  /** Stretch cards to fill remaining slide height (e.g. products stack). */
  fill?: boolean;
  twoByTwo?: boolean;
}) {
  const hasIdeas = cards.some((card) => (card.ideas?.length ?? 0) > 0);
  const is2x2 = twoByTwo || cards.length === 4;
  const colClass = is2x2
    ? "grid-cols-2"
    : cards.length === 3
      ? "grid-cols-1 md:grid-cols-3"
      : cards.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1";

  return (
    <div
      data-pitch-card-grid
      data-pitch-card-grid-ideas={hasIdeas ? "true" : undefined}
      data-pitch-card-grid-fill={fill ? "true" : undefined}
      data-pitch-card-grid-2x2={is2x2 ? "true" : undefined}
      className={`mt-3 grid w-full gap-2.5 text-left sm:mt-4 sm:gap-3 ${colClass} ${
        fill ? "min-h-0 flex-1 auto-rows-fr grid-rows-2" : ""
      }`}
    >
      {cards.map((card) => (
        <article
          key={card.label}
          data-pitch-card
          className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-white/25 bg-black/55 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-4 md:p-5 ${
            fill ? "h-full min-h-0" : "h-full"
          }`}
        >
          <p className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[1.8px] text-cyan-200/90 sm:text-[11px]">
            {card.label}
          </p>
          {card.body && (
            <p
              className={`mt-1.5 shrink-0 whitespace-pre-line font-medium leading-snug text-white sm:mt-2 ${
                is2x2 && hasIdeas
                  ? "text-[clamp(0.78rem,0.28vw+0.72rem,0.98rem)] text-zinc-100"
                  : hasIdeas
                    ? "text-[clamp(0.92rem,0.35vw+0.82rem,1.1rem)] text-zinc-100"
                    : "text-[clamp(0.95rem,0.4vw+0.85rem,1.15rem)]"
              }`}
            >
              {card.body}
            </p>
          )}
          {card.image ? (
            <div
              data-pitch-card-image
              className="mt-2.5 shrink-0 overflow-hidden rounded border border-white/15 bg-black/40 sm:mt-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- pitch deck public assets */}
              <img
                src={card.image}
                alt={card.imageAlt ?? card.label}
                className="mx-auto h-20 w-full max-h-24 object-cover object-center sm:h-24 sm:max-h-28"
              />
            </div>
          ) : null}
          {card.ideas && card.ideas.length > 0 ? (
            <div
              data-pitch-idea-list
              className={`mt-2 flex min-h-0 flex-col gap-2 sm:mt-2.5 sm:gap-2.5 ${fill ? "flex-1" : ""}`}
            >
              {card.ideas.map((idea) => (
                <div
                  key={`${card.label}-${idea.title}`}
                  data-pitch-idea
                  className={`min-h-0 overflow-hidden rounded-md border border-white/15 bg-white/[0.05] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-3 sm:py-2.5 ${
                    fill ? "flex flex-1 flex-col" : ""
                  }`}
                >
                  <div className="flex min-h-0 gap-2">
                    <IdeaIcon />
                    <div className="min-w-0 min-h-0 flex-1 overflow-hidden">
                      <p
                        className={`text-left font-semibold leading-snug text-white ${
                          is2x2
                            ? "text-[clamp(0.82rem,0.28vw+0.75rem,1rem)]"
                            : "text-[clamp(0.95rem,0.4vw+0.85rem,1.12rem)]"
                        }`}
                      >
                        {idea.title}
                      </p>
                      <p
                        className={`mt-1 text-left leading-snug text-zinc-200 ${
                          is2x2
                            ? "text-[clamp(0.75rem,0.25vw+0.7rem,0.95rem)]"
                            : "text-[clamp(0.88rem,0.32vw+0.78rem,1.05rem)]"
                        }`}
                      >
                        {idea.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function SlideFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}

/**
 * Sequential single-column sections for former split left/right content.
 * Preserves every label and item string without side-by-side text columns.
 */
function StackedSections({
  columns,
}: {
  columns: Array<{ label: string; items: string[] } | undefined>;
}) {
  return (
    <div data-pitch-stacked-sections className="mt-5 flex w-full flex-col gap-5 text-left sm:mt-6 sm:gap-6">
      {columns.map(
        (column) =>
          column && (
            <section
              key={column.label}
              data-pitch-content-panel
              className="w-full rounded-md border border-white/10 bg-black/40 p-4 text-left sm:p-5"
            >
              <p className={SECTION_LABEL}>{column.label}</p>
              <ul className="flex flex-col gap-3 text-left">
                {column.items.map((item, itemIndex) => (
                  <li key={`${column.label}-${itemIndex}-${item}`} className={`flex gap-3 ${BODY}`}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}

function SlideContent({ slide }: { slide: SalesSlide }) {
  if (slide.layout === "title") {
    // Section title beats: true center both axes (dedicated shell, not ContentPanel overrides).
    return (
      <SlideFrame>
        <div
          data-pitch-content-panel
          data-pitch-title-centered
          className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/50 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-6 md:p-7 lg:p-8"
        >
          <div
            data-pitch-title-inner
            className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-0 text-center"
          >
            {slide.kicker && (
              <p className="mb-4 inline-block rounded-sm border border-zinc-600/80 bg-black/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[2px] text-zinc-300 sm:mb-5 sm:text-[11px]">
                {slide.kicker}
              </p>
            )}
            {slide.image && (
              <div className="mb-6 shrink-0 sm:mb-8" data-pitch-title-logo>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt={slide.imageAlt ?? "Uncertain Systems"}
                  className="mx-auto h-auto w-[min(100%,5.5rem)] rounded-md border border-white/15 object-contain shadow-lg shadow-black/40 sm:w-[min(100%,6.5rem)]"
                />
              </div>
            )}
            <h1
              className="max-w-4xl text-center text-[clamp(1.85rem,2.8vw+0.85rem,3.5rem)] font-medium leading-[1.12] tracking-[-0.04em] text-white"
              data-pitch-title-heading
            >
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className="mt-3 max-w-2xl text-center text-[clamp(1.05rem,0.7vw+0.85rem,1.4rem)] leading-snug text-zinc-200">
                {slide.subtitle}
              </p>
            )}
            {slide.cards && slide.cards.length > 0 && (
              <div className="mt-5 w-full">
                <CardGrid cards={slide.cards} />
              </div>
            )}
          </div>
        </div>
      </SlideFrame>
    );
  }

  if (slide.layout === "founder") {
    return (
      <SlideFrame>
        <ContentPanel>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          {/* Single-column: portrait above, copy below — no side-by-side text columns */}
          <div className="flex w-full flex-col items-start gap-4 text-left sm:gap-5">
            {slide.image && (
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt={slide.imageAlt ?? slide.title}
                  className="aspect-square h-auto w-[min(100%,180px)] rounded-sm border border-white/15 object-cover shadow-xl shadow-black/40 sm:w-[min(100%,200px)]"
                />
              </div>
            )}
            <div className="min-w-0 w-full text-left">
              <h2 className={TITLE_H2}>{slide.title}</h2>
              {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
              {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
            </div>
          </div>
        </ContentPanel>
      </SlideFrame>
    );
  }

  if (slide.layout === "fullImage") {
    // Full-stage image — no side copy; fills the available slide viewport.
    return (
      <SlideFrame>
        <figure
          data-pitch-full-image
          className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md border border-white/10 bg-black/55 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md"
        >
          {slide.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-pitch-full-image-asset
              src={slide.image}
              alt={slide.imageAlt ?? slide.title}
              className="h-full w-full object-contain object-center bg-black/30"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-mono text-sm uppercase tracking-[2px] text-zinc-500"
              aria-label={slide.imageCaption ?? slide.title}
            >
              Image missing
            </div>
          )}
          {slide.imageCaption && (
            <figcaption className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/55 px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-200 backdrop-blur-sm sm:text-[11px]">
              {slide.imageCaption}
            </figcaption>
          )}
        </figure>
      </SlideFrame>
    );
  }

  if (slide.layout === "media") {
    // Always reserve the right column for media layout (real art/video or empty slot for later).
    const hasMedia = Boolean(slide.video || slide.image);
    const isPlaceholder = !hasMedia;
    const isVideo = Boolean(slide.video);
    // Video column as large as possible while keeping a readable text min width (~18rem).
    const mediaStageCols = isVideo
      ? "md:grid-cols-[minmax(18rem,0.85fr)_minmax(16rem,1.25fr)] md:gap-5 lg:gap-6"
      : "md:grid-cols-[minmax(0,1fr)_minmax(0,min(42%,26rem))] md:gap-6 lg:gap-8";

    return (
      <SlideFrame>
        {/*
          Video media: panel stays overflow-hidden so the stage never scrolls; video sits
          sticky on the right with an inline height so it cannot collapse to 0.
        */}
        <ContentPanel className={isVideo ? "!overflow-hidden" : undefined}>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h2 className={TITLE_H2}>{slide.title}</h2>
          {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
          {/*
            Media layout exception (Karpathy / Omega Quest / product pitch): side-by-side stage.
            Title/subtitle full-width; then copy | image/video-or-placeholder on md+ (no float stack).
          */}
          <div
            data-pitch-media-stage
            data-pitch-media-float
            data-pitch-media-video-stage={isVideo ? "true" : undefined}
            className={`mt-4 grid w-full min-h-0 flex-1 grid-cols-1 items-start gap-4 text-left md:mt-5 ${mediaStageCols}`}
          >
            {/*
              Zero first-child top margin so cards/highlights align with the media figure
              (CardGrid/HighlightCallouts default mt-* is for below titles, not side columns).
            */}
            <div className="min-h-0 min-w-0 order-2 overflow-y-auto md:order-1 [&>*:first-child]:!mt-0">
              {slide.cards && slide.cards.length > 0 && <CardGrid cards={slide.cards} />}
              {slide.highlights && slide.highlights.length > 0 && (
                <HighlightCallouts items={slide.highlights} labels={slide.highlightLabels} />
              )}
              {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
            </div>
            <figure
              data-pitch-media-figure
              data-pitch-image-placeholder={isPlaceholder ? "true" : undefined}
              className={
                isVideo
                  ? "order-1 min-w-0 w-full shrink-0 overflow-hidden rounded-sm border-0 bg-black shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:order-2 md:sticky md:top-0"
                  : "order-1 min-w-0 w-full overflow-hidden rounded-sm border border-white/15 bg-black/40 shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:order-2 md:sticky md:top-0"
              }
            >
              {slide.video ? (
                <PitchMediaVideo
                  src={slide.video}
                  label={slide.imageAlt ?? slide.imageCaption ?? slide.title}
                />
              ) : slide.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.image}
                  alt={slide.imageAlt ?? slide.title}
                  className="max-h-[22vh] w-full object-contain object-top bg-transparent md:max-h-[min(42vh,360px)]"
                />
              ) : (
                <div
                  data-pitch-image-placeholder-slot
                  className="flex min-h-[22vh] w-full flex-col items-center justify-center gap-2 border border-dashed border-white/20 bg-black/30 px-4 py-8 md:min-h-[min(36vh,280px)]"
                  aria-label={slide.imageCaption ?? "Image placeholder"}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                    Image placeholder
                  </span>
                  {slide.imageCaption && (
                    <span className="max-w-[16rem] text-center text-sm text-zinc-400">
                      {slide.imageCaption}
                    </span>
                  )}
                </div>
              )}
              {hasMedia && slide.imageCaption && (
                <figcaption className="border-t border-white/10 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-300 sm:text-[11px]">
                  {slide.imageCaption}
                </figcaption>
              )}
            </figure>
          </div>
        </ContentPanel>
      </SlideFrame>
    );
  }

  if (slide.layout === "statement") {
    // Single-product idea slides (one card with nested ideas) must fit without scroll.
    const isSingleProductIdeas =
      slide.cards?.length === 1 && (slide.cards[0]?.ideas?.length ?? 0) > 0;
    // Product stack cards with examples (3 or 4) — fill the stage; 4 → 2×2, no bullets.
    const isProductsStack =
      (slide.cards?.length === 3 || slide.cards?.length === 4) &&
      slide.cards.every((c) => (c.ideas?.length ?? 0) >= 1);
    const isProducts2x2 = isProductsStack && slide.cards?.length === 4;

    return (
      <SlideFrame>
        <ContentPanel
          className={
            isSingleProductIdeas || isProductsStack
              ? "!overflow-hidden"
              : undefined
          }
        >
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h2 className={isProducts2x2 ? TITLE_H2_COMPACT : TITLE_H2}>{slide.title}</h2>
          {slide.subtitle && (
            <p className={isProducts2x2 ? SUBTITLE_COMPACT : SUBTITLE}>{slide.subtitle}</p>
          )}
          {/* Lead-in / callouts sit above concept boxes when both are present. */}
          {slide.highlights && slide.highlights.length > 0 && (
            <HighlightCallouts items={slide.highlights} labels={slide.highlightLabels} />
          )}
          {slide.cards && slide.cards.length > 0 && (
            <CardGrid
              cards={slide.cards}
              fill={isProductsStack}
              twoByTwo={isProducts2x2}
            />
          )}
          {/* Products 2×2 keeps all copy inside cards — never bullets under the grid. */}
          {!isProducts2x2 && slide.bullets && slide.bullets.length > 0 && (
            <BulletList items={slide.bullets} />
          )}
        </ContentPanel>
      </SlideFrame>
    );
  }

  if (slide.layout === "bullets") {
    return (
      <SlideFrame>
        <ContentPanel>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h2 className={TITLE_H2}>{slide.title}</h2>
          {slide.cards && slide.cards.length > 0 && <CardGrid cards={slide.cards} />}
          {slide.highlights && slide.highlights.length > 0 && (
            <HighlightCallouts items={slide.highlights} labels={slide.highlightLabels} />
          )}
          {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
        </ContentPanel>
      </SlideFrame>
    );
  }

  if (slide.layout === "split") {
    return (
      <SlideFrame>
        <ContentPanel>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h2 className={TITLE_H2}>{slide.title}</h2>
          <StackedSections columns={[slide.left, slide.right]} />
        </ContentPanel>
      </SlideFrame>
    );
  }

  // close (and any unknown layout fallback)
  return (
    <SlideFrame>
      <ContentPanel>
        {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
        <h2 className={TITLE_H2}>{slide.title}</h2>
        {slide.bullets && slide.bullets.length > 0 && (
          <BulletList items={slide.bullets} variant="number" />
        )}
        {slide.footnote && (
          <p className="mt-5 w-full border-t border-white/10 pt-4 text-left font-mono text-[clamp(0.8rem,0.25vw+0.7rem,0.95rem)] leading-snug tracking-[0.6px] text-zinc-300">
            {slide.footnote}
          </p>
        )}
      </ContentPanel>
    </SlideFrame>
  );
}

export function SalesSlideDeck({ deck }: SalesSlideDeckProps) {
  const [index, setIndex] = useState(0);
  const total = deck.slides.length;
  const slide = deck.slides[index];
  const progress = ((index + 1) / total) * 100;
  const backgroundImage = slide?.backgroundImage ?? deck.backgroundImage;

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => Math.min(total - 1, Math.max(0, current + delta)));
    },
    [total],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        setIndex(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setIndex(total - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, total]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-pitch-deck={deck.vertical}
      data-pitch-label={deck.label}
      data-pitch-no-scroll
      data-pitch-layout="single-column"
    >
      <div className="pointer-events-none absolute inset-0 bg-[#0a0a0a]" />
      {backgroundImage && (
        <div
          key={backgroundImage}
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-100 transition-opacity duration-500"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          data-pitch-aesthetic-bg
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[#0a0a0a]/30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.1),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(0,0,0,0.18),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 py-2.5 md:px-6 md:py-3">
        <div className="rounded-sm border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-300 backdrop-blur-sm md:text-[11px]">
          uncertain<span className="text-zinc-100">.systems</span>
          <span className="mx-2 text-zinc-500">·</span>
          <span className="text-zinc-200">{deck.label}</span>
        </div>
        <div className="rounded-sm border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-xs tabular-nums text-zinc-300 backdrop-blur-sm md:text-sm">
          {index + 1} / {total}
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1 md:px-8 md:pb-3 md:pt-2 lg:px-10">
        <div key={index} className="sales-slide-enter flex min-h-0 w-full flex-1 overflow-hidden">
          {slide && <SlideContent slide={slide} />}
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-4 pb-2.5 pt-1 md:px-6 md:pb-3">
        <div className="mb-2 h-0.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-zinc-100/90 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="hidden rounded-sm bg-black/45 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.4px] text-zinc-400 backdrop-blur-sm sm:block">
            For live presentation
          </p>
          <p className="font-mono text-[10px] tracking-[1px] text-zinc-400 sm:hidden">
            ← → · Space
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              className="rounded-sm border border-white/15 bg-black/50 px-3 py-1 text-xs text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-30"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === total - 1}
              className="rounded-sm border border-white/20 bg-black/55 px-3 py-1 text-xs text-zinc-50 transition hover:border-white/40 hover:text-white disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
