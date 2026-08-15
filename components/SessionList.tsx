"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BlockSkillGrid } from "./BlockSkillGrid";
import { buildSkillGridLayout, getWeightedNeighborhood } from "@/lib/block-skill-grid";
import { type SupabaseBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import { nextWorkspaceMapSelection, emptyWorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import type { Block } from "@/lib/domain/types";
import {
  postWorkspaceGridOp,
  shouldReloadWorkspaceAfterMutate,
} from "@/lib/workspace-grid-ops-client";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

interface SessionListProps {
  nodes: Block[];
  onSelect: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onFork: (blockId: string) => void;
  highlightedNodes?: Set<string>;
  highlightOpacity?: number;
  isOwner?: boolean;
  /** Learner map: no authoring strip / empty +; content color cues. */
  learnerMode?: boolean;
  isGroupPlan?: boolean;
  /** Hide completion/progress styling for public workspaces before fork */
  maskProgress?: boolean;
  onRequestFork?: () => void;
  forkLoginHref?: string;
  isLoggedIn?: boolean;
  supabase?: SupabaseBrowserClient;
  planTopic?: string;
  workspaceId?: string;
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: Block[]) => void;
  hideTap?: boolean;
  onCustomStart?: (node: Block) => Promise<void>;
  ayclToken?: string;
  /** Learner map notes scope (user id / aycl token). */
  learnerScopeId?: string | null;
  /** Creator clone-paste (left-strip tool). */
  cloneArmed?: boolean;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel?: () => void;
  /**
   * Controlled open-block id for the workspace right pane (double-click detail).
   * When provided with onExpandedNodeIdChange, SessionList does not host a modal.
   */
  expandedNodeId?: string | null;
  onExpandedNodeIdChange?: (blockId: string | null) => void;
  /**
   * Empty-cell selection for the right pane (1 → Add, 2+ → generate shape).
   * Null/[] clears.
   */
  onEmptySelectionChange?: (cells: Array<{ row: number; col: number }> | null) => void;
  /**
   * Multi-selected filled block ids (2+ → parent shows combine surface).
   * Null/[] clears combine.
   */
  onSelectedBlockIdsChange?: (blockIds: string[] | null) => void;
  /** Host-driven multi-select apply (Map Search / Suggest empty spots). */
  applyMapSelection?: {
    token: number;
    blockIds?: string[] | null;
    emptyCells?: Array<{ row: number; col: number }> | null;
  } | null;
  selectiveExplanationActive?: boolean;
  selectiveExplanationPolygon?: Array<{ x: number; y: number }> | null;
  onSelectiveExplanationComplete?: (
    polygon: Array<{ x: number; y: number }>,
  ) => void;
  injectMapNote?: {
    token: number;
    body: string;
    x: number;
    y: number;
    source?: "creator" | "learner";
  } | null;
  /** Map explore toggle under minimap (above Add Note). */
  mapExploreOpen?: boolean;
  onMapExploreToggle?: () => void;
  /** Build / Play mode toggle under minimap (not in top nav). */
  interactionMode?: "creator" | "learner";
  onInteractionModeChange?: (mode: "creator" | "learner") => void;
  /**
   * @deprecated Prefer onEmptySelectionChange.
   * Single empty placeable cell for right-pane Add block (null clears).
   */
  onAddTargetChange?: (cell: { row: number; col: number } | null) => void;
  /** Unusable map ground cells (path-shaping). */
  unusableCells?: Array<{ row: number; col: number }> | null;
  /** Persist lock-until / unusable ground from left toolbar + selection. */
  onMapGround?: (payload: {
    op: "set_lock_until" | "set_unusable_cells";
    blockId?: string;
    prerequisiteIds?: string[];
    unusableCells?: Array<{ row: number; col: number }>;
  }) => Promise<void> | void;
  /** Workspace notes for generate-in-shape context source picker. */
  workspaceNotes?: string | null;
  /** Add-block Range/Density preview highlight (map only). */
  previewEmptyCells?: Array<{ row: number; col: number }> | null;
  /** Generator empty-cell targets to spark-highlight on the map. */
  generatorTargetPreviewCells?: ReadonlyArray<{ row: number; col: number }> | null;
  /** Generator pick mode: empty clicks toggle targets. */
  generatorPickActive?: boolean;
  onGeneratorEmptyToggle?: (cell: { row: number; col: number }) => void;
  /** Dynamic pick mode: filled block clicks toggle unlock-after deps. */
  dynamicPickActive?: boolean;
  onDynamicBlockToggle?: (blockId: string) => void;
  dynamicUnlockPreviewIds?: readonly string[] | null;
  /** Learner dynamic blocks already generated this session. */
  dynamicContentGeneratedIds?: ReadonlySet<string> | readonly string[] | null;
  /** Background multi-create jobs — progress/stop under minimap. */
  expandJobs?: Array<{
    id: string;
    frozenSlots: Array<{ row: number; col: number }>;
    completed: number;
    total: number;
    aborted: boolean;
    status: "running" | "completed" | "stopped" | "error";
    label?: string;
    error?: string;
  }> | null;
  onAbortExpandJob?: (jobId: string) => void;
  /** Cluster-blocks progress under minimap. */
  clusterMapJob?: {
    active: boolean;
    progress: number;
    label: string;
  } | null;
}

/** Ordered block list (start → next links, then orphans). Shared with right-pane detail. */
export function getOrderedSessions(nodes: Block[]): Block[] {
  if (nodes.length === 0) return [];

  const visited = new Set<string>();
  const ordered: Block[] = [];

  const startNodes = nodes.filter((n) => n.is_start);
  const queue = [...startNodes];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;

    visited.add(node.id);
    ordered.push(node);

    const children = nodes.filter((n) => node.next_block_ids?.includes(n.id));

    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child);
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}

export function SessionList({
  nodes,
  onSelect,
  onDelete,
  onFork,
  highlightedNodes,
  highlightOpacity = 1,
  isOwner = true,
  learnerMode = false,
  isGroupPlan = false,
  maskProgress = false,
  onRequestFork,
  forkLoginHref,
  isLoggedIn = false,
  supabase,
  planTopic,
  workspaceId,
  onRefresh,
  onNodesUpdate,
  hideTap = false,
  onCustomStart,
  ayclToken,
  learnerScopeId = null,
  cloneArmed = false,
  onCloneArm,
  onCloneCancel,
  expandedNodeId: expandedNodeIdProp,
  onExpandedNodeIdChange,
  onEmptySelectionChange,
  onSelectedBlockIdsChange,
  applyMapSelection = null,
  selectiveExplanationActive = false,
  selectiveExplanationPolygon = null,
  onSelectiveExplanationComplete,
  injectMapNote = null,
  mapExploreOpen = false,
  onMapExploreToggle,
  interactionMode = "creator",
  onInteractionModeChange,
  onAddTargetChange,
  unusableCells = null,
  onMapGround,
  workspaceNotes = null,
  previewEmptyCells = null,
  generatorTargetPreviewCells = null,
  generatorPickActive = false,
  onGeneratorEmptyToggle,
  dynamicPickActive = false,
  onDynamicBlockToggle,
  dynamicUnlockPreviewIds = null,
  dynamicContentGeneratedIds = null,
  expandJobs = null,
  onAbortExpandJob,
  clusterMapJob = null,
}: SessionListProps) {
  const router = useRouter();
  const [internalExpandedNodeId, setInternalExpandedNodeId] = useState<string | null>(null);
  const isExpandedControlled =
    expandedNodeIdProp !== undefined && typeof onExpandedNodeIdChange === "function";
  const expandedNodeId = isExpandedControlled ? expandedNodeIdProp : internalExpandedNodeId;
  const setExpandedNodeId = useCallback(
    (blockId: string | null) => {
      const next = nextWorkspaceMapSelection(emptyWorkspaceMapSelection(), {
        type: "open_block",
        blockId,
      });
      if (isExpandedControlled) {
        onExpandedNodeIdChange?.(next.expandedBlockId);
      } else {
        setInternalExpandedNodeId(next.expandedBlockId);
      }
    },
    [expandedNodeId, isExpandedControlled, onExpandedNodeIdChange],
  );
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [appearingNodeIds, setAppearingNodeIds] = useState<string[]>([]);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const gridBackfillAttemptedRef = useRef<string | null>(null);
  /** Mobile non-owner auto-open runs at most once so X close can restore notes/files. */
  const mobileAutoExpandAttemptedRef = useRef(false);
  const { t, locale } = useI18n();

  // Track newly added nodes for sequential appear animation (AI builder path)
  useEffect(() => {
    const currentIds = new Set(nodes.map((n) => n.id));
    const prev = prevNodeIdsRef.current;
    if (prev.size > 0) {
      const added = nodes.filter((n) => !prev.has(n.id)).map((n) => n.id);
      if (added.length > 0) {
        setAppearingNodeIds(added);
      }
    }
    prevNodeIdsRef.current = currentIds;
  }, [nodes]);

  useEffect(() => {
    // Owners edit the map with Select/drag tools — do not auto-open TAP/ILE detail.
    if (isOwner) return;
    // Only auto-open once per mount. Re-running when expandedNodeId becomes null
    // after X would immediately re-select the first block and never restore notes/files.
    if (mobileAutoExpandAttemptedRef.current) return;
    if (expandedNodeId) {
      mobileAutoExpandAttemptedRef.current = true;
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      return;
    }
    const ordered = getOrderedSessions(nodes);
    const first = ordered.find((n) => n.status !== "completed") ?? ordered[0];
    mobileAutoExpandAttemptedRef.current = true;
    if (first) setExpandedNodeId(first.id);
  }, [expandedNodeId, isOwner, nodes, setExpandedNodeId]);

  useEffect(() => {
    if (!workspaceId || !isOwner) return;
    const needsBackfill = nodes.some(
      (node) => node.position_x == null || node.position_y == null,
    );
    if (!needsBackfill) {
      gridBackfillAttemptedRef.current = null;
      return;
    }
    if (gridBackfillAttemptedRef.current === workspaceId) return;
    gridBackfillAttemptedRef.current = workspaceId;

    void fetch("/api/workspace/ensure-grid-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, ...(ayclToken ? { ayclToken } : {}) }),
    })
      .then(async (response) => {
        if (!response.ok) {
          gridBackfillAttemptedRef.current = null;
          return;
        }
        const data = await response.json();
        if (data.updatedNodes?.length) {
          onNodesUpdate?.(data.updatedNodes);
        }
      })
      .catch((error) => {
        gridBackfillAttemptedRef.current = null;
        console.warn("Failed to backfill block grid positions:", error);
      });
  }, [ayclToken, isOwner, nodes, onNodesUpdate, workspaceId]);

  const handleAddBlock = useCallback(
    async (prompt: string, position: { row: number; col: number }) => {
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
          ? window.localStorage.getItem(MODEL_STORAGE_KEY)?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_PLANNER_MODEL;

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
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorMessageFromBody(errorData, "Failed to add block"));
        }

        const data = await response.json();
        if (data.updatedNodes?.length > 0) {
          if (onNodesUpdate) onNodesUpdate(data.updatedNodes);
          const placedNode =
            data.placedNodeId
              ? data.updatedNodes.find((node: Block) => node.id === data.placedNodeId)
              : data.updatedNodes.find(
                  (node: Block) => node.position_x === position.col && node.position_y === position.row,
                );
          // Don't open detail overlay for owners (blocks map multi-select).
          if (placedNode && !isOwner) setExpandedNodeId(placedNode.id);
        }
        if (shouldReloadWorkspaceAfterMutate()) {
          if (onRefresh) onRefresh();
          router.refresh();
        }
      } catch (err) {
        console.error("Failed to add block:", err);
        throw err;
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, locale, nodes, onNodesUpdate, onRefresh, workspaceId, router],
  );

  const handleGridOp = useCallback(
    async (payload: {
      op: "generate_shape" | "merge" | "split" | "move" | "resize" | "update_block" | "delete_block";
      prompt?: string;
      cells?: Array<{ row: number; col: number }>;
      blockIds?: string[];
      dRow?: number;
      dCol?: number;
      blockId?: string;
      /** Edge/corner stretch handle for sole-block resize. */
      handle?: string;
      title?: string;
      description?: string;
      contextSourceKeys?: string[];
    }) => {
      if (!workspaceId || !isOwner) return;

      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const { placements } = buildSkillGridLayout(nodes);
      const anchor =
        payload.cells?.[0] ||
        (payload.blockIds?.[0]
          ? (() => {
              const cell = placements.get(payload.blockIds[0]);
              return cell ? { row: cell.row, col: cell.col } : null;
            })()
          : null);
      const weightedNeighbors = anchor
        ? getWeightedNeighborhood(anchor, placements, nodesById)
        : [];

      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem(MODEL_STORAGE_KEY)?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_PLANNER_MODEL;

      // Move/resize: no full-map freeze — optimistic map + quiet save under minimap.
      const silentGeometry = payload.op === "move" || payload.op === "resize";
      if (!silentGeometry) setIsAddingBlock(true);
      try {
        const { ok, data } = await postWorkspaceGridOp({
          workspaceId,
          ...payload,
          weightedNeighbors,
          model,
          locale,
          ayclToken,
        });

        if (!ok) {
          throw new Error((data.error as string) || "Grid operation failed");
        }
        const updatedNodes = Array.isArray(data.updatedNodes)
          ? (data.updatedNodes as Block[])
          : [];
        if (updatedNodes.length > 0) {
          if (onNodesUpdate) onNodesUpdate(updatedNodes);
          // Owners multi-select on the map — do not open the full-screen detail
          // overlay after grid ops (it blocks further multi-select).
          const placedNodeId =
            typeof data.placedNodeId === "string" ? data.placedNodeId : "";
          if (placedNodeId && !isOwner) {
            setExpandedNodeId(placedNodeId);
          }
          if (data.appearSequentially) {
            if (placedNodeId) {
              setAppearingNodeIds([placedNodeId]);
            } else {
              const prev = prevNodeIdsRef.current;
              const added = updatedNodes
                .filter((n) => !prev.has(n.id))
                .map((n) => n.id);
              if (added.length) setAppearingNodeIds(added);
            }
          }
        }
        // Geometry already settled optimistically via onNodesUpdate — do not
        // router.refresh / full plan reload (that felt like a freeze).
        if (!silentGeometry && shouldReloadWorkspaceAfterMutate()) {
          if (onRefresh) onRefresh();
          router.refresh();
        }
        return data;
      } finally {
        if (!silentGeometry) setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, locale, nodes, onNodesUpdate, onRefresh, workspaceId, router],
  );

  // Block detail opens in the workspace right pane (parent). Map stays free of
  // map-covering modal/dialog chrome; double-click → onExpandedNodeIdChange.
  return (
    <div className="relative flex h-full flex-col overflow-hidden p-2.5" data-session-list>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="min-h-0 flex-1">
          <BlockSkillGrid
            nodes={nodes}
            selectedNodeId={expandedNodeId}
            onSelectNode={(blockId) => {
              // Opening a block clears empty create surfaces (right-pane hosts only).
              if (blockId && onEmptySelectionChange) onEmptySelectionChange(null);
              if (blockId && onAddTargetChange) onAddTargetChange(null);
              if (blockId && onSelectedBlockIdsChange) onSelectedBlockIdsChange(null);
              setExpandedNodeId(blockId);
            }}
            onSelectedBlockIdsChange={
              onSelectedBlockIdsChange
                ? (ids) => {
                    if (ids && ids.length >= 2) {
                      setExpandedNodeId(null);
                      if (onEmptySelectionChange) onEmptySelectionChange(null);
                      if (onAddTargetChange) onAddTargetChange(null);
                    }
                    onSelectedBlockIdsChange(ids);
                  }
                : undefined
            }
            // Only wire when parent hosts right-pane empty create. A always-defined
            // wrapper would force useRightPaneEmpty and break local fallback
            // (e.g. WorkspaceChat SessionList without these props).
            onEmptySelectionChange={
              onEmptySelectionChange
                ? (cells) => {
                    if (cells && cells.length > 0) {
                      setExpandedNodeId(null);
                      if (onSelectedBlockIdsChange) onSelectedBlockIdsChange(null);
                    }
                    onEmptySelectionChange(cells);
                  }
                : undefined
            }
            onAddTargetChange={
              onAddTargetChange
                ? (cell) => {
                    if (cell) setExpandedNodeId(null);
                    onAddTargetChange(cell);
                  }
                : undefined
            }
            canEdit={isOwner && !learnerMode}
            learnerMode={learnerMode}
            learnerScopeId={learnerScopeId || ayclToken || null}
            cloneArmed={cloneArmed}
            onCloneArm={onCloneArm}
            onCloneCancel={onCloneCancel}
            showProgress={!maskProgress}
            isAdding={isAddingBlock}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            onAddBlock={handleAddBlock}
            onGridOp={handleGridOp}
            unusableCells={unusableCells}
            onMapGround={onMapGround}
            workspaceNotes={workspaceNotes}
            previewEmptyCells={previewEmptyCells}
            generatorTargetPreviewCells={generatorTargetPreviewCells}
            generatorPickActive={generatorPickActive}
            onGeneratorEmptyToggle={onGeneratorEmptyToggle}
            dynamicPickActive={dynamicPickActive}
            onDynamicBlockToggle={onDynamicBlockToggle}
            dynamicUnlockPreviewIds={dynamicUnlockPreviewIds}
            dynamicContentGeneratedIds={dynamicContentGeneratedIds}
            expandJobs={expandJobs}
            onAbortExpandJob={onAbortExpandJob}
            clusterMapJob={clusterMapJob}
            applyMapSelection={applyMapSelection}
            selectiveExplanationActive={selectiveExplanationActive}
            selectiveExplanationPolygon={selectiveExplanationPolygon}
            onSelectiveExplanationComplete={onSelectiveExplanationComplete}
            injectMapNote={injectMapNote}
            mapExploreOpen={mapExploreOpen}
            onMapExploreToggle={onMapExploreToggle}
            interactionMode={interactionMode}
            onInteractionModeChange={onInteractionModeChange}
            appearingNodeIds={appearingNodeIds}
            onAppearingComplete={() => setAppearingNodeIds([])}
            labels={{
              emptyCell: t("sessionList.gridEmptyCell"),
              addTitle: t("sessionList.gridAddTitle"),
              addPlaceholder: t("sessionList.gridAddPlaceholder"),
              addSubmit: t("sessionList.gridAddSubmit"),
              addCancel: t("sessionList.gridAddCancel"),
              suggestTopics: t("sessionList.gridSuggestTopics"),
              suggesting: t("sessionList.gridSuggesting"),
              suggestError: t("sessionList.gridSuggestError"),
              recenter: t("sessionList.gridRecenter"),
              zoomIn: t("sessionList.gridZoomIn"),
              zoomOut: t("sessionList.gridZoomOut"),
              select: t("sessionList.gridSelect"),
              merge: t("sessionList.gridMerge"),
              split: t("sessionList.gridSplit"),
              move: t("sessionList.gridMove"),
              generateShape: t("sessionList.gridGenerateShape"),
              clearSelection: t("sessionList.gridClearSelection"),
              multiSelectHint: t("sessionList.gridMultiSelectHint"),
            }}
          />
        </div>
      </div>
    </div>
  );
}