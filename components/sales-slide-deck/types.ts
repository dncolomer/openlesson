import type { SalesSlide } from "@/lib/sales/solution-slide-decks";

export type SlideRendererProps = {
  slide: SalesSlide;
  deckSlides?: SalesSlide[];
  onGoToSlide?: (slideIndex: number) => void;
};
