"use client";

import { useMemo, useState } from "react";
import { MultiBlockDagCanvas } from "@/components/MultiBlockDagCanvas";
import { MultiBlockDagPreview } from "@/components/MultiBlockDagPreview";
import {
  multiBlockDagEdgeCounts,
  multiBlockDagHasCycle,
  setMultiBlockDagEdge,
  type MultiBlockDagDraft,
} from "@/lib/multi-block-dag";
import {
  listWorkspaceDagsForTab,
  seedWorkspaceDagEditDraft,
  type WorkspaceDagListItem,
} from "@/lib/workspace-dags";

export type WorkspaceDagsPanelBlock = {
  id: string;
  title?: string | null;
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
  position_x?: number | null;
  position_y?: number | null;
};

/**
 * Creator DAGs tab: grid of DAG cards with visual previews; edit leads-to; delete.
 * No create control — creation stays on map multi-select Apply.
 */
export function WorkspaceDagsPanel({
  workspaceDags,
  blocks,
  busy = false,
  onSaveEdit,
  onDelete,
}: {
  workspaceDags: unknown;
  blocks: readonly WorkspaceDagsPanelBlock[];
  busy?: boolean;
  onSaveEdit: (input: {
    dagId: string;
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void> | void;
  onDelete: (input: { dagId: string }) => Promise<void> | void;
}) {
  const items = useMemo(
    () => listWorkspaceDagsForTab(workspaceDags, blocks),
    [workspaceDags, blocks],
  );

  /** Seed drafts for card previews (live next among each DAG’s blocks). */
  const previewById = useMemo(() => {
    const map = new Map<
      string,
      {
        draft: MultiBlockDagDraft;
        canvasBlocks: Array<{
          id: string;
          title: string;
          position_x?: number | null;
          position_y?: number | null;
        }>;
        edgeCount: number;
      }
    >();
    for (const item of items) {
      const draft = seedWorkspaceDagEditDraft(item, blocks);
      const canvasBlocks = draft.blockIds.map((id) => {
        const b = blocks.find((x) => x.id === id);
        return {
          id,
          title: b?.title || "Untitled",
          position_x: b?.position_x,
          position_y: b?.position_y,
        };
      });
      map.set(item.id, {
        draft,
        canvasBlocks,
        edgeCount: multiBlockDagEdgeCounts(draft).next,
      });
    }
    return map;
  }, [items, blocks]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<MultiBlockDagDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editingItem = items.find((i) => i.id === editingId) || null;
  const editCounts = editDraft ? multiBlockDagEdgeCounts(editDraft) : null;
  const editHasCycle = editDraft
    ? multiBlockDagHasCycle(editDraft, "next")
    : false;

  const openEdit = (item: WorkspaceDagListItem) => {
    setError(null);
    setConfirmDeleteId(null);
    setEditingId(item.id);
    setEditDraft(seedWorkspaceDagEditDraft(item, blocks));
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setError(null);
  };

  const toggleEdge = (
    from: string,
    to: string,
    _kind: "next" | "lock",
    enabled: boolean,
  ) => {
    setEditDraft((prev) =>
      prev
        ? setMultiBlockDagEdge(prev, { from, to, kind: "next" }, enabled)
        : prev,
    );
  };

  const saveEdit = async () => {
    if (!editingId || !editDraft || saving || busy) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveEdit({ dagId: editingId, dagDraft: editDraft });
      closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save DAG");
    } finally {
      setSaving(false);
    }
  };

  const runDelete = async (dagId: string) => {
    if (deletingId || busy) return;
    setDeletingId(dagId);
    setError(null);
    try {
      await onDelete({ dagId });
      setConfirmDeleteId(null);
      if (editingId === dagId) closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete DAG");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      data-workspace-dags-section
      data-workspace-dags-panel
      data-dag-list-count={items.length}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="mb-3 shrink-0">
        <h2 className="text-sm font-semibold text-white">DAGs</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
          Journey graphs on this workspace. Open a card to edit leads-to links,
          or delete. Create new graphs from the map (multi-select → DAG → Apply).
        </p>
      </div>

      {error ? (
        <p className="mb-2 text-xs text-red-400/90" data-workspace-dags-error>
          {error}
        </p>
      ) : null}

      {editingId && editDraft && editingItem ? (
        <div
          data-workspace-dag-edit
          data-workspace-dag-edit-id={editingId}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-white/10 bg-neutral-950/80 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-neutral-100">
                {editingItem.displayTitle}
              </p>
              <p className="text-[10px] text-neutral-500">
                {editDraft.blockIds.length} blocks
                {editCounts ? ` · ${editCounts.next} links` : ""}
              </p>
            </div>
            <button
              type="button"
              data-workspace-dag-edit-cancel
              onClick={closeEdit}
              className="shrink-0 rounded px-2 py-1 text-[10px] text-neutral-400 hover:text-white"
            >
              Back
            </button>
          </div>

          <MultiBlockDagCanvas
            blocks={editDraft.blockIds.map((id) => {
              const b = blocks.find((x) => x.id === id);
              return {
                id,
                title: b?.title || "Untitled",
                position_x: b?.position_x,
                position_y: b?.position_y,
              };
            })}
            draft={editDraft}
            disabled={busy || saving}
            onToggleEdge={toggleEdge}
          />

          {editHasCycle ? (
            <p
              className="rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-200/90"
              data-dag-cycle-warning
            >
              Draft has a directed cycle. You can still save; prefer acyclic
              journeys when order matters.
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              data-workspace-dag-edit-save
              disabled={busy || saving}
              onClick={() => void saveEdit()}
              className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              data-workspace-dag-edit-cancel-footer
              disabled={saving}
              onClick={closeEdit}
              className="rounded-md border border-white/15 px-3 py-2 text-xs text-neutral-300 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto" data-workspace-dag-list>
          {items.length === 0 ? (
            <div
              data-workspace-dags-empty
              className="rounded-lg border border-dashed border-white/10 bg-neutral-950/50 px-4 py-8 text-center"
            >
              <p className="text-xs text-neutral-300">No DAGs yet</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
                Multi-select 2–9 blocks on the map, open the DAG drawer, connect
                leads-to links, and Apply. Graphs already on the map (leads-to
                links) also appear here automatically.
              </p>
            </div>
          ) : (
            <ul
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              data-workspace-dag-grid
              data-workspace-dag-list-ul
            >
              {items.map((item) => {
                const preview = previewById.get(item.id);
                return (
                  <li
                    key={item.id}
                    data-workspace-dag-row={item.id}
                    data-workspace-dag-card={item.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-950/80 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:border-white/20"
                  >
                    <button
                      type="button"
                      data-workspace-dag-card-open={item.id}
                      disabled={busy || item.blockCount < 2}
                      onClick={() => openEdit(item)}
                      className="group flex min-h-0 flex-1 flex-col text-left disabled:opacity-50"
                    >
                      {preview ? (
                        <MultiBlockDagPreview
                          blocks={preview.canvasBlocks}
                          draft={preview.draft}
                          className="rounded-none border-0 border-b border-white/10"
                        />
                      ) : (
                        <div className="flex h-[120px] items-center justify-center border-b border-white/10 bg-neutral-950 text-[10px] text-neutral-600">
                          No preview
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
                        <p className="line-clamp-2 text-[12px] font-medium leading-snug text-neutral-100 group-hover:text-white">
                          {item.displayTitle}
                        </p>
                        <p className="text-[10px] text-neutral-500">
                          {item.blockCount} block
                          {item.blockCount === 1 ? "" : "s"}
                          {preview
                            ? ` · ${preview.edgeCount} link${preview.edgeCount === 1 ? "" : "s"}`
                            : ""}
                          {item.missingBlockCount > 0
                            ? ` · ${item.missingBlockCount} missing`
                            : ""}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2">
                      <button
                        type="button"
                        data-workspace-dag-edit-open={item.id}
                        disabled={busy || item.blockCount < 2}
                        onClick={() => openEdit(item)}
                        className="flex-1 rounded-md border border-white/15 bg-white/[0.06] px-2 py-1.5 text-[10px] font-medium text-neutral-100 hover:bg-white/10 disabled:opacity-40"
                      >
                        Edit
                      </button>
                      {confirmDeleteId === item.id ? (
                        <>
                          <button
                            type="button"
                            data-workspace-dag-delete-confirm={item.id}
                            disabled={busy || deletingId === item.id}
                            onClick={() => void runDelete(item.id)}
                            className="rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-1.5 text-[10px] font-medium text-rose-100 hover:bg-rose-500/25 disabled:opacity-40"
                          >
                            {deletingId === item.id ? "…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            data-workspace-dag-delete-cancel={item.id}
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md px-2 py-1.5 text-[10px] text-neutral-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          data-workspace-dag-delete={item.id}
                          disabled={busy || deletingId === item.id}
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-neutral-400 hover:border-white/20 hover:text-neutral-200 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
