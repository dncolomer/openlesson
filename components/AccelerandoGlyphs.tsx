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

/** Compact token-language mark for a command or Concept: first glyph only. */
export function AccelerandoMark({
  text,
  className,
  mark,
}: {
  text: string;
  className?: string;
  mark?: string;
}) {
  const id = accelerandoIds(text)?.[0];
  if (id == null) return null;
  const d = accelerandoPath(id);
  if (!d) return null;
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
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.12}
          strokeLinecap="square"
        />
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
