"use client";

import { useEffect, useState } from "react";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import {
  WORKSPACE_EDITOR_DANGER_DRAWER_ID,
  WORKSPACE_EDITOR_DANGER_DRAWER_TITLE,
} from "@/lib/workspace-right-pane";
import type { CombineBlockRef } from "@/components/WorkspaceCombineBlocksPane";

export function DangerBlocksDrawer({
  selected,
  busy,
  selectionKey,
  onDeleteBlocks,
}: {
  selected: CombineBlockRef[];
  busy: boolean;
  selectionKey: string;
  onDeleteBlocks?: (input: { blockIds: string[] }) => Promise<void> | void;
}) {
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setDeleteError(null);
  }, [selectionKey, selected]);

  const submitDelete = async () => {
    if (!onDeleteBlocks || deleteSubmitting || busy || selected.length < 2) {
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await onDeleteBlocks({ blockIds: selected.map((n) => n.id) });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete blocks",
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawer
      variant="section"
      drawerId={WORKSPACE_EDITOR_DANGER_DRAWER_ID}
      title={WORKSPACE_EDITOR_DANGER_DRAWER_TITLE}
      defaultExpanded={false}
      bodyClassName="space-y-3"
      surfaceDataAttr="data-multi-block-delete-drawer"
      tone="danger"
    >
      <div
        data-multi-block-delete-pane
        data-block-danger-drawer
        className="space-y-3"
      >
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Permanently remove{" "}
          <span className="text-neutral-200">{selected.length}</span> selected
          blocks.
        </p>
        <ul className="space-y-1" data-delete-block-list>
          {selected.map((b) => (
            <li
              key={b.id}
              data-delete-block-row={b.id}
              className="rounded-none border border-white/10 bg-black/20 px-2 py-1.5 text-[12px] text-neutral-200"
            >
              {b.title || "Untitled"}
            </li>
          ))}
        </ul>
        {deleteError ? (
          <p className="text-xs text-red-400/90" data-delete-error>
            {deleteError}
          </p>
        ) : null}
        <button
          type="button"
          data-multi-block-delete
          data-delete-blocks-submit
          disabled={
            busy ||
            deleteSubmitting ||
            selected.length < 2 ||
            !onDeleteBlocks
          }
          onClick={() => void submitDelete()}
          className="w-full rounded-none border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {deleteSubmitting
            ? "Deleting…"
            : `Delete ${selected.length} blocks`}
        </button>
      </div>
    </WorkspaceRightPaneDrawer>
  );
}
