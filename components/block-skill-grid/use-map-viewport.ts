"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampSkillGridZoom,
  getDefaultSkillGridZoom,
  getPanToCenterCell,
  getVisibleGridCells,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
  SKILL_GRID_MAX_ZOOM,
  SKILL_GRID_MIN_ZOOM,
  SKILL_GRID_PITCH,
  type GridCell,
} from "@/lib/block-skill-grid";
import {
  buildMinimapClusterGraph,
  cellsForMinimapCluster,
  getPanZoomToOneToOneClusterView,
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
  panFromMinimapViewportDrag,
  placementsFromOccupiedCells,
  projectMinimapTiles,
  resolveMinimapViewportWindow,
  type MinimapCluster,
  type MinimapCountLabel,
  type MinimapGridCell,
} from "@/lib/map-minimap-clusters";
import { APPEAR_STAGGER_MS } from "@/components/block-skill-grid/types";

export function useMapViewport(input: {
  viewportCenterCell: GridCell;
  followCell?: GridCell | null;
  appearingNodeIds: string[];
  onAppearingComplete?: (nodeIds: string[]) => void;
  occupiedByBlockId: Map<string, GridCell[]>;
}) {
  const {
    viewportCenterCell,
    followCell = null,
    appearingNodeIds,
    onAppearingComplete,
    occupiedByBlockId,
  } = input;

  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialCenterRef = useRef(false);
  const panMovedRef = useRef(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE);
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [visibleAppearing, setVisibleAppearing] = useState<Set<string>>(new Set());

  const visibleCells = useMemo(
    () =>
      getVisibleGridCells(
        viewportSize.width,
        viewportSize.height,
        pan.x,
        pan.y,
        zoom,
      ),
    [viewportSize.width, viewportSize.height, pan.x, pan.y, zoom],
  );

  const minimapPlacements = useMemo(
    () => placementsFromOccupiedCells(occupiedByBlockId),
    [occupiedByBlockId],
  );

  const minimapGraph = useMemo(
    () => buildMinimapClusterGraph(minimapPlacements),
    [minimapPlacements],
  );

  const minimapTileView = useMemo(
    () =>
      projectMinimapTiles({
        placements: minimapPlacements,
        width: MINIMAP_FRAME_WIDTH,
        height: MINIMAP_FRAME_HEIGHT,
        padding: MINIMAP_FRAME_PADDING,
        clusters: minimapGraph.clusters,
      }),
    [minimapGraph.clusters, minimapPlacements],
  );

  const minimapViewportRect = useMemo(() => {
    return resolveMinimapViewportWindow({
      tileCount: minimapTileView.tiles.length,
      pan,
      zoom,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      bounds: minimapTileView.bounds,
      cellSize: minimapTileView.cellSize,
      width: MINIMAP_FRAME_WIDTH,
      height: MINIMAP_FRAME_HEIGHT,
      padding: MINIMAP_FRAME_PADDING,
      pitch: SKILL_GRID_PITCH,
    });
  }, [
    minimapTileView.bounds,
    minimapTileView.cellSize,
    minimapTileView.tiles.length,
    pan,
    viewportSize.height,
    viewportSize.width,
    zoom,
  ]);

  const minimapViewportDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    panStartX: number;
    panStartY: number;
  } | null>(null);

  const onMinimapViewportPointerDown = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      event.stopPropagation();
      event.preventDefault();
      const target = event.currentTarget;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      minimapViewportDragRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
    },
    [pan.x, pan.y],
  );

  const onMinimapViewportPointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      const drag = minimapViewportDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation();
      event.preventDefault();
      const cellSize = minimapTileView.cellSize;
      if (!(cellSize > 0)) return;
      const deltaX = event.clientX - drag.startClientX;
      const deltaY = event.clientY - drag.startClientY;
      const next = panFromMinimapViewportDrag({
        pan: { x: drag.panStartX, y: drag.panStartY },
        zoom,
        deltaX,
        deltaY,
        cellSize,
        pitch: SKILL_GRID_PITCH,
      });
      setPan(next);
    },
    [minimapTileView.cellSize, zoom],
  );

  const onMinimapViewportPointerUp = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      const drag = minimapViewportDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation();
      minimapViewportDragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const panToMinimapCell = useCallback((cell: MinimapGridCell) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { width, height } = viewport.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const cam = getPanZoomToOneToOneClusterView({
      viewportWidth: width,
      viewportHeight: height,
      cells: [cell],
      oneToOneZoom: 1,
      pitch: SKILL_GRID_PITCH,
      cellSize: SKILL_GRID_CELL_SIZE,
      minZoom: SKILL_GRID_MIN_ZOOM,
      maxZoom: SKILL_GRID_MAX_ZOOM,
    });
    setZoom(cam.zoom);
    setPan(cam.pan);
  }, []);

  const panToCluster = useCallback(
    (cluster: MinimapCluster | MinimapCountLabel) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const full: MinimapCluster | undefined =
        "blockIds" in cluster && Array.isArray((cluster as MinimapCluster).blockIds)
          ? (cluster as MinimapCluster)
          : minimapGraph.clusters.find(
              (c) =>
                c.id === (cluster as MinimapCountLabel).clusterId ||
                c.centerBlockId === cluster.centerBlockId,
            );

      const cells = cellsForMinimapCluster(
        minimapPlacements,
        full || {
          blockIds: cluster.centerBlockId ? [cluster.centerBlockId] : [],
          centerCell: cluster.centerCell,
          centerBlockId: cluster.centerBlockId,
        },
      );

      const cam = getPanZoomToOneToOneClusterView({
        viewportWidth: width,
        viewportHeight: height,
        cells,
        oneToOneZoom: 1,
        pitch: SKILL_GRID_PITCH,
        cellSize: SKILL_GRID_CELL_SIZE,
        minZoom: SKILL_GRID_MIN_ZOOM,
        maxZoom: SKILL_GRID_MAX_ZOOM,
      });
      setZoom(cam.zoom);
      setPan(cam.pan);
    },
    [minimapGraph.clusters, minimapPlacements],
  );

  const applyCenterOnStart = useCallback(
    (nextZoom = zoom) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setPan(getPanToCenterCell(width, height, viewportCenterCell, nextZoom));
    },
    [viewportCenterCell, zoom],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setViewportSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0 || hasInitialCenterRef.current) {
      return;
    }
    const initialZoom = getDefaultSkillGridZoom(viewportSize.width, viewportSize.height);
    setZoom(initialZoom);
    setPan(
      getPanToCenterCell(
        viewportSize.width,
        viewportSize.height,
        viewportCenterCell,
        initialZoom,
      ),
    );
    hasInitialCenterRef.current = true;
  }, [viewportSize.width, viewportSize.height, viewportCenterCell]);

  useEffect(() => {
    if (!followCell || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    setPan((current) => {
      const next = getPanToCenterCell(
        viewportSize.width,
        viewportSize.height,
        followCell,
        zoom,
      );
      if (current.x === next.x && current.y === next.y) return current;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followCell?.row, followCell?.col, viewportSize.width, viewportSize.height]);

  const appearingKey = appearingNodeIds.join("\0");
  const onAppearingCompleteRef = useRef(onAppearingComplete);
  onAppearingCompleteRef.current = onAppearingComplete;

  useEffect(() => {
    if (!appearingKey) {
      setVisibleAppearing((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const ids = appearingKey.split("\0").filter(Boolean);
    setVisibleAppearing(new Set());
    const timers: ReturnType<typeof setTimeout>[] = [];
    ids.forEach((id, index) => {
      timers.push(
        setTimeout(() => {
          setVisibleAppearing((prev) => new Set(prev).add(id));
        }, index * APPEAR_STAGGER_MS),
      );
    });
    const done = setTimeout(() => {
      onAppearingCompleteRef.current?.(ids);
    }, ids.length * APPEAR_STAGGER_MS + 420);
    timers.push(done);
    return () => timers.forEach(clearTimeout);
  }, [appearingKey]);

  const recenter = useCallback(() => {
    const nextZoom = getDefaultSkillGridZoom(viewportSize.width, viewportSize.height);
    setZoom(nextZoom);
    applyCenterOnStart(nextZoom);
  }, [applyCenterOnStart, viewportSize.width, viewportSize.height]);

  const zoomBy = useCallback(
    (factor: number, focalX?: number, focalY?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const anchorX = focalX ?? rect.width / 2;
      const anchorY = focalY ?? rect.height / 2;
      const nextZoom = clampSkillGridZoom(zoom * factor);
      const ratio = nextZoom / zoom;

      setPan((current) => ({
        x: anchorX - (anchorX - current.x) * ratio,
        y: anchorY - (anchorY - current.y) * ratio,
      }));
      setZoom(nextZoom);
    },
    [zoom],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      zoomBy(delta, event.clientX - rect.left, event.clientY - rect.top);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!spaceHeldRef.current) {
        spaceHeldRef.current = true;
        setSpaceHeld(true);
      }
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return {
    viewportRef,
    hasInitialCenterRef,
    panMovedRef,
    viewportSize,
    setViewportSize,
    pan,
    setPan,
    zoom,
    setZoom,
    spaceHeldRef,
    spaceHeld,
    setSpaceHeld,
    visibleAppearing,
    setVisibleAppearing,
    visibleCells,
    minimapPlacements,
    minimapGraph,
    minimapTileView,
    minimapViewportRect,
    onMinimapViewportPointerDown,
    onMinimapViewportPointerMove,
    onMinimapViewportPointerUp,
    panToMinimapCell,
    panToCluster,
    applyCenterOnStart,
    recenter,
    zoomBy,
  };
}
