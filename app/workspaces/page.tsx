"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

interface Workspace {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  created_at: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadWorkspaces() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/workspaces");
        return;
      }

      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .order("created_at", { ascending: false });

      if (!error) {
        setWorkspaces(data || []);
      }
      setLoading(false);
    }

    loadWorkspaces();
  }, [supabase, router]);

  const handleArchive = async (workspaceId: string) => {
    if (!confirm("Archive this workspace? It will be hidden from your list but data is preserved.")) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive workspace");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <LoadingStatusMessage message={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar
        breadcrumbs={[
          { label: t('plans.title') }
        ]}
        showNav={false}
      />

      <main className="max-w-4xl mx-auto p-6">
        {workspaces.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">{t('plans.noPlansYet')}</p>
            <Link href="/" className="text-neutral-300 hover:underline">
              {t('plans.createFirstPlan')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/workspace/${workspace.id}`} className="flex-1">
                    <h3 className="font-medium text-white">{workspace.root_topic}</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      {new Date(workspace.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      workspace.status === 'active'
                        ? 'bg-neutral-950/50 text-neutral-300'
                        : workspace.status === 'completed'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {workspace.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleArchive(workspace.id)}
                      className="rounded border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-400 transition hover:border-neutral-600/40 hover:text-neutral-300"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}