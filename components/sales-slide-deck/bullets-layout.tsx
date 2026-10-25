import type { SalesSlide } from "@/lib/sales/solution-slide-decks";
import { PitchCardGrid } from "@/components/sales-slide-deck/pitch-card-grid";
import {
  BulletList,
  ContentPanel,
  Eyebrow,
  HighlightCallouts,
  SlideFrame,
  TITLE_H2,
} from "@/components/sales-slide-deck/slide-primitives";
import type { SlideRendererProps } from "@/components/sales-slide-deck/types";

/** Resolve TOC (or any bullet) labels to slide indices by matching title slides. */
function resolveBulletSlideTargets(
  items: string[] | undefined,
  deckSlides: SalesSlide[],
): Array<number | null> {
  if (!items?.length) return [];
  return items.map((item) => {
    const idx = deckSlides.findIndex(
      (s) => s.layout === "title" && s.title.trim() === item.trim(),
    );
    return idx >= 0 ? idx : null;
  });
}

export function BulletsLayout({
  slide,
  deckSlides = [],
  onGoToSlide,
}: SlideRendererProps) {
  const tocTargets = resolveBulletSlideTargets(slide.bullets, deckSlides);
  const hasTocLinks = tocTargets.some((t) => t !== null);
  return (
    <SlideFrame>
      <ContentPanel>
        {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
        <h2 className={TITLE_H2}>{slide.title}</h2>
        {slide.cards && slide.cards.length > 0 && (
          <PitchCardGrid
            cards={slide.cards}
            deckSlides={deckSlides}
            onGoToSlide={onGoToSlide}
          />
        )}
        {slide.highlights && slide.highlights.length > 0 && (
          <HighlightCallouts
            items={slide.highlights}
            labels={slide.highlightLabels}
            images={slide.highlightImages}
            imageAlts={slide.highlightImageAlts}
            imageSources={slide.highlightImageSources}
          />
        )}
        {slide.bullets && slide.bullets.length > 0 && (
          <BulletList
            items={slide.bullets}
            itemTargets={hasTocLinks ? tocTargets : undefined}
            onGoToSlide={hasTocLinks ? onGoToSlide : undefined}
          />
        )}
      </ContentPanel>
    </SlideFrame>
  );
}
