"use client";

import { ileHuntAnswersPillLabel } from "@/lib/ile-hunt-answers-pill";

/**
 * ILE-only reminder next to the signed-in identity badge.
 * Not used on TAP identity rows.
 */
export function IleHuntAnswersPill({ className = "" }: { className?: string }) {
  const copy = ileHuntAnswersPillLabel();
  return (
    <div
      data-ile-hunt-answers-pill
      title={copy}
      className={`inline-flex items-center rounded-none border border-neutral-600 bg-white px-2.5 py-1 text-[10px] leading-snug text-neutral-900 ${className}`}
    >
      {copy}
    </div>
  );
}
