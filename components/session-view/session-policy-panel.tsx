"use client";

import { SessionBranchField } from "@/components/session-view/session-branch-field";
import { useSessionBranchSlot } from "@/components/session-view/session-policy-context";
import {
  buildSessionBundle,
  foldWorkspacePolicy,
  sessionPressLine,
  type SessionMarkState,
} from "@/lib/session-marks";

const SECTION_LABEL =
  "font-mono text-[9px] uppercase tracking-[0.22em] text-white/45";

/**
 * Live policy for this Learn session: the frozen mistake list, the button
 * path, and the running close counts. Presses stay in memory for the session.
 */
export function SessionPolicyPanel({
  state,
  showPrices = true,
}: {
  state: SessionMarkState | null;
  showPrices?: boolean;
}) {
  const branchSlot = useSessionBranchSlot();
  const fieldReady = branchSlot?.status === "ready" && branchSlot.model != null;
  if (!state) {
    return (
      <>
        <SessionBranchField showPrices={showPrices} />
        <p
          data-session-policy-empty
          className="px-3 py-2 font-mono text-[11px] leading-snug text-white/70"
        >
          The policy appears once this session freezes its list.
        </p>
      </>
    );
  }

  const bundle = buildSessionBundle(state);
  const rows = foldWorkspacePolicy([{ bundle }]);
  const shownRows = fieldReady
    ? rows.filter((row) => row.cheapCloses > 0 || row.commitPasts > 0 || row.pressIds.length > 0)
    : rows;
  const textById = new Map(state.mistakes.map((row) => [row.id, row.text]));

  return (
    <div
      data-session-policy
      className="flex flex-col gap-3 px-3 py-2 font-mono text-[11px] leading-snug text-white"
    >
      <SessionBranchField showPrices={showPrices} />
      {fieldReady ? null : (
      <section data-session-policy-mistakes className="flex flex-col gap-1">
        <p className={SECTION_LABEL}>Mistakes</p>
        {state.mistakes.length === 0 ? (
          <p data-session-policy-mistakes-empty>No mistakes frozen yet.</p>
        ) : (
          state.mistakes.map((mistake) => (
            <p
              key={mistake.id}
              data-session-policy-mistake={mistake.id}
              data-session-policy-mistake-status={mistake.status}
            >
              <span className="text-white/50">
                {mistake.status === "open" ? "Open" : "Closed"}
              </span>{" "}
              {mistake.text}
            </p>
          ))
        )}
      </section>
      )}
      <section data-session-policy-path className="flex flex-col gap-1">
        <p className={SECTION_LABEL}>Button path</p>
        {state.presses.length === 0 ? (
          <p data-session-policy-path-empty>No presses yet.</p>
        ) : (
          state.presses.map((press) => {
            const aimed =
              textById.get(press.aimedMistakeId || "") ||
              textById.get(press.closedMistakeId || "") ||
              "";
            const slice = press.slice.trim();
            return (
              <p key={press.id} data-session-policy-press={press.id}>
                {sessionPressLine(press, aimed)}
                {slice ? (
                  <span
                    data-session-policy-slice={press.id}
                    className="mt-0.5 block text-white/55"
                  >
                    {slice}
                  </span>
                ) : null}
              </p>
            );
          })
        )}
      </section>
      <section data-session-policy-running className="flex flex-col gap-1">
        <p className={SECTION_LABEL}>So far</p>
        {shownRows.length === 0 ? (
          <p data-session-policy-running-empty>No closes yet.</p>
        ) : null}
        {shownRows.map((row) => (
          <p key={row.mistakeId} data-session-policy-row={row.mistakeId}>
            {row.text}. Closed: {row.cheapCloses}.
            {state.insightPressed
              ? ` Still open at the insight: ${row.commitPasts}.`
              : ""}
          </p>
        ))}
      </section>
    </div>
  );
}
