"use client";

/** Compact live cue for TAP practice — sits next to the signed-as identity pill. */
export function TapPracticePill({ label }: { label: string }) {
  return (
    <div
      data-tap-practice-pill
      title={label}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-500/35 bg-neutral-950/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-200/90"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
