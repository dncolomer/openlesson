"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "../lib/i18n";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { getOrderedSessions, SessionList } from "@/components/SessionList";

import { WorkspaceBlockDetailPane } from "@/components/WorkspaceBlockDetailPane";
import { aestheticImageForId, fetchAestheticPackages } from "@/lib/aesthetics";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";
import { WorkspaceSectionSurface } from "@/components/WorkspaceSectionSurface";
import { WorkspaceMapAuthoringPane } from "@/components/WorkspaceMapAuthoringPane";
import { WorkspaceBlockLocalContextPanel } from "@/components/WorkspaceBlockLocalContextPanel";
import { WorkspaceContextPanel } from "@/components/WorkspaceContextPanel";
import { WorkspaceSimulationPanel } from "@/components/WorkspaceSimulationPanel";
import { WorkspaceDagsPanel } from "@/components/WorkspaceDagsPanel";
import { WorkspaceGoalsPanel } from "@/components/WorkspaceGoalsPanel";
import {
  WorkspaceAddBlockPane,
  type WorkspaceAddBlockSubmitOpts,
} from "@/components/WorkspaceAddBlockPane";
import { WorkspaceGenerateShapePane } from "@/components/WorkspaceGenerateShapePane";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  applyAddExpandJobProgress,
  createAddExpandJob,
  createAddExpandJobId,
  mergeActiveExpandJobPreviews,
  patchAddExpandJob,
  removeAddExpandJob,
  runAddExpandCreateLoop,
  snapshotAddExpandSlots,
  upsertAddExpandJob,
  type AddExpandJob,
} from "@/lib/add-block-range-density";
import {
  afterClonePaste,
  armClone,
  cancelCloneArm,
  createDisarmedCloneState,
  resolveClonePasteTarget,
  shouldInterceptEmptyClickForClone,
  type CloneArmState,
} from "@/lib/clone-block";
import {
  buildExpandFromSourceSlotPrompt,
  type ExpandSourceIdentity,
} from "@/lib/expand-block-from-source";
import type { WorkspaceExpandBlockSubmitOpts } from "@/components/WorkspaceExpandBlockPane";
import { buildBridgeKnowledgePrompt } from "@/lib/bridge-blocks";
import {
  availableWorkspaceSections,
  canAccessPrivilegedWorkspaceSections,
  resolveWorkspaceSectionLayout,
  type WorkspaceSectionKey,
} from "@/lib/workspace-sections";
import {
  availableSectionsForMode,
  mountsCreatorAuthoringDrawers,
  mountsLearnerPracticeDrawer,
  normalizeWorkspaceInteractionMode,
  resolveActiveSectionForMode,
  resolveWorkspaceModeShell,
  type WorkspaceInteractionMode,
} from "@/lib/workspace-mode";
import { WorkspaceLearnerBlockPane } from "@/components/WorkspaceLearnerBlockPane";
import {
  blocksUnlockedAfterDone,
  parseLearnerPowSummaryFromApi,
  type LearnerDoneProgressPhase,
  type LearnerPowSummary,
} from "@/lib/workspace-learner-done";
import {
  isBlockLockedUntilCompleted,
  type MapGroundBlockRef,
} from "@/lib/map-ground-rules";
import { isLearnerMapBlockLocked } from "@/lib/learner-local-dag";
import {
  clearWorkspaceAddTarget,
  clearWorkspaceBlockSelection,
  clearWorkspaceFilledBlockSelection,
  nextMapSelectionClearNonce,
  nextWorkspaceBlockSelection,
  resolveEmptySelectionSurface,
  resolveWorkspaceRightPane,
  type EmptySelectionSurface,
  type WorkspaceAddTargetCell,
  WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS,
  WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS,
} from "@/lib/workspace-right-pane";
import { WorkspaceCombineBlocksPane } from "@/components/WorkspaceCombineBlocksPane";
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
import { buildUpdateBlockPayload } from "@/lib/block-starter-flag";
import {
  parseBlockPracticeOptions,
  serializeBlockPracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";
import {
  dynamicBlocksUnlockedAfterDone,
  dynamicGeneratedStorageKey,
  generatorTargetCellsAfterDone,
  generatorTargetHighlightCells,
  parseBlockCreatorEffects,
  serializeBlockCreatorEffects,
  type BlockCreatorEffects,
  type GeneratorTargetCell,
} from "@/lib/block-creator-effects";
import {
  normalizeWorkspaceDags,
  type WorkspaceDagRecord,
} from "@/lib/workspace-dags";
import {
  ayclUpgradeOfferDescription,
  ayclUpgradeOfferLabel,
  AYCL_TOKEN_STORAGE_KEY,
  AYCL_UPGRADE_PRICE_LABEL,
  formatAyclPriceCentsLabel,
  resolveAyclCapabilities,
  type AyclCapabilities,
} from "@/lib/aycl-shared";

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
  /** Author limits on Explore/Drill × open/timed launches (raw JSON or parsed). */
  practice_options?: unknown;
  /** Combinable Dynamic / Generator effects. */
  creator_effects?: unknown;
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
  /** AYCL marketplace listing fields (catalog workspace only). */
  aycl_category?: string | null;
  aycl_summary?: string | null;
  aycl_author_name?: string | null;
  aycl_author_avatar_url?: string | null;
  aycl_learner_price_cents?: number | null;
  aycl_full_price_cents?: number | null;
  unusable_cells?: UnusableCell[] | null;
  /** Created multi-block DAGs (Creator DAGs tab). */
  workspace_dags?: WorkspaceDagRecord[] | null;
}

interface WorkspaceViewProps {
  initialPlan?: Workspace;
  initialNodes?: Block[];
  /**
   * AYCL / purchased lifetime access: token is sent on authoring APIs.
   * Full tier → owner-equivalent tools; learner tier → practice only.
   */
  ayclToken?: string;
  /** Owner user id for AYCL (Knowledge/PoW subject scoping). */
  ayclOwnerUserId?: string;
  /** Purchase tier seed (avoids authoring flash before refresh). */
  ayclAccessTier?: string | null;
  /**
   * Explicit workspace id when not on /workspace/[id] (e.g. /learn/[token]).
   */
  workspaceIdOverride?: string;
  /** Hide main Navbar (AYCL page provides its own chrome). */
  hideNavbar?: boolean;
  /** Optional top banner under nav (e.g. Lifetime access). */
  accessBanner?: ReactNode;
}

function planShareSlug(plan: Workspace) {
  const title = plan.title || plan.root_topic || "plan";
  return encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan");
}

function parseSectionParam(value: string | null): WorkspaceSectionKey | null {
  if (
    value === "workspace" ||
    value === "context" ||
    value === "simulation" ||
    value === "dags" ||
    value === "knowledge" ||
    value === "settings"
  ) {
    return value;
  }
  return null;
}

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
  const [nodes, setNodes] = useState<Block[]>(initialNodes || []);
  /** Creator generator drawer / learner select → empty cells to spark. */
  const [generatorTargetPreviewCells, setGeneratorTargetPreviewCells] =
    useState<GeneratorTargetCell[] | null>(null);
  /** When true, empty map clicks toggle generator targets (not Add pane). */
  const [generatorPickActive, setGeneratorPickActive] = useState(false);
  const generatorPickActiveRef = useRef(false);
  const generatorEmptyToggleRef = useRef<
    ((cell: { row: number; col: number }) => void) | null
  >(null);
  /** Dynamic unlock-after pick: click filled blocks on the map. */
  const [dynamicPickActive, setDynamicPickActive] = useState(false);
  const dynamicPickActiveRef = useRef(false);
  const [dynamicUnlockPreviewIds, setDynamicUnlockPreviewIds] = useState<
    string[] | null
  >(null);
  const dynamicBlockToggleRef = useRef<((blockId: string) => void) | null>(
    null,
  );
  const setGeneratorPickActiveSafe = useCallback((active: boolean) => {
    generatorPickActiveRef.current = active;
    setGeneratorPickActive(active);
  }, []);
  const setDynamicPickActiveSafe = useCallback((active: boolean) => {
    dynamicPickActiveRef.current = active;
    setDynamicPickActive(active);
  }, []);
  const registerDynamicBlockToggle = useCallback(
    (fn: ((blockId: string) => void) | null) => {
      dynamicBlockToggleRef.current = fn;
    },
    [],
  );
  const registerGeneratorEmptyToggle = useCallback(
    (fn: ((cell: { row: number; col: number }) => void) | null) => {
      generatorEmptyToggleRef.current = fn;
    },
    [],
  );
  /** Stable: always wired; ignores clicks when pick mode is off (ref-checked). */
  const handleGeneratorEmptyToggle = useCallback(
    (cell: { row: number; col: number }) => {
      if (!generatorPickActiveRef.current) return;
      generatorEmptyToggleRef.current?.(cell);
    },
    [],
  );
  const handleDynamicBlockToggle = useCallback((blockId: string) => {
    if (!dynamicPickActiveRef.current) return;
    dynamicBlockToggleRef.current?.(blockId);
  }, []);
  /** Learner dynamic blocks that have been generated this session. */
  const [dynamicGeneratedIds, setDynamicGeneratedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => ayclOwnerUserId || null,
  );
  /** Org admin for this workspace's organization (or platform admin). */
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSectionKey>(
    () => sectionFromUrl ?? "workspace",
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
  /** Open block for right-pane detail (double-click). Null → map authoring tools. */
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  /** Empty selection surface for right-pane create (single Add / multi shape). */
  const [emptySurface, setEmptySurface] = useState<EmptySelectionSurface | null>(null);
  /** Multi-selected filled blocks (2+) → combine surface. */
  const [selectedFilledBlockIds, setSelectedFilledBlockIds] = useState<string[]>([]);
  /**
   * Bumped after ops that must leave no residual map selection (cluster).
   * BlockSkillGrid clears local multi-block + empty-cell state when this changes.
   */
  const [mapSelectionClearNonce, setMapSelectionClearNonce] = useState(0);
  /** Add-block Range/Density expand preview (highlight only). */
  const [addExpandPreviewCells, setAddExpandPreviewCells] = useState<
    Array<{ row: number; col: number }> | null
  >(null);
  /** Background multi-create jobs (progress under minimap; map stays interactive). */
  const [expandJobs, setExpandJobs] = useState<AddExpandJob[]>([]);
  /** Cluster-blocks progress under minimap (compute + save). */
  const [clusterMapJob, setClusterMapJob] = useState<{
    active: boolean;
    progress: number;
    label: string;
  } | null>(null);
  const expandAbortRef = useRef(new Map<string, boolean>());
  const expandJobSeqRef = useRef(0);
  /** Creator clone-paste arm (source filled block → empty target). */
  const [cloneArm, setCloneArm] = useState<CloneArmState>(() =>
    createDisarmedCloneState(),
  );
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [unusableCells, setUnusableCells] = useState<UnusableCell[]>([]);
  const [workspaceDags, setWorkspaceDags] = useState<WorkspaceDagRecord[]>(() =>
    normalizeWorkspaceDags(initialPlan?.workspace_dags),
  );
  const [workspaceFileItems, setWorkspaceFileItems] = useState<WorkspaceFileContextItem[]>([]);
  const [mapGroundBusy, setMapGroundBusy] = useState(false);
  /** AYCL purchase tier capabilities (null = non-AYCL). Seeded from prop. */
  const [ayclCapabilities, setAyclCapabilities] = useState<AyclCapabilities | null>(
    () =>
      ayclToken
        ? resolveAyclCapabilities(ayclAccessTierProp ?? "full")
        : null,
  );
  const [ayclUpgradeBusy, setAyclUpgradeBusy] = useState(false);
  /** Catalog listing upgrade delta label (null → global default). */
  const [ayclUpgradePriceLabel, setAyclUpgradePriceLabel] = useState<string>(
    AYCL_UPGRADE_PRICE_LABEL,
  );

  const supabase = createClient();

  /** Attach ayclToken to JSON bodies when present (full clone access). */
  const withAycl = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { ayclToken?: string } =>
      ayclToken ? { ...body, ayclToken } : body,
    [ayclToken],
  );


  useEffect(() => {
    if (!isAycl || !ayclCapabilities) return;
    if (!ayclCapabilities.allowCreatorModeToggle) {
      setInteractionMode("learner");
    }
  }, [isAycl, ayclCapabilities]);

  const handleAbortExpandJob = useCallback((jobId: string) => {
    expandAbortRef.current.set(jobId, true);
    setExpandJobs((prev) =>
      patchAddExpandJob(prev, jobId, { aborted: true }),
    );
  }, []);

  const handleExpandedBlockChange = useCallback((blockId: string | null) => {
    const next = nextWorkspaceBlockSelection(expandedBlockId, blockId);
    setExpandedBlockId(next);
    if (next) {
      setEmptySurface(clearWorkspaceAddTarget());
      setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
      setMobileColumn("workspace");
      // Keep arm only if same source remains selected.
      setCloneArm((prev) =>
        prev.armed && prev.sourceBlockId === next
          ? prev
          : createDisarmedCloneState(),
      );
    } else {
      setCloneArm(createDisarmedCloneState());
    }
  }, [expandedBlockId]);

  const handleCloseBlockDetail = useCallback(() => {
    setExpandedBlockId(clearWorkspaceBlockSelection());
    setCloneArm(createDisarmedCloneState());
  }, []);

  const handleCloneArm = useCallback((blockId: string) => {
    setCloneArm(armClone(blockId));
    setEmptySurface(clearWorkspaceAddTarget());
  }, []);

  const handleCloneCancel = useCallback(() => {
    setCloneArm(cancelCloneArm());
  }, []);

  const handleSelectedBlockIdsChange = useCallback((ids: string[] | null) => {
    const next = (ids || []).map((id) => String(id).trim()).filter(Boolean);
    setSelectedFilledBlockIds(next);
    if (next.length >= 2) {
      setExpandedBlockId(clearWorkspaceBlockSelection());
      setEmptySurface(clearWorkspaceAddTarget());
      setCloneArm(createDisarmedCloneState());
      setMobileColumn("workspace");
    }
  }, []);

  const handleCloseEmptyCreate = useCallback(() => {
    setEmptySurface(clearWorkspaceAddTarget());
  }, []);

  const handleCloseCombine = useCallback(() => {
    setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
  }, []);

  const rightPane = resolveWorkspaceRightPane(
    expandedBlockId,
    emptySurface,
    selectedFilledBlockIds,
  );
  const addTargetCell =
    emptySurface?.kind === "add_block" ? emptySurface.cell : null;
  const generateShapeCells =
    emptySurface?.kind === "generate_shape" ? emptySurface.cells : null;
  const combineBlockIds =
    rightPane === "combine_blocks" ? selectedFilledBlockIds : [];
  const orderedBlocks = getOrderedSessions(nodes as Parameters<typeof getOrderedSessions>[0]);
  const detailBlock =
    expandedBlockId != null
      ? orderedBlocks.find((n) => n.id === expandedBlockId) ?? null
      : null;
  const detailIndex = detailBlock
    ? orderedBlocks.findIndex((n) => n.id === detailBlock.id)
    : -1;

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

  const refreshNodes = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleClonePaste = useCallback(
    async (sourceBlockId: string, target: { row: number; col: number }) => {
      if (!workspaceId || !isOwner) return;
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            withAycl({
              workspaceId,
              op: "clone_block",
              sourceBlockId,
              row: target.row,
              col: target.col,
            }),
          ),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error || "Failed to clone block",
          );
        }
        const data = await response.json();
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setCloneArm(afterClonePaste());
        setEmptySurface(clearWorkspaceAddTarget());
        refreshNodes();
        router.refresh();
      } catch (err) {
        console.error("[clone_block]", err);
        // Stay armed so user can try another empty cell.
      }
    },
    [isOwner, refreshNodes, router, withAycl, workspaceId],
  );

  const handleEmptySelectionChange = useCallback(
    (cells: Array<{ row: number; col: number }> | null) => {
      // Generator pick: toggle empty cells into generator targets (no Add pane).
      // Use ref so the first click after enabling is not lost to a stale render.
      if (generatorPickActiveRef.current && generatorEmptyToggleRef.current) {
        const placeable = (cells || []).filter((c) => {
          const k = `${c.row}:${c.col}`;
          return !unusableCells.some((u) => `${u.row}:${u.col}` === k);
        });
        // Only act on a sole newly clicked empty cell.
        if (placeable.length === 1) {
          generatorEmptyToggleRef.current(placeable[0]!);
        }
        // Keep current block/add surface; do not open multi-create.
        return;
      }

      // Clone paste: intercept single empty click while armed (no Add pane).
      if (shouldInterceptEmptyClickForClone(cloneArm)) {
        const placeable = (cells || []).filter((c) => {
          const k = `${c.row}:${c.col}`;
          return !unusableCells.some((u) => `${u.row}:${u.col}` === k);
        });
        if (placeable.length === 1) {
          const { occupancy } = buildSkillGridLayout(nodesRef.current);
          const occupiedKeys = [...occupancy.keys()];
          const resolved = resolveClonePasteTarget({
            state: cloneArm,
            target: placeable[0],
            occupiedKeys,
            unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
          });
          if (resolved.ok) {
            void handleClonePaste(resolved.sourceBlockId, resolved.target);
            return;
          }
          // Occupied/unusable: ignore, keep arm, do not open Add.
          return;
        }
        // Multi empty or clear while armed: disarm and fall through.
        setCloneArm(createDisarmedCloneState());
      }

      const surface = resolveEmptySelectionSurface({
        selectedEmptyCells: cells || [],
        unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
      });
      setEmptySurface(surface);
      if (surface) {
        setExpandedBlockId(clearWorkspaceBlockSelection());
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        setCloneArm(createDisarmedCloneState());
        setMobileColumn("workspace");
      }
    },
    [cloneArm, handleClonePaste, unusableCells],
  );

  const handleExpandFromSourceBlock = useCallback(
    async (
      source: ExpandSourceIdentity,
      opts: WorkspaceExpandBlockSubmitOpts,
    ) => {
      if (!workspaceId || !isOwner) return;
      const slots = (opts.frozenSlots || []).map((c) => ({
        row: c.row,
        col: c.col,
      }));
      if (slots.length === 0) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      const baseLabel =
        String(source.title || "").trim() || "Expand block";
      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `expand-src-${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: `Expand: ${baseLabel}`,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });
      // Free selection chrome; job continues under minimap.
      setCloneArm(createDisarmedCloneState());

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt = buildExpandFromSourceSlotPrompt({
                source,
                slot,
                slotIndex: i,
                totalSlots: slots.length,
              });
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  ...(ayclToken ? { ayclToken } : {}),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.error ||
                    `Failed to expand block at (${slot.row}, ${slot.col})`,
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & { local_context?: unknown }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
          refreshNodes();
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to expand block";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [ayclToken, isOwner, locale, refreshNodes, router, workspaceId],
  );

  // AYCL: reload plan/blocks via token API (no cookie session required).
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
      setNodes(
        data.blocks.map((n: Block & { local_context?: unknown }) => ({
          ...n,
          local_context: parseBlockLocalContext(n.local_context),
        })),
      );
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

  const handleCombineBlocks = useCallback(
    async (input: { blockIds: string[]; prompt?: string }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "merge",
            blockIds: input.blockIds,
            prompt: input.prompt,
            locale,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to combine blocks");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        setExpandedBlockId(clearWorkspaceBlockSelection());
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, locale, refreshNodes, router, workspaceId],
  );

  const handleSplitBlock = useCallback(
    async (input: { blockId: string; prompt?: string }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "split",
            blockIds: [input.blockId],
            prompt: input.prompt,
            locale,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to split block");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, locale, refreshNodes, router, workspaceId],
  );

  const handleSubmitAddBlock = useCallback(
    async (
      prompt: string,
      position: WorkspaceAddTargetCell,
      opts?: WorkspaceAddBlockSubmitOpts,
    ) => {
      if (!workspaceId || !isOwner) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      // Frozen ordered slots (center first) — never re-sample from live occupancy.
      const slots: WorkspaceAddTargetCell[] =
        opts?.frozenSlots && opts.frozenSlots.length > 0
          ? opts.frozenSlots.map((c) => ({ row: c.row, col: c.col }))
          : snapshotAddExpandSlots({
              center: position,
              selected: [
                position,
                ...((opts?.expandCells || []).filter(
                  (c) => !(c.row === position.row && c.col === position.col),
                )),
              ],
            });
      if (slots.length === 0) return;

      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: prompt,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });

      // Free the Add pane / map immediately — job runs in the background.
      setEmptySurface(clearWorkspaceAddTarget());
      // Do NOT set isAddingBlock: multi-create must not lock map interaction.

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt =
                i === 0
                  ? prompt
                  : `${prompt}\n\n(Place a distinct neighboring 1×1 block at row ${slot.row}, col ${slot.col} — different subtopic, same overall theme.)`;
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  // Author starter flag (default false; API also starts empty maps).
                  is_start: Boolean(opts?.isStart),
                  ...(opts?.contextSourceKeys?.length
                    ? { contextSourceKeys: opts.contextSourceKeys }
                    : {}),
                  ...(ayclToken ? { ayclToken } : {}),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.error ||
                    `Failed to add block at (${slot.row}, ${slot.col})`,
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & {
                    local_context?: unknown;
                    practice_options?: unknown;
                    creator_effects?: unknown;
                  }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                    practice_options: parseBlockPracticeOptions(
                      n.practice_options,
                    ),
                    creator_effects: parseBlockCreatorEffects(
                      n.creator_effects,
                      { selfBlockId: n.id },
                    ),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
          refreshNodes();
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to add blocks";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          // Drop finished job chrome after a short beat so users see 100% / Stopped.
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [isOwner, locale, refreshNodes, router, workspaceId],
  );

  /**
   * Multi-select Bridge Blocks: enqueue corridor slots into the same background
   * expand-job loop (progress/stop/click-lock) with forced knowledge-bridge prompts.
   */
  const handleGenerateBridge = useCallback(
    async (input: {
      blockIds: string[];
      density: number;
      width?: number;
      userPrompt?: string;
      frozenSlots: Array<{ row: number; col: number }>;
      blockTitles: string[];
    }) => {
      if (!workspaceId || !isOwner) return;
      const slots = (input.frozenSlots || []).map((c) => ({
        row: c.row,
        col: c.col,
      }));
      if (slots.length === 0) return;
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_MODEL;
      expandJobSeqRef.current += 1;
      const jobId = createAddExpandJobId(
        `bridge-${Date.now()}-${expandJobSeqRef.current}`,
      );
      const job = createAddExpandJob({
        id: jobId,
        frozenSlots: slots,
        label: `Bridge: ${(input.blockTitles || []).slice(0, 2).join(" ↔ ") || "topics"}`,
      });
      expandAbortRef.current.set(jobId, false);
      setExpandJobs((prev) => {
        const next = upsertAddExpandJob(prev, job);
        const merged = mergeActiveExpandJobPreviews(next);
        setAddExpandPreviewCells(merged.length ? merged : null);
        return next;
      });
      // Free multi-select surface; job continues under minimap.
      setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());

      void (async () => {
        try {
          const result = await runAddExpandCreateLoop({
            frozenSlots: slots,
            isAborted: () => expandAbortRef.current.get(jobId) === true,
            onProgress: (progress) => {
              setExpandJobs((prev) => {
                const next = applyAddExpandJobProgress(prev, jobId, progress);
                const merged = mergeActiveExpandJobPreviews(next);
                setAddExpandPreviewCells(merged.length ? merged : null);
                return next;
              });
            },
            createSlot: async (slot, i) => {
              const lastNodes = nodesRef.current;
              const nodesById = new Map(lastNodes.map((node) => [node.id, node]));
              const { placements } = buildSkillGridLayout(lastNodes);
              const weightedNeighbors = getWeightedNeighborhood(
                { row: slot.row, col: slot.col },
                placements,
                nodesById,
              );
              const slotPrompt = buildBridgeKnowledgePrompt({
                blockTitles: input.blockTitles,
                userGuidance: input.userPrompt,
                slotIndex: i,
                totalSlots: slots.length,
                cell: slot,
              });
              const response = await fetch("/api/workspace/add-block-at-slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  row: slot.row,
                  col: slot.col,
                  prompt: slotPrompt,
                  weightedNeighbors,
                  model,
                  locale,
                  intent: "bridge",
                  ...(ayclToken ? { ayclToken } : {}),
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                  errorData.error ||
                    `Failed to add bridge block at (${slot.row}, ${slot.col})`,
                );
              }
              const data = await response.json();
              if (data.updatedNodes?.length > 0) {
                const nextNodes = data.updatedNodes.map(
                  (n: Block & { local_context?: unknown }) => ({
                    ...n,
                    local_context: parseBlockLocalContext(n.local_context),
                  }),
                );
                nodesRef.current = nextNodes;
                setNodes(nextNodes);
              }
            },
          });
          setExpandJobs((prev) =>
            applyAddExpandJobProgress(
              prev,
              jobId,
              { completed: result.completed, total: result.total },
              { stopped: result.stopped },
            ),
          );
          refreshNodes();
          router.refresh();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to generate bridge";
          setExpandJobs((prev) =>
            patchAddExpandJob(prev, jobId, {
              status: "error",
              error: message,
            }),
          );
        } finally {
          expandAbortRef.current.delete(jobId);
          window.setTimeout(() => {
            setExpandJobs((prev) => {
              const next = removeAddExpandJob(prev, jobId);
              const merged = mergeActiveExpandJobPreviews(next);
              setAddExpandPreviewCells(merged.length ? merged : null);
              return next;
            });
          }, 1800);
        }
      })();
    },
    [isOwner, locale, refreshNodes, router, workspaceId],
  );

  const handleSubmitGenerateShape = useCallback(
    async (payload: {
      prompt: string;
      cells: WorkspaceAddTargetCell[];
      contextSourceKeys?: string[];
      isStart?: boolean;
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
            ...(ayclToken ? { ayclToken } : {}),
            op: "generate_shape",
            prompt: payload.prompt,
            cells: payload.cells,
            weightedNeighbors,
            model,
            locale,
            ...(payload.contextSourceKeys?.length
              ? { contextSourceKeys: payload.contextSourceKeys }
              : {}),
            is_start: Boolean(payload.isStart),
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
          setNodes(
            initialNodes.map((n) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
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
  }, [workspaceId, supabase, router, refreshKey, isAycl, ayclToken, ayclOwnerUserId, initialPlan, initialNodes, refreshAyclWorkspace]);

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
  const sectionAuth = useCallback(
    () => ({
      isOwner,
      isOrgAdmin,
      isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
    }),
    [ayclToken, currentUserId, isOrgAdmin, isOwner],
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

  const postMapGround = useCallback(
    async (payload: Record<string, unknown>) => {
      setMapGroundBusy(true);
      try {
        const res = await fetch("/api/workspace/map-ground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, ...payload, ...(ayclToken ? { ayclToken } : {}) }),
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

  /** Update title/description/starter/practice limits from the Edit drawer. */
  const handleUpdateBlock = useCallback(
    async (input: {
      blockId: string;
      title: string;
      description: string;
      isStart?: boolean;
      practiceOptions?: BlockPracticeOptions;
    }) => {
      if (!workspaceId || !isOwner) return;
      setIsAddingBlock(true);
      try {
        const fields = buildUpdateBlockPayload({
          blockId: input.blockId,
          title: input.title,
          description: input.description,
          isStart: input.isStart,
          includeIsStart: input.isStart !== undefined,
        });
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "update_block",
            ...fields,
            ...(input.practiceOptions
              ? {
                  practice_options: serializeBlockPracticeOptions(
                    input.practiceOptions,
                  ),
                }
              : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to update block");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map(
              (n: Block & {
                local_context?: unknown;
                practice_options?: unknown;
                creator_effects?: unknown;
              }) => ({
                ...n,
                local_context: parseBlockLocalContext(n.local_context),
                practice_options: parseBlockPracticeOptions(n.practice_options),
                creator_effects: parseBlockCreatorEffects(n.creator_effects, {
                  selfBlockId: n.id,
                }),
              }),
            ),
          );
        }
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, refreshNodes, router, workspaceId],
  );

  /** Persist combinable Dynamic / Generator effects. */
  const handleSaveCreatorEffects = useCallback(
    async (input: { blockId: string; effects: BlockCreatorEffects }) => {
      if (!workspaceId || !isOwner) return;
      const block = nodes.find((n) => n.id === input.blockId);
      if (!block) throw new Error("Block not found");
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "update_block",
            blockId: input.blockId,
            title: block.title,
            description: block.description || "",
            creator_effects: serializeBlockCreatorEffects(input.effects, {
              selfBlockId: input.blockId,
            }),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to save block effects");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map(
              (n: Block & {
                local_context?: unknown;
                practice_options?: unknown;
                creator_effects?: unknown;
              }) => ({
                ...n,
                local_context: parseBlockLocalContext(n.local_context),
                practice_options: parseBlockPracticeOptions(n.practice_options),
                creator_effects: parseBlockCreatorEffects(n.creator_effects, {
                  selfBlockId: n.id,
                }),
              }),
            ),
          );
        }
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, nodes, refreshNodes, router, workspaceId],
  );

  const mapNodesWithEffects = useCallback(
    (
      raw: Array<
        Block & {
          local_context?: unknown;
          practice_options?: unknown;
          creator_effects?: unknown;
        }
      >,
    ) =>
      raw.map((n) => ({
        ...n,
        local_context: parseBlockLocalContext(n.local_context),
        practice_options: parseBlockPracticeOptions(n.practice_options),
        creator_effects: parseBlockCreatorEffects(n.creator_effects, {
          selfBlockId: n.id,
        }),
      })),
    [],
  );

  /**
   * Run effect generation (dynamic unlock / generator empty-cell spawn).
   * Returns ok + error so Mark Done can await Generator and surface failures.
   */
  const runBlockEffectGenerate = useCallback(
    async (input: {
      mode: "dynamic" | "generator_cell";
      blockId?: string;
      generatorBlockId?: string;
      row?: number;
      col?: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!workspaceId) {
        return { ok: false, error: "Missing workspace" };
      }
      const res = await fetch("/api/workspace/block-effect-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...(ayclToken ? { ayclToken } : {}),
          mode: input.mode,
          blockId: input.blockId,
          generatorBlockId: input.generatorBlockId,
          row: input.row,
          col: input.col,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : `Effect generate failed (${res.status})`;
        console.warn("[effect-generate]", err);
        return { ok: false, error: err };
      }
      if (Array.isArray(data.updatedNodes)) {
        setNodes(mapNodesWithEffects(data.updatedNodes));
      }
      if (input.mode === "dynamic" && input.blockId) {
        setDynamicGeneratedIds((prev) => {
          const next = new Set(prev);
          next.add(input.blockId!);
          return next;
        });
        try {
          const key = dynamicGeneratedStorageKey({
            workspaceId,
            blockId: input.blockId,
            userKey: currentUserId || ayclToken || "local",
          });
          window.sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      }
      return { ok: true };
    },
    [ayclToken, currentUserId, locale, mapNodesWithEffects, workspaceId],
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
            ...(ayclToken ? { ayclToken } : {}),
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

  /** Multi-select batch delete (combine pane Delete drawer). */
  const handleDeleteBlocks = useCallback(
    async (input: { blockIds: string[] }) => {
      if (!workspaceId || !isOwner) return;
      const ids = (input.blockIds || []).map((id) => String(id || "").trim()).filter(Boolean);
      if (ids.length === 0) return;
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "delete_blocks",
            blockIds: ids,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to delete blocks");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
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

  /** Multi-select Cluster blocks → absolute relocate (positions only). */
  const handleClusterBlocks = useCallback(
    async (input: {
      blockIds: string[];
      placements: Array<{
        id: string;
        position_x: number;
        position_y: number;
      }>;
      clusterCount: number;
      separation?: number;
      prompt?: string;
    }) => {
      if (!workspaceId) {
        throw new Error("Workspace required to cluster blocks");
      }
      if (!isOwner) {
        throw new Error("Only the workspace owner can cluster blocks");
      }
      if (!input.placements?.length) {
        throw new Error("No placements to apply");
      }
      setIsAddingBlock(true);
      setClusterMapJob({
        active: true,
        progress: 0.7,
        label: "Saving cluster positions…",
      });
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "relocate",
            placements: input.placements,
            blockIds: input.blockIds,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to cluster blocks");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        // Drop residual multi-select / empty / detail chrome after cluster.
        // Parent-only clear is insufficient: grid owns local multi + empty ids.
        setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
        setExpandedBlockId(clearWorkspaceBlockSelection());
        setEmptySurface(clearWorkspaceAddTarget());
        setMapSelectionClearNonce((n) => nextMapSelectionClearNonce(n));
        setClusterMapJob({
          active: true,
          progress: 1,
          label: "Clusters updated",
        });
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, refreshNodes, router, workspaceId],
  );

  const handleClusterProgress = useCallback(
    (
      job: {
        active: boolean;
        progress: number;
        label: string;
      } | null,
    ) => {
      setClusterMapJob(job);
    },
    [],
  );

  /** Multi-select DAG Apply / tab edit → next_block_ids + register created DAG. */
  const handleApplyDag = useCallback(
    async (input: {
      blockIds: string[];
      dagDraft: {
        blockIds: string[];
        edges: Array<{ from: string; to: string; kind: "next" | "lock" }>;
      };
      /** When set, updates an existing created-DAG (DAGs tab edit). */
      dagId?: string;
    }) => {
      if (!workspaceId) {
        throw new Error("Workspace required to apply DAG");
      }
      if (!isOwner) {
        throw new Error("Only the workspace owner can apply or edit DAGs");
      }
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "apply_dag",
            blockIds: input.blockIds,
            dagDraft: input.dagDraft,
            ...(input.dagId ? { dagId: input.dagId } : {}),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to apply DAG");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        if (data.workspaceDags !== undefined) {
          setWorkspaceDags(normalizeWorkspaceDags(data.workspaceDags));
        }
        refreshNodes();
        router.refresh();
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, refreshNodes, router, workspaceId],
  );

  /** Creator DAGs tab — delete record + clear within-DAG next links. */
  const handleDeleteDag = useCallback(
    async (input: { dagId: string }) => {
      if (!input.dagId) {
        throw new Error("dagId required to delete DAG");
      }
      if (!workspaceId) {
        throw new Error("Workspace required to delete DAG");
      }
      if (!isOwner) {
        throw new Error("Only the workspace owner can delete DAGs");
      }
      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            op: "delete_dag",
            dagId: input.dagId,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to delete DAG");
        }
        if (Array.isArray(data.updatedNodes)) {
          setNodes(
            data.updatedNodes.map((n: Block & { local_context?: unknown }) => ({
              ...n,
              local_context: parseBlockLocalContext(n.local_context),
            })),
          );
        }
        if (data.workspaceDags !== undefined) {
          setWorkspaceDags(normalizeWorkspaceDags(data.workspaceDags));
        } else {
          setWorkspaceDags((prev) => prev.filter((d) => d.id !== input.dagId));
        }
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
        body: JSON.stringify({ workspaceId: plan.id, notes: notesContent, ...(ayclToken ? { ayclToken } : {}) }),
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

  // Must stay above loading/error early returns (Rules of Hooks).
  // Hydrate dynamic-generated flags from sessionStorage for map "?" labels.
  // Must stay above loading/error early returns (Rules of Hooks).
  useEffect(() => {
    if (!workspaceId || interactionMode !== "learner") return;
    const userKey = currentUserId || ayclToken || "local";
    const next = new Set<string>();
    for (const n of nodes) {
      try {
        const key = dynamicGeneratedStorageKey({
          workspaceId,
          blockId: n.id,
          userKey,
        });
        if (window.sessionStorage.getItem(key) === "1") {
          next.add(n.id);
        }
      } catch {
        /* ignore */
      }
    }
    setDynamicGeneratedIds(next);
  }, [
    workspaceId,
    interactionMode,
    currentUserId,
    ayclToken,
    nodes.length,
  ]);

  const startAyclUpgradeCheckout = useCallback(async () => {
    if (!ayclToken || ayclUpgradeBusy) return;
    setAyclUpgradeBusy(true);
    try {
      // Success page rebuilds /learn/{token} from sessionStorage after Stripe.
      try {
        sessionStorage.setItem(AYCL_TOKEN_STORAGE_KEY, ayclToken);
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceType: "all_you_can_learn",
          ayclToken,
          // Optional; server resolves source workspace from the purchase.
          ...(workspaceId ? { workspaceId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upgrade checkout failed");
      }
      // Echo token if server returns it (upgrade reuses same access token).
      if (typeof data.ayclAccessToken === "string" && data.ayclAccessToken) {
        try {
          sessionStorage.setItem(AYCL_TOKEN_STORAGE_KEY, data.ayclAccessToken);
        } catch {
          /* ignore */
        }
      }
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upgrade checkout failed");
      setAyclUpgradeBusy(false);
    }
  }, [ayclToken, ayclUpgradeBusy, workspaceId]);

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

  const modeShell = resolveWorkspaceModeShell({
    mode: interactionMode,
    isOwner,
    isOrgAdmin,
    // AYCL token holders are "signed in" for Learner Knowledge without a cookie session.
    isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
  });
  const sectionLayout = resolveWorkspaceSectionLayout(activeSection);
  // Mode-aware section list (Learner: workspace+knowledge; Creator: shipped registry).
  const visibleSections =
    interactionMode === "learner"
      ? modeShell.sections
      : availableWorkspaceSections({ isOwner, isOrgAdmin });
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
    // Mode flip always clears active selection (sole block, multi, empty create).
    setExpandedBlockId(clearWorkspaceBlockSelection());
    setSelectedFilledBlockIds(clearWorkspaceFilledBlockSelection());
    setEmptySurface(clearWorkspaceAddTarget());
    setAddExpandPreviewCells(null);
    setGeneratorTargetPreviewCells(null);
    setGeneratorPickActiveSafe(false);
    generatorEmptyToggleRef.current = null;
    setDynamicPickActiveSafe(false);
    setDynamicUnlockPreviewIds(null);
    dynamicBlockToggleRef.current = null;
    if (next === "learner") {
      setActiveSection(
        resolveActiveSectionForMode({
          mode: next,
          requested: activeSection,
          isOwner,
          isOrgAdmin,
          isLoggedIn: Boolean(currentUserId) || Boolean(ayclToken),
        }),
      );
    }
  };

  // Nav order: Workspace → DAGs → Goals → Context → Simulation → Knowledge → Settings
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
    // Creator owner-only — second tab after Workspace
    ...(!isLearnerMode && isOwner && visibleSections.includes("dags")
      ? [
          {
            key: "dags" as const,
            label: t("planView.sectionDags"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h3v3h-3v-3zm6 0h3v3h-3v-3zm-6 6h3v3h-3v-3zm6 0h3v3h-3v-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 9h3M9 10.5v3M13.5 13.5h-3M15 13.5v-3" />
              </svg>
            ),
          },
        ]
      : []),
    ...(!isLearnerMode && visibleSections.includes("goals")
      ? [
          {
            key: "goals" as const,
            label: t("planView.sectionGoals") || "Goals",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ]
      : []),
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
    ...(visibleSections.includes("simulation")
      ? [
          {
            key: "simulation" as const,
            label: t("planView.sectionSimulation"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
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
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden" data-aycl-shell={isAycl ? "true" : undefined}>
      {!hideNavbar ? <Navbar /> : null}
      {accessBanner ? (
        <div className="shrink-0 border-b border-neutral-800/60" data-workspace-access-banner>
          {accessBanner}
        </div>
      ) : null}

      {isAycl && ayclCapabilities?.canUpgrade ? (
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2"
          data-aycl-upgrade-bar
        >
          <p className="text-[11px] text-amber-100/90">
            {ayclUpgradeOfferDescription()}{" "}
            <span className="font-medium text-white" data-aycl-upgrade-price>
              {ayclUpgradePriceLabel}
            </span>{" "}
            one-time.
          </p>
          <button
            type="button"
            data-aycl-upgrade-cta
            disabled={ayclUpgradeBusy}
            onClick={() => void startAyclUpgradeCheckout()}
            className="rounded-md bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {ayclUpgradeBusy ? "Redirecting…" : ayclUpgradeOfferLabel()}
          </button>
        </div>
      ) : null}

      <WorkspaceSectionNav
        sections={sectionConfig}
        activeSection={activeSection}
        onChange={selectSection}
        variant="bar"
        workspaceTitle={plan.title || plan.root_topic}
        interactionMode={interactionMode}
        onInteractionModeChange={
          isAycl && ayclCapabilities && !ayclCapabilities.allowCreatorModeToggle
            ? undefined
            : selectInteractionMode
        }
      />

      {!isLearnerMode && sectionLayout.mountsContextPanel && (
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
              showFiles={!isAycl}
              seedQuery={plan.root_topic || plan.title}
              ayclToken={ayclToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode && sectionLayout.mountsSimulationPanel && (
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
            data-workspace-simulation-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceSimulationPanel
              workspaceId={workspaceId}
              blocks={nodes}
              workspaceTitle={plan.title || plan.root_topic}
              workspaceGoal={plan.workspace_goal}
              workspaceDescription={plan.description}
              workspaceNotes={notesContent || plan.notes}
              rootTopic={plan.root_topic}
              ayclToken={ayclToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        isOwner &&
        sectionLayout.mountsDagsPanel &&
        visibleSections.includes("dags") && (
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
            data-workspace-dags-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceDagsPanel
              workspaceDags={workspaceDags}
              blocks={nodes}
              busy={isAddingBlock}
              onSaveEdit={async ({ dagId, dagDraft }) => {
                await handleApplyDag({
                  blockIds: dagDraft.blockIds,
                  dagDraft,
                  dagId,
                });
              }}
              onDelete={handleDeleteDag}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        sectionLayout.mountsGoalsPanel &&
        visibleSections.includes("goals") && (
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
            data-workspace-goals-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceGoalsPanel
              workspaceId={workspaceId}
              isOwner={isOwner}
              ayclToken={ayclToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {(canAccessPrivilegedSections || isLearnerMode) &&
        sectionLayout.mountsPerformancePanel &&
        visibleSections.includes("knowledge") && (
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
              lwmEmbeddingsOnly={modeShell.knowledgeLwmEmbeddingsOnly}
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

      {!isLearnerMode &&
        canAccessPrivilegedSections &&
        sectionLayout.mountsIntegrationPanel && (
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
            learnerMode={isLearnerMode}
            learnerScopeId={currentUserId || ayclToken || "local"}
            cloneArmed={cloneArm.armed}
            onCloneArm={isOwner && !isLearnerMode ? handleCloneArm : undefined}
            onCloneCancel={handleCloneCancel}
            isLoggedIn={!!currentUserId || isAycl}
            supabase={supabase}
            planTopic={plan.root_topic}
            workspaceId={workspaceId}
            onRefresh={isAycl ? () => void refreshAyclWorkspace() : refreshNodes}
            onNodesUpdate={handleNodesUpdate}
            ayclToken={ayclToken}
            expandedNodeId={expandedBlockId}
            onExpandedNodeIdChange={handleExpandedBlockChange}
            onEmptySelectionChange={
              isLearnerMode ? undefined : handleEmptySelectionChange
            }
            onSelectedBlockIdsChange={
              isLearnerMode ? undefined : handleSelectedBlockIdsChange
            }
            mapSelectionClearNonce={mapSelectionClearNonce}
            unusableCells={unusableCells}
            onMapGround={
              isOwner && !isLearnerMode ? handleMapGround : undefined
            }
            workspaceNotes={notesContent || plan.notes}
            previewEmptyCells={isLearnerMode ? null : addExpandPreviewCells}
            generatorTargetPreviewCells={
              // Draft while editing Generator drawer; else saved targets on selected block.
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
            {showLearnerDrawer &&
            detailBlock &&
            detailIndex >= 0 ? (
              <WorkspaceLearnerBlockPane
                key={`learner-${detailBlock.id}`}
                block={detailBlock}
                blocks={nodes}
                workspaceId={workspaceId}
                ayclToken={ayclToken}
                locale={locale}
                learnerUserKey={currentUserId || ayclToken || "local"}
                locked={
                  isLearnerMode
                    ? isLearnerMapBlockLocked(detailBlock, nodes)
                    : isBlockLockedUntilCompleted(
                        detailBlock as MapGroundBlockRef,
                        new Map(
                          nodes.map((n) => [n.id, n as MapGroundBlockRef]),
                        ),
                      )
                }
                onBlocksUpdated={(raw) => {
                  if (Array.isArray(raw)) {
                    setNodes(
                      mapNodesWithEffects(
                        raw as Array<
                          Block & {
                            local_context?: unknown;
                            practice_options?: unknown;
                            creator_effects?: unknown;
                          }
                        >,
                      ),
                    );
                  }
                }}
                onDynamicGenerated={(blockId) => {
                  setDynamicGeneratedIds((prev) => {
                    const next = new Set(prev);
                    next.add(blockId);
                    return next;
                  });
                }}
                onSavePlanningPrompt={async (prompt) => {
                  await supabase
                    .from("blocks")
                    .update({ planning_prompt: prompt.trim() || null })
                    .eq("id", detailBlock.id);
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === detailBlock.id
                        ? { ...n, planning_prompt: prompt.trim() || undefined }
                        : n,
                    ),
                  );
                }}
                onLaunchIntent={
                  currentUserId
                    ? async (target, options) => {
                        // Same product intent map as SessionItem / BlockDetailCard.
                        if (target.product === "ile") {
                          const { createSession } = await import("@/lib/storage");
                          const ileMode =
                            target.session_mode === "project"
                              ? "project"
                              : "learning";
                          await supabase
                            .from("blocks")
                            .update({ status: "in_progress" })
                            .eq("id", detailBlock.id);
                          const prompt =
                            detailBlock.planning_prompt || undefined;
                          const session = await createSession(
                            detailBlock.title,
                            undefined,
                            prompt,
                            undefined,
                            workspaceId,
                            {
                              session_mode: ileMode,
                              ile_session_mode: ileMode,
                              block_id: detailBlock.id,
                              block_title: detailBlock.title,
                            },
                          );
                          await supabase
                            .from("blocks")
                            .update({ session_id: session.id })
                            .eq("id", detailBlock.id);
                          await supabase.from("block_sessions").insert({
                            block_id: detailBlock.id,
                            session_id: session.id,
                            user_id: currentUserId,
                            workspace_id: workspaceId,
                          });
                          router.push(`/session?id=${session.id}`);
                          return;
                        }
                        // TAP timed explore / drill
                        const params = new URLSearchParams({
                          blockId: detailBlock.id,
                        });
                        if (target.interaction_kind === "exercise") {
                          params.set("interactionKind", "exercise");
                        }
                        if (
                          typeof options?.minutes === "number" &&
                          Number.isFinite(options.minutes) &&
                          options.minutes > 0
                        ) {
                          params.set(
                            "minutes",
                            String(Math.trunc(options.minutes)),
                          );
                        }
                        if (detailBlock.session_id) {
                          params.set("sessionId", detailBlock.session_id);
                        }
                        router.push(
                          `/workspace/${workspaceId}/tap?${params.toString()}`,
                        );
                      }
                    : undefined
                }
                onFetchPowSummary={async (blockId) => {
                  try {
                    // PoW for this block + logged-in user (Progress drawer).
                    const qs = new URLSearchParams({
                      workspaceId,
                      subjectKey: "me",
                      quality: "all",
                      blockId,
                    });
                    const res = await fetch(
                      `/api/workspace/proof-of-work-stats?${qs.toString()}`,
                    );
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      return {
                        powCount: 0,
                        notes: data.error || "Failed to load PoW stats",
                      } satisfies LearnerPowSummary;
                    }
                    return parseLearnerPowSummaryFromApi(data);
                  } catch {
                    return { powCount: 0, notes: "PoW stats request failed" };
                  }
                }}
                onMarkDone={async ({ blockId, status, onPhase }) => {
                  const report = (phase: LearnerDoneProgressPhase) => {
                    onPhase?.(phase);
                  };

                  // 1) Persist status via map-ground (await success) — always allowed
                  // regardless of PoW recommendation (force Mark Done).
                  report("marking_done");
                  const groundRes = await fetch("/api/workspace/map-ground", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      workspaceId,
                      ...(ayclToken ? { ayclToken } : {}),
                      op: "set_block_status",
                      blockId,
                      status,
                    }),
                  });
                  const groundData = await groundRes.json().catch(() => ({}));
                  if (!groundRes.ok) {
                    throw new Error(
                      groundData.error || "Failed to mark block done",
                    );
                  }

                  const before = nodes.map((n) => ({
                    id: n.id,
                    title: n.title,
                    status: n.status,
                    lock_until_block_ids: n.lock_until_block_ids,
                    creator_effects: n.creator_effects,
                    position_x: n.position_x,
                    position_y: n.position_y,
                  }));
                  const { unlockedIds } = blocksUnlockedAfterDone({
                    completedBlockId: blockId,
                    blocks: before as MapGroundBlockRef[],
                  });

                  // Prefer server nodes (with status) but keep client-parsed effects.
                  if (Array.isArray(groundData.updatedNodes)) {
                    setNodes(
                      mapNodesWithEffects(
                        groundData.updatedNodes as Array<
                          Block & {
                            local_context?: unknown;
                            practice_options?: unknown;
                            creator_effects?: unknown;
                          }
                        >,
                      ),
                    );
                  } else {
                    setNodes((prev) =>
                      prev.map((n) =>
                        n.id === blockId ? { ...n, status: "completed" } : n,
                      ),
                    );
                  }

                  // Blocks for effect resolution: mark completed in the snapshot
                  // we use (do not wait for React state).
                  const blocksForEffects = before.map((n) =>
                    n.id === blockId ? { ...n, status: "completed" } : n,
                  );

                  // 2) Generator / Dynamic effects immediately after status save.
                  // Do NOT wait on LWM snapshot first — that can hang for minutes
                  // and previously blocked generator spawn entirely.
                  report("applying_unlocks");
                  const effectErrors: string[] = [];

                  const genCells = generatorTargetCellsAfterDone({
                    completedBlockId: blockId,
                    blocks: blocksForEffects,
                    unusableKeys: unusableCells.map(
                      (c) => `${c.row}:${c.col}`,
                    ),
                  });
                  for (const cell of genCells) {
                    const result = await runBlockEffectGenerate({
                      mode: "generator_cell",
                      generatorBlockId: blockId,
                      row: cell.row,
                      col: cell.col,
                    });
                    if (!result.ok) {
                      effectErrors.push(
                        result.error ||
                          `Generator failed at (${cell.row},${cell.col})`,
                      );
                    }
                  }

                  const dynamicIds = dynamicBlocksUnlockedAfterDone({
                    completedBlockId: blockId,
                    blocks: blocksForEffects,
                  });
                  for (const dynId of dynamicIds) {
                    const result = await runBlockEffectGenerate({
                      mode: "dynamic",
                      blockId: dynId,
                    });
                    if (!result.ok) {
                      effectErrors.push(
                        result.error || `Dynamic generate failed for ${dynId}`,
                      );
                    }
                  }

                  // 3) Soft LWM snapshot (non-blocking after soft timeout)
                  report("snapshot_lwm");
                  try {
                    const snapAbort = new AbortController();
                    const snapTimer = window.setTimeout(
                      () => snapAbort.abort(),
                      12_000,
                    );
                    const snapRes = await fetch(
                      `/api/workspaces/${workspaceId}/snapshot-all`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workspaceId }),
                        signal: snapAbort.signal,
                      },
                    ).catch(() => null);
                    window.clearTimeout(snapTimer);
                    if (snapRes && !snapRes.ok && snapRes.status >= 500) {
                      console.warn(
                        "[learner-done] snapshot-all failed",
                        snapRes.status,
                      );
                    }
                  } catch {
                    /* snapshot is best-effort after Done */
                  }

                  refreshNodes();
                  router.refresh();

                  if (effectErrors.length) {
                    throw new Error(
                      `Marked done, but generation failed: ${effectErrors[0]}`,
                    );
                  }
                  return {
                    unlockedIds,
                    generatedCells: genCells.length,
                    dynamicGenerated: dynamicIds.length,
                  };
                }}
              />
            ) : showCreatorDrawers &&
              rightPane === "combine_blocks" &&
              combineBlockIds.length >= 2 ? (
              <WorkspaceCombineBlocksPane
                key={`combine-${combineBlockIds.join(",")}`}
                blockIds={combineBlockIds}
                nodes={nodes}
                busy={isAddingBlock}
                unusableCells={unusableCells}
                onCombine={handleCombineBlocks}
                onGenerateBridge={handleGenerateBridge}
                onApplyDag={handleApplyDag}
                onClusterBlocks={handleClusterBlocks}
                onClusterProgress={handleClusterProgress}
                onDeleteBlocks={handleDeleteBlocks}
                onBridgePreviewChange={setAddExpandPreviewCells}
                onCancel={handleCloseCombine}
                labels={{
                  combine: t("sessionList.gridMerge") || "Combine into one block",
                  cancel: t("sessionList.gridAddCancel") || "Cancel",
                }}
              />
            ) : showCreatorDrawers &&
              rightPane === "block_detail" &&
              detailBlock &&
              detailIndex >= 0 ? (
              <WorkspaceBlockDetailPane
                key={detailBlock.id}
                blockId={detailBlock.id}
                blockTitle={detailBlock.title}
                blockDescription={detailBlock.description}
                planningPrompt={detailBlock.planning_prompt}
                localContext={detailBlock.local_context}
                blockStatus={detailBlock.status}
                isStart={detailBlock.is_start}
                practiceOptions={parseBlockPracticeOptions(
                  detailBlock.practice_options,
                )}
                creatorEffects={parseBlockCreatorEffects(
                  detailBlock.creator_effects,
                  { selfBlockId: detailBlock.id },
                )}
                lockUntilTitles={detailLockTitles}
                spanW={detailBlock.span_w}
                spanH={detailBlock.span_h}
                shapeCells={detailBlock.shape_cells}
                positionX={detailBlock.position_x}
                positionY={detailBlock.position_y}
                workspaceId={workspaceId}
                ayclToken={ayclToken}
                locale={locale}
                canEdit={isOwner}
                editBusy={isAddingBlock}
                workspaceGoal={plan.workspace_goal}
                workspaceTitle={plan.title || plan.root_topic}
                rootTopic={plan.root_topic}
                workspaceNotes={notesContent || plan.notes}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                onSaveCreatorEffects={
                  isOwner ? handleSaveCreatorEffects : undefined
                }
                onSplitBlock={isOwner ? handleSplitBlock : undefined}
                expandNodes={nodes}
                unusableCells={unusableCells}
                onExpandBlock={
                  isOwner ? handleExpandFromSourceBlock : undefined
                }
                onExpandPreviewChange={setAddExpandPreviewCells}
                onGeneratorTargetPreviewChange={setGeneratorTargetPreviewCells}
                onGeneratorPickModeChange={setGeneratorPickActiveSafe}
                onRegisterGeneratorEmptyToggle={registerGeneratorEmptyToggle}
                onDynamicUnlockPreviewChange={setDynamicUnlockPreviewIds}
                onDynamicPickModeChange={setDynamicPickActiveSafe}
                onRegisterDynamicBlockToggle={registerDynamicBlockToggle}
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
              />
            ) : showCreatorDrawers && rightPane === "add_block" && addTargetCell ? (
              <WorkspaceAddBlockPane
                key={`add-${addTargetCell.row}-${addTargetCell.col}`}
                cell={addTargetCell}
                nodes={nodes}
                workspaceId={workspaceId}
                ayclToken={ayclToken}
                locale={locale}
                busy={false}
                workspaceNotes={notesContent || plan.notes}
                unusableCells={unusableCells}
                onSubmit={handleSubmitAddBlock}
                onCancel={handleCloseEmptyCreate}
                onExpandPreviewChange={setAddExpandPreviewCells}
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
            ) : showCreatorDrawers &&
              rightPane === "generate_shape" &&
              generateShapeCells ? (
              <WorkspaceGenerateShapePane
                ayclToken={ayclToken}
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
              <WorkspaceMapAuthoringPane
                canEdit={isOwner && showCreatorDrawers}
              />
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
