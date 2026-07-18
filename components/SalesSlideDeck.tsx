"use client";

import { useCallback, useEffect, useState } from "react";
import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";

type SalesSlideDeckProps = {
  deck: SolutionSlideDeck;
};

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
const SUBTITLE =
  "mt-3 w-full text-left text-[clamp(1.05rem,0.7vw+0.85rem,1.4rem)] leading-snug text-zinc-200";
const BODY =
  "text-left text-[clamp(1rem,0.45vw+0.88rem,1.25rem)] leading-snug text-zinc-50";
const SECTION_LABEL =
  "mb-3 self-start font-mono text-[11px] font-medium uppercase tracking-[1.6px] text-zinc-300 sm:text-xs";

function ContentPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-pitch-content-panel className={`${CONTENT_PANEL_CLASS} ${className}`.trim()}>
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

/** Equal framed boxes for pillars / synergy steps (e.g. three verticals, loop flow). */
function CardGrid({ cards }: { cards: Array<{ label: string; body: string }> }) {
  const colClass =
    cards.length >= 4
      ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      : cards.length === 3
        ? "grid-cols-1 md:grid-cols-3"
        : cards.length === 2
          ? "grid-cols-1 md:grid-cols-2"
          : "grid-cols-1";

  return (
    <div
      data-pitch-card-grid
      className={`mt-5 grid w-full gap-3 text-left sm:mt-6 sm:gap-4 ${colClass}`}
    >
      {cards.map((card) => (
        <article
          key={card.label}
          data-pitch-card
          className="flex h-full min-h-0 flex-col rounded-md border border-white/25 bg-black/55 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-5"
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[1.8px] text-cyan-200/90 sm:text-[11px]">
            {card.label}
          </p>
          <p className="mt-2.5 text-[clamp(0.95rem,0.4vw+0.85rem,1.15rem)] font-medium leading-snug text-white">
            {card.body}
          </p>
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
    return (
      <SlideFrame>
        <ContentPanel>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h1 className={TITLE_H1}>{slide.title}</h1>
          {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
          {slide.cards && slide.cards.length > 0 && <CardGrid cards={slide.cards} />}
        </ContentPanel>
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

  if (slide.layout === "media") {
    return (
      <SlideFrame>
        <ContentPanel>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h2 className={TITLE_H2}>{slide.title}</h2>
          {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
          {/*
            Media layout exception (Karpathy / Omega Quest): explicit side-by-side stage.
            Title/subtitle full-width; then copy | screenshot on md+ (no float stack).
          */}
          <div
            data-pitch-media-stage
            data-pitch-media-float
            className="mt-4 grid w-full min-h-0 grid-cols-1 items-start gap-4 text-left md:mt-5 md:grid-cols-[minmax(0,1fr)_minmax(0,min(42%,26rem))] md:gap-6 lg:gap-8"
          >
            <div className="min-w-0 order-2 md:order-1">
              {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
            </div>
            {slide.image && (
              <figure className="order-1 min-w-0 w-full overflow-hidden rounded-sm border border-white/15 bg-black/40 shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:order-2 md:sticky md:top-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt={slide.imageAlt ?? slide.title}
                  className="max-h-[22vh] w-full object-contain object-top bg-transparent md:max-h-[min(42vh,360px)]"
                />
                {slide.imageCaption && (
                  <figcaption className="border-t border-white/10 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-300 sm:text-[11px]">
                    {slide.imageCaption}
                  </figcaption>
                )}
              </figure>
            )}
          </div>
        </ContentPanel>
      </SlideFrame>
    );
  }

  if (slide.layout === "statement") {
    return (
      <SlideFrame>
        <ContentPanel>
          {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
          <h2 className={TITLE_H2}>{slide.title}</h2>
          {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
          {slide.cards && slide.cards.length > 0 && <CardGrid cards={slide.cards} />}
          {slide.highlights && slide.highlights.length > 0 && (
            <HighlightCallouts items={slide.highlights} labels={slide.highlightLabels} />
          )}
          {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
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
