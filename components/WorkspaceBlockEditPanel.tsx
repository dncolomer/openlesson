"use client";

import { useEffect, useState } from "react";
import { normalizeStarterFlag } from "@/lib/block-starter-flag";

/**
 * Owner-facing block update/delete form for the block-detail Edit drawer.
 * Replaces the map sidebar pen tool + overlay modal.
 */
export function WorkspaceBlockEditPanel({
  blockId,
  title,
  description,
  isStart = false,
  canEdit,
  busy = false,
  onUpdate,
  onDelete,
}: {
  blockId: string;
  title: string;
  description?: string | null;
  /** Current starter / potential start flag on the block. */
  isStart?: boolean | null;
  canEdit: boolean;
  busy?: boolean;
  onUpdate?: (input: {
    blockId: string;
    title: string;
    description: string;
    isStart: boolean;
  }) => Promise<void> | void;
  onDelete?: (blockId: string) => Promise<void> | void;
}) {
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || "");
  const [editIsStart, setEditIsStart] = useState(Boolean(isStart));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft when switching blocks or when saved values change externally.
  useEffect(() => {
    setEditTitle(title);
    setEditDescription(description || "");
    setEditIsStart(Boolean(isStart));
    setConfirmDelete(false);
    setError(null);
  }, [blockId, title, description, isStart]);

  if (!canEdit) {
    return (
      <div data-block-edit-readonly className="space-y-1.5">
        <p className="text-[11px] text-neutral-500">
          Only the workspace owner can update or delete this block.
        </p>
        <p className="text-xs font-medium text-neutral-200">{title}</p>
        {description ? (
          <p className="text-[11px] leading-relaxed text-neutral-400">{description}</p>
        ) : null}
        {isStart ? (
          <p className="text-[10px] text-neutral-500" data-block-edit-starter-readonly>
            Starter block
          </p>
        ) : null}
      </div>
    );
  }

  const dirty =
    editTitle.trim() !== (title || "").trim() ||
    (editDescription || "").trim() !== (description || "").trim() ||
    editIsStart !== Boolean(isStart);

  const save = async () => {
    if (!onUpdate || !editTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        blockId,
        title: editTitle.trim(),
        description: editDescription.trim(),
        isStart: normalizeStarterFlag(editIsStart),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

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

  const disabled = busy || saving || deleting;

  return (
    <div data-block-edit-panel data-block-id={blockId} className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Update block
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-500">Title</span>
        <input
          data-block-edit-title
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          placeholder="Block title"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-500">Description</span>
        <textarea
          data-block-edit-description
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          disabled={disabled}
          rows={4}
          className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          placeholder="What this block covers…"
        />
      </label>

      <label
        className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2.5 py-2"
        data-block-edit-starter
      >
        <input
          type="checkbox"
          data-block-edit-starter-input
          checked={editIsStart}
          disabled={disabled}
          onChange={(e) => setEditIsStart(e.target.checked)}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-neutral-200">
            Starter block
          </span>
          <span className="mt-0.5 block text-[10px] leading-snug text-neutral-500">
            Flag as a potential start for learning paths on this map.
          </span>
        </span>
      </label>

      {error ? (
        <p className="text-[11px] text-red-400/90" data-block-edit-error>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-block-edit-save
        disabled={disabled || !editTitle.trim() || !dirty}
        onClick={() => void save()}
        className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>

      <div
        className="border-t border-neutral-800/80 pt-3"
        data-block-edit-delete-section
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Danger zone
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            data-block-edit-delete
            disabled={disabled || !onDelete}
            onClick={() => setConfirmDelete(true)}
            className="mt-2 w-full rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-200 transition hover:border-red-400/60 hover:bg-red-950/50 disabled:opacity-40"
          >
            Delete block
          </button>
        ) : (
          <div className="mt-2 space-y-2" data-block-edit-delete-confirm>
            <p className="text-[11px] leading-snug text-neutral-400">
              Delete <span className="text-neutral-200">“{title}”</span>? This removes
              the block from the map. This cannot be undone.
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
    </div>
  );
}
