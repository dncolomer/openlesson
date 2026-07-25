"use client";

import { useEffect, useState } from "react";
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
 * Owner access controls: public/private, Paid (AYCL admin).
 * Public workspaces contribute embeddings, regions, and PoW to the Map of Knowledge.
 * Lives under Settings — not on workspace identity chrome.
 */
export function WorkspaceAccessSettings({
  plan,
  workspaceId,
  isOwner,
  onPlanUpdate,
}: WorkspaceAccessSettingsProps) {
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState(false);
  const [togglingAycl, setTogglingAycl] = useState(false);
  const [busy, setBusy] = useState<"public" | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/me/status")
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [isOwner]);

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

  const toggleAycl = async () => {
    setTogglingAycl(true);
    try {
      const enabled = !(plan.is_all_you_can_learn ?? false);
      const res = await fetch(`/api/workspaces/${workspaceId}/aycl`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_all_you_can_learn: enabled }),
      });
      const data = await res.json();
      if (data.success) {
        onPlanUpdate({ ...plan, is_all_you_can_learn: enabled });
      }
    } catch (err) {
      console.error("Error toggling AYCL:", err);
    } finally {
      setTogglingAycl(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
      data-settings-section="access"
      data-workspace-access-settings
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-white">{t("planView.sectionAccess")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Public workspaces publish PoW, embeddings, blocks, and regions to the Map of Knowledge.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void togglePublic()}
          disabled={busy === "public"}
          className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-all disabled:opacity-50 ${
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

        {isAdmin ? (
          <button
            type="button"
            onClick={() => void toggleAycl()}
            disabled={togglingAycl}
            className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-all disabled:opacity-50 ${
              plan.is_all_you_can_learn
                ? "border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs font-bold">$</span>
            <span className="min-w-0">
              {plan.is_all_you_can_learn
                ? "Remove from All-You-Can-Learn"
                : "Enable Paid (AYCL)"}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
