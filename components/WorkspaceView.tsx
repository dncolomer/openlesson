"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  mapWorkspaceNodes,
  type Block,
  type Workspace,
  type WorkspaceViewProps,
  planShareSlug,
  parseSectionParam,
} from "@/components/workspace-view/types";
import {
  WorkspaceLoadError,
  WorkspaceLoading,
  WorkspaceViewChrome,
} from "@/components/workspace-view/workspace-chrome";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { WorkspaceSectionHosts } from "@/components/workspace-view/workspace-section-hosts";
import { useWorkspaceLearner } from "@/components/workspace-view/use-workspace-learner";
import { useWorkspaceMapSelection } from "@/components/workspace-view/use-workspace-map-selection";
import { useWorkspaceAuthoring } from "@/components/workspace-view/use-workspace-authoring";
import { useWorkspaceExpandJobs } from "@/components/workspace-view/use-workspace-expand-jobs";
import { useWorkspaceChrome } from "@/components/workspace-view/use-workspace-chrome";
import { buildWorkspaceSectionNavItems } from "@/components/workspace-view/workspace-section-nav-items";
import { WorkspaceMobilePlanAside } from "@/components/workspace-view/workspace-mobile-plan-aside";
import { WorkspaceMobileTabBar } from "@/components/workspace-view/workspace-mobile-tab-bar";
import { WorkspaceMapColumn } from "@/components/workspace-view/workspace-map-column";
import {
  nextLearnerDrawerRequest,
} from "@/lib/block-circular-menu";
import { WorkspaceRightDrawers } from "@/components/workspace-view/workspace-right-drawers";
import {
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  defaultWorkspaceSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  mountsCreatorAuthoringDrawers,
  mountsLearnerPracticeDrawer,
  normalizeWorkspaceInteractionMode,
  resolveActiveSectionForMode,
  resolveWorkspaceModeShell,
  type WorkspaceInteractionMode,
} from "@/lib/workspace-mode";
import { parseWorkspaceKind } from "@/lib/workspace-kind";
import {
  isBlockLockedUntilCompleted,
  type MapGroundBlockRef,
  normalizeUnusableCells,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import { isLearnerMapBlockLocked } from "@/lib/learner-local-dag";
import {
  parseBlockLocalContext,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";
import {
  generatorTargetHighlightCells,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import {
  normalizeWorkspaceDags,
  type WorkspaceDagRecord,
} from "@/lib/workspace-dags";
import {
  formatAyclPriceCentsLabel,
  resolveAyclCapabilities,
  type AyclCapabilities,
} from "@/lib/aycl-shared";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { nextWorkspaceMapSelection } from "@/lib/workspace-map-selection";

export type { Block, Workspace, WorkspaceViewProps };

export function WorkspaceView({
  initialPlan,
  initialNodes,
  ayclToken,
  ayclOwnerUserId,
  ayclAccessTier: ayclAccessTierProp,
  workspaceIdOverride,
  hideNavbar = false,
  accessBanner,
}: WorkspaceViewProps) {
  const { t, locale } = useI18n();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId =
    (workspaceIdOverride || (params?.id as string | undefined) || "").trim() ||
    String(initialPlan?.id || "");
  const isAycl = Boolean(ayclToken);
  const sectionFromUrl = parseSectionParam(searchParams.get("section"));
  const knowledgeSubviewFromUrl = searchParams.get("subview");
  
  const [plan, setPlan] = useState<Workspace | null>(initialPlan || null);
  const [nodes, setNodes] = useState<Block[]>(() =>
    ayclToken
      ? mapWorkspaceNodes(initialNodes || [], { ayclClone: true })
      : initialNodes || [],
  );
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => ayclOwnerUserId || null,
  );
  /** Org admin for this workspace's organization (or platform admin). */
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSectionKey>(
    () =>
      sectionFromUrl ??
      defaultWorkspaceSection(parseWorkspaceKind(initialPlan?.workspace_kind)),
  );
  /** Creator = authoring (default); Learner = practice map + Knowledge LWM. */
  const [interactionMode, setInteractionMode] =
    useState<WorkspaceInteractionMode>(() => {
      if (ayclToken) {
        return resolveAyclCapabilities(ayclAccessTierProp ?? "full")
          .defaultInteractionMode;
      }
      return "creator";
    });
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("plan");
  const [workspaceImage, setWorkspaceImage] = useState(() => aestheticImageForId(workspaceId));
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [unusableCells, setUnusableCells] = useState<UnusableCell[]>([]);
  const [workspaceDags, setWorkspaceDags] = useState<WorkspaceDagRecord[]>(() =>
    normalizeWorkspaceDags(initialPlan?.workspace_dags),
  );
  const [workspaceFileItems, setWorkspaceFileItems] = useState<WorkspaceFileContextItem[]>([]);
  const [mapGroundBusy, setMapGroundBusy] = useState(false);
  const [learnerDrawerRequest, setLearnerDrawerRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const {
    generatorTargetPreviewCells,
    setGeneratorTargetPreviewCells,
    generatorPickActive,
    setGeneratorPickActiveSafe,
    registerGeneratorEmptyToggle,
    handleGeneratorEmptyToggle,
    dynamicPickActive,
    setDynamicPickActiveSafe,
    dynamicUnlockPreviewIds,
    setDynamicUnlockPreviewIds,
    registerDynamicBlockToggle,
    handleDynamicBlockToggle,
    mapSelection,
    applyMapSelectionResult,
    handleMapSelectionChange,
    selectiveExplanationActive,
    setSelectiveExplanationActive,
    selectiveExplanationPolygon,
    setSelectiveExplanationPolygon,
    injectMapNote,
    addExpandPreviewCells,
    setAddExpandPreviewCells,
    expandJobs,
    setExpandJobs,
    clusterMapJob,
    setClusterMapJob,
    expandAbortRef,
    expandJobSeqRef,
    cloneArm,
    setCloneArm,
    handleAbortExpandJob,
    expandedBlockId,
    selectedFilledBlockIds,
    emptySurface,
    handleExpandedBlockChange,
    handleCloseBlockDetail,
    handleCloneArm,
    handleCloneCancel,
    handleEmptyMapSearchBlocks,
    handleEmptyMapSuggestCells,
    handleSelectiveExplanationComplete,
    handleCreateNoteFromSummary,
    handleCloseEmptyCreate,
    handleCloseCombine,
    rightPane,
    showMapExplore,
    handleToggleMapExplore,
    handleMapToggle,
    exploreTargetCell,
    addTargetCell,
    generateShapeCells,
    combineBlockIds,
    detailBlock,
    detailIndex,
    clearMapChromeForModeFlip,
  } = useWorkspaceMapSelection({
    interactionMode,
    unusableCells,
    nodes,
    setMobileColumn,
  });

  /** AYCL purchase tier capabilities (null = non-AYCL). Seeded from prop. */
  const [ayclCapabilities, setAyclCapabilities] = useState<AyclCapabilities | null>(
    () =>
      ayclToken
        ? resolveAyclCapabilities(ayclAccessTierProp ?? "full")
        : null,
  );
  const {
    ayclUpgradeBusy,
    ayclUpgradePriceLabel,
    setAyclUpgradePriceLabel,
    startAyclUpgradeCheckout,
  } = useWorkspaceChrome({
    ayclToken,
    workspaceId,
  });

  const supabase = createClient();

  useEffect(() => {
    if (!isAycl || !ayclCapabilities) return;
    if (!ayclCapabilities.allowCreatorModeToggle) {
      setInteractionMode("learner");
    }
  }, [isAycl, ayclCapabilities]);

  // AYCL: owner-equivalent only when purchase includes creation (full tier).
  // Practice-only access is fixed-scope — no authoring / grow tools.
  const isOwner = isAycl
    ? Boolean(ayclCapabilities?.canAuthor)
    : currentUserId
      ? plan?.user_id === currentUserId
      : false;
  const canAccessPrivilegedSections = canAccessPrivilegedWorkspaceSections({
    isOwner,
    isOrgAdmin,
  });

  const refreshAyclWorkspace = useCallback(async () => {
    if (!ayclToken) return;
    const res = await fetch(
      `/api/aycl/workspace?token=${encodeURIComponent(ayclToken)}`,
    );
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    if (data.workspace) {
      setPlan((prev) => ({ ...(prev || {}), ...data.workspace }));
      setUnusableCells(
        normalizeUnusableCells(
          (data.workspace as { unusable_cells?: unknown }).unusable_cells,
        ),
      );
      setWorkspaceDags(
        normalizeWorkspaceDags(
          (data.workspace as { workspace_dags?: unknown }).workspace_dags,
        ),
      );
    }
    if (Array.isArray(data.blocks)) {
      setNodes(mapWorkspaceNodes(data.blocks, { ayclClone: true }));
    }
    if (data.capabilities) {
      setAyclCapabilities(
        resolveAyclCapabilities(
          (data.capabilities as AyclCapabilities).tier ?? data.accessTier,
        ),
      );
    } else if (data.accessTier) {
      setAyclCapabilities(resolveAyclCapabilities(data.accessTier));
    }
    if (typeof data.upgradePriceLabel === "string" && data.upgradePriceLabel) {
      setAyclUpgradePriceLabel(data.upgradePriceLabel);
    } else if (
      typeof data.upgradePriceCents === "number" &&
      Number.isFinite(data.upgradePriceCents)
    ) {
      setAyclUpgradePriceLabel(formatAyclPriceCentsLabel(data.upgradePriceCents));
    }
  }, [ayclToken]);

  const refreshNodes = useCallback(() => {
    /* Full-plan load is mount / workspace-id only. */
  }, []);

  const {
    handleClonePaste,
    handleCombineBlocks,
    handleSplitBlock,
    handleSubmitGenerateShape,
    handleUpdateBlock,
    handleSaveCreatorEffects,
    handleDeleteBlock,
    handleDeleteBlocks,
    handleClusterBlocks,
    handleClusterProgress,
    handleApplyDag,
    handleDeleteDag,
    handleMapGround,
    handleSaveLocalContext,
  } = useWorkspaceAuthoring({
    workspaceId,
    isOwner,
    ayclToken,
    locale,
    nodes,
    setNodes,
    applyMapSelectionResult,
    setCloneArm,
    setIsAddingBlock,
    setClusterMapJob,
    setUnusableCells,
    setWorkspaceDags,
    setMapGroundBusy,
    refreshNodes,
  });

  const {
    handleExpandFromSourceBlock,
    handleSubmitAddBlock,
    handleGenerateBridge,
  } = useWorkspaceExpandJobs({
    workspaceId,
    isOwner,
    ayclToken,
    locale,
    nodesRef,
    setNodes,
    setExpandJobs,
    setAddExpandPreviewCells,
    expandAbortRef,
    expandJobSeqRef,
    applyMapSelectionResult,
    setCloneArm,
    refreshNodes,
  });

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
      // Purchased AYCL clone: token API, full owner UI, no login redirect.
      if (isAycl && ayclToken) {
        setCurrentUserId(ayclOwnerUserId || null);
        setIsOrgAdmin(false);
        if (initialPlan) {
          setPlan(initialPlan);
          setUnusableCells(normalizeUnusableCells(initialPlan.unusable_cells));
          setWorkspaceDags(normalizeWorkspaceDags(initialPlan.workspace_dags));
        }
        if (initialNodes) {
          setNodes(mapWorkspaceNodes(initialNodes, { ayclClone: true }));
        }
        await refreshAyclWorkspace();
        setLoading(false);
        return;
      }

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
      setUnusableCells(
        normalizeUnusableCells(
          (planData as { unusable_cells?: unknown }).unusable_cells,
        ),
      );
      setWorkspaceDags(
        normalizeWorkspaceDags(
          (planData as { workspace_dags?: unknown }).workspace_dags,
        ),
      );

      const { data: nodesData, error: nodesError } = await supabase
        .from("blocks")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (nodesError) {
        setError("Failed to load nodes");
      } else {
        let finalNodes: Block[] = (nodesData || []).map(
          (n: Block & { local_context?: unknown }) => ({
            ...n,
            local_context: parseBlockLocalContext(n.local_context),
          }),
        );

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

      // File names for prompt-impact + block local refs (excerpts loaded when available).
      const { data: fileRows } = await supabase
        .from("workspace_files")
        .select("file_name, mime_type")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(24);
      setWorkspaceFileItems(
        (fileRows || [])
          .map((f: { file_name?: string; mime_type?: string | null }) => ({
            name: String(f.file_name || "").trim(),
            mime_type: f.mime_type ?? null,
          }))
          .filter((f: WorkspaceFileContextItem) => f.name),
      );

      setLoading(false);
    }

    loadPlan();
  }, [workspaceId, supabase, router, isAycl, ayclToken, ayclOwnerUserId, initialPlan, initialNodes, refreshAyclWorkspace]);

  useEffect(() => {
    if (plan?.notes !== undefined) {
      setNotesContent(plan.notes || "");
    }
  }, [plan?.notes]);

  /**
   * AYCL practice-only is not isOwner, but Learner mode still needs Knowledge
   * (LWM/embeddings). Always resolve sections through the mode-aware helper —
   * never owner-only resolveActiveSection alone (that snaps Knowledge → Workspace).
   */
  const workspaceKind = parseWorkspaceKind(plan?.workspace_kind);
  const sectionAuth = useCallback(
    () => ({
      isOwner,
      isOrgAdmin,
      isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
      workspaceKind,
    }),
    [ayclToken, currentUserId, isOrgAdmin, isOwner, workspaceKind],
  );

  useEffect(() => {
    setActiveSection((current) =>
      resolveActiveSectionForMode({
        mode: interactionMode,
        requested: current,
        ...sectionAuth(),
      }),
    );
  }, [interactionMode, sectionAuth]);

  const selectSection = useCallback(
    (section: WorkspaceSectionKey) => {
      setActiveSection(
        resolveActiveSectionForMode({
          mode: interactionMode,
          requested: section,
          ...sectionAuth(),
        }),
      );
      if (section === "workspace") {
        setMobileColumn("workspace");
      }
    },
    [interactionMode, sectionAuth],
  );

  const saveNotes = async () => {
    if (!plan) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/workspace/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: plan.id, notes: notesContent, ...(ayclToken ? { ayclToken } : {}) }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan({ ...plan, notes: notesContent });
        setIsEditingNotes(false);
      } else {
        alert(errorMessageFromBody(data, "Failed to save notes"));
      }
    } catch (err) {
      console.error("Error saving notes:", err);
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const {
    dynamicGeneratedIds,
    handleBlocksUpdated,
    handleDynamicGenerated,
    handleSavePlanningPrompt,
    handleLaunchIntent,
    handleFetchPowSummary,
    handleMarkDone,
  } = useWorkspaceLearner({
    workspaceId,
    ayclToken,
    currentUserId,
    locale,
    interactionMode,
    nodes,
    setNodes,
    unusableCells,
    router,
  });

  if (loading) {
    return <WorkspaceLoading message={t("planView.loading")} />;
  }

  if (error || !plan) {
    return (
      <WorkspaceLoadError
        error={error}
        fallback={t("planView.planNotFound")}
        homeLabel={t("planView.goBackHome")}
      />
    );
  }

  const modeShell = resolveWorkspaceModeShell({
    mode: interactionMode,
    isOwner,
    isOrgAdmin,
    // AYCL token holders are "signed in" for Learner Knowledge without a cookie session.
    isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
    workspaceKind,
  });
  const resolvedSection = resolveActiveSectionForMode({
    mode: interactionMode,
    requested: activeSection,
    ...sectionAuth(),
  });
  const sectionLayout = resolveWorkspaceSectionLayout(resolvedSection);
  // Mode-aware section list (Learner: workspace+knowledge; Creator: shipped registry).
  // Knowledge Region never resurrects map / Context / Simulation / DAGs.
  const visibleSections =
    interactionMode === "learner"
      ? modeShell.sections
      : availableWorkspaceSections({ isOwner, isOrgAdmin, workspaceKind });
  const isLearnerMode = interactionMode === "learner";
  const showCreatorDrawers = mountsCreatorAuthoringDrawers(interactionMode);
  const showLearnerDrawer = mountsLearnerPracticeDrawer(interactionMode);

  const selectInteractionMode = (mode: WorkspaceInteractionMode) => {
    // Practice-only AYCL cannot switch into Creator tools.
    if (
      isAycl &&
      ayclCapabilities &&
      !ayclCapabilities.allowCreatorModeToggle &&
      mode === "creator"
    ) {
      return;
    }
    const next = normalizeWorkspaceInteractionMode(mode);
    if (next === interactionMode) return;
    setInteractionMode(next);
    clearMapChromeForModeFlip();
    if (next === "learner") {
      setActiveSection(
        resolveActiveSectionForMode({
          mode: next,
          requested: activeSection,
          isOwner,
          isOrgAdmin,
          isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
          workspaceKind,
        }),
      );
    }
  };

  const applyMapToggle = (id: "creator" | "learner" | "explore") => {
    const next = handleMapToggle(id);
    if (next.interactionMode !== interactionMode) {
      selectInteractionMode(next.interactionMode);
    }
  };

  const sectionConfig = buildWorkspaceSectionNavItems({
    t,
    isLearnerMode,
    isOwner,
    visibleSections,
  });

  const detailLockTitles =
    detailBlock?.lock_until_block_ids
      ?.map((id) => nodes.find((n) => n.id === id)?.title || id)
      .filter(Boolean) || [];

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden" data-aycl-shell={isAycl ? "true" : undefined}>
      <WorkspaceViewChrome
        isAycl={isAycl}
        hideNavbar={hideNavbar}
        accessBanner={accessBanner}
        ayclCapabilities={ayclCapabilities}
        ayclUpgradePriceLabel={ayclUpgradePriceLabel}
        ayclUpgradeBusy={ayclUpgradeBusy}
        onUpgrade={startAyclUpgradeCheckout}
        sections={sectionConfig}
        activeSection={resolvedSection}
        onSelectSection={selectSection}
        plan={plan}
        interactionMode={interactionMode}
      />

      <WorkspaceSectionHosts
        isLearnerMode={isLearnerMode}
        isOwner={isOwner}
        canAccessPrivilegedSections={canAccessPrivilegedSections}
        sectionLayout={sectionLayout}
        visibleSections={visibleSections}
        workspaceImage={workspaceImage}
        plan={plan}
        workspaceId={workspaceId}
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
        isAycl={isAycl}
        ayclToken={ayclToken}
        nodes={nodes}
        workspaceDags={workspaceDags}
        isAddingBlock={isAddingBlock}
        onSaveDagEdit={handleApplyDag}
        onDeleteDag={handleDeleteDag}
        currentUserId={currentUserId}
        modeShell={modeShell}
        knowledgeSubviewFromUrl={knowledgeSubviewFromUrl}
        onPlanUpdate={setPlan}
      />

      {sectionLayout.showBlockMapChrome && (
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <WorkspaceMobilePlanAside
          mobileColumn={mobileColumn}
          plan={plan}
          isOwner={isOwner}
          copied={copied}
          selectSection={selectSection}
          onOpenSessions={() => {
            selectSection("workspace");
            setMobileColumn("sessions");
          }}
          onShare={handleShare}
        />

        <WorkspaceMapColumn
          mobileColumn={mobileColumn}
          nodes={nodes}
          isOwner={isOwner}
          isLearnerMode={isLearnerMode}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          isAycl={isAycl}
          cloneArmed={cloneArm.armed}
          cloneSourceBlockId={cloneArm.armed ? cloneArm.sourceBlockId : null}
          onCloneArm={isOwner && !isLearnerMode ? handleCloneArm : undefined}
          onCloneCancel={handleCloneCancel}
          onClonePaste={
            isOwner && !isLearnerMode
              ? (sourceBlockId, target) => {
                  void handleClonePaste(sourceBlockId, target);
                }
              : undefined
          }
          supabase={supabase}
          plan={plan}
          workspaceId={workspaceId}
          onRefresh={isAycl ? () => void refreshAyclWorkspace() : refreshNodes}
          onNodesUpdate={handleNodesUpdate}
          expandedBlockId={expandedBlockId}
          onExpandedNodeIdChange={handleExpandedBlockChange}
          onMapSelectionChange={handleMapSelectionChange}
          mapSelection={mapSelection}
          selectiveExplanationActive={selectiveExplanationActive}
          selectiveExplanationPolygon={selectiveExplanationPolygon}
          onSelectiveExplanationComplete={handleSelectiveExplanationComplete}
          injectMapNote={injectMapNote}
          unusableCells={unusableCells}
          onMapGround={
            isOwner && !isLearnerMode ? handleMapGround : undefined
          }
          workspaceNotes={notesContent || plan.notes || ""}
          previewEmptyCells={isLearnerMode ? null : addExpandPreviewCells}
          generatorTargetPreviewCells={
            generatorTargetPreviewCells ??
            (detailBlock
              ? generatorTargetHighlightCells(
                  parseBlockCreatorEffects(detailBlock.creator_effects, {
                    selfBlockId: detailBlock.id,
                  }),
                )
              : null)
          }
          generatorPickActive={!isLearnerMode && generatorPickActive}
          onGeneratorEmptyToggle={
            !isLearnerMode ? handleGeneratorEmptyToggle : undefined
          }
          dynamicPickActive={!isLearnerMode && dynamicPickActive}
          onDynamicBlockToggle={
            !isLearnerMode ? handleDynamicBlockToggle : undefined
          }
          dynamicUnlockPreviewIds={
            dynamicUnlockPreviewIds ??
            (detailBlock
              ? (() => {
                  const e = parseBlockCreatorEffects(
                    detailBlock.creator_effects,
                    { selfBlockId: detailBlock.id },
                  );
                  return e.dynamic.enabled
                    ? e.dynamic.unlockAfterBlockIds
                    : null;
                })()
              : null)
          }
          dynamicContentGeneratedIds={dynamicGeneratedIds}
          expandJobs={isLearnerMode ? [] : expandJobs}
          clusterMapJob={isLearnerMode ? null : clusterMapJob}
          onAbortExpandJob={handleAbortExpandJob}
          mapExploreOpen={showMapExplore}
          onMapExploreToggle={handleToggleMapExplore}
          onMapToggle={applyMapToggle}
          interactionMode={interactionMode}
          ayclCapabilities={ayclCapabilities}
          selectInteractionMode={selectInteractionMode}
          onCircularMenuAction={(blockId, action) => {
            const request = nextLearnerDrawerRequest(action);
            applyMapSelectionResult(
              nextWorkspaceMapSelection({ type: "open_block", blockId }),
            );
            if (request) setLearnerDrawerRequest(request);
          }}
        />

        <WorkspaceRightDrawers
          mobileColumn={mobileColumn}
          workspaceImage={workspaceImage}
          showMapExplore={showMapExplore}
          rightPane={rightPane}
          isOwner={isOwner}
          showCreatorDrawers={showCreatorDrawers}
          showLearnerDrawer={showLearnerDrawer}
          requestedDrawerId={learnerDrawerRequest?.id ?? null}
          requestedDrawerNonce={learnerDrawerRequest?.nonce ?? null}
          isLearnerMode={isLearnerMode}
          interactionMode={interactionMode}
          workspaceId={workspaceId}
          ayclToken={ayclToken}
          locale={locale}
          nodes={nodes}
          unusableCells={unusableCells}
          selectiveExplanationPolygon={selectiveExplanationPolygon}
          selectiveExplanationActive={selectiveExplanationActive}
          onSearchSelectBlocks={handleEmptyMapSearchBlocks}
          onSuggestSelectEmptyCells={handleEmptyMapSuggestCells}
          onStartSelectiveDraw={() => {
            setSelectiveExplanationActive(true);
            setSelectiveExplanationPolygon(null);
          }}
          onClearSelectiveOverlay={() => {
            setSelectiveExplanationActive(false);
            setSelectiveExplanationPolygon(null);
          }}
          onCreateNoteFromSummary={handleCreateNoteFromSummary}
          exploreTargetCell={exploreTargetCell}
          detailBlock={detailBlock}
          detailIndex={detailIndex}
          currentUserId={currentUserId}
          locked={
            detailBlock
              ? isLearnerMode
                ? isLearnerMapBlockLocked(detailBlock, nodes)
                : isBlockLockedUntilCompleted(
                    detailBlock as MapGroundBlockRef,
                    new Map(nodes.map((n) => [n.id, n as MapGroundBlockRef])),
                  )
              : false
          }
          onBlocksUpdated={handleBlocksUpdated}
          onDynamicGenerated={handleDynamicGenerated}
          onSavePlanningPrompt={async (prompt) => {
            if (!detailBlock) return;
            await handleSavePlanningPrompt(detailBlock.id, prompt);
          }}
          onLaunchIntent={
            currentUserId && detailBlock
              ? async (target, options) => {
                  await handleLaunchIntent(detailBlock, target, options);
                }
              : undefined
          }
          onFetchPowSummary={handleFetchPowSummary}
          onMarkDone={async (input) => handleMarkDone(input)}
          combineBlockIds={combineBlockIds}
          isAddingBlock={isAddingBlock}
          onCombine={handleCombineBlocks}
          onGenerateBridge={handleGenerateBridge}
          onApplyDag={handleApplyDag}
          onClusterBlocks={handleClusterBlocks}
          onClusterProgress={handleClusterProgress}
          onDeleteBlocks={handleDeleteBlocks}
          onBridgePreviewChange={setAddExpandPreviewCells}
          onCancelCombine={handleCloseCombine}
          detailLockTitles={detailLockTitles}
          plan={plan}
          notesContent={notesContent}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
          onSaveCreatorEffects={
            isOwner ? handleSaveCreatorEffects : undefined
          }
          onSplitBlock={isOwner ? handleSplitBlock : undefined}
          onExpandBlock={isOwner ? handleExpandFromSourceBlock : undefined}
          onExpandPreviewChange={setAddExpandPreviewCells}
          onGeneratorTargetPreviewChange={setGeneratorTargetPreviewCells}
          onGeneratorPickModeChange={setGeneratorPickActiveSafe}
          onRegisterGeneratorEmptyToggle={registerGeneratorEmptyToggle}
          onDynamicUnlockPreviewChange={setDynamicUnlockPreviewIds}
          onDynamicPickModeChange={setDynamicPickActiveSafe}
          onRegisterDynamicBlockToggle={registerDynamicBlockToggle}
          workspaceFileItems={workspaceFileItems}
          onSaveLocalContext={handleSaveLocalContext}
          mapGroundBusy={mapGroundBusy}
          addTargetCell={addTargetCell}
          onSubmitAddBlock={handleSubmitAddBlock}
          onCancelEmptyCreate={handleCloseEmptyCreate}
          generateShapeCells={generateShapeCells}
          onSubmitGenerateShape={handleSubmitGenerateShape}
        />
      </div>
      )}

      {sectionLayout.showBlockMapChrome && (
        <WorkspaceMobileTabBar
          mobileColumn={mobileColumn}
          onChange={setMobileColumn}
        />
      )}

    </div>
  );
}
