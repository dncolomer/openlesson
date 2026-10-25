import {
  BODY,
  ContentPanel,
  Eyebrow,
  SECTION_LABEL,
  SlideFrame,
  TITLE_H2,
  type SlideRendererProps,
} from "@/components/sales-slide-deck/slide-primitives";

/**
 * Sequential single-column sections for former split left/right content.
 * Preserves every label and item string without side-by-side text columns.
 */
function StackedSections({
  columns,
}: {
  columns: Array<{ label: string; items: string[] } | undefined>;
}) {
  return (
    <div data-pitch-stacked-sections className="mt-5 flex w-full flex-col gap-5 text-left sm:mt-6 sm:gap-6">
      {columns.map(
        (column) =>
          column && (
            <section
              key={column.label}
              data-pitch-content-panel
              className="w-full rounded-none border border-white/10 bg-black/40 p-4 text-left sm:p-5"
            >
              <p className={SECTION_LABEL}>{column.label}</p>
              <ul className="flex flex-col gap-3 text-left">
                {column.items.map((item, itemIndex) => (
                  <li key={`${column.label}-${itemIndex}-${item}`} className={`flex gap-3 ${BODY}`}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}

export function SplitLayout({ slide }: SlideRendererProps) {
  return (
    <SlideFrame>
      <ContentPanel>
        {slide.kicker && <Eyebrow>{slide.kicker}</Eyebrow>}
        <h2 className={TITLE_H2}>{slide.title}</h2>
        <StackedSections columns={[slide.left, slide.right]} />
      </ContentPanel>
    </SlideFrame>
  );
}
