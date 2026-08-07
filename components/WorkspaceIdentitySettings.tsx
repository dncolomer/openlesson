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
 * Goals are managed on the standalone Goals tab (not Settings).
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditTitle(plan.title || plan.root_topic || "");
  }, [plan.title, plan.root_topic]);

  useEffect(() => {
    setEditDescription(plan.description || "");
  }, [plan.description]);

  if (!isOwner) return null;

  const titleDirty =
    editTitle.trim() !== (plan.title || plan.root_topic || "").trim();
  const descriptionDirty =
    (editDescription || "").trim() !== (plan.description || "").trim();
  const isDirty = titleDirty || descriptionDirty;
  const canSave = editTitle.trim().length > 0 && isDirty && !saving;

  const saveIdentity = async () => {
    if (!editTitle.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const nextTitle = (data.title as string | undefined) || editTitle.trim();
        onPlanUpdate({
          ...plan,
          root_topic: nextTitle,
          title: nextTitle,
          description:
            typeof data.description === "string"
              ? data.description || undefined
              : editDescription || undefined,
        });
      }
    } catch (err) {
      console.error("Error updating workspace identity:", err);
    } finally {
      setSaving(false);
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
          {t("planView.identitySettingsIntro")}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="workspace-settings-title"
            className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500"
          >
            {t("planView.workspaceName")}
          </label>
          <input
            id="workspace-settings-title"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
          />
          <p
            className="mt-1.5 text-xs text-neutral-500"
            data-field-helper="title"
          >
            {t("planView.workspaceNameHelper")}
          </p>
        </div>

        <div>
          <label
            htmlFor="workspace-settings-description"
            className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500"
          >
            {t("planView.workspaceDescription")}
          </label>
          <textarea
            id="workspace-settings-description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={t("planView.addDescription")}
            rows={4}
            className="mt-2 min-h-[6rem] w-full resize-y rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
          />
          <p
            className="mt-1.5 text-xs text-neutral-500"
            data-field-helper="description"
          >
            {t("planView.workspaceDescriptionHelper")}
          </p>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => void saveIdentity()}
            disabled={!canSave}
            data-identity-save
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </section>
  );
}
