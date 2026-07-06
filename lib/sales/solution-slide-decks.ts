export type SalesSlide = {
  layout: "title" | "statement" | "bullets" | "split" | "close";
  kicker?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: { label: string; items: string[] };
  right?: { label: string; items: string[] };
  footnote?: string;
};

export type SolutionSlideDeck = {
  vertical: string;
  label: string;
  slides: SalesSlide[];
};