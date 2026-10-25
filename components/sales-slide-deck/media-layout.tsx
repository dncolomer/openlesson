"use client";

import { useEffect, useRef } from "react";
import { PitchCardGrid } from "@/components/sales-slide-deck/pitch-card-grid";
import {
  BulletList,
  ContentPanel,
  Eyebrow,
  HighlightCallouts,
  SlideFrame,
  SUBTITLE,
  TITLE_H2,
  type SlideRendererProps,
} from "@/components/sales-slide-deck/slide-primitives";

/**
 * Pitch media video: full frame (no zoom/crop), muted autoplay.
 * object-contain shows the whole clip; column width drives size, max-height caps stage scroll.
 */
function PitchMediaVideo({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    const tryPlay = () => {
      void el.play().catch(() => {
        /* Autoplay blocked — still show first frame */
      });
    };
    tryPlay();
    el.addEventListener("loadeddata", tryPlay);
    return () => el.removeEventListener("loadeddata", tryPlay);
  }, [src]);

  return (
    <div data-pitch-media-video-frame className="relative w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        data-pitch-media-video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-label={label}
        className="pointer-events-none block h-auto w-full max-h-[min(52vh,28rem)] object-contain object-center bg-black"
      />
    </div>
  );
}

export function MediaLayout({
  slide,
  deckSlides = [],
  onGoToSlide,
}: SlideRendererProps) {
  // Always reserve the right column for media layout (real art/video or empty slot for later).
  const hasMedia = Boolean(slide.video || slide.image);
  const isPlaceholder = !hasMedia;
  const isVideo = Boolean(slide.video);
  // Video column as large as possible while keeping a readable text min width (~18rem).
  const mediaStageCols = isVideo
    ? "md:grid-cols-[minmax(18rem,0.85fr)_minmax(16rem,1.25fr)] md:gap-5 lg:gap-6"
    : "md:grid-cols-[minmax(0,1fr)_minmax(0,min(42%,26rem))] md:gap-6 lg:gap-8";

  return (
    <SlideFrame>
      {/*
        Video media: panel stays overflow-hidden so the stage never scrolls; video sits
        sticky on the right with an inline height so it cannot collapse to 0.
      */}
      <ContentPanel className={isVideo ? "!overflow-hidden" : undefined}>
        {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
        <h2 className={TITLE_H2}>{slide.title}</h2>
        {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
        {/*
          Media layout exception (Karpathy / Omega Quest / product pitch): side-by-side stage.
          Title/subtitle full-width; then copy | image/video-or-placeholder on md+ (no float stack).
        */}
        <div
          data-pitch-media-stage
          data-pitch-media-float
          data-pitch-media-video-stage={isVideo ? "true" : undefined}
          className={`mt-4 grid w-full min-h-0 flex-1 grid-cols-1 items-start gap-4 text-left md:mt-5 ${mediaStageCols}`}
        >
          {/*
            Zero first-child top margin so cards/highlights align with the media figure
            (CardGrid/HighlightCallouts default mt-* is for below titles, not side columns).
          */}
          <div className="min-h-0 min-w-0 order-2 overflow-y-auto md:order-1 [&>*:first-child]:!mt-0">
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
            {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
          </div>
          <figure
            data-pitch-media-figure
            data-pitch-image-placeholder={isPlaceholder ? "true" : undefined}
            className={
              isVideo
                ? "order-1 min-w-0 w-full shrink-0 overflow-hidden rounded-none border-0 bg-black shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:order-2 md:sticky md:top-0"
                : "order-1 min-w-0 w-full overflow-hidden rounded-none border border-white/15 bg-black/40 shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:order-2 md:sticky md:top-0"
            }
          >
            {slide.video ? (
              <PitchMediaVideo
                src={slide.video}
                label={slide.imageAlt ?? slide.imageCaption ?? slide.title}
              />
            ) : slide.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.image}
                alt={slide.imageAlt ?? slide.title}
                className="max-h-[22vh] w-full object-contain object-top bg-transparent md:max-h-[min(42vh,360px)]"
              />
            ) : (
              <div
                data-pitch-image-placeholder-slot
                className="flex min-h-[22vh] w-full flex-col items-center justify-center gap-2 border border-dashed border-white/20 bg-black/30 px-4 py-8 md:min-h-[min(36vh,280px)]"
                aria-label={slide.imageCaption ?? "Image placeholder"}
              >
                <span className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  Image placeholder
                </span>
                {slide.imageCaption && (
                  <span className="max-w-[16rem] text-center text-sm text-zinc-400">
                    {slide.imageCaption}
                  </span>
                )}
              </div>
            )}
            {hasMedia && slide.imageCaption && (
              <figcaption className="border-t border-white/10 px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[1.6px] text-zinc-300 sm:text-[11px]">
                {slide.imageCaption}
              </figcaption>
            )}
          </figure>
        </div>
      </ContentPanel>
    </SlideFrame>
  );
}
