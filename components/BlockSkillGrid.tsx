"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  blockHasAttachedLocalContext,
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
  activeExpandJobLockedCellKeys,
  addExpandProgressFraction,
  isOccupiedCellsGenerationLocked,
  mergeActiveExpandJobPreviews,
  type AddExpandJob,
} from "@/lib/add-block-range-density";
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
  DEFAULT_LASSO_SHAPE,
  LASSO_SHAPE_ORDER,
  allowsBlockDragInMode,
  allowsMapClickSelection,
  blockDragMoveDelta,
  blocksIntersectingCircle,
  blocksIntersectingGridRect,
  blocksIntersectingPolygon,
  clientPointToGridCell,
  clientPointToGridPoint,
  emptyCellDragIsPan,
  emptyCellsIntersectingCircle,
  emptyCellsIntersectingGridRect,
  emptyCellsIntersectingPolygon,
  isBlockMapManipulationMode,
  isBlockMapToolEnabled,
  isLassoModeTool,
  isMapPanGesture,
  isMultiCellBlockSpan,
  lassoShapeLabel,
  lassoShapeTooltip,
  nextActiveModeTool,
  nextLassoShape,
  normalizeGridSelectionRect,
  cancelPrereqEditMode,
  confirmPrereqEdit,
  EMPTY_PREREQ_EDIT,
  enterPrereqEditMode,
  resolveActiveLassoShape,
  resolveLassoSelection,
  resolveMapBlockHighlightRole,
  resolveBlockPointerGestureSelection,
  resolveMoveDragBlockIds,
  resolveUnusableFromSelection,
  shouldEmptyCellClickSelect,
  toggleOrReplaceBlockSelection as toggleOrReplaceBlockSelectionPure,
  toggleOrReplaceEmptyCellSelection as toggleOrReplaceEmptyCellSelectionPure,
  toggleStagedPrereq,
  type LassoShapeKind,
  type PrereqEditState,
  visibleBlockMapTools,
  type BlockMapModeTool,
  type BlockMapToolEnablementInput,
  type BlockMapToolId,
} from "@/lib/block-map-tools";
import {
  filterPlaceableEmptyCells,
  resolveEmptyAddTarget,
  resolveEmptySelectionSurface,
} from "@/lib/workspace-right-pane";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import {
  MAP_CELL_EMPTY_SELECTED_CLASS,
  MAP_CELL_GENERATION_PENDING_CLASS,
  MAP_CELL_PREREQ_CLASS,
  MAP_CELL_UNUSABLE_CLASS,
  mapCellChromeClasses,
  mapCellFreeformColors,
  mapCellFreeformPrereqColors,
  resolveMapCellStatusIcon,
} from "@/lib/map-cell-chrome";
import {
  blockHasLockDependencies,
  isBlockLockedUntilCompleted,
  normalizeLockUntilBlockIds,
  unusableCellKeySet,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import {
  buildMinimapClusterGraph,
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
  placementsFromOccupiedCells,
  projectMinimapClusters,
  type MinimapCluster,
} from "@/lib/map-minimap-clusters";
import {
  buildShapeContextSourceOptions,
  toggleShapeContextSelection,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;
const APPEAR_STAGGER_MS = 140;
/** Stable default — a fresh `[]` each render would re-fire the appear effect forever. */
const EMPTY_APPEARING_NODE_IDS: string[] = [];

interface BlockSkillGridProps {
  nodes: SkillGridNode[];
  selectedNodeId: string | null;
  /** Loaded / focused node (e.g. active chapter) — white highlight (same language as selected). */
  focusedNodeId?: string | null;
  /** Focus / open block detail. Null clears focus (e.g. Select mode closes practice drawer). */
  onSelectNode: (blockId: string | null) => void;
  /**
   * Filled-block multi-select for the right pane:
   * 2+ ids → combine surface; 0/1 → clear combine (single still uses onSelectNode).
   */
  onSelectedBlockIdsChange?: (blockIds: string[] | null) => void;
  /**
   * Empty-cell selection for the right pane:
   * 1 placeable → single Add; 2+ placeable → generate-in-shape form.
   * Null/[] clears. When omitted, local fallbacks still apply.
   */
  onEmptySelectionChange?: (cells: GridCell[] | null) => void;
  /**
   * Preview highlight for Add-block Range/Density expand (does not change right pane).
   */
  previewEmptyCells?: Array<{ row: number; col: number }> | null;
  /**
   * Background multi-create jobs (range/density). Progress + stop render under the minimap.
   * Host owns the loop — map stays interactive while jobs run.
   */
  expandJobs?: readonly AddExpandJob[] | null;
  /** Abort one background expand job (stop remaining slots after current). */
  onAbortExpandJob?: (jobId: string) => void;
  /**
   * @deprecated Prefer onEmptySelectionChange — still maps single cell for older hosts.
   */
  onAddTargetChange?: (cell: GridCell | null) => void;
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
    op: "generate_shape" | "merge" | "split" | "move" | "update_block" | "delete_block";
    prompt?: string;
    cells?: Array<{ row: number; col: number }>;
    blockIds?: string[];
    dRow?: number;
    dCol?: number;
    blockId?: string;
    title?: string;
    description?: string;
    /** Context source keys for generate_shape (file:/external:/notes). */
    contextSourceKeys?: string[];
  }) => Promise<{ updatedNodes?: SkillGridNode[]; placedNodeId?: string; appearSequentially?: boolean } | void>;
  /** Workspace notes for generate-in-shape context picker. */
  workspaceNotes?: string | null;
  /** Absolute unusable ground cells (path-shaping). */
  unusableCells?: UnusableCell[] | null;
  /**
   * Persist map-ground rules from left-toolbar + selection.
   * lock-until: first selected block is target, rest are prerequisites.
   * unusable: multi-selected empty cells mark/clear unusable ground.
   */
  onMapGround?: (payload: {
    op: "set_lock_until" | "set_unusable_cells";
    blockId?: string;
    prerequisiteIds?: string[];
    unusableCells?: UnusableCell[];
  }) => Promise<void> | void;
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
    clearSelection?: string;
    multiSelectHint?: string;
    lockUntil?: string;
    markUnusable?: string;
  };
}

function toolTooltip(id: BlockMapToolId, labels: BlockSkillGridProps["labels"]): string {
  switch (id) {
    case "select":
      return (
        labels.select ||
        "Select — click block/empty · drag block to move · drag empty or Space/middle to pan · Shift multi"
      );
    case "move":
      return labels.move || "Move — use Select (click-and-drag)";
    case "lasso":
      return "Lasso — region select (choose rect / circle / freehand in submenu)";
    case "lasso_circle":
      return "Circle lasso — drag from center to select blocks or empty cells";
    case "lasso_freehand":
      return "Freehand lasso — draw a path to select blocks or empty cells";
    case "merge":
      return labels.merge || "Merge";
    case "split":
      return labels.split || "Split";
    case "generate_shape":
      return labels.generateShape || "Generate in shape";
    case "lock_until":
      return (
        labels.lockUntil ||
        "Lock until — select target, enter prereq mode, multi-select prereqs, confirm"
      );
    case "mark_unusable":
      return (
        labels.markUnusable ||
        "Unusable ground — multi-select empty cells, then click to mark/clear"
      );
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

/** Lasso shape icons — marquee / ellipse / classic rope-loop freehand. */
function LassoShapeIcon({
  shape,
  className = "h-4 w-4",
}: {
  shape: LassoShapeKind;
  className?: string;
}) {
  if (shape === "circle") {
    return (
      <svg
        className={className}
        data-tool-icon="lasso-circle"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeDasharray="3 2"
        aria-hidden
      >
        <circle cx="12" cy="12" r="7" />
      </svg>
    );
  }
  if (shape === "freehand") {
    // Freehand lasso: irregular dashed selection outline (reads as free-form marquee).
    return (
      <svg
        className={className}
        data-tool-icon="lasso-freehand"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeDasharray="2.6 2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 7.5c1.2-1.8 3.2-2.6 5.2-2.3 2.1.3 3.6 1.6 4.3 3.4.6 1.6.3 3.4-.8 4.7-1 1.1-2.5 1.7-4 1.6-1.2-.1-2.3-.7-3.1-1.6-.7-.8-1.1-1.8-1.2-2.9-.1-1.3.3-2.6 1.2-3.5" />
        <path d="M8.6 15.2c-1.1.9-1.7 2.2-1.6 3.5.1 1.4 1 2.6 2.3 3.2 1.2.6 2.6.5 3.7-.2 1.1-.7 1.8-1.9 1.9-3.2.1-1.1-.3-2.2-1.1-3" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      data-tool-icon="lasso"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeDasharray="3.5 2.5"
      aria-hidden
    >
      <rect x="4.5" y="5.5" width="15" height="13" rx="1.5" />
    </svg>
  );
}

function ToolIcon({
  id,
  lassoShape = DEFAULT_LASSO_SHAPE,
}: {
  id: BlockMapToolId;
  lassoShape?: LassoShapeKind;
}) {
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
        <svg
          className={common}
          data-tool-icon="move-hand"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.5 11V7.5a1.5 1.5 0 113 0V11m0 0V6.75a1.5 1.5 0 113 0V11m0 0V7.5a1.5 1.5 0 113 0V11m0 0v-1.25a1.5 1.5 0 113 0V14a5 5 0 01-5 5H11a5 5 0 01-5-5v-2.5a1.5 1.5 0 113 0V11"
          />
        </svg>
      );
    case "lasso":
      return <LassoShapeIcon shape={lassoShape} className={common} />;
    case "lasso_circle":
      return <LassoShapeIcon shape="circle" className={common} />;
    case "lasso_freehand":
      return <LassoShapeIcon shape="freehand" className={common} />;
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
    case "generate_shape":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4V6zm10 0h6v6h-6V6zM4 16h6v4H4v-4zm10-2h6v6h-6v-6z" />
        </svg>
      );
    case "lock_until":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V7a4.5 4.5 0 10-9 0v3.5M6.75 10.5h10.5a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5z"
          />
        </svg>
      );
    case "mark_unusable":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
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

/** Occupied map tiles always show title only — no gear/tick status glyphs. */
function MapCellStatusGlyph({
  status,
  showProgress,
  title,
}: {
  status: string;
  showProgress: boolean;
  title: string;
}) {
  // resolveMapCellStatusIcon is always null (title-only policy); keep call for tests.
  void resolveMapCellStatusIcon(status, showProgress);
  return (
    <span className="line-clamp-3 text-[11px] font-medium leading-tight" data-map-cell-status="title">
      {title}
    </span>
  );
}

/** Small lock badge for blocks that declare lock-until dependencies. */
function BlockDependencyLockBadge({
  dependencyCount,
  currentlyLocked,
}: {
  dependencyCount: number;
  currentlyLocked: boolean;
}) {
  if (dependencyCount <= 0) return null;
  return (
    <span
      className={`absolute bottom-1 right-1.5 z-[1] inline-flex items-center justify-center rounded px-0.5 py-px ${
        currentlyLocked ? "text-neutral-300" : "text-neutral-500"
      }`}
      data-block-dependency-lock
      data-block-dependency-count={dependencyCount}
      data-block-dependency-locked={currentlyLocked ? "true" : "false"}
      title={
        currentlyLocked
          ? `Locked until ${dependencyCount} prerequisite${dependencyCount === 1 ? "" : "s"} complete`
          : `Depends on ${dependencyCount} block${dependencyCount === 1 ? "" : "s"}`
      }
      aria-hidden
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3m-.75 0h10.5a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5z"
        />
      </svg>
    </span>
  );
}

/** Small document badge for blocks with attached local context materials. */
function BlockLocalContextDocBadge() {
  return (
    <span
      className="absolute bottom-1 left-1.5 z-[1] inline-flex items-center justify-center rounded px-0.5 py-px text-neutral-400"
      data-block-local-context-badge
      title="Has attached local context"
      aria-hidden
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        data-block-local-context-icon
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 3.75h6.75L19 9v11.25A1.5 1.5 0 0117.5 21.75h-10.5A1.5 1.5 0 015.5 20.25V5.25A1.5 1.5 0 017 3.75z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.75V9H19" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5h6M9 17h4.5" />
      </svg>
    </span>
  );
}

function cellKey(cell: GridCell) {
  return `${cell.row}:${cell.col}`;
}

export function BlockSkillGrid({
  nodes,
  selectedNodeId,
  focusedNodeId = null,
  onSelectNode,
  onSelectedBlockIdsChange,
  onEmptySelectionChange,
  onAddTargetChange,
  previewEmptyCells = null,
  expandJobs = null,
  onAbortExpandJob,
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
  unusableCells = null,
  onMapGround,
  appearingNodeIds = EMPTY_APPEARING_NODE_IDS,
  onAppearingComplete,
  workspaceNotes = null,
  labels,
}: BlockSkillGridProps) {
  const unusableKeys = useMemo(
    () => unusableCellKeySet(unusableCells || []),
    [unusableCells],
  );
  /** Right-pane hosts empty create when either callback is wired. */
  const useRightPaneEmpty =
    typeof onEmptySelectionChange === "function" ||
    typeof onAddTargetChange === "function";
  const [localPendingCell, setLocalPendingCell] = useState<GridCell | null>(null);
  /** Ref so lasso endDrag (defined earlier) can call the latest emit helper. */
  const emitEmptySelectionRef = useRef<(cells: readonly GridCell[]) => void>(() => {});
  const emitFilledBlockSelectionRef = useRef<(ids: readonly string[]) => void>(() => {});
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialCenterRef = useRef(false);
  const panMovedRef = useRef(false);
  /**
   * Lasso drag in viewport-local coords.
   * rect/circle: start→cur; freehand: sampled `points` polyline.
   */
  const lassoDragRef = useRef<{
    pointerId: number;
    shape: LassoShapeKind;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    points: { x: number; y: number }[];
  } | null>(null);
  const [lassoOverlay, setLassoOverlay] = useState<
    | { kind: "rect"; left: number; top: number; width: number; height: number }
    | { kind: "circle"; cx: number; cy: number; r: number }
    | { kind: "freehand"; points: { x: number; y: number }[] }
    | null
  >(null);
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
  /** Ids participating in the active move drag (sole or multi) — drives drag chrome. */
  const [blockDragIds, setBlockDragIds] = useState<string[] | null>(null);

  /** Generate-in-shape / merge dialogs still use local prompt + suggest (not single-cell add). */
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
  /** Lasso geometry for the single Lasso strip tool (submenu). */
  const [lassoShape, setLassoShape] = useState<LassoShapeKind>(DEFAULT_LASSO_SHAPE);
  const lassoShapeRef = useRef<LassoShapeKind>(DEFAULT_LASSO_SHAPE);
  lassoShapeRef.current = lassoShape;
  /** Space held → pan-over-cells (always-reachable pan). */
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  /**
   * Select-mode click-and-drag: snapshot selection at pointerdown.
   * Pointerup !moved applies click from that snapshot (never re-toggle mid-gesture).
   */
  const pendingSelectClickRef = useRef<{
    blockId: string;
    multiModifier: boolean;
    /** Selection at pointerdown — authoritative for click completion. */
    prevSelectedBlockIds: string[];
  } | null>(null);
  /** Empty-cell press: pan if dragged past threshold, else click-select/Add. */
  const emptyCellPointerRef = useRef<{
    pointerId: number;
    cell: GridCell;
    startX: number;
    startY: number;
    multiModifier: boolean;
    panning: boolean;
  } | null>(null);
  /** Explicit prereq-edit: target + staged prereqs; confirm/cancel write or discard. */
  const [prereqEdit, setPrereqEdit] = useState<PrereqEditState>(EMPTY_PREREQ_EDIT);
  const prereqEditRef = useRef<PrereqEditState>(EMPTY_PREREQ_EDIT);
  prereqEditRef.current = prereqEdit;
  const [shapePromptOpen, setShapePromptOpen] = useState(false);
  const [mergePromptOpen, setMergePromptOpen] = useState(false);

  const [localBusy, setLocalBusy] = useState(false);
  const [visibleAppearing, setVisibleAppearing] = useState<Set<string>>(new Set());
  /** Generate-in-shape: multi-select Context sources (files / external / notes). */
  const [shapeContextOptions, setShapeContextOptions] = useState<ShapeContextSourceOption[]>(
    [],
  );
  const [shapeContextSelected, setShapeContextSelected] = useState<string[]>([]);
  const [shapeContextLoading, setShapeContextLoading] = useState(false);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const { occupancy, placements, spans, startCell } = useMemo(
    () => buildSkillGridLayout(nodes),
    [nodes],
  );
  /**
   * Blocks occupying any cell of a running radius/density expand job — not clickable
   * until that job finishes (completed/stopped/removed).
   */
  const generationLockedCellKeys = useMemo(
    () => activeExpandJobLockedCellKeys(expandJobs),
    [expandJobs],
  );
  const generationLockedBlockIds = useMemo(() => {
    const locked = new Set<string>();
    if (generationLockedCellKeys.size === 0) return locked;
    for (const node of nodes) {
      const cells = skillNodeOccupiedCells(node);
      if (isOccupiedCellsGenerationLocked(cells, generationLockedCellKeys)) {
        locked.add(node.id);
      }
    }
    return locked;
  }, [generationLockedCellKeys, nodes]);
  const generationLockedBlockIdsRef = useRef(generationLockedBlockIds);
  generationLockedBlockIdsRef.current = generationLockedBlockIds;
  /**
   * Cells still waiting for a block from **running** expand/bridge jobs only.
   * Each keeps a white pulse until that slot is created.
   * Host pre-submit previews (range slider / bridge corridor) use static
   * highlight via previewEmptyCells — not pulse — so they don't look like
   * extra selected blocks after multi-select.
   */
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

  // Load Context inventory when generate-in-shape dialog opens.
  useEffect(() => {
    if (!shapePromptOpen || !workspaceId || !canEdit) return;
    let cancelled = false;
    setShapeContextLoading(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({ workspaceId });
        if (ayclToken) qs.set("ayclToken", ayclToken);
        const [filesRes, extRes] = await Promise.all([
          fetch(`/api/workspace/files?workspaceId=${encodeURIComponent(workspaceId)}`),
          fetch(`/api/workspace/external-resources?${qs}`),
        ]);
        const filesData = (await filesRes.json().catch(() => ({}))) as {
          files?: Array<{ id?: string; file_name?: string }>;
        };
        const extData = (await extRes.json().catch(() => ({}))) as {
          resources?: Array<{
            id: string;
            title?: string | null;
            url?: string | null;
            description?: string | null;
          }>;
        };
        if (cancelled) return;
        setShapeContextOptions(
          buildShapeContextSourceOptions({
            notes: workspaceNotes ?? "",
            files: filesData.files || [],
            externalResources: extData.resources || [],
          }),
        );
      } catch {
        if (!cancelled) {
          setShapeContextOptions(
            buildShapeContextSourceOptions({ notes: workspaceNotes ?? "", files: [], externalResources: [] }),
          );
        }
      } finally {
        if (!cancelled) setShapeContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shapePromptOpen, workspaceId, canEdit, ayclToken, workspaceNotes]);

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

  /** Occupied cells per block for minimap clustering (placements + spans / freeform). */
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

  const minimapGraph = useMemo(
    () => buildMinimapClusterGraph(placementsFromOccupiedCells(occupiedByBlockId)),
    [occupiedByBlockId],
  );

  const minimapPoints = useMemo(
    () =>
      projectMinimapClusters(
        minimapGraph.clusters,
        MINIMAP_FRAME_WIDTH,
        MINIMAP_FRAME_HEIGHT,
        MINIMAP_FRAME_PADDING,
      ),
    [minimapGraph.clusters],
  );

  const panToCluster = useCallback(
    (cluster: MinimapCluster) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setPan(getPanToCenterCell(width, height, cluster.centerCell, zoom));
    },
    [zoom],
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

  // Space-to-pan: hold Space and drag anywhere (including over blocks/empties).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      // Don't steal Space from inputs / contenteditable.
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
    [beginViewportPan, canEdit, mergePromptOpen, shapePromptOpen],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
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
  }, []);

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
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

        selectedBlockIdsRef.current = resolved.selectedBlockIds;
        setSelectedBlockIds(resolved.selectedBlockIds);
        selectedEmptyCellsRef.current = resolved.selectedEmptyCells;
        setSelectedEmptyCells(resolved.selectedEmptyCells);

        if (resolved.mode === "empty") {
          // Drive right-pane single Add / multi generate-shape from empty hits.
          emitFilledBlockSelectionRef.current([]);
          emitEmptySelectionRef.current(resolved.selectedEmptyCells);
          if (selectedNodeId) onSelectNode(null);
        } else if (resolved.mode === "blocks") {
          // Clear empty create surfaces (right-pane host + local Add/shape modal).
          setLocalPendingCell(null);
          setShapePromptOpen(false);
          onEmptySelectionChange?.(null);
          onAddTargetChange?.(null);
          emitFilledBlockSelectionRef.current(resolved.selectedBlockIds);
          // Side panel: one block → detail; 2+ → combine (parent via multi ids).
          if (resolved.selectedBlockIds.length === 1) {
            onSelectNode(resolved.selectedBlockIds[0]);
          } else {
            onSelectNode(null);
          }
        } else {
          setLocalPendingCell(null);
          setShapePromptOpen(false);
          onEmptySelectionChange?.(null);
          onAddTargetChange?.(null);
          emitFilledBlockSelectionRef.current([]);
          if (selectedNodeId) onSelectNode(null);
        }
        return;
      }

      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [
      canEdit,
      nodes,
      occupancy,
      onAddTargetChange,
      onEmptySelectionChange,
      onSelectNode,
      pan.x,
      pan.y,
      placements,
      selectedNodeId,
      spans,
      unusableKeys,
      zoom,
    ],
  );

  const emitEmptySelection = useCallback(
    (cells: readonly GridCell[]) => {
      const placeable = filterPlaceableEmptyCells({
        selectedEmptyCells: cells,
        unusableKeys,
      });
      const surface = resolveEmptySelectionSurface({
        selectedEmptyCells: cells,
        unusableKeys,
      });
      if (useRightPaneEmpty) {
        onEmptySelectionChange?.(placeable.length ? placeable : null);
        // Legacy single-cell callback for hosts that only know Add.
        onAddTargetChange?.(
          surface?.kind === "add_block" ? surface.cell : null,
        );
        setLocalPendingCell(null);
        // Multi create lives in the right pane — do not open map modal.
        if (surface?.kind === "generate_shape") {
          setShapePromptOpen(false);
        }
        return;
      }
      // Standalone maps (chapter): local single-add or local multi modal.
      if (surface?.kind === "add_block") {
        setLocalPendingCell(surface.cell);
        setShapePromptOpen(false);
      } else if (surface?.kind === "generate_shape" && onGridOp) {
        setLocalPendingCell(null);
        setShapePromptOpen(true);
      } else {
        setLocalPendingCell(null);
        setShapePromptOpen(false);
      }
    },
    [onAddTargetChange, onEmptySelectionChange, onGridOp, unusableKeys, useRightPaneEmpty],
  );
  emitEmptySelectionRef.current = emitEmptySelection;

  const clearSelection = useCallback(() => {
    selectedEmptyCellsRef.current = [];
    selectedBlockIdsRef.current = [];
    setSelectedEmptyCells([]);
    setSelectedBlockIds([]);
    setShapePromptOpen(false);
    setMergePromptOpen(false);
    setPrompt("");
    setLocalPendingCell(null);
    onEmptySelectionChange?.(null);
    onAddTargetChange?.(null);
    onSelectedBlockIdsChange?.(null);
  }, [onAddTargetChange, onEmptySelectionChange, onSelectedBlockIdsChange]);

  /**
   * Sole writer for filled-block multi-select.
   * Ref is source of truth (never overwritten by a state-mirroring useEffect).
   * multi=true → toggle membership; multi=false → replace with [blockId].
   */
  const emitFilledBlockSelection = useCallback(
    (ids: readonly string[]) => {
      if (!onSelectedBlockIdsChange) return;
      if (ids.length >= 2) {
        onSelectedBlockIdsChange([...ids]);
      } else {
        // Single/zero: combine surface clears; single detail still via onSelectNode.
        onSelectedBlockIdsChange(null);
      }
    },
    [onSelectedBlockIdsChange],
  );
  emitFilledBlockSelectionRef.current = emitFilledBlockSelection;

  const applyBlockSelection = useCallback((blockId: string, multi: boolean): string[] => {
    const prev = selectedBlockIdsRef.current;
    const nextIds = toggleOrReplaceBlockSelectionPure({
      blockId,
      multi,
      prevSelectedBlockIds: prev,
    });
    selectedBlockIdsRef.current = nextIds;
    setSelectedBlockIds(nextIds);
    emitFilledBlockSelection(nextIds);
    if (selectedEmptyCellsRef.current.length > 0) {
      selectedEmptyCellsRef.current = [];
      setSelectedEmptyCells([]);
    }
    // Block selection closes empty create surfaces (right pane or local).
    setLocalPendingCell(null);
    setShapePromptOpen(false);
    onEmptySelectionChange?.(null);
    onAddTargetChange?.(null);
    return nextIds;
  }, [emitFilledBlockSelection, onAddTargetChange, onEmptySelectionChange]);

  const manipulationMode = isBlockMapManipulationMode(activeTool, {
    canEdit,
    hasGridOps: Boolean(onGridOp),
  });

  const handleCellSelect = useCallback(
    (blockId: string, event: React.MouseEvent) => {
      // Select tool handled selection on pointerdown — ignore trailing click
      // (avoids add-then-remove double toggle).
      if (suppressBlockClickRef.current) {
        suppressBlockClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.stopPropagation();

      // Radius/density expand job membership — not selectable while generating.
      if (generationLockedBlockIdsRef.current.has(blockId)) {
        event.preventDefault();
        return;
      }

      if (!canEdit) {
        onSelectNode(blockId);
        return;
      }

      if (!allowsMapClickSelection(activeTool)) return;

      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;

      if (activeTool === "move" && !multiModifier && manipulationMode) {
        event.preventDefault();
        return;
      }

      // Fallback when pointerdown path didn't run (e.g. chapter map).
      // Plain click = single-select replace (or clear if already sole); Shift multi-toggle.
      const nextIds = applyBlockSelection(blockId, multiModifier);
      if (nextIds.length === 0) {
        onSelectNode(null);
      } else if (nextIds.length === 1) {
        onSelectNode(nextIds[0]);
      } else {
        // Multi filled → combine surface; clear single-block detail focus.
        onSelectNode(null);
      }
    },
    [activeTool, applyBlockSelection, canEdit, manipulationMode, onSelectNode],
  );

  const handleBlockDoubleClick = useCallback(
    (blockId: string) => {
      if (generationLockedBlockIdsRef.current.has(blockId)) return;
      // Explicit open for practice detail (only path that opens the overlay)
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
      // Space / middle: pan over blocks (always-reachable pan).
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

      // Generating expand-job blocks: ignore select (lasso may still bubble).
      if (generationLockedBlockIdsRef.current.has(blockId)) {
        if (isLassoModeTool(activeToolRef.current)) return;
        event.stopPropagation();
        event.preventDefault();
        suppressBlockClickRef.current = true;
        return;
      }

      const tool = activeToolRef.current;
      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;

      // ── Prereq-edit mode: multi-toggle staged prerequisites (not the target) ──
      if (canEdit && prereqEditRef.current.active) {
        event.stopPropagation();
        if (blockId === prereqEditRef.current.targetId) {
          suppressBlockClickRef.current = true;
          return;
        }
        setPrereqEdit((prev) => toggleStagedPrereq(prev, blockId));
        suppressBlockClickRef.current = true;
        return;
      }

      // Lasso modes draw on the viewport — do not steal pointer for block click-select.
      if (isLassoModeTool(tool)) {
        return;
      }

      // Never let the map pan steal the gesture when pressing a block (select).
      event.stopPropagation();

      if (!canEdit || !manipulationMode) {
        // Non-edit / read-only: still allow focus click via onClick path.
        return;
      }

      // Shift/⌘/Ctrl: multi-toggle once on down (no second apply on up).
      if (multiModifier) {
        const prev = [...selectedBlockIdsRef.current];
        const resolved = resolveBlockPointerGestureSelection({
          blockId,
          multiModifier: true,
          moved: false,
          prevSelectedBlockIds: prev,
        });
        selectedBlockIdsRef.current = resolved.selectedBlockIds;
        setSelectedBlockIds(resolved.selectedBlockIds);
        emitFilledBlockSelection(resolved.selectedBlockIds);
        if (selectedEmptyCellsRef.current.length > 0) {
          selectedEmptyCellsRef.current = [];
          setSelectedEmptyCells([]);
        }
        setLocalPendingCell(null);
        setShapePromptOpen(false);
        onEmptySelectionChange?.(null);
        onAddTargetChange?.(null);
        if (resolved.selectedBlockIds.length === 0) onSelectNode(null);
        else if (resolved.selectedBlockIds.length === 1) {
          onSelectNode(resolved.selectedBlockIds[0]);
        } else {
          onSelectNode(null);
        }
        suppressBlockClickRef.current = true;
        pendingSelectClickRef.current = null;
        return;
      }

      // Select (primary) + legacy move: arm click-and-drag.
      // Snapshot prev for pointerup click resolution — do NOT apply sole-clear yet.
      if (!allowsBlockDragInMode(tool, Boolean(onGridOp))) {
        // No grid ops: click-select only (single apply).
        const prev = [...selectedBlockIdsRef.current];
        const resolved = resolveBlockPointerGestureSelection({
          blockId,
          multiModifier: false,
          moved: false,
          prevSelectedBlockIds: prev,
        });
        selectedBlockIdsRef.current = resolved.selectedBlockIds;
        setSelectedBlockIds(resolved.selectedBlockIds);
        emitFilledBlockSelection(resolved.selectedBlockIds);
        if (resolved.selectedBlockIds.length === 0) onSelectNode(null);
        else if (resolved.selectedBlockIds.length === 1) {
          onSelectNode(resolved.selectedBlockIds[0]);
        } else {
          onSelectNode(null);
        }
        suppressBlockClickRef.current = true;
        return;
      }

      const prev = [...selectedBlockIdsRef.current];
      pendingSelectClickRef.current = {
        blockId,
        multiModifier: false,
        prevSelectedBlockIds: prev,
      };
      // Drag preview set only — click completion uses prev snapshot on pointerup.
      const dragIds = resolveMoveDragBlockIds({
        blockId,
        prevSelectedBlockIds: prev,
      });
      // Preview chrome: show drag set without committing sole-clear.
      selectedBlockIdsRef.current = dragIds;
      setSelectedBlockIds(dragIds);
      if (selectedEmptyCellsRef.current.length > 0) {
        selectedEmptyCellsRef.current = [];
        setSelectedEmptyCells([]);
      }
      setLocalPendingCell(null);
      setShapePromptOpen(false);
      onEmptySelectionChange?.(null);
      onAddTargetChange?.(null);
      // Detail: open when preview is a new sole focus; multi → combine (null).
      if (dragIds.length === 1 && !(prev.length === 1 && prev[0] === blockId)) {
        onSelectNode(dragIds[0]);
      } else if (dragIds.length > 1) {
        onSelectNode(null);
      }

      if (dragIds.length === 0) return;

      blockDragRef.current = {
        pointerId: event.pointerId,
        originRow: nodeCell.row,
        originCol: nodeCell.col,
        blockIds: dragIds,
        moved: false,
      };
      setBlockDragIds(dragIds);
      setBlockDragOffset({ dRow: 0, dCol: 0 });
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [
      beginViewportPan,
      canEdit,
      emitFilledBlockSelection,
      manipulationMode,
      onAddTargetChange,
      onEmptySelectionChange,
      onGridOp,
      onSelectNode,
    ],
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

  /**
   * Sole writer for empty-cell selection (mirrors applyBlockSelection).
   * multi=true → toggle membership; multi=false → replace with [cell].
   * Always clears filled-block selection when selecting empties.
   */
  const applyEmptyCellSelection = useCallback((cell: GridCell, multi: boolean): GridCell[] => {
    const next = toggleOrReplaceEmptyCellSelectionPure({
      cell,
      multi,
      prevSelectedEmptyCells: selectedEmptyCellsRef.current,
    });
    selectedEmptyCellsRef.current = next;
    setSelectedEmptyCells(next);
    if (selectedBlockIdsRef.current.length > 0) {
      selectedBlockIdsRef.current = [];
      setSelectedBlockIds([]);
    }
    // Empty selection → right-pane Add (1) or generate-shape (2+); unusable-only clears.
    emitEmptySelection(next);
    return next;
  }, [emitEmptySelection]);

  const handleEmptyCellClick = useCallback(
    (cell: GridCell, event: React.MouseEvent | React.PointerEvent) => {
      if (!canEdit || busy) return;
      if (isCellOccupied(occupancy, cell.row, cell.col)) return;
      // Lasso modes own the gesture — never open add or select empties from click.
      if (isLassoModeTool(activeToolRef.current)) return;
      // Swallow after empty-cell pan (pointer path).
      if (suppressBlockClickRef.current) {
        suppressBlockClickRef.current = false;
        event.preventDefault?.();
        event.stopPropagation?.();
        return;
      }

      const isUnusable = unusableKeys.has(`${cell.row}:${cell.col}`);
      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;
      const tool = activeToolRef.current;
      const selectsEmpty =
        shouldEmptyCellClickSelect({ activeTool: tool }) || isUnusable;

      // Select: plain = single empty (+ right-pane add when placeable);
      // Shift/⌘/Ctrl = multi-toggle (generate-in-shape). Drag empty = pan.
      // Unusable cells must remain selectable so mark_unusable can clear them.
      if (selectsEmpty) {
        if (multiModifier) event.preventDefault();
        applyEmptyCellSelection(cell, multiModifier);
        if (selectedNodeId) onSelectNode(null);
        return;
      }

      // Legacy path (no select mode): single empty still drives right-pane add.
      if (isUnusable) return;
      applyEmptyCellSelection(cell, false);
      if (selectedNodeId) onSelectNode(null);
    },
    [
      applyEmptyCellSelection,
      busy,
      canEdit,
      occupancy,
      onSelectNode,
      selectedNodeId,
      unusableKeys,
    ],
  );

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

  const localPendingNeighbors = useMemo(() => {
    if (!localPendingCell) return [];
    return getWeightedNeighborhood(localPendingCell, placements, nodesById);
  }, [localPendingCell, nodesById, placements]);

  const handleSuggestLocalAdd = useCallback(async () => {
    if (!localPendingCell) return;
    await runSuggestTopics({
      row: localPendingCell.row,
      col: localPendingCell.col,
      weightedNeighbors: localPendingNeighbors,
    });
  }, [localPendingCell, localPendingNeighbors, runSuggestTopics]);

  const submitLocalAdd = async () => {
    if (!localPendingCell || !prompt.trim() || busy) return;
    if (isCellOccupied(occupancy, localPendingCell.row, localPendingCell.col)) {
      setAddError("That grid slot is already occupied.");
      return;
    }
    setAddError(null);
    try {
      await onAddBlock(prompt.trim(), localPendingCell);
      setPrompt("");
      setLocalPendingCell(null);
      clearSelection();
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
          selectedBlockIdsRef.current = resolved.selectedBlockIds;
          setSelectedBlockIds(resolved.selectedBlockIds);
          emitFilledBlockSelection(resolved.selectedBlockIds);
          if (resolved.selectedBlockIds.length === 0) onSelectNode(null);
          else if (resolved.selectedBlockIds.length === 1) {
            onSelectNode(resolved.selectedBlockIds[0]);
          } else {
            onSelectNode(null);
          }
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
        selectedBlockIdsRef.current = resolved.selectedBlockIds;
        setSelectedBlockIds(resolved.selectedBlockIds);
        emitFilledBlockSelection(resolved.selectedBlockIds);
        if (resolved.selectedBlockIds.length === 1) {
          onSelectNode(resolved.selectedBlockIds[0]);
        } else {
          onSelectNode(null);
        }
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
      emitFilledBlockSelection,
      onSelectNode,
      resolveCellFromClient,
      runGridOp,
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
      if (!canEdit || busy) return;

      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;
      // Shift multi-select: keep click path only.
      if (multiModifier) return;

      event.stopPropagation();
      emptyCellPointerRef.current = {
        pointerId: event.pointerId,
        cell: { row: cell.row, col: cell.col },
        startX: event.clientX,
        startY: event.clientY,
        multiModifier: false,
        panning: false,
      };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
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
        suppressBlockClickRef.current = true;
        panMovedRef.current = true;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: arm.startX,
          startY: arm.startY,
          panStartX: pan.x,
          panStartY: pan.y,
        };
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
      if (!arm || arm.pointerId !== event.pointerId) return;
      emptyCellPointerRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      }
      if (arm.panning) {
        dragRef.current = null;
        suppressBlockClickRef.current = true;
        return;
      }
      // Click: select empty / open Add (existing handler).
      handleEmptyCellClick(arm.cell, event as unknown as React.MouseEvent);
      suppressBlockClickRef.current = true;
    },
    [handleEmptyCellClick],
  );

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
    hasMapGroundOps: Boolean(onMapGround),
    prereqEditActive: prereqEdit.active,
    selectedBlockCount: selectedBlockIds.length,
    selectedEmptyCellCount: selectedEmptyCells.length,
    selectedMultiCellBlockCount,
    selectedBlocksContiguous,
    selectedEmptyCellsSolidRectangle: shapeFreeform.ok,
  };
  const stripTools = visibleBlockMapTools(toolEnablement);

  // Preview: when a single target is selected, highlight its saved dependencies
  // with a dashed outline (outside prereq-edit).
  const previewTargetId =
    !prereqEdit.active && selectedBlockIds.length === 1 ? selectedBlockIds[0] : null;
  const previewPrereqIds = previewTargetId
    ? normalizeLockUntilBlockIds(
        nodesById.get(previewTargetId)?.lock_until_block_ids,
        previewTargetId,
      )
    : [];

  const handleToolClick = (tool: BlockMapToolId) => {
    // Leaving prereq-edit when switching modes (except lock_until confirm path).
    if (tool === "select" || tool === "move" || isLassoModeTool(tool)) {
      if (prereqEdit.active) {
        setPrereqEdit(cancelPrereqEditMode());
      }
    }
    // Re-click Lasso while active: cycle shape (submenu alternative).
    if (tool === "lasso" && activeTool === "lasso") {
      setLassoShape((s) => nextLassoShape(s));
      return;
    }
    const nextMode = nextActiveModeTool(activeTool, tool);
    // Keep ref in sync immediately so the next pointerdown sees the new mode.
    activeToolRef.current = nextMode;
    setActiveTool(nextMode);
    if (tool === "lasso" || tool === "lasso_circle" || tool === "lasso_freehand") {
      if (tool === "lasso_circle") setLassoShape("circle");
      else if (tool === "lasso_freehand") setLassoShape("freehand");
      // keep current lassoShape when entering via primary lasso button
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
      case "generate_shape":
        // Toolbar opener removed — multi empty selection opens the form in the
        // right pane (or local modal when no right-pane host). Keep case for
        // type exhaustiveness if an old strip still emits the id.
        if (!useRightPaneEmpty && isBlockMapToolEnabled("generate_shape", toolEnablement)) {
          setSuggestions([]);
          setSuggestError(null);
          setPrompt("");
          setShapePromptOpen(true);
        }
        return;
      case "lock_until": {
        if (!isBlockMapToolEnabled("lock_until", toolEnablement) || !onMapGround) return;
        // Already in prereq-edit → confirm staged set and persist.
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
        // Enter prereq-edit: need a single target (first selected or sole id).
        const targetId = selectedBlockIds[0] || selectedNodeId;
        if (!targetId) return;
        const node = nodesById.get(targetId);
        setPrereqEdit(
          enterPrereqEditMode({
            targetId,
            currentLocks: node?.lock_until_block_ids ?? [],
          }),
        );
        // Focus map selection on the target only for clarity.
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
          // Cancel prereq-edit without writing (do not apply partial staged set).
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
  const isModeTool = (t?: BlockMapToolId) =>
    t === "select" || t === "lasso";
  const modeTools = stripTools.filter((t) => isModeTool(t));
  const actionTools = stripTools.filter((t) => !isModeTool(t) && !isViewportTool(t));
  const viewportTools = stripTools.filter((t) => isViewportTool(t));
  const activeLassoShape = resolveActiveLassoShape({
    activeTool,
    lassoShape,
  });
  const canDragBlocks = allowsBlockDragInMode(activeTool, Boolean(onGridOp));

  const renderToolButton = (tool: BlockMapToolId) => {
    const enabled = isBlockMapToolEnabled(tool, toolEnablement);
    const isActiveMode =
      ((tool === "select" || tool === "lasso") && activeTool === tool) ||
      (tool === "lock_until" && prereqEdit.active);
    const title =
      tool === "lock_until" && prereqEdit.active
        ? prereqEdit.stagedPrereqIds.length === 0
          ? "Confirm: clear all prerequisites for this block"
          : "Confirm: save staged prerequisites (empty set clears all)"
        : tool === "lasso"
          ? `${toolTooltip(tool, labels)} · ${lassoShapeTooltip(lassoShape)}`
          : toolTooltip(tool, labels);
    return (
      <button
        key={tool}
        type="button"
        data-block-map-tool={tool}
        data-active={isActiveMode ? "true" : "false"}
        data-lasso-shape={tool === "lasso" ? lassoShape : undefined}
        data-prereq-edit-active={
          tool === "lock_until" && prereqEdit.active ? "true" : undefined
        }
        disabled={!enabled}
        onClick={() => handleToolClick(tool)}
        title={title}
        aria-label={title}
        aria-pressed={
          tool === "select" || tool === "lasso" || tool === "lock_until"
            ? isActiveMode
            : undefined
        }
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm transition ${
          isActiveMode
            ? "border-white/40 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.12)]"
            : enabled
              ? "border-transparent bg-transparent text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/80 hover:text-white"
              : "border-transparent bg-transparent text-neutral-600 opacity-45"
        } disabled:cursor-not-allowed`}
      >
        <ToolIcon id={tool} lassoShape={lassoShape} />
      </button>
    );
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800/60 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),rgba(8,8,8,0.98))]"
      data-block-map-tool={activeTool}
      data-lasso-shape={activeLassoShape || undefined}
      data-space-pan={spaceHeld ? "true" : "false"}
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
          <div className="flex flex-col items-center gap-0.5">
            {modeTools.map(renderToolButton)}
            {/* Lasso shape submenu — one lasso tool, choose rect / circle / freehand */}
            {activeTool === "lasso" ? (
              <div
                className="mt-1 flex flex-col items-center gap-0.5 border-t border-neutral-800 pt-1"
                data-lasso-shape-submenu
                role="group"
                aria-label="Lasso shape"
              >
                {LASSO_SHAPE_ORDER.map((shape) => {
                  const active = lassoShape === shape;
                  return (
                    <button
                      key={shape}
                      type="button"
                      data-lasso-shape-option={shape}
                      data-active={active ? "true" : "false"}
                      title={lassoShapeTooltip(shape)}
                      aria-label={lassoShapeTooltip(shape)}
                      aria-pressed={active}
                      onClick={() => setLassoShape(shape)}
                      className={`flex h-7 w-7 items-center justify-center rounded border text-[10px] transition ${
                        active
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-transparent text-neutral-400 hover:border-neutral-700 hover:text-white"
                      }`}
                    >
                      <LassoShapeIcon shape={shape} className="h-3.5 w-3.5" />
                      <span className="sr-only">{lassoShapeLabel(shape)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
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
            spaceHeld
              ? "cursor-grab active:cursor-grabbing"
              : activeLassoShape
                ? "cursor-crosshair"
                : activeTool === "select"
                  ? "cursor-grab"
                  : "cursor-default"
          }`}
          data-map-lasso-mode={activeLassoShape || "false"}
          data-map-lasso-shape={activeLassoShape || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
        {lassoOverlay?.kind === "rect" ? (
          <div
            data-map-lasso-rect
            className="pointer-events-none absolute z-[12] border border-cyan-400/80 bg-cyan-400/10"
            style={{
              left: lassoOverlay.left,
              top: lassoOverlay.top,
              width: lassoOverlay.width,
              height: lassoOverlay.height,
            }}
          />
        ) : null}
        {lassoOverlay?.kind === "circle" ? (
          <div
            data-map-lasso-circle
            className="pointer-events-none absolute z-[12] rounded-full border border-cyan-400/80 bg-cyan-400/10"
            style={{
              left: lassoOverlay.cx - lassoOverlay.r,
              top: lassoOverlay.cy - lassoOverlay.r,
              width: lassoOverlay.r * 2,
              height: lassoOverlay.r * 2,
            }}
          />
        ) : null}
        {lassoOverlay?.kind === "freehand" && lassoOverlay.points.length > 0 ? (
          <svg
            data-map-lasso-freehand
            className="pointer-events-none absolute inset-0 z-[12] h-full w-full overflow-visible"
            aria-hidden
          >
            <polygon
              fill="rgba(34, 211, 238, 0.08)"
              stroke="rgba(34, 211, 238, 0.85)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={lassoOverlay.points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          </svg>
        ) : null}
        {/* Rectangular minimap: cluster graph, top-right overlay (always shown) */}
        <div
          data-block-minimap
          data-minimap-cluster-count={minimapGraph.clusters.length}
          data-minimap-empty={minimapGraph.clusters.length === 0 ? "true" : "false"}
          className="pointer-events-auto absolute right-2 top-2 z-20 overflow-hidden rounded-md border border-neutral-700/90 bg-neutral-950/90 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
          style={{ width: MINIMAP_FRAME_WIDTH, height: MINIMAP_FRAME_HEIGHT }}
          onPointerDown={(e) => e.stopPropagation()}
          title={
            minimapGraph.clusters.length > 0
              ? "Minimap — click a cluster to center the map"
              : "Minimap — create a cluster to see it here"
          }
        >
          {minimapGraph.clusters.length === 0 ? (
            <div
              className="flex h-full w-full items-center justify-center px-4 text-center"
              data-minimap-empty-message
            >
              <p className="text-[11px] leading-snug text-neutral-500">
                Create a cluster to see it in the minimap
              </p>
            </div>
          ) : (
            <svg
              width={MINIMAP_FRAME_WIDTH}
              height={MINIMAP_FRAME_HEIGHT}
              className="block"
              aria-label="Block cluster minimap"
            >
              {/* Edges between neighboring clusters (MST) */}
              {minimapGraph.edges.map((edge) => {
                const a = minimapPoints.get(edge.fromClusterId);
                const b = minimapPoints.get(edge.toClusterId);
                if (!a || !b) return null;
                return (
                  <line
                    key={`${edge.fromClusterId}-${edge.toClusterId}`}
                    data-minimap-edge
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1.25}
                  />
                );
              })}
              {minimapGraph.clusters.map((cluster) => {
                const pt = minimapPoints.get(cluster.id);
                if (!pt) return null;
                const r = Math.min(14, 8 + Math.log2(cluster.count + 1) * 2.2);
                return (
                  <g key={cluster.id}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={r}
                      fill="rgba(255,255,255,0.12)"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth={1.25}
                      className="cursor-pointer transition hover:fill-white/25"
                      data-minimap-cluster={cluster.id}
                      data-minimap-cluster-count={cluster.count}
                      data-minimap-center-block={cluster.centerBlockId}
                      onClick={(e) => {
                        e.stopPropagation();
                        panToCluster(cluster);
                      }}
                    />
                    <text
                      x={pt.x}
                      y={pt.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="pointer-events-none select-none fill-neutral-100"
                      style={{ fontSize: cluster.count >= 10 ? 9 : 10, fontWeight: 600 }}
                    >
                      {cluster.count}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Background range/density multi-create jobs — under minimap; map stays interactive */}
        {Array.isArray(expandJobs) && expandJobs.length > 0 ? (
          <div
            data-map-expand-jobs
            data-map-expand-job-count={expandJobs.length}
            className="pointer-events-auto absolute right-2 z-20 flex max-h-[min(40vh,16rem)] w-[220px] flex-col gap-1.5 overflow-y-auto"
            style={{ top: 8 + MINIMAP_FRAME_HEIGHT + 8, width: MINIMAP_FRAME_WIDTH }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {expandJobs.map((job) => {
              const fraction = addExpandProgressFraction({
                completed: job.completed,
                total: job.total,
              });
              const running = job.status === "running";
              return (
                <div
                  key={job.id}
                  data-map-expand-job={job.id}
                  data-map-expand-job-status={job.status}
                  data-map-expand-progress-completed={job.completed}
                  data-map-expand-progress-total={job.total}
                  className="rounded-md border border-white/15 bg-neutral-950/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
                >
                  <div className="mb-1 flex items-start justify-between gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-100">
                      {job.label?.trim()
                        ? job.label
                        : running
                          ? "Creating blocks…"
                          : job.status === "stopped"
                            ? "Stopped"
                            : job.status === "error"
                              ? "Failed"
                              : "Done"}
                    </p>
                    <span
                      className="shrink-0 font-mono text-[10px] text-neutral-300"
                      data-map-expand-progress-label
                    >
                      {job.completed}/{job.total}
                    </span>
                  </div>
                  <div
                    className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800"
                    role="progressbar"
                    aria-valuenow={job.completed}
                    aria-valuemin={0}
                    aria-valuemax={job.total}
                    aria-label={`Creating blocks ${job.completed} of ${job.total}`}
                    data-map-expand-progress-bar
                  >
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
                      data-map-expand-progress-fill
                      style={{ width: `${Math.round(fraction * 100)}%` }}
                    />
                  </div>
                  {running ? (
                    <button
                      type="button"
                      data-map-expand-stop
                      data-map-expand-stop-job={job.id}
                      onClick={() => onAbortExpandJob?.(job.id)}
                      className="w-full rounded-md border border-white/50 bg-white px-2 py-1 text-[10px] font-medium text-black transition hover:bg-neutral-100"
                    >
                      Stop
                    </button>
                  ) : job.error ? (
                    <p className="text-[10px] text-red-300/90" data-map-expand-job-error>
                      {job.error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

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
          {/* Empty cells + selection highlights + unusable ground */}
          {visibleCells.map((cell) => {
            const blockId = occupancy.get(`${cell.row}:${cell.col}`);
            if (blockId) return null;
            const selectedEmpty = selectedEmptyCells.some(
              (c) => c.row === cell.row && c.col === cell.col,
            );
            const cellKeyStr = `${cell.row}:${cell.col}`;
            const generationPending = generationPendingCellKeys.has(cellKeyStr);
            const hostPreviewEmpty = Boolean(
              previewEmptyCells?.some(
                (c) => c.row === cell.row && c.col === cell.col,
              ),
            );
            // Running-job slots pulse; host range/bridge previews are static white.
            const previewEmpty = generationPending || hostPreviewEmpty;
            const emptyHighlight = selectedEmpty || previewEmpty;
            const isUnusable = unusableKeys.has(cellKeyStr);
            return (
              <div
                key={`empty-${cell.row}:${cell.col}`}
                data-skill-cell
                data-map-cell-kind={isUnusable ? "unusable" : "open"}
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
                  disabled={!canEdit || busy || generationPending}
                  data-map-cell-unusable={isUnusable ? "true" : "false"}
                  data-map-cell-selected={emptyHighlight ? "true" : "false"}
                  data-empty-preview={previewEmpty && !selectedEmpty ? "true" : "false"}
                  data-generation-pending={generationPending ? "true" : "false"}
                  onClick={(e) => {
                    // Multi-modifier still uses click; plain clicks go through pointer up
                    // after empty-drag pan disambiguation.
                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                      handleEmptyCellClick(cell, e);
                    }
                  }}
                  onPointerDown={(e) => handleEmptyCellPointerDown(cell, e)}
                  onPointerMove={handleEmptyCellPointerMove}
                  onPointerUp={handleEmptyCellPointerUp}
                  onPointerCancel={handleEmptyCellPointerUp}
                  className={`flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed transition ${
                    isUnusable
                      ? generationPending
                        ? `${MAP_CELL_UNUSABLE_CLASS} ring-2 ring-white/50 animate-pulse`
                        : emptyHighlight
                          ? `${MAP_CELL_UNUSABLE_CLASS} ring-2 ring-white/50`
                          : MAP_CELL_UNUSABLE_CLASS
                      : generationPending
                        ? MAP_CELL_GENERATION_PENDING_CLASS
                        : emptyHighlight
                          ? MAP_CELL_EMPTY_SELECTED_CLASS
                          : canEdit
                            ? "border-neutral-700/90 bg-neutral-950/35 text-neutral-600 hover:border-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300"
                            : "border-neutral-800/70 bg-neutral-950/20 text-neutral-600 opacity-50"
                  }`}
                  title={
                    generationPending
                      ? "Generating block here…"
                      : isUnusable
                      ? canEdit
                        ? activeLassoShape
                          ? "Unusable ground — drag lasso to multi-select, then Unusable tool to clear"
                          : "Unusable ground — click to select, then Unusable tool to clear"
                        : "Unusable ground — shapes paths"
                      : canEdit
                        ? activeLassoShape
                          ? "Drag to lasso-select blocks or empty cells"
                          : activeTool === "select" || activeTool === "move"
                            ? "Click empty to Add · drag empty to pan · Shift multi for shape form · Space/middle pan"
                            : labels.emptyCell
                        : undefined
                  }
                >
                  {isUnusable ? (
                    <span className="text-[9px] uppercase tracking-wide text-neutral-600">∅</span>
                  ) : (
                    canEdit && <span className="text-xl leading-none text-neutral-600">+</span>
                  )}
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
            // Map selection chrome follows selectedBlockIds only (drag set source of
            // truth). Do not also paint selectedNodeId / focusedNodeId as selected —
            // that made lasso multi-select look broader than the drag membership.
            const multiSelected = selectedBlockIds.includes(node.id);
            /** Active move-drag member (sole or multi) — independent of selection lag. */
            const isDragParticipant = Boolean(blockDragIds?.includes(node.id));
            const isAppearingTarget = appearingNodeIds.includes(node.id);
            const appeared = !isAppearingTarget || visibleAppearing.has(node.id);
            // Prefer explicit drag participants (sole or multi) so single-block
            // move still translates even if selection chrome lags a frame.
            const dragDx =
              isDragParticipant && blockDragOffset
                ? blockDragOffset.dCol * SKILL_GRID_PITCH
                : 0;
            const dragDy =
              isDragParticipant && blockDragOffset
                ? blockDragOffset.dRow * SKILL_GRID_PITCH
                : 0;

            // Chapter focus only when map multi-select list is empty (learner map).
            const chapterFocusOnly =
              selectedBlockIds.length === 0 &&
              (focusedNodeId === node.id || selectedNodeId === node.id);
            const dependencyIds = normalizeLockUntilBlockIds(
              node.lock_until_block_ids,
              node.id,
            );
            const hasDependencies = blockHasLockDependencies(node);
            const lockedByPrereq = isBlockLockedUntilCompleted(node, nodesById);
            const displayStatus = lockedByPrereq ? "locked" : node.status;
            // Prereq dashed preview only for sole map selection that is also the
            // detail focus — not while multi-selecting (avoids "extra selected").
            const highlightRole = resolveMapBlockHighlightRole({
              blockId: node.id,
              selected: multiSelected,
              prereqEdit,
              previewTargetId:
                previewTargetId && selectedNodeId === previewTargetId
                  ? previewTargetId
                  : null,
              previewPrereqIds:
                previewTargetId && selectedNodeId === previewTargetId
                  ? previewPrereqIds
                  : [],
              isLockedDisplay: lockedByPrereq,
            });
            const isPrereqHighlight = highlightRole === "prereq";
            const baseChrome = mapCellChromeClasses({
              status: displayStatus,
              selected: multiSelected || chapterFocusOnly,
              focused: chapterFocusOnly,
              showProgress,
              highlightRole,
            });
            // Must be declared before tileClass (TDZ) — used by rect + freeform chrome.
            const generationLocked = generationLockedBlockIds.has(node.id);
            const tileClass = `relative flex h-full w-full flex-col items-center justify-center rounded-lg border px-2 text-center transition ${
              generationLocked
                ? "pointer-events-none cursor-not-allowed opacity-60"
                : `hover:brightness-110 pointer-events-auto ${
                    canEdit
                      ? canDragBlocks || spaceHeld
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-pointer"
                      : ""
                  }`
            } ${baseChrome} ${
              !generationLocked && isAppearingTarget
                ? appeared
                  ? "opacity-100 scale-100 shadow-[0_0_14px_rgba(255,255,255,0.12)]"
                  : "opacity-0 scale-95"
                : ""
            }`;
            const tileTransition = {
              transition: isAppearingTarget
                ? "opacity 380ms ease, transform 380ms ease, box-shadow 380ms ease"
                : isDragParticipant && blockDragOffset
                  ? "none"
                  : undefined,
            } as const;
            const lockBadge = hasDependencies ? (
              <BlockDependencyLockBadge
                dependencyCount={dependencyIds.length}
                currentlyLocked={lockedByPrereq}
              />
            ) : null;
            const hasLocalContext = blockHasAttachedLocalContext(node);
            const localContextBadge = hasLocalContext ? (
              <BlockLocalContextDocBadge />
            ) : null;

            // Freeform polyomino: seamless tiles (fill grid gaps) + outer edges only + one title.
            if (freeform) {
              const shapeKeys = freeformShapeKeySet(occupiedCells);
              const labelCell = freeformLabelCell(occupiedCells);
              const freeformColors =
                isPrereqHighlight
                  ? mapCellFreeformPrereqColors()
                  : highlightRole === "target" || multiSelected
                    ? mapCellFreeformColors(true)
                    : mapCellFreeformColors(false);
              const freeformFill = freeformColors.fill;
              const freeformBorder = freeformColors.border;
              const freeformText = freeformColors.text;
              const freeformBorderStyle: "solid" | "dashed" = isPrereqHighlight
                ? "dashed"
                : "solid";
              const freeformBorderWidth = isPrereqHighlight ? 2 : 1;
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
                          zIndex: isDragParticipant && blockDragOffset ? 5 : 2,
                        }}
                      >
                        <button
                          type="button"
                          data-block-id={node.id}
                          data-block-selected={multiSelected ? "true" : "false"}
                          data-block-locked={lockedByPrereq ? "true" : "false"}
                          data-block-has-dependencies={hasDependencies ? "true" : "false"}
                          data-block-has-local-context={hasLocalContext ? "true" : "false"}
                          data-block-generation-locked={generationLocked ? "true" : "false"}
                          data-block-highlight={highlightRole}
                          data-block-map-draggable={
                            generationLocked
                              ? undefined
                              : canDragBlocks
                                ? "true"
                                : undefined
                          }
                          onClick={(e) => handleCellSelect(node.id, e)}
                          onDoubleClick={() => handleBlockDoubleClick(node.id)}
                          onPointerDown={(e) =>
                            handleBlockPointerDown(node.id, nodeCell, e)
                          }
                          onPointerMove={
                            canDragBlocks && !generationLocked
                              ? handleBlockPointerMove
                              : undefined
                          }
                          onPointerUp={
                            canDragBlocks && !generationLocked
                              ? handleBlockPointerUp
                              : undefined
                          }
                          onPointerCancel={
                            canDragBlocks && !generationLocked
                              ? handleBlockPointerUp
                              : undefined
                          }
                          title={
                            generationLocked
                              ? `${node.title} (generating — not clickable yet)`
                              : prereqEdit.active
                              ? highlightRole === "target"
                                ? `${node.title} (target — click other blocks to add/remove prereqs)`
                                : highlightRole === "prereq"
                                  ? `${node.title} (prerequisite — click to remove)`
                                  : `${node.title} (click to add as prerequisite)`
                              : isPrereqHighlight
                                ? `${node.title} (dependency of selected block)`
                                : lockedByPrereq
                                  ? `${node.title} (locked — select, then Lock until to edit/clear prereqs)`
                                  : hasDependencies
                                    ? `${node.title} (depends on ${dependencyIds.length} block${dependencyIds.length === 1 ? "" : "s"})`
                                    : hasLocalContext
                                      ? `${node.title} (has local context)`
                                      : node.title
                          }
                          className={`relative flex h-full w-full flex-col items-center justify-center px-2 text-center transition ${
                            generationLocked
                              ? "pointer-events-none cursor-not-allowed opacity-60"
                              : `hover:brightness-110 pointer-events-auto ${
                                  canEdit
                                    ? canDragBlocks || spaceHeld
                                      ? "cursor-grab active:cursor-grabbing"
                                      : "cursor-pointer"
                                    : ""
                                }`
                          } ${
                            !generationLocked && isAppearingTarget
                              ? appeared
                                ? "opacity-100 scale-100"
                                : "opacity-0 scale-95"
                              : ""
                          }`}
                          style={{
                            ...tileTransition,
                            backgroundColor: freeformFill,
                            color: freeformText,
                            // Outer edges only — internal edges open so the polyomino reads as one shape.
                            // Dependencies of the selected target use a dashed outline.
                            borderStyle: freeformBorderStyle,
                            borderColor: freeformBorder,
                            borderTopWidth: edges.top ? freeformBorderWidth : 0,
                            borderRightWidth: edges.right ? freeformBorderWidth : 0,
                            borderBottomWidth: edges.bottom ? freeformBorderWidth : 0,
                            borderLeftWidth: edges.left ? freeformBorderWidth : 0,
                            borderTopLeftRadius: edges.top && edges.left ? radius : 0,
                            borderTopRightRadius: edges.top && edges.right ? radius : 0,
                            borderBottomRightRadius: edges.bottom && edges.right ? radius : 0,
                            borderBottomLeftRadius: edges.bottom && edges.left ? radius : 0,
                            boxShadow:
                              isPrereqHighlight ||
                              highlightRole === "target" ||
                              multiSelected
                                ? freeformColors.shadow
                                : undefined,
                          }}
                        >
                          {isLabel ? (
                            <>
                              <span className="absolute left-1.5 top-1 font-mono text-[9px] opacity-60">
                                {formatGridCoordinate(nodeCell.row, nodeCell.col)}
                                <span className="opacity-70"> · {occupiedCells.length}c</span>
                              </span>
                              <MapCellStatusGlyph
                                status={node.status}
                                showProgress={showProgress}
                                title={node.title}
                              />
                              {localContextBadge}
                              {lockBadge}
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
                  zIndex: isDragParticipant && blockDragOffset ? 5 : undefined,
                }}
              >
                <button
                  type="button"
                  data-block-id={node.id}
                  data-block-selected={multiSelected ? "true" : "false"}
                  data-block-locked={lockedByPrereq ? "true" : "false"}
                  data-block-has-dependencies={hasDependencies ? "true" : "false"}
                  data-block-has-local-context={hasLocalContext ? "true" : "false"}
                  data-block-generation-locked={generationLocked ? "true" : "false"}
                  data-block-highlight={highlightRole}
                  data-block-map-draggable={
                    generationLocked
                      ? undefined
                      : canDragBlocks
                        ? "true"
                        : undefined
                  }
                  onClick={(e) => handleCellSelect(node.id, e)}
                  onDoubleClick={() => handleBlockDoubleClick(node.id)}
                  onPointerDown={(e) => handleBlockPointerDown(node.id, nodeCell, e)}
                  onPointerMove={
                    canDragBlocks && !generationLocked
                      ? handleBlockPointerMove
                      : undefined
                  }
                  onPointerUp={
                    canDragBlocks && !generationLocked
                      ? handleBlockPointerUp
                      : undefined
                  }
                  onPointerCancel={
                    canDragBlocks && !generationLocked
                      ? handleBlockPointerUp
                      : undefined
                  }
                  className={tileClass}
                  style={tileTransition}
                  title={
                    generationLocked
                      ? `${node.title} (generating — not clickable yet)`
                      : prereqEdit.active
                      ? highlightRole === "target"
                        ? `${node.title} (target — click other blocks to add/remove prereqs)`
                        : highlightRole === "prereq"
                          ? `${node.title} (prerequisite — click to remove)`
                          : `${node.title} (click to add as prerequisite)`
                      : isPrereqHighlight
                        ? `${node.title} (dependency of selected block)`
                        : lockedByPrereq
                          ? `${node.title} (locked — select, then Lock until to edit/clear prereqs)`
                          : hasDependencies
                            ? `${node.title} (depends on ${dependencyIds.length} block${dependencyIds.length === 1 ? "" : "s"})`
                            : hasLocalContext
                              ? `${node.title} (has local context)`
                              : node.title
                  }
                >
                  <span className="absolute left-1.5 top-1 font-mono text-[9px] text-neutral-500">
                    {formatGridCoordinate(nodeCell.row, nodeCell.col)}
                    {(span.span_w > 1 || span.span_h > 1) && (
                      <span className="text-neutral-600"> · {span.span_w}×{span.span_h}</span>
                    )}
                  </span>
                  <MapCellStatusGlyph
                    status={node.status}
                    showProgress={showProgress}
                    title={node.title}
                  />
                  {localContextBadge}
                  {lockBadge}
                </button>
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div
            className="pointer-events-none absolute bottom-2 left-2 right-2 z-10 max-w-[min(100%,22rem)] rounded-md border border-neutral-800/80 bg-neutral-950/80 px-2 py-1 text-[10px] text-neutral-500"
            data-map-status-bar
            data-prereq-edit-active={prereqEdit.active ? "true" : undefined}
          >
            {prereqEdit.active ? (
              <span className="text-neutral-300">
                Prereq edit: dashed outline = prerequisites · click to add/remove · Lock
                until saves
                {prereqEdit.stagedPrereqIds.length === 0
                  ? " (empty → clears all prereqs)"
                  : ` (${prereqEdit.stagedPrereqIds.length} staged)`}
                {" · "}Clear cancels
              </span>
            ) : previewTargetId && previewPrereqIds.length > 0 ? (
              <span className="text-neutral-400">
                Selected block depends on {previewPrereqIds.length} block
                {previewPrereqIds.length === 1 ? "" : "s"} (dashed outline)
              </span>
            ) : activeLassoShape === "rect" ? (
              `Rect lasso: drag a marquee (${selectedBlockIds.length} blocks · ${selectedEmptyCells.length} empty) · submenu for circle/freehand · Space pan`
            ) : activeLassoShape === "circle" ? (
              `Circle lasso: drag from center (${selectedBlockIds.length} blocks · ${selectedEmptyCells.length} empty) · Space pan`
            ) : activeLassoShape === "freehand" ? (
              `Freehand lasso: draw a path (${selectedBlockIds.length} blocks · ${selectedEmptyCells.length} empty) · Space pan`
            ) : manipulationMode ? (
              `Select: click block/empty · drag block to move · drag empty or Space/middle to pan (${selectedBlockIds.length} blocks · ${selectedEmptyCells.length} empty) · Shift multi · 1 empty → Add`
            ) : (
              labels.multiSelectHint ||
              "Select: click empty to Add · drag empty to pan · Shift multi empties for shape · Lasso for region."
            )}
            {!prereqEdit.active && shapeFootprint && selectedEmptyCells.length > 0 && (
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

      {/* Local fallback only when parent does not host right-pane empty create. */}
      {!useRightPaneEmpty && localPendingCell ? (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center bg-black/55 p-3 sm:items-center"
          data-local-add-fallback
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl shadow-black/50">
            <h3 className="text-sm font-medium text-white">{labels.addTitle}</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              Slot {formatGridCoordinate(localPendingCell.row, localPendingCell.col)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={!canSuggest || isSuggesting || busy}
                onClick={() => void handleSuggestLocalAdd()}
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
                  setLocalPendingCell(null);
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
                onClick={() => void submitLocalAdd()}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                {busy ? "..." : labels.addSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

            <div
              className="mt-3 space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2.5"
              data-shape-context-picker
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Attach context sources
              </p>
              <p className="text-[10px] leading-relaxed text-neutral-600">
                Selected files, external links, and notes become local context on the new
                block and feed generation.
              </p>
              {shapeContextLoading ? (
                <p className="text-[11px] text-neutral-600" data-shape-context-loading>
                  Loading sources…
                </p>
              ) : shapeContextOptions.length === 0 ? (
                <p className="text-[11px] text-neutral-600">
                  No Context sources yet — add files or links under the Context tab.
                </p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto" data-shape-context-list>
                  {shapeContextOptions.map((opt) => {
                    const checked = shapeContextSelected.includes(opt.key);
                    return (
                      <li key={opt.key}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[11px] transition ${
                            checked
                              ? "border-white/30 bg-white/10 text-neutral-100"
                              : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600"
                          }`}
                          data-shape-context-option={opt.key}
                          data-shape-context-kind={opt.kind}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() =>
                              setShapeContextSelected((prev) =>
                                toggleShapeContextSelection(prev, opt.key),
                              )
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{opt.label}</span>
                            <span className="block text-[10px] uppercase tracking-wide text-neutral-600">
                              {opt.kind}
                              {opt.url ? ` · link` : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {shapeContextSelected.length > 0 ? (
                <p className="text-[10px] text-neutral-500" data-shape-context-selected-count>
                  {shapeContextSelected.length} selected
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShapePromptOpen(false);
                  setPrompt("");
                  setSuggestions([]);
                  setSuggestError(null);
                  setShapeContextSelected([]);
                }}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                data-generate-shape-submit
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
                    contextSourceKeys: shapeContextSelected,
                  }).then(() => {
                    setShapeContextSelected([]);
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

    </div>
  );
}
