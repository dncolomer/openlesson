"use client";

import { useEffect, useState } from "react";

/**
 * Single-block Danger zone body — delete for the current selection.
 * Mounted in the peer Danger zone drawer, not inside Edit.
 */
export function WorkspaceBlockDangerPanel({
  blockId,
  title,
  canEdit,
  busy = false,
  onDelete,
}: {
  blockId: string;
  title: string;
  canEdit: boolean;
  busy?: boolean;
  onDelete?: (blockId: string) => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirmDelete(false);
    setError(null);
    setDeleting(false);
  }, [blockId]);

  const remove = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(blockId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete block");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const disabled = busy || deleting || !canEdit;

  return (
    <div
      className="space-y-3"
      data-block-danger-pane
      data-block-edit-delete-section
      data-block-id={blockId}
    >
      {error ? (
        <p className="text-[11px] text-red-400/90" data-block-edit-error>
          {error}
        </p>
      ) : null}
      {!confirmDelete ? (
        <button
          type="button"
          data-block-edit-delete
          data-block-danger-delete
          disabled={disabled || !onDelete}
          onClick={() => setConfirmDelete(true)}
          className="w-full rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-200 transition hover:border-red-400/60 hover:bg-red-950/50 disabled:opacity-40"
        >
          Delete block
        </button>
      ) : (
        <div className="space-y-2" data-block-edit-delete-confirm>
          <p className="text-[11px] leading-snug text-neutral-400">
            Delete <span className="text-neutral-200">“{title}”</span>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              data-block-edit-delete-cancel
              disabled={disabled}
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              data-block-edit-delete-confirm-btn
              disabled={disabled}
              onClick={() => void remove()}
              className="flex-1 rounded-md border border-red-500/50 bg-red-600/90 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
