/**
 * Pure tool-mode and enablement rules for the block map Photoshop-style tool strip.
 * Kept free of React so unit tests can drive the real decision logic.
 *
 * Ground authoring (lock-until / unusable) is selection-driven via left-strip
 * actions — not right-pane coordinate forms.
 */

import {
  applyUnusableSelection,
  setBlockLockUntil,
  type UnusableCell,
} from "@/lib/map-ground-rules";

/** Active left-strip modes: select (default), move (drag blocks), lasso (rect select). */
export type BlockMapModeTool = "select" | "move" | "lasso";

export type BlockMapToolId =
  | "select"
  | "move"
  | "lasso"
  | "merge"
  | "split"
  | "generate_shape"
  | "lock_until"
  | "mark_unusable"
  | "clear_selection"
  | "zoom_in"
  | "zoom_out"
  | "recenter";

export type BlockMapToolKind = "mode" | "action" | "viewport";

export interface BlockMapToolEnablementInput {
  canEdit: boolean;
  busy: boolean;
  /** True when onGridOp is wired (workspace builder). */
  hasGridOps: boolean;
  /** True when map-ground persist callbacks are wired. */
  hasMapGroundOps?: boolean;
  /** True while explicit prereq-edit mode is active (confirm enabled). */
  prereqEditActive?: boolean;
  selectedBlockCount: number;
  selectedEmptyCellCount: number;
  /**
   * How many selected blocks span more than one cell (w>1 or h>1).
   * Split only makes sense for these multi-cell footprints.
   */
  selectedMultiCellBlockCount?: number;
  /**
   * True when every selected block is edge-adjacent to the others as one region.
   * Merge only makes sense for contiguous selections.
   */
  selectedBlocksContiguous?: boolean;
  /**
   * True when selected empty cells form a filled rectangle (no gaps).
   * Required for generate-in-shape (bounding box alone is not enough).
   */
  selectedEmptyCellsSolidRectangle?: boolean;
}

/** True when a block occupies more than a single grid cell. */
export function isMultiCellBlockSpan(span: {
  span_w?: number | null;
  span_h?: number | null;
}): boolean {
  const w = Math.max(1, Math.floor(Number(span.span_w) || 1));
  const h = Math.max(1, Math.floor(Number(span.span_h) || 1));
  return w > 1 || h > 1;
}

/** Default map mode: single-click selects one block; Shift multi-selects. */
export const DEFAULT_BLOCK_MAP_MODE: BlockMapModeTool = "select";

/**
 * Primary strip order: modes, then block actions, map-ground, then viewport.
 * generate_shape is omitted — multi empty selection opens the form in the right pane.
 * edit is omitted — update/delete live on the block-detail Edit drawer when selected.
 */
export const BLOCK_MAP_TOOL_STRIP: readonly BlockMapToolId[] = [
  "select",
  "move",
  "lasso",
  "merge",
  "split",
  "lock_until",
  "mark_unusable",
  "clear_selection",
  "zoom_in",
  "zoom_out",
  "recenter",
] as const;

export function blockMapToolKind(tool: BlockMapToolId): BlockMapToolKind {
  if (tool === "select" || tool === "move" || tool === "lasso") return "mode";
  if (tool === "zoom_in" || tool === "zoom_out" || tool === "recenter") return "viewport";
  return "action";
}

export function isBlockMapModeTool(tool: BlockMapToolId): tool is BlockMapModeTool {
  return tool === "select" || tool === "move" || tool === "lasso";
}

/**
 * Whether the active mode allows block/empty click selection (or open-add).
 * Select and Move allow clicks; lasso draws a rectangle (no click-select).
 * Viewport pan is background-drag only outside lasso.
 */
export function allowsMapClickSelection(activeTool: BlockMapModeTool): boolean {
  return activeTool === "select" || activeTool === "move";
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

function normalizeLockIds(
  raw: readonly string[] | null | undefined,
  selfId: string,
): string[] {
  return setBlockLockUntil(selfId, raw || []).lock_until_block_ids;
}

// ---------------------------------------------------------------------------
// Explicit prereq-edit mode (primary lock-until creator path)
// ---------------------------------------------------------------------------

export type PrereqEditState = {
  active: boolean;
  targetId: string | null;
  /** Staged prerequisite ids — multi-select toggles membership (not the target). */
  stagedPrereqIds: string[];
};

export const EMPTY_PREREQ_EDIT: PrereqEditState = {
  active: false,
  targetId: null,
  stagedPrereqIds: [],
};

/**
 * Enter prereq-edit for a target. Seeds staged set from saved locks when present.
 */
export function enterPrereqEditMode(input: {
  targetId: string;
  currentLocks?: readonly string[] | null;
}): PrereqEditState {
  const targetId = String(input.targetId || "").trim();
  if (!targetId) return { ...EMPTY_PREREQ_EDIT };
  return {
    active: true,
    targetId,
    stagedPrereqIds: normalizeLockIds(input.currentLocks ?? [], targetId),
  };
}

/** Discard staged edits without writing. */
export function cancelPrereqEditMode(): PrereqEditState {
  return { ...EMPTY_PREREQ_EDIT };
}

/**
 * Toggle a block in/out of the staged prereq set.
 * Target cannot be a prereq of itself; ignored if mode inactive.
 */
export function toggleStagedPrereq(
  state: PrereqEditState,
  blockId: string,
): PrereqEditState {
  if (!state.active || !state.targetId) return state;
  const id = String(blockId || "").trim();
  if (!id || id === state.targetId) return state;
  const has = state.stagedPrereqIds.includes(id);
  return {
    ...state,
    stagedPrereqIds: has
      ? state.stagedPrereqIds.filter((x) => x !== id)
      : [...state.stagedPrereqIds, id],
  };
}

/**
 * Confirm staged set → persist payload. Empty staged set clears all prereqs.
 * Returns null when mode is inactive.
 */
export function confirmPrereqEdit(
  state: PrereqEditState,
): { blockId: string; lock_until_block_ids: string[] } | null {
  if (!state.active || !state.targetId) return null;
  return setBlockLockUntil(state.targetId, state.stagedPrereqIds);
}

/** Whether confirm would change saved locks (for enablement / dirty flag). */
export function prereqEditIsDirty(
  state: PrereqEditState,
  currentLocks?: readonly string[] | null,
): boolean {
  if (!state.active || !state.targetId) return false;
  const existing = normalizeLockIds(currentLocks ?? [], state.targetId);
  return !sameIdSet(existing, normalizeLockIds(state.stagedPrereqIds, state.targetId));
}

export type MapBlockHighlightRole =
  | "target"
  | "prereq"
  | "selected"
  | "locked"
  | "neutral";

/**
 * Classify chrome for a block under prereq-edit or single-target preview.
 * - target: strong white (full select language)
 * - prereq: mild white ring (staged or saved prereqs of the focused target)
 * - selected: normal multi-select
 * - locked / neutral: fallback status chrome
 */
export function resolveMapBlockHighlightRole(input: {
  blockId: string;
  selected: boolean;
  /** Active prereq-edit session. */
  prereqEdit?: PrereqEditState | null;
  /**
   * When not editing: if a single focused/selected block has saved prereqs,
   * pass those ids so they still show mild white (preview).
   */
  previewTargetId?: string | null;
  previewPrereqIds?: readonly string[] | null;
  isLockedDisplay?: boolean;
}): MapBlockHighlightRole {
  const id = input.blockId;
  const edit = input.prereqEdit;

  if (edit?.active && edit.targetId) {
    if (id === edit.targetId) return "target";
    if (edit.stagedPrereqIds.includes(id)) return "prereq";
    if (input.selected) return "selected";
    if (input.isLockedDisplay) return "locked";
    return "neutral";
  }

  // Preview: single target focused with saved prereqs
  if (input.previewTargetId && id === input.previewTargetId) {
    return input.selected || true ? "target" : "target";
  }
  if (
    input.previewTargetId &&
    Array.isArray(input.previewPrereqIds) &&
    input.previewPrereqIds.includes(id)
  ) {
    return "prereq";
  }

  if (input.selected) return "selected";
  if (input.isLockedDisplay) return "locked";
  return "neutral";
}

/**
 * @deprecated Prefer enterPrereqEditMode + confirmPrereqEdit as the primary path.
 * Kept for tests that still exercise multi-select order heuristics.
 */
export type LockUntilSelectionResult = {
  updates: Array<{ blockId: string; lock_until_block_ids: string[] }>;
  mode: "clear_all" | "remove_prereqs" | "set_prereqs" | "batch_unlock";
};

/** @deprecated Primary path is prereq-edit mode. */
export function resolveLockUntilActions(
  selectedBlockIds: readonly string[],
  currentLocks?: ReadonlyMap<string, readonly string[] | null | undefined>,
): LockUntilSelectionResult | null {
  if (!selectedBlockIds.length) return null;
  const target = selectedBlockIds[0];
  if (!target?.trim()) return null;
  // Delegate to staged-edit semantics: target + rest as staged prereqs, confirm.
  const staged = enterPrereqEditMode({
    targetId: target,
    currentLocks: selectedBlockIds.slice(1),
  });
  // When only one selected, clear all (staged empty from current locks then clear)
  if (selectedBlockIds.length === 1) {
    return {
      updates: [setBlockLockUntil(target, [])],
      mode: "clear_all",
    };
  }
  const confirmed = confirmPrereqEdit({
    active: true,
    targetId: target,
    stagedPrereqIds: selectedBlockIds.slice(1),
  });
  if (!confirmed) return null;
  const existing = normalizeLockIds(currentLocks?.get(target), target);
  if (sameIdSet(existing, confirmed.lock_until_block_ids)) {
    return {
      updates: [setBlockLockUntil(target, [])],
      mode: "clear_all",
    };
  }
  return {
    updates: [confirmed],
    mode: confirmed.lock_until_block_ids.length ? "set_prereqs" : "clear_all",
  };
}

/** @deprecated Prefer confirmPrereqEdit. */
export function resolveLockUntilFromSelection(
  selectedBlockIds: readonly string[],
  currentLocks?: ReadonlyMap<string, readonly string[] | null | undefined>,
): { blockId: string; lock_until_block_ids: string[] } | null {
  const result = resolveLockUntilActions(selectedBlockIds, currentLocks);
  if (!result?.updates.length) return null;
  return result.updates[0] ?? null;
}

/** Batch unlock helper (still used by tests / optional multi-clear). */
export function resolveUnlockSelectedBlocks(
  selectedBlockIds: readonly string[],
  currentLocks: ReadonlyMap<string, readonly string[] | null | undefined>,
): Array<{ blockId: string; lock_until_block_ids: string[] }> | null {
  const updates: Array<{ blockId: string; lock_until_block_ids: string[] }> = [];
  for (const id of selectedBlockIds) {
    if (!id?.trim()) continue;
    const existing = normalizeLockIds(currentLocks.get(id), id);
    if (existing.length > 0) {
      updates.push(setBlockLockUntil(id, []));
    }
  }
  return updates.length > 0 ? updates : null;
}

/**
 * Unusable ground from multi-selected empty cells.
 * If every selected cell is already unusable → clear them; otherwise mark all selected.
 * Returns null when selection is empty.
 */
export function resolveUnusableFromSelection(
  selectedEmptyCells: readonly { row: number; col: number }[],
  currentUnusable: readonly UnusableCell[],
): UnusableCell[] | null {
  if (!selectedEmptyCells.length) return null;
  return applyUnusableSelection(selectedEmptyCells, currentUnusable);
}

/**
 * Mode tools become the active tool. Action / viewport clicks leave the mode unchanged.
 */
export function nextActiveModeTool(
  current: BlockMapModeTool,
  clicked: BlockMapToolId,
): BlockMapModeTool {
  if (isBlockMapModeTool(clicked)) return clicked;
  return current;
}

/**
 * Whether this interaction should toggle multi-select (add/remove) rather than
 * replace the selection with a single block.
 *
 * - Explicit Shift / ⌘ / Ctrl always multi-selects (toggle membership).
 * - Select + Move plain click: replace with only the clicked block.
 * - Lasso does not use click multi-gesture (rectangle apply instead).
 */
export function isBlockMultiSelectGesture(input: {
  multiModifier: boolean;
  activeTool: BlockMapModeTool;
  prevSelectedBlockCount: number;
}): boolean {
  void input.activeTool;
  void input.prevSelectedBlockCount;
  return Boolean(input.multiModifier);
}

/**
 * Pure toggle/replace for filled-block selection lists.
 * - multi=true: add/remove membership
 * - multi=false: replace with only this id, or clear if it was already the sole selection
 */
export function toggleOrReplaceBlockSelection(input: {
  blockId: string;
  /** When true, add/remove; when false, replace with only this id (or clear if sole). */
  multi: boolean;
  prevSelectedBlockIds: readonly string[];
}): string[] {
  if (input.multi) {
    return input.prevSelectedBlockIds.includes(input.blockId)
      ? input.prevSelectedBlockIds.filter((id) => id !== input.blockId)
      : [...input.prevSelectedBlockIds, input.blockId];
  }
  // Plain click on the already-selected sole block → unselect
  if (
    input.prevSelectedBlockIds.length === 1 &&
    input.prevSelectedBlockIds[0] === input.blockId
  ) {
    return [];
  }
  return [input.blockId];
}

/**
 * Resolve which blocks are selected after a block-cell interaction.
 * Plain click → single-select replace (or clear if already sole); modifier → toggle.
 */
export function resolveBlockSelectionOnClick(input: {
  blockId: string;
  multiModifier: boolean;
  prevSelectedBlockIds: readonly string[];
  /** Select/Move: plain replaces/clears; modifiers multi-toggle. Lasso ignores clicks. */
  activeTool?: BlockMapModeTool;
}): string[] {
  const multi = isBlockMultiSelectGesture({
    multiModifier: input.multiModifier,
    activeTool: input.activeTool ?? "select",
    prevSelectedBlockCount: input.prevSelectedBlockIds.length,
  });
  return toggleOrReplaceBlockSelection({
    blockId: input.blockId,
    multi,
    prevSelectedBlockIds: input.prevSelectedBlockIds,
  });
}

/**
 * Whether an empty-cell click should toggle multi-select membership rather than
 * replace the selection with only that cell.
 *
 * Mirrors filled blocks: only Shift / ⌘ / Ctrl multi-toggles.
 * Lasso never multi-toggles empties (rect tool owns the gesture).
 */
export function isEmptyCellMultiSelectGesture(input: {
  multiModifier: boolean;
  activeTool: BlockMapModeTool;
  prevSelectedEmptyCount: number;
}): boolean {
  void input.prevSelectedEmptyCount;
  if (input.activeTool === "lasso") return false;
  return Boolean(input.multiModifier);
}

/**
 * Whether a click on an empty cell should update empty selection at all
 * (vs open the single-cell add dialog). Select/Move always select empties;
 * double-click still opens add in the UI. Lasso ignores empty clicks.
 */
export function shouldEmptyCellClickSelect(input: {
  activeTool: BlockMapModeTool;
}): boolean {
  return input.activeTool === "select" || input.activeTool === "move";
}

function emptyCellKey(cell: { row: number; col: number }): string {
  return `${cell.row}:${cell.col}`;
}

/**
 * Pure toggle/replace for empty-cell selection lists (row/col identity).
 * multi=true → add/remove membership;
 * multi=false → only this cell, or clear if it was already the sole selection.
 */
export function toggleOrReplaceEmptyCellSelection(input: {
  cell: { row: number; col: number };
  multi: boolean;
  prevSelectedEmptyCells: readonly { row: number; col: number }[];
}): { row: number; col: number }[] {
  const key = emptyCellKey(input.cell);
  if (input.multi) {
    const has = input.prevSelectedEmptyCells.some((c) => emptyCellKey(c) === key);
    if (has) {
      return input.prevSelectedEmptyCells.filter((c) => emptyCellKey(c) !== key);
    }
    return [...input.prevSelectedEmptyCells, { row: input.cell.row, col: input.cell.col }];
  }
  // Plain click on the already-selected sole empty → unselect
  if (
    input.prevSelectedEmptyCells.length === 1 &&
    emptyCellKey(input.prevSelectedEmptyCells[0]) === key
  ) {
    return [];
  }
  return [{ row: input.cell.row, col: input.cell.col }];
}

/**
 * Resolve empty selection after an empty-cell click under Select/Move.
 * Plain click → single-select replace (or clear if already sole); modifier → toggle.
 */
export function resolveEmptyCellSelectionOnClick(input: {
  cell: { row: number; col: number };
  multiModifier: boolean;
  prevSelectedEmptyCells: readonly { row: number; col: number }[];
  activeTool?: BlockMapModeTool;
}): { row: number; col: number }[] {
  const tool = input.activeTool ?? "select";
  if (!shouldEmptyCellClickSelect({ activeTool: tool })) {
    return [...input.prevSelectedEmptyCells];
  }
  const multi = isEmptyCellMultiSelectGesture({
    multiModifier: input.multiModifier,
    activeTool: tool,
    prevSelectedEmptyCount: input.prevSelectedEmptyCells.length,
  });
  return toggleOrReplaceEmptyCellSelection({
    cell: input.cell,
    multi,
    prevSelectedEmptyCells: input.prevSelectedEmptyCells,
  });
}

/**
 * Select/Move tool modes that edit the map: select blocks and drag-drop them
 * without opening TAP/ILE (or other) detail surfaces.
 */
export function isBlockMapManipulationMode(
  activeTool: BlockMapModeTool,
  state: Pick<BlockMapToolEnablementInput, "canEdit" | "hasGridOps">,
): boolean {
  return (
    state.canEdit &&
    state.hasGridOps &&
    (activeTool === "select" || activeTool === "move")
  );
}

/** Inclusive axis-aligned grid rectangle (row/col indices). */
export type GridSelectionRect = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

/** Normalize two grid cells into a min/max inclusive rectangle. */
export function normalizeGridSelectionRect(
  a: { row: number; col: number },
  b: { row: number; col: number },
): GridSelectionRect {
  return {
    minRow: Math.min(a.row, b.row),
    maxRow: Math.max(a.row, b.row),
    minCol: Math.min(a.col, b.col),
    maxCol: Math.max(a.col, b.col),
  };
}

function gridRectsOverlap(a: GridSelectionRect, b: GridSelectionRect): boolean {
  return !(
    a.maxRow < b.minRow ||
    a.minRow > b.maxRow ||
    a.maxCol < b.minCol ||
    a.minCol > b.maxCol
  );
}

/**
 * Block ids whose footprint intersects the lasso rectangle.
 * Prefer `occupiedCells` when present (freeform); otherwise span rectangle.
 * Empty/degenerate input still returns [] when no blocks hit.
 */
export function blocksIntersectingGridRect(
  blocks: readonly {
    id: string;
    row?: number | null;
    col?: number | null;
    span_w?: number | null;
    span_h?: number | null;
    occupiedCells?: readonly { row: number; col: number }[] | null;
  }[],
  rect: GridSelectionRect,
): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const occupied = block.occupiedCells;
    if (occupied && occupied.length > 0) {
      const hit = occupied.some(
        (c) =>
          c.row >= rect.minRow &&
          c.row <= rect.maxRow &&
          c.col >= rect.minCol &&
          c.col <= rect.maxCol,
      );
      if (hit) out.push(block.id);
      continue;
    }
    const row = Math.floor(Number(block.row) || 0);
    const col = Math.floor(Number(block.col) || 0);
    const w = Math.max(1, Math.floor(Number(block.span_w) || 1));
    const h = Math.max(1, Math.floor(Number(block.span_h) || 1));
    const footprint: GridSelectionRect = {
      minRow: row,
      maxRow: row + h - 1,
      minCol: col,
      maxCol: col + w - 1,
    };
    if (gridRectsOverlap(footprint, rect)) out.push(block.id);
  }
  return out;
}

function cellKeyOf(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Placeable empty grid cells fully inside the inclusive lasso rectangle.
 * Excludes occupied cells and unusable ground. Order is row-major.
 */
export function emptyCellsIntersectingGridRect(input: {
  rect: GridSelectionRect;
  /**
   * Occupied cell keys `"row:col"` (from occupancy map) or absolute cells.
   * Cells listed here are never returned as empty.
   */
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  /** Unusable ground keys `"row:col"` — not placeable empties. */
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): { row: number; col: number }[] {
  const { rect } = input;
  const minRow = Math.floor(rect.minRow);
  const maxRow = Math.floor(rect.maxRow);
  const minCol = Math.floor(rect.minCol);
  const maxCol = Math.floor(rect.maxCol);
  if (
    !Number.isFinite(minRow) ||
    !Number.isFinite(maxRow) ||
    !Number.isFinite(minCol) ||
    !Number.isFinite(maxCol)
  ) {
    return [];
  }
  // Guard pathological rects (e.g. extreme pan) — cap enumeration size.
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  if (rows <= 0 || cols <= 0) return [];
  if (rows * cols > 10_000) {
    // Still scan but caller should rarely hit this; keep deterministic.
  }

  const occupied =
    input.occupiedKeys instanceof Set
      ? input.occupiedKeys
      : new Set(input.occupiedKeys || []);
  const unusable =
    input.unusableKeys instanceof Set
      ? input.unusableKeys
      : new Set(input.unusableKeys || []);

  const out: { row: number; col: number }[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const key = cellKeyOf(row, col);
      if (occupied.has(key)) continue;
      if (unusable.has(key)) continue;
      out.push({ row, col });
    }
  }
  return out;
}

/**
 * Lasso apply result: prefer **block** multi-select when any block footprint
 * intersects the rect (gaps around blocks must not steal selection). Empty
 * multi-select only when there are placeable empty hits and **no** block hits.
 * Empties and blocks stay exclusive for right-pane create vs block-detail.
 */
export function resolveLassoSelection(input: {
  rect: GridSelectionRect;
  blockHits: readonly string[];
  emptyHits: readonly { row: number; col: number }[];
}): {
  selectedBlockIds: string[];
  selectedEmptyCells: { row: number; col: number }[];
  mode: "empty" | "blocks" | "none";
} {
  void input.rect;
  const emptyHits = input.emptyHits.map((c) => ({ row: c.row, col: c.col }));
  // Blocks win: multi-block lasso of gapped footprints must not become empty mode
  // because free cells sit between/around the blocks.
  if (input.blockHits.length > 0) {
    return {
      selectedBlockIds: [...input.blockHits],
      selectedEmptyCells: [],
      mode: "blocks",
    };
  }
  if (emptyHits.length > 0) {
    return {
      selectedBlockIds: [],
      selectedEmptyCells: emptyHits,
      mode: "empty",
    };
  }
  return { selectedBlockIds: [], selectedEmptyCells: [], mode: "none" };
}

/** Map viewport client coords → grid cell under the pointer. */
export function clientPointToGridCell(input: {
  clientX: number;
  clientY: number;
  viewportLeft: number;
  viewportTop: number;
  panX: number;
  panY: number;
  zoom: number;
  pitch: number;
}): { row: number; col: number } {
  const x = (input.clientX - input.viewportLeft - input.panX) / input.zoom;
  const y = (input.clientY - input.viewportTop - input.panY) / input.zoom;
  return {
    col: Math.floor(x / input.pitch),
    row: Math.floor(y / input.pitch),
  };
}

/** Delta for a drag-drop move from origin cell to drop cell. */
export function blockDragMoveDelta(
  origin: { row: number; col: number },
  drop: { row: number; col: number },
): { dRow: number; dCol: number } {
  return {
    dRow: drop.row - origin.row,
    dCol: drop.col - origin.col,
  };
}

/**
 * Whether a tool button should be enabled for the current selection / capabilities.
 * Mode tools stay enabled so the user can switch modes before selecting.
 */
export function isBlockMapToolEnabled(
  tool: BlockMapToolId,
  state: BlockMapToolEnablementInput,
): boolean {
  switch (tool) {
    case "select":
      return state.canEdit;
    case "lasso":
      return state.canEdit;
    case "move":
      return state.canEdit && state.hasGridOps;
    case "merge":
      return (
        state.canEdit &&
        state.hasGridOps &&
        !state.busy &&
        state.selectedBlockCount >= 2 &&
        Boolean(state.selectedBlocksContiguous)
      );
    case "split":
      return (
        state.canEdit &&
        state.hasGridOps &&
        !state.busy &&
        (state.selectedMultiCellBlockCount ?? 0) >= 1
      );
    case "generate_shape":
      // Allow opening the dialog with any empty multi-select; solid-rectangle is
      // enforced on submit so users see "fill the gaps" guidance in the dialog.
      return (
        state.canEdit &&
        state.hasGridOps &&
        !state.busy &&
        state.selectedEmptyCellCount > 0
      );
    case "lock_until":
      // Enter prereq-edit with ≥1 selected; confirm while prereq-edit is active.
      return (
        state.canEdit &&
        Boolean(state.hasMapGroundOps ?? state.hasGridOps) &&
        !state.busy &&
        (state.prereqEditActive || state.selectedBlockCount >= 1)
      );
    case "mark_unusable":
      // Selection-driven: multi-selected empty cells mark/clear unusable ground.
      return (
        state.canEdit &&
        Boolean(state.hasMapGroundOps ?? state.hasGridOps) &&
        !state.busy &&
        state.selectedEmptyCellCount > 0
      );
    case "clear_selection":
      // Also enabled in prereq-edit so creators can cancel without writing.
      return (
        state.canEdit &&
        (Boolean(state.prereqEditActive) ||
          state.selectedBlockCount > 0 ||
          state.selectedEmptyCellCount > 0)
      );
    case "zoom_in":
    case "zoom_out":
    case "recenter":
      return true;
    default:
      return false;
  }
}

/**
 * Which tools appear in the side strip for the current capabilities.
 * Viewport tools always show; edit-mode tools only when the map is editable.
 */
export function visibleBlockMapTools(
  state: Pick<
    BlockMapToolEnablementInput,
    "canEdit" | "hasGridOps" | "hasMapGroundOps"
  >,
): BlockMapToolId[] {
  return BLOCK_MAP_TOOL_STRIP.filter((tool) => {
    const kind = blockMapToolKind(tool);
    if (kind === "viewport") return true;
    if (!state.canEdit) return false;
    if (tool === "select" || tool === "lasso" || tool === "clear_selection") return true;
    if (tool === "lock_until" || tool === "mark_unusable") {
      return Boolean(state.hasMapGroundOps ?? state.hasGridOps);
    }
    // Move + shape/merge/split need grid-ops wiring
    return state.hasGridOps;
  });
}

/** Human labels for map-ground tools (shared by strip + authoring pane). */
export function blockMapToolLabel(tool: BlockMapToolId): string {
  switch (tool) {
    case "select":
      return "Select";
    case "move":
      return "Move";
    case "lasso":
      return "Lasso (rectangle select)";
    case "merge":
      return "Merge";
    case "split":
      return "Split";
    case "generate_shape":
      return "Generate shape";
    case "lock_until":
      return "Lock until (prereq mode)";
    case "mark_unusable":
      return "Unusable ground";
    case "clear_selection":
      return "Clear";
    case "zoom_in":
      return "Zoom in";
    case "zoom_out":
      return "Zoom out";
    case "recenter":
      return "Recenter";
    default:
      return tool;
  }
}
