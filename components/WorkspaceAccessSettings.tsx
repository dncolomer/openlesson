"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/components/WorkspaceView";

interface WorkspaceAccessSettingsProps {
  plan: Workspace;
  workspaceId: string;
  isOwner: boolean;
  onPlanUpdate: (plan: Workspace) => void;
}

/**
 * Owner access controls: public/private.
 * AYCL marketplace listing lives under Settings → AYCL (own sub-tab).
 * Public workspaces contribute embeddings, regions, and PoW to the Map of Knowledge.
 */
export function WorkspaceAccessSettings({
  plan,
  workspaceId,
  isOwner,
  onPlanUpdate,
}: WorkspaceAccessSettingsProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"public" | null>(null);

  if (!isOwner) return null;

  const togglePublic = async () => {
    setBusy("public");
    try {
      const isPublic = plan.is_public ?? false;
      const res = await fetch(`/api/workspaces/${workspaceId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !isPublic }),
      });
      const data = await res.json();
      if (data.success) onPlanUpdate({ ...plan, is_public: !isPublic });
    } catch (err) {
      console.error("Error toggling visibility:", err);
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
          Public workspaces publish PoW, embeddings, blocks, and regions to the Map of Knowledge.
          Paid catalog listing is under the AYCL settings tab.
        </p>
      </div>

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
