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

/**
 * Active left-strip modes.
 * - select: click select + click-and-drag move (no separate Move mode on strip)
 * - lasso: region select; shape is rect/circle/freehand via submenu (not separate tools)
 * - move / lasso_circle / lasso_freehand: legacy mode ids still recognized for
 *   enablement/tests; not shown on the primary strip
 */
export type BlockMapModeTool =
  | "select"
  | "move"
  | "lasso"
  | "lasso_circle"
  | "lasso_freehand";

/** Which geometric region a lasso mode draws. */
export type LassoShapeKind = "rect" | "circle" | "freehand";

export type BlockMapToolId =
  | "select"
  | "move"
  | "lasso"
  | "lasso_circle"
  | "lasso_freehand"
  | "merge"
  | "split"
  | "clone"
  | "generate_shape"
  | "lock_until"
  | "mark_unusable"
  | "clear_selection"
  | "zoom_in"
  | "zoom_out"
  | "recenter";

export type BlockMapToolKind = "mode" | "action" | "viewport";

/** Lasso shapes available in the single-lasso submenu (order for cycle). */
export const LASSO_SHAPE_ORDER: readonly LassoShapeKind[] = [
  "rect",
  "circle",
  "freehand",
] as const;

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

/** Default map mode: click select + click-and-drag move; Shift multi-selects. */
export const DEFAULT_BLOCK_MAP_MODE: BlockMapModeTool = "select";

/** Default lasso geometry when entering lasso mode. */
export const DEFAULT_LASSO_SHAPE: LassoShapeKind = "rect";

/**
 * Primary strip order: modes (select + one lasso), then block actions, map-ground,
 * then viewport.
 * Move is demoted (gesture drag in select) — not on the strip.
 * Circle/freehand lasso are shapes under the single lasso control, not strip tools.
 * generate_shape is omitted — multi empty selection opens the form in the right pane.
 * edit is omitted — update/delete live on the block-detail Edit drawer when selected.
 */
export const BLOCK_MAP_TOOL_STRIP: readonly BlockMapToolId[] = [
  "select",
  "lasso",
  "merge",
  "split",
  "clone",
  "lock_until",
  "mark_unusable",
  "clear_selection",
  "zoom_in",
  "zoom_out",
  "recenter",
] as const;

/** True for any region-select lasso mode (rect, circle, freehand legacy ids). */
export function isLassoModeTool(
  tool: BlockMapModeTool | BlockMapToolId | string | null | undefined,
): boolean {
  return tool === "lasso" || tool === "lasso_circle" || tool === "lasso_freehand";
}

/** Map a mode tool to its lasso geometry, or null when not a lasso mode. */
export function lassoShapeForTool(
  tool: BlockMapModeTool | BlockMapToolId | string | null | undefined,
): LassoShapeKind | null {
  if (tool === "lasso") return "rect";
  if (tool === "lasso_circle") return "circle";
  if (tool === "lasso_freehand") return "freehand";
  return null;
}

/**
 * Resolve which lasso shape to draw: explicit submenu shape when tool is `lasso`,
 * else legacy per-tool mapping.
 */
export function resolveActiveLassoShape(input: {
  activeTool: BlockMapModeTool | string | null | undefined;
  lassoShape?: LassoShapeKind | null;
}): LassoShapeKind | null {
  if (!isLassoModeTool(input.activeTool)) return null;
  if (input.activeTool === "lasso" && input.lassoShape) {
    return input.lassoShape;
  }
  return lassoShapeForTool(input.activeTool);
}

/** Cycle rect → circle → freehand → rect (submenu / re-click). */
export function nextLassoShape(current: LassoShapeKind | null | undefined): LassoShapeKind {
  const cur = current && LASSO_SHAPE_ORDER.includes(current) ? current : DEFAULT_LASSO_SHAPE;
  const i = LASSO_SHAPE_ORDER.indexOf(cur);
  return LASSO_SHAPE_ORDER[(i + 1) % LASSO_SHAPE_ORDER.length]!;
}

/**
 * Whether this pointer gesture should pan the map (modifier / middle button).
 * Pure so tests pin Space / middle-button pan without React.
 */
export function isMapPanGesture(input: {
  /** Pointer button: 0 primary, 1 middle, 2 secondary */
  button?: number | null;
  /** Space (or equivalent) held */
  spaceHeld?: boolean;
  /** Explicit pan tool — not used on strip; kept for future */
  panMode?: boolean;
}): boolean {
  if (input.panMode) return true;
  if (input.spaceHeld) return true;
  if (Number(input.button) === 1) return true;
  return false;
}

/**
 * Empty-cell press: treat as pan-drag once pointer moves past threshold (not a click).
 * Multi-modifier stays select-only so Shift+click multi-select is preserved.
 */
export function emptyCellDragIsPan(input: {
  movedPastThreshold: boolean;
  multiModifier?: boolean;
  spaceHeld?: boolean;
  button?: number | null;
}): boolean {
  if (isMapPanGesture({
    button: input.button,
    spaceHeld: input.spaceHeld,
  })) {
    return true;
  }
  if (input.multiModifier) return false;
  return Boolean(input.movedPastThreshold);
}

/**
 * Select mode may arm block drag (click-and-drag) when grid ops exist.
 * Legacy move mode always arms drag the same way.
 */
export function allowsBlockDragInMode(
  activeTool: BlockMapModeTool | string | null | undefined,
  hasGridOps: boolean,
): boolean {
  if (!hasGridOps) return false;
  return activeTool === "select" || activeTool === "move";
}

export function blockMapToolKind(tool: BlockMapToolId): BlockMapToolKind {
  if (tool === "select" || tool === "move" || isLassoModeTool(tool)) return "mode";
  if (tool === "zoom_in" || tool === "zoom_out" || tool === "recenter") return "viewport";
  return "action";
}

export function isBlockMapModeTool(tool: BlockMapToolId): tool is BlockMapModeTool {
  return tool === "select" || tool === "move" || isLassoModeTool(tool);
}

/**
 * Whether the active mode allows block/empty click selection (or open-add).
 * Select (and legacy move) allow clicks; lasso modes draw a region.
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
  // Strip only exposes select + lasso; legacy circle/freehand/move map to primary modes.
  if (clicked === "lasso_circle" || clicked === "lasso_freehand") return "lasso";
  if (clicked === "move") return "select";
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
 * Move-tool press: which block ids should participate in a drag.
 * Keep the full selection when pressing any already-selected member (including a
 * sole selection) — do not apply "re-click sole clears", which would abort drag.
 * Pressing a non-member replaces with only that block.
 */
export function resolveMoveDragBlockIds(input: {
  blockId: string;
  prevSelectedBlockIds: readonly string[];
}): string[] {
  const id = String(input.blockId || "").trim();
  if (!id) return [];
  const prev = (input.prevSelectedBlockIds || []).map((x) => String(x || "").trim()).filter(Boolean);
  if (prev.includes(id)) return [...prev];
  return [id];
}

/**
 * Authoritative selection after a block pointer gesture ends.
 *
 * Must be driven from the selection **at pointerdown** (not mid-gesture preview).
 * - multiModifier: toggle membership once
 * - moved: keep drag set (no sole-clear)
 * - plain click: replace / sole re-click clear via toggleOrReplace
 *
 * Fixes the pan/click-drag bug where pointerdown materialized [id] and pointerup
 * re-applied plain select → sole-clear emptied the selection.
 */
export function resolveBlockPointerGestureSelection(input: {
  blockId: string;
  multiModifier: boolean;
  /** True when the pointer moved past the drag threshold (cell or px). */
  moved: boolean;
  /** Selection snapshot at pointerdown — not after drag preview materialize. */
  prevSelectedBlockIds: readonly string[];
}): {
  selectedBlockIds: string[];
  dragBlockIds: string[];
  kind: "click" | "drag" | "multi_toggle";
} {
  const id = String(input.blockId || "").trim();
  const prev = (input.prevSelectedBlockIds || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (!id) {
    return { selectedBlockIds: [...prev], dragBlockIds: [], kind: "click" };
  }

  if (input.multiModifier) {
    const next = toggleOrReplaceBlockSelection({
      blockId: id,
      multi: true,
      prevSelectedBlockIds: prev,
    });
    return {
      selectedBlockIds: next,
      dragBlockIds: next.includes(id) ? next : resolveMoveDragBlockIds({
        blockId: id,
        prevSelectedBlockIds: next,
      }),
      kind: "multi_toggle",
    };
  }

  const dragBlockIds = resolveMoveDragBlockIds({
    blockId: id,
    prevSelectedBlockIds: prev,
  });

  if (input.moved) {
    return {
      selectedBlockIds: dragBlockIds,
      dragBlockIds,
      kind: "drag",
    };
  }

  // Plain click — sole clear / replace from original prev only.
  const next = toggleOrReplaceBlockSelection({
    blockId: id,
    multi: false,
    prevSelectedBlockIds: prev,
  });
  return {
    selectedBlockIds: next,
    dragBlockIds: next.length > 0 ? next : dragBlockIds,
    kind: "click",
  };
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
  if (isLassoModeTool(input.activeTool)) return false;
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
 * Empty (non-occupied) grid cells fully inside the inclusive lasso rectangle.
 * Occupied cells are never returned. Order is row-major.
 *
 * By default unusable ground is included so lasso multi-select matches click
 * select for bulk mark_unusable clear/mark. Pass `includeUnusable: false` for
 * placeable-only enumeration (e.g. generate-shape candidate preview).
 */
export function emptyCellsIntersectingGridRect(input: {
  rect: GridSelectionRect;
  /**
   * Occupied cell keys `"row:col"` (from occupancy map) or absolute cells.
   * Cells listed here are never returned as empty.
   */
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  /** Unusable ground keys `"row:col"`. */
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
  /**
   * When false, skip unusable ground (placeable empties only).
   * Default true — lasso must select blocked/unusable tiles for mark_unusable.
   */
  includeUnusable?: boolean;
}): { row: number; col: number }[] {
  const { rect } = input;
  const includeUnusable = input.includeUnusable !== false;
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
      if (!includeUnusable && unusable.has(key)) continue;
      out.push({ row, col });
    }
  }
  return out;
}

/**
 * Lasso apply result: prefer **block** multi-select when any block footprint
 * intersects the region (gaps around blocks must not steal selection). Empty
 * multi-select only when there are empty hits and **no** block hits.
 * Empties and blocks stay exclusive for right-pane create vs block-detail.
 * Works for rect, circle, and freehand (hits precomputed by shape helpers).
 */
export function resolveLassoSelection(input: {
  /** Optional bounding rect (rect lasso); ignored for hit resolution. */
  rect?: GridSelectionRect | null;
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

/** Continuous grid coords: x = column space, y = row space (cell unit = 1). */
export type GridContinuousPoint = { x: number; y: number };

/** Map viewport client coords → continuous grid point (not floored). */
export function clientPointToGridPoint(input: {
  clientX: number;
  clientY: number;
  viewportLeft: number;
  viewportTop: number;
  panX: number;
  panY: number;
  zoom: number;
  pitch: number;
}): GridContinuousPoint {
  const xPx = (input.clientX - input.viewportLeft - input.panX) / input.zoom;
  const yPx = (input.clientY - input.viewportTop - input.panY) / input.zoom;
  const pitch = input.pitch > 0 ? input.pitch : 1;
  return {
    x: xPx / pitch,
    y: yPx / pitch,
  };
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
  const p = clientPointToGridPoint(input);
  return {
    col: Math.floor(p.x),
    row: Math.floor(p.y),
  };
}

type LassoBlockInput = {
  id: string;
  row?: number | null;
  col?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  occupiedCells?: readonly { row: number; col: number }[] | null;
};

function lassoBlockOccupiedCells(
  block: LassoBlockInput,
): { row: number; col: number }[] {
  const occupied = block.occupiedCells;
  if (occupied && occupied.length > 0) {
    return occupied.map((c) => ({ row: c.row, col: c.col }));
  }
  const row = Math.floor(Number(block.row) || 0);
  const col = Math.floor(Number(block.col) || 0);
  const w = Math.max(1, Math.floor(Number(block.span_w) || 1));
  const h = Math.max(1, Math.floor(Number(block.span_h) || 1));
  const out: { row: number; col: number }[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push({ row: row + dr, col: col + dc });
    }
  }
  return out;
}

function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** True when unit cell [col,col+1]×[row,row+1] intersects a circle (continuous grid). */
export function cellIntersectsCircle(
  row: number,
  col: number,
  center: GridContinuousPoint,
  radius: number,
): boolean {
  if (!(radius > 0) || !Number.isFinite(radius)) return false;
  const closestX = clampNum(center.x, col, col + 1);
  const closestY = clampNum(center.y, row, row + 1);
  const dx = closestX - center.x;
  const dy = closestY - center.y;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Block ids whose footprint intersects a circle (center + radius in cell units).
 */
export function blocksIntersectingCircle(
  blocks: readonly LassoBlockInput[],
  circle: { center: GridContinuousPoint; radius: number },
): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const cells = lassoBlockOccupiedCells(block);
    if (
      cells.some((c) =>
        cellIntersectsCircle(c.row, c.col, circle.center, circle.radius),
      )
    ) {
      out.push(block.id);
    }
  }
  return out;
}

/**
 * Empty (non-occupied) cells intersecting a circle. Unusable included by default.
 */
export function emptyCellsIntersectingCircle(input: {
  center: GridContinuousPoint;
  radius: number;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
  includeUnusable?: boolean;
}): { row: number; col: number }[] {
  const r = input.radius;
  if (!(r > 0) || !Number.isFinite(r)) return [];
  const includeUnusable = input.includeUnusable !== false;
  const occupied =
    input.occupiedKeys instanceof Set
      ? input.occupiedKeys
      : new Set(input.occupiedKeys || []);
  const unusable =
    input.unusableKeys instanceof Set
      ? input.unusableKeys
      : new Set(input.unusableKeys || []);
  const minRow = Math.floor(input.center.y - r);
  const maxRow = Math.ceil(input.center.y + r) - 1;
  const minCol = Math.floor(input.center.x - r);
  const maxCol = Math.ceil(input.center.x + r) - 1;
  if (
    !Number.isFinite(minRow) ||
    !Number.isFinite(maxRow) ||
    !Number.isFinite(minCol) ||
    !Number.isFinite(maxCol)
  ) {
    return [];
  }
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  if (rows <= 0 || cols <= 0) return [];
  if (rows * cols > 10_000) {
    // Cap pathological radii — still scan (caller rarely hits this).
  }
  const out: { row: number; col: number }[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!cellIntersectsCircle(row, col, input.center, r)) continue;
      const key = cellKeyOf(row, col);
      if (occupied.has(key)) continue;
      if (!includeUnusable && unusable.has(key)) continue;
      out.push({ row, col });
    }
  }
  return out;
}

/** Ray-cast point-in-polygon (even-odd). Polygon is not required to repeat first point. */
export function pointInPolygon(
  px: number,
  py: number,
  polygon: readonly GridContinuousPoint[],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const denom = yj - yi || 1e-12;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distPointToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq <= 1e-12) {
    return apx * apx + apy * apy;
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = clampNum(t, 0, 1);
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

/** True when unit cell center is inside polygon or within stroke of any edge. */
export function cellIntersectsPolygon(
  row: number,
  col: number,
  polygon: readonly GridContinuousPoint[],
  strokeRadius = 0.55,
): boolean {
  if (polygon.length < 2) return false;
  const cx = col + 0.5;
  const cy = row + 0.5;
  if (polygon.length >= 3 && pointInPolygon(cx, cy, polygon)) return true;
  const r = strokeRadius > 0 ? strokeRadius : 0;
  const rSq = r * r;
  for (let i = 0; i < polygon.length - 1; i++) {
    const a = polygon[i];
    const b = polygon[i + 1];
    if (distPointToSegmentSq(cx, cy, a.x, a.y, b.x, b.y) <= rSq) return true;
  }
  // Close path for freehand lasso stroke
  if (polygon.length >= 3) {
    const a = polygon[polygon.length - 1];
    const b = polygon[0];
    if (distPointToSegmentSq(cx, cy, a.x, a.y, b.x, b.y) <= rSq) return true;
  }
  return false;
}

function polygonBounds(polygon: readonly GridContinuousPoint[], pad: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) {
    return { minRow: 0, maxRow: -1, minCol: 0, maxCol: -1 };
  }
  return {
    minRow: Math.floor(minY - pad),
    maxRow: Math.ceil(maxY + pad) - 1,
    minCol: Math.floor(minX - pad),
    maxCol: Math.ceil(maxX + pad) - 1,
  };
}

/**
 * Block ids whose footprint intersects a freehand polygon (interior + stroke).
 */
export function blocksIntersectingPolygon(
  blocks: readonly LassoBlockInput[],
  polygon: readonly GridContinuousPoint[],
  strokeRadius = 0.55,
): string[] {
  if (polygon.length < 2) return [];
  const out: string[] = [];
  for (const block of blocks) {
    const cells = lassoBlockOccupiedCells(block);
    if (
      cells.some((c) =>
        cellIntersectsPolygon(c.row, c.col, polygon, strokeRadius),
      )
    ) {
      out.push(block.id);
    }
  }
  return out;
}

/**
 * Empty cells inside / near a freehand polygon. Unusable included by default.
 */
export function emptyCellsIntersectingPolygon(input: {
  polygon: readonly GridContinuousPoint[];
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
  includeUnusable?: boolean;
  strokeRadius?: number;
}): { row: number; col: number }[] {
  const polygon = input.polygon;
  if (polygon.length < 2) return [];
  const stroke = input.strokeRadius ?? 0.55;
  const includeUnusable = input.includeUnusable !== false;
  const occupied =
    input.occupiedKeys instanceof Set
      ? input.occupiedKeys
      : new Set(input.occupiedKeys || []);
  const unusable =
    input.unusableKeys instanceof Set
      ? input.unusableKeys
      : new Set(input.unusableKeys || []);
  const bounds = polygonBounds(polygon, stroke);
  if (bounds.maxRow < bounds.minRow || bounds.maxCol < bounds.minCol) return [];
  const rows = bounds.maxRow - bounds.minRow + 1;
  const cols = bounds.maxCol - bounds.minCol + 1;
  if (rows * cols > 10_000) {
    // Pathological freehand — still scan.
  }
  const out: { row: number; col: number }[] = [];
  for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      if (!cellIntersectsPolygon(row, col, polygon, stroke)) continue;
      const key = cellKeyOf(row, col);
      if (occupied.has(key)) continue;
      if (!includeUnusable && unusable.has(key)) continue;
      out.push({ row, col });
    }
  }
  return out;
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
    case "lasso_circle":
    case "lasso_freehand":
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
    case "clone":
      // Sole filled block → arm paste; multi/empty/zero disabled.
      return (
        state.canEdit &&
        state.hasGridOps &&
        !state.busy &&
        state.selectedBlockCount === 1
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
    // Demoted: not on strip (gesture drag + lasso submenu instead)
    if (tool === "move" || tool === "lasso_circle" || tool === "lasso_freehand") {
      return false;
    }
    if (
      tool === "select" ||
      tool === "lasso" ||
      tool === "clear_selection"
    ) {
      return true;
    }
    if (tool === "lock_until" || tool === "mark_unusable") {
      return Boolean(state.hasMapGroundOps ?? state.hasGridOps);
    }
    // merge/split/clone need grid-ops wiring
    return state.hasGridOps;
  });
}

/**
 * Pure: whether Clone left-strip tool is enabled for the current selection.
 * Creator + grid ops + exactly one filled block (source for paste).
 */
export function isCloneMapToolEnabled(
  state: BlockMapToolEnablementInput,
): boolean {
  return isBlockMapToolEnabled("clone", state);
}

/** Human labels for map-ground tools (shared by strip + authoring pane). */
export function blockMapToolLabel(tool: BlockMapToolId): string {
  switch (tool) {
    case "select":
      return "Select";
    case "move":
      return "Move (use Select: click-and-drag)";
    case "lasso":
      return "Lasso — region select (submenu: rect / circle / freehand)";
    case "lasso_circle":
      return "Circle lasso";
    case "lasso_freehand":
      return "Freehand lasso";
    case "merge":
      return "Merge";
    case "split":
      return "Split";
    case "clone":
      return "Clone — copy sole selected block onto an empty cell";
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

/** Short label for lasso shape chip. */
export function lassoShapeLabel(kind: LassoShapeKind): string {
  switch (kind) {
    case "circle":
      return "Circle";
    case "freehand":
      return "Freehand";
    default:
      return "Rect";
  }
}

/** Tooltip for lasso shape chip in the submenu. */
export function lassoShapeTooltip(kind: LassoShapeKind): string {
  switch (kind) {
    case "circle":
      return "Circle lasso — drag from center";
    case "freehand":
      return "Freehand lasso — draw a path";
    default:
      return "Rectangle lasso — drag a marquee";
  }
}
