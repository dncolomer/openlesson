/**
 * Pure helpers for the workspace three-column right pane:
 * notes/files by default; block detail when a block is open (double-click).
 */

export type WorkspaceRightPaneKind = "notes_files" | "block_detail";

/**
 * Decide which surface the right column should show.
 * Missing / empty selection → notes and files; any non-empty id → block detail.
 */
export function resolveWorkspaceRightPane(
  selectedBlockId: string | null | undefined,
): WorkspaceRightPaneKind {
  if (typeof selectedBlockId === "string" && selectedBlockId.trim()) {
    return "block_detail";
  }
  return "notes_files";
}

/** Close / unselect path — always null so notes/files return. */
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
