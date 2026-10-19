"use client";

import { useMemo, useState } from "react";
import {
  listAuthorUnsysWorkspaceSeeds,
  type AuthorUnsysModelSeed,
} from "@/lib/author-unsys-model";

const GHOST =
  "rounded-none border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-200 hover:border-white/40 disabled:opacity-40";
const DANGER =
  "rounded-none border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-400 hover:border-white/40 hover:text-white disabled:opacity-40";

export function WorkspaceUnsysModelsPanel({
  blocks,
  busy = false,
  onEdit,
  onSaveSeed,
}: {
  blocks: ReadonlyArray<{
    id: string;
    title?: string | null;
    answers_model_seed?: unknown;
  }>;
  busy?: boolean;
  onEdit: (input: { blockId: string }) => void;
  onSaveSeed: (input: {
    blockId: string;
    seed: AuthorUnsysModelSeed | null;
  }) => Promise<void> | void;
}) {
  const items = useMemo(() => listAuthorUnsysWorkspaceSeeds(blocks), [blocks]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persist = async (
    blockId: string,
    seed: AuthorUnsysModelSeed | null,
  ) => {
    setDeleting(blockId);
    setError(null);
    try {
      await onSaveSeed({ blockId, seed });
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete seed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div
      data-workspace-unsys-models-section
      data-workspace-unsys-models-panel
      data-unsys-model-list-count={items.length}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="mb-3 shrink-0">
        <h2 className="text-sm font-semibold text-white">Unsys models</h2>
      </div>

      {error ? (
        <p className="mb-2 text-xs text-red-400/90" data-workspace-unsys-models-error>
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto" data-workspace-unsys-model-list>
        {items.length === 0 ? (
          <div
            data-workspace-unsys-models-empty
            className="rounded-none border border-dashed border-white/10 bg-neutral-950/50 px-4 py-8 text-center"
          >
            <p className="text-xs text-neutral-300">No saved seeds</p>
          </div>
        ) : (
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            data-workspace-unsys-model-grid
          >
            {items.map((item) => (
              <li
                key={item.blockId}
                data-workspace-unsys-model-row={item.blockId}
                className="flex flex-col gap-3 rounded-none border border-white/10 bg-neutral-950/80 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-100">
                    {item.title}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {item.branchCount} {item.branchCount === 1 ? "branch" : "branches"}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-1">
                  <button
                    type="button"
                    data-workspace-unsys-model-edit
                    className={GHOST}
                    disabled={busy || deleting === item.blockId}
                    onClick={() => onEdit({ blockId: item.blockId })}
                  >
                    Edit
                  </button>
                  {confirmId === item.blockId ? (
                    <>
                      <button
                        type="button"
                        data-workspace-unsys-model-delete-confirm
                        className={DANGER}
                        disabled={busy || deleting === item.blockId}
                        onClick={() => void persist(item.blockId, null)}
                      >
                        {deleting === item.blockId ? "Deleting…" : "Delete seed"}
                      </button>
                      <button
                        type="button"
                        data-workspace-unsys-model-delete-cancel
                        className={GHOST}
                        disabled={deleting === item.blockId}
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-workspace-unsys-model-delete
                      className={DANGER}
                      disabled={busy || deleting === item.blockId}
                      onClick={() => setConfirmId(item.blockId)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
