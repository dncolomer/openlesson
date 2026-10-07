"use client";

import {
  useSessionBranchSlot,
  type SessionBranchSlot,
} from "@/components/session-view/session-policy-context";
import { sessionBranchFieldCounts, type SessionBranchModel } from "@/lib/session-branch-model";
import { SESSION_MARK_BUTTONS } from "@/lib/session-marks";

const LABEL = "font-mono text-[9px] uppercase tracking-[0.22em] text-white/45";

function statusLabel(status: string): string {
  if (status === "closed") return "Closed";
  if (status === "latent") return "Ahead";
  return "Open";
}

function priceLine(model: SessionBranchModel["branches"][number]): string {
  return model.actions
    .map((action) => {
      const label = SESSION_MARK_BUTTONS.find((button) => button.id === action.id)?.label ?? action.id;
      return `${label} ${action.price}`;
    })
    .join(" · ");
}

/** The whole prepared field. Idle and a missing provider render nothing. Prices are a Learn-only view. */
export function SessionBranchFieldView({
  slot,
  showPrices = true,
}: {
  slot: SessionBranchSlot | null;
  showPrices?: boolean;
}) {
  if (!slot || slot.status === "idle") return null;
  if (slot.status === "preparing") {
    return (
      <p
        data-session-branch-field
        data-session-branch-status="preparing"
        className="px-3 py-2 font-mono text-[11px] leading-snug text-white/70"
      >
        Preparing the field for this session.
      </p>
    );
  }
  if (slot.status === "failed" || !slot.model) {
    return (
      <p
        data-session-branch-field
        data-session-branch-status="failed"
        className="px-3 py-2 font-mono text-[11px] leading-snug text-white/70"
      >
        {slot.error || "The field could not be prepared."}
      </p>
    );
  }
  const model = slot.model;
  const counts = sessionBranchFieldCounts(model);
  return (
    <div
      data-session-branch-field
      data-session-branch-status="ready"
      className="flex flex-col gap-2 px-3 py-2 font-mono text-[11px] leading-snug text-white"
    >
      <p className={LABEL}>Field</p>
      <p data-session-branch-counts>
        {counts.total} branches. {counts.open} open. {counts.latent} ahead. {counts.closed} closed.
      </p>
      <ul className="flex flex-col gap-2">
        {model.branches.map((branch) => {
          const focused = branch.id === model.focusId;
          return (
            <li
              key={branch.id}
              data-session-branch={branch.id}
              data-session-branch-state={branch.status}
              data-session-branch-focused={focused ? "true" : undefined}
              style={{ paddingLeft: branch.depth * 10 }}
              className={focused ? "border border-white px-1 py-1" : "px-1 py-1"}
            >
              <span className="text-white/50">{statusLabel(branch.status)}</span> {branch.title}
              <span className="mt-0.5 block text-white/55">{branch.territory}</span>
              <span className="mt-0.5 block text-white/40">{branch.observation}</span>
              {showPrices ? (
                <span data-session-branch-prices={branch.id} className="mt-0.5 block text-white/70">
                  {priceLine(branch)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SessionBranchField({ showPrices = true }: { showPrices?: boolean }) {
  return <SessionBranchFieldView slot={useSessionBranchSlot()} showPrices={showPrices} />;
}
