import { PitchCardGrid } from "@/components/sales-slide-deck/pitch-card-grid";
import { SlideFrame } from "@/components/sales-slide-deck/slide-primitives";
import type { SlideRendererProps } from "@/components/sales-slide-deck/types";

export function TitleLayout({
  slide,
  deckSlides = [],
  onGoToSlide,
}: SlideRendererProps) {
  // Section title beats: true center both axes (dedicated shell, not ContentPanel overrides).
  return (
    <SlideFrame>
      <div
        data-pitch-content-panel
        data-pitch-title-centered
        className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-none border border-white/10 bg-black/50 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-6 md:p-7 lg:p-8"
      >
        <div
          data-pitch-title-inner
          className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-0 text-center"
        >
          {slide.kicker && (
            <p className="mb-4 inline-block rounded-none border border-zinc-600/80 bg-black/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[2px] text-zinc-300 sm:mb-5 sm:text-[11px]">
              {slide.kicker}
            </p>
          )}
          {slide.image && (
            <div className="mb-6 shrink-0 sm:mb-8" data-pitch-title-logo>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt={slide.imageAlt ?? "Uncertain Systems"}
                className="mx-auto h-auto w-[min(100%,5.5rem)] rounded-none border border-white/15 object-contain shadow-lg shadow-black/40 sm:w-[min(100%,6.5rem)]"
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
              <PitchCardGrid
                cards={slide.cards}
                deckSlides={deckSlides}
                onGoToSlide={onGoToSlide}
              />
            </div>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}
