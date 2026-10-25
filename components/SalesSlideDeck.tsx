"use client";

import { useCallback, useEffect, useState } from "react";
import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import { BulletsLayout } from "@/components/sales-slide-deck/bullets-layout";
import { CloseLayout } from "@/components/sales-slide-deck/close-layout";
import { FounderLayout } from "@/components/sales-slide-deck/founder-layout";
import { FullImageLayout } from "@/components/sales-slide-deck/full-image-layout";
import { MediaLayout } from "@/components/sales-slide-deck/media-layout";
import { SplitLayout } from "@/components/sales-slide-deck/split-layout";
import { StatementLayout } from "@/components/sales-slide-deck/statement-layout";
import { TitleLayout } from "@/components/sales-slide-deck/title-layout";
import type { SlideRendererProps } from "@/components/sales-slide-deck/types";

export { PitchCardGrid } from "@/components/sales-slide-deck/pitch-card-grid";

type SalesSlideDeckProps = {
  deck: SolutionSlideDeck;
};

function SlideContent({
  slide,
  deckSlides = [],
  onGoToSlide,
}: SlideRendererProps) {
  if (slide.layout === "title") {
    return (
      <TitleLayout slide={slide} deckSlides={deckSlides} onGoToSlide={onGoToSlide} />
    );
  }

  if (slide.layout === "founder") {
    return <FounderLayout slide={slide} />;
  }

  if (slide.layout === "fullImage") {
    return (
      <FullImageLayout
        slide={slide}
        deckSlides={deckSlides}
        onGoToSlide={onGoToSlide}
      />
    );
  }

  if (slide.layout === "media") {
    return (
      <MediaLayout slide={slide} deckSlides={deckSlides} onGoToSlide={onGoToSlide} />
    );
  }

  if (slide.layout === "statement") {
    return (
      <StatementLayout
        slide={slide}
        deckSlides={deckSlides}
        onGoToSlide={onGoToSlide}
      />
    );
  }

  if (slide.layout === "bullets") {
    return (
      <BulletsLayout
        slide={slide}
        deckSlides={deckSlides}
        onGoToSlide={onGoToSlide}
      />
    );
  }

  if (slide.layout === "split") {
    return <SplitLayout slide={slide} />;
  }

  // close (and any unknown layout fallback)
  return <CloseLayout slide={slide} />;
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
      <PublicConsoleWash className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 py-2.5 md:px-6 md:py-3">
        <div className="rounded-none border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-300 backdrop-blur-sm md:text-[11px]">
          uncertain<span className="text-zinc-100">.systems</span>
          <span className="mx-2 text-zinc-500">·</span>
          <span className="text-zinc-200">{deck.label}</span>
        </div>
        <div className="rounded-none border border-white/10 bg-black/45 px-2.5 py-1 font-mono text-xs tabular-nums text-zinc-300 backdrop-blur-sm md:text-sm">
          {index + 1} / {total}
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1 md:px-8 md:pb-3 md:pt-2 lg:px-10">
        <div key={index} className="sales-slide-enter flex min-h-0 w-full flex-1 overflow-hidden">
          {slide && (
            <SlideContent
              slide={slide}
              deckSlides={deck.slides}
              onGoToSlide={(slideIndex) => setIndex(slideIndex)}
            />
          )}
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
          <p className="hidden rounded-none bg-black/45 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.4px] text-zinc-400 backdrop-blur-sm sm:block">
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
              className="rounded-none border border-white/15 bg-black/50 px-3 py-1 text-xs text-zinc-200 transition hover:border-white/30 hover:text-white disabled:opacity-30"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === total - 1}
              className="rounded-none border border-white/20 bg-black/55 px-3 py-1 text-xs text-zinc-50 transition hover:border-white/40 hover:text-white disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
