"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { ConsolePage } from "@/components/ui/console-frame";

interface Workspace {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  created_at: string;
}

export default function PlansPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [plans, setPlans] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadPlans() {
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
        setPlans(data || []);
      }
      setLoading(false);
    }

    loadPlans();
  }, [supabase, router]);

  const handleArchive = async (workspaceId: string) => {
    if (!confirm("Archive this workspace? It will be hidden from your list but data is preserved.")) {
      return;
    }

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");
      setPlans((prev) => prev.filter((plan) => plan.id !== workspaceId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive workspace");
    }
  };

  if (loading) {
    return (
      <ConsolePage label="List">
        <div className="flex flex-1 items-center justify-center">
          <LoadingStatusMessage message={t('common.loading')} />
        </div>
      </ConsolePage>
    );
  }

  return (
    <ConsolePage label="List">
      <Navbar 
        breadcrumbs={[
          { label: t('plans.title') }
        ]}
        showNav={false}
      />

      <main className="max-w-4xl mx-auto p-6">
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">{t('plans.noPlansYet')}</p>
            <Link href="/" className="text-neutral-300 hover:underline">
              {t('plans.createFirstPlan')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="border border-white/30 bg-black p-4 transition-colors hover:border-white/60"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/workspace/${plan.id}`} className="flex-1">
                    <h3 className="font-medium text-white">{plan.root_topic}</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`border border-white/30 px-2 py-1 text-xs ${
                      plan.status === 'active' 
                        ? 'bg-black text-white'
                        : plan.status === 'completed'
                        ? 'bg-black text-white/80'
                        : 'bg-black text-neutral-400'
                    }`}>
                      {plan.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleArchive(plan.id)}
                      className="rounded-none border border-white/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400 transition hover:border-white/60 hover:text-white"
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
    </ConsolePage>
  );
}
