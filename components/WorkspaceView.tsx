"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "../lib/i18n";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { getOrderedSessions, SessionList } from "@/components/SessionList";
import { SessionItem } from "@/components/SessionItem";
import { WorkspaceBlockDetailPane } from "@/components/WorkspaceBlockDetailPane";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";
import { WorkspaceSectionSurface } from "@/components/WorkspaceSectionSurface";
import { WorkspaceMapAuthoringPane } from "@/components/WorkspaceMapAuthoringPane";
import { WorkspaceBlockLocalContextPanel } from "@/components/WorkspaceBlockLocalContextPanel";
import { WorkspaceContextPanel } from "@/components/WorkspaceContextPanel";
import { WorkspaceAddBlockPane } from "@/components/WorkspaceAddBlockPane";
import { WorkspaceGenerateShapePane } from "@/components/WorkspaceGenerateShapePane";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  resolveActiveSection,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  clearWorkspaceAddTarget,
  clearWorkspaceBlockSelection,
  nextWorkspaceBlockSelection,
  resolveEmptySelectionSurface,
  resolveWorkspaceRightPane,
  type EmptySelectionSurface,
  type WorkspaceAddTargetCell,
  WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS,
  WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS,
} from "@/lib/workspace-right-pane";
import { buildSkillGridLayout, getWeightedNeighborhood } from "@/lib/block-skill-grid";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import {
  normalizeUnusableCells,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import {
  parseBlockLocalContext,
  type BlockLocalContextInput,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

export interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: Array<{ dr: number; dc: number }> | null;
  lock_until_block_ids?: string[] | null;
  local_context?: BlockLocalContextInput | null;
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
  unusable_cells?: UnusableCell[] | null;
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
  if (
    value === "workspace" ||
    value === "context" ||
    value === "knowledge" ||
    value === "settings"
  ) {
    return value;
  }
  return null;
}

export function WorkspaceView({ initialPlan, initialNodes }: WorkspaceViewProps) {
  const { t, locale } = useI18n();
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
  /** Open block for right-pane detail (double-click). Null → map authoring tools. */
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  /** Empty selection surface for right-pane create (single Add / multi shape). */
  const [emptySurface, setEmptySurface] = useState<EmptySelectionSurface | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [unusableCells, setUnusableCells] = useState<UnusableCell[]>([]);
  const [workspaceFileItems, setWorkspaceFileItems] = useState<WorkspaceFileContextItem[]>([]);
  const [mapGroundBusy, setMapGroundBusy] = useState(false);

  const supabase = createClient();

  const handleExpandedBlockChange = useCallback((blockId: string | null) => {
    const next = nextWorkspaceBlockSelection(expandedBlockId, blockId);
    setExpandedBlockId(next);
    if (next) {
      setEmptySurface(clearWorkspaceAddTarget());
      setMobileColumn("workspace");
    }
  }, [expandedBlockId]);

  const handleCloseBlockDetail = useCallback(() => {
    setExpandedBlockId(clearWorkspaceBlockSelection());
  }, []);

  const handleEmptySelectionChange = useCallback(
    (cells: Array<{ row: number; col: number }> | null) => {
      const surface = resolveEmptySelectionSurface({
        selectedEmptyCells: cells || [],
        unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
      });
      setEmptySurface(surface);
      if (surface) {
        setExpandedBlockId(clearWorkspaceBlockSelection());
        setMobileColumn("workspace");
      }
    },
    [unusableCells],
  );

  const handleCloseEmptyCreate = useCallback(() => {
    setEmptySurface(clearWorkspaceAddTarget());
  }, []);

  const rightPane = resolveWorkspaceRightPane(expandedBlockId, emptySurface);
  const addTargetCell =
    emptySurface?.kind === "add_block" ? emptySurface.cell : null;
  const generateShapeCells =
    emptySurface?.kind === "generate_shape" ? emptySurface.cells : null;
  const orderedBlocks = getOrderedSessions(nodes as Parameters<typeof getOrderedSessions>[0]);
  const detailBlock =
    expandedBlockId != null
      ? orderedBlocks.find((n) => n.id === expandedBlockId) ?? null
      : null;
  const detailIndex = detailBlock
    ? orderedBlocks.findIndex((n) => n.id === detailBlock.id)
    : -1;

  const isOwner = currentUserId ? plan?.user_id === currentUserId : false;
  const canAccessPrivilegedSections = canAccessPrivilegedWorkspaceSections({
    isOwner,
    isOrgAdmin,
  });

  const refreshNodes = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSubmitAddBlock = useCallback(
    async (
      prompt: string,
      position: WorkspaceAddTargetCell,
      opts?: { contextSourceKeys?: string[] },
    ) => {
      if (!workspaceId || !isOwner) return;
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const { placements } = buildSkillGridLayout(nodes);
      const weightedNeighbors = getWeightedNeighborhood(
        { row: position.row, col: position.col },
        placements,
        nodesById,
      );
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/add-block-at-slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            row: position.row,
            col: position.col,
            prompt,
            weightedNeighbors,
            model,
            locale,
            ...(opts?.contextSourceKeys?.length
              ? { contextSourceKeys: opts.contextSourceKeys }
              : {}),
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to add block");
        }
        const data = await response.json();
        if (data.updatedNodes?.length > 0) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setEmptySurface(clearWorkspaceAddTarget());
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, locale, nodes, refreshNodes, router, workspaceId],
  );

  const handleSubmitGenerateShape = useCallback(
    async (payload: {
      prompt: string;
      cells: WorkspaceAddTargetCell[];
      contextSourceKeys?: string[];
    }) => {
      if (!workspaceId || !isOwner) return;
      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const { placements } = buildSkillGridLayout(nodes);
      const anchor = payload.cells[0]
        ? { row: payload.cells[0].row, col: payload.cells[0].col }
        : null;
      const weightedNeighbors = anchor
        ? getWeightedNeighborhood(anchor, placements, nodesById)
        : [];
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            op: "generate_shape",
            prompt: payload.prompt,
            cells: payload.cells,
            weightedNeighbors,
            model,
            locale,
            ...(payload.contextSourceKeys?.length
              ? { contextSourceKeys: payload.contextSourceKeys }
              : {}),
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to generate block");
        }
        const data = await response.json();
        if (data.updatedNodes?.length > 0) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setEmptySurface(clearWorkspaceAddTarget());
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, locale, nodes, refreshNodes, router, workspaceId],
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
      setUnusableCells(
        normalizeUnusableCells(
          (planData as { unusable_cells?: unknown }).unusable_cells,
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

  const postMapGround = useCallback(
    async (payload: Record<string, unknown>) => {
      setMapGroundBusy(true);
      try {
        const res = await fetch("/api/workspace/map-ground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Map ground update failed");
        }
        if (Array.isArray(data.unusableCells)) {
          setUnusableCells(normalizeUnusableCells(data.unusableCells));
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        return data;
      } finally {
        setMapGroundBusy(false);
      }
    },
    [workspaceId],
  );

  const handleSetLockUntil = useCallback(
    async (blockId: string, prerequisiteIds: string[]) => {
      await postMapGround({
        op: "set_lock_until",
        blockId,
        prerequisiteIds,
      });
    },
    [postMapGround],
  );

  const handleToggleUnusable = useCallback(
    async (row: number, col: number) => {
      await postMapGround({ op: "toggle_unusable", row, col });
    },
    [postMapGround],
  );

  /** Left toolbar + multi-select ground authoring (primary creator path). */
  const handleMapGround = useCallback(
    async (payload: {
      op: "set_lock_until" | "set_unusable_cells";
      blockId?: string;
      prerequisiteIds?: string[];
      unusableCells?: Array<{ row: number; col: number }>;
    }) => {
      if (payload.op === "set_lock_until" && payload.blockId) {
        await postMapGround({
          op: "set_lock_until",
          blockId: payload.blockId,
          prerequisiteIds: payload.prerequisiteIds || [],
        });
        return;
      }
      if (payload.op === "set_unusable_cells") {
        await postMapGround({
          op: "set_unusable_cells",
          unusableCells: payload.unusableCells || [],
        });
      }
    },
    [postMapGround],
  );

  const handleSaveLocalContext = useCallback(
    async (blockId: string, localContext: BlockLocalContextInput) => {
      await postMapGround({
        op: "set_local_context",
        blockId,
        localContext,
      });
    },
    [postMapGround],
  );

  /** Update title/description from the block-detail Edit drawer. */
  const handleUpdateBlock = useCallback(
    async (input: { blockId: string; title: string; description: string }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            op: "update_block",
            blockId: input.blockId,
            title: input.title,
            description: input.description,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to update block");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
  );

  /** Delete block from the Edit drawer; clears selection after. */
  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            op: "delete_block",
            blockId,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to delete block");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setExpandedBlockId(clearWorkspaceBlockSelection());
        setEmptySurface(clearWorkspaceAddTarget());
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
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
    ...(visibleSections.includes("context")
      ? [
          {
            key: "context" as const,
            label: t("planView.sectionContext"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            ),
          },
        ]
      : []),
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

  const inventoryBlocks = nodes.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    status: n.status,
    is_start: n.is_start,
    position_x: n.position_x,
    position_y: n.position_y,
    span_w: n.span_w,
    span_h: n.span_h,
    shape_cells: n.shape_cells,
    next_block_ids: n.next_block_ids,
    lock_until_block_ids: n.lock_until_block_ids,
    local_context: n.local_context,
  }));

  const detailLockTitles =
    detailBlock?.lock_until_block_ids
      ?.map((id) => nodes.find((n) => n.id === id)?.title || id)
      .filter(Boolean) || [];

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

      {sectionLayout.mountsContextPanel && (
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
          <div
            data-workspace-context-section
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceContextPanel
              workspaceId={workspaceId}
              isOwner={isOwner}
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
              showFiles
              seedQuery={plan.root_topic || plan.title}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

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

        <aside className={`${mobileColumn === "sessions" ? "flex" : "hidden"} flex-1 min-h-0 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] md:flex md:h-full ${WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS} md:border-b-0 md:border-r`}>
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
            expandedNodeId={expandedBlockId}
            onExpandedNodeIdChange={handleExpandedBlockChange}
            onEmptySelectionChange={handleEmptySelectionChange}
            unusableCells={unusableCells}
            onMapGround={isOwner ? handleMapGround : undefined}
            workspaceNotes={notesContent || plan.notes}
          />
        </aside>

        <section className={`${mobileColumn === "workspace" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080808] md:flex ${WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS} md:flex-none`}>
          {workspaceImage && (
            <img
              src={workspaceImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35 saturate-75"
            />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" />

          <main
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            data-workspace-right-column
            data-workspace-right-pane={rightPane}
          >
            {rightPane === "block_detail" && detailBlock && detailIndex >= 0 ? (
              <WorkspaceBlockDetailPane
                key={detailBlock.id}
                title={detailBlock.title}
                blockId={detailBlock.id}
                blockTitle={detailBlock.title}
                blockDescription={detailBlock.description}
                planningPrompt={detailBlock.planning_prompt}
                localContext={detailBlock.local_context}
                canEdit={isOwner}
                editBusy={isAddingBlock}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                localContextPanel={
                  <WorkspaceBlockLocalContextPanel
                    key={detailBlock.id}
                    canEdit={isOwner}
                    blockId={detailBlock.id}
                    blockTitle={detailBlock.title}
                    blockDescription={detailBlock.description}
                    blockStatus={detailBlock.status}
                    lockUntilTitles={detailLockTitles}
                    localContext={detailBlock.local_context}
                    workspaceFiles={workspaceFileItems}
                    onSaveLocalContext={handleSaveLocalContext}
                    busy={mapGroundBusy}
                  />
                }
              >
                <SessionItem
                  node={detailBlock}
                  index={detailIndex}
                  onSelect={() => {}}
                  onDelete={() => {}}
                  onFork={() => {}}
                  isExpanded
                  isOwner={isOwner}
                  isLoggedIn={!!currentUserId}
                  supabase={supabase}
                  planTopic={plan.root_topic}
                  workspaceId={workspaceId}
                  variant="detail"
                  detailLayout="inline"
                />
              </WorkspaceBlockDetailPane>
            ) : rightPane === "add_block" && addTargetCell ? (
              <WorkspaceAddBlockPane
                key={`add-${addTargetCell.row}-${addTargetCell.col}`}
                cell={addTargetCell}
                nodes={nodes}
                workspaceId={workspaceId}
                locale={locale}
                busy={isAddingBlock}
                workspaceNotes={notesContent || plan.notes}
                onSubmit={handleSubmitAddBlock}
                onCancel={handleCloseEmptyCreate}
                labels={{
                  addTitle: t("sessionList.gridAddTitle"),
                  addPlaceholder: t("sessionList.gridAddPlaceholder"),
                  addSubmit: t("sessionList.gridAddSubmit"),
                  addCancel: t("sessionList.gridAddCancel"),
                  suggestTopics: t("sessionList.gridSuggestTopics"),
                  suggesting: t("sessionList.gridSuggesting"),
                  suggestError: t("sessionList.gridSuggestError"),
                }}
              />
            ) : rightPane === "generate_shape" && generateShapeCells ? (
              <WorkspaceGenerateShapePane
                key={`shape-${generateShapeCells.map((c) => `${c.row}:${c.col}`).join(",")}`}
                cells={generateShapeCells}
                nodes={nodes}
                workspaceId={workspaceId}
                locale={locale}
                busy={isAddingBlock}
                workspaceNotes={notesContent || plan.notes}
                onSubmit={handleSubmitGenerateShape}
                onCancel={handleCloseEmptyCreate}
                labels={{
                  generateShape: t("sessionList.gridGenerateShape"),
                  addPlaceholder: t("sessionList.gridAddPlaceholder"),
                  addSubmit: t("sessionList.gridAddSubmit"),
                  addCancel: t("sessionList.gridAddCancel"),
                  suggestTopics: t("sessionList.gridSuggestTopics"),
                  suggesting: t("sessionList.gridSuggesting"),
                  suggestError: t("sessionList.gridSuggestError"),
                }}
              />
            ) : (
              <WorkspaceMapAuthoringPane canEdit={isOwner} />
            )}
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
            { key: "workspace" as const, label: "Tools", icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.72 5.72a2.25 2.25 0 01-3.182-3.182l5.72-5.72M12 3v4.5m0 9V21m9-9h-4.5m-9 0H3m15.364 6.364l-3.182-3.182M6.818 6.818L3.636 3.636m12.728 0l-3.182 3.182M6.818 17.182l-3.182 3.182" />
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
