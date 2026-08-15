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

export type WorkspaceMapApplyPayload = {
  token: number;
  selection: WorkspaceMapSelection;
};

export function mapSelectionToApplyPayload(
  selection: WorkspaceMapSelection,
  token: number,
): WorkspaceMapApplyPayload {
  return { token, selection };
}

/**
 * Map host → shell after a commit. Exclusive hosts get the committed
 * selection as-is. Never follow blocks/empties with open_block(null) —
 * that action is a full clear.
 */
export function notifyMapHostCommit(
  selection: WorkspaceMapSelection,
  exclusive: ((next: WorkspaceMapSelection) => void) | undefined,
  legacySelect: (blockId: string | null) => void,
): WorkspaceMapSelection {
  if (exclusive) {
    exclusive(selection);
    return selection;
  }
  legacySelect(mapSelectionExpandedId(selection));
  return selection;
}
