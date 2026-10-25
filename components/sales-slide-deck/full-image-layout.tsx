import type { SalesSlide } from "@/lib/sales/solution-slide-decks";
import {
  SlideFrame,
  type SlideRendererProps,
} from "@/components/sales-slide-deck/slide-primitives";

/** Find the statement (or other) slide that owns a card thumbnail for this zoom asset. */
function resolveBackSlideForFullImage(
  image: string | undefined,
  deckSlides: SalesSlide[],
): number | null {
  if (!image) return null;
  const idx = deckSlides.findIndex((s) =>
    (s.cards ?? []).some((c) => c.image === image),
  );
  return idx >= 0 ? idx : null;
}

export function FullImageLayout({
  slide,
  deckSlides = [],
  onGoToSlide,
}: SlideRendererProps) {
  // Full-stage image — no side copy; fills the available slide viewport.
  const backTarget = resolveBackSlideForFullImage(slide.image, deckSlides);
  const canGoBack =
    typeof backTarget === "number" &&
    backTarget >= 0 &&
    typeof onGoToSlide === "function";

  return (
    <SlideFrame>
      <figure
        data-pitch-full-image
        className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-none border border-white/10 bg-black/55 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-md"
      >
        {canGoBack ? (
          <button
            type="button"
            data-pitch-full-image-back
            data-pitch-full-image-back-target={backTarget}
            onClick={() => onGoToSlide(backTarget)}
            className="absolute left-3 top-3 z-10 rounded-none border border-white/20 bg-black/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[1.4px] text-zinc-100 shadow-lg backdrop-blur-sm transition hover:border-white/50 hover:bg-black/85 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:left-4 sm:top-4 sm:text-[11px]"
          >
            ← Back
          </button>
        ) : null}
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
