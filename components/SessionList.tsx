"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SessionItem } from "./SessionItem";
import { BlockSkillGrid } from "./BlockSkillGrid";
import { getNeighborTitles, buildSkillGridLayout } from "@/lib/block-skill-grid";
import { createBrowserClient } from "@supabase/ssr";
import { useI18n } from "@/lib/i18n";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = "grok-4.3";

interface PlanNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  position_x?: number;
  position_y?: number;
  planning_prompt?: string;
  session_id?: string;
}

interface SessionListProps {
  nodes: PlanNode[];
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onFork: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  highlightOpacity?: number;
  isOwner?: boolean;
  isGroupPlan?: boolean;
  supabase?: ReturnType<typeof createBrowserClient>;
  planTopic?: string;
  planId?: string;
  onRefresh?: () => void;
  onNodesUpdate?: (nodes: PlanNode[]) => void;
}

function getOrderedSessions(nodes: PlanNode[]): PlanNode[] {
  if (nodes.length === 0) return [];

  const visited = new Set<string>();
  const ordered: PlanNode[] = [];

  const startNodes = nodes.filter((n) => n.is_start);
  const queue = [...startNodes];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;

    visited.add(node.id);
    ordered.push(node);

    const children = nodes.filter((n) => node.next_node_ids?.includes(n.id));

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
  supabase,
  planTopic,
  planId,
  onRefresh,
  onNodesUpdate,
}: SessionListProps) {
  const router = useRouter();
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const { t, locale } = useI18n();

  const { completedSessions } = useMemo(() => {
    const ordered = getOrderedSessions(nodes);
    const completed = ordered.filter((n) => n.status === "completed");
    return { completedSessions: completed };
  }, [nodes]);

  useEffect(() => {
    if (expandedNodeId) return;
    const ordered = getOrderedSessions(nodes);
    const first = ordered.find((n) => n.status !== "completed") ?? ordered[0];
    if (first) setExpandedNodeId(first.id);
  }, [expandedNodeId, nodes]);

  const handleAddBlock = useCallback(
    async (prompt: string, position: { row: number; col: number }) => {
      if (!planId || !isOwner) return;

      const nodesById = new Map(nodes.map((node) => [node.id, node]));
      const { occupancy } = buildSkillGridLayout(nodes);
      const neighbors = getNeighborTitles(position.row, position.col, occupancy, nodesById);
      const neighborNote =
        neighbors.length > 0 ? ` Place it near: ${neighbors.join(", ")}.` : "";

      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem(MODEL_STORAGE_KEY)?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_PLANNER_MODEL;

      setIsAddingBlock(true);
      try {
        const response = await fetch("/api/learning-plan/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            userPrompt: `Add a new learning block for skill grid slot (row ${position.row + 1}, column ${position.col + 1}).${neighborNote} User request: "${prompt}"`,
            model,
            locale,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to add block");
        }

        const data = await response.json();
        if (data.updatedNodes?.length > 0 && onNodesUpdate) onNodesUpdate(data.updatedNodes);
        if (onRefresh) onRefresh();
        router.refresh();
      } catch (err) {
        console.error("Failed to add block:", err);
      } finally {
        setIsAddingBlock(false);
      }
    },
    [isOwner, locale, nodes, onNodesUpdate, onRefresh, planId, router],
  );

  const selectedGridNode = nodes.find((node) => node.id === expandedNodeId) ?? null;
  const selectedGridIndex = selectedGridNode
    ? getOrderedSessions(nodes).findIndex((node) => node.id === selectedGridNode.id)
    : -1;

  return (
    <div className="flex h-full flex-col p-2.5">
      <div className="mb-2 px-0.5">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{t("sessionList.sessions")}</h2>
        <span className="font-mono text-[11px] tabular-nums text-neutral-600">
          {t("sessionList.progressDone", { completed: completedSessions.length, total: nodes.length })}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="min-h-0 flex-[1.08]">
          <BlockSkillGrid
            nodes={nodes}
            selectedNodeId={expandedNodeId}
            onSelectNode={setExpandedNodeId}
            canEdit={isOwner}
            isAdding={isAddingBlock}
            planId={planId}
            locale={locale}
            onAddBlock={handleAddBlock}
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
            }}
          />
        </div>

        {selectedGridNode && selectedGridIndex >= 0 ? (
          <div className="shrink-0 pb-0.5">
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
              supabase={supabase}
              planTopic={planTopic}
              planId={planId}
              variant="detail"
            />
          </div>
        ) : (
          <div className="flex max-h-[120px] shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-800/80 bg-neutral-950/40 px-4 text-center text-sm text-neutral-600">
            {t("sessionList.noSessions")}
          </div>
        )}
      </div>
    </div>
  );
}