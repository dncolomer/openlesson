"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "../lib/i18n";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { SessionList } from "@/components/SessionList";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { WorkspaceNotesFilesPanel } from "@/components/WorkspaceNotesFilesPanel";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";
import { WorkspaceSectionSurface } from "@/components/WorkspaceSectionSurface";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";

export interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
}

export interface Workspace {
  id: string;
  title: string;
  root_topic: string;
  status: string;
  user_id?: string;
  description?: string;
  is_public?: boolean;
  is_group?: boolean;
  organization_id?: string | null;

  original_workspace_id?: string;
  remix_count?: number;
  source_type?: "topic" | "youtube";
  source_url?: string;
  source_summary?: string;
  notes?: string;
  workspace_goal?: string | null;
  cover_image_url?: string;
  is_all_you_can_learn?: boolean;
}

interface WorkspaceViewProps {
  initialPlan?: Workspace;
  initialNodes?: Block[];
}

function planShareSlug(plan: Workspace) {
  const title = plan.title || plan.root_topic || "plan";
  return encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan");
}

function parseSectionParam(value: string | null): WorkspaceSectionKey | null {
  if (value === "workspace" || value === "knowledge" || value === "settings") return value;
  return null;
}

export function WorkspaceView({ initialPlan, initialNodes }: WorkspaceViewProps) {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.id as string;
  const sectionFromUrl = parseSectionParam(searchParams.get("section"));
  const knowledgeSubviewFromUrl = searchParams.get("subview");
  
  const [plan, setPlan] = useState<Workspace | null>(initialPlan || null);
  const [nodes, setNodes] = useState<Block[]>(initialNodes || []);
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  /** Org admin for this workspace's organization (or platform admin). */
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSectionKey>(
    () => sectionFromUrl ?? "workspace",
  );
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("plan");
  const [workspaceImage, setWorkspaceImage] = useState(() => aestheticImageForId(workspaceId));
  
  const supabase = createClient();

  const isOwner = currentUserId ? plan?.user_id === currentUserId : false;
  const canAccessPrivilegedSections = canAccessPrivilegedWorkspaceSections({
    isOwner,
    isOrgAdmin,
  });

  const refreshNodes = () => {
    setRefreshKey(k => k + 1);
  };

  const handleNodesUpdate = (newNodes: Block[]) => {
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
        setWorkspaceImage(aestheticImageForId(workspaceId, images));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    async function loadPlan() {
      let user: { id: string } | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      } catch (error) {
        console.warn("Supabase auth session check failed:", error);
      }
      setCurrentUserId(user?.id || null);

      const { data: planData, error: planError } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (planError || !planData) {
        setError("Plan not found");
        setLoading(false);
        return;
      }

      if (!planData.is_public) {
        if (!user) {
          router.push("/login?redirect=/workspace/" + workspaceId);
          return;
        }
        if (planData.user_id !== user.id) {
          setError("Plan not found");
          setLoading(false);
          return;
        }
      }

      // Org admin of the workspace's organization (or platform admin) may open Knowledge/Settings.
      let orgAdminForWorkspace = false;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_org_admin, is_admin, organization_id")
          .eq("id", user.id)
          .maybeSingle();
        const workspaceOrgId =
          typeof planData.organization_id === "string" ? planData.organization_id : null;
        const profileOrgId = profile?.organization_id ?? null;
        orgAdminForWorkspace = Boolean(
          profile?.is_admin === true ||
            (profile?.is_org_admin === true &&
              profileOrgId &&
              workspaceOrgId &&
              profileOrgId === workspaceOrgId),
        );
      }
      setIsOrgAdmin(orgAdminForWorkspace);

      setPlan(planData);

      const { data: nodesData, error: nodesError } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (nodesError) {
        setError("Failed to load nodes");
      } else {
        let finalNodes = nodesData || [];

        const sessionIds = finalNodes
          .map((n: Block) => n.session_id)
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

            finalNodes = finalNodes.map((n: Block) => {
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
  }, [workspaceId, supabase, router, refreshKey]);

  useEffect(() => {
    if (plan?.notes !== undefined) {
      setNotesContent(plan.notes || "");
    }
  }, [plan?.notes]);

  useEffect(() => {
    setActiveSection((current) =>
      resolveActiveSection(current, { isOwner, isOrgAdmin }),
    );
  }, [isOwner, isOrgAdmin]);

  const selectSection = useCallback(
    (section: WorkspaceSectionKey) => {
      setActiveSection(resolveActiveSection(section, { isOwner, isOrgAdmin }));
      if (section === "workspace") {
        setMobileColumn("workspace");
      }
    },
    [isOwner, isOrgAdmin],
  );

  const saveNotes = async () => {
    if (!plan) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/workspace/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: plan.id, notes: notesContent }),
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <LoadingStatusMessage message={t('planView.loading')} />
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

  const sectionLayout = resolveWorkspaceSectionLayout(activeSection);
  const visibleSections = availableWorkspaceSections({ isOwner, isOrgAdmin });

  const sectionConfig = [
    {
      key: "workspace" as const,
      label: t("planView.sectionWorkspace"),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
        </svg>
      ),
    },
    ...(visibleSections.includes("knowledge")
      ? [
          {
            key: "knowledge" as const,
            label: t("planView.sectionKnowledge"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("settings")
      ? [
          {
            key: "settings" as const,
            label: t("planView.sectionSetting"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25M14.25 4.5l-4.5 15" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <Navbar />

      <WorkspaceSectionNav
        sections={sectionConfig}
        activeSection={activeSection}
        onChange={selectSection}
        variant="bar"
        workspaceTitle={plan.title || plan.root_topic}
      />

      {canAccessPrivilegedSections && sectionLayout.mountsPerformancePanel && (
        <WorkspaceSectionSurface
          kind="knowledge"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId,
            isOwner,
          }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800/70 bg-neutral-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <WorkspacePerformancePanel
              workspaceId={workspaceId}
              isOwner={isOwner}
              currentUserId={currentUserId}
              initialSubview={
                knowledgeSubviewFromUrl === "insights" ||
                knowledgeSubviewFromUrl === "score" ||
                knowledgeSubviewFromUrl === "pow" ||
                knowledgeSubviewFromUrl === "knowledge" ||
                knowledgeSubviewFromUrl === "lwm"
                  ? knowledgeSubviewFromUrl
                  : undefined
              }
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {canAccessPrivilegedSections && sectionLayout.mountsIntegrationPanel && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId,
            isOwner,
          }}
        >
          <WorkspaceIntegrationPanel
            workspaceId={workspaceId}
            workspaceTitle={plan.title || plan.root_topic}
            planTopic={plan.root_topic}
            planDescription={plan.description}
            planNotes={plan.notes}
            isOwner={isOwner}
            currentUserId={currentUserId}
            plan={plan}
            onPlanUpdate={setPlan}
          />
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.showBlockMapChrome && (
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <aside className={`${mobileColumn === "plan" ? "flex" : "hidden"} group flex-1 min-h-0 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] overflow-y-auto md:hidden`}>
          <div className="space-y-5 p-4 md:flex-1 md:min-h-0 md:overflow-y-auto md:p-5">
            <div className="space-y-2">
              <h1 className="text-lg font-semibold leading-snug text-white">{plan.title || plan.root_topic}</h1>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {plan.is_public && (
                  <span className="rounded border border-green-500/25 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-400/90">
                    {t("planView.public")}
                  </span>
                )}
                {plan.original_workspace_id && <span className="font-medium text-neutral-400">{t("planView.remixed")}</span>}
              </div>
            </div>

            {plan.description ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAbout")}</p>
                <p className="line-clamp-3 text-sm leading-relaxed text-neutral-500">
                  {plan.description}
                </p>
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionProducts")}</p>
                <div className="flex flex-col gap-1.5">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => selectSection("settings")}
                      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                    >
                      <span className="block text-xs font-medium text-white">{t("planView.productProofOfWorkApi")}</span>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productProofOfWorkApiHint")}</span>
                    </button>
                  ) : (
                    <Link
                      href="/docs/proof-of-work-api"
                      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left transition-all hover:bg-white/10"
                    >
                      <span className="block text-xs font-medium text-white">{t("planView.productProofOfWorkApi")}</span>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">{t("planView.productProofOfWorkApiHint")}</span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      selectSection("workspace");
                      setMobileColumn("sessions");
                    }}
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

              {plan.is_public && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionShare")}</p>
                  <button
                    onClick={handleShare}
                    className="w-full rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70 transition-all hover:bg-white/15 hover:text-white"
                  >
                    {copied ? t("planView.copied") : t("planView.share")}
                  </button>
                  <Link
                    href="/map-of-knowledge"
                    className="block w-full rounded-md border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-center text-xs text-cyan-200/90 transition-all hover:bg-cyan-950/40"
                  >
                    Map of Knowledge
                  </Link>
                </div>
              )}

              {isOwner && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{t("planView.sectionAccess")}</p>
                  <button
                    type="button"
                    onClick={() => selectSection("settings")}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-neutral-300 transition-all hover:bg-white/10 hover:text-white"
                  >
                    {t("planView.sectionSetting")} — {t("planView.sectionAccess")}
                  </button>
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
            isLoggedIn={!!currentUserId}
            supabase={supabase}
            planTopic={plan.root_topic}
            workspaceId={workspaceId}
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

          <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden p-3 pb-3 sm:p-4 sm:pb-4">
            <WorkspaceNotesFilesPanel
              notesContent={notesContent}
              setNotesContent={setNotesContent}
              isEditingNotes={isEditingNotes}
              setIsEditingNotes={setIsEditingNotes}
              savingNotes={savingNotes}
              onSaveNotes={saveNotes}
              onCancelNotes={() => {
                setNotesContent(plan.notes || "");
                setIsEditingNotes(false);
              }}
              isOwner={isOwner}
              workspaceId={workspaceId}
              showFiles
            />
          </main>
        </section>
      </div>
      )}

      {sectionLayout.showBlockMapChrome && (
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
            { key: "workspace" as const, label: "Notes", icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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
      )}

    </div>
  );
}
