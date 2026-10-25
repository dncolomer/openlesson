import {
  BulletList,
  ContentPanel,
  Eyebrow,
  SlideFrame,
  TITLE_H2,
  type SlideRendererProps,
} from "@/components/sales-slide-deck/slide-primitives";

export function CloseLayout({ slide }: SlideRendererProps) {
  return (
    <SlideFrame>
      <ContentPanel>
        {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
        <h2 className={TITLE_H2}>{slide.title}</h2>
        {slide.bullets && slide.bullets.length > 0 && (
          <BulletList items={slide.bullets} variant="number" />
        )}
        {slide.footnote && (
          <p className="mt-5 w-full border-t border-white/10 pt-4 text-left font-mono text-[clamp(0.8rem,0.25vw+0.7rem,0.95rem)] leading-snug tracking-[0.6px] text-zinc-300">
            {slide.footnote}
          </p>
        )}
      </ContentPanel>
    </SlideFrame>
  );
}
