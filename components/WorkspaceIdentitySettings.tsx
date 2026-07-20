"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/components/WorkspaceView";

interface WorkspaceIdentitySettingsProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  onPlanUpdate: (plan: Workspace) => void;
}

/**
 * Owner title + description editors for Settings.
 * Reuses visibility PUT handlers (title / description).
 */
export function WorkspaceIdentitySettings({
  plan,
  workspaceId,
  isOwner,
  onPlanUpdate,
}: WorkspaceIdentitySettingsProps) {
  const { t } = useI18n();
  const [editTitle, setEditTitle] = useState(plan.title || plan.root_topic || "");
  const [editDescription, setEditDescription] = useState(plan.description || "");
  const [editGoal, setEditGoal] = useState(plan.workspace_goal || "");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    setEditTitle(plan.title || plan.root_topic || "");
  }, [plan.title, plan.root_topic]);

  useEffect(() => {
    setEditDescription(plan.description || "");
  }, [plan.description]);

  useEffect(() => {
    setEditGoal(plan.workspace_goal || "");
  }, [plan.workspace_goal]);

  if (!isOwner) return null;

  const saveTitle = async () => {
    if (!editTitle.trim()) return;
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({
          ...plan,
          root_topic: editTitle.trim(),
          title: editTitle.trim(),
        });
      }
    } catch (err) {
      console.error("Error updating title:", err);
    } finally {
      setSavingTitle(false);
    }
  };

  const saveDescription = async () => {
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({ ...plan, description: editDescription || undefined });
      }
    } catch (err) {
      console.error("Error updating description:", err);
    } finally {
      setSavingDescription(false);
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_goal: editGoal.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({
          ...plan,
          workspace_goal: data.workspace_goal || editGoal.trim() || undefined,
        });
      }
    } catch (err) {
      console.error("Error updating workspace goal:", err);
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="identity"
      data-workspace-identity-settings
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-white">
          {t("planView.sectionAbout")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Name, description, and goal for this workspace.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="workspace-settings-title"
            className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500"
          >
            Name
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="workspace-settings-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void saveTitle()}
              disabled={savingTitle || !editTitle.trim()}
              className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {savingTitle ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="workspace-settings-description"
            className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500"
          >
            Description
          </label>
          <textarea
            id="workspace-settings-description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={t("planView.addDescription")}
            rows={4}
            className="mt-2 min-h-[6rem] w-full resize-y rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
          />
          <div className="mt-2">
            <button
              type="button"
              onClick={() => void saveDescription()}
              disabled={savingDescription}
              className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-neutral-400 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingDescription ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>

        <div data-settings-section="goal" data-workspace-goal-settings>
          <label
            htmlFor="workspace-settings-goal"
            className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500"
          >
            {t("planView.workspaceGoal")}
          </label>
          <input
            id="workspace-settings-goal"
            type="text"
            value={editGoal}
            onChange={(e) => setEditGoal(e.target.value)}
            placeholder="e.g. Trial-to-paid activation"
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
          />
          <div className="mt-2">
            <button
              type="button"
              onClick={() => void saveGoal()}
              disabled={savingGoal}
              className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-neutral-400 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingGoal ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
