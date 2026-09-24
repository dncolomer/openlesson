"use client";

import { useState } from "react";
import { applyUnusableSelection } from "@/lib/map-ground-rules";
import { getCellKey } from "@/lib/block-skill-grid";

/**
 * Mark or clear the pane's empty cells as unusable ground.
 * Uses the same batch rule as the old strip action: mark all, or clear when every cell is already unusable.
 */
export function UnusableGroundDrawer({
  cells,
  unusableCells = [],
  busy = false,
  onSetUnusableCells,
}: {
  cells: Array<{ row: number; col: number }>;
  unusableCells?: Array<{ row: number; col: number }>;
  busy?: boolean;
  onSetUnusableCells?: (cells: Array<{ row: number; col: number }>) => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const currentKeys = new Set(
    (unusableCells || []).map((cell) => getCellKey(cell.row, cell.col)),
  );
  const allMarked =
    cells.length > 0 && cells.every((cell) => currentKeys.has(getCellKey(cell.row, cell.col)));

  async function apply() {
    if (!onSetUnusableCells || pending || busy || cells.length === 0) return;
    setPending(true);
    try {
      await onSetUnusableCells(applyUnusableSelection(cells, unusableCells));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2" data-unusable-ground-drawer>
      <p className="text-[11px] leading-relaxed text-neutral-400">
        {allMarked
          ? `Clear unusable ground on ${cells.length} cell${cells.length === 1 ? "" : "s"}.`
          : `Mark ${cells.length} cell${cells.length === 1 ? "" : "s"} as unusable ground.`}
      </p>
      <button
        type="button"
        data-unusable-ground-apply
        disabled={busy || pending || !onSetUnusableCells || cells.length === 0}
        onClick={() => void apply()}
        className="w-full rounded-none border border-neutral-600 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-100 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : allMarked ? "Clear unusable ground" : "Mark unusable"}
      </button>
    </div>
  );
}
