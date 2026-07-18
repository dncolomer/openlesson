"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSkillGridLayout,
  clampSkillGridZoom,
  formatGridCoordinate,
  getDefaultSkillGridZoom,
  getPanToCenterCell,
  getVisibleGridCells,
  getWeightedNeighborhood,
  isCellOccupied,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
  SKILL_GRID_GAP,
  SKILL_GRID_PITCH,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import { footprintFromCells, normalizeSpan } from "@/lib/skill-grid-ops";
import { DEFAULT_MODEL } from "@/lib/xai-models";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;
const APPEAR_STAGGER_MS = 140;

interface BlockSkillGridProps {
  nodes: SkillGridNode[];
  selectedNodeId: string | null;
  /** Loaded / focused node (e.g. active chapter) — amber ring in chapter mode. */
  focusedNodeId?: string | null;
  onSelectNode: (blockId: string) => void;
  canEdit: boolean;
  showProgress?: boolean;
  isAdding?: boolean;
  workspaceId?: string;
  sessionId?: string;
  ayclToken?: string;
  suggestMode?: "block" | "chapter";
  locale?: string;
  /** Override recenter + initial viewport target (defaults to start block). */
  recenterCell?: GridCell | null;
  /** Pan to this cell when it changes (e.g. after loading a chapter). */
  followCell?: GridCell | null;
  onAddBlock: (prompt: string, position: { row: number; col: number }) => Promise<void>;
  /** Multi-select / multi-cell / merge / split / move ops (workspace builder). */
  onGridOp?: (payload: {
    op: "generate_shape" | "merge" | "split" | "move" | "update_block";
    prompt?: string;
    cells?: Array<{ row: number; col: number }>;
    blockIds?: string[];
    dRow?: number;
    dCol?: number;
    blockId?: string;
    title?: string;
    description?: string;
  }) => Promise<{ updatedNodes?: SkillGridNode[]; placedNodeId?: string; appearSequentially?: boolean } | void>;
  /** Block ids that should play entrance animation (staggered). */
  appearingNodeIds?: string[];
  onAppearingComplete?: (nodeIds: string[]) => void;
  labels: {
    emptyCell: string;
    addTitle: string;
    addPlaceholder: string;
    addSubmit: string;
    addCancel: string;
    suggestTopics: string;
    suggesting: string;
    suggestError: string;
    recenter: string;
    zoomIn: string;
    zoomOut: string;
    merge?: string;
    split?: string;
    move?: string;
    generateShape?: string;
    editBlock?: string;
    clearSelection?: string;
    multiSelectHint?: string;
  };
}

const PAN_CLICK_THRESHOLD = 6;

function cellStatusClass(status: string, selected: boolean, focused: boolean, showProgress: boolean) {
  const base = selected
    ? "ring-2 ring-white/50 ring-offset-2 ring-offset-[#0b0b0b] "
    : focused
      ? "ring-2 ring-amber-400/55 ring-offset-2 ring-offset-[#0b0b0b] "
      : "";
  if (!showProgress) {
    return `${base}border-neutral-700/80 bg-neutral-950/75 text-neutral-200`;
  }
  if (status === "completed") {
    return `${base}border-emerald-500/50 bg-emerald-950/40 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.15)]`;
  }
  if (status === "in_progress") {
    return `${base}border-amber-400/55 bg-amber-950/35 text-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.14)]`;
  }
  if (status === "locked") {
    return `${base}border-neutral-800 bg-neutral-950/50 text-neutral-500 opacity-70`;
  }
  return `${base}border-neutral-700/80 bg-neutral-950/75 text-neutral-100`;
}

function cellKey(cell: GridCell) {
  return `${cell.row}:${cell.col}`;
}

export function BlockSkillGrid({
  nodes,
  selectedNodeId,
  focusedNodeId = null,
  onSelectNode,
  canEdit,
  showProgress = true,
  isAdding = false,
  workspaceId,
  sessionId,
  ayclToken,
  suggestMode = "block",
  locale = "en",
  recenterCell = null,
  followCell = null,
  onAddBlock,
  onGridOp,
  appearingNodeIds = [],
  onAppearingComplete,
  labels,
}: BlockSkillGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialCenterRef = useRef(false);
  const panMovedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panStartX: number;
    panStartY: number;
  } | null>(null);

  const [pendingCell, setPendingCell] = useState<GridCell | null>(null);
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE);

  // Multi-select
  const [selectedEmptyCells, setSelectedEmptyCells] = useState<GridCell[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [shapePromptOpen, setShapePromptOpen] = useState(false);
  const [mergePromptOpen, setMergePromptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [visibleAppearing, setVisibleAppearing] = useState<Set<string>>(new Set());

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const { occupancy, placements, spans, startCell } = useMemo(
    () => buildSkillGridLayout(nodes),
    [nodes],
  );
  const canSuggest =
    suggestMode === "chapter" ? Boolean(sessionId) : Boolean(workspaceId);
  const viewportCenterCell = recenterCell ?? startCell;
  const busy = isAdding || localBusy;

  const visibleCells = useMemo(
    () => getVisibleGridCells(viewportSize.width, viewportSize.height, pan.x, pan.y, zoom),
    [viewportSize.width, viewportSize.height, pan.x, pan.y, zoom],
  );

  // Render anchors only once per multi-cell block
  const renderedBlockIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of nodes) {
      if (placements.has(node.id)) ids.add(node.id);
    }
    return ids;
  }, [nodes, placements]);

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
    if (viewportSize.width <= 0 || viewportSize.height <= 0 || hasInitialCenterRef.current) return;
    const initialZoom = getDefaultSkillGridZoom(viewportSize.width, viewportSize.height);
    setZoom(initialZoom);
    setPan(getPanToCenterCell(viewportSize.width, viewportSize.height, viewportCenterCell, initialZoom));
    hasInitialCenterRef.current = true;
  }, [viewportSize.width, viewportSize.height, viewportCenterCell]);

  useEffect(() => {
    if (!followCell || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    setPan((current) => {
      const next = getPanToCenterCell(viewportSize.width, viewportSize.height, followCell, zoom);
      if (current.x === next.x && current.y === next.y) return current;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followCell?.row, followCell?.col, viewportSize.width, viewportSize.height]);

  // Sequential appear animation for AI-added blocks
  useEffect(() => {
    if (!appearingNodeIds.length) {
      setVisibleAppearing(new Set());
      return;
    }
    setVisibleAppearing(new Set());
    const timers: ReturnType<typeof setTimeout>[] = [];
    appearingNodeIds.forEach((id, index) => {
      timers.push(
        setTimeout(() => {
          setVisibleAppearing((prev) => new Set(prev).add(id));
        }, index * APPEAR_STAGGER_MS),
      );
    });
    const done = setTimeout(() => {
      onAppearingComplete?.(appearingNodeIds);
    }, appearingNodeIds.length * APPEAR_STAGGER_MS + 420);
    timers.push(done);
    return () => timers.forEach(clearTimeout);
  }, [appearingNodeIds, onAppearingComplete]);

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

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || pendingCell || shapePromptOpen || mergePromptOpen || editOpen) return;
      if ((event.target as HTMLElement).closest("[data-skill-cell]")) return;

      panMovedRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panStartX: pan.x,
        panStartY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y, pendingCell, shapePromptOpen, mergePromptOpen, editOpen],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!panMovedRef.current && Math.abs(dx) <= PAN_CLICK_THRESHOLD && Math.abs(dy) <= PAN_CLICK_THRESHOLD) {
      return;
    }

    panMovedRef.current = true;
    setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEmptyCells([]);
    setSelectedBlockIds([]);
    setShapePromptOpen(false);
    setMergePromptOpen(false);
    setEditOpen(false);
    setPrompt("");
  }, []);

  const handleCellSelect = useCallback(
    (blockId: string, event: React.MouseEvent) => {
      if (canEdit && (event.metaKey || event.ctrlKey || event.shiftKey)) {
        event.preventDefault();
        setSelectedEmptyCells([]);
        setSelectedBlockIds((prev) =>
          prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId],
        );
        return;
      }
      if (selectedBlockIds.length > 0 || selectedEmptyCells.length > 0) {
        // plain click while multi-selecting focuses single
        setSelectedEmptyCells([]);
        setSelectedBlockIds([blockId]);
      }
      onSelectNode(blockId);
    },
    [canEdit, onSelectNode, selectedBlockIds.length, selectedEmptyCells.length],
  );

  const handleEmptyCellClick = useCallback(
    (cell: GridCell, event: React.MouseEvent) => {
      if (!canEdit || busy) return;
      if (isCellOccupied(occupancy, cell.row, cell.col)) return;

      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        event.preventDefault();
        setSelectedBlockIds([]);
        setSelectedEmptyCells((prev) => {
          const key = cellKey(cell);
          if (prev.some((c) => cellKey(c) === key)) {
            return prev.filter((c) => cellKey(c) !== key);
          }
          return [...prev, cell];
        });
        return;
      }

      // If already multi-selecting empties, toggle without meta
      if (selectedEmptyCells.length > 0) {
        setSelectedBlockIds([]);
        setSelectedEmptyCells((prev) => {
          const key = cellKey(cell);
          if (prev.some((c) => cellKey(c) === key)) {
            return prev.filter((c) => cellKey(c) !== key);
          }
          return [...prev, cell];
        });
        return;
      }

      setAddError(null);
      setPendingCell(cell);
    },
    [busy, canEdit, occupancy, selectedEmptyCells.length],
  );

  useEffect(() => {
    if (pendingCell) return;
    setSuggestions([]);
    setSuggestError(null);
    setIsSuggesting(false);
  }, [pendingCell]);

  const pendingWeightedNeighbors = useMemo(() => {
    if (!pendingCell) return [];
    return getWeightedNeighborhood(pendingCell, placements, nodesById);
  }, [nodesById, pendingCell, placements]);

  const shapeFootprint = useMemo(
    () => (selectedEmptyCells.length > 0 ? footprintFromCells(selectedEmptyCells) : null),
    [selectedEmptyCells],
  );

  const handleSuggestTopics = useCallback(async () => {
    if (!canSuggest || !pendingCell || isSuggesting) return;

    const savedModel =
      typeof window !== "undefined"
        ? window.localStorage.getItem(MODEL_STORAGE_KEY)?.replace(/^x-ai\//, "")
        : null;
    const model = savedModel || DEFAULT_PLANNER_MODEL;

    setIsSuggesting(true);
    setSuggestError(null);
    try {
      const response = await fetch("/api/workspace/suggest-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          sessionId,
          mode: suggestMode,
          row: pendingCell.row,
          col: pendingCell.col,
          weightedNeighbors: pendingWeightedNeighbors,
          model,
          locale,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || labels.suggestError);
      }

      const data = (await response.json()) as { suggestions?: string[] };
      setSuggestions((data.suggestions || []).filter(Boolean).slice(0, 3));
    } catch (error) {
      console.error("Failed to suggest block topics:", error);
      setSuggestions([]);
      setSuggestError(error instanceof Error ? error.message : labels.suggestError);
    } finally {
      setIsSuggesting(false);
    }
  }, [
    canSuggest,
    isSuggesting,
    labels.suggestError,
    locale,
    pendingCell,
    pendingWeightedNeighbors,
    ayclToken,
    workspaceId,
    sessionId,
    suggestMode,
  ]);

  const submitAdd = async () => {
    if (!pendingCell || !prompt.trim() || busy) return;
    if (isCellOccupied(occupancy, pendingCell.row, pendingCell.col)) {
      setAddError("That grid slot is already occupied.");
      return;
    }
    setAddError(null);
    try {
      await onAddBlock(prompt.trim(), pendingCell);
      setPrompt("");
      setPendingCell(null);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add item");
    }
  };

  const runGridOp = async (
    payload: Parameters<NonNullable<typeof onGridOp>>[0],
  ) => {
    if (!onGridOp || busy) return;
    setLocalBusy(true);
    setAddError(null);
    try {
      await onGridOp(payload);
      clearSelection();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Grid operation failed");
    } finally {
      setLocalBusy(false);
    }
  };

  const openEditSelected = () => {
    const id = selectedBlockIds[0] || selectedNodeId;
    if (!id) return;
    const node = nodesById.get(id);
    if (!node) return;
    setEditTitle(node.title);
    setEditDescription(node.description || "");
    setEditOpen(true);
    if (!selectedBlockIds.includes(id)) setSelectedBlockIds([id]);
  };

  if (nodes.length === 0 && !canEdit) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-600">{labels.emptyCell}</div>;
  }

  const multiToolbarVisible =
    canEdit &&
    (selectedEmptyCells.length > 0 || selectedBlockIds.length > 0) &&
    !pendingCell &&
    !shapePromptOpen &&
    !mergePromptOpen &&
    !editOpen;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800/60 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),rgba(8,8,8,0.98))]">
      {busy && (
        <div className="pointer-events-none absolute inset-0 z-[15] backdrop-blur-[2px] bg-black/20 transition-all duration-500" />
      )}
      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: `${SKILL_GRID_PITCH}px ${SKILL_GRID_PITCH}px`,
            transform: `translate(${pan.x % SKILL_GRID_PITCH}px, ${pan.y % SKILL_GRID_PITCH}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        />

        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Empty cells + selection highlights */}
          {visibleCells.map((cell) => {
            const blockId = occupancy.get(`${cell.row}:${cell.col}`);
            if (blockId) return null;
            const selectedEmpty = selectedEmptyCells.some(
              (c) => c.row === cell.row && c.col === cell.col,
            );
            return (
              <div
                key={`empty-${cell.row}:${cell.col}`}
                data-skill-cell
                className="absolute"
                style={{
                  left: cell.col * SKILL_GRID_PITCH,
                  top: cell.row * SKILL_GRID_PITCH,
                  width: SKILL_GRID_CELL_SIZE,
                  height: SKILL_GRID_CELL_SIZE,
                }}
              >
                <button
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={(e) => handleEmptyCellClick(cell, e)}
                  className={`flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed text-neutral-600 transition ${
                    selectedEmpty
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100 ring-2 ring-cyan-400/40"
                      : canEdit
                        ? "border-neutral-700/90 bg-neutral-950/35 hover:border-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300"
                        : "border-neutral-800/70 bg-neutral-950/20 opacity-50"
                  }`}
                  title={canEdit ? labels.emptyCell : undefined}
                >
                  {canEdit && <span className="text-xl leading-none text-neutral-600">+</span>}
                </button>
              </div>
            );
          })}

          {/* Occupied blocks (anchor only, may span multiple cells) */}
          {[...renderedBlockIds].map((blockId) => {
            const node = nodesById.get(blockId);
            const nodeCell = placements.get(blockId);
            if (!node || !nodeCell) return null;
            const span = spans.get(blockId) || {
              span_w: normalizeSpan(node.span_w),
              span_h: normalizeSpan(node.span_h),
            };
            const width =
              span.span_w * SKILL_GRID_CELL_SIZE + (span.span_w - 1) * SKILL_GRID_GAP;
            const height =
              span.span_h * SKILL_GRID_CELL_SIZE + (span.span_h - 1) * SKILL_GRID_GAP;
            const multiSelected = selectedBlockIds.includes(node.id);
            const isAppearingTarget = appearingNodeIds.includes(node.id);
            const appeared = !isAppearingTarget || visibleAppearing.has(node.id);

            return (
              <div
                key={`block-${node.id}`}
                data-skill-cell
                className="absolute"
                style={{
                  left: nodeCell.col * SKILL_GRID_PITCH,
                  top: nodeCell.row * SKILL_GRID_PITCH,
                  width,
                  height,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => handleCellSelect(node.id, e)}
                  className={`relative flex h-full w-full flex-col items-center justify-center rounded-lg border px-2 text-center transition hover:brightness-110 ${cellStatusClass(
                    node.status,
                    selectedNodeId === node.id || multiSelected,
                    focusedNodeId === node.id,
                    showProgress,
                  )} ${multiSelected ? "ring-2 ring-cyan-400/60" : ""} ${
                    isAppearingTarget
                      ? appeared
                        ? "opacity-100 scale-100 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                        : "opacity-0 scale-95"
                      : ""
                  }`}
                  style={{
                    transition: isAppearingTarget
                      ? "opacity 380ms ease, transform 380ms ease, box-shadow 380ms ease"
                      : undefined,
                  }}
                  title={node.title}
                >
                  <span className="absolute left-1.5 top-1 font-mono text-[9px] text-neutral-500">
                    {formatGridCoordinate(nodeCell.row, nodeCell.col)}
                    {(span.span_w > 1 || span.span_h > 1) && (
                      <span className="text-neutral-600"> · {span.span_w}×{span.span_h}</span>
                    )}
                  </span>
                  {node.is_start && (
                    <span className="absolute right-1.5 top-1 text-[8px] uppercase tracking-[0.12em] text-neutral-400">
                      Start
                    </span>
                  )}
                  <span className="line-clamp-3 text-[11px] font-medium leading-tight">{node.title}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => zoomBy(1.15)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-700/80 bg-neutral-950/85 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white"
            title={labels.zoomIn}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.87)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-700/80 bg-neutral-950/85 text-sm text-neutral-300 transition hover:border-neutral-600 hover:text-white"
            title={labels.zoomOut}
          >
            −
          </button>
          <button
            type="button"
            onClick={recenter}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-700/80 bg-neutral-950/85 text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            title={labels.recenter}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8M4 12a8 8 0 1016 0 8 8 0 00-16 0z" />
            </svg>
          </button>
        </div>

        {canEdit && (
          <div className="pointer-events-none absolute left-2 bottom-2 z-10 max-w-[min(100%,18rem)] rounded-md border border-neutral-800/80 bg-neutral-950/80 px-2 py-1 text-[10px] text-neutral-500">
            {labels.multiSelectHint || "Shift/⌘-click cells or blocks to multi-select"}
          </div>
        )}
      </div>

      {multiToolbarVisible && (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 p-2 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedEmptyCells.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setShapePromptOpen(true)}
                className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
              >
                {labels.generateShape || "Generate in shape"} ({selectedEmptyCells.length})
              </button>
            )}
            {selectedBlockIds.length >= 2 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setMergePromptOpen(true)}
                className="rounded-md border border-neutral-600 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 hover:border-neutral-400 disabled:opacity-40"
              >
                {labels.merge || "Merge"} ({selectedBlockIds.length})
              </button>
            )}
            {selectedBlockIds.length >= 1 && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runGridOp({ op: "split", blockIds: selectedBlockIds })
                  }
                  className="rounded-md border border-neutral-600 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 hover:border-neutral-400 disabled:opacity-40"
                >
                  {labels.split || "Split"}
                </button>
                <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-1.5 py-1">
                  <span className="px-1 text-[10px] uppercase tracking-wide text-neutral-500">
                    {labels.move || "Move"}
                  </span>
                  {(
                    [
                      ["↑", -1, 0],
                      ["↓", 1, 0],
                      ["←", 0, -1],
                      ["→", 0, 1],
                    ] as const
                  ).map(([label, dr, dc]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runGridOp({
                          op: "move",
                          blockIds: selectedBlockIds,
                          dRow: dr,
                          dCol: dc,
                        })
                      }
                      className="flex h-6 w-6 items-center justify-center rounded text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selectedBlockIds.length === 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={openEditSelected}
                    className="rounded-md border border-neutral-600 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 hover:border-neutral-400 disabled:opacity-40"
                  >
                    {labels.editBlock || "Edit"}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto rounded-md px-2 py-1.5 text-xs text-neutral-400 hover:text-white"
            >
              {labels.clearSelection || "Clear"}
            </button>
          </div>
          {addError && <p className="mt-1.5 text-xs text-red-400/90">{addError}</p>}
          {shapeFootprint && selectedEmptyCells.length > 0 && (
            <p className="mt-1 text-[10px] text-neutral-500">
              Shape {shapeFootprint.span_w}×{shapeFootprint.span_h} at{" "}
              {formatGridCoordinate(shapeFootprint.position_y, shapeFootprint.position_x)}
            </p>
          )}
        </div>
      )}

      {pendingCell && (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl shadow-black/50">
            <h3 className="text-sm font-medium text-white">{labels.addTitle}</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              Slot {formatGridCoordinate(pendingCell.row, pendingCell.col)}
            </p>
            {pendingWeightedNeighbors.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Influenced by
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {pendingWeightedNeighbors.slice(0, 3).map((entry) => (
                    <div
                      key={entry.id}
                      title={entry.title}
                      className="flex min-h-[4.5rem] flex-col rounded-lg border border-neutral-700/80 bg-neutral-900/70 px-2 py-1.5 shadow-sm shadow-black/30"
                    >
                      <span className="font-mono text-[9px] text-neutral-500">
                        {formatGridCoordinate(entry.row, entry.col)}
                        <span className="text-neutral-600"> · d{entry.distance}</span>
                      </span>
                      <span className="mt-1 line-clamp-3 text-[10px] font-medium leading-snug text-neutral-200">
                        {entry.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={!canSuggest || isSuggesting || busy}
                onClick={() => void handleSuggestTopics()}
                className="rounded-md border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
              >
                {isSuggesting ? labels.suggesting : labels.suggestTopics}
              </button>
            </div>
            {suggestError && <p className="mt-2 text-xs text-red-400/90">{suggestError}</p>}
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setPrompt(suggestion)}
                    className="rounded-md border border-neutral-700/80 bg-neutral-900/60 px-2.5 py-2 text-left text-xs text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={labels.addPlaceholder}
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingCell(null);
                  setPrompt("");
                  setSuggestions([]);
                  setSuggestError(null);
                }}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                disabled={!prompt.trim() || busy}
                onClick={() => void submitAdd()}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                {busy ? "..." : labels.addSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {shapePromptOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl">
            <h3 className="text-sm font-medium text-white">
              {labels.generateShape || "Generate block in shape"}
            </h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              {shapeFootprint
                ? `${shapeFootprint.span_w}×${shapeFootprint.span_h} at ${formatGridCoordinate(shapeFootprint.position_y, shapeFootprint.position_x)}`
                : `${selectedEmptyCells.length} cells`}
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={labels.addPlaceholder}
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShapePromptOpen(false);
                  setPrompt("");
                }}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                disabled={!prompt.trim() || busy}
                onClick={() =>
                  void runGridOp({
                    op: "generate_shape",
                    prompt: prompt.trim(),
                    cells: selectedEmptyCells,
                  })
                }
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                {busy ? "..." : labels.addSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {mergePromptOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl">
            <h3 className="text-sm font-medium text-white">{labels.merge || "Merge blocks"}</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              Merging {selectedBlockIds.length} blocks into one larger geometric topic
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional guidance for the merged topic..."
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setMergePromptOpen(false);
                  setPrompt("");
                }}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runGridOp({
                    op: "merge",
                    prompt: prompt.trim() || undefined,
                    blockIds: selectedBlockIds,
                  })
                }
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                {busy ? "..." : labels.merge || "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && selectedBlockIds[0] && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl">
            <h3 className="text-sm font-medium text-white">{labels.editBlock || "Edit block"}</h3>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-3 w-full rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none"
              placeholder="Title"
              autoFocus
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mt-2 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={4}
              placeholder="Description"
            />
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                disabled={!editTitle.trim() || busy}
                onClick={() =>
                  void runGridOp({
                    op: "update_block",
                    blockId: selectedBlockIds[0],
                    title: editTitle.trim(),
                    description: editDescription,
                  })
                }
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                {busy ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
