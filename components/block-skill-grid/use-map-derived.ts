"use client";

import { useMemo, useRef } from "react";
import {
  buildSkillGridLayout,
  skillNodeOccupiedCells,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  activeExpandJobLockedCellKeys,
  isOccupiedCellsGenerationLocked,
  mergeActiveExpandJobPreviews,
  type AddExpandJob,
} from "@/lib/add-block-range-density";
import {
  generatorCellKey,
  generatorTargetHighlightCells,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import {
  ileChapterUnlockHighlightIds,
  learnerMapDependencyHighlightIds,
} from "@/lib/learner-local-dag";
import {
  buildOccupancyFromPlaced,
  normalizeSpan,
  parseShapeCells,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";

export function useMapDerived(input: {
  nodes: SkillGridNode[];
  optimisticPlacements: Record<
    string,
    {
      position_x: number;
      position_y: number;
      span_w: number;
      span_h: number;
      shape_cells?: SkillGridNode["shape_cells"] | null;
    }
  >;
  learnerMode: boolean;
  selectedNodeId: string | null;
  selectedBlockIds: string[];
  suggestMode: "block" | "chapter";
  generatorTargetPreviewCells?: ReadonlyArray<{ row: number; col: number }> | null;
  dynamicContentGeneratedIds?: ReadonlySet<string> | readonly string[] | null;
  dynamicUnlockPreviewIds?: readonly string[] | null;
  expandJobs?: readonly AddExpandJob[] | null;
  sessionId?: string;
  workspaceId?: string;
  recenterCell?: GridCell | null;
  isAdding: boolean;
  localBusy: boolean;
}) {
  const {
    nodes,
    optimisticPlacements,
    learnerMode,
    selectedNodeId,
    selectedBlockIds,
    suggestMode,
    generatorTargetPreviewCells,
    dynamicContentGeneratedIds,
    dynamicUnlockPreviewIds,
    expandJobs,
    sessionId,
    workspaceId,
    recenterCell,
    isAdding,
    localBusy,
  } = input;

  const displayNodes = useMemo((): SkillGridNode[] => {
    const keys = Object.keys(optimisticPlacements);
    if (keys.length === 0) return nodes;
    return nodes.map((n) => {
      const o = optimisticPlacements[n.id];
      if (!o) return n;
      return {
        ...n,
        position_x: o.position_x,
        position_y: o.position_y,
        span_w: o.span_w,
        span_h: o.span_h,
        shape_cells:
          o.shape_cells === undefined
            ? n.shape_cells
            : (o.shape_cells as SkillGridNode["shape_cells"]),
      };
    });
  }, [nodes, optimisticPlacements]);

  const nodesById = useMemo(
    () => new Map(displayNodes.map((node) => [node.id, node])),
    [displayNodes],
  );

  const learnerDepHighlightIds = useMemo(() => {
    if (!learnerMode) return new Set<string>();
    const focus = selectedNodeId || selectedBlockIds[0] || null;
    if (!focus) return new Set<string>();
    return new Set(
      learnerMapDependencyHighlightIds(
        focus,
        displayNodes.map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status,
          lock_until_block_ids: n.lock_until_block_ids,
          next_block_ids: n.next_block_ids,
          position_x: n.position_x,
          position_y: n.position_y,
        })),
      ),
    );
  }, [learnerMode, selectedNodeId, selectedBlockIds, displayNodes]);

  const chapterUnlockHighlightIds = useMemo(() => {
    if (suggestMode !== "chapter") return new Set<string>();
    const focus = selectedNodeId || selectedBlockIds[0] || null;
    if (!focus) return new Set<string>();
    return new Set(
      ileChapterUnlockHighlightIds(
        focus,
        displayNodes.map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status,
          lock_until_block_ids: n.lock_until_block_ids,
          next_block_ids: n.next_block_ids,
        })),
      ),
    );
  }, [suggestMode, selectedNodeId, selectedBlockIds, displayNodes]);

  const generatorSparkEmptyKeys = useMemo(() => {
    if (generatorTargetPreviewCells && generatorTargetPreviewCells.length > 0) {
      return new Set(
        generatorTargetPreviewCells.map((c) =>
          generatorCellKey({ row: c.row, col: c.col }),
        ),
      );
    }
    const focus = selectedNodeId || selectedBlockIds[0] || null;
    if (!focus) return new Set<string>();
    const node = displayNodes.find((n) => n.id === focus);
    if (!node) return new Set<string>();
    const effects = parseBlockCreatorEffects(node.creator_effects, {
      selfBlockId: focus,
    });
    return new Set(
      generatorTargetHighlightCells(effects).map((c) => generatorCellKey(c)),
    );
  }, [
    generatorTargetPreviewCells,
    selectedNodeId,
    selectedBlockIds,
    displayNodes,
  ]);

  const dynamicGeneratedSet = useMemo(() => {
    if (dynamicContentGeneratedIds instanceof Set) {
      return dynamicContentGeneratedIds as Set<string>;
    }
    if (Array.isArray(dynamicContentGeneratedIds)) {
      return new Set(dynamicContentGeneratedIds.map(String).filter(Boolean));
    }
    return new Set<string>();
  }, [dynamicContentGeneratedIds]);

  const dynamicUnlockHighlightIds = useMemo(() => {
    return new Set((dynamicUnlockPreviewIds || []).map(String).filter(Boolean));
  }, [dynamicUnlockPreviewIds]);

  const { occupancy, placements, spans, startCell } = useMemo(
    () => buildSkillGridLayout(displayNodes),
    [displayNodes],
  );

  const placedBlocksForStretch = useMemo((): PlacedBlockRef[] => {
    return displayNodes
      .filter((n) => n.position_x != null && n.position_y != null)
      .map((n) => ({
        id: n.id,
        position_x: n.position_x!,
        position_y: n.position_y!,
        span_w: normalizeSpan(n.span_w),
        span_h: normalizeSpan(n.span_h),
        shape_cells: parseShapeCells(n.shape_cells ?? null),
      }));
  }, [displayNodes]);

  const stretchOccupancy = useMemo(
    () => buildOccupancyFromPlaced(placedBlocksForStretch),
    [placedBlocksForStretch],
  );

  const generationLockedCellKeys = useMemo(
    () => activeExpandJobLockedCellKeys(expandJobs),
    [expandJobs],
  );

  const generationLockedBlockIds = useMemo(() => {
    const locked = new Set<string>();
    if (generationLockedCellKeys.size === 0) return locked;
    for (const node of displayNodes) {
      const cells = skillNodeOccupiedCells(node);
      if (isOccupiedCellsGenerationLocked(cells, generationLockedCellKeys)) {
        locked.add(node.id);
      }
    }
    return locked;
  }, [generationLockedCellKeys, displayNodes]);

  const generationLockedBlockIdsRef = useRef(generationLockedBlockIds);
  generationLockedBlockIdsRef.current = generationLockedBlockIds;

  const generationPendingCellKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of mergeActiveExpandJobPreviews(expandJobs || [])) {
      keys.add(`${c.row}:${c.col}`);
    }
    return keys;
  }, [expandJobs]);

  const canSuggest =
    suggestMode === "chapter" ? Boolean(sessionId) : Boolean(workspaceId);
  const viewportCenterCell = recenterCell ?? startCell;
  const busy = isAdding || localBusy;

  const renderedBlockIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of displayNodes) {
      if (placements.has(node.id)) ids.add(node.id);
    }
    return ids;
  }, [displayNodes, placements]);

  const occupiedByBlockId = useMemo(() => {
    const map = new Map<string, GridCell[]>();
    for (const [id, cell] of placements) {
      const node = nodesById.get(id);
      if (node && node.position_x != null && node.position_y != null) {
        const occ = skillNodeOccupiedCells(node);
        if (occ.length > 0) {
          map.set(id, occ);
          continue;
        }
      }
      const span = spans.get(id) || { span_w: 1, span_h: 1 };
      const cells: GridCell[] = [];
      const h = Math.max(1, span.span_h);
      const w = Math.max(1, span.span_w);
      for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          cells.push({ row: cell.row + dr, col: cell.col + dc });
        }
      }
      map.set(id, cells);
    }
    return map;
  }, [placements, spans, nodesById]);

  return {
    displayNodes,
    nodesById,
    learnerDepHighlightIds,
    chapterUnlockHighlightIds,
    generatorSparkEmptyKeys,
    dynamicGeneratedSet,
    dynamicUnlockHighlightIds,
    occupancy,
    placements,
    spans,
    startCell,
    placedBlocksForStretch,
    stretchOccupancy,
    generationLockedCellKeys,
    generationLockedBlockIds,
    generationLockedBlockIdsRef,
    generationPendingCellKeys,
    canSuggest,
    viewportCenterCell,
    busy,
    renderedBlockIds,
    occupiedByBlockId,
  };
}
