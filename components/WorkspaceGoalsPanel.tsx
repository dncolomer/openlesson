"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceGoalItem = {
  id: string;
  text: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

/**
 * Goals tab: multi natural-language workspace goals CRUD.
 * Source of truth for workspace-level goals (Settings no longer edits a single goal).
 */
export function WorkspaceGoalsPanel({
  workspaceId,
  isOwner,
  ayclToken,
}: {
  workspaceId: string;
  isOwner: boolean;
  ayclToken?: string | null;
}) {
  const [goals, setGoals] = useState<WorkspaceGoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspaceId });
      if (ayclToken) params.set("ayclToken", ayclToken);
      const res = await fetch(`/api/workspace/goals?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load goals");
      setGoals(
        Array.isArray(data.workspace_goals)
          ? data.workspace_goals.map(
              (g: { id: string; text: string; sort_order?: number; created_at?: string; updated_at?: string }) => ({
                id: g.id,
                text: g.text,
                sort_order: g.sort_order ?? 0,
                created_at: g.created_at,
                updated_at: g.updated_at,
              }),
            )
          : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }, [ayclToken, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addGoal = async () => {
    if (!draft.trim() || saving || !isOwner) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
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

  const saveEdit = async () => {
    if (!editingId || !editText.trim() || saving || !isOwner) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          goalId: editingId,
          text: editText.trim(),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update goal");
      setEditingId(null);
      setEditText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  const removeGoal = async (goalId: string) => {
    if (saving || !isOwner) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/goals", {
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
    <div
      className="flex h-full min-h-0 flex-col gap-4 overflow-auto"
      data-workspace-goals-panel
      data-workspace-goals-tab
    >
      <div>
        <h2 className="text-sm font-medium text-white">Goals</h2>
      </div>

      {loading ? (
        <p className="text-xs text-neutral-500">Loading goals…</p>
      ) : goals.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950/40 px-4 py-6 text-center"
          data-goals-empty
        >
          <p className="text-sm text-neutral-300">No workspace goals yet</p>
        </div>
      ) : (
        <ul className="space-y-2" data-goals-list>
          {goals.map((g) => (
            <li
              key={g.id}
              data-goal-id={g.id}
              data-goal-scope="workspace"
              className="rounded-lg border border-neutral-800 bg-neutral-950/70 px-3 py-2.5"
            >
              {editingId === g.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
                    data-goal-edit-input
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={saving || !editText.trim()}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm text-neutral-100">{g.text}</p>
                  {isOwner ? (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(g.id);
                          setEditText(g.text);
                        }}
                        className="rounded px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-400 hover:bg-neutral-900 hover:text-white"
                        data-goal-edit
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeGoal(g.id)}
                        className="rounded px-2 py-1 text-[10px] uppercase tracking-wide text-red-400/80 hover:bg-red-950/40 hover:text-red-300"
                        data-goal-delete
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3" data-goal-add>
          <label className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Add workspace goal
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Ship a production-ready REST API with tests"
              className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
              data-goal-add-input
              onKeyDown={(e) => {
                if (e.key === "Enter") void addGoal();
              }}
            />
            <button
              type="button"
              onClick={() => void addGoal()}
              disabled={saving || !draft.trim()}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              data-goal-add-submit
            >
              {saving ? "Saving…" : "Add goal"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-400" data-goals-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}
