"use client";

import {
  allowsBlockDragInMode,
  cancelPrereqEditMode,
  confirmPrereqEdit,
  enterPrereqEditMode,
  isBlockMapToolEnabled,
  isLassoModeTool,
  isMultiCellBlockSpan,
  nextActiveModeTool,
  nextLassoShape,
  resolveActiveLassoShape,
  resolveUnusableFromSelection,
  visibleBlockMapTools,
  type BlockMapModeTool,
  type BlockMapToolEnablementInput,
  type BlockMapToolId,
  type LassoShapeKind,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import {
  areBlocksContiguous,
  normalizeSpan,
  type PlacedBlockRef,
  type StretchHandle,
} from "@/lib/skill-grid-ops";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";
import { normalizeLockUntilBlockIds, type UnusableCell } from "@/lib/map-ground-rules";
import type { GridCell, SkillGridNode } from "@/lib/block-skill-grid";

export function useMapTools(input: {
  selectedBlockIds: string[];
  selectedEmptyCells: GridCell[];
  nodesById: Map<string, SkillGridNode>;
  spans: Map<string, { span_w: number; span_h: number }>;
  placements: Map<string, GridCell>;
  canEdit: boolean;
  busy: boolean;
  onGridOp?: BlockSkillGridProps["onGridOp"];
  onMapGround?: (payload: {
    op: "set_lock_until" | "set_unusable_cells";
    blockId?: string;
    prerequisiteIds?: string[];
    unusableCells?: UnusableCell[];
  }) => Promise<void> | void;
  prereqEdit: PrereqEditState;
  setPrereqEdit: (next: PrereqEditState) => void;
  shapeFreeformOk: boolean;
  activeTool: BlockMapModeTool;
  setActiveTool: (tool: BlockMapModeTool) => void;
  activeToolRef: { current: BlockMapModeTool };
  lassoShape: LassoShapeKind;
  setLassoShape: (shape: LassoShapeKind | ((prev: LassoShapeKind) => LassoShapeKind)) => void;
  setMergePromptOpen: (open: boolean) => void;
  runGridOp: NonNullable<BlockSkillGridProps["onGridOp"]>;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel?: () => void;
  cloneArmed: boolean;
  selectedNodeId: string | null;
  useRightPaneEmpty: boolean;
  setSuggestions: (next: string[]) => void;
  setSuggestError: (next: string | null) => void;
  setPrompt: (next: string) => void;
  setShapePromptOpen: (open: boolean) => void;
  selectedBlockIdsRef: { current: string[] };
  setSelectedBlockIds: (next: string[]) => void;
  selectedEmptyCellsRef: { current: GridCell[] };
  setSelectedEmptyCells: (next: GridCell[]) => void;
  unusableCells?: UnusableCell[] | null;
  clearSelection: () => void;
  zoomBy: (factor: number) => void;
  recenter: () => void;
}) {
  const {
    selectedBlockIds,
    selectedEmptyCells,
    nodesById,
    spans,
    placements,
    canEdit,
    busy,
    onGridOp,
    onMapGround,
    prereqEdit,
    setPrereqEdit,
    shapeFreeformOk,
    activeTool,
    setActiveTool,
    activeToolRef,
    lassoShape,
    setLassoShape,
    setMergePromptOpen,
    runGridOp,
    onCloneArm,
    onCloneCancel,
    cloneArmed,
    selectedNodeId,
    useRightPaneEmpty,
    setSuggestions,
    setSuggestError,
    setPrompt,
    setShapePromptOpen,
    selectedBlockIdsRef,
    setSelectedBlockIds,
    selectedEmptyCellsRef,
    setSelectedEmptyCells,
    unusableCells,
    clearSelection,
    zoomBy,
    recenter,
  } = input;

  const selectedMultiCellBlockCount = selectedBlockIds.reduce((count, id) => {
    const node = nodesById.get(id);
    if (!node) return count;
    const span = spans.get(id) || {
      span_w: normalizeSpan(node.span_w),
      span_h: normalizeSpan(node.span_h),
    };
    return count + (isMultiCellBlockSpan(span) ? 1 : 0);
  }, 0);

  const selectedPlacedBlocks: PlacedBlockRef[] = selectedBlockIds.flatMap((id) => {
    const node = nodesById.get(id);
    const cell = placements.get(id);
    if (!node || !cell) return [];
    const span = spans.get(id) || {
      span_w: normalizeSpan(node.span_w),
      span_h: normalizeSpan(node.span_h),
    };
    return [
      {
        id,
        position_x: cell.col,
        position_y: cell.row,
        span_w: span.span_w,
        span_h: span.span_h,
      },
    ];
  });
  const selectedBlocksContiguous = areBlocksContiguous(selectedPlacedBlocks);

  const toolEnablement: BlockMapToolEnablementInput = {
    canEdit,
    busy,
    hasGridOps: Boolean(onGridOp),
    hasMapGroundOps: Boolean(onMapGround),
    prereqEditActive: prereqEdit.active,
    selectedBlockCount: selectedBlockIds.length,
    selectedEmptyCellCount: selectedEmptyCells.length,
    selectedMultiCellBlockCount,
    selectedBlocksContiguous,
    selectedEmptyCellsSolidRectangle: shapeFreeformOk,
  };
  const stripTools = visibleBlockMapTools(toolEnablement);

  const previewTargetId =
    !prereqEdit.active && selectedBlockIds.length === 1 ? selectedBlockIds[0] : null;
  const previewPrereqIds = previewTargetId
    ? normalizeLockUntilBlockIds(
        nodesById.get(previewTargetId)?.lock_until_block_ids,
        previewTargetId,
      )
    : [];

  const handleToolClick = (tool: BlockMapToolId) => {
    if (tool === "select" || tool === "move" || isLassoModeTool(tool)) {
      if (prereqEdit.active) {
        setPrereqEdit(cancelPrereqEditMode());
      }
    }
    if (tool === "lasso" && activeTool === "lasso") {
      setLassoShape((s) => nextLassoShape(s));
      return;
    }
    const nextMode = nextActiveModeTool(activeTool, tool);
    activeToolRef.current = nextMode;
    setActiveTool(nextMode);
    if (tool === "lasso" || tool === "lasso_circle" || tool === "lasso_freehand") {
      if (tool === "lasso_circle") setLassoShape("circle");
      else if (tool === "lasso_freehand") setLassoShape("freehand");
    }
    switch (tool) {
      case "select":
      case "move":
      case "lasso":
      case "lasso_circle":
      case "lasso_freehand":
        return;
      case "merge":
        if (isBlockMapToolEnabled("merge", toolEnablement)) setMergePromptOpen(true);
        return;
      case "split":
        if (isBlockMapToolEnabled("split", toolEnablement)) {
          const multiCellIds = selectedBlockIds.filter((id) => {
            const node = nodesById.get(id);
            if (!node) return false;
            const span = spans.get(id) || {
              span_w: normalizeSpan(node.span_w),
              span_h: normalizeSpan(node.span_h),
            };
            return isMultiCellBlockSpan(span);
          });
          if (multiCellIds.length > 0) {
            void runGridOp({ op: "split", blockIds: multiCellIds });
          }
        }
        return;
      case "clone": {
        if (!onCloneArm || !isBlockMapToolEnabled("clone", toolEnablement)) {
          if (cloneArmed && onCloneCancel) onCloneCancel();
          return;
        }
        if (cloneArmed) {
          onCloneCancel?.();
          return;
        }
        const sourceId = selectedBlockIds[0] || selectedNodeId;
        if (sourceId) onCloneArm(sourceId);
        return;
      }
      case "generate_shape":
        if (!useRightPaneEmpty && isBlockMapToolEnabled("generate_shape", toolEnablement)) {
          setSuggestions([]);
          setSuggestError(null);
          setPrompt("");
          setShapePromptOpen(true);
        }
        return;
      case "lock_until": {
        if (!isBlockMapToolEnabled("lock_until", toolEnablement) || !onMapGround) return;
        if (prereqEdit.active) {
          const payload = confirmPrereqEdit(prereqEdit);
          if (!payload) return;
          void (async () => {
            try {
              await onMapGround({
                op: "set_lock_until",
                blockId: payload.blockId,
                prerequisiteIds: payload.lock_until_block_ids,
              });
              setPrereqEdit(cancelPrereqEditMode());
            } catch (err) {
              console.error("lock_until confirm failed", err);
            }
          })();
          return;
        }
        const targetId = selectedBlockIds[0] || selectedNodeId;
        if (!targetId) return;
        const node = nodesById.get(targetId);
        setPrereqEdit(
          enterPrereqEditMode({
            targetId,
            currentLocks: node?.lock_until_block_ids ?? [],
          }),
        );
        selectedBlockIdsRef.current = [targetId];
        setSelectedBlockIds([targetId]);
        selectedEmptyCellsRef.current = [];
        setSelectedEmptyCells([]);
        return;
      }
      case "mark_unusable": {
        if (!isBlockMapToolEnabled("mark_unusable", toolEnablement) || !onMapGround) return;
        const nextCells = resolveUnusableFromSelection(
          selectedEmptyCells,
          unusableCells || [],
        );
        if (!nextCells) return;
        void (async () => {
          try {
            await onMapGround({
              op: "set_unusable_cells",
              unusableCells: nextCells,
            });
            clearSelection();
          } catch (err) {
            console.error("mark_unusable failed", err);
          }
        })();
        return;
      }
      case "clear_selection":
        if (prereqEdit.active) {
          setPrereqEdit(cancelPrereqEditMode());
          return;
        }
        if (isBlockMapToolEnabled("clear_selection", toolEnablement)) clearSelection();
        return;
      case "zoom_in":
        zoomBy(1.15);
        return;
      case "zoom_out":
        zoomBy(0.87);
        return;
      case "recenter":
        recenter();
        return;
      default:
        return;
    }
  };

  const isViewportTool = (t?: BlockMapToolId) =>
    t === "zoom_in" || t === "zoom_out" || t === "recenter";
  const isModeTool = (t?: BlockMapToolId) => t === "select" || t === "lasso";
  const modeTools = stripTools.filter((t) => isModeTool(t));
  const actionTools = stripTools.filter((t) => !isModeTool(t) && !isViewportTool(t));
  const viewportTools = stripTools.filter((t) => isViewportTool(t));
  const activeLassoShape = resolveActiveLassoShape({
    activeTool,
    lassoShape,
  });
  const canDragBlocks = allowsBlockDragInMode(activeTool, Boolean(onGridOp));
  const soleStretchBlockId =
    canEdit &&
    canDragBlocks &&
    !prereqEdit.active &&
    !busy &&
    selectedBlockIds.length === 1
      ? selectedBlockIds[0]
      : null;

  return {
    toolEnablement,
    stripTools,
    previewTargetId,
    previewPrereqIds,
    handleToolClick,
    modeTools,
    actionTools,
    viewportTools,
    activeLassoShape,
    canDragBlocks,
    soleStretchBlockId,
  };
}
