/**
 * Pure tool-mode and enablement rules for the block map Photoshop-style tool strip.
 * Kept free of React so unit tests can drive the real decision logic.
 */

export type BlockMapModeTool = "select" | "move";

export type BlockMapToolId =
  | "select"
  | "move"
  | "merge"
  | "split"
  | "edit"
  | "generate_shape"
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

export const DEFAULT_BLOCK_MAP_MODE: BlockMapModeTool = "select";

/** Primary strip order: modes, then block actions, then viewport. */
export const BLOCK_MAP_TOOL_STRIP: readonly BlockMapToolId[] = [
  "select",
  "move",
  "merge",
  "split",
  "edit",
  "generate_shape",
  "clear_selection",
  "zoom_in",
  "zoom_out",
  "recenter",
] as const;

export function blockMapToolKind(tool: BlockMapToolId): BlockMapToolKind {
  if (tool === "select" || tool === "move") return "mode";
  if (tool === "zoom_in" || tool === "zoom_out" || tool === "recenter") return "viewport";
  return "action";
}

export function isBlockMapModeTool(tool: BlockMapToolId): tool is BlockMapModeTool {
  return tool === "select" || tool === "move";
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
 * - Explicit Shift / ⌘ / Ctrl always multi-selects.
 * - Select tool: every plain click toggles membership (same as empty cells) —
 *   filled blocks and empties share one multi-select model.
 * - Move tool: plain click replaces selection (or keeps multi-group for drag);
 *   modifiers still multi-select.
 */
export function isBlockMultiSelectGesture(input: {
  multiModifier: boolean;
  activeTool: BlockMapModeTool;
  prevSelectedBlockCount: number;
}): boolean {
  if (input.multiModifier) return true;
  // Select tool is multi-toggle for every click (empty cells work the same way).
  if (input.activeTool === "select") return true;
  return false;
}

/**
 * Pure toggle/replace for filled-block selection lists.
 * Prefer this for UI apply paths so Select multi-select cannot silently replace.
 */
export function toggleOrReplaceBlockSelection(input: {
  blockId: string;
  /** When true, add/remove; when false, replace with only this id. */
  multi: boolean;
  prevSelectedBlockIds: readonly string[];
}): string[] {
  if (input.multi) {
    return input.prevSelectedBlockIds.includes(input.blockId)
      ? input.prevSelectedBlockIds.filter((id) => id !== input.blockId)
      : [...input.prevSelectedBlockIds, input.blockId];
  }
  return [input.blockId];
}

/**
 * Resolve which blocks are selected after a block-cell interaction.
 * Select tool: always toggle membership. Move tool: plain click focuses one
 * (unless modifier multi-select).
 */
export function resolveBlockSelectionOnClick(input: {
  blockId: string;
  multiModifier: boolean;
  prevSelectedBlockIds: readonly string[];
  /** Select = always multi-toggle; Move = plain replaces unless modifier. */
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
 * Whether an empty-cell click should toggle multi-select (vs open the add dialog).
 * Select tool always multi-selects empties; Move always multi-selects empties;
 * with no active multi mode, plain empty opens add (legacy single-cell path).
 */
export function isEmptyCellMultiSelectGesture(input: {
  multiModifier: boolean;
  activeTool: BlockMapModeTool;
  prevSelectedEmptyCount: number;
}): boolean {
  if (input.multiModifier) return true;
  if (input.activeTool === "select") return true;
  if (input.activeTool === "move") return true;
  // Fallback: continue multi if already selecting empties
  return input.prevSelectedEmptyCount > 0;
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
    case "edit":
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
    case "clear_selection":
      return (
        state.canEdit &&
        (state.selectedBlockCount > 0 || state.selectedEmptyCellCount > 0)
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
  state: Pick<BlockMapToolEnablementInput, "canEdit" | "hasGridOps">,
): BlockMapToolId[] {
  return BLOCK_MAP_TOOL_STRIP.filter((tool) => {
    const kind = blockMapToolKind(tool);
    if (kind === "viewport") return true;
    if (!state.canEdit) return false;
    if (tool === "select" || tool === "clear_selection") return true;
    // Move + shape/merge/split/edit need grid-ops wiring
    return state.hasGridOps;
  });
}
