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
import type {
  CombineBlockRef,
  WorkspaceCombineBlocksPaneProps,
} from "@/components/workspace-combine/types";

export type { CombineBlockRef };

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
}: WorkspaceCombineBlocksPaneProps) {
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
