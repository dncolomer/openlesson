"use client";

import { useEffect, useState } from "react";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { PromptBrowser } from "@/components/prompts/PromptBrowser";
import type { PromptInventory } from "@/lib/prompt-inventory/types";

export default function AdminPromptsPage() {
  const { loading, error, isAdmin } = useAdminGuard();
  const [inventory, setInventory] = useState<PromptInventory | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/prompts")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load prompt inventory");
        setInventory(data);
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load prompt inventory"),
      );
  }, [isAdmin]);

  if (loading) return <AdminLoading />;
  if (error || !isAdmin) return <AdminError message={error || "Admin access required"} />;

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-neutral-400">
        Read-only browser for every LLM prompt in Uncertain Systems — registry defaults, inline route
        prompts, and shared builders. Regenerate with{" "}
        <code className="text-neutral-300">npm run generate:prompt-inventory</code>.
      </p>

      {loadError && <p className="mb-4 text-sm text-red-400">{loadError}</p>}
      {!inventory ? <AdminLoading /> : <PromptBrowser inventory={inventory} />}
    </div>
  );
}