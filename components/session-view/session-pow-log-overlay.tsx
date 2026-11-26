"use client";

import { ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS } from "@/lib/learn-map-chrome";
import { formatSessionPowLogLine } from "@/lib/session-pow-log";
import { useSessionDeveloperHud } from "@/components/session-view/session-policy-context";

function clockLabel(at: number): string {
  return new Date(at).toLocaleTimeString("en-GB", { hour12: false });
}

/** Transparent classified PoW stream. Pointers pass through to the board. */
export function SessionPowLogOverlay() {
  const hud = useSessionDeveloperHud();
  if (!hud.enabled) return null;
  const newestFirst = hud.entries.slice().reverse();
  return (
    <div
      data-session-pow-log=""
      className={`pointer-events-none absolute right-2 top-2 ${ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS} max-h-[min(52vh,24rem)] max-w-[min(22rem,46vw)] overflow-hidden font-mono text-[10px] leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]`}
    >
      <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-white/45">PoW</div>
      {newestFirst.length ? (
        <ol className="flex flex-col gap-0.5">
          {newestFirst.map((entry) => (
            <li key={entry.id} data-session-pow-log-row={entry.action} className="min-w-0">
              <span className="text-white/40">{clockLabel(entry.at)}</span>
              <span className="text-white/90"> {formatSessionPowLogLine(entry)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p data-session-pow-log-empty="" className="text-white/40">
          waiting for work
        </p>
      )}
    </div>
  );
}
