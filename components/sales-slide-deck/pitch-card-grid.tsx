import type { SalesSlide } from "@/lib/sales/solution-slide-decks";

type PitchCard = {
  label: string;
  body?: string;
  ideas?: Array<{ title: string; body: string }>;
  image?: string;
  imageAlt?: string;
};

function IdeaIcon() {
  return (
    <span
      data-pitch-idea-icon
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-white/40 bg-black text-white"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.5 18h5M10 21h4M8.2 15.2A5.8 5.8 0 1 1 15.8 15.2c-.7.9-1.3 1.7-1.6 2.8H9.8c-.3-1.1-.9-1.9-1.6-2.8Z"
        />
      </svg>
    </span>
  );
}

/** Find fullImage zoom slide that shows the same asset as a card thumbnail. */
function resolveFullImageSlideForAsset(
  image: string | undefined,
  deckSlides: SalesSlide[],
): number | null {
  if (!image) return null;
  const idx = deckSlides.findIndex(
    (s) => s.layout === "fullImage" && s.image === image,
  );
  return idx >= 0 ? idx : null;
}

function PitchCardArticle({
  card,
  fill = false,
  compactBody = false,
  imageGoToSlide = null,
  onGoToSlide,
}: {
  card: PitchCard;
  fill?: boolean;
  /** Smaller body type when cards sit in a dense multi-cell grid. */
  compactBody?: boolean;
  /** When set, the card thumbnail jumps to this deck slide index (zoomed fullImage). */
  imageGoToSlide?: number | null;
  onGoToSlide?: (slideIndex: number) => void;
}) {
  const hasIdeas = (card.ideas?.length ?? 0) > 0;
  const imageClickable =
    typeof imageGoToSlide === "number" &&
    imageGoToSlide >= 0 &&
    typeof onGoToSlide === "function";

  const imageEl = card.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- pitch deck public assets
    <img
      src={card.image}
      alt={card.imageAlt ?? card.label}
      className="mx-auto h-auto w-full max-h-28 object-contain object-center sm:max-h-32"
    />
  ) : null;

  return (
    <article
      data-pitch-card
      className={`flex min-h-0 flex-col overflow-hidden rounded-none border border-white/25 bg-black/55 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-4 md:p-5 ${
        fill ? "h-full min-h-0" : "h-full"
      }`}
    >
      <p className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[1.8px] text-white/70 sm:text-[11px]">
        {card.label}
      </p>
      {card.body && (
        <p
          className={`mt-1.5 shrink-0 whitespace-pre-line font-medium leading-snug text-white sm:mt-2 ${
            compactBody && hasIdeas
              ? "text-[clamp(0.78rem,0.28vw+0.72rem,0.98rem)] text-zinc-100"
              : hasIdeas
                ? "text-[clamp(0.92rem,0.35vw+0.82rem,1.1rem)] text-zinc-100"
                : "text-[clamp(0.95rem,0.4vw+0.85rem,1.15rem)]"
          }`}
        >
          {card.body}
        </p>
      )}
      {card.image && imageEl ? (
        imageClickable ? (
          <button
            type="button"
            data-pitch-card-image
            data-pitch-card-image-link
            data-pitch-card-image-target={imageGoToSlide}
            onClick={() => onGoToSlide(imageGoToSlide)}
            aria-label={`Open larger view: ${card.imageAlt ?? card.label}`}
            className="mt-2.5 shrink-0 cursor-pointer overflow-hidden rounded border border-white/15 bg-black/40 text-left transition hover:border-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:mt-3"
          >
            {imageEl}
          </button>
        ) : (
          <div
            data-pitch-card-image
            className="mt-2.5 shrink-0 overflow-hidden rounded border border-white/15 bg-black/40 sm:mt-3"
          >
            {imageEl}
          </div>
        )
      ) : null}
      {card.ideas && card.ideas.length > 0 ? (
        <div
          data-pitch-idea-list
          className={`mt-2 flex min-h-0 flex-col gap-2 sm:mt-2.5 sm:gap-2.5 ${fill ? "flex-1" : ""}`}
        >
          {card.ideas.map((idea) => (
            <div
              key={`${card.label}-${idea.title}`}
              data-pitch-idea
              className={`min-h-0 overflow-hidden rounded-none border border-white/15 bg-white/[0.05] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-3 sm:py-2.5 ${
                fill ? "flex flex-1 flex-col" : ""
              }`}
            >
              <div className="flex min-h-0 gap-2">
                <IdeaIcon />
                <div className="min-w-0 min-h-0 flex-1 overflow-hidden">
                  <p
                    className={`text-left font-semibold leading-snug text-white ${
                      compactBody
                        ? "text-[clamp(0.82rem,0.28vw+0.75rem,1rem)]"
                        : "text-[clamp(0.95rem,0.4vw+0.85rem,1.12rem)]"
                    }`}
                  >
                    {idea.title}
                  </p>
                  <p
                    className={`mt-1 text-left leading-snug text-zinc-200 ${
                      compactBody
                        ? "text-[clamp(0.75rem,0.25vw+0.7rem,0.95rem)]"
                        : "text-[clamp(0.88rem,0.32vw+0.78rem,1.05rem)]"
                    }`}
                  >
                    {idea.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Equal framed boxes for pillars / synergy steps (e.g. three verticals, 2×2 products). */
export function PitchCardGrid({
  cards,
  fill = false,
  /** Force a 2×2 layout (products stack) instead of a 1×4 row. */
  twoByTwo = false,
  /**
   * Layer stack: one full-width row per card, top to bottom.
   * Expects cards ordered [TAP, Stash API, PoW API].
   */
  productStack = false,
  deckSlides = [],
  onGoToSlide,
}: {
  cards: PitchCard[];
  /** Stretch cards to fill remaining slide height (e.g. products stack). */
  fill?: boolean;
  twoByTwo?: boolean;
  productStack?: boolean;
  deckSlides?: SalesSlide[];
  onGoToSlide?: (slideIndex: number) => void;
}) {
  const hasIdeas = cards.some((card) => (card.ideas?.length ?? 0) > 0);

  const renderCard = (card: PitchCard, opts?: { compactBody?: boolean }) => (
    <PitchCardArticle
      key={card.label}
      card={card}
      fill={fill}
      compactBody={opts?.compactBody}
      imageGoToSlide={resolveFullImageSlideForAsset(card.image, deckSlides)}
      onGoToSlide={onGoToSlide}
    />
  );

  if (productStack && cards.length >= 3) {
    const rowName = (index: number) =>
      index === 0 ? "top" : index === cards.length - 1 ? "bottom" : "middle";
    return (
      <div
        data-pitch-card-grid
        data-pitch-card-grid-product-stack="true"
        data-pitch-card-grid-fill={fill ? "true" : undefined}
        className={`mt-3 flex w-full flex-col gap-2.5 text-left sm:mt-4 sm:gap-3 ${
          fill ? "min-h-0 flex-1" : ""
        }`}
      >
        {cards.map((card, index) => (
          <div
            key={card.label}
            data-pitch-card-stack-row={rowName(index)}
            className={fill ? "min-h-0 flex-1" : undefined}
          >
            {renderCard(card)}
          </div>
        ))}
      </div>
    );
  }

  const is2x2 = twoByTwo || cards.length === 4;
  const colClass = is2x2
    ? "grid-cols-2"
    : cards.length === 3
      ? "grid-cols-1 md:grid-cols-3"
      : cards.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1";

  return (
    <div
      data-pitch-card-grid
      data-pitch-card-grid-ideas={hasIdeas ? "true" : undefined}
      data-pitch-card-grid-fill={fill ? "true" : undefined}
      data-pitch-card-grid-2x2={is2x2 ? "true" : undefined}
      className={`mt-3 grid w-full gap-2.5 text-left sm:mt-4 sm:gap-3 ${colClass} ${
        fill ? "min-h-0 flex-1 auto-rows-fr grid-rows-2" : ""
      }`}
    >
      {cards.map((card) => renderCard(card, { compactBody: is2x2 }))}
    </div>
  );
}
