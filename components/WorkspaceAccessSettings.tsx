"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/components/WorkspaceView";
import { AYCL_SUGGESTED_CATEGORIES } from "@/lib/dashboard-home-catalog";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

interface WorkspaceAccessSettingsProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  onPlanUpdate: (plan: Workspace) => void;
}

/**
 * Owner access controls: public/private. Category is optional on Home.
 */
export function WorkspaceAccessSettings({
  plan,
  workspaceId,
  isOwner,
  onPlanUpdate,
}: WorkspaceAccessSettingsProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"public" | null>(null);
  const [category, setCategory] = useState(plan.aycl_category || "");
  const [error, setError] = useState("");

  if (!isOwner) return null;

  const togglePublic = async () => {
    const isPublic = plan.is_public ?? false;
    const makingPublic = !isPublic;
    setBusy("public");
    setError("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_public: makingPublic,
          aycl_category: category.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(errorMessageFromBody(data, "Could not update visibility"));
      }
      onPlanUpdate({
        ...plan,
        is_public: makingPublic,
        aycl_category: category.trim() || plan.aycl_category || null,
      });
    } catch (err) {
      console.error("Error toggling visibility:", err);
      setError(err instanceof Error ? err.message : "Could not update visibility");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      className="rounded-none border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="access"
      data-workspace-access-settings
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-white">{t("planView.sectionAccess")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Public maps appear on Home. Category is optional.
        </p>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Category
        </span>
        <input
          type="text"
          list="workspace-publish-categories"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="e.g. Math"
          data-workspace-publish-category
          className="w-full rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
        />
        <datalist id="workspace-publish-categories">
          {AYCL_SUGGESTED_CATEGORIES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void togglePublic()}
          disabled={busy === "public"}
          className={`flex w-full items-center gap-3 rounded-none border px-3 py-2.5 text-left text-sm transition-all disabled:opacity-50 ${
            plan.is_public
              ? "border-green-500/30 bg-green-500/15 text-green-400 hover:bg-green-500/25"
              : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          {plan.is_public ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
          <span className="min-w-0">
            {plan.is_public ? t("planView.makePrivate") : t("planView.makePublic")}
          </span>
        </button>
      </div>
    </section>
  );
}
