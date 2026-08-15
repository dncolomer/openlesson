/**
 * Pure helpers for the workspace three-column right pane on the Map surface:
 * map authoring by default; block detail when one block is open; combine when
 * 2+ filled blocks are multi-selected; add-block when a single empty is
 * selected; generate-shape when 2+ empties are multi-selected.
 * Sole multi-cell selection also enables a Split drawer on block detail.
 * Notes/files live under Context.
 *
 * Desktop widths: right column ~½ prior half-width (map larger).
 */

import { isMultiCellBlockSpan } from "@/lib/block-map-tools";

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

/** Shared Danger zone drawer — peer of Edit / Combine, never nested in them. */
export const WORKSPACE_EDITOR_DANGER_DRAWER_ID = "danger";
export const WORKSPACE_EDITOR_DANGER_DRAWER_TITLE = "Danger zone";

/**
 * Drawer ids on the 1-block editor surface (creator block detail).
 * Danger zone is a peer of Edit, not a section inside it.
 */
export function workspaceBlockDetailDrawerIds(input: {
  canEdit?: boolean;
  showSplit?: boolean;
  showExpand?: boolean;
  hasGoals?: boolean;
  showEffects?: boolean;
} = {}): string[] {
  const ids: string[] = ["simulation"];
  if (input.showSplit) ids.push("split");
  if (input.showExpand) ids.push("expand_block");
  if (input.canEdit) {
    ids.push("edit");
    ids.push(WORKSPACE_EDITOR_DANGER_DRAWER_ID);
  }
  if (input.hasGoals) ids.push("goals");
  if (input.showEffects ?? Boolean(input.canEdit)) {
    ids.push("effect_dynamic", "effect_generator");
  }
  ids.push("local");
  return ids;
}

/**
 * Drawer ids on the 2+-block editor surface (combine pane).
 * Danger zone is its own drawer, not mixed into Combine/Bridge/Edit.
 */
export function workspaceMultiSelectDrawerIds(): string[] {
  return [
    "combine",
    "bridge",
    "cluster",
    "dag",
    "simulation",
    WORKSPACE_EDITOR_DANGER_DRAWER_ID,
  ];
}

export function isWorkspaceEditorDangerDrawer(id: string | null | undefined): boolean {
  return String(id || "").trim() === WORKSPACE_EDITOR_DANGER_DRAWER_ID;
}

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



/**
 * Footprint fields needed to decide Split eligibility (merged / multi-cell block).
 */
export type SplitCandidateBlock = {
  id?: string | null;
  span_w?: number | null;
  span_h?: number | null;
  /** Freeform mask cells; length > 1 also counts as multi-cell. */
  shape_cells?: ReadonlyArray<unknown> | null;
};

/**
 * True when a block occupies more than one grid cell (rect span or freeform mask).
 * Same spirit as toolbar split enablement.
 */
export function blockOffersSplitDrawer(block: SplitCandidateBlock | null | undefined): boolean {
  if (!block) return false;
  if (isMultiCellBlockSpan(block)) return true;
  if (Array.isArray(block.shape_cells) && block.shape_cells.length > 1) return true;
  return false;
}

/**
 * Approximate occupied cell count for split preview chrome.
 * Prefers freeform mask length; else span_w × span_h.
 */
export function splitTargetCellCount(block: SplitCandidateBlock | null | undefined): number {
  if (!block) return 1;
  if (Array.isArray(block.shape_cells) && block.shape_cells.length > 0) {
    return Math.max(1, block.shape_cells.length);
  }
  const w = Math.max(1, Math.floor(Number(block.span_w) || 1));
  const h = Math.max(1, Math.floor(Number(block.span_h) || 1));
  return w * h;
}

/**
 * Sole selected multi-cell block → Split drawer may be offered on block detail.
 * ≥2 ids never offer sole-split (combine path owns that selection).
 * 1×1 sole → not available.
 */
export function resolveSplitDrawerAvailability(input: {
  selectedBlockId?: string | null;
  selectedBlockIds?: readonly string[] | null;
  block?: SplitCandidateBlock | null;
}): { available: boolean; blockId: string | null; cellCount: number } {
  const multiIds = (input.selectedBlockIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (multiIds.length >= 2) {
    return { available: false, blockId: null, cellCount: 1 };
  }
  const id =
    multiIds.length === 1
      ? multiIds[0]
      : typeof input.selectedBlockId === "string" && input.selectedBlockId.trim()
        ? input.selectedBlockId.trim()
        : null;
  if (!id) return { available: false, blockId: null, cellCount: 1 };
  const block = input.block;
  if (!blockOffersSplitDrawer(block)) {
    return { available: false, blockId: id, cellCount: splitTargetCellCount(block) };
  }
  return {
    available: true,
    blockId: id,
    cellCount: splitTargetCellCount(block),
  };
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

/**
 * Accordion: which drawer id should be open after a header click.
 * Opening one drawer always closes others (returns the clicked id).
 * Clicking the already-open drawer collapses all (returns null).
 */
export function nextAccordionOpenDrawerId(input: {
  currentOpenId: string | null | undefined;
  clickedId: string;
}): string | null {
  const clicked = String(input.clickedId || "").trim();
  if (!clicked) return null;
  const cur =
    input.currentOpenId == null ? null : String(input.currentOpenId).trim() || null;
  if (cur === clicked) return null;
  return clicked;
}

/**
 * Initial open drawer for an accordion stack: first candidate with
 * defaultExpanded true, else the first id, else null.
 */
export function initialAccordionOpenDrawerId(
  candidates: readonly { id: string; defaultExpanded?: boolean }[],
): string | null {
  if (!candidates?.length) return null;
  const preferred = candidates.find((c) => c.defaultExpanded && String(c.id || "").trim());
  if (preferred) return String(preferred.id).trim();
  const first = String(candidates[0]?.id || "").trim();
  return first || null;
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
