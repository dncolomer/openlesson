/**
 * One owned workspace map selection decision.
 * Shell and map host both apply this result — no nonce side channel.
 */

import {
  clearWorkspaceBlockSelection,
  clearWorkspaceFilledBlockSelection,
  nextWorkspaceBlockSelection,
  type WorkspaceAddTargetCell,
} from "@/lib/workspace-right-pane";

export type WorkspaceMapSelection = {
  expandedBlockId: string | null;
  selectedFilledBlockIds: string[];
  emptyCells: WorkspaceAddTargetCell[];
};

export type WorkspaceMapSelectionAction =
  | { type: "clear" }
  | { type: "open_block"; blockId: string | null | undefined }
  | { type: "set_filled_ids"; blockIds: readonly string[] | null | undefined }
  | { type: "set_empty_cells"; cells: readonly WorkspaceAddTargetCell[] | null | undefined }
  | { type: "apply_search_blocks"; blockIds: readonly string[] }
  | { type: "apply_suggest_cells"; cells: readonly WorkspaceAddTargetCell[] };

export function emptyWorkspaceMapSelection(): WorkspaceMapSelection {
  return {
    expandedBlockId: clearWorkspaceBlockSelection(),
    selectedFilledBlockIds: clearWorkspaceFilledBlockSelection(),
    emptyCells: [],
  };
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

export function nextWorkspaceMapSelection(
  _current: WorkspaceMapSelection,
  action: WorkspaceMapSelectionAction,
): WorkspaceMapSelection {
  if (action.type === "clear") {
    return emptyWorkspaceMapSelection();
  }

  if (action.type === "open_block") {
    const expandedBlockId = nextWorkspaceBlockSelection(null, action.blockId);
    if (!expandedBlockId) return emptyWorkspaceMapSelection();
    return {
      expandedBlockId,
      selectedFilledBlockIds: clearWorkspaceFilledBlockSelection(),
      emptyCells: [],
    };
  }

  if (action.type === "set_filled_ids" || action.type === "apply_search_blocks") {
    const ids = cleanIds(action.blockIds);
    if (ids.length >= 2) {
      return {
        expandedBlockId: clearWorkspaceBlockSelection(),
        selectedFilledBlockIds: ids,
        emptyCells: [],
      };
    }
    if (ids.length === 1) {
      return {
        expandedBlockId: nextWorkspaceBlockSelection(null, ids[0]),
        selectedFilledBlockIds: clearWorkspaceFilledBlockSelection(),
        emptyCells: [],
      };
    }
    return emptyWorkspaceMapSelection();
  }

  const cells = cleanCells(action.cells);
  if (cells.length === 0) return emptyWorkspaceMapSelection();
  return {
    expandedBlockId: clearWorkspaceBlockSelection(),
    selectedFilledBlockIds: clearWorkspaceFilledBlockSelection(),
    emptyCells: cells,
  };
}

export type WorkspaceMapApplyPayload = {
  token: number;
  blockIds: string[] | null;
  emptyCells: WorkspaceAddTargetCell[] | null;
};

/** Host → grid apply payload for the same selection result (including explicit clear). */
export function mapSelectionToApplyPayload(
  selection: WorkspaceMapSelection,
  token: number,
): WorkspaceMapApplyPayload {
  if (selection.selectedFilledBlockIds.length > 0) {
    return {
      token,
      blockIds: selection.selectedFilledBlockIds,
      emptyCells: null,
    };
  }
  // 1-block open is encoded as blockIds:[id] — never as empty arrays (that is clear).
  if (selection.expandedBlockId) {
    return {
      token,
      blockIds: [selection.expandedBlockId],
      emptyCells: null,
    };
  }
  if (selection.emptyCells.length > 0) {
    return {
      token,
      blockIds: null,
      emptyCells: selection.emptyCells,
    };
  }
  return { token, blockIds: [], emptyCells: [] };
}

/** Reconstruct the same selection the grid applies from a host payload. */
export function mapSelectionFromApplyPayload(payload: {
  blockIds?: string[] | null;
  emptyCells?: WorkspaceAddTargetCell[] | null;
}): WorkspaceMapSelection {
  const blockIds = cleanIds(payload.blockIds);
  if (blockIds.length > 0) {
    return nextWorkspaceMapSelection(emptyWorkspaceMapSelection(), {
      type: "apply_search_blocks",
      blockIds,
    });
  }
  const emptyCells = cleanCells(payload.emptyCells);
  if (emptyCells.length > 0) {
    return nextWorkspaceMapSelection(emptyWorkspaceMapSelection(), {
      type: "apply_suggest_cells",
      cells: emptyCells,
    });
  }
  return emptyWorkspaceMapSelection();
}

/** How the map host should apply a next-selection result (including 1-block open). */
export function workspaceMapSelectionHostApply(next: WorkspaceMapSelection): {
  selectedBlockIds: string[];
  selectedEmptyCells: WorkspaceAddTargetCell[];
  selectNodeId: string | null;
  emitFilled: string[] | null;
  emitEmpty: WorkspaceAddTargetCell[] | null;
} {
  if (next.selectedFilledBlockIds.length > 0) {
    return {
      selectedBlockIds: next.selectedFilledBlockIds,
      selectedEmptyCells: [],
      selectNodeId: next.expandedBlockId,
      emitFilled: next.selectedFilledBlockIds,
      emitEmpty: null,
    };
  }
  if (next.expandedBlockId) {
    return {
      selectedBlockIds: [],
      selectedEmptyCells: [],
      selectNodeId: next.expandedBlockId,
      emitFilled: null,
      emitEmpty: null,
    };
  }
  if (next.emptyCells.length > 0) {
    return {
      selectedBlockIds: [],
      selectedEmptyCells: next.emptyCells,
      selectNodeId: null,
      emitFilled: null,
      emitEmpty: next.emptyCells,
    };
  }
  return {
    selectedBlockIds: [],
    selectedEmptyCells: [],
    selectNodeId: null,
    emitFilled: null,
    emitEmpty: null,
  };
}
