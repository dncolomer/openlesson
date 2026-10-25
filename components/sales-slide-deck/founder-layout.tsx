import {
  BulletList,
  ContentPanel,
  Eyebrow,
  SlideFrame,
  SUBTITLE,
  TITLE_H2,
  type SlideRendererProps,
} from "@/components/sales-slide-deck/slide-primitives";

export function FounderLayout({ slide }: SlideRendererProps) {
  return (
    <SlideFrame>
      <ContentPanel>
        {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
        {/* Single-column: portrait above, copy below — no side-by-side text columns */}
        <div className="flex w-full flex-col items-start gap-4 text-left sm:gap-5">
          {slide.image && (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt={slide.imageAlt ?? slide.title}
                className="aspect-square h-auto w-[min(100%,180px)] rounded-none border border-white/15 object-cover shadow-xl shadow-black/40 sm:w-[min(100%,200px)]"
              />
            </div>
          )}
          <div className="min-w-0 w-full text-left">
            <h2 className={TITLE_H2}>{slide.title}</h2>
            {slide.subtitle && <p className={SUBTITLE}>{slide.subtitle}</p>}
            {slide.bullets && slide.bullets.length > 0 && <BulletList items={slide.bullets} />}
          </div>
        </div>
      </ContentPanel>
    </SlideFrame>
  );
}
