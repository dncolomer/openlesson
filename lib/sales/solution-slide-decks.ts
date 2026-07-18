export type SalesSlideLayout =
  | "title"
  | "statement"
  | "bullets"
  | "split"
  | "close"
  | "founder"
  | "media";

export type SalesSlide = {
  layout: SalesSlideLayout;
  kicker?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  /**
   * Emphasized callout lines (e.g. science hypothesis + PoW proxy on thesis slides).
   * Rendered above regular bullets with stronger visual weight.
   */
  highlights?: string[];
  /** Optional short labels for each highlight (same order as highlights). */
  highlightLabels?: string[];
  /**
   * Framed pillar/vertical boxes (e.g. title slide: verification · optimization · augmentation).
   * Prefer 3 cards for a balanced grid on presentation widths.
   */
  cards?: Array<{ label: string; body: string }>;
  left?: { label: string; items: string[] };
  right?: { label: string; items: string[] };
  footnote?: string;
  /** Per-slide aesthetic background (public path). Falls back to deck.backgroundImage. */
  backgroundImage?: string;
  /** Portrait or media image for founder / media layouts */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  /**
   * When true (or when layout is media and image is absent), the media stage
   * always renders a right-side image slot the presenter can fill later.
   */
  imagePlaceholder?: boolean;
};

export type SolutionSlideDeck = {
  vertical: string;
  label: string;
  /** Default Greco-futurism / aesthetics background for the deck shell */
  backgroundImage?: string;
  slides: SalesSlide[];
};

/** Shared public assets used across pitch decks */
export const PITCH_ASSETS = {
  founder: "/founder.png",
  andrej: "/andrej.png",
  aesthetics: {
    title: "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
    problem: "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
    vision: "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
    science: "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
    products: "/aesthetics/Greco-futurism/HH_5mXdWsAAXax4.jpeg",
    verticals: "/aesthetics/Greco-futurism/HH_tnSba0AAGxOF.jpeg",
    founder: "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
    recognition: "/aesthetics/galactic-stoneworks/HH_oB2CbYAA_g2r.jpeg",
    close: "/aesthetics/Greco-futurism/HIBtZPpWcAACYTz.jpeg",
    verification: "/aesthetics/piotr-binkowski/HGGzQt4XwAAyUsf.jpeg",
    optimization: "/aesthetics/piotr-binkowski/HGDMJJrW4AA7PJn.jpeg",
    augmentation: "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
    useCase: "/aesthetics/piotr-binkowski/HGEyY6eXYAEG6n5.jpeg",
  },
} as const;
