"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  mapWorkspaceNodes,
  type Block,
  type HeliosMapOverlay,
  type InjectHeliosOverlay,
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
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import {
  aestheticImageForId,
  fetchAestheticPackages,
  selectSurfaceAestheticImages,
} from "@/lib/aesthetics";
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
import { WorkspaceRightDrawers } from "@/components/workspace-view/workspace-right-drawers";
import { WorkspaceUnsysSeedStudio } from "@/components/WorkspaceUnsysSeedStudio";
import {
  canAccessPrivilegedWorkspaceSections,
  defaultWorkspaceSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  workspaceIdlePaneShowsExplore,
  workspaceShell,
  workspaceSurfaceShowsAuthoring,
} from "@/lib/workspace-mode";
import { parseWorkspaceKind } from "@/lib/workspace-kind";
import {
  normalizeUnusableCells,
  type UnusableCell,
} from "@/lib/map-ground-rules";
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
  normalizeWorkspaceMapTypes,
  type WorkspaceMapTypesState,
} from "@/lib/workspace-map-types";
import {
  formatAyclPriceCentsLabel,
  resolveAyclCapabilities,
  type AyclCapabilities,
} from "@/lib/aycl-shared";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  isPlayCopyWorkspace,
  playCopyBlockSidebar,
  playCopyStartSessionLabel,
  playCopyStartSessionTarget,
} from "@/lib/workspace-play-copy";
import { WorkspacePlaySidebar } from "@/components/workspace-view/workspace-play-sidebar";
import { loadCreatorMapNotes } from "@/lib/learner-map-notes";
import { loadAnnotationLayers } from "@/lib/map-annotation-layers";

export type { Block, Workspace, WorkspaceViewProps };

export function WorkspaceView({
  initialPlan,
  initialNodes,
  ayclToken,
  ayclOwnerUserId,
  ayclAccessTier: ayclAccessTierProp,
  workspaceIdOverride,
  hideNavbar: _hideNavbar = false,
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
  const [notesContent, setNotesContent] = useState(initialPlan?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<"plan" | "sessions" | "workspace">("plan");
  const [workspaceImage, setWorkspaceImage] = useState("");
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [generateMapPreviewCells, setGenerateMapPreviewCells] = useState<
    Array<{ row: number; col: number }> | null
  >(null);
  const [unusableCells, setUnusableCells] = useState<UnusableCell[]>([]);
  const [mapOverlay, setMapOverlay] = useState<HeliosMapOverlay>({
    notes: [],
    annotationLayers: [],
  });
  const [injectHeliosOverlay, setInjectHeliosOverlay] =
    useState<InjectHeliosOverlay | null>(null);
  const handleMapOverlayChange = useCallback((overlay: HeliosMapOverlay) => {
    setMapOverlay(overlay);
  }, []);
  const handleApplyHeliosOverlay = useCallback((overlay: HeliosMapOverlay) => {
    setMapOverlay(overlay);
    setInjectHeliosOverlay((prev) => ({
      token: (prev?.token || 0) + 1,
      notes: overlay.notes,
      annotationLayers: overlay.annotationLayers,
    }));
  }, []);
  useEffect(() => {
    if (!workspaceId) return;
    setMapOverlay({
      notes: loadCreatorMapNotes({ workspaceId, mapKind: "workspace" }),
      annotationLayers: loadAnnotationLayers({
        workspaceId,
        mapKind: "workspace",
      }),
    });
  }, [workspaceId]);
  const [workspaceDags, setWorkspaceDags] = useState<WorkspaceDagRecord[]>(() =>
    normalizeWorkspaceDags(initialPlan?.workspace_dags),
  );
  const [workspaceMapTypes, setWorkspaceMapTypes] = useState<WorkspaceMapTypesState>(() =>
    normalizeWorkspaceMapTypes(initialPlan?.workspace_map_types),
  );
  const [workspaceFileItems, setWorkspaceFileItems] = useState<WorkspaceFileContextItem[]>([]);
  const [, setMapGroundBusy] = useState(false);
  const [learnerDrawerRequest, setLearnerDrawerRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [playStartBusy, setPlayStartBusy] = useState(false);
  const [unsysStudioBlockId, setUnsysStudioBlockId] = useState<string | null>(null);
  /** AYCL purchase tier capabilities (null = non-AYCL). Seeded from prop. */
  const [ayclCapabilities, setAyclCapabilities] = useState<AyclCapabilities | null>(
    () =>
      ayclToken
        ? resolveAyclCapabilities(ayclAccessTierProp ?? "full")
        : null,
  );
  // AYCL: one workspace mode — authoring follows canAuthor (always on).
  const isOwner = isAycl
    ? Boolean(ayclCapabilities?.canAuthor)
    : currentUserId
      ? plan?.user_id === currentUserId
      : false;
  const playCopy = isPlayCopyWorkspace(plan);
  const authoringOnMap = workspaceSurfaceShowsAuthoring({
    isOwner,
    isOrgAdmin,
    allowAuthoring: playCopy
      ? false
      : ayclCapabilities
        ? ayclCapabilities.allowCreatorModeToggle
        : undefined,
    workspaceKind: parseWorkspaceKind(plan?.workspace_kind),
  });
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
    addTargetCell,
    generateShapeCells,
    combineBlockIds,
    detailBlock,
    detailIndex,
  } = useWorkspaceMapSelection({
    authoring: authoringOnMap,
    unusableCells,
    nodes,
    setMobileColumn,
  });
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
      setWorkspaceMapTypes(
        normalizeWorkspaceMapTypes(
          (data.workspace as { workspace_map_types?: unknown }).workspace_map_types,
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
    handleSaveAnswersModelSeed,
    handleDeleteBlock,
    handleDeleteBlocks,
    handleClusterBlocks,
    handleClusterProgress,
    handleApplyDag,
    handleDeleteDag,
    handleMapGround,
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

  const handleGenerateMap = useCallback(
    async (input: {
      anchorRow: number;
      anchorCol: number;
      modifier: string;
      mapTypeId: string;
    }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/generate-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            anchorRow: input.anchorRow,
            anchorCol: input.anchorCol,
            modifier: input.modifier,
            mapTypeId: input.mapTypeId,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(errorMessageFromBody(data, "Failed to generate map"));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            mapWorkspaceNodes(data.updatedNodes, {
              ayclClone: Boolean(ayclToken),
            }),
          );
        }
        if (data.unusable_cells) {
          setUnusableCells(normalizeUnusableCells(data.unusable_cells));
        }
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to generate map");
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, workspaceId],
  );

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
        const images = packages.flatMap((pkg) => pkg.images).filter(Boolean);
        const selection = selectSurfaceAestheticImages({
          provided: images,
          fromPackages: images,
        });
        setWorkspaceImage(aestheticImageForId(workspaceId, selection.images));
      })
      .catch(() => {
        if (cancelled) return;
        const selection = selectSurfaceAestheticImages({
          provided: [],
          fromPackages: [],
        });
        setWorkspaceImage(aestheticImageForId(workspaceId, selection.images));
      });

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
          setWorkspaceMapTypes(
            normalizeWorkspaceMapTypes(initialPlan.workspace_map_types),
          );
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
      setWorkspaceMapTypes(
        normalizeWorkspaceMapTypes(
          (planData as { workspace_map_types?: unknown }).workspace_map_types,
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
   * AYCL clones are not isOwner, but Learner mode still needs Knowledge
   * (embeddings). Always resolve sections through the mode-aware helper —
   * never owner-only resolveActiveSection alone (that snaps Knowledge → Workspace).
   */
  const workspaceKind = parseWorkspaceKind(plan?.workspace_kind);
  const practiceOnlyAycl = Boolean(
    isAycl && ayclCapabilities && !ayclCapabilities.allowCreatorModeToggle,
  );
  const shell = useMemo(
    () =>
      workspaceShell({
        kind: workspaceKind,
        authoring: authoringOnMap,
        practiceOnly: practiceOnlyAycl,
        isOwner,
        isOrgAdmin,
        isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
        playCopy: playCopy,
      }),
    [
      authoringOnMap,
      ayclToken,
      currentUserId,
      isOrgAdmin,
      isOwner,
      playCopy,
      practiceOnlyAycl,
      workspaceKind,
    ],
  );

  useEffect(() => {
    setActiveSection((current) =>
      shell.sections.includes(current) ? current : defaultWorkspaceSection(workspaceKind),
    );
  }, [shell.sections, workspaceKind]);

  const selectSection = useCallback(
    (section: WorkspaceSectionKey) => {
      setActiveSection(
        shell.sections.includes(section) ? section : defaultWorkspaceSection(workspaceKind),
      );
      if (section === "workspace") {
        setMobileColumn("workspace");
      }
    },
    [shell.sections, workspaceKind],
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
    handleLaunchIntent,
  } = useWorkspaceLearner({
    workspaceId,
    ayclToken,
    currentUserId,
    locale,
    learnerActivity: shell.learnerActivity,
    nodes,
    setNodes,
    router,
  });

  useEffect(() => {
    if (shell.learnerSurface || !isOwner) {
      setUnsysStudioBlockId(null);
    }
  }, [isOwner, shell.learnerSurface]);

  useEffect(() => {
    if (
      unsysStudioBlockId &&
      !nodes.some((node) => node.id === unsysStudioBlockId)
    ) {
      setUnsysStudioBlockId(null);
    }
  }, [nodes, unsysStudioBlockId]);

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

  const resolvedSection = shell.sections.includes(activeSection)
    ? activeSection
    : defaultWorkspaceSection(workspaceKind);
  const sectionLayout = resolveWorkspaceSectionLayout(resolvedSection);
  // One surface: the map plus authoring sections for people who can design.
  // Verification keeps its own list. Play-only stays on the map.
  const visibleSections = shell.sections;
  const idleExplore = workspaceIdlePaneShowsExplore({
    allowExplore:
      workspaceKind === "knowledge_region"
        ? false
        : ayclCapabilities
          ? ayclCapabilities.allowExplore
          : isOwner || isOrgAdmin,
  });
  const isLearnerMode = shell.learnerSurface;
  const unsysStudioBlock =
    isOwner && !isLearnerMode && unsysStudioBlockId
      ? nodes.find((node) => node.id === unsysStudioBlockId) ?? null
      : null;
  const showCreatorDrawers = shell.authoringDrawers;

  const sectionConfig = buildWorkspaceSectionNavItems({
    t,
    isLearnerMode,
    isOwner,
    visibleSections,
  });

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden border border-white/40 bg-black text-white"
      data-console-frame=""
      data-workspace-shell=""
      data-aycl-shell={isAycl ? "true" : undefined}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col overflow-hidden">
      <WorkspaceViewChrome
        isAycl={isAycl}
        accessBanner={shell.playView ? undefined : accessBanner}
        ayclCapabilities={ayclCapabilities}
        ayclUpgradePriceLabel={ayclUpgradePriceLabel}
        ayclUpgradeBusy={ayclUpgradeBusy}
        onUpgrade={startAyclUpgradeCheckout}
        sections={sectionConfig}
        activeSection={resolvedSection}
        onSelectSection={selectSection}
        plan={plan}
        playView={shell.playView}
      />

      {unsysStudioBlock && !shell.playView ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkspaceUnsysSeedStudio
            blockId={unsysStudioBlock.id}
            blockTitle={unsysStudioBlock.title}
            blockDescription={unsysStudioBlock.description}
            seed={unsysStudioBlock.answers_model_seed}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            busy={isAddingBlock}
            onClose={() => {
              setUnsysStudioBlockId(null);
            }}
            onSaveSeed={handleSaveAnswersModelSeed}
          />
        </div>
      ) : (
      <>
      {shell.playView ? null : <WorkspaceSectionHosts
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
        workspaceMapTypes={workspaceMapTypes}
        isAddingBlock={isAddingBlock}
        onSaveDagEdit={handleApplyDag}
        onDeleteDag={handleDeleteDag}
        onOpenUnsysStudio={
          isOwner && !isLearnerMode
            ? ({ blockId }) => {
                setUnsysStudioBlockId(blockId);
              }
            : undefined
        }
        onSaveAnswersModelSeed={
          isOwner ? handleSaveAnswersModelSeed : undefined
        }
        currentUserId={currentUserId}
        knowledgeLwmEmbeddingsOnly={shell.knowledgeLwmEmbeddingsOnly}
        knowledgeSubviewFromUrl={knowledgeSubviewFromUrl}
        onPlanUpdate={setPlan}
        t={t}
      />}

      {sectionLayout.showBlockMapChrome && (
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {shell.playView ? null : (
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
        )}

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
          onExpandedNodeIdChange={(blockId) => {
            setLearnerDrawerRequest(null);
            handleExpandedBlockChange(blockId);
          }}
          onMapSelectionChange={(selection) => {
            setLearnerDrawerRequest(null);
            handleMapSelectionChange(selection);
          }}
          mapSelection={mapSelection}
          selectiveExplanationActive={selectiveExplanationActive}
          selectiveExplanationPolygon={selectiveExplanationPolygon}
          onSelectiveExplanationComplete={handleSelectiveExplanationComplete}
          injectMapNote={injectMapNote}
          injectHeliosOverlay={injectHeliosOverlay}
          onMapOverlayChange={handleMapOverlayChange}
          unusableCells={unusableCells}
          onMapGround={
            isOwner && !isLearnerMode ? handleMapGround : undefined
          }
          workspaceNotes={notesContent || plan.notes || ""}
          previewEmptyCells={
            isLearnerMode
              ? null
              : generateMapPreviewCells && generateMapPreviewCells.length > 0
                ? generateMapPreviewCells
                : addExpandPreviewCells
          }
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
          playView={shell.playView}
        />

        {shell.playView ? (
          playCopyBlockSidebar(detailBlock) ? (
            <WorkspacePlaySidebar
              title={playCopyBlockSidebar(detailBlock)!.title}
              description={playCopyBlockSidebar(detailBlock)!.description}
              startLabel={playCopyStartSessionLabel()}
              busy={playStartBusy}
              onClose={handleCloseBlockDetail}
              onStart={() => {
                if (!detailBlock || playStartBusy) return;
                setPlayStartBusy(true);
                void handleLaunchIntent(detailBlock, playCopyStartSessionTarget())
                  .catch((err) => {
                    alert(err instanceof Error ? err.message : "Could not start session");
                  })
                  .finally(() => setPlayStartBusy(false));
              }}
            />
          ) : null
        ) : (
        <WorkspaceRightDrawers
          mobileColumn={mobileColumn}
          workspaceImage={workspaceImage}
          idleExplore={idleExplore}
          rightPane={rightPane}
          isOwner={isOwner}
          showCreatorDrawers={showCreatorDrawers}
          learnerNotes={shell.learnerActivity}
          workspaceId={workspaceId}
          ayclToken={ayclToken}
          locale={locale}
          nodes={nodes}
          mapSelection={mapSelection}
          workspaceMapTypes={workspaceMapTypes}
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
          detailBlock={detailBlock}
          detailIndex={detailIndex}
          onBlocksUpdated={handleBlocksUpdated}
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
          plan={plan}
          notesContent={notesContent}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
          onSaveCreatorEffects={
            isOwner ? handleSaveCreatorEffects : undefined
          }
          onSaveAnswersModelSeed={
            isOwner ? handleSaveAnswersModelSeed : undefined
          }
          onOpenUnsysStudio={
            isOwner && !isLearnerMode ? setUnsysStudioBlockId : undefined
          }
          onSplitBlock={isOwner ? handleSplitBlock : undefined}
          cloneArmed={cloneArm.armed}
          onCloneArm={isOwner && !isLearnerMode ? handleCloneArm : undefined}
          onCloneCancel={handleCloneCancel}
          onClonePaste={isOwner ? handleClonePaste : undefined}
          onExpandBlock={isOwner ? handleExpandFromSourceBlock : undefined}
          onGenerateMap={isOwner ? handleGenerateMap : undefined}
          onGenerateMapPreviewChange={setGenerateMapPreviewCells}
          onSetUnusableCells={
            isOwner
              ? async (cells) => {
                  await handleMapGround({
                    op: "set_unusable_cells",
                    unusableCells: cells,
                  });
                }
              : undefined
          }
          onPreviewUnusableCells={isOwner ? setUnusableCells : undefined}
          onApplyHeliosOverlay={isOwner ? handleApplyHeliosOverlay : undefined}
          mapOverlay={mapOverlay}
          onExpandPreviewChange={setAddExpandPreviewCells}
          onGeneratorTargetPreviewChange={setGeneratorTargetPreviewCells}
          onGeneratorPickModeChange={setGeneratorPickActiveSafe}
          onRegisterGeneratorEmptyToggle={registerGeneratorEmptyToggle}
          onDynamicUnlockPreviewChange={setDynamicUnlockPreviewIds}
          onDynamicPickModeChange={setDynamicPickActiveSafe}
          onRegisterDynamicBlockToggle={registerDynamicBlockToggle}
          workspaceFileItems={workspaceFileItems}
          addTargetCell={addTargetCell}
          onSubmitAddBlock={handleSubmitAddBlock}
          onCancelEmptyCreate={handleCloseEmptyCreate}
          generateShapeCells={generateShapeCells}
          onSubmitGenerateShape={handleSubmitGenerateShape}
        />
        )}
      </div>
      )}
      </>
      )}

      {sectionLayout.showBlockMapChrome && !shell.playView && !unsysStudioBlock ? (
        <WorkspaceMobileTabBar
          mobileColumn={mobileColumn}
          onChange={setMobileColumn}
        />
      ) : null}
      </div>
    </div>
  );
}
