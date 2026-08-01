/**
 * Pure map-ground authoring rules: lock-until-completed prerequisites and
 * unusable cells that shape paths. Free of React / DB so unit tests drive the
 * real unlock and occupancy logic used by the map chrome and grid ops.
 */

import { getCellKey, type GridCell } from "@/lib/block-skill-grid";

/** Block fields needed for lock/unlock evaluation. */
export interface MapGroundBlockRef {
  id: string;
  title?: string | null;
  status?: string | null;
  /** Block ids that must be completed before this block unlocks. */
  lock_until_block_ids?: string[] | null;
}

/** Absolute unusable ground cell (shapes paths; not placeable open ground). */
export interface UnusableCell {
  row: number;
  col: number;
}

export type MapGroundCellKind = "open" | "occupied" | "unusable";

export interface MapGroundRulesState {
  unusableCells: UnusableCell[];
  blocks: MapGroundBlockRef[];
}

/** True when a block status counts as completed for unlock checks. */
export function isBlockCompletedStatus(status: string | null | undefined): boolean {
  const s = String(status || "")
    .toLowerCase()
    .trim();
  return s === "completed" || s === "done";
}

/**
 * Normalize lock_until_block_ids from DB/JSON into a de-duplicated id list.
 * Ignores self-references and empty strings.
 */
export function normalizeLockUntilBlockIds(
  raw: unknown,
  selfId?: string | null,
): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const id = typeof item === "string" ? item.trim() : String(item || "").trim();
    if (!id) continue;
    if (selfId && id === selfId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Normalize unusable cells from DB/JSON into unique integer grid coords.
 */
export function normalizeUnusableCells(raw: unknown): UnusableCell[] {
  if (!Array.isArray(raw)) return [];
  const out: UnusableCell[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const row = Number(rec.row ?? rec.r ?? rec.y);
    const col = Number(rec.col ?? rec.c ?? rec.x);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    const key = getCellKey(row, col);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ row, col });
  }
  return out;
}

/** Build a lookup set of unusable cell keys. */
export function unusableCellKeySet(cells: readonly UnusableCell[]): Set<string> {
  return new Set(cells.map((c) => getCellKey(c.row, c.col)));
}

/** True when (row, col) is marked unusable (not free placeable open ground). */
export function isUnusableCell(
  cells: readonly UnusableCell[],
  row: number,
  col: number,
): boolean {
  return unusableCellKeySet(cells).has(getCellKey(row, col));
}

/**
 * Pure occupancy for map ground: unusable cells are never open placeable ground.
 * Occupied keys take precedence for display but unusable remains non-placeable.
 */
export function resolveMapGroundCellKind(input: {
  row: number;
  col: number;
  unusableCells: readonly UnusableCell[];
  occupiedKeys?: ReadonlySet<string> | null;
}): MapGroundCellKind {
  const key = getCellKey(input.row, input.col);
  if (isUnusableCell(input.unusableCells, input.row, input.col)) {
    return "unusable";
  }
  if (input.occupiedKeys?.has(key)) return "occupied";
  return "open";
}

/**
 * Whether absolute cells may be used for free placement (all must be open ground).
 * Unusable cells are excluded from free placement / path ground.
 */
export function canPlaceOnMapGround(
  cells: readonly GridCell[],
  unusableCells: readonly UnusableCell[],
  occupiedKeys?: ReadonlySet<string> | null,
): { ok: boolean; blocked: GridCell[]; reason: "ok" | "unusable" | "occupied" | "empty" } {
  if (!cells || cells.length === 0) {
    return { ok: false, blocked: [], reason: "empty" };
  }
  const unusable = unusableCellKeySet(unusableCells);
  const blockedUnusable: GridCell[] = [];
  const blockedOccupied: GridCell[] = [];
  for (const c of cells) {
    const key = getCellKey(c.row, c.col);
    if (unusable.has(key)) blockedUnusable.push(c);
    else if (occupiedKeys?.has(key)) blockedOccupied.push(c);
  }
  if (blockedUnusable.length > 0) {
    return { ok: false, blocked: blockedUnusable, reason: "unusable" };
  }
  if (blockedOccupied.length > 0) {
    return { ok: false, blocked: blockedOccupied, reason: "occupied" };
  }
  return { ok: true, blocked: [], reason: "ok" };
}

/**
 * Prerequisites that are still incomplete for a block.
 * Empty list ⇒ unlocked (or no lock rules).
 */
export function incompleteLockPrerequisites(
  block: MapGroundBlockRef,
  blocksById: ReadonlyMap<string, MapGroundBlockRef>,
): MapGroundBlockRef[] {
  const ids = normalizeLockUntilBlockIds(block.lock_until_block_ids, block.id);
  const incomplete: MapGroundBlockRef[] = [];
  for (const id of ids) {
    const prereq = blocksById.get(id);
    if (!prereq) {
      // Missing prereq id still counts as incomplete (strict lock).
      incomplete.push({ id, title: id, status: "missing" });
      continue;
    }
    if (!isBlockCompletedStatus(prereq.status)) {
      incomplete.push(prereq);
    }
  }
  return incomplete;
}

/**
 * Pure unlock rule: locked until every required block is completed.
 * No prerequisites ⇒ unlocked.
 */
export function isBlockLockedUntilCompleted(
  block: MapGroundBlockRef,
  blocksById: ReadonlyMap<string, MapGroundBlockRef>,
): boolean {
  return incompleteLockPrerequisites(block, blocksById).length > 0;
}

/**
 * True when the block declares dependency ids (lock-until list non-empty).
 * Independent of whether those prereqs are currently incomplete.
 */
export function blockHasLockDependencies(
  block: Pick<MapGroundBlockRef, "id" | "lock_until_block_ids">,
): boolean {
  return normalizeLockUntilBlockIds(block.lock_until_block_ids, block.id).length > 0;
}

/** Resolve lock state for every block in a workspace snapshot. */
export function resolveBlockLockStates(
  blocks: readonly MapGroundBlockRef[],
): Map<
  string,
  {
    locked: boolean;
    incompletePrerequisites: MapGroundBlockRef[];
    lockUntilIds: string[];
  }
> {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const out = new Map<
    string,
    {
      locked: boolean;
      incompletePrerequisites: MapGroundBlockRef[];
      lockUntilIds: string[];
    }
  >();
  for (const block of blocks) {
    const lockUntilIds = normalizeLockUntilBlockIds(block.lock_until_block_ids, block.id);
    const incompletePrerequisites = incompleteLockPrerequisites(block, byId);
    out.set(block.id, {
      locked: incompletePrerequisites.length > 0,
      incompletePrerequisites,
      lockUntilIds,
    });
  }
  return out;
}

/**
 * Toggle an unusable cell on/off. Returns a new normalized list.
 */
export function toggleUnusableCell(
  cells: readonly UnusableCell[],
  row: number,
  col: number,
): UnusableCell[] {
  const key = getCellKey(row, col);
  const current = normalizeUnusableCells(cells);
  if (current.some((c) => getCellKey(c.row, c.col) === key)) {
    return current.filter((c) => getCellKey(c.row, c.col) !== key);
  }
  return normalizeUnusableCells([...current, { row, col }]);
}

/**
 * Batch mark/clear unusable ground from a multi-selection of empty cells.
 * If every selected cell is already unusable → clear them all; otherwise mark all selected.
 * Used by left-toolbar "Unusable ground" action.
 */
export function applyUnusableSelection(
  selected: readonly { row: number; col: number }[],
  current: readonly UnusableCell[],
): UnusableCell[] {
  const unique = normalizeUnusableCells(selected);
  if (unique.length === 0) return normalizeUnusableCells(current);
  const currentNorm = normalizeUnusableCells(current);
  const currentKeys = unusableCellKeySet(currentNorm);
  const allAlreadyUnusable = unique.every((c) =>
    currentKeys.has(getCellKey(c.row, c.col)),
  );
  if (allAlreadyUnusable) {
    const remove = new Set(unique.map((c) => getCellKey(c.row, c.col)));
    return currentNorm.filter((c) => !remove.has(getCellKey(c.row, c.col)));
  }
  const next = [...currentNorm];
  for (const c of unique) {
    const key = getCellKey(c.row, c.col);
    if (!currentKeys.has(key)) next.push({ row: c.row, col: c.col });
  }
  return normalizeUnusableCells(next);
}

/**
 * Set lock-until prerequisites for a block (pure). Replaces previous list.
 */
export function setBlockLockUntil(
  blockId: string,
  prerequisiteIds: readonly string[],
): { blockId: string; lock_until_block_ids: string[] } {
  return {
    blockId,
    lock_until_block_ids: normalizeLockUntilBlockIds(prerequisiteIds, blockId),
  };
}

/**
 * Round-trip helper used by load/persist paths and tests.
 * Accepts raw DB shapes and returns normalized map-ground state.
 */
export function loadMapGroundRules(raw: {
  unusable_cells?: unknown;
  blocks?: Array<{
    id: string;
    title?: string | null;
    status?: string | null;
    lock_until_block_ids?: unknown;
  }> | null;
}): MapGroundRulesState {
  return {
    unusableCells: normalizeUnusableCells(raw.unusable_cells),
    blocks: (raw.blocks || []).map((b) => ({
      id: b.id,
      title: b.title ?? null,
      status: b.status ?? null,
      lock_until_block_ids: normalizeLockUntilBlockIds(b.lock_until_block_ids, b.id),
    })),
  };
}

/** Persist-ready JSON shapes from normalized state. */
export function serializeMapGroundRules(state: MapGroundRulesState): {
  unusable_cells: UnusableCell[];
  blocks: Array<{ id: string; lock_until_block_ids: string[] }>;
} {
  return {
    unusable_cells: normalizeUnusableCells(state.unusableCells),
    blocks: state.blocks.map((b) => ({
      id: b.id,
      lock_until_block_ids: normalizeLockUntilBlockIds(b.lock_until_block_ids, b.id),
    })),
  };
}
