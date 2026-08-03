/**
 * Pure helpers for creator-mode "Expand block" from a selected filled block.
 * Same circle + density multi 1×1 placement as empty-cell expand, but the
 * selected block is the prompt/main context and is excluded from placeable slots.
 */

import {
  resolveAddExpandSelection,
  snapshotAddExpandSlots,
  type AddExpandCell,
} from "@/lib/add-block-range-density";
import { placedBlockCells, type PlacedBlockRef } from "@/lib/skill-grid-ops";

export type ExpandFromSourceCenter = AddExpandCell;

/**
 * Map anchor / expand center for a placed block: anchor (position_y, position_x)
 * when present; otherwise first occupied cell; fallback {0,0}.
 */
export function expandCenterFromSourceBlock(
  block: PlacedBlockRef | null | undefined,
): ExpandFromSourceCenter {
  if (!block) return { row: 0, col: 0 };
  if (
    Number.isFinite(block.position_y) &&
    Number.isFinite(block.position_x)
  ) {
    return {
      row: Math.trunc(block.position_y),
      col: Math.trunc(block.position_x),
    };
  }
  const cells = placedBlockCells(block);
  if (cells.length > 0) {
    return { row: cells[0].row, col: cells[0].col };
  }
  return { row: 0, col: 0 };
}

/**
 * Occupancy keys for the source block footprint (always excluded from expand).
 */
export function sourceBlockOccupiedKeys(
  block: PlacedBlockRef | null | undefined,
): string[] {
  if (!block) return [];
  return placedBlockCells(block).map(
    (c) => `${Math.trunc(c.row)}:${Math.trunc(c.col)}`,
  );
}

function toKeySet(
  keys?: ReadonlySet<string> | readonly string[] | null,
): Set<string> {
  if (keys instanceof Set) return new Set(keys);
  return new Set(keys || []);
}

/**
 * Expand selection around a filled source block.
 * Reuses resolveAddExpandSelection; source footprint stays occupied so only
 * placeable empties are candidates. Frozen slots omit the occupied center.
 */
export function resolveExpandFromSourceSelection(input: {
  sourceBlock: PlacedBlockRef;
  range: number;
  density: number;
  seed: number;
  /** Full map occupancy (should already include source; re-merged for safety). */
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): {
  center: ExpandFromSourceCenter;
  candidates: AddExpandCell[];
  selected: AddExpandCell[];
  /** Ordered slots for multi-create (placeable empties only — no source cell). */
  frozenSlots: AddExpandCell[];
} {
  const center = expandCenterFromSourceBlock(input.sourceBlock);
  const occupied = toKeySet(input.occupiedKeys);
  for (const k of sourceBlockOccupiedKeys(input.sourceBlock)) {
    occupied.add(k);
  }

  const { candidates, selected } = resolveAddExpandSelection({
    center,
    range: input.range,
    density: input.density,
    seed: input.seed,
    occupiedKeys: occupied,
    unusableKeys: input.unusableKeys,
  });

  // Placeable empties only — never invent a create at the occupied center.
  // When center was placeable (shouldn't happen for filled source), drop it.
  const centerKey = `${center.row}:${center.col}`;
  const placeableSelected = selected.filter(
    (c) => `${c.row}:${c.col}` !== centerKey,
  );
  const placeableCandidates = candidates.filter(
    (c) => `${c.row}:${c.col}` !== centerKey,
  );

  // Freeze order: if selection already excludes center, use as-is;
  // else re-snapshot without injecting center as first create slot.
  const frozenSlots =
    placeableSelected.length > 0
      ? placeableSelected.map((c) => ({ row: c.row, col: c.col }))
      : [];

  return {
    center,
    candidates: placeableCandidates,
    selected: placeableSelected,
    frozenSlots,
  };
}

/**
 * Snapshot expand-from-source slots (no center inject).
 * Prefer `resolveExpandFromSourceSelection(...).frozenSlots` at submit.
 */
export function snapshotExpandFromSourceSlots(
  selected: readonly AddExpandCell[],
): AddExpandCell[] {
  // When there is no placeable center, snapshotAddExpandSlots would wrongly
  // force a center cell. Freeze selection membership only.
  const seen = new Set<string>();
  const out: AddExpandCell[] = [];
  for (const raw of selected || []) {
    const c = { row: Math.trunc(raw.row), col: Math.trunc(raw.col) };
    const k = `${c.row}:${c.col}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * Identity content used as main context for expand generation.
 */
export type ExpandSourceIdentity = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  planning_prompt?: string | null;
};

/**
 * Build the main prompt/context string from the selected filled block.
 * Used as the base for every expand slot (AI invents neighbors around this).
 */
export function buildExpandFromSourceContextPrompt(
  source: ExpandSourceIdentity | null | undefined,
): string {
  const title = String(source?.title ?? "").trim() || "Untitled block";
  const description = String(source?.description ?? "").trim();
  const planning = String(source?.planning_prompt ?? "").trim();
  const parts = [
    `Expand around the selected learning block as the main context.`,
    `Source block title: "${title}"`,
  ];
  if (description) {
    parts.push(`Source block description: ${description}`);
  }
  if (planning) {
    parts.push(`Source planning / teaching notes: ${planning}`);
  }
  parts.push(
    `Create neighboring 1×1 blocks that complement and extend this source — distinct subtopics, same overall theme. Do not duplicate the source title.`,
  );
  return parts.join("\n");
}

/**
 * Per-slot prompt for add-block-at-slot multi-create from a filled source.
 */
export function buildExpandFromSourceSlotPrompt(input: {
  source: ExpandSourceIdentity;
  slot: AddExpandCell;
  slotIndex: number;
  totalSlots: number;
}): string {
  const base = buildExpandFromSourceContextPrompt(input.source);
  const i = Math.max(0, Math.floor(Number(input.slotIndex) || 0));
  const total = Math.max(1, Math.floor(Number(input.totalSlots) || 1));
  const { row, col } = input.slot;
  if (total <= 1) {
    return `${base}\n\nPlace one neighboring block at row ${row}, col ${col}.`;
  }
  return `${base}\n\n(Place a distinct neighboring 1×1 block ${i + 1} of ${total} at row ${row}, col ${col} — different subtopic, same overall theme as the source.)`;
}

/**
 * Whether Expand block drawer should mount (creator, sole filled selection).
 */
export function canShowExpandBlockDrawer(input: {
  canEdit?: boolean;
  soleFilledSelected?: boolean;
}): boolean {
  return Boolean(input.canEdit && input.soleFilledSelected);
}

/** Re-export for hosts that freeze via the empty-cell helper with a dummy center. */
export { snapshotAddExpandSlots };
