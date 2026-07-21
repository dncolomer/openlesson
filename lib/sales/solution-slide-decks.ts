export type SalesSlideLayout =
  | "title"
  | "statement"
  | "bullets"
  | "split"
  | "close"
  | "founder"
  | "media"
  /** Full-stage image (no side copy) — e.g. product pitch config-space art. */
  | "fullImage";

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
   * Optional left-side image per highlight (same order as highlights; public path).
   * Sparse: omit or leave empty slots for highlights without media.
   */
  highlightImages?: (string | undefined)[];
  /** Optional alt text per highlight image (same order as highlightImages). */
  highlightImageAlts?: (string | undefined)[];
  /**
   * Optional small source credit per highlight (same order), e.g. "Source: flywire.ai".
   * Shown inside the callout near the image.
   */
  highlightImageSources?: (string | undefined)[];
  /**
   * Framed pillar/vertical boxes (e.g. title slide: verification · optimization · augmentation).
   * Prefer 3 cards for a balanced grid on presentation widths.
   * Optional `ideas` nest idea-boxes under the tool/column title (icon + title + body each).
   */
  cards?: Array<{
    label: string;
    /** Plain body when the card is a single block (legacy / simple pillars). */
    body?: string;
    /** Nested idea boxes under the column title (e.g. product pitch use-case slide). */
    ideas?: Array<{ title: string; body: string }>;
    /**
     * Optional small in-card thumbnail (public path). Rendered thumbnail-scale
     * inside the framed box — not full-stage media.
     */
    image?: string;
    imageAlt?: string;
  }>;
  left?: { label: string; items: string[] };
  right?: { label: string; items: string[] };
  footnote?: string;
  /** Per-slide aesthetic background (public path). Falls back to deck.backgroundImage. */
  backgroundImage?: string;
  /** Portrait, media, or fullImage asset path */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  /**
   * Optional media-stage video (public path). Preferred over image when set.
   * Rendered autoplay, muted, loop, playsInline for presentation decks.
   */
  video?: string;
  /**
   * When true (or when layout is media and image/video is absent), the media stage
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
  /** Favicon / brand mark (public/unsyslogo.jpeg). */
  logo: "/unsyslogo.jpeg",
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
