"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  created_at: string;
}

export default function PlansPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadPlans() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=/workspaces");
        return;
      }

      const { data, error } = await supabase
        .from("learning_plans")
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

  const handleArchive = async (planId: string) => {
    if (!confirm("Archive this workspace? It will be hidden from your list but data is preserved.")) {
      return;
    }

    try {
      const res = await fetch(`/api/learning-plans/${planId}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive");
      setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive workspace");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">{t('common.loading')}</div>
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
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">{t('plans.noPlansYet')}</p>
            <Link href="/" className="text-blue-400 hover:underline">
              {t('plans.createFirstPlan')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/workspace/${plan.id}`} className="flex-1">
                    <h3 className="font-medium text-white">{plan.root_topic}</h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      plan.status === 'active' 
                        ? 'bg-blue-900/50 text-blue-400'
                        : plan.status === 'completed'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {plan.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleArchive(plan.id)}
                      className="rounded border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-400 transition hover:border-amber-500/40 hover:text-amber-200"
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
