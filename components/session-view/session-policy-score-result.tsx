import type { PolicyScore } from "@/lib/session-policy-score";

/** Two decimal places, without trailing zeros. */
export function formatPolicyScoreFigure(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/**
 * Verify results after End session or the clock.
 * Distance is the score the learner sees. Steps and excess sit under it.
 * The action ids stay off this screen.
 */
export function SessionPolicyScoreResult({ score }: { score: PolicyScore | null }) {
  if (!score) return null;
  return (
    <div
      data-session-policy-score=""
      className="mx-auto mt-8 w-full max-w-sm border border-white/45 bg-black text-left"
    >
      <div className="flex items-center gap-2 border-b border-white/30 px-3 py-1">
        <span aria-hidden className="font-mono text-[9px] tracking-[0.28em] text-white/45">
          01
        </span>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
          Score
        </p>
      </div>
      <p
        data-session-policy-distance={score.distance}
        className="px-3 pt-3 font-mono text-3xl tabular-nums text-white"
      >
        {formatPolicyScoreFigure(score.distance)}
      </p>
      <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">
        Distance
      </p>
      <dl className="grid grid-cols-2 border-t border-white/20">
        <div className="px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">Steps</dt>
          <dd data-session-policy-steps={score.steps} className="font-mono text-sm tabular-nums text-white">
            {formatPolicyScoreFigure(score.steps)}
          </dd>
        </div>
        <div className="border-l border-white/20 px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">Excess</dt>
          <dd data-session-policy-excess={score.excess} className="font-mono text-sm tabular-nums text-white">
            {formatPolicyScoreFigure(score.excess)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
