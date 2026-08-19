/**
 * One exclusive workspace map selection.
 * Shell and map host share this union — no encode/decode, no nonce side channel.
 */

import {
  nextWorkspaceBlockSelection,
  type WorkspaceAddTargetCell,
} from "@/lib/workspace-right-pane";

export type WorkspaceMapSelection =
  | { kind: "none" }
  | { kind: "block"; id: string }
  | { kind: "blocks"; ids: string[] }
  | { kind: "empties"; cells: WorkspaceAddTargetCell[] };

export type WorkspaceMapSelectionAction =
  | { type: "clear" }
  | { type: "open_block"; blockId: string | null | undefined }
  | { type: "set_filled_ids"; blockIds: readonly string[] | null | undefined }
  | { type: "set_empty_cells"; cells: readonly WorkspaceAddTargetCell[] | null | undefined };

export function emptyWorkspaceMapSelection(): WorkspaceMapSelection {
  return { kind: "none" };
}

function cleanIds(ids: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids || []) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cleanCells(
  cells: readonly WorkspaceAddTargetCell[] | null | undefined,
): WorkspaceAddTargetCell[] {
  const seen = new Set<string>();
  const out: WorkspaceAddTargetCell[] = [];
  for (const cell of cells || []) {
    if (!cell || !Number.isFinite(cell.row) || !Number.isFinite(cell.col)) continue;
    const next = { row: Math.trunc(cell.row), col: Math.trunc(cell.col) };
    const key = `${next.row}:${next.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

export function mapSelectionExpandedId(selection: WorkspaceMapSelection): string | null {
  return selection.kind === "block" ? selection.id : null;
}

export function mapSelectionFilledIds(selection: WorkspaceMapSelection): string[] {
  return selection.kind === "blocks" ? selection.ids : [];
}

export function mapSelectionEmptyCells(
  selection: WorkspaceMapSelection,
): WorkspaceAddTargetCell[] {
  return selection.kind === "empties" ? selection.cells : [];
}

/** Highlight set the map host paints — sole block or multi-fill, never both. */
export function mapSelectionHighlightIds(selection: WorkspaceMapSelection): string[] {
  const expanded = mapSelectionExpandedId(selection);
  return expanded ? [expanded] : mapSelectionFilledIds(selection);
}

export function nextWorkspaceMapSelection(
  action: WorkspaceMapSelectionAction,
): WorkspaceMapSelection {
  if (action.type === "clear") return emptyWorkspaceMapSelection();

  if (action.type === "open_block") {
    const id = nextWorkspaceBlockSelection(null, action.blockId);
    return id ? { kind: "block", id } : emptyWorkspaceMapSelection();
  }

  if (action.type === "set_filled_ids") {
    const ids = cleanIds(action.blockIds);
    if (ids.length >= 2) return { kind: "blocks", ids };
    if (ids.length === 1) return { kind: "block", id: ids[0]! };
    return emptyWorkspaceMapSelection();
  }

  const cells = cleanCells(action.cells);
  if (cells.length === 0) return emptyWorkspaceMapSelection();
  return { kind: "empties", cells };
}


