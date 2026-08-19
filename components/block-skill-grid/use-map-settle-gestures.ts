"use client";

import { useCallback } from "react";
import {
  blockDragMoveDelta,
  emptyCellDragIsPan,
  isLassoModeTool,
  isMapPanGesture,
  resolveBlockPointerGestureSelection,
  type BlockMapModeTool,
} from "@/lib/block-map-tools";
import {
  footprintFromBlock,
  normalizeSpan,
  previewStretchBlockFromHandle,
  stretchBlockFromHandle,
  type PlacedBlockRef,
  type StretchHandle,
} from "@/lib/skill-grid-ops";
import { nextWorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { PAN_CLICK_THRESHOLD } from "@/components/block-skill-grid/types";
import type { GridCell, SkillGridNode } from "@/lib/block-skill-grid";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";

export function useMapSettleGestures(input: {
  blockDragRef: { current: any };
  setBlockDragOffset: (next: { dRow: number; dCol: number } | null) => void;
  setBlockDragIds: (next: string[] | null) => void;
  pendingSelectClickRef: { current: any };
  suppressBlockClickRef: { current: boolean };
  resolveCellFromClient: (clientX: number, clientY: number) => GridCell | null;
  selectedBlockIdsRef: { current: string[] };
  selectedEmptyCellsRef: { current: GridCell[] };
  commitSelection: (selection: any, opts?: { resetChrome?: boolean }) => void;
  runGridOp: NonNullable<BlockSkillGridProps["onGridOp"]>;
  onGridOp?: BlockSkillGridProps["onGridOp"];
  placedBlocksForStretch: PlacedBlockRef[];
  stretchOccupancy: Map<string, string>;
  stretchDragRef: { current: any };
  setStretchPreview: (next: PlacedBlockRef | null) => void;
  generationLockedBlockIdsRef: { current: Set<string> };
  emptyCellPointerRef: { current: any };
  suppressEmptyClickRef: { current: boolean };
  dragRef: { current: any };
  panMovedRef: { current: boolean };
  spaceHeldRef: { current: boolean };
  beginViewportPan: (event: any, captureTarget?: EventTarget | null) => void;
  selectiveExplanationActiveRef: { current: boolean };
  setPan: (next: any) => void;
  activeToolRef: { current: BlockMapModeTool };
  canEdit: boolean;
  busy: boolean;
  labels: BlockSkillGridProps["labels"];
  nodesById: Map<string, SkillGridNode>;
  pan: { x: number; y: number };
}) {
  const {
    blockDragRef,
    setBlockDragOffset,
    setBlockDragIds,
    pendingSelectClickRef,
    suppressBlockClickRef,
    resolveCellFromClient,
    selectedBlockIdsRef,
    selectedEmptyCellsRef,
    commitSelection,
    runGridOp,
    onGridOp,
    placedBlocksForStretch,
    stretchOccupancy,
    stretchDragRef,
    setStretchPreview,
    generationLockedBlockIdsRef,
    emptyCellPointerRef,
    suppressEmptyClickRef,
    dragRef,
    panMovedRef,
    spaceHeldRef,
    beginViewportPan,
    selectiveExplanationActiveRef,
    setPan,
    activeToolRef,
    canEdit,
    busy,
    labels,
    nodesById,
    pan,
  } = input;

  const handleBlockPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = blockDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      blockDragRef.current = null;
      setBlockDragOffset(null);
      setBlockDragIds(null);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }

      const pending = pendingSelectClickRef.current;
      pendingSelectClickRef.current = null;

      // Click (no drag): resolve from pointerdown snapshot only — never re-apply
      // against mid-gesture preview (that caused select-then-clear).
      if (!drag.moved) {
        if (pending?.blockId) {
          const resolved = resolveBlockPointerGestureSelection({
            blockId: pending.blockId,
            multiModifier: pending.multiModifier,
            moved: false,
            prevSelectedBlockIds: pending.prevSelectedBlockIds,
          });
          commitSelection(
            nextWorkspaceMapSelection({
              type: "set_filled_ids",
              blockIds: resolved.selectedBlockIds,
            }),
          );
          suppressBlockClickRef.current = true;
        }
        return;
      }

      // Drag: keep drag membership; commit grid move.
      if (pending) {
        const resolved = resolveBlockPointerGestureSelection({
          blockId: pending.blockId,
          multiModifier: pending.multiModifier,
          moved: true,
          prevSelectedBlockIds: pending.prevSelectedBlockIds,
        });
        commitSelection(
          nextWorkspaceMapSelection({
            type: "set_filled_ids",
            blockIds: resolved.selectedBlockIds,
          }),
        );
      }
      const cell = resolveCellFromClient(event.clientX, event.clientY);
      if (!cell) return;
      const delta = blockDragMoveDelta(
        { row: drag.originRow, col: drag.originCol },
        cell,
      );
      if (delta.dRow === 0 && delta.dCol === 0) return;
      suppressBlockClickRef.current = true;
      void runGridOp({
        op: "move",
        blockIds: drag.blockIds,
        dRow: delta.dRow,
        dCol: delta.dCol,
      });
    },
    [
      commitSelection,
      resolveCellFromClient,
      runGridOp,
    ],
  );

  /**
   * Sole-select stretch: edge/corner handle owns the gesture (not body move).
   * Preview on move; settle via resize op on pointerup only.
   * Window listeners keep the gesture alive if freeform→solid remounts handles.
   */
  const endStretchDrag = useCallback(
    (clientX: number, clientY: number, pointerId: number) => {
      const drag = stretchDragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      stretchDragRef.current = null;
      setStretchPreview(null);

      if (!drag.moved) return;

      const cell = resolveCellFromClient(clientX, clientY);
      if (!cell) return;
      const delta = blockDragMoveDelta(
        { row: drag.originRow, col: drag.originCol },
        cell,
      );
      if (delta.dRow === 0 && delta.dCol === 0) return;

      const source = placedBlocksForStretch.find((b) => b.id === drag.blockId);
      if (!source) return;
      // Pure settle gate — only persist when helper accepts the target.
      const settled = stretchBlockFromHandle(
        source,
        drag.handle,
        delta.dRow,
        delta.dCol,
        stretchOccupancy,
      );
      if (!settled) return;

      suppressBlockClickRef.current = true;
      void runGridOp({
        op: "resize",
        blockId: drag.blockId,
        handle: drag.handle,
        dRow: delta.dRow,
        dCol: delta.dCol,
      });
    },
    [
      placedBlocksForStretch,
      resolveCellFromClient,
      runGridOp,
      stretchOccupancy,
    ],
  );

  const handleStretchPointerDown = useCallback(
    (blockId: string, handle: StretchHandle, event: React.PointerEvent) => {
      if (!canEdit || busy || !onGridOp) return;
      if (event.button !== 0) return;
      if (selectedBlockIdsRef.current.length !== 1) return;
      if (selectedBlockIdsRef.current[0] !== blockId) return;
      if (generationLockedBlockIdsRef.current.has(blockId)) return;

      event.stopPropagation();
      event.preventDefault();
      // Cancel any body-move arm so handle drag never translates.
      blockDragRef.current = null;
      setBlockDragOffset(null);
      setBlockDragIds(null);
      pendingSelectClickRef.current = null;

      const cell = resolveCellFromClient(event.clientX, event.clientY);
      if (!cell) return;

      const pointerId = event.pointerId;
      stretchDragRef.current = {
        pointerId,
        blockId,
        handle,
        originRow: cell.row,
        originCol: cell.col,
        moved: false,
      };
      const source = placedBlocksForStretch.find((b) => b.id === blockId);
      if (source) {
        // Immediate solid-bbox preview so freeform remounts into solid path once.
        const bbox = footprintFromBlock(source);
        setStretchPreview({
          id: source.id,
          position_x: bbox.position_x,
          position_y: bbox.position_y,
          span_w: bbox.span_w,
          span_h: bbox.span_h,
          shape_cells: null,
        });
      }
      suppressBlockClickRef.current = true;

      const onMove = (ev: PointerEvent) => {
        const drag = stretchDragRef.current;
        if (!drag || drag.pointerId !== ev.pointerId) return;
        const nextCell = resolveCellFromClient(ev.clientX, ev.clientY);
        if (!nextCell) return;
        const delta = blockDragMoveDelta(
          { row: drag.originRow, col: drag.originCol },
          nextCell,
        );
        if (delta.dRow !== 0 || delta.dCol !== 0) {
          drag.moved = true;
          suppressBlockClickRef.current = true;
        }
        const src = placedBlocksForStretch.find((b) => b.id === drag.blockId);
        if (!src) return;
        setStretchPreview(
          previewStretchBlockFromHandle(
            src,
            drag.handle,
            delta.dRow,
            delta.dCol,
            stretchOccupancy,
          ),
        );
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        endStretchDrag(ev.clientX, ev.clientY, pointerId);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      busy,
      canEdit,
      endStretchDrag,
      onGridOp,
      placedBlocksForStretch,
      resolveCellFromClient,
      stretchOccupancy,
    ],
  );

  const handleEmptyCellPointerDown = useCallback(
    (cell: GridCell, event: React.PointerEvent) => {
      if (
        isMapPanGesture({
          button: event.button,
          spaceHeld: spaceHeldRef.current,
        })
      ) {
        event.stopPropagation();
        beginViewportPan(event, event.currentTarget);
        return;
      }
      if (event.button !== 0) return;
      if (isLassoModeTool(activeToolRef.current)) return;
      // Selective Explanation owns the drag — do not arm empty-cell pan.
      if (selectiveExplanationActiveRef.current) return;
      // Pan arm is navigation — available in Learner (!canEdit) as well as Creator.
      // Authoring multi-select / Add stays gated in the click path.
      if (busy) return;

      const multiModifier =
        canEdit && (event.metaKey || event.ctrlKey || event.shiftKey);
      // Shift multi-select: let the normal click path handle it (Creator only).
      if (multiModifier) {
        emptyCellPointerRef.current = null;
        return;
      }

      // Arm pan-vs-click only — do not capture yet (capture before pan breaks click).
      // Creator: selection/Add on click when !panning. Learner: pan only (no +/Add).
      emptyCellPointerRef.current = {
        pointerId: event.pointerId,
        cell: { row: cell.row, col: cell.col },
        startX: event.clientX,
        startY: event.clientY,
        multiModifier: false,
        panning: false,
      };
    },
    [beginViewportPan, busy, canEdit],
  );

  const handleEmptyCellPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const arm = emptyCellPointerRef.current;
      if (!arm || arm.pointerId !== event.pointerId) return;
      const dx = event.clientX - arm.startX;
      const dy = event.clientY - arm.startY;
      const past =
        Math.abs(dx) > PAN_CLICK_THRESHOLD || Math.abs(dy) > PAN_CLICK_THRESHOLD;
      if (
        !arm.panning &&
        emptyCellDragIsPan({
          movedPastThreshold: past,
          multiModifier: arm.multiModifier,
          spaceHeld: spaceHeldRef.current,
          button: event.buttons === 4 ? 1 : 0,
        })
      ) {
        arm.panning = true;
        suppressEmptyClickRef.current = true;
        panMovedRef.current = true;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: arm.startX,
          startY: arm.startY,
          panStartX: pan.x,
          panStartY: pan.y,
        };
        // Capture only once pan starts so a pure click still generates onClick.
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      }
      if (arm.panning && dragRef.current?.pointerId === event.pointerId) {
        const drag = dragRef.current;
        setPan({
          x: drag.panStartX + (event.clientX - drag.startX),
          y: drag.panStartY + (event.clientY - drag.startY),
        });
      }
    },
    [pan.x, pan.y],
  );

  const handleEmptyCellPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const arm = emptyCellPointerRef.current;
      if (!arm || arm.pointerId !== event.pointerId) {
        // Stale up without arm — clear capture if any.
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        }
        return;
      }
      emptyCellPointerRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }
      if (arm.panning) {
        dragRef.current = null;
        // Keep suppressEmptyClickRef true so the following click is ignored.
        suppressEmptyClickRef.current = true;
        return;
      }
      // Pure click: selection is applied by onClick (do not double-apply here).
    },
    [],
  );

  return {
    handleBlockPointerUp,
    endStretchDrag,
    handleStretchPointerDown,
    handleEmptyCellPointerDown,
    handleEmptyCellPointerMove,
    handleEmptyCellPointerUp,
  };
}
