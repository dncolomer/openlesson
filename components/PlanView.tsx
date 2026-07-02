"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { PlanChat } from "@/components/PlanChat";
import { Navbar } from "@/components/Navbar";
import { RemixModal } from "@/components/RemixModal";
import { useI18n } from "../lib/i18n";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PerformanceChat } from "@/components/PerformanceChat";
import { PlanFilesTab } from "@/components/PlanFilesTab";
import { SessionList } from "@/components/SessionList";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { PublicWorkspaceForkPanel } from "@/components/PublicWorkspaceForkPanel";
import { WorkspaceBuilderShell } from "@/components/WorkspaceBuilderShell";
import { WorkspaceIdentityPanel } from "@/components/WorkspaceIdentityPanel";
import { WorkspaceTabBar } from "@/components/WorkspaceTabBar";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";

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
  is_group?: boolean;
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

function planShareSlug(plan: LearningPlan) {
  const title = plan.title || plan.root_topic || "plan";
  return encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan");
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
  const [activeTab, setActiveTab] = useState<"graph" | "notes" | "performance" | "files" | "integration">("graph");
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("plan");
  const [workspaceImage, setWorkspaceImage] = useState(() => aestheticImageForId(planId));
  const [authChecked, setAuthChecked] = useState(false);
  const forkModalAutoOpenedRef = useRef(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isOwner = currentUserId ? plan?.user_id === currentUserId : false;
  const needsFork = authChecked && !!plan?.is_public && !plan?.is_group && !isOwner;
  const publicLoginHref = plan
    ? `/login?redirect=${encodeURIComponent(`/p/${planId}/${planShareSlug(plan)}`)}`
    : `/login?redirect=${encodeURIComponent(`/workspace/${planId}`)}`;

  const refreshNodes = () => {
    setRefreshKey(k => k + 1);
  };

  const handleNodesUpdate = (newNodes: PlanNode[]) => {
    setNodes(newNodes);
  };

  const handleShare = () => {
    const slug = planShareSlug(plan!);
    const url = `${window.location.origin}/p/${plan!.id}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    let cancelled = false;

    fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        const images = packages.flatMap((pkg) => pkg.images);
        if (images.length === 0) return;
        setWorkspaceImage(aestheticImageForId(planId, images));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [planId]);

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

      if (!planData.is_public && !planData.is_group) {
        if (!user) {
          router.push("/login?redirect=/workspace/" + planId);
          return;
        }
        if (planData.user_id !== user.id) {
          setError("Plan not found");
          setLoading(false);
          return;
        }
      }

      // Group plans require authentication
      if (planData.is_group && !planData.is_public && !user) {
        router.push("/login?redirect=/workspace/" + planId);
        return;
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

        // For group plan participants (non-owner): overlay their own
        // session statuses from plan_node_sessions
        if (planData.is_group && user && planData.user_id !== user.id) {
          const { data: pnsLinks } = await supabase
            .from("plan_node_sessions")
            .select("plan_node_id, session_id")
            .eq("plan_id", planId)
            .eq("user_id", user.id);

          if (pnsLinks && pnsLinks.length > 0) {
            const pnsSessionIds = pnsLinks.map(l => l.session_id);
            const { data: pnsSessions } = await supabase
              .from("sessions")
              .select("id, status")
              .in("id", pnsSessionIds);

            if (pnsSessions) {
              // Map node_id -> best session status
              const nodeStatusMap = new Map<string, string>();
              const sessionStatusMap = new Map(pnsSessions.map(s => [s.id, s.status]));
              for (const link of pnsLinks) {
                const sStatus = sessionStatusMap.get(link.session_id);
                if (!sStatus) continue;
                const existing = nodeStatusMap.get(link.plan_node_id);
                // Completed > in_progress/active > not_started
                if (sStatus === "completed" || sStatus === "ended_by_tutor") {
                  nodeStatusMap.set(link.plan_node_id, "completed");
                } else if ((sStatus === "active" || sStatus === "paused") && existing !== "completed") {
                  nodeStatusMap.set(link.plan_node_id, "in_progress");
                }
              }

              // Also build a map of node -> active session for resuming
              const nodeActiveSessionMap = new Map<string, string>();
              for (const link of pnsLinks) {
                const sStatus = sessionStatusMap.get(link.session_id);
                if (sStatus === "active" || sStatus === "paused") {
                  nodeActiveSessionMap.set(link.plan_node_id, link.session_id);
                }
              }

              setNodes(prev => prev.map(n => {
                const overrideStatus = nodeStatusMap.get(n.id);
                const activeSessionId = nodeActiveSessionMap.get(n.id);
                if (overrideStatus || activeSessionId) {
                  return {
                    ...n,
                    status: overrideStatus || n.status,
                    session_id: activeSessionId || n.session_id,
                  };
                }
                return n;
              }));
            }
          }
        }
      }

      setLoading(false);
      setAuthChecked(true);
    }

    loadPlan();
  }, [planId, supabase, router, refreshKey]);

  useEffect(() => {
    if (!needsFork) return;
    setActiveTab("graph");
    setMobileColumn("workspace");
    if (!forkModalAutoOpenedRef.current && currentUserId) {
      forkModalAutoOpenedRef.current = true;
      setShowRemixModal(true);
    }
  }, [needsFork, currentUserId]);

  useEffect(() => {
    if (plan) {
      setEditTitle(plan.title || plan.root_topic);
    }
  }, [plan?.title, plan?.root_topic]);

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

  useEffect(() => {
    if (!isOwner && activeTab === "integration") {
      setActiveTab("graph");
    }
  }, [isOwner, activeTab]);


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
        <Link href="/" className="text-neutral-300 hover:text-white hover:underline">
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
    { key: "performance" as const, label: t('planView.performance'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    )},
    { key: "notes" as const, label: t('planView.notes'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )},
    { key: "files" as const, label: t('planView.files'), icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
      </svg>
    )},
    ...(isOwner
      ? [{
          key: "integration" as const,
          label: t('planView.integration'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25M14.25 4.5l-4.5 15" />
            </svg>
          ),
        }]
      : []),
  ];

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <aside className={`${mobileColumn === "plan" ? "flex" : "hidden"} group flex-1 min-h-0 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] overflow-y-auto md:hidden`}>
          <div className="space-y-5 p-4 md:flex-1 md:min-h-0 md:overflow-y-auto md:p-5">
            <div className="space-y-2">
              {isEditingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-base font-semibold text-white focus:border-neutral-400 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
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
                      className="rounded-md bg-white px-3 py-1.5 text-sm text-black transition-colors hover:bg-neutral-200"
                    >
                      {t("common.save")}
                    </button>
                    <button
                      onClick={() => {
                        setEditTitle(plan.title || plan.root_topic);
                        setIsEditingTitle(false);
                      }}
                      className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-white transition-colors hover:bg-neutral-700"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <h1 className="text-lg font-semibold leading-snug text-white">{plan.title || plan.root_topic}</h1>
                  {isOwner && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="mt-0.5 flex-shrink-0 text-white/35 transition-colors hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {plan.is_group && (
                  <span className="rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-300">
                    {t("planView.group")}
                  </span>
                )}
                {plan.is_public && plan.author_username && (
                  <span className="text-neutral-500">
                    {t("planView.by")} <span className="text-neutral-400">@{plan.author_username}</span>
                  </span>
                )}
                {plan.is_public && (plan.remix_count ?? 0) > 0 && (
                  <span className="text-neutral-500">
                    {plan.remix_count}{" "}
                    {(plan.remix_count || 0) === 1 ? t("planView.fork") : t("planView.forks", { count: plan.remix_count || 0 })}
                  </span>
                )}
                {plan.original_plan_id && <span className="font-medium text-neutral-400">{t("planView.remixed")}</span>}
              </div>
            </div>

            {(plan.description || isOwner) && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAbout")}</p>
                {isEditingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder={t("planView.addDescription")}
                      className="min-h-16 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-400 focus:outline-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-3 text-xs">
                      <button onClick={saveDescription} disabled={savingDescription} className="font-medium text-neutral-200 hover:text-white">
                        {savingDescription ? "..." : t("common.save")}
                      </button>
                      <button
                        onClick={() => {
                          setEditDescription(plan.description || "");
                          setIsEditingDescription(false);
                        }}
                        className="text-neutral-500 hover:text-neutral-300"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : plan.description ? (
                  <p
                    className="line-clamp-3 cursor-pointer text-sm leading-relaxed text-neutral-500 transition-colors hover:text-neutral-400"
                    onClick={() => isOwner && setIsEditingDescription(true)}
                  >
                    {plan.description}
                  </p>
                ) : (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="text-sm text-neutral-600 transition-colors hover:text-neutral-400"
                  >
                    {t("planView.addDescriptionBtn")}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionProducts")}</p>
                <div className="flex flex-col gap-1.5">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab("integration")}
                      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                    >
                      <span className="block text-xs font-medium text-white">{t("planView.productEvidenceApi")}</span>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productEvidenceApiHint")}</span>
                    </button>
                  ) : (
                    <Link
                      href="/docs/agentic-v2"
                      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                    >
                      <span className="block text-xs font-medium text-white">{t("planView.productEvidenceApi")}</span>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productEvidenceApiHint")}</span>
                    </Link>
                  )}
                  {currentUserId && (
                    <Link
                      href={`/workspace/${planId}/ghl-score`}
                      className="w-full rounded-md bg-white px-3 py-2 text-left transition-colors hover:bg-neutral-200"
                    >
                      <span className="block text-xs font-medium text-black">{t("planView.productTap")}</span>
                      <span className="mt-0.5 block text-[10px] text-neutral-600">{t("planView.productTapHint")}</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("graph")}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                  >
                    <span className="block text-xs font-medium text-white">{t("planView.productIle")}</span>
                    <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productIleHint")}</span>
                  </button>
                  <div
                    className="w-full rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-left opacity-80"
                    aria-disabled="true"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-neutral-400">{t("planView.productAle")}</span>
                      <span className="rounded-sm border border-amber-400/20 bg-amber-950/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1px] text-amber-200/90">
                        {t("planView.productUpcoming")}
                      </span>
                    </div>
                    <span className="mt-0.5 block text-[10px] text-neutral-600">{t("planView.productAleHint")}</span>
                  </div>
                </div>
              </div>

              {(plan.is_public || plan.is_group) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionShare")}</p>
                  <button
                    onClick={handleShare}
                    className="w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70 transition-all hover:bg-white/15 hover:text-white"
                  >
                    {copied ? t("planView.copied") : t("planView.share")}
                  </button>
                </div>
              )}

              {isOwner && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAccess")}</p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={async () => {
                        try {
                          const isGroup = plan.is_group ?? false;
                          const res = await fetch(`/api/learning-plans/${planId}/group`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ is_group: !isGroup }),
                          });
                          const data = await res.json();
                          if (data.success) setPlan({ ...plan, is_group: !isGroup });
                        } catch (err) {
                          console.error("Error toggling group mode:", err);
                        }
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-xs transition-all ${
                        plan.is_group
                          ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                          : "border-white/10 bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                      }`}
                    >
                      {plan.is_group ? t("planView.groupPlan") : t("planView.makeGroupPlan")}
                    </button>
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
                          if (data.success) setPlan({ ...plan, is_public: !isPublic });
                        } catch (err) {
                          console.error("Error toggling visibility:", err);
                        }
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-xs transition-all ${
                        plan.is_public
                          ? "border-green-500/30 bg-green-500/15 text-green-400 hover:bg-green-500/25"
                          : "border-white/10 bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                      }`}
                    >
                      {plan.is_public ? t("planView.makePrivate") : t("planView.makePublic")}
                    </button>
                  </div>
                </div>
              )}

              {(isOwner && plan.is_public) || (currentUserId && !isOwner && !plan.is_group) || (!currentUserId && !plan.is_group) ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionCommunity")}</p>
                  {isOwner && plan.is_public ? (
                    <button
                      onClick={() => setShowRemixModal(true)}
                      className="w-full rounded-md border border-neutral-800 px-3 py-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-neutral-300"
                    >
                      {t("planView.forkRemix")}
                    </button>
                  ) : currentUserId ? (
                    <button
                      onClick={() => setShowRemixModal(true)}
                      className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs text-neutral-200 transition-all hover:bg-white/15"
                    >
                      {t("planView.forkRemix")}
                    </button>
                  ) : (
                    <Link
                      href="/register"
                      className="block w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-center text-xs text-neutral-200 transition-all hover:bg-white/15"
                    >
                      {t("planView.forkRemix")}
                    </Link>
                  )}
                </div>
              ) : null}

              {currentUserId && !isOwner && plan.is_group && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAccess")}</p>
                  <span className="block rounded-md border border-white/15 bg-white/10 px-3 py-2 text-center text-xs text-neutral-300">
                    {t("planView.groupParticipant")}
                  </span>
                </div>
              )}

              {!currentUserId && plan.is_group && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAccess")}</p>
                  <Link
                    href={`/login?redirect=/p/${planId}/${planShareSlug(plan)}`}
                    className="block w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-center text-xs text-neutral-200 transition-all hover:bg-white/15"
                  >
                    {t("planView.signInToJoin")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </aside>

        <aside className={`${mobileColumn === "sessions" ? "flex" : "hidden"} flex-1 min-h-0 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] md:flex md:h-full md:w-1/2 md:border-b-0 md:border-r`}>
          <SessionList
            nodes={nodes}
            onSelect={() => {}}
            onDelete={() => {}}
            onFork={() => {}}
            isOwner={isOwner}
            isGroupPlan={plan.is_group === true}
            maskProgress={needsFork}
            onRequestFork={() => setShowRemixModal(true)}
            forkLoginHref={publicLoginHref}
            isLoggedIn={!!currentUserId}
            supabase={supabase}
            planTopic={plan.root_topic}
            planId={planId}
            onRefresh={refreshNodes}
            onNodesUpdate={handleNodesUpdate}
          />
        </aside>

        <section className={`${mobileColumn === "workspace" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080808] md:flex`}>
          {workspaceImage && (
            <img
              src={workspaceImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35 saturate-75"
            />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" />

          <div className="relative z-20 hidden shrink-0 px-3 pt-3 pb-1 sm:px-4 md:block">
            <div className="overflow-hidden rounded-xl border border-neutral-800/70 bg-neutral-950/90 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <WorkspaceIdentityPanel
                plan={plan}
                planId={planId}
                isOwner={isOwner}
                currentUserId={currentUserId}
                copied={copied}
                onShare={handleShare}
                onPlanUpdate={setPlan}
                onShowRemixModal={() => setShowRemixModal(true)}
                publicLoginHref={publicLoginHref}
                variant="floating"
              />
              <WorkspaceTabBar
                tabs={tabConfig}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="integrated"
              />
            </div>
          </div>

          {/* Tab Content */}
          <main className="relative z-10 flex-1 p-3 sm:p-4 pb-3 sm:pb-4 min-h-0 overflow-hidden">
        {activeTab === "graph" && (
          <div className="hidden h-full md:block">
            <WorkspaceBuilderShell
              needsFork={needsFork}
              authorUsername={plan.author_username}
              isLoggedIn={!!currentUserId}
              publicLoginHref={publicLoginHref}
              onFork={() => setShowRemixModal(true)}
            >
              <PlanChat
                plan={plan}
                nodes={nodes}
                supabase={supabase}
                planId={planId}
                onRefresh={refreshNodes}
                onNodesUpdate={handleNodesUpdate}
                isOwner={isOwner}
                currentUserId={currentUserId}
                isGroupPlan={plan.is_group === true}
                hideSessions
                embedded
              />
            </WorkspaceBuilderShell>
          </div>
        )}

        {activeTab === "graph" && (
          <div className="h-full md:hidden">
            {needsFork ? (
              <PublicWorkspaceForkPanel
                authorUsername={plan.author_username}
                isLoggedIn={!!currentUserId}
                loginHref={publicLoginHref}
                onFork={() => setShowRemixModal(true)}
              />
            ) : (
              <PlanChat
                plan={plan}
                nodes={nodes}
                supabase={supabase}
                planId={planId}
                onRefresh={refreshNodes}
                onNodesUpdate={handleNodesUpdate}
                isOwner={isOwner}
                currentUserId={currentUserId}
                isGroupPlan={plan.is_group === true}
                hideSessions
              />
            )}
          </div>
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
                      className="w-full h-[60vh] px-4 py-3 bg-neutral-900/50 border border-neutral-800 rounded-md text-white text-sm font-mono focus:outline-none focus:border-neutral-400 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveNotes}
                        disabled={savingNotes}
                        className="px-4 py-2 bg-white hover:bg-neutral-200 disabled:bg-neutral-700 text-black disabled:text-white text-sm rounded-md transition-colors"
                      >
                        {savingNotes ? t('common.saving') : t('common.save')}
                      </button>
                      <button
                        onClick={() => { setNotesContent(plan.notes || ""); setIsEditingNotes(false); }}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {notesContent ? (
                      <div 
                        className="prose prose-invert prose-sm max-w-none cursor-pointer hover:bg-neutral-900/30 rounded-md p-5 transition-colors border border-transparent hover:border-neutral-800/50"
                        onClick={() => setIsEditingNotes(true)}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{notesContent}</ReactMarkdown>
                        <p className="text-neutral-600 text-xs mt-4 italic">{t('planView.clickToEdit')}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="w-full py-16 border border-dashed border-neutral-800 rounded-md text-neutral-600 hover:text-neutral-400 hover:border-neutral-700 transition-all flex flex-col items-center gap-3"
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
            isGroupPlan={plan.is_group === true}
          />
        )}

        {activeTab === "files" && (
          <PlanFilesTab
            planId={planId}
            isOwner={isOwner}
          />
        )}

        {activeTab === "integration" && (
          <WorkspaceIntegrationPanel
            planId={planId}
            planTitle={plan.title || plan.root_topic}
            planTopic={plan.root_topic}
            planDescription={plan.description}
            planNotes={plan.notes}
            isOwner={isOwner}
            currentUserId={currentUserId}
          />
        )}
          </main>

          <div className="relative z-10 flex-shrink-0 px-3 pb-2 md:hidden">
            <WorkspaceTabBar
              tabs={tabConfig}
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="mobile"
            />
          </div>
        </section>
      </div>

      <div className="md:hidden flex-shrink-0 border-t border-neutral-800/70 bg-[#0b0b0b] px-3 py-2">
        <div className="grid grid-cols-3 gap-2 rounded-md border border-neutral-800 bg-neutral-950/70 p-1">
          {[
            { key: "plan" as const, label: "Workspace", icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            ) },
            { key: "sessions" as const, label: "Blocks", icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75zm0 5.25h.008v.008H3.75V12zm0 5.25h.008v.008H3.75v-.008z" />
              </svg>
            ) },
            { key: "workspace" as const, label: "Workspace", icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            ) },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMobileColumn(key)}
              className={`flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-medium transition-colors ${
                mobileColumn === key
                  ? "bg-neutral-700/80 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {showRemixModal && (
        <RemixModal
          plan={{ id: plan.id, root_topic: plan.root_topic, author_username: plan.author_username || "anonymous", remix_count: plan.remix_count || 0 }}
          onClose={() => setShowRemixModal(false)}
          onComplete={(newPlanId) => {
            setShowRemixModal(false);
            router.push(`/workspace/${newPlanId}`);
          }}
        />
      )}
    </div>
  );
}
