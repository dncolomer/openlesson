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
  skillNodeOccupiedCells,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE,
  SKILL_GRID_GAP,
  SKILL_GRID_PITCH,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  areBlocksContiguous,
  footprintFromCells,
  freeformCellExternalEdges,
  freeformLabelCell,
  freeformShapeKeySet,
  freeformTilePixelSize,
  normalizeSpan,
  selectionIsFreeformLectureShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import {
  DEFAULT_BLOCK_MAP_MODE,
  blockDragMoveDelta,
  clientPointToGridCell,
  isBlockMapManipulationMode,
  isBlockMapToolEnabled,
  isEmptyCellMultiSelectGesture,
  isMultiCellBlockSpan,
  nextActiveModeTool,
  toggleOrReplaceBlockSelection,
  visibleBlockMapTools,
  type BlockMapModeTool,
  type BlockMapToolEnablementInput,
  type BlockMapToolId,
} from "@/lib/block-map-tools";
import { DEFAULT_MODEL } from "@/lib/xai-models";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;
const APPEAR_STAGGER_MS = 140;
/** Stable default — a fresh `[]` each render would re-fire the appear effect forever. */
const EMPTY_APPEARING_NODE_IDS: string[] = [];

interface BlockSkillGridProps {
  nodes: SkillGridNode[];
  selectedNodeId: string | null;
  /** Loaded / focused node (e.g. active chapter) — amber ring in chapter mode. */
  focusedNodeId?: string | null;
  /** Focus / open block detail. Null clears focus (e.g. Select mode closes TAP/ILE drawer). */
  onSelectNode: (blockId: string | null) => void;
  canEdit: boolean;
  showProgress?: boolean;
  isAdding?: boolean;
  workspaceId?: string;
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
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
    select?: string;
    merge?: string;
    split?: string;
    move?: string;
    generateShape?: string;
    editBlock?: string;
    clearSelection?: string;
    multiSelectHint?: string;
  };
}

function toolTooltip(id: BlockMapToolId, labels: BlockSkillGridProps["labels"]): string {
  switch (id) {
    case "select":
      return labels.select || "Select";
    case "move":
      return labels.move || "Move";
    case "merge":
      return labels.merge || "Merge";
    case "split":
      return labels.split || "Split";
    case "edit":
      return labels.editBlock || "Edit block";
    case "generate_shape":
      return labels.generateShape || "Generate in shape";
    case "clear_selection":
      return labels.clearSelection || "Clear selection";
    case "zoom_in":
      return labels.zoomIn;
    case "zoom_out":
      return labels.zoomOut;
    case "recenter":
      return labels.recenter;
    default:
      return id;
  }
}

function ToolIcon({ id }: { id: BlockMapToolId }) {
  const common = "h-4 w-4";
  switch (id) {
    case "select":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M4.5 3.5l13 6.2-5.4 2.1-2.1 5.4L4.5 3.5z" />
        </svg>
      );
    case "move":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M7 7l-4 5 4 5M17 7l4 5-4 5M7 17l5 4 5-4M7 7l5-4 5 4" />
        </svg>
      );
    case "merge":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v8a2 2 0 002 2h3m8-12h3a2 2 0 012 2v8a2 2 0 01-2 2h-3m-6-4h6" />
        </svg>
      );
    case "split":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v8a2 2 0 002 2h3m8-12h3a2 2 0 012 2v8a2 2 0 01-2 2h-3M12 3v18" />
        </svg>
      );
    case "edit":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.1 2.1 0 113 3L8.25 18.1 3 19.5l1.4-5.25L16.862 3.487z" />
        </svg>
      );
    case "generate_shape":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zM4 16h6v4H4v-4zm10-2h6v6h-6v-6z" />
        </svg>
      );
    case "clear_selection":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "zoom_in":
      return <span className="text-base leading-none">+</span>;
    case "zoom_out":
      return <span className="text-base leading-none">−</span>;
    case "recenter":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8M4 12a8 8 0 1016 0 8 8 0 00-16 0z" />
        </svg>
      );
    default:
      return null;
  }
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
  ileToken,
  suggestMode = "block",
  locale = "en",
  recenterCell = null,
  followCell = null,
  onAddBlock,
  onGridOp,
  appearingNodeIds = EMPTY_APPEARING_NODE_IDS,
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
  const blockDragRef = useRef<{
    pointerId: number;
    originRow: number;
    originCol: number;
    blockIds: string[];
    moved: boolean;
  } | null>(null);
  const suppressBlockClickRef = useRef(false);
  const [blockDragOffset, setBlockDragOffset] = useState<{ dRow: number; dCol: number } | null>(
    null,
  );

  const [pendingCell, setPendingCell] = useState<GridCell | null>(null);
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE);

  // Multi-select + Photoshop-style tool mode
  const [selectedEmptyCells, setSelectedEmptyCells] = useState<GridCell[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  /**
   * Selection refs are written ONLY by apply/clear/toggle helpers — never by a
   * useEffect that mirrors React state (that race wiped multi-select when the
   * parent re-rendered mid-click).
   */
  const selectedBlockIdsRef = useRef<string[]>([]);
  const selectedEmptyCellsRef = useRef<GridCell[]>([]);
  const activeToolRef = useRef<BlockMapModeTool>(DEFAULT_BLOCK_MAP_MODE);
  const [activeTool, setActiveTool] = useState<BlockMapModeTool>(DEFAULT_BLOCK_MAP_MODE);
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

  // Sequential appear animation for AI-added blocks.
  // Depend on id *contents* (not array identity) and keep onAppearingComplete in a ref so
  // unstable parent callbacks cannot restart the effect every render.
  const appearingKey = appearingNodeIds.join("\0");
  const onAppearingCompleteRef = useRef(onAppearingComplete);
  onAppearingCompleteRef.current = onAppearingComplete;

  useEffect(() => {
    if (!appearingKey) {
      // Only clear when non-empty — setState(new Set()) every time loops max update depth.
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
    selectedEmptyCellsRef.current = [];
    selectedBlockIdsRef.current = [];
    setSelectedEmptyCells([]);
    setSelectedBlockIds([]);
    setShapePromptOpen(false);
    setMergePromptOpen(false);
    setEditOpen(false);
    setPrompt("");
  }, []);

  /**
   * Sole writer for filled-block multi-select.
   * Ref is source of truth (never overwritten by a state-mirroring useEffect).
   * multi=true → toggle membership; multi=false → replace with [blockId].
   */
  const applyBlockSelection = useCallback((blockId: string, multi: boolean): string[] => {
    const prev = selectedBlockIdsRef.current;
    const nextIds = toggleOrReplaceBlockSelection({
      blockId,
      multi,
      prevSelectedBlockIds: prev,
    });
    selectedBlockIdsRef.current = nextIds;
    setSelectedBlockIds(nextIds);
    if (selectedEmptyCellsRef.current.length > 0) {
      selectedEmptyCellsRef.current = [];
      setSelectedEmptyCells([]);
    }
    return nextIds;
  }, []);

  const manipulationMode = isBlockMapManipulationMode(activeTool, {
    canEdit,
    hasGridOps: Boolean(onGridOp),
  });

  const handleCellSelect = useCallback(
    (blockId: string, event: React.MouseEvent) => {
      // Select tool handled multi-select on pointerdown — ignore trailing click
      // (avoids add-then-remove double toggle).
      if (suppressBlockClickRef.current) {
        suppressBlockClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.stopPropagation();

      if (!canEdit) {
        onSelectNode(blockId);
        return;
      }

      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;

      if (activeTool === "move" && !multiModifier && manipulationMode) {
        event.preventDefault();
        return;
      }

      // Fallback when pointerdown path didn't run (e.g. chapter map).
      applyBlockSelection(blockId, activeTool === "select" || multiModifier);
      // Do NOT call onSelectNode here — parent re-renders were racing selection state.
    },
    [activeTool, applyBlockSelection, canEdit, manipulationMode, onSelectNode],
  );

  const handleBlockDoubleClick = useCallback(
    (blockId: string) => {
      // Explicit open for TAP/ILE / detail (only path that opens the overlay)
      onSelectNode(blockId);
    },
    [onSelectNode],
  );

  const resolveCellFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return null;
      const rect = viewport.getBoundingClientRect();
      return clientPointToGridCell({
        clientX,
        clientY,
        viewportLeft: rect.left,
        viewportTop: rect.top,
        panX: pan.x,
        panY: pan.y,
        zoom,
        pitch: SKILL_GRID_PITCH,
      });
    },
    [pan.x, pan.y, zoom],
  );

  const handleBlockPointerDown = useCallback(
    (blockId: string, nodeCell: GridCell, event: React.PointerEvent) => {
      if (event.button !== 0) return;
      // Never let the map pan steal the gesture when pressing a block.
      event.stopPropagation();

      const tool = activeToolRef.current;
      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;

      // ── Select tool: always multi-toggle (same model as empty cells) ──
      if (canEdit && tool === "select") {
        applyBlockSelection(blockId, /* multi */ true);
        // Swallow the synthetic click so we don't toggle twice.
        suppressBlockClickRef.current = true;
        return;
      }

      if (!manipulationMode) return;

      // ── Move tool ──
      if (multiModifier) {
        applyBlockSelection(blockId, true);
        suppressBlockClickRef.current = true;
        return;
      }

      // Keep multi-group when pressing a member; otherwise focus the pressed block.
      const prev = selectedBlockIdsRef.current;
      const nextIds =
        prev.includes(blockId) && prev.length > 1 ? [...prev] : applyBlockSelection(blockId, false);
      if (!onGridOp || nextIds.length === 0) return;

      blockDragRef.current = {
        pointerId: event.pointerId,
        originRow: nodeCell.row,
        originCol: nodeCell.col,
        blockIds: nextIds,
        moved: false,
      };
      setBlockDragOffset(null);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [applyBlockSelection, canEdit, manipulationMode, onGridOp],
  );

  const handleBlockPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = blockDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const cell = resolveCellFromClient(event.clientX, event.clientY);
      if (!cell) return;
      const delta = blockDragMoveDelta(
        { row: drag.originRow, col: drag.originCol },
        cell,
      );
      if (delta.dRow !== 0 || delta.dCol !== 0) {
        drag.moved = true;
        suppressBlockClickRef.current = true;
      }
      setBlockDragOffset(delta);
    },
    [resolveCellFromClient],
  );

  const toggleEmptyCellSelection = useCallback((cell: GridCell) => {
    selectedBlockIdsRef.current = [];
    setSelectedBlockIds([]);
    setSelectedEmptyCells((prev) => {
      const key = cellKey(cell);
      const next = prev.some((c) => cellKey(c) === key)
        ? prev.filter((c) => cellKey(c) !== key)
        : [...prev, cell];
      selectedEmptyCellsRef.current = next;
      return next;
    });
  }, []);

  const handleEmptyCellClick = useCallback(
    (cell: GridCell, event: React.MouseEvent) => {
      if (!canEdit || busy) return;
      if (isCellOccupied(occupancy, cell.row, cell.col)) return;

      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;
      const multiEmpty = isEmptyCellMultiSelectGesture({
        multiModifier,
        activeTool: activeToolRef.current,
        prevSelectedEmptyCount: selectedEmptyCellsRef.current.length,
      });

      // Select / Move / modifier: multi-toggle empty cells (same model as filled blocks).
      if (multiEmpty) {
        if (multiModifier) event.preventDefault();
        toggleEmptyCellSelection(cell);
        if (selectedNodeId) onSelectNode(null);
        return;
      }

      // No multi mode: open single-cell add dialog (legacy path).
      setAddError(null);
      setPendingCell(cell);
    },
    [busy, canEdit, occupancy, onSelectNode, selectedNodeId, toggleEmptyCellSelection],
  );

  const handleEmptyCellDoubleClick = useCallback(
    (cell: GridCell) => {
      if (!canEdit || busy) return;
      if (isCellOccupied(occupancy, cell.row, cell.col)) return;
      // Double-click empty always opens add dialog even in Select multi mode.
      setSelectedEmptyCells([]);
      setSelectedBlockIds([]);
      setAddError(null);
      setPendingCell(cell);
    },
    [busy, canEdit, occupancy],
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

  const shapeFreeform = useMemo(
    () => selectionIsFreeformLectureShape(selectedEmptyCells),
    [selectedEmptyCells],
  );

  const shapeWeightedNeighbors = useMemo(() => {
    if (!shapeFootprint) return [];
    return getWeightedNeighborhood(
      { row: shapeFootprint.position_y, col: shapeFootprint.position_x },
      placements,
      nodesById,
    );
  }, [nodesById, placements, shapeFootprint]);

  const runSuggestTopics = useCallback(
    async (opts: {
      row: number;
      col: number;
      weightedNeighbors: ReturnType<typeof getWeightedNeighborhood>;
      shape?: {
        span_w: number;
        span_h: number;
        cells: Array<{ row: number; col: number }>;
      };
    }) => {
      if (!canSuggest || isSuggesting) return;

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
            row: opts.row,
            col: opts.col,
            weightedNeighbors: opts.weightedNeighbors,
            model,
            locale,
            ...(opts.shape
              ? {
                  shape: true,
                  span_w: opts.shape.span_w,
                  span_h: opts.shape.span_h,
                  cells: opts.shape.cells,
                }
              : {}),
            ...(ayclToken ? { ayclToken } : {}),
            ...(ileToken ? { ileToken } : {}),
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
    },
    [
      ayclToken,
      canSuggest,
      ileToken,
      isSuggesting,
      labels.suggestError,
      locale,
      sessionId,
      suggestMode,
      workspaceId,
    ],
  );

  const handleSuggestTopics = useCallback(async () => {
    if (!pendingCell) return;
    await runSuggestTopics({
      row: pendingCell.row,
      col: pendingCell.col,
      weightedNeighbors: pendingWeightedNeighbors,
    });
  }, [pendingCell, pendingWeightedNeighbors, runSuggestTopics]);

  const handleSuggestShapeTopics = useCallback(async () => {
    if (!shapeFootprint || selectedEmptyCells.length === 0) return;
    await runSuggestTopics({
      row: shapeFootprint.position_y,
      col: shapeFootprint.position_x,
      weightedNeighbors: shapeWeightedNeighbors,
      shape: {
        span_w: shapeFootprint.span_w,
        span_h: shapeFootprint.span_h,
        cells: selectedEmptyCells,
      },
    });
  }, [runSuggestTopics, selectedEmptyCells, shapeFootprint, shapeWeightedNeighbors]);

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

  const runGridOp = useCallback(
    async (payload: Parameters<NonNullable<typeof onGridOp>>[0]) => {
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
    },
    [busy, clearSelection, onGridOp],
  );

  const handleBlockPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = blockDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      blockDragRef.current = null;
      setBlockDragOffset(null);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }
      if (!drag.moved) return;
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
    [resolveCellFromClient, runGridOp],
  );

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
    selectedBlockCount: selectedBlockIds.length,
    selectedEmptyCellCount: selectedEmptyCells.length,
    selectedMultiCellBlockCount,
    selectedBlocksContiguous,
    selectedEmptyCellsSolidRectangle: shapeFreeform.ok,
  };
  const stripTools = visibleBlockMapTools(toolEnablement);

  const handleToolClick = (tool: BlockMapToolId) => {
    const nextMode = nextActiveModeTool(activeTool, tool);
    // Keep ref in sync immediately so the next pointerdown sees the new mode.
    activeToolRef.current = nextMode;
    setActiveTool(nextMode);
    switch (tool) {
      case "select":
      case "move":
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
      case "edit":
        if (isBlockMapToolEnabled("edit", toolEnablement)) openEditSelected();
        return;
      case "generate_shape":
        if (isBlockMapToolEnabled("generate_shape", toolEnablement)) {
          setSuggestions([]);
          setSuggestError(null);
          setPrompt("");
          setShapePromptOpen(true);
        }
        return;
      case "clear_selection":
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
  const isModeTool = (t?: BlockMapToolId) => t === "select" || t === "move";
  const modeTools = stripTools.filter((t) => isModeTool(t));
  const actionTools = stripTools.filter((t) => !isModeTool(t) && !isViewportTool(t));
  const viewportTools = stripTools.filter((t) => isViewportTool(t));

  const renderToolButton = (tool: BlockMapToolId) => {
    const enabled = isBlockMapToolEnabled(tool, toolEnablement);
    const isActiveMode = (tool === "select" || tool === "move") && activeTool === tool;
    const title = toolTooltip(tool, labels);
    return (
      <button
        key={tool}
        type="button"
        data-block-map-tool={tool}
        data-active={isActiveMode ? "true" : "false"}
        disabled={!enabled}
        onClick={() => handleToolClick(tool)}
        title={title}
        aria-label={title}
        aria-pressed={tool === "select" || tool === "move" ? isActiveMode : undefined}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm transition ${
          isActiveMode
            ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
            : enabled
              ? "border-transparent bg-transparent text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/80 hover:text-white"
              : "border-transparent bg-transparent text-neutral-600 opacity-45"
        } disabled:cursor-not-allowed`}
      >
        <ToolIcon id={tool} />
      </button>
    );
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800/60 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),rgba(8,8,8,0.98))]"
      data-block-map-tool={activeTool}
      data-selected-block-count={selectedBlockIds.length}
      data-selected-block-ids={selectedBlockIds.join(",")}
    >
      {busy && (
        <div className="pointer-events-none absolute inset-0 z-[15] backdrop-blur-[2px] bg-black/20 transition-all duration-500" />
      )}
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        {/* Full-height icon rail (not a floating toolbox) */}
        <div
          data-block-map-tool-strip
          className="flex h-full w-11 shrink-0 flex-col items-center border-r border-neutral-800/80 bg-neutral-950/95 py-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-0.5">{modeTools.map(renderToolButton)}</div>
          {actionTools.length > 0 && (
            <>
              <div className="my-1.5 h-px w-6 shrink-0 bg-neutral-700/80" aria-hidden />
              <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto">
                {actionTools.map(renderToolButton)}
              </div>
            </>
          )}
          {viewportTools.length > 0 && (
            <>
              <div className="my-1.5 h-px w-6 shrink-0 bg-neutral-700/80" aria-hidden />
              <div className="flex flex-col items-center gap-0.5">
                {viewportTools.map(renderToolButton)}
              </div>
            </>
          )}
        </div>

        <div
          ref={viewportRef}
          className={`relative min-h-0 flex-1 touch-none overflow-hidden ${
            activeTool === "move" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
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
                  onDoubleClick={() => handleEmptyCellDoubleClick(cell)}
                  className={`flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed text-neutral-600 transition ${
                    selectedEmpty
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-100 ring-2 ring-cyan-400/40"
                      : canEdit
                        ? "border-neutral-700/90 bg-neutral-950/35 hover:border-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300"
                        : "border-neutral-800/70 bg-neutral-950/20 opacity-50"
                  }`}
                  title={
                    canEdit
                      ? activeTool === "select" || activeTool === "move"
                        ? "Click to multi-select · double-click to add"
                        : labels.emptyCell
                      : undefined
                  }
                >
                  {canEdit && <span className="text-xl leading-none text-neutral-600">+</span>}
                </button>
              </div>
            );
          })}

          {/* Occupied blocks: solid rect or freeform multi-tile lecture */}
          {[...renderedBlockIds].map((blockId) => {
            const node = nodesById.get(blockId);
            const nodeCell = placements.get(blockId);
            if (!node || !nodeCell) return null;
            const span = spans.get(blockId) || {
              span_w: normalizeSpan(node.span_w),
              span_h: normalizeSpan(node.span_h),
            };
            const occupiedCells = skillNodeOccupiedCells(node);
            const freeform =
              Array.isArray(node.shape_cells) &&
              node.shape_cells.length > 0 &&
              occupiedCells.length > 0 &&
              occupiedCells.length !== span.span_w * span.span_h;
            const multiSelected = selectedBlockIds.includes(node.id);
            const isAppearingTarget = appearingNodeIds.includes(node.id);
            const appeared = !isAppearingTarget || visibleAppearing.has(node.id);
            const dragDx =
              multiSelected && blockDragOffset
                ? blockDragOffset.dCol * SKILL_GRID_PITCH
                : 0;
            const dragDy =
              multiSelected && blockDragOffset
                ? blockDragOffset.dRow * SKILL_GRID_PITCH
                : 0;

            // Match empty-cell cyan multi-select chrome (white ring from cellStatusClass
            // was invisible / conflicted with cyan on filled blocks).
            const baseStatus = cellStatusClass(
              node.status,
              false,
              focusedNodeId === node.id || (!multiSelected && selectedNodeId === node.id),
              showProgress,
            );
            const multiChrome = multiSelected
              ? "border-cyan-400/80 bg-cyan-500/20 text-cyan-50 ring-2 ring-cyan-400/70 shadow-[0_0_18px_rgba(34,211,238,0.3)]"
              : "";
            const tileClass = `relative flex h-full w-full flex-col items-center justify-center rounded-lg border px-2 text-center transition hover:brightness-110 ${
              multiSelected ? multiChrome : baseStatus
            } ${
              manipulationMode
                ? activeTool === "move"
                  ? "cursor-grab active:cursor-grabbing"
                  : "cursor-pointer"
                : ""
            } ${
              isAppearingTarget
                ? appeared
                  ? "opacity-100 scale-100 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                  : "opacity-0 scale-95"
                : ""
            }`;
            const tileTransition = {
              transition: isAppearingTarget
                ? "opacity 380ms ease, transform 380ms ease, box-shadow 380ms ease"
                : blockDragOffset && multiSelected
                  ? "none"
                  : undefined,
            } as const;

            // Freeform polyomino: seamless tiles (fill grid gaps) + outer edges only + one title.
            if (freeform) {
              const shapeKeys = freeformShapeKeySet(occupiedCells);
              const labelCell = freeformLabelCell(occupiedCells);
              const freeformFill = multiSelected
                ? "rgba(6, 182, 212, 0.22)"
                : "rgba(10, 10, 12, 0.88)";
              const freeformBorder = multiSelected
                ? "rgba(34, 211, 238, 0.85)"
                : "rgba(82, 82, 91, 0.9)";
              const freeformText = multiSelected ? "rgb(207, 250, 254)" : "rgb(229, 229, 229)";
              return (
                <div
                  key={`block-${node.id}`}
                  className="contents"
                  data-freeform-block={node.id}
                  data-freeform-cells={occupiedCells.length}
                >
                  {occupiedCells.map((cell) => {
                    const edges = freeformCellExternalEdges(cell, shapeKeys);
                    const { width, height } = freeformTilePixelSize(
                      cell,
                      shapeKeys,
                      SKILL_GRID_CELL_SIZE,
                      SKILL_GRID_GAP,
                    );
                    const isLabel =
                      cell.row === labelCell.row && cell.col === labelCell.col;
                    const radius = 10;
                    return (
                      <div
                        key={`block-${node.id}-${cell.row}-${cell.col}`}
                        data-skill-cell
                        data-freeform-tile={node.id}
                        className="absolute"
                        style={{
                          left: cell.col * SKILL_GRID_PITCH + dragDx,
                          top: cell.row * SKILL_GRID_PITCH + dragDy,
                          width,
                          height,
                          zIndex: multiSelected && blockDragOffset ? 5 : 2,
                        }}
                      >
                        <button
                          type="button"
                          data-block-id={node.id}
                          data-block-selected={multiSelected ? "true" : "false"}
                          data-block-map-draggable={activeTool === "move" ? "true" : undefined}
                          onClick={(e) => handleCellSelect(node.id, e)}
                          onDoubleClick={() => handleBlockDoubleClick(node.id)}
                          onPointerDown={(e) =>
                            handleBlockPointerDown(node.id, nodeCell, e)
                          }
                          onPointerMove={
                            activeTool === "move" ? handleBlockPointerMove : undefined
                          }
                          onPointerUp={
                            activeTool === "move" ? handleBlockPointerUp : undefined
                          }
                          onPointerCancel={
                            activeTool === "move" ? handleBlockPointerUp : undefined
                          }
                          className={`relative flex h-full w-full flex-col items-center justify-center px-2 text-center transition hover:brightness-110 ${
                            manipulationMode
                              ? activeTool === "move"
                                ? "cursor-grab active:cursor-grabbing"
                                : "cursor-pointer"
                              : ""
                          } ${
                            isAppearingTarget
                              ? appeared
                                ? "opacity-100 scale-100"
                                : "opacity-0 scale-95"
                              : ""
                          }`}
                          style={{
                            ...tileTransition,
                            backgroundColor: freeformFill,
                            color: freeformText,
                            // Outer edges only — internal edges open so the polyomino reads as one shape
                            borderStyle: "solid",
                            borderColor: freeformBorder,
                            borderTopWidth: edges.top ? 1 : 0,
                            borderRightWidth: edges.right ? 1 : 0,
                            borderBottomWidth: edges.bottom ? 1 : 0,
                            borderLeftWidth: edges.left ? 1 : 0,
                            borderTopLeftRadius: edges.top && edges.left ? radius : 0,
                            borderTopRightRadius: edges.top && edges.right ? radius : 0,
                            borderBottomRightRadius: edges.bottom && edges.right ? radius : 0,
                            borderBottomLeftRadius: edges.bottom && edges.left ? radius : 0,
                            boxShadow: multiSelected
                              ? "0 0 18px rgba(34,211,238,0.28)"
                              : undefined,
                          }}
                          title={node.title}
                        >
                          {isLabel ? (
                            <>
                              <span className="absolute left-1.5 top-1 font-mono text-[9px] opacity-60">
                                {formatGridCoordinate(nodeCell.row, nodeCell.col)}
                                <span className="opacity-70"> · {occupiedCells.length}c</span>
                              </span>
                              {node.is_start && (
                                <span className="absolute right-1.5 top-1 text-[8px] uppercase tracking-[0.12em] opacity-60">
                                  Start
                                </span>
                              )}
                              <span className="line-clamp-3 text-[11px] font-medium leading-snug">
                                {node.title}
                              </span>
                            </>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            }

            const width =
              span.span_w * SKILL_GRID_CELL_SIZE + (span.span_w - 1) * SKILL_GRID_GAP;
            const height =
              span.span_h * SKILL_GRID_CELL_SIZE + (span.span_h - 1) * SKILL_GRID_GAP;

            return (
              <div
                key={`block-${node.id}`}
                data-skill-cell
                className="absolute"
                style={{
                  left: nodeCell.col * SKILL_GRID_PITCH + dragDx,
                  top: nodeCell.row * SKILL_GRID_PITCH + dragDy,
                  width,
                  height,
                  zIndex: multiSelected && blockDragOffset ? 5 : undefined,
                }}
              >
                <button
                  type="button"
                  data-block-id={node.id}
                  data-block-selected={multiSelected ? "true" : "false"}
                  data-block-map-draggable={activeTool === "move" ? "true" : undefined}
                  onClick={(e) => handleCellSelect(node.id, e)}
                  onDoubleClick={() => handleBlockDoubleClick(node.id)}
                  onPointerDown={(e) => handleBlockPointerDown(node.id, nodeCell, e)}
                  onPointerMove={activeTool === "move" ? handleBlockPointerMove : undefined}
                  onPointerUp={activeTool === "move" ? handleBlockPointerUp : undefined}
                  onPointerCancel={activeTool === "move" ? handleBlockPointerUp : undefined}
                  className={tileClass}
                  style={tileTransition}
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

        {canEdit && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 max-w-[min(100%,22rem)] rounded-md border border-neutral-800/80 bg-neutral-950/80 px-2 py-1 text-[10px] text-neutral-500">
            {manipulationMode
              ? activeTool === "select"
                ? `Select: click boxes to multi-select (${selectedBlockIds.length} blocks · ${selectedEmptyCells.length} empty) · double-click empty to add · double-click block for TAP/ILE`
                : "Move: drag blocks · click empties to multi-select for Generate in shape"
              : labels.multiSelectHint ||
                "Select: click empty or filled boxes to multi-select. Double-click empty to add a single cell."}
            {shapeFootprint && selectedEmptyCells.length > 0 && (
              <span className="ml-1 text-neutral-400">
                · shape {selectedEmptyCells.length} cells
                {shapeFootprint.span_w * shapeFootprint.span_h !== selectedEmptyCells.length
                  ? ` (bbox ${shapeFootprint.span_w}×${shapeFootprint.span_h})`
                  : ` ${shapeFootprint.span_w}×${shapeFootprint.span_h}`}{" "}
                at {formatGridCoordinate(shapeFootprint.position_y, shapeFootprint.position_x)}
                {!shapeFreeform.ok ? " · must be edge-connected" : ""}
              </span>
            )}
            {addError && <span className="ml-1 text-red-400/90">· {addError}</span>}
          </div>
        )}
        </div>
      </div>

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
          <div
            className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl"
            data-generate-shape-dialog
          >
            <h3 className="text-sm font-medium text-white">
              {labels.generateShape || "Generate block in shape"}
            </h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              {shapeFootprint
                ? `${selectedEmptyCells.length} cell${selectedEmptyCells.length === 1 ? "" : "s"} · bbox ${shapeFootprint.span_w}×${shapeFootprint.span_h} at ${formatGridCoordinate(shapeFootprint.position_y, shapeFootprint.position_x)}`
                : `${selectedEmptyCells.length} cells`}
            </p>
            {!shapeFreeform.ok && shapeFootprint ? (
              <p className="mt-1 text-[11px] text-amber-400/90" data-shape-not-contiguous>
                Select edge-connected cells only (no diagonal gaps). Any contiguous shape works as one lecture.
              </p>
            ) : (
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">
                Any contiguous shape (L, T, freeform). Suggestions scale with cell count.
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                data-suggest-shape-topics
                disabled={
                  !canSuggest || isSuggesting || busy || !shapeFootprint || !shapeFreeform.ok
                }
                onClick={() => void handleSuggestShapeTopics()}
                className="rounded-md border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
              >
                {isSuggesting ? labels.suggesting : labels.suggestTopics}
              </button>
            </div>
            {suggestError && <p className="mt-2 text-xs text-red-400/90">{suggestError}</p>}
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5" data-shape-suggestions>
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
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={labels.addPlaceholder}
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShapePromptOpen(false);
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
                disabled={!prompt.trim() || busy || !shapeFreeform.ok}
                onClick={() => {
                  if (!shapeFreeform.ok) {
                    setAddError(
                      "Select a contiguous region of empty cells (edge-connected). Any shape is allowed.",
                    );
                    return;
                  }
                  void runGridOp({
                    op: "generate_shape",
                    prompt: prompt.trim(),
                    cells: selectedEmptyCells,
                  });
                }}
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
