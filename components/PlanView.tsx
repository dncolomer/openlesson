"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import Image from "next/image";
import { PlanChat } from "@/components/PlanChat";
import { Navbar } from "@/components/Navbar";
import { RemixModal } from "@/components/RemixModal";
import { useI18n } from "../lib/i18n";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PerformanceChat } from "@/components/PerformanceChat";
import { PlanFilesTab } from "@/components/PlanFilesTab";

export interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
}

export interface LearningPlan {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  user_id?: string;
  description?: string;
  is_public?: boolean;
  author_username?: string;
  original_plan_id?: string;
  remix_count?: number;
  source_type?: "topic" | "youtube";
  source_url?: string;
  source_summary?: string;
  notes?: string;
  cover_image_url?: string;
}

interface PlanViewProps {
  initialPlan?: LearningPlan;
  initialNodes?: PlanNode[];
}

// Default placeholder gradient for plans without cover images
function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-slate-900 to-emerald-950/60">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-radial from-emerald-500/20 to-transparent blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-gradient-radial from-violet-500/20 to-transparent blur-3xl" />
        <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-gradient-radial from-blue-500/15 to-transparent blur-2xl" />
      </div>
    </div>
  );
}

export function PlanView({ initialPlan, initialNodes }: PlanViewProps) {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;
  
  const [plan, setPlan] = useState<LearningPlan | null>(initialPlan || null);
  const [nodes, setNodes] = useState<PlanNode[]>(initialNodes || []);
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "notes" | "performance" | "files">("graph");
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isOwner = currentUserId ? plan?.user_id === currentUserId : false;

  const refreshNodes = () => {
    setRefreshKey(k => k + 1);
  };

  const handleNodesUpdate = (newNodes: PlanNode[]) => {
    setNodes(newNodes);
  };

  const handleShare = () => {
    const slug = encodeURIComponent(plan!.root_topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    const url = `${window.location.origin}/p/${plan!.id}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCover = useCallback(async () => {
    if (!plan || generatingCover) return;
    setGeneratingCover(true);
    try {
      const res = await fetch("/api/learning-plan/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, description: plan.description || plan.root_topic }),
      });
      const data = await res.json();
      if (data.coverImageUrl) {
        setPlan({ ...plan, cover_image_url: data.coverImageUrl });
      }
    } catch (err) {
      console.error("Failed to regenerate cover:", err);
    } finally {
      setGeneratingCover(false);
    }
  }, [plan, generatingCover]);

  // Poll for cover image if plan has none (just created)
  useEffect(() => {
    if (!plan || plan.cover_image_url || !isOwner) return;
    
    let attempts = 0;
    const maxAttempts = 12; // ~60 seconds
    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        return;
      }
      try {
        const { data } = await supabase
          .from("learning_plans")
          .select("cover_image_url")
          .eq("id", plan.id)
          .single();
        if (data?.cover_image_url) {
          setPlan(prev => prev ? { ...prev, cover_image_url: data.cover_image_url } : prev);
          clearInterval(interval);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [plan?.id, plan?.cover_image_url, isOwner]);

  useEffect(() => {
    async function loadPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const { data: planData, error: planError } = await supabase
        .from("learning_plans")
        .select("*, profiles:author_id(username)")
        .eq("id", planId)
        .single();

      if (planError || !planData) {
        setError("Plan not found");
        setLoading(false);
        return;
      }

      if (!planData.is_public) {
        if (!user) {
          router.push("/login?redirect=/plan/" + planId);
          return;
        }
        if (planData.user_id !== user.id) {
          setError("Plan not found");
          setLoading(false);
          return;
        }
      }

      if (planData.profiles) {
        planData.author_username = planData.profiles.username;
      }

      setPlan(planData);

      const { data: nodesData, error: nodesError } = await supabase
        .from("plan_nodes")
        .select("*")
        .eq("plan_id", planId);

      if (nodesError) {
        setError("Failed to load nodes");
      } else {
        let finalNodes = nodesData || [];

        const sessionIds = finalNodes
          .map((n: PlanNode) => n.session_id)
          .filter(Boolean) as string[];

        if (sessionIds.length > 0) {
          const { data: sessions } = await supabase
            .from("sessions")
            .select("id, status")
            .in("id", sessionIds);

          if (sessions) {
            const completedSessionIds = new Set(
              sessions
                .filter((s: { id: string; status: string }) => s.status === "completed" || s.status === "ended_by_tutor")
                .map((s: { id: string }) => s.id)
            );

            finalNodes = finalNodes.map((n: PlanNode) => {
              if (n.session_id && completedSessionIds.has(n.session_id) && n.status !== "completed") {
                return { ...n, status: "completed" };
              }
              return n;
            });
          }
        }

        setNodes(finalNodes);
      }

      setLoading(false);
    }

    loadPlan();
  }, [planId, supabase, router, refreshKey]);

  useEffect(() => {
    if (plan?.root_topic) {
      setEditTitle(plan.root_topic);
    }
  }, [plan?.root_topic]);

  useEffect(() => {
    if (plan?.description !== undefined) {
      setEditDescription(plan.description || "");
    }
  }, [plan?.description]);

  useEffect(() => {
    if (plan?.notes !== undefined) {
      setNotesContent(plan.notes || "");
    }
  }, [plan?.notes]);

  const saveNotes = async () => {
    if (!plan) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/learning-plan/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, notes: notesContent }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan({ ...plan, notes: notesContent });
        setIsEditingNotes(false);
      } else {
        alert(data.error || "Failed to save notes");
      }
    } catch (err) {
      console.error("Error saving notes:", err);
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const saveDescription = async () => {
    if (!plan) return;
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/learning-plans/${planId}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan({ ...plan, description: editDescription || undefined });
        setIsEditingDescription(false);
      } else {
        alert(data.error || "Failed to update description");
      }
    } catch (err) {
      console.error("Error updating description:", err);
      alert("Failed to update description");
    } finally {
      setSavingDescription(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">{t('planView.loading')}</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">{error || t('planView.planNotFound')}</div>
        <Link href="/" className="text-blue-400 hover:underline">
          {t('planView.goBackHome')}
        </Link>
      </div>
    );
  }

  const tabConfig = [
    { key: "graph" as const, label: t('planView.planBuilder'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
      </svg>
    )},
    { key: "notes" as const, label: t('planView.notes'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )},
    { key: "performance" as const, label: t('planView.performance'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    )},
    { key: "files" as const, label: t('planView.files'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
      </svg>
    )},
  ];

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <Navbar />

      {/* Hero Cover Image Section */}
      <div className="relative flex-shrink-0 h-36 sm:h-44 group">
        {/* Cover image or placeholder */}
        {plan.cover_image_url ? (
          <img
            src={plan.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <CoverPlaceholder title={plan.root_topic} />
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />

        {/* Regenerate cover button (owner only) */}
        {isOwner && (
          <button
            onClick={handleRegenerateCover}
            disabled={generatingCover}
            className="absolute top-3 right-3 p-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
            title={plan.cover_image_url ? t('planView.regenerateCoverImage') : t('planView.generateCoverImage')}
          >
            {generatingCover ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            )}
          </button>
        )}

        {/* Title + metadata overlay at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-black/60 backdrop-blur-sm border border-white/20 rounded-lg text-white text-lg font-bold focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (!editTitle.trim()) return;
                      try {
                        const res = await fetch(`/api/learning-plans/${planId}/visibility`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: editTitle.trim() }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setPlan({ ...plan, root_topic: editTitle.trim(), title: editTitle.trim() });
                          setIsEditingTitle(false);
                        }
                      } catch (err) {
                        console.error("Error updating title:", err);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    onClick={() => { setEditTitle(plan.root_topic); setIsEditingTitle(false); }}
                    className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white truncate drop-shadow-lg">
                    {plan.title || plan.root_topic}
                  </h1>
                  {isOwner && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="text-white/40 hover:text-white transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              {/* Subtitle: topic name if title differs */}
              {plan.title && plan.title !== plan.root_topic && (
                <p className="text-sm text-white/50 truncate mt-0.5">{plan.root_topic}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {plan.is_public && (
                <button
                  onClick={handleShare}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all"
                >
                  {copied ? t('planView.copied') : t('planView.share')}
                </button>
              )}
              {isOwner ? (
                <button
                  onClick={async () => {
                    try {
                      const isPublic = plan.is_public ?? false;
                      const res = await fetch(`/api/learning-plans/${planId}/visibility`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ is_public: !isPublic }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setPlan({ ...plan, is_public: !isPublic });
                      }
                    } catch (err) {
                      console.error("Error toggling visibility:", err);
                    }
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full backdrop-blur-sm border transition-all ${
                    plan.is_public
                      ? "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25"
                      : "bg-white/10 border-white/10 text-white/70 hover:text-white hover:bg-white/20"
                  }`}
                >
                  {plan.is_public ? t('planView.public') : t('planView.makePublic')}
                </button>
              ) : currentUserId ? (
                <button
                  onClick={() => setShowRemixModal(true)}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
                >
                  {t('planView.forkRemix')}
                </button>
              ) : (
                <Link
                  href="/register"
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
                >
                  {t('planView.forkRemix')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="px-4 py-2 flex items-center gap-3 text-xs flex-shrink-0 border-b border-neutral-800/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {plan.is_public && plan.author_username && (
            <span className="text-neutral-500">{t('planView.by')} <span className="text-neutral-400">@{plan.author_username}</span></span>
          )}
          {plan.is_public && (plan.remix_count ?? 0) > 0 && (
            <span className="text-neutral-600">·</span>
          )}
          {plan.is_public && (plan.remix_count ?? 0) > 0 && (
            <span className="text-neutral-500">
              {plan.remix_count} {(plan.remix_count || 0) === 1 ? t('planView.fork') : t('planView.forks', { count: plan.remix_count || 0 })}
            </span>
          )}
          {plan.original_plan_id && (
            <>
              <span className="text-neutral-600">·</span>
              <span className="text-violet-400/70 font-medium">{t('planView.remixed')}</span>
            </>
          )}
        </div>

        {/* Inline description */}
        {isEditingDescription ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder={t('planView.addDescription')}
              className="flex-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button onClick={saveDescription} disabled={savingDescription} className="text-blue-400 hover:text-blue-300 text-xs font-medium">
              {savingDescription ? "..." : t('common.save')}
            </button>
            <button onClick={() => { setEditDescription(plan.description || ""); setIsEditingDescription(false); }} className="text-neutral-500 hover:text-neutral-300 text-xs">
              {t('common.cancel')}
            </button>
          </div>
        ) : plan.description ? (
          <p className="text-neutral-500 truncate flex-1 cursor-pointer hover:text-neutral-400 transition-colors" onClick={() => isOwner && setIsEditingDescription(true)}>
            {plan.description}
          </p>
        ) : isOwner ? (
          <button onClick={() => setIsEditingDescription(true)} className="text-neutral-600 hover:text-neutral-400 transition-colors text-xs">
            {t('planView.addDescriptionBtn')}
          </button>
        ) : null}

        {isOwner && plan.is_public && !isEditingDescription && (
          <button
            onClick={() => setShowRemixModal(true)}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {t('planView.forkRemix')}
          </button>
        )}
      </div>

      {/* Pill Tab Bar */}
      <div className="px-4 pt-2.5 pb-1 flex-shrink-0">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-900/80 border border-neutral-800/50">
          {tabConfig.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === key
                  ? "bg-neutral-700/80 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <main className="flex-1 p-3 sm:p-4 pb-3 sm:pb-4 min-h-0 overflow-hidden">
        {activeTab === "graph" && (
          <PlanChat 
            plan={plan} 
            nodes={nodes} 
            supabase={supabase}
            planId={planId}
            onRefresh={refreshNodes}
            onNodesUpdate={handleNodesUpdate}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        )}

        {activeTab === "notes" && (
          <div className="h-full overflow-y-auto">
            <div className="w-full">
              {isOwner ? (
                isEditingNotes ? (
                  <div className="space-y-3">
                    <textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder={t('planView.notesPlaceholder')}
                      className="w-full h-[60vh] px-4 py-3 bg-neutral-900/50 border border-neutral-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500/50 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveNotes}
                        disabled={savingNotes}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
                      >
                        {savingNotes ? t('common.saving') : t('common.save')}
                      </button>
                      <button
                        onClick={() => { setNotesContent(plan.notes || ""); setIsEditingNotes(false); }}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-lg transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {notesContent ? (
                      <div 
                        className="prose prose-invert prose-sm max-w-none cursor-pointer hover:bg-neutral-900/30 rounded-xl p-5 transition-colors border border-transparent hover:border-neutral-800/50"
                        onClick={() => setIsEditingNotes(true)}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{notesContent}</ReactMarkdown>
                        <p className="text-neutral-600 text-xs mt-4 italic">{t('planView.clickToEdit')}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="w-full py-16 border border-dashed border-neutral-800 rounded-xl text-neutral-600 hover:text-neutral-400 hover:border-neutral-700 transition-all flex flex-col items-center gap-3"
                      >
                        <svg className="w-8 h-8 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-sm">{t('planView.addNotes')}</span>
                      </button>
                    )}
                  </div>
                )
              ) : (
                notesContent ? (
                  <div className="prose prose-invert prose-sm max-w-none p-5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{notesContent}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-16 text-neutral-600 flex flex-col items-center gap-3">
                    <svg className="w-8 h-8 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-sm">{t('planView.noNotes')}</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {activeTab === "performance" && (
          <PerformanceChat 
            planId={planId}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        )}

        {activeTab === "files" && (
          <PlanFilesTab
            planId={planId}
            isOwner={isOwner}
          />
        )}
      </main>

      {showRemixModal && (
        <RemixModal
          plan={{ id: plan.id, root_topic: plan.root_topic, author_username: plan.author_username || "anonymous", remix_count: plan.remix_count || 0 }}
          onClose={() => setShowRemixModal(false)}
          onComplete={(newPlanId) => {
            setShowRemixModal(false);
            router.push(`/plan/${newPlanId}`);
          }}
        />
      )}
    </div>
  );
}
