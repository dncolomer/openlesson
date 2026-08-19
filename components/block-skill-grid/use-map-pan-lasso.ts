"use client";

import { useCallback } from "react";
import {
  clientPointToGridCell,
  clientPointToGridPoint,
  blocksIntersectingCircle,
  blocksIntersectingGridRect,
  blocksIntersectingPolygon,
  emptyCellsIntersectingCircle,
  emptyCellsIntersectingGridRect,
  emptyCellsIntersectingPolygon,
  isLassoModeTool,
  isMapPanGesture,
  normalizeGridSelectionRect,
  resolveActiveLassoShape,
  resolveLassoSelection,
  type BlockMapModeTool,
  type LassoShapeKind,
} from "@/lib/block-map-tools";
import {
  annotationEraserRadiusForThickness,
  annotationScreenToWorld,
  appendAnnotationStroke,
  buildAnnotationStrokeFromGesture,
  canDrawOnAnnotationLayer,
  eraseAnnotationStrokesAlongPath,
  isAnnotationStrokeKind,
  upsertAnnotationLayer,
  type AnnotationDrawTool,
  type AnnotationLayer,
  type AnnotationPoint,
  type AnnotationStrokeThickness,
} from "@/lib/map-annotation-layers";
import { nextWorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { skillNodeOccupiedCells, SKILL_GRID_PITCH, type GridCell, type SkillGridNode } from "@/lib/block-skill-grid";
import { normalizeSpan } from "@/lib/skill-grid-ops";
import { PAN_CLICK_THRESHOLD } from "@/components/block-skill-grid/types";
import type { LassoOverlay, AnnotationDrawPreview } from "@/components/block-skill-grid/map-gesture-overlays";

export function useMapPanLasso(input: {
  panMovedRef: { current: boolean };
  dragRef: {
    current: {
      pointerId: number;
      startX: number;
      startY: number;
      panStartX: number;
      panStartY: number;
    } | null;
  };
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  zoom: number;
  shapePromptOpen: boolean;
  mergePromptOpen: boolean;
  spaceHeldRef: { current: boolean };
  spaceHeld: boolean;
  activeToolRef: { current: BlockMapModeTool };
  lassoShapeRef: { current: LassoShapeKind };
  lassoDragRef: { current: any };
  setLassoOverlay: (next: LassoOverlay | null) => void;
  canEdit: boolean;
  viewOnly: boolean;
  learnerMode: boolean;
  viewportRef: { current: HTMLDivElement | null };
  annotationDrawingActive: boolean;
  annotationDrawRef: { current: any };
  annotationDrawTool: AnnotationDrawTool;
  annotationStrokeThickness: AnnotationStrokeThickness;
  activeAnnotationLayerId: string | null;
  annotationLayers: AnnotationLayer[];
  persistAnnotationLayers: (next: AnnotationLayer[]) => void;
  setAnnotationDrawPreview: (next: AnnotationDrawPreview | null) => void;
  selectiveExplanationActive: boolean;
  selectiveExplanationActiveRef: { current: boolean };
  selectiveDragRef: { current: any };
  setSelectiveDrawOverlay: (next: Array<{ x: number; y: number }> | null) => void;
  onSelectiveExplanationComplete?: (polygon: Array<{ x: number; y: number }>) => void;
  occupancy: Map<string, string>;
  placements: Map<string, GridCell>;
  spans: Map<string, { span_w: number; span_h: number }>;
  unusableKeys: Set<string>;
  nodesById: Map<string, SkillGridNode>;
  selectedBlockIds: string[];
  selectedEmptyCells: GridCell[];
  selectedNodeId: string | null;
  nodes: SkillGridNode[];
  commitSelectionRef: {
    current: ((
      selection: any,
      opts?: { resetChrome?: boolean },
    ) => void) | null;
  };
  onSelectNode: (id: string | null) => void;
  generationLockedBlockIdsRef: { current: Set<string> };
}) {
  const {
    panMovedRef,
    dragRef,
    pan,
    setPan,
    zoom,
    shapePromptOpen,
    mergePromptOpen,
    spaceHeldRef,
    spaceHeld,
    activeToolRef,
    lassoShapeRef,
    lassoDragRef,
    setLassoOverlay,
    canEdit,
    viewOnly,
    learnerMode,
    viewportRef,
    annotationDrawingActive,
    annotationDrawRef,
    annotationDrawTool,
    annotationStrokeThickness,
    activeAnnotationLayerId,
    annotationLayers,
    persistAnnotationLayers,
    setAnnotationDrawPreview,
    selectiveExplanationActive,
    selectiveExplanationActiveRef,
    selectiveDragRef,
    setSelectiveDrawOverlay,
    onSelectiveExplanationComplete,
    occupancy,
    placements,
    spans,
    unusableKeys,
    nodesById,
    selectedBlockIds,
    selectedEmptyCells,
    selectedNodeId,
    nodes,
    commitSelectionRef,
    onSelectNode,
    generationLockedBlockIdsRef,
  } = input;

  const beginViewportPan = useCallback(
    (event: React.PointerEvent, captureTarget?: EventTarget | null) => {
      panMovedRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      const el = (captureTarget || event.currentTarget) as HTMLElement;
      el.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [pan.x, pan.y],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shapePromptOpen || mergePromptOpen) return;

      // Space or middle-button: pan always (overrides lasso / skill cells).
      if (
        isMapPanGesture({
          button: event.button,
          spaceHeld: spaceHeldRef.current,
        })
      ) {
        beginViewportPan(event);
        return;
      }

      if (event.button !== 0) return;

      // Selective Explanation free-shape (independent of block/empty selection).
      // Capture on the stable viewport — never on a surface that unmounts mid-gesture.
      // Read both the live prop and the ref: the ref is for mid-gesture
      // stability; the prop covers the frame after "Draw free-shape area".
      if (
        (selectiveExplanationActive || selectiveExplanationActiveRef.current) &&
        !viewOnly
      ) {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        selectiveDragRef.current = {
          pointerId: event.pointerId,
          points: [{ x: localX, y: localY }],
        };
        setSelectiveDrawOverlay([{ x: localX, y: localY }]);
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch {
          /* some browsers reject capture if pointer not active */
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Annotation draw mode (creator + selected layer): draw white strokes anywhere.
      if (
        !learnerMode &&
        activeAnnotationLayerId &&
        canDrawOnAnnotationLayer({ learnerMode: false })
      ) {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const kind = annotationDrawTool;
        annotationDrawRef.current = {
          pointerId: event.pointerId,
          layerId: activeAnnotationLayerId,
          kind,
          startLocal: { x: localX, y: localY },
          curLocal: { x: localX, y: localY },
          pointsLocal: [{ x: localX, y: localY }],
        };
        setAnnotationDrawPreview({
          kind,
          startX: localX,
          startY: localY,
          curX: localX,
          curY: localY,
          points: [{ x: localX, y: localY }],
          strokeWidth: annotationStrokeThickness,
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Lasso mode: draw region anywhere (including over cells).
      const shape = resolveActiveLassoShape({
        activeTool: activeToolRef.current,
        lassoShape: lassoShapeRef.current,
      });
      if (shape && canEdit) {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        lassoDragRef.current = {
          pointerId: event.pointerId,
          shape,
          startX: localX,
          startY: localY,
          curX: localX,
          curY: localY,
          points: [{ x: localX, y: localY }],
        };
        if (shape === "rect") {
          setLassoOverlay({ kind: "rect", left: localX, top: localY, width: 0, height: 0 });
        } else if (shape === "circle") {
          setLassoOverlay({ kind: "circle", cx: localX, cy: localY, r: 0 });
        } else {
          setLassoOverlay({ kind: "freehand", points: [{ x: localX, y: localY }] });
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      // Primary pan on non-skill background (gaps / chrome).
      if ((event.target as HTMLElement).closest("[data-skill-cell]")) return;

      beginViewportPan(event);
    },
    [
      activeAnnotationLayerId,
      annotationDrawTool,
      annotationStrokeThickness,
      beginViewportPan,
      canEdit,
      learnerMode,
      mergePromptOpen,
      selectiveExplanationActive,
      shapePromptOpen,
      viewOnly,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
    // Selective Explanation free-shape draw (viewport-local points).
    const sel = selectiveDragRef.current;
    if (sel && sel.pointerId === event.pointerId) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const last = sel.points[sel.points.length - 1];
      const step = last
        ? Math.hypot(localX - last.x, localY - last.y)
        : Infinity;
      if (step >= 3) {
        sel.points.push({ x: localX, y: localY });
      } else if (last) {
        last.x = localX;
        last.y = localY;
      }
      setSelectiveDrawOverlay([...sel.points]);
      return;
    }

    const ann = annotationDrawRef.current;
    if (ann && ann.pointerId === event.pointerId) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      ann.curLocal = { x: localX, y: localY };
      if (ann.kind === "freehand" || ann.kind === "eraser") {
        const last = ann.pointsLocal[ann.pointsLocal.length - 1];
        const step = last
          ? Math.hypot(localX - last.x, localY - last.y)
          : Infinity;
        if (step >= 3) {
          ann.pointsLocal.push({ x: localX, y: localY });
        } else if (last) {
          last.x = localX;
          last.y = localY;
        }
      }
      setAnnotationDrawPreview({
        kind: ann.kind,
        startX: ann.startLocal.x,
        startY: ann.startLocal.y,
        curX: localX,
        curY: localY,
        points: [...ann.pointsLocal],
        strokeWidth: annotationStrokeThickness,
      });
      return;
    }

    const lasso = lassoDragRef.current;
    if (lasso && lasso.pointerId === event.pointerId) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      lasso.curX = localX;
      lasso.curY = localY;
      if (lasso.shape === "rect") {
        setLassoOverlay({
          kind: "rect",
          left: Math.min(lasso.startX, localX),
          top: Math.min(lasso.startY, localY),
          width: Math.abs(localX - lasso.startX),
          height: Math.abs(localY - lasso.startY),
        });
      } else if (lasso.shape === "circle") {
        const r = Math.hypot(localX - lasso.startX, localY - lasso.startY);
        setLassoOverlay({ kind: "circle", cx: lasso.startX, cy: lasso.startY, r });
      } else {
        const last = lasso.points[lasso.points.length - 1];
        const step = last
          ? Math.hypot(localX - last.x, localY - last.y)
          : Infinity;
        // Sample freehand points every ~4px to keep the polyline light.
        if (step >= 4) {
          lasso.points.push({ x: localX, y: localY });
        } else if (last) {
          last.x = localX;
          last.y = localY;
        }
        setLassoOverlay({ kind: "freehand", points: [...lasso.points] });
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!panMovedRef.current && Math.abs(dx) <= PAN_CLICK_THRESHOLD && Math.abs(dy) <= PAN_CLICK_THRESHOLD) {
      return;
    }

    panMovedRef.current = true;
    setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
  },
  [annotationStrokeThickness],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Selective Explanation free-shape complete → grid polygon (no selection change).
      const sel = selectiveDragRef.current;
      if (sel && sel.pointerId === event.pointerId) {
        selectiveDragRef.current = null;
        setSelectiveDrawOverlay(null);
        const viewport = viewportRef.current;
        // Release capture on the stable viewport (where pointerdown captured).
        if (viewport?.hasPointerCapture?.(event.pointerId)) {
          try {
            viewport.releasePointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
        } else if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
        }
        if (!viewport || !onSelectiveExplanationComplete) return;
        const vrect = viewport.getBoundingClientRect();
        const pts = [...sel.points];
        let pathPx = 0;
        for (let i = 1; i < pts.length; i++) {
          pathPx += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        if (pathPx < PAN_CLICK_THRESHOLD * 2 || pts.length < 3) return;
        const polygon = pts.map((p) =>
          clientPointToGridPoint({
            clientX: vrect.left + p.x,
            clientY: vrect.top + p.y,
            viewportLeft: vrect.left,
            viewportTop: vrect.top,
            panX: pan.x,
            panY: pan.y,
            zoom,
            pitch: SKILL_GRID_PITCH,
          }),
        );
        // Do NOT touch selectedBlockIds / selectedEmptyCells — overlay only.
        onSelectiveExplanationComplete(polygon);
        return;
      }

      const ann = annotationDrawRef.current;
      if (ann && ann.pointerId === event.pointerId) {
        annotationDrawRef.current = null;
        setAnnotationDrawPreview(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (learnerMode || !canDrawOnAnnotationLayer({ learnerMode: false })) {
          return;
        }
        const dragPx = Math.hypot(
          ann.curLocal.x - ann.startLocal.x,
          ann.curLocal.y - ann.startLocal.y,
        );
        const toWorld = (p: AnnotationPoint) =>
          annotationScreenToWorld({
            localX: p.x,
            localY: p.y,
            panX: pan.x,
            panY: pan.y,
            zoom,
          });
        const existing = annotationLayers.find((l) => l.id === ann.layerId);
        if (!existing) return;

        // Eraser: remove strokes under the brush path
        if (ann.kind === "eraser") {
          if (ann.pointsLocal.length < 1 && dragPx < 1) return;
          const pointsW =
            ann.pointsLocal.length > 0
              ? ann.pointsLocal.map(toWorld)
              : [toWorld(ann.startLocal), toWorld(ann.curLocal)];
          const radius = annotationEraserRadiusForThickness(
            annotationStrokeThickness,
          );
          // Convert screen-ish radius via 1/zoom so brush matches thickness feel
          const worldRadius = radius / (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
          persistAnnotationLayers(
            upsertAnnotationLayer(
              annotationLayers,
              eraseAnnotationStrokesAlongPath(
                existing,
                pointsW,
                worldRadius,
              ),
            ),
          );
          return;
        }

        if (!isAnnotationStrokeKind(ann.kind)) return;
        if (ann.kind !== "freehand" && dragPx < 3) return;
        if (ann.kind === "freehand" && ann.pointsLocal.length < 2 && dragPx < 2) {
          return;
        }
        const startW = toWorld(ann.startLocal);
        const endW = toWorld(ann.curLocal);
        const pointsW =
          ann.kind === "freehand"
            ? ann.pointsLocal.map(toWorld)
            : undefined;
        const stroke = buildAnnotationStrokeFromGesture({
          kind: ann.kind,
          start: startW,
          end: endW,
          points: pointsW,
          strokeWidth: annotationStrokeThickness,
        });
        persistAnnotationLayers(
          upsertAnnotationLayer(
            annotationLayers,
            appendAnnotationStroke(existing, stroke),
          ),
        );
        return;
      }

      const lasso = lassoDragRef.current;
      if (lasso && lasso.pointerId === event.pointerId) {
        lassoDragRef.current = null;
        setLassoOverlay(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        const viewport = viewportRef.current;
        if (!viewport || !canEdit) return;
        const vrect = viewport.getBoundingClientRect();

        const toGridPoint = (localX: number, localY: number) =>
          clientPointToGridPoint({
            clientX: vrect.left + localX,
            clientY: vrect.top + localY,
            viewportLeft: vrect.left,
            viewportTop: vrect.top,
            panX: pan.x,
            panY: pan.y,
            zoom,
            pitch: SKILL_GRID_PITCH,
          });

        const blockInputs = nodes.map((node) => {
          const cell = placements.get(node.id);
          const span = spans.get(node.id) || {
            span_w: normalizeSpan(node.span_w),
            span_h: normalizeSpan(node.span_h),
          };
          const occupied = skillNodeOccupiedCells(node);
          return {
            id: node.id,
            row: cell?.row ?? node.position_y ?? 0,
            col: cell?.col ?? node.position_x ?? 0,
            span_w: span.span_w,
            span_h: span.span_h,
            occupiedCells: occupied,
          };
        });
        const occupiedKeys = new Set<string>(occupancy.keys());

        let hitIds: string[] = [];
        let emptyHits: GridCell[] = [];

        if (lasso.shape === "rect") {
          const dragPx = Math.hypot(lasso.curX - lasso.startX, lasso.curY - lasso.startY);
          if (dragPx < PAN_CLICK_THRESHOLD) return;
          const a = clientPointToGridCell({
            clientX: vrect.left + lasso.startX,
            clientY: vrect.top + lasso.startY,
            viewportLeft: vrect.left,
            viewportTop: vrect.top,
            panX: pan.x,
            panY: pan.y,
            zoom,
            pitch: SKILL_GRID_PITCH,
          });
          const b = clientPointToGridCell({
            clientX: vrect.left + lasso.curX,
            clientY: vrect.top + lasso.curY,
            viewportLeft: vrect.left,
            viewportTop: vrect.top,
            panX: pan.x,
            panY: pan.y,
            zoom,
            pitch: SKILL_GRID_PITCH,
          });
          const gridRect = normalizeGridSelectionRect(a, b);
          hitIds = blocksIntersectingGridRect(blockInputs, gridRect);
          emptyHits = emptyCellsIntersectingGridRect({
            rect: gridRect,
            occupiedKeys,
            unusableKeys,
            includeUnusable: true,
          });
        } else if (lasso.shape === "circle") {
          const dragPx = Math.hypot(lasso.curX - lasso.startX, lasso.curY - lasso.startY);
          if (dragPx < PAN_CLICK_THRESHOLD) return;
          const center = toGridPoint(lasso.startX, lasso.startY);
          const edge = toGridPoint(lasso.curX, lasso.curY);
          const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
          if (radius < 0.15) return;
          hitIds = blocksIntersectingCircle(blockInputs, { center, radius });
          emptyHits = emptyCellsIntersectingCircle({
            center,
            radius,
            occupiedKeys,
            unusableKeys,
            includeUnusable: true,
          });
        } else {
          // Freehand: ensure final point is recorded; require meaningful path length.
          const pts = [...lasso.points];
          const last = pts[pts.length - 1];
          if (!last || last.x !== lasso.curX || last.y !== lasso.curY) {
            pts.push({ x: lasso.curX, y: lasso.curY });
          }
          let pathPx = 0;
          for (let i = 1; i < pts.length; i++) {
            pathPx += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          }
          if (pathPx < PAN_CLICK_THRESHOLD * 2 || pts.length < 2) return;
          const polygon = pts.map((p) => toGridPoint(p.x, p.y));
          hitIds = blocksIntersectingPolygon(blockInputs, polygon);
          emptyHits = emptyCellsIntersectingPolygon({
            polygon,
            occupiedKeys,
            unusableKeys,
            includeUnusable: true,
          });
        }

        // Drop generation-locked expand-job blocks from lasso multi-select.
        if (generationLockedBlockIdsRef.current.size > 0) {
          hitIds = hitIds.filter(
            (id) => !generationLockedBlockIdsRef.current.has(id),
          );
        }

        // Blocks win over empties for all lasso shapes (rect / circle / freehand).
        const resolved = resolveLassoSelection({
          blockHits: hitIds,
          emptyHits,
        });

        const selection = nextWorkspaceMapSelection(
          resolved.mode === "empty"
            ? { type: "set_empty_cells", cells: resolved.selectedEmptyCells }
            : resolved.mode === "blocks"
              ? { type: "set_filled_ids", blockIds: resolved.selectedBlockIds }
              : { type: "clear" },
        );
        commitSelectionRef.current?.(selection, { resetChrome: selection.kind !== "empties" });
        return;
      }

      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [
      annotationLayers,
      annotationStrokeThickness,
      canEdit,
      learnerMode,
      nodes,
      occupancy,
      onSelectNode,
      onSelectiveExplanationComplete,
      pan.x,
      pan.y,
      persistAnnotationLayers,
      placements,
      selectedNodeId,
      spans,
      unusableKeys,
      zoom,
    ],
  );


  return {
    beginViewportPan,
    handlePointerDown,
    handlePointerMove,
    endDrag,
  };
}
