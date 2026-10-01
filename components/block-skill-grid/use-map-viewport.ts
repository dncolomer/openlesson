"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fitWorldRectCamera,
  skillGridZoomFloor,
  getDefaultSkillGridZoom,
  getPanToCenterCell,
  getVisibleGridCells,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
  SKILL_GRID_MAX_ZOOM,
  SKILL_GRID_MIN_ZOOM,
  SKILL_GRID_PITCH,
  type GridCell,
  type SkillGridCameraInsets,
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
  defaultZoomAtReference?: number;
  gridPitch?: number;
  gridCellSize?: number;
  /** When set, the opening camera fits this world rectangle instead of the reference zoom. */
  fitBoard?: boolean;
  fitMinX?: number | null;
  fitMinY?: number | null;
  fitWidth?: number | null;
  fitHeight?: number | null;
  fitInsets?: SkillGridCameraInsets;
}) {
  const {
    viewportCenterCell,
    followCell = null,
    appearingNodeIds,
    onAppearingComplete,
    occupiedByBlockId,
    defaultZoomAtReference = SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
    gridPitch = SKILL_GRID_PITCH,
    gridCellSize = SKILL_GRID_CELL_SIZE,
    fitBoard = false,
    fitMinX = null,
    fitMinY = null,
    fitWidth = null,
    fitHeight = null,
    fitInsets,
  } = input;

  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialCenterRef = useRef(false);
  const panMovedRef = useRef(false);
  const userAdjustedCameraRef = useRef(false);
  const fittedZoomRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPanState] = useState({ x: 0, y: 0 });
  const setPan = useCallback(
    (
      next:
        | { x: number; y: number }
        | ((prev: { x: number; y: number }) => { x: number; y: number }),
    ) => {
      userAdjustedCameraRef.current = true;
      setPanState(next);
    },
    [],
  );
  const [zoom, setZoom] = useState(defaultZoomAtReference);
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
        2,
        gridPitch,
      ),
    [viewportSize.width, viewportSize.height, pan.x, pan.y, zoom, gridPitch],
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
      pitch: gridPitch,
    });
  }, [
    gridPitch,
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
        pitch: gridPitch,
      });
      setPan(next);
    },
    [gridPitch, minimapTileView.cellSize, zoom],
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
      pitch: gridPitch,
      cellSize: gridCellSize,
      minZoom: SKILL_GRID_MIN_ZOOM,
      maxZoom: SKILL_GRID_MAX_ZOOM,
    });
    setZoom(cam.zoom);
    setPan(cam.pan);
  }, [gridCellSize, gridPitch]);

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
        pitch: gridPitch,
        cellSize: gridCellSize,
        minZoom: SKILL_GRID_MIN_ZOOM,
        maxZoom: SKILL_GRID_MAX_ZOOM,
      });
      setZoom(cam.zoom);
      setPan(cam.pan);
    },
    [gridCellSize, gridPitch, minimapGraph.clusters, minimapPlacements],
  );

  const applyCenterOnStart = useCallback(
    (nextZoom = zoom) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setPanState(getPanToCenterCell(width, height, viewportCenterCell, nextZoom, gridPitch, gridCellSize));
    },
    [gridCellSize, gridPitch, viewportCenterCell, zoom],
  );

  const applyBoardFit = useCallback(
    (width: number, height: number) => {
      if (
        !fitBoard ||
        fitMinX == null ||
        fitMinY == null ||
        fitWidth == null ||
        fitHeight == null
      ) {
        return false;
      }
      const cam = fitWorldRectCamera({
        viewportWidth: width,
        viewportHeight: height,
        minX: fitMinX,
        minY: fitMinY,
        width: fitWidth,
        height: fitHeight,
        insets: fitInsets,
        maxZoom: SKILL_GRID_MAX_ZOOM,
      });
      if (!cam) return false;
      fittedZoomRef.current = cam.zoom;
      setZoom((current) => (current === cam.zoom ? current : cam.zoom));
      setPanState((current) =>
        current.x === cam.pan.x && current.y === cam.pan.y ? current : cam.pan,
      );
      hasInitialCenterRef.current = true;
      return true;
    },
    [fitBoard, fitHeight, fitInsets, fitMinX, fitMinY, fitWidth],
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
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
    if (userAdjustedCameraRef.current) return;
    if (applyBoardFit(viewportSize.width, viewportSize.height)) return;
    if (fitBoard) return;
    if (hasInitialCenterRef.current) return;
    const initialZoom = getDefaultSkillGridZoom(
      viewportSize.width,
      viewportSize.height,
      defaultZoomAtReference,
    );
    setZoom(initialZoom);
    setPanState(
      getPanToCenterCell(
        viewportSize.width,
        viewportSize.height,
        viewportCenterCell,
        initialZoom,
        gridPitch,
        gridCellSize,
      ),
    );
    hasInitialCenterRef.current = true;
  }, [
    applyBoardFit,
    defaultZoomAtReference,
    fitBoard,
    gridCellSize,
    gridPitch,
    viewportCenterCell,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    if (!followCell || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    setPanState((current) => {
      const next = getPanToCenterCell(
        viewportSize.width,
        viewportSize.height,
        followCell,
        zoom,
        gridPitch,
        gridCellSize,
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
    userAdjustedCameraRef.current = false;
    if (applyBoardFit(viewportSize.width, viewportSize.height)) return;
    const nextZoom = getDefaultSkillGridZoom(
      viewportSize.width,
      viewportSize.height,
      defaultZoomAtReference,
    );
    setZoom(nextZoom);
    applyCenterOnStart(nextZoom);
  }, [
    applyBoardFit,
    applyCenterOnStart,
    defaultZoomAtReference,
    viewportSize.height,
    viewportSize.width,
  ]);

  const zoomBy = useCallback(
    (factor: number, focalX?: number, focalY?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const anchorX = focalX ?? rect.width / 2;
      const anchorY = focalY ?? rect.height / 2;
      const nextZoom = Math.min(
        SKILL_GRID_MAX_ZOOM,
        Math.max(skillGridZoomFloor(fittedZoomRef.current), zoom * factor),
      );
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
