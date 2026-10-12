import { ACCELERANDO_FIELD_IDS, accelerandoIds, accelerandoPath } from "@/lib/accelerando";
import { cn } from "@/lib/utils";

function AccelerandoGlyph({ id, index = 0 }: { id: number; index?: number }) {
  const d = accelerandoPath(id);
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 2 2"
      className="accelerando-glyph"
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
