"use client";

import { useCallback, useEffect, useState } from "react";

export type BlockGoalItem = {
  id: string;
  text: string;
  block_id: string;
  sort_order: number;
};

/**
 * Block-detail Goals drawer body — only mounted for existing (persisted) blocks.
 */
export function BlockGoalsPanel({
  workspaceId,
  blockId,
  canEdit,
  ayclToken,
}: {
  workspaceId: string;
  blockId: string;
  canEdit: boolean;
  ayclToken?: string | null;
}) {
  const [goals, setGoals] = useState<BlockGoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspaceId, blockId });
      if (ayclToken) params.set("ayclToken", ayclToken);
      const res = await fetch(`/api/workspace/block-goals?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load block goals");
      setGoals(
        Array.isArray(data.block_goals)
          ? data.block_goals.map(
              (g: { id: string; text: string; block_id: string; sort_order?: number }) => ({
                id: g.id,
                text: g.text,
                block_id: g.block_id,
                sort_order: g.sort_order ?? 0,
              }),
            )
          : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load block goals");
    } finally {
      setLoading(false);
    }
  }, [ayclToken, blockId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addGoal = async () => {
    if (!draft.trim() || saving || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/block-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockId,
          text: draft.trim(),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add goal");
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add goal");
    } finally {
      setSaving(false);
    }
  };

  const removeGoal = async (goalId: string) => {
    if (saving || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/block-goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          goalId,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete goal");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3" data-block-goals-panel data-block-goals-drawer-body>
      <p className="text-[11px] leading-relaxed text-neutral-500">
        Goals specific to this block. Snapshots include them when proof of work is linked here.
      </p>

      {loading ? (
        <p className="text-xs text-neutral-500">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-xs text-neutral-500" data-block-goals-empty>
          No block goals yet.
        </p>
      ) : (
        <ul className="space-y-1.5" data-block-goals-list>
          {goals.map((g) => (
            <li
              key={g.id}
              data-goal-id={g.id}
              data-goal-scope="block"
              className="flex items-start justify-between gap-2 rounded-md border border-neutral-800/80 bg-neutral-950/50 px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 text-xs text-neutral-200">{g.text}</span>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void removeGoal(g.id)}
                  className="shrink-0 text-[10px] uppercase tracking-wide text-red-400/70 hover:text-red-300"
                  data-goal-delete
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="space-y-1.5" data-block-goal-add>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a block goal…"
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-white focus:border-neutral-400 focus:outline-none"
            data-block-goal-add-input
            onKeyDown={(e) => {
              if (e.key === "Enter") void addGoal();
            }}
          />
          <button
            type="button"
            onClick={() => void addGoal()}
            disabled={saving || !draft.trim()}
            className="rounded-md bg-white/90 px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-40"
            data-block-goal-add-submit
          >
            Add
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-[10px] text-red-400" data-block-goals-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}
