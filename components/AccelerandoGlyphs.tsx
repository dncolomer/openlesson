import { ACCELERANDO_FIELD_IDS, accelerandoIds, accelerandoPath } from "@/lib/accelerando";
import { cn } from "@/lib/utils";

function AccelerandoGlyph({
  id,
  index = 0,
}: {
  id: number;
  index?: number;
}) {
  const d = accelerandoPath(id);
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 2 2"
      className="accelerando-glyph"
      overflow="visible"
      focusable="false"
      style={{ ["--accelerando-i" as string]: index }}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="0.1" strokeLinecap="square" />
    </svg>
  );
}

function markCellTransform(count: number, index: number): { ox: number; oy: number; scale: number } {
  if (count <= 1) return { ox: 0, oy: 0, scale: 1 };
  const col = index % 2;
  const row = Math.floor(index / 2);
  const scale = 0.42;
  const stride = 1.04;
  const ox = 0.06 + col * stride;
  const oy = count === 2 ? 0.5 + 0.06 : 0.06 + row * stride;
  return { ox, oy, scale };
}

/** Real Accelerando encoding of a known label. Hidden from AT; English stays the copy. */
export function AccelerandoRun({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ids = accelerandoIds(text);
  if (!ids?.length) return null;
  return (
    <span data-accelerando-run={text} aria-hidden className={cn("accelerando-run", className)}>
      {ids.map((id, index) => (
        <AccelerandoGlyph key={`${id}-${index}`} id={id} index={index} />
      ))}
    </span>
  );
}

const MARK_LIMIT = 4;

/** Compact token-language mark for a command or Concept. English stays the readable label. */
export function AccelerandoMark({
  text,
  className,
  mark,
}: {
  text: string;
  className?: string;
  mark?: string;
}) {
  const ids = accelerandoIds(text)?.slice(0, MARK_LIMIT);
  if (!ids?.length) return null;
  return (
    <span
      data-accelerando-mark={text}
      {...(mark ? { "data-ile-command-mark": mark } : {})}
      aria-hidden
      className={cn("accelerando-mark relative size-[1.15rem]", className)}
    >
      <svg
        viewBox="-0.2 -0.2 2.4 2.4"
        width="100%"
        height="100%"
        overflow="hidden"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
        className="accelerando-mark-svg"
      >
        {ids.map((id, index) => {
          const d = accelerandoPath(id);
          if (!d) return null;
          const { ox, oy, scale } = markCellTransform(ids.length, index);
          return (
            <g key={`${id}-${index}`} transform={`translate(${ox} ${oy}) scale(${scale})`}>
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={scale === 1 ? 0.12 : 0.18}
                strokeLinecap="square"
              />
            </g>
          );
        })}
      </svg>
    </span>
  );
}

/** Sparse constellation for public console washes. */
export function AccelerandoField({ className }: { className?: string }) {
  return (
    <div data-accelerando-field="" aria-hidden className={cn("accelerando-field", className)}>
      {ACCELERANDO_FIELD_IDS.map((id, index) => (
        <AccelerandoGlyph key={`${id}-${index}`} id={id} index={index} />
      ))}
    </div>
  );
}
