"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceRightPaneDrawerGroup } from "@/components/WorkspaceRightPaneDrawer";
import {
  areBlocksContiguous,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import {
  buildSkillGridLayout,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import { CombineBlocksDrawer } from "@/components/workspace-combine/combine-drawer";
import { BridgeBlocksDrawer } from "@/components/workspace-combine/bridge-drawer";
import { ClusterBlocksDrawer } from "@/components/workspace-combine/cluster-drawer";
import { DagBlocksDrawer } from "@/components/workspace-combine/dag-drawer";
import { DangerBlocksDrawer } from "@/components/workspace-combine/danger-drawer";
import type { MultiBlockDagDraft } from "@/lib/multi-block-dag";

export type CombineBlockRef = {
  id: string;
  title: string;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: SkillGridNode["shape_cells"];
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
  is_start?: boolean | null;
};

/**
 * Right-column surface when ≥2 filled blocks are multi-selected.
 * Combine + Bridge + DAG (dependency graph) + Delete.
 */
export function WorkspaceCombineBlocksPane({
  blockIds,
  nodes,
  busy = false,
  unusableCells = null,
  workspaceId,
  ayclToken,
  onCombine,
  onGenerateBridge,
  onApplyDag,
  onClusterBlocks,
  onClusterProgress,
  onDeleteBlocks,
  onBridgePreviewChange,
  onCancel,
  labels,
}: {
  blockIds: string[];
  nodes: CombineBlockRef[];
  busy?: boolean;
  unusableCells?: Array<{ row: number; col: number }> | null;
  workspaceId?: string;
  ayclToken?: string;
  onCombine: (input: {
    blockIds: string[];
    prompt?: string;
  }) => Promise<void> | void;
  /**
   * Enqueue background multi-create along a straight knowledge-bridge corridor.
   * Host freezes slots into the same expand-job path as range/density create.
   */
  onGenerateBridge?: (input: {
    blockIds: string[];
    density: number;
    width: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void> | void;
  /** Persist multi-select dependency DAG (next + lock_until among selection). */
  onApplyDag?: (input: {
    blockIds: string[];
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void> | void;
  /**
   * Relocate selected blocks into physical clusters (positions only).
   * Host persists via grid-ops relocate.
   */
  onClusterBlocks?: (input: {
    blockIds: string[];
    placements: Array<{
      id: string;
      position_x: number;
      position_y: number;
    }>;
    clusterCount: number;
    /** Extra empty cells between clusters (0–10). */
    separation?: number;
    prompt?: string;
  }) => Promise<void> | void;
  /**
   * Progress under the minimap while clustering runs
   * (compute + persist). Host shows a progress bar.
   */
  onClusterProgress?: (
    job: {
      active: boolean;
      progress: number;
      label: string;
    } | null,
  ) => void;
  /** Batch-delete all multi-selected blocks. */
  onDeleteBlocks?: (input: { blockIds: string[] }) => Promise<void> | void;
  /** Lift bridge corridor preview onto the map. */
  onBridgePreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
  onCancel: () => void;
  labels?: {
    combine?: string;
    cancel?: string;
    promptPlaceholder?: string;
  };
}) {
  const selected = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return blockIds
      .map((id) => byId.get(id))
      .filter((n): n is CombineBlockRef => Boolean(n));
  }, [blockIds, nodes]);

  const skillNodes = useMemo(
    () =>
      selected.map(
        (n) =>
          ({
            id: n.id,
            title: n.title,
            description: n.description ?? "",
            status: "available",
            is_start: false,
            next_block_ids: [],
            position_x: n.position_x ?? null,
            position_y: n.position_y ?? null,
            span_w: n.span_w ?? 1,
            span_h: n.span_h ?? 1,
            shape_cells: n.shape_cells ?? null,
          }) as SkillGridNode,
      ),
    [selected],
  );

  const contiguous = useMemo(() => {
    const { placements, spans } = buildSkillGridLayout(skillNodes);
    const placed: PlacedBlockRef[] = selected.flatMap((n) => {
      const cell = placements.get(n.id);
      if (!cell) return [];
      const span = spans.get(n.id);
      return [
        {
          id: n.id,
          position_x: cell.col,
          position_y: cell.row,
          span_w: span?.span_w ?? 1,
          span_h: span?.span_h ?? 1,
          shape_cells: n.shape_cells ?? null,
        },
      ];
    });
    if (placed.length < 2) return false;
    return areBlocksContiguous(placed);
  }, [selected, skillNodes]);

  /** Accordion open drawer — bridge open ⇒ show corridor highlight on the map. */
  const defaultDrawerId = contiguous ? "combine" : "bridge";
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(defaultDrawerId);

  // Reset draft when the multi-selection set changes.
  const selectionKey = blockIds.join(",");
  useEffect(() => {
    setOpenDrawerId(contiguous ? "combine" : "bridge");
  }, [selectionKey, contiguous, nodes]);

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId={defaultDrawerId}
      openId={openDrawerId}
      onOpenIdChange={setOpenDrawerId}
      data-workspace-right-pane="combine_blocks"
      data-workspace-combine-blocks-pane
      data-combine-block-count={String(selected.length)}
      data-combine-contiguous={contiguous ? "true" : "false"}
      data-bridge-block-count={String(selected.length)}
      data-default-drawer={defaultDrawerId}
      data-bridge-drawer-open={openDrawerId === "bridge" ? "true" : "false"}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      <CombineBlocksDrawer
        selected={selected}
        contiguous={contiguous}
        busy={busy}
        selectionKey={selectionKey}
        onCombine={onCombine}
        onCancel={onCancel}
        labels={labels}
      />
      <BridgeBlocksDrawer
        selected={selected}
        nodes={nodes}
        contiguous={contiguous}
        busy={busy}
        selectionKey={selectionKey}
        unusableCells={unusableCells}
        previewActive={openDrawerId === "bridge"}
        onGenerateBridge={onGenerateBridge}
        onBridgePreviewChange={onBridgePreviewChange}
      />
      <ClusterBlocksDrawer
        selected={selected}
        nodes={nodes}
        busy={busy}
        selectionKey={selectionKey}
        unusableCells={unusableCells}
        onClusterBlocks={onClusterBlocks}
        onClusterProgress={onClusterProgress}
      />
      <DagBlocksDrawer
        selected={selected}
        nodes={nodes}
        blockIds={blockIds}
        busy={busy}
        selectionKey={selectionKey}
        workspaceId={workspaceId}
        ayclToken={ayclToken}
        onApplyDag={onApplyDag}
      />
      <DangerBlocksDrawer
        selected={selected}
        busy={busy}
        selectionKey={selectionKey}
        onDeleteBlocks={onDeleteBlocks}
      />
    </WorkspaceRightPaneDrawerGroup>
  );
}
