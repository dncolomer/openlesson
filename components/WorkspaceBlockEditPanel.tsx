"use client";

import { useEffect, useState } from "react";

/**
 * Owner-facing block update form for the block-detail Edit drawer.
 * Destructive delete is a sibling drawer, not part of this form.
 * Calibrate, Learn, and Verify are always available; they are not edited here.
 */
export function WorkspaceBlockEditPanel({
  blockId,
  title,
  description,
  isStart = false,
  canEdit,
  busy = false,
  onUpdate,
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
    isStart?: boolean;
  }) => Promise<void> | void;
}) {
  void isStart;
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditTitle(title);
    setEditDescription(description || "");
    setError(null);
  }, [blockId, title, description]);

  if (!canEdit) {
    return (
      <div data-block-edit-readonly className="space-y-1.5">
        <p className="text-[11px] text-neutral-500">
          Only the workspace owner can update this block.
        </p>
        <p className="text-xs font-medium text-neutral-200">{title}</p>
        {description ? (
          <p className="text-[11px] leading-relaxed text-neutral-400">{description}</p>
        ) : null}
      </div>
    );
  }

  const dirty =
    editTitle.trim() !== (title || "").trim() ||
    (editDescription || "").trim() !== (description || "").trim();

  const save = async () => {
    if (!onUpdate || !editTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        blockId,
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  const disabled = busy || saving;

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
          className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
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
          className="w-full resize-none rounded-none border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          placeholder="What this block covers…"
        />
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
        className="w-full rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
