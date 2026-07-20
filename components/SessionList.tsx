"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionItem } from "./SessionItem";
import { BlockSkillGrid } from "./BlockSkillGrid";
import { BlockDetailDrawer } from "./BlockDetailDrawer";
import { buildSkillGridLayout, getWeightedNeighborhood } from "@/lib/block-skill-grid";
import { type SupabaseBrowserClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_MODEL } from "@/lib/xai-models";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  position_x?: number;
  position_y?: number;
  span_w?: number;
  span_h?: number;
  planning_prompt?: string;
  session_id?: string;
}

interface SessionListProps {
  nodes: Block[];
  onSelect: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onFork: (blockId: string) => void;
  highlightedNodes?: Set<string>;
  highlightOpacity?: number;
  isOwner?: boolean;
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
}

function getOrderedSessions(nodes: Block[]): Block[] {
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
}: SessionListProps) {
  const router = useRouter();
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [appearingNodeIds, setAppearingNodeIds] = useState<string[]>([]);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const gridBackfillAttemptedRef = useRef<string | null>(null);
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
    if (expandedNodeId) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const ordered = getOrderedSessions(nodes);
    const first = ordered.find((n) => n.status !== "completed") ?? ordered[0];
    if (first) setExpandedNodeId(first.id);
  }, [expandedNodeId, isOwner, nodes]);

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
          throw new Error(errorData.error || "Failed to add block");
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
        if (onRefresh) onRefresh();
        router.refresh();
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
      op: "generate_shape" | "merge" | "split" | "move" | "update_block";
      prompt?: string;
      cells?: Array<{ row: number; col: number }>;
      blockIds?: string[];
      dRow?: number;
      dCol?: number;
      blockId?: string;
      title?: string;
      description?: string;
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

      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/workspace/grid-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...payload,
            weightedNeighbors,
            model,
            locale,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Grid operation failed");
        }

        const data = await response.json();
        if (data.updatedNodes?.length > 0) {
          if (onNodesUpdate) onNodesUpdate(data.updatedNodes);
          // Owners multi-select on the map — do not open the full-screen detail
          // overlay after grid ops (it blocks further multi-select).
          if (data.placedNodeId && !isOwner) {
            setExpandedNodeId(data.placedNodeId);
          }
          if (data.appearSequentially) {
            if (data.placedNodeId) {
              setAppearingNodeIds([data.placedNodeId]);
            } else {
              const prev = prevNodeIdsRef.current;
              const added = (data.updatedNodes as Block[])
                .filter((n) => !prev.has(n.id))
                .map((n) => n.id);
              if (added.length) setAppearingNodeIds(added);
            }
          }
        }
        if (onRefresh) onRefresh();
        router.refresh();
        return data;
      } finally {
        setIsAddingBlock(false);
      }
    },
    [ayclToken, isOwner, locale, nodes, onNodesUpdate, onRefresh, workspaceId, router],
  );

  const selectedGridNode = nodes.find((node) => node.id === expandedNodeId) ?? null;
  const selectedGridIndex = selectedGridNode
    ? getOrderedSessions(nodes).findIndex((node) => node.id === selectedGridNode.id)
    : -1;

  // Owners use Select multi-select on the map — never cover it with a full-screen
  // detail modal except when they explicitly double-click a block (expandedNodeId set
  // from double-click / after create). Still allow detail when expanded is set.
  // The modal's backdrop dismisses via onClose → setExpandedNodeId(null).
  const showBlockDetail = selectedGridNode != null && selectedGridIndex >= 0;

  const renderBlockDetail = () =>
    showBlockDetail && selectedGridNode ? (
      <SessionItem
        node={selectedGridNode}
        index={selectedGridIndex}
        onSelect={() => onSelect(selectedGridNode.id)}
        onDelete={onDelete}
        onFork={onFork}
        highlighted={highlightedNodes?.has(selectedGridNode.id)}
        highlightOpacity={highlightOpacity}
        isExpanded
        isOwner={isOwner}
        isGroupPlan={isGroupPlan}
        maskProgress={maskProgress}
        onRequestFork={onRequestFork}
        forkLoginHref={forkLoginHref}
        isLoggedIn={isLoggedIn}
        supabase={supabase}
        planTopic={planTopic}
        workspaceId={workspaceId}
        variant="detail"
        detailLayout="drawer"
        hideTap={hideTap}
        onCustomStart={onCustomStart}
      />
    ) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden p-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="min-h-0 flex-1">
          <BlockSkillGrid
            nodes={nodes}
            selectedNodeId={expandedNodeId}
            onSelectNode={setExpandedNodeId}
            canEdit={isOwner}
            showProgress={!maskProgress}
            isAdding={isAddingBlock}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            onAddBlock={handleAddBlock}
            onGridOp={handleGridOp}
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
              editBlock: t("sessionList.gridEditBlock"),
              clearSelection: t("sessionList.gridClearSelection"),
              multiSelectHint: t("sessionList.gridMultiSelectHint"),
            }}
          />
        </div>
      </div>

      {showBlockDetail && (
        <div className="absolute inset-0 z-10 overflow-hidden">
          <BlockDetailDrawer
            open
            onClose={() => setExpandedNodeId(null)}
            title={selectedGridNode?.title}
          >
            {renderBlockDetail()}
          </BlockDetailDrawer>
        </div>
      )}
    </div>
  );
}