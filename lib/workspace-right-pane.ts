/**
 * Pure helpers for the workspace three-column right pane on the Map surface:
 * map authoring by default; block detail when one block is open; combine when
 * 2+ filled blocks are multi-selected; add-block when a single empty is
 * selected; generate-shape when 2+ empties are multi-selected.
 * Notes/files live under Context.
 *
 * Desktop widths: right column ~½ prior half-width (map larger).
 */

export type WorkspaceRightPaneKind =
  | "map_tools"
  | "block_detail"
  | "combine_blocks"
  | "add_block"
  | "generate_shape";

/** Grid cell used as the place-new-block target. */
export type WorkspaceAddTargetCell = { row: number; col: number };

/**
 * Right-pane surface driven by empty-cell selection (not block detail).
 * Single placeable empty → Add; 2+ placeable empties → multi create form.
 */
export type EmptySelectionSurface =
  | { kind: "add_block"; cell: WorkspaceAddTargetCell }
  | { kind: "generate_shape"; cells: WorkspaceAddTargetCell[] };

/**
 * Desktop Tailwind width tokens for map (sessions) vs right column.
 * Map ~¾, right ~¼ (right is ~50% narrower than previous md:w-1/2 split).
 */
export const WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS = "md:w-3/4";
export const WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS = "md:w-1/4";

/**
 * Block-detail drawers (Photoshop-style exclusive panels).
 * Prompt tab removed — local context + simulation only.
 */
export type BlockDetailMiniTab =
  | "local"
  | "examples"
  | "content_samples"
  | "simulation";

export const BLOCK_DETAIL_MINI_TABS: readonly BlockDetailMiniTab[] = [
  "local",
  "simulation",
] as const;

export function isBlockDetailMiniTab(value: unknown): value is BlockDetailMiniTab {
  return (
    value === "local" ||
    value === "examples" ||
    value === "content_samples" ||
    value === "simulation"
  );
}

export function nextBlockDetailMiniTab(
  current: BlockDetailMiniTab | null | undefined,
  next: unknown,
): BlockDetailMiniTab {
  if (isBlockDetailMiniTab(next)) return next;
  return current && isBlockDetailMiniTab(current) ? current : "local";
}

/**
 * Toggle exclusive drawer: open `clicked` unless it is already open (then keep open —
 * always exactly one drawer expanded for the drawer UI).
 */
export function resolveExclusiveBlockDetailDrawer(
  current: BlockDetailMiniTab | null | undefined,
  clicked: unknown,
): BlockDetailMiniTab {
  if (isBlockDetailMiniTab(clicked)) return clicked;
  return current && isBlockDetailMiniTab(current) ? current : "local";
}

function unusableKeySet(
  unusableKeys?: ReadonlySet<string> | readonly string[] | null,
): Set<string> {
  if (unusableKeys instanceof Set) return unusableKeys;
  return new Set(unusableKeys || []);
}

function isFiniteCell(cell: WorkspaceAddTargetCell | null | undefined): cell is WorkspaceAddTargetCell {
  return (
    !!cell &&
    Number.isFinite(cell.row) &&
    Number.isFinite(cell.col)
  );
}

/**
 * Placeable empties only (drops unusable / invalid cells).
 */
export function filterPlaceableEmptyCells(input: {
  selectedEmptyCells: readonly WorkspaceAddTargetCell[];
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): WorkspaceAddTargetCell[] {
  const unusable = unusableKeySet(input.unusableKeys);
  const out: WorkspaceAddTargetCell[] = [];
  for (const cell of input.selectedEmptyCells || []) {
    if (!isFiniteCell(cell)) continue;
    if (unusable.has(`${cell.row}:${cell.col}`)) continue;
    out.push({ row: cell.row, col: cell.col });
  }
  return out;
}

/**
 * Single placeable empty cell → open Add block in the right pane.
 * Multi empty / unusable-only → null (use resolveEmptySelectionSurface for multi).
 */
export function resolveEmptyAddTarget(input: {
  selectedEmptyCells: readonly WorkspaceAddTargetCell[];
  /** Keys `"row:col"` that cannot receive a new block. */
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): WorkspaceAddTargetCell | null {
  const placeable = filterPlaceableEmptyCells(input);
  if (placeable.length !== 1) return null;
  return placeable[0];
}

/**
 * Empty selection → right-pane create surface.
 * 1 placeable → single Add; 2+ placeable → generate-in-shape multi form.
 */
export function resolveEmptySelectionSurface(input: {
  selectedEmptyCells: readonly WorkspaceAddTargetCell[];
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): EmptySelectionSurface | null {
  const placeable = filterPlaceableEmptyCells(input);
  if (placeable.length === 1) {
    return { kind: "add_block", cell: placeable[0] };
  }
  if (placeable.length >= 2) {
    return { kind: "generate_shape", cells: placeable };
  }
  return null;
}

/**
 * Multi-select of filled map blocks → combine surface; sole id → detail.
 * Empty / invalid → null (caller falls through to empty/map surfaces).
 */
export function resolveFilledBlockSelectionSurface(
  selectedBlockIds: readonly string[] | null | undefined,
):
  | { kind: "combine_blocks"; blockIds: string[] }
  | { kind: "block_detail"; blockId: string }
  | null {
  const ids = (selectedBlockIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  // De-dupe while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (unique.length >= 2) {
    return { kind: "combine_blocks", blockIds: unique };
  }
  if (unique.length === 1) {
    return { kind: "block_detail", blockId: unique[0] };
  }
  return null;
}

/**
 * Decide which surface the right column should show on the map section.
 * Priority: 2+ filled blocks → combine; single block detail; empty create
 * (single Add or multi generate); otherwise map authoring tools.
 *
 * Second arg accepts either the modern EmptySelectionSurface or a legacy single cell.
 * Third arg is the multi-select filled-block id list from the map strip.
 */
export function resolveWorkspaceRightPane(
  selectedBlockId: string | null | undefined,
  emptySurfaceOrAddCell?: EmptySelectionSurface | WorkspaceAddTargetCell | null,
  selectedBlockIds?: readonly string[] | null,
): WorkspaceRightPaneKind {
  // Prefer explicit multi-select list when present (map Shift/lasso multi).
  const multi = resolveFilledBlockSelectionSurface(selectedBlockIds);
  if (multi?.kind === "combine_blocks") {
    return "combine_blocks";
  }
  if (multi?.kind === "block_detail") {
    return "block_detail";
  }
  if (typeof selectedBlockId === "string" && selectedBlockId.trim()) {
    return "block_detail";
  }
  const surface = normalizeEmptySurfaceArg(emptySurfaceOrAddCell);
  if (surface?.kind === "generate_shape" && surface.cells.length >= 2) {
    return "generate_shape";
  }
  if (surface?.kind === "add_block" && isFiniteCell(surface.cell)) {
    return "add_block";
  }
  return "map_tools";
}

/** Clear multi-filled-block selection (right-pane combine host). */
export function clearWorkspaceFilledBlockSelection(): string[] {
  return [];
}

function normalizeEmptySurfaceArg(
  arg: EmptySelectionSurface | WorkspaceAddTargetCell | null | undefined,
): EmptySelectionSurface | null {
  if (arg == null) return null;
  if ("kind" in arg) return arg;
  // Legacy: bare cell → single-add surface
  if (isFiniteCell(arg)) return { kind: "add_block", cell: arg };
  return null;
}

/** @deprecated Use resolveWorkspaceRightPane — notes/files moved to Context section. */
export function resolveWorkspaceRightPaneLegacyNotesFiles(
  selectedBlockId: string | null | undefined,
): "notes_files" | "block_detail" {
  return resolveWorkspaceRightPane(selectedBlockId) === "block_detail"
    ? "block_detail"
    : "notes_files";
}

/** Clear the empty-cell add target (cancel / after place). */
export function clearWorkspaceAddTarget(): null {
  return null;
}

/**
 * Collapse/expand state for top-anchored right-pane form drawers.
 * Pure so tests drive the same toggle the UI uses.
 */
export function nextRightPaneDrawerExpanded(
  current: boolean,
  action: "toggle" | "open" | "close",
): boolean {
  if (action === "open") return true;
  if (action === "close") return false;
  return !current;
}

/** Close / unselect path — always null so map tools return. */
export function clearWorkspaceBlockSelection(): null {
  return null;
}

/**
 * Next selection after open/close. Open sets the id; close (null/empty) clears.
 * Same path used by the X control and map clear.
 */
export function nextWorkspaceBlockSelection(
  currentId: string | null | undefined,
  nextId: string | null | undefined,
): string | null {
  if (nextId == null) return clearWorkspaceBlockSelection();
  const trimmed = String(nextId).trim();
  if (!trimmed) return clearWorkspaceBlockSelection();
  // Re-open same id is fine (idempotent); empty current treated as open.
  return trimmed;
}
