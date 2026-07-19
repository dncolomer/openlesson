import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";

export type SlideFieldInventory = {
  index: number;
  layout: SalesSlide["layout"];
  title: string;
  kicker?: string;
  subtitle?: string;
  bulletCount: number;
  bullets: string[];
  leftLabel?: string;
  leftItems: string[];
  rightLabel?: string;
  rightItems: string[];
  footnote?: string;
  image?: string;
  imageCaption?: string;
  imagePlaceholder?: boolean;
  video?: string;
  allTextStrings: string[];
};

export type DeckInventory = {
  vertical: string;
  label: string;
  slideCount: number;
  slides: SlideFieldInventory[];
  allTextStrings: string[];
};

/** Walk every narrative field on a slide (shipped data; pure, no React). */
export function inventorySlide(slide: SalesSlide, index: number): SlideFieldInventory {
  const bullets = slide.bullets ?? [];
  const highlights = slide.highlights ?? [];
  const leftItems = slide.left?.items ?? [];
  const rightItems = slide.right?.items ?? [];
  const cardStrings = (slide.cards ?? []).flatMap((c) => [
    c.label,
    ...(c.body ? [c.body] : []),
    ...((c.ideas ?? []).flatMap((idea) => [idea.title, idea.body])),
  ]);
  const allTextStrings = [
    slide.kicker,
    slide.title,
    slide.subtitle,
    ...highlights,
    ...(slide.highlightLabels ?? []),
    ...cardStrings,
    ...bullets,
    slide.left?.label,
    ...leftItems,
    slide.right?.label,
    ...rightItems,
    slide.footnote,
    slide.imageCaption,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  return {
    index,
    layout: slide.layout,
    title: slide.title,
    kicker: slide.kicker,
    subtitle: slide.subtitle,
    bulletCount: bullets.length,
    bullets,
    leftLabel: slide.left?.label,
    leftItems,
    rightLabel: slide.right?.label,
    rightItems,
    footnote: slide.footnote,
    image: slide.image,
    imageCaption: slide.imageCaption,
    imagePlaceholder: slide.imagePlaceholder,
    video: slide.video,
    allTextStrings,
  };
}

export function inventoryDeck(deck: SolutionSlideDeck): DeckInventory {
  const slides = deck.slides.map((slide, index) => inventorySlide(slide, index));
  return {
    vertical: deck.vertical,
    label: deck.label,
    slideCount: deck.slides.length,
    slides,
    allTextStrings: slides.flatMap((s) => s.allTextStrings),
  };
}

/** Flatten every string that must remain visible after single-column conversion. */
export function collectPreservedItemStrings(deck: SolutionSlideDeck): string[] {
  const inv = inventoryDeck(deck);
  const items: string[] = [];
  for (const slide of inv.slides) {
    items.push(...slide.bullets, ...slide.leftItems, ...slide.rightItems);
  }
  return items;
}

export function assertNonEmptyTitles(deck: SolutionSlideDeck): void {
  for (const slide of deck.slides) {
    if (!slide.title?.trim()) {
      throw new Error(`Empty title on ${deck.vertical} slide layout=${slide.layout}`);
    }
  }
}
