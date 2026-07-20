"use client";

import { useEffect, useState } from "react";
import { Pencil, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/components/WorkspaceView";

interface WorkspaceGoalPanelProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  onPlanUpdate: (plan: Workspace) => void;
}

/**
 * Highlighted workspace-goal presentation for the Workspace section.
 * Black surface framed with white border; light text for contrast.
 * Saves via the existing visibility PUT path (workspace_goal).
 */
export function WorkspaceGoalPanel({
  plan,
  workspaceId,
  isOwner,
  onPlanUpdate,
}: WorkspaceGoalPanelProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editGoal, setEditGoal] = useState(plan.workspace_goal || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditGoal(plan.workspace_goal || "");
  }, [plan.workspace_goal]);

  const saveGoal = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_goal: editGoal.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({ ...plan, workspace_goal: data.workspace_goal || undefined });
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Error updating workspace goal:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!plan.workspace_goal && !isOwner && !isEditing) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-white bg-black p-4 shadow-[0_8px_28px_rgba(0,0,0,0.45)] sm:p-5"
      data-workspace-goal-panel
      data-goal-surface="black"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/5 text-white">
          <Target className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t("planView.workspaceGoal")}
            </p>
            {isOwner && !isEditing && plan.workspace_goal ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="shrink-0 rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
                title="Edit workspace goal"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                placeholder="e.g. Trial-to-paid activation"
                className="w-full rounded-md border border-white/20 bg-neutral-950 px-3 py-2.5 text-sm font-medium text-white placeholder:text-neutral-600 focus:border-white/50 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => void saveGoal()}
                  disabled={saving}
                  className="rounded-md bg-white px-3 py-1.5 font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
                >
                  {saving ? "..." : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditGoal(plan.workspace_goal || "");
                    setIsEditing(false);
                  }}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : plan.workspace_goal ? (
            <p className="mt-1.5 text-base font-medium leading-snug text-white sm:text-lg">
              {plan.workspace_goal}
            </p>
          ) : isOwner ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="mt-1.5 text-sm text-neutral-400 transition-colors hover:text-white"
            >
              Set workspace goal
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
