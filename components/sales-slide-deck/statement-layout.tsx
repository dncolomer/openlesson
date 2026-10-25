import { PitchCardGrid } from "@/components/sales-slide-deck/pitch-card-grid";
import {
  BulletList,
  ContentPanel,
  Eyebrow,
  HighlightCallouts,
  SlideFrame,
  SUBTITLE,
  SUBTITLE_COMPACT,
  TITLE_H2,
  TITLE_H2_COMPACT,
} from "@/components/sales-slide-deck/slide-primitives";
import type { SlideRendererProps } from "@/components/sales-slide-deck/types";

export function StatementLayout({
  slide,
  deckSlides = [],
  onGoToSlide,
}: SlideRendererProps) {
  // Single-product idea slides (one card with nested ideas) must fit without scroll.
  const isSingleProductIdeas =
    slide.cards?.length === 1 && (slide.cards[0]?.ideas?.length ?? 0) > 0;
  // Layer stack (TAP → Stash → PoW) or legacy 2×2 idea cards — fill the stage.
  const isProductLayerStack = slide.cardLayout === "product-stack";
  const isProductsStack =
    isProductLayerStack ||
    ((slide.cards?.length === 3 || slide.cards?.length === 4) &&
      slide.cards.every((c) => (c.ideas?.length ?? 0) >= 1));
  const isProducts2x2 =
    !isProductLayerStack && isProductsStack && slide.cards?.length === 4;
  const isProductsDense = isProductLayerStack || isProducts2x2;

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
        <h2 className={isProductsDense ? TITLE_H2_COMPACT : TITLE_H2}>{slide.title}</h2>
        {slide.subtitle && (
          <p className={isProductsDense ? SUBTITLE_COMPACT : SUBTITLE}>{slide.subtitle}</p>
        )}
        {/* Lead-in / callouts sit above concept boxes when both are present. */}
        {slide.highlights && slide.highlights.length > 0 && (
          <HighlightCallouts
            items={slide.highlights}
            labels={slide.highlightLabels}
            images={slide.highlightImages}
            imageAlts={slide.highlightImageAlts}
            imageSources={slide.highlightImageSources}
          />
        )}
        {slide.cards && slide.cards.length > 0 && (
          <PitchCardGrid
            cards={slide.cards}
            fill={isProductsStack}
            twoByTwo={isProducts2x2}
            productStack={isProductLayerStack}
            deckSlides={deckSlides}
            onGoToSlide={onGoToSlide}
          />
        )}
        {/* Product stacks keep all copy inside cards — never bullets under the grid. */}
        {!isProductsDense && slide.bullets && slide.bullets.length > 0 && (
          <BulletList items={slide.bullets} />
        )}
      </ContentPanel>
    </SlideFrame>
  );
}
