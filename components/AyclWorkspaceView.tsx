"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOrderedSessions, SessionList } from "@/components/SessionList";
import { SessionItem } from "@/components/SessionItem";
import { WorkspaceBlockDetailPane } from "@/components/WorkspaceBlockDetailPane";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";
import { WorkspaceSectionSurface } from "@/components/WorkspaceSectionSurface";
import { WorkspaceNotesFilesPanel } from "@/components/WorkspaceNotesFilesPanel";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { aestheticImageForId } from "@/lib/aesthetics";
import { useI18n } from "@/lib/i18n";
import type { Block, Workspace } from "@/components/WorkspaceView";
import {
  availableWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  clearWorkspaceBlockSelection,
  nextWorkspaceBlockSelection,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";

interface AyclWorkspaceViewProps {
  accessToken: string;
  ownerUserId: string;
  initialPlan: Workspace;
  initialNodes: Block[];
}

export function AyclWorkspaceView({
  accessToken,
  ownerUserId,
  initialPlan,
  initialNodes,
}: AyclWorkspaceViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [nodes, setNodes] = useState(initialNodes);
  const [workspaceImage] = useState(() => aestheticImageForId(plan.id));
  const [copied, setCopied] = useState(false);
  // AYCL token holder is owner-equivalent for this purchased workspace.
  const isOwner = true;
  const [activeSection, setActiveSection] = useState<WorkspaceSectionKey>("workspace");
  const [notesContent, setNotesContent] = useState(initialPlan.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("sessions");
  /** Open block for right-pane detail (double-click). Null → notes. */
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  const handleExpandedBlockChange = useCallback((blockId: string | null) => {
    const next = nextWorkspaceBlockSelection(expandedBlockId, blockId);
    setExpandedBlockId(next);
    if (next) setMobileColumn("workspace");
  }, [expandedBlockId]);

  const handleCloseBlockDetail = useCallback(() => {
    setExpandedBlockId(clearWorkspaceBlockSelection());
  }, []);

  const rightPane = resolveWorkspaceRightPane(expandedBlockId);
  const orderedBlocks = getOrderedSessions(nodes as Parameters<typeof getOrderedSessions>[0]);
  const detailBlock =
    expandedBlockId != null
      ? orderedBlocks.find((n) => n.id === expandedBlockId) ?? null
      : null;
  const detailIndex = detailBlock
    ? orderedBlocks.findIndex((n) => n.id === detailBlock.id)
    : -1;

  const refreshWorkspace = useCallback(async () => {
    const res = await fetch(`/api/aycl/workspace?token=${encodeURIComponent(accessToken)}`);
    const data = await res.json();
    if (res.ok && data.workspace) {
      setPlan(data.workspace);
      setNodes(data.blocks || []);
      setNotesContent(data.workspace.notes || "");
    }
  }, [accessToken]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  const selectSection = useCallback((section: WorkspaceSectionKey) => {
    setActiveSection(resolveActiveSection(section, { isOwner }));
    if (section === "workspace") {
      setMobileColumn("workspace");
    }
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCustomStart = async (node: Block) => {
    const res = await fetch("/api/aycl/start-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: accessToken,
        blockId: node.id,
        blockTitle: node.title,
        planningPrompt: node.planning_prompt,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start session");
    router.push(`/learn/${accessToken}/session?id=${data.session.id}`);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch("/api/workspace/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: plan.id,
          notes: notesContent,
          ayclToken: accessToken,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save notes");
      }
      setPlan({ ...plan, notes: notesContent });
      setIsEditingNotes(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      alert(error instanceof Error ? error.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const sectionLayout = resolveWorkspaceSectionLayout(activeSection);
  const visibleSections = availableWorkspaceSections({ isOwner });

  const sectionConfig = [
    {
      key: "workspace" as const,
      label: t("planView.sectionWorkspace"),
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z"
          />
        </svg>
      ),
    },
    ...(visibleSections.includes("knowledge")
      ? [
          {
            key: "knowledge" as const,
            label: t("planView.sectionKnowledge"),
            icon: (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                />
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
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25M14.25 4.5l-4.5 15"
                />
              </svg>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800/60 px-4 py-3">
        <div className="min-w-0">
          <Link href="/all-you-can-learn" className="text-xs text-neutral-500 hover:text-neutral-300">
            All-You-Can-Learn
          </Link>
          <h1 className="truncate text-base font-semibold">{plan.title || plan.root_topic}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
              Lifetime access
            </span>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300">
              Open-ended only
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
        >
          {copied ? "Copied!" : "Copy access link"}
        </button>
      </header>

      <WorkspaceSectionNav
        sections={sectionConfig}
        activeSection={activeSection}
        onChange={selectSection}
        variant="bar"
        workspaceTitle={plan.title || plan.root_topic}
      />

      {sectionLayout.mountsPerformancePanel && (
        <WorkspaceSectionSurface
          kind="knowledge"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId: plan.id,
            isOwner: true,
          }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800/70 bg-neutral-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <WorkspacePerformancePanel
              workspaceId={plan.id}
              isOwner
              currentUserId={ownerUserId}
              hideTap
              ayclToken={accessToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.mountsIntegrationPanel && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={{
            title: plan.title || plan.root_topic,
            topic: plan.root_topic,
            description: plan.description,
            notes: plan.notes,
            workspaceId: plan.id,
            isOwner: true,
          }}
        >
          <WorkspaceIntegrationPanel
            workspaceId={plan.id}
            workspaceTitle={plan.title || plan.root_topic}
            planTopic={plan.root_topic}
            planDescription={plan.description}
            planNotes={plan.notes}
            isOwner
            currentUserId={ownerUserId}
          />
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.showBlockMapChrome && (
        <>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside
              className={`${mobileColumn === "sessions" ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] md:flex md:h-full md:w-1/2 md:border-b-0 md:border-r`}
            >
              <SessionList
                nodes={nodes}
                onSelect={() => {}}
                onDelete={() => {}}
                onFork={() => {}}
                isOwner
                isGroupPlan={false}
                isLoggedIn={false}
                planTopic={plan.root_topic}
                workspaceId={plan.id}
                onRefresh={refreshWorkspace}
                onNodesUpdate={setNodes}
                hideTap
                onCustomStart={handleCustomStart}
                ayclToken={accessToken}
                expandedNodeId={expandedBlockId}
                onExpandedNodeIdChange={handleExpandedBlockChange}
              />
            </aside>

            <section
              className={`${mobileColumn === "workspace" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080808] md:flex`}
            >
              {workspaceImage ? (
                <img
                  src={workspaceImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-35 saturate-75"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/35" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" />

              <div className="relative z-20 hidden shrink-0 px-3 pt-3 pb-1 sm:px-4 md:block">
                <div className="overflow-visible rounded-xl border border-neutral-800/70 bg-neutral-950/90 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
                  <div className="border-b border-neutral-800/60 px-4 py-3">
                    <p className="text-sm text-neutral-300">{plan.title || plan.root_topic}</p>
                    {plan.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{plan.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <main
                className="relative z-10 min-h-0 flex-1 overflow-hidden p-3 pb-3 sm:p-4 sm:pb-4"
                data-workspace-right-column
                data-workspace-right-pane={rightPane}
              >
                {rightPane === "block_detail" && detailBlock && detailIndex >= 0 ? (
                  <WorkspaceBlockDetailPane
                    title={detailBlock.title}
                    onClose={handleCloseBlockDetail}
                  >
                    <SessionItem
                      node={detailBlock}
                      index={detailIndex}
                      onSelect={() => {}}
                      onDelete={() => {}}
                      onFork={() => {}}
                      isExpanded
                      isOwner
                      isLoggedIn={false}
                      planTopic={plan.root_topic}
                      workspaceId={plan.id}
                      variant="detail"
                      detailLayout="inline"
                      hideTap
                      onCustomStart={handleCustomStart}
                    />
                  </WorkspaceBlockDetailPane>
                ) : (
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
                    isOwner
                    workspaceId={plan.id}
                    showFiles={false}
                  />
                )}
              </main>
            </section>
          </div>

          <div className="shrink-0 border-t border-neutral-800/70 bg-[#0b0b0b] px-3 py-2 md:hidden">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-800 bg-neutral-950/70 p-1">
              {[
                { key: "sessions" as const, label: "Blocks" },
                { key: "workspace" as const, label: "Notes" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMobileColumn(key)}
                  className={`rounded px-2 py-2 text-xs font-medium transition-colors ${
                    mobileColumn === key
                      ? "bg-neutral-700/80 text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
