import type { DemoVerificationPill } from "@/lib/evidence-api-demo/verification-pills";

const PILL_STYLES: Record<DemoVerificationPill, string> = {
  "Evidence API": "border-zinc-700 bg-black/40 text-zinc-300",
  TAP: "border-violet-500/35 bg-violet-950/35 text-violet-200",
  ILE: "border-emerald-500/35 bg-emerald-950/35 text-emerald-200",
};

export function DemoVerificationPills({
  pills,
  className = "",
}: {
  pills: DemoVerificationPill[];
  className?: string;
}) {
  if (pills.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {pills.map((pill) => (
        <span
          key={pill}
          className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${PILL_STYLES[pill]}`}
        >
          {pill}
        </span>
      ))}
    </div>
  );
}