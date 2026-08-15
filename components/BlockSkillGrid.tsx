"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  SKILL_GRID_MAX_ZOOM,
  SKILL_GRID_MIN_ZOOM,
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
  applyLearnerNoteResize,
  canDeleteMapNote,
  canEditMapNoteContent,
  canMutateMapNoteGeometry,
  createLearnerMapNote,
  createLearnerMapNoteAtViewportCenter,
  defaultMapNotesPlaneVisible,
  deleteLearnerMapNote,
  learnerNoteLayerStyle,
  loadCreatorMapNotes,
  loadLearnerMapNotes,
  mapNoteSourceOf,
  mapNotesForPlaneRender,
  saveCreatorMapNotes,
  saveLearnerMapNotes,
  shouldMountMapNotes,
  shouldRenderMapNotesOnPlane,
  shouldShowMapNotesPlaneToggle,
  toggleLearnerMapNoteCollapsed,
  toggleMapNotesPlaneVisible,
  updateLearnerMapNote,
  upsertLearnerMapNote,
  type LearnerMapNote,
} from "@/lib/learner-map-notes";
import {
  ANNOTATION_DEFAULT_STROKE_WIDTH,
  ANNOTATION_STROKE_COLOR,
  ANNOTATION_STROKE_THICKNESSES,
  annotationEraserRadiusForThickness,
  annotationFreehandPathD,
  annotationScreenToWorld,
  appendAnnotationStroke,
  buildAnnotationStrokeFromGesture,
  canDeleteAnnotationLayer,
  canDrawOnAnnotationLayer,
  createAnnotationLayer,
  deleteAnnotationLayer,
  eraseAnnotationStrokesAlongPath,
  isAnnotationStrokeKind,
  loadAnnotationLayers,
  shouldShowAnnotationLayerToggles,
  saveAnnotationLayers,
  toggleAnnotationLayerVisible,
  upsertAnnotationLayer,
  type AnnotationDrawTool,
  type AnnotationLayer,
  type AnnotationPoint,
  type AnnotationStrokeThickness,
} from "@/lib/map-annotation-layers";
import { resolveMapOverlayPersistScope } from "@/lib/map-overlay-persist";
import { LearnerMapNotePostIt } from "@/components/LearnerMapNotePostIt";
import {
  parseBlockPracticeOptions,
  practiceOptionsIconKeys,
} from "@/lib/block-practice-options";
import {
  creatorEffectIconKeys,
  generatorCellKey,
  generatorTargetHighlightCells,
  isGeneratorEffectBusy,
  learnerDynamicMapLabel,
  parseBlockCreatorEffects,
  type BlockCreatorEffectKey,
} from "@/lib/block-creator-effects";
import {
  areBlocksContiguous,
  buildOccupancyFromPlaced,
  footprintFromBlock,
  footprintFromCells,
  freeformCellExternalEdges,
  freeformLabelCell,
  freeformShapeKeySet,
  freeformTilePixelSize,
  normalizeSpan,
  parseShapeCells,
  previewStretchBlockFromHandle,
  selectionIsFreeformLectureShape,
  STRETCH_HANDLES,
  stretchBlockFromHandle,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
  type StretchHandle,
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
  ileChapterCellChrome,
  isMapCellDoneStatus,
  mapCellFreeformColors,
  mapCellFreeformDoneColors,
  mapCellFreeformPrereqColors,
  mapCellFreeformSelfProgressColors,
} from "@/lib/map-cell-chrome";
import {
  LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS,
  learnerMapFreeformColors,
  resolveOccupiedMapTileChrome,
} from "@/lib/workspace-learner-chrome";
import {
  loadMapSelfProgressIds,
  MAP_SELF_PROGRESS_EVENT,
  recordMapItemWorkedOn,
  resolveMapSelfProgressScope,
  mapSelfProgressStorageKey,
} from "@/lib/map-self-progress";
import {
  chapterHasDagLockChrome,
  ileChapterUnlockHighlightIds,
  incompleteInboundNextPrerequisites,
  isChapterMapTileLocked,
  isLearnerMapBlockLocked,
  learnerBlockHasDependencyChrome,
  learnerMapDependencyHighlightIds,
} from "@/lib/learner-local-dag";
import { resolveMapOccupiedTileBadges } from "@/lib/map-tile-badges";
import {
  LassoShapeIcon,
  ToolIcon,
  toolTooltip,
} from "@/components/block-skill-grid/map-tool-icons";
import {
  BlockCreatorEffectsBadge,
  BlockDependencyLockBadge,
  BlockGeneratorTargetSparkBadge,
  BlockLocalContextDocBadge,
  BlockPracticeOptionsBadge,
  BlockStarterFlagBadge,
  MapCellStatusGlyph,
} from "@/components/block-skill-grid/map-tile-badges";
import {
  mapSelectionFromApplyPayload,
  workspaceMapSelectionHostApply,
} from "@/lib/workspace-map-selection";
import {
  isBlockLockedUntilCompleted,
  normalizeLockUntilBlockIds,
  unusableCellKeySet,
  type UnusableCell,
} from "@/lib/map-ground-rules";
import {
  buildMinimapClusterGraph,
  cellsForMinimapCluster,
  getPanZoomToOneToOneClusterView,
  MINIMAP_FRAME_HEIGHT,
  MINIMAP_FRAME_PADDING,
  MINIMAP_FRAME_WIDTH,
  panFromMinimapViewportDrag,
  placementsFromOccupiedCells,
  resolveMinimapViewportWindow,
  projectMinimapTiles,
  type MinimapCluster,
  type MinimapCountLabel,
  type MinimapGridCell,
} from "@/lib/map-minimap-clusters";
import {
  WORKSPACE_INTERACTION_MODES,
  workspaceModeDisplayLabel,
  type WorkspaceInteractionMode,
} from "@/lib/workspace-mode";
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
   * Generator empty-cell targets to spark-highlight on the map
   * (creator drawer pick or learner select on a generator block).
   */
  generatorTargetPreviewCells?: ReadonlyArray<{ row: number; col: number }> | null;
  /**
   * When true, empty-cell clicks toggle generator targets without opening Add
   * or clearing the focused block (generator drawer stays open).
   */
  generatorPickActive?: boolean;
  /** Called when an empty cell is clicked while generatorPickActive. */
  onGeneratorEmptyToggle?: (cell: { row: number; col: number }) => void;
  /**
   * When true, filled-block clicks toggle Dynamic unlock-after deps without
   * changing the focused block selection.
   */
  dynamicPickActive?: boolean;
  onDynamicBlockToggle?: (blockId: string) => void;
  /** Block ids to highlight as Dynamic unlock-after deps (draft or saved). */
  dynamicUnlockPreviewIds?: readonly string[] | null;
  /**
   * Learner-resolved dynamic generation flags (blockId → generated).
   * When missing, dynamic blocks show "?" map label.
   */
  dynamicContentGeneratedIds?: ReadonlySet<string> | readonly string[] | null;
  /**
   * Background multi-create jobs (range/density). Progress + stop render under the minimap.
   * Host owns the loop — map stays interactive while jobs run.
   */
  expandJobs?: readonly AddExpandJob[] | null;
  /** Abort one background expand job (stop remaining slots after current). */
  onAbortExpandJob?: (jobId: string) => void;
  /**
   * Cluster-blocks progress under the minimap (compute + save).
   * progress is 0..1; host clears when null.
   */
  clusterMapJob?: {
    active: boolean;
    progress: number;
    label: string;
  } | null;
  /**
   * Host-driven multi-select apply (Map Search / Suggest empty spots / clear).
   * When `token` increases, apply the same nextWorkspaceMapSelection result
   * the shell used (including explicit empty clear).
   */
  applyMapSelection?: {
    token: number;
    blockIds?: string[] | null;
    emptyCells?: Array<{ row: number; col: number }> | null;
  } | null;
  /**
   * Selective Explanation: free-shape draw mode independent of lasso multi-select.
   * Drawing does not toggle selectedBlockIds / empty cells.
   */
  selectiveExplanationActive?: boolean;
  /** Completed free-shape polygon in continuous grid coords (overlay display). */
  selectiveExplanationPolygon?: Array<{ x: number; y: number }> | null;
  /** Fired when free-shape draw completes (polygon in grid continuous coords). */
  onSelectiveExplanationComplete?: (
    polygon: Array<{ x: number; y: number }>,
  ) => void;
  /**
   * Inject a map Note at world plane position (Selective Explanation → Note).
   * When token increases, create note with body at (x, y).
   */
  injectMapNote?: {
    token: number;
    body: string;
    x: number;
    y: number;
    source?: "creator" | "learner";
  } | null;
  /**
   * Map explore open state + toggle (button under minimap, above Add Note).
   * Host owns open/close restore of the right column.
   */
  mapExploreOpen?: boolean;
  onMapExploreToggle?: () => void;
  /**
   * Build / Play mode toggle under minimap (right under the minimap frame).
   * When onInteractionModeChange is omitted, the toggle is hidden.
   */
  interactionMode?: "creator" | "learner";
  onInteractionModeChange?: (mode: "creator" | "learner") => void;
  /**
   * @deprecated Prefer onEmptySelectionChange — still maps single cell for older hosts.
   */
  onAddTargetChange?: (cell: GridCell | null) => void;
  canEdit: boolean;
  /**
   * Learner interaction mode: no authoring strip, no empty “+”, content color cues.
   * Pair with canEdit={false} for full learner map (minimap retained).
   */
  learnerMode?: boolean;
  /**
   * Public / marketing snapshot: pan+zoom only. No select, place, tools, notes, or practice.
   * Implies canEdit=false for interaction purposes.
   */
  viewOnly?: boolean;
  /**
   * Scope id for learner map notes persistence (user id / aycl token / guest).
   * Defaults to ayclToken or "local" when omitted.
   */
  learnerScopeId?: string | null;
  /**
   * Creator clone-paste: left-strip Clone arms host paste mode for sole selection.
   * Host owns arm state + empty-cell paste persist.
   */
  cloneArmed?: boolean;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel?: () => void;
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
  /** Multi-select / multi-cell / merge / split / move / resize ops (workspace builder). */
  onGridOp?: (payload: {
    op: "generate_shape" | "merge" | "split" | "move" | "resize" | "update_block" | "delete_block";
    prompt?: string;
    cells?: Array<{ row: number; col: number }>;
    blockIds?: string[];
    dRow?: number;
    dCol?: number;
    blockId?: string;
    /** Edge/corner stretch handle for resize. */
    handle?: StretchHandle;
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

const PAN_CLICK_THRESHOLD = 6;

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
  generatorTargetPreviewCells = null,
  generatorPickActive = false,
  onGeneratorEmptyToggle,
  dynamicPickActive = false,
  onDynamicBlockToggle,
  dynamicUnlockPreviewIds = null,
  dynamicContentGeneratedIds = null,
  expandJobs = null,
  onAbortExpandJob,
  clusterMapJob = null,
  applyMapSelection = null,
  selectiveExplanationActive = false,
  selectiveExplanationPolygon = null,
  onSelectiveExplanationComplete,
  injectMapNote = null,
  mapExploreOpen = false,
  onMapExploreToggle,
  interactionMode: interactionModeProp,
  onInteractionModeChange,
  canEdit: canEditProp,
  learnerMode = false,
  viewOnly = false,
  learnerScopeId = null,
  cloneArmed = false,
  onCloneArm,
  onCloneCancel,
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
  /** View-only public maps: no authoring, select, notes, or annotation tools. */
  const canEdit = canEditProp && !viewOnly;
  const unusableKeys = useMemo(
    () => unusableCellKeySet(unusableCells || []),
    [unusableCells],
  );

  /**
   * Map post-it notes (continuous plane):
   * - Creator notes: workspace-scoped, always visible in learner mode, not deletable by learners
   * - Learner notes: personal, learner mode only
   * - ILE chapter maps: session-scoped (no workspace store)
   * - Public view-only snapshots: existing notes/layers are shown (no authoring).
   */
  const overlayPersist = useMemo(
    () =>
      resolveMapOverlayPersistScope({
        workspaceId,
        sessionId,
        mapKind: suggestMode === "chapter" ? "chapter" : "workspace",
      }),
    [workspaceId, sessionId, suggestMode],
  );
  const mountMapNotes =
    shouldMountMapNotes({
      workspaceId,
      sessionId,
      mapKind: suggestMode === "chapter" ? "chapter" : "workspace",
      learnerMode,
    }) && Boolean(overlayPersist);
  const resolvedLearnerScope =
    String(learnerScopeId || ayclToken || "local").trim() || "local";
  const selfProgressScope = useMemo(
    () =>
      resolveMapSelfProgressScope({
        userId: resolvedLearnerScope,
        kind: suggestMode === "chapter" ? "chapter" : "workspace",
        scopeId: suggestMode === "chapter" ? sessionId : workspaceId,
      }),
    [resolvedLearnerScope, suggestMode, sessionId, workspaceId],
  );
  const [workedOnIds, setWorkedOnIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selfProgressScope) {
      setWorkedOnIds(new Set());
      return;
    }
    setWorkedOnIds(new Set(loadMapSelfProgressIds(selfProgressScope)));
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; ids?: string[] }>).detail;
      if (!detail || detail.key !== mapSelfProgressStorageKey(selfProgressScope)) {
        return;
      }
      setWorkedOnIds(new Set(Array.isArray(detail.ids) ? detail.ids : []));
    };
    window.addEventListener(MAP_SELF_PROGRESS_EVENT, onChange);
    return () => window.removeEventListener(MAP_SELF_PROGRESS_EVENT, onChange);
  }, [selfProgressScope]);

  useEffect(() => {
    if (suggestMode !== "chapter" || !selfProgressScope) return;
    const chapterId = String(focusedNodeId || "").trim();
    if (!chapterId) return;
    setWorkedOnIds(new Set(recordMapItemWorkedOn(selfProgressScope, chapterId)));
  }, [suggestMode, focusedNodeId, selfProgressScope]);

  const [creatorNotes, setCreatorNotes] = useState<LearnerMapNote[]>([]);
  const [learnerNotes, setLearnerNotes] = useState<LearnerMapNote[]>([]);
  /** Session UI: hide all post-its without clearing storage (like annotation layer eyes). */
  const [mapNotesPlaneVisible, setMapNotesPlaneVisible] = useState(
    defaultMapNotesPlaneVisible,
  );

  useEffect(() => {
    if (!mountMapNotes || !overlayPersist) {
      setCreatorNotes([]);
      setLearnerNotes([]);
      return;
    }
    const persist = {
      workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
      sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
      mapKind: overlayPersist.kind,
    };
    setCreatorNotes(loadCreatorMapNotes(persist));
    if (learnerMode) {
      setLearnerNotes(
        loadLearnerMapNotes({
          ...persist,
          learnerScopeId: resolvedLearnerScope,
        }),
      );
    } else {
      setLearnerNotes([]);
    }
  }, [mountMapNotes, overlayPersist, resolvedLearnerScope, learnerMode]);

  const mapNotes = useMemo(() => {
    if (!mountMapNotes) return [] as LearnerMapNote[];
    if (!learnerMode) return creatorNotes;
    const seen = new Set(creatorNotes.map((n) => n.id));
    const merged = [...creatorNotes];
    for (const n of learnerNotes) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      merged.push(n);
    }
    return merged;
  }, [mountMapNotes, learnerMode, creatorNotes, learnerNotes]);

  /** Notes drawn on the plane (empty when eye-hidden; collections stay intact). */
  const mapNotesOnPlane = useMemo(
    () => mapNotesForPlaneRender(mapNotes, mapNotesPlaneVisible),
    [mapNotes, mapNotesPlaneVisible],
  );

  const persistCreatorNotes = useCallback(
    (next: LearnerMapNote[]) => {
      setCreatorNotes(next);
      if (viewOnly || !overlayPersist) return;
      saveCreatorMapNotes({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
        notes: next,
      });
    },
    [overlayPersist, viewOnly],
  );

  const persistLearnerNotes = useCallback(
    (next: LearnerMapNote[]) => {
      setLearnerNotes(next);
      if (viewOnly || !overlayPersist) return;
      saveLearnerMapNotes({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
        learnerScopeId: resolvedLearnerScope,
        notes: next,
      });
    },
    [overlayPersist, resolvedLearnerScope, viewOnly],
  );

  const findMapNote = useCallback(
    (noteId: string): LearnerMapNote | undefined =>
      mapNotes.find((n) => n.id === noteId),
    [mapNotes],
  );

  const patchMapNote = useCallback(
    (noteId: string, updater: (existing: LearnerMapNote) => LearnerMapNote) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      const updated = updater(existing);
      if (mapNoteSourceOf(existing) === "creator") {
        persistCreatorNotes(upsertLearnerMapNote(creatorNotes, updated));
      } else {
        persistLearnerNotes(upsertLearnerMapNote(learnerNotes, updated));
      }
    },
    [
      creatorNotes,
      findMapNote,
      learnerNotes,
      persistCreatorNotes,
      persistLearnerNotes,
    ],
  );

  const handleLearnerNoteToggle = useCallback(
    (noteId: string) => {
      // Collapse allowed for everyone (including creator notes in learner mode).
      patchMapNote(noteId, (existing) =>
        toggleLearnerMapNoteCollapsed(existing),
      );
    },
    [patchMapNote],
  );

  const handleLearnerNoteSaveBody = useCallback(
    (noteId: string, body: string) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canEditMapNoteContent(existing, { learnerMode, viewOnly })) return;
      patchMapNote(noteId, (n) => updateLearnerMapNote(n, { body }));
    },
    [findMapNote, learnerMode, patchMapNote, viewOnly],
  );

  const handleLearnerNoteDelete = useCallback(
    (noteId: string) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canDeleteMapNote(existing, { learnerMode, viewOnly })) return;
      if (mapNoteSourceOf(existing) === "creator") {
        persistCreatorNotes(deleteLearnerMapNote(creatorNotes, noteId));
      } else {
        persistLearnerNotes(deleteLearnerMapNote(learnerNotes, noteId));
      }
    },
    [
      creatorNotes,
      findMapNote,
      learnerMode,
      learnerNotes,
      persistCreatorNotes,
      persistLearnerNotes,
      viewOnly,
    ],
  );

  const handleLearnerNoteDragEnd = useCallback(
    (noteId: string, next: { x: number; y: number }) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canMutateMapNoteGeometry(existing, { learnerMode, viewOnly })) return;
      patchMapNote(noteId, (n) =>
        updateLearnerMapNote(n, { x: next.x, y: next.y }),
      );
    },
    [findMapNote, learnerMode, patchMapNote, viewOnly],
  );

  const handleLearnerNoteResizeEnd = useCallback(
    (noteId: string, next: { width: number; height: number }) => {
      const existing = findMapNote(noteId);
      if (!existing) return;
      if (!canMutateMapNoteGeometry(existing, { learnerMode, viewOnly })) return;
      patchMapNote(noteId, (n) =>
        applyLearnerNoteResize(n, {
          width: next.width,
          height: next.height,
        }),
      );
    },
    [findMapNote, learnerMode, patchMapNote, viewOnly],
  );

  // ── Annotation layers (stacked freehand; white-only; creator draws/deletes) ──
  const [annotationLayers, setAnnotationLayers] = useState<AnnotationLayer[]>(
    [],
  );
  /** Creator: selected layer id enables left-strip annotation toolbox. */
  const [activeAnnotationLayerId, setActiveAnnotationLayerId] = useState<
    string | null
  >(null);
  const [annotationDrawTool, setAnnotationDrawTool] =
    useState<AnnotationDrawTool>("freehand");
  const [annotationStrokeThickness, setAnnotationStrokeThickness] =
    useState<AnnotationStrokeThickness>(ANNOTATION_DEFAULT_STROKE_WIDTH);
  const [annotationNameDraft, setAnnotationNameDraft] = useState("");
  const [annotationNameOpen, setAnnotationNameOpen] = useState(false);
  const annotationDrawRef = useRef<{
    pointerId: number;
    layerId: string;
    kind: AnnotationDrawTool;
    startLocal: AnnotationPoint;
    curLocal: AnnotationPoint;
    pointsLocal: AnnotationPoint[];
  } | null>(null);
  const [annotationDrawPreview, setAnnotationDrawPreview] = useState<{
    kind: AnnotationDrawTool;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    points: AnnotationPoint[];
    strokeWidth: number;
  } | null>(null);
  const minimapStackRef = useRef<HTMLDivElement>(null);
  const [minimapStackHeight, setMinimapStackHeight] = useState(0);

  useEffect(() => {
    if (!overlayPersist) {
      setAnnotationLayers([]);
      setActiveAnnotationLayerId(null);
      return;
    }
    setAnnotationLayers(
      loadAnnotationLayers({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
      }),
    );
  }, [overlayPersist]);

  useEffect(() => {
    const el = minimapStackRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setMinimapStackHeight(el?.offsetHeight ?? 0);
      return;
    }
    const ro = new ResizeObserver(() => {
      setMinimapStackHeight(el.offsetHeight);
    });
    ro.observe(el);
    setMinimapStackHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [annotationLayers.length, mountMapNotes, learnerMode, annotationNameOpen]);

  // Leaving creator annotation mode when switching to learner
  useEffect(() => {
    if (learnerMode) {
      setActiveAnnotationLayerId(null);
      setAnnotationNameOpen(false);
      annotationDrawRef.current = null;
      setAnnotationDrawPreview(null);
    }
  }, [learnerMode]);

  const persistAnnotationLayers = useCallback(
    (next: AnnotationLayer[]) => {
      setAnnotationLayers(next);
      if (viewOnly || !overlayPersist) return;
      saveAnnotationLayers({
        workspaceId: overlayPersist.kind === "workspace" ? overlayPersist.id : undefined,
        sessionId: overlayPersist.kind === "chapter" ? overlayPersist.id : undefined,
        mapKind: overlayPersist.kind,
        layers: next,
      });
    },
    [overlayPersist, viewOnly],
  );

  const annotationDrawingActive =
    !viewOnly &&
    !learnerMode &&
    canDrawOnAnnotationLayer({ learnerMode, viewOnly }) &&
    Boolean(activeAnnotationLayerId);

  const handleAnnotationLayerAdd = useCallback(() => {
    if (viewOnly || learnerMode || !overlayPersist) return;
    const name =
      annotationNameDraft.trim() ||
      `Layer ${annotationLayers.length + 1}`;
    const layer = createAnnotationLayer({ name });
    persistAnnotationLayers(
      upsertAnnotationLayer(annotationLayers, layer),
    );
    setAnnotationNameDraft("");
    setAnnotationNameOpen(false);
    setActiveAnnotationLayerId(layer.id);
    setAnnotationDrawTool("freehand");
  }, [
    annotationLayers,
    annotationNameDraft,
    learnerMode,
    persistAnnotationLayers,
    overlayPersist,
    viewOnly,
  ]);

  const handleAnnotationLayerSelect = useCallback(
    (layerId: string) => {
      if (viewOnly || learnerMode) return;
      setActiveAnnotationLayerId((prev) =>
        prev === layerId ? null : layerId,
      );
    },
    [learnerMode, viewOnly],
  );

  const handleAnnotationLayerDelete = useCallback(
    (layerId: string) => {
      if (!canDeleteAnnotationLayer({ learnerMode, viewOnly })) return;
      const next = deleteAnnotationLayer(annotationLayers, layerId, {
        learnerMode,
        viewOnly,
      });
      persistAnnotationLayers(next);
      if (activeAnnotationLayerId === layerId) {
        setActiveAnnotationLayerId(null);
      }
    },
    [
      activeAnnotationLayerId,
      annotationLayers,
      learnerMode,
      persistAnnotationLayers,
      viewOnly,
    ],
  );

  const handleAnnotationLayerToggle = useCallback(
    (layerId: string) => {
      const existing = annotationLayers.find((l) => l.id === layerId);
      if (!existing) return;
      persistAnnotationLayers(
        upsertAnnotationLayer(
          annotationLayers,
          toggleAnnotationLayerVisible(existing),
        ),
      );
    },
    [annotationLayers, persistAnnotationLayers],
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

  /**
   * Sole-block edge/corner stretch: preview-only until pointerup settles via resize op.
   * Distinct from body move-drag so handle pointers never arm translate.
   */
  const stretchDragRef = useRef<{
    pointerId: number;
    blockId: string;
    handle: StretchHandle;
    originRow: number;
    originCol: number;
    moved: boolean;
  } | null>(null);
  const [stretchPreview, setStretchPreview] = useState<PlacedBlockRef | null>(null);

  /** Generate-in-shape / merge dialogs still use local prompt + suggest (not single-cell add). */
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(SKILL_GRID_DEFAULT_ZOOM_AT_REFERENCE);

  /** One-shot: drop a note at the center of the current viewport (continuous plane). */
  const handleMapNoteAddAtCenter = useCallback(() => {
    if (viewOnly || !mountMapNotes || !overlayPersist) return;
    const el = viewportRef.current;
    const vw = el?.clientWidth || viewportSize.width || 640;
    const vh = el?.clientHeight || viewportSize.height || 480;
    if (learnerMode) {
      const note = createLearnerMapNoteAtViewportCenter({
        viewportWidth: vw,
        viewportHeight: vh,
        panX: pan.x,
        panY: pan.y,
        zoom,
        body: "",
        source: "learner",
      });
      persistLearnerNotes(upsertLearnerMapNote(learnerNotes, note));
    } else {
      const note = createLearnerMapNoteAtViewportCenter({
        viewportWidth: vw,
        viewportHeight: vh,
        panX: pan.x,
        panY: pan.y,
        zoom,
        body: "",
        source: "creator",
      });
      persistCreatorNotes(upsertLearnerMapNote(creatorNotes, note));
    }
  }, [
    creatorNotes,
    learnerMode,
    learnerNotes,
    mountMapNotes,
    pan.x,
    pan.y,
    persistCreatorNotes,
    persistLearnerNotes,
    viewportSize.height,
    viewportSize.width,
    overlayPersist,
    viewOnly,
    zoom,
  ]);
  // Alias for any residual call sites / structural tests.
  const handleLearnerNoteAddAtCenter = handleMapNoteAddAtCenter;

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
  /** Tracks Creator/Learner so mode flips can drop map selection chrome. */
  const learnerModeRef = useRef(learnerMode);
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
  /** Swallow synthetic click only after empty-cell pan (not shared with block select). */
  const suppressEmptyClickRef = useRef(false);
  /** Explicit prereq-edit: target + staged prereqs; confirm/cancel write or discard. */
  const [prereqEdit, setPrereqEdit] = useState<PrereqEditState>(EMPTY_PREREQ_EDIT);
  const prereqEditRef = useRef<PrereqEditState>(EMPTY_PREREQ_EDIT);
  prereqEditRef.current = prereqEdit;
  const [shapePromptOpen, setShapePromptOpen] = useState(false);
  const [mergePromptOpen, setMergePromptOpen] = useState(false);

  const [localBusy, setLocalBusy] = useState(false);
  const [visibleAppearing, setVisibleAppearing] = useState<Set<string>>(new Set());
  /**
   * Optimistic geometry after move/resize so the map settles instantly
   * while the server save runs (no full-map freeze).
   */
  type OptimisticPlacement = {
    position_x: number;
    position_y: number;
    span_w: number;
    span_h: number;
    shape_cells?: ReturnType<typeof parseShapeCells>;
  };
  const [optimisticPlacements, setOptimisticPlacements] = useState<
    Record<string, OptimisticPlacement>
  >({});
  /** Quiet save indicator under minimap (move/resize/geometry). */
  const [mapSaveJobs, setMapSaveJobs] = useState<
    Array<{
      id: string;
      label: string;
      status: "saving" | "saved" | "error";
      error?: string;
    }>
  >([]);
  /**
   * Serialize geometry network ops so rapid drag/resizes keep correct server deltas
   * while the map stays interactive with optimistic placements.
   */
  const geometrySaveChainRef = useRef(Promise.resolve<void>(undefined));
  /** Generate-in-shape: multi-select Context sources (files / external / notes). */
  const [shapeContextOptions, setShapeContextOptions] = useState<ShapeContextSourceOption[]>(
    [],
  );
  const [shapeContextSelected, setShapeContextSelected] = useState<string[]>([]);
  const [shapeContextLoading, setShapeContextLoading] = useState(false);

  // Creator ↔ Learner: drop local map selection (parent clears drawers separately).
  useEffect(() => {
    if (learnerModeRef.current === learnerMode) return;
    learnerModeRef.current = learnerMode;
    selectedEmptyCellsRef.current = [];
    selectedBlockIdsRef.current = [];
    setSelectedEmptyCells([]);
    setSelectedBlockIds([]);
    setShapePromptOpen(false);
    setMergePromptOpen(false);
    setPrompt("");
    setLocalPendingCell(null);
    setPrereqEdit(EMPTY_PREREQ_EDIT);
    setBlockDragOffset(null);
    setBlockDragIds(null);
    setStretchPreview(null);
    pendingSelectClickRef.current = null;
    blockDragRef.current = null;
    stretchDragRef.current = null;
  }, [learnerMode]);

  // Host-driven apply / clear — same nextWorkspaceMapSelection result as the shell.
  const applyMapSelectionTokenRef = useRef(0);
  useEffect(() => {
    if (!applyMapSelection || !applyMapSelection.token) return;
    if (applyMapSelection.token === applyMapSelectionTokenRef.current) return;
    applyMapSelectionTokenRef.current = applyMapSelection.token;
    const next = mapSelectionFromApplyPayload({
      blockIds: applyMapSelection.blockIds,
      emptyCells: applyMapSelection.emptyCells,
    });
    const applied = workspaceMapSelectionHostApply(next);

    selectedBlockIdsRef.current = applied.selectedBlockIds;
    setSelectedBlockIds(applied.selectedBlockIds);
    selectedEmptyCellsRef.current = applied.selectedEmptyCells;
    setSelectedEmptyCells(applied.selectedEmptyCells);
    setShapePromptOpen(false);
    setMergePromptOpen(false);
    setPrompt("");
    setLocalPendingCell(null);

    onEmptySelectionChange?.(applied.emitEmpty);
    onSelectedBlockIdsChange?.(applied.emitFilled);
    if (applied.selectNodeId || (applied.emitFilled && applied.emitFilled.length > 0)) {
      onAddTargetChange?.(null);
    }
    onSelectNode(applied.selectNodeId);
  }, [
    applyMapSelection,
    onAddTargetChange,
    onEmptySelectionChange,
    onSelectNode,
    onSelectedBlockIdsChange,
  ]);

  // Selective Explanation free-shape draw (independent of lasso selection).
  const selectiveDragRef = useRef<{
    pointerId: number;
    points: Array<{ x: number; y: number }>;
  } | null>(null);
  const [selectiveDrawOverlay, setSelectiveDrawOverlay] = useState<Array<{
    x: number;
    y: number;
  }> | null>(null);
  const selectiveExplanationActiveRef = useRef(selectiveExplanationActive);
  selectiveExplanationActiveRef.current = selectiveExplanationActive;

  // Inject map Note from Selective Explanation → Note.
  const injectMapNoteTokenRef = useRef(0);
  useEffect(() => {
    if (!injectMapNote || !injectMapNote.token) return;
    if (injectMapNote.token === injectMapNoteTokenRef.current) return;
    injectMapNoteTokenRef.current = injectMapNote.token;
    if (!mountMapNotes || !overlayPersist) return;
    const body = String(injectMapNote.body || "").trim();
    const source =
      injectMapNote.source === "learner" || injectMapNote.source === "creator"
        ? injectMapNote.source
        : learnerMode
          ? "learner"
          : "creator";
    const note = createLearnerMapNote({
      body,
      x: Number(injectMapNote.x) || 0,
      y: Number(injectMapNote.y) || 0,
      source,
    });
    if (source === "learner" || learnerMode) {
      persistLearnerNotes(upsertLearnerMapNote(learnerNotes, note));
    } else {
      persistCreatorNotes(upsertLearnerMapNote(creatorNotes, note));
    }
  }, [
    creatorNotes,
    injectMapNote,
    learnerMode,
    learnerNotes,
    mountMapNotes,
    persistCreatorNotes,
    persistLearnerNotes,
    overlayPersist,
  ]);

  // Drop optimistic rows once parent nodes catch up from the server.
  useEffect(() => {
    setOptimisticPlacements((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const id of ids) {
        const o = next[id];
        const n = nodes.find((x) => x.id === id);
        if (!n || n.position_x == null || n.position_y == null) continue;
        if (
          n.position_x === o.position_x &&
          n.position_y === o.position_y &&
          normalizeSpan(n.span_w) === o.span_w &&
          normalizeSpan(n.span_h) === o.span_h
        ) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [nodes]);

  /** Nodes with optimistic move/resize applied for live map chrome. */
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
  /**
   * Learner: when a block is selected, highlight its local-DAG dependencies
   * (prereqs / unlocks / next peers) on the map.
   */
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

  /** ILE chapter: selecting a locked chapter highlights only direct blocking prereqs. */
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

  /** Generator spark on empty cells: host preview, or learner select on a generator. */
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
    return new Set(
      (dynamicUnlockPreviewIds || []).map(String).filter(Boolean),
    );
  }, [dynamicUnlockPreviewIds]);
  const { occupancy, placements, spans, startCell } = useMemo(
    () => buildSkillGridLayout(displayNodes),
    [displayNodes],
  );
  /** Placed refs + occupancy for stretch preview/settle (honors freeform masks). */
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
    for (const node of displayNodes) {
      if (placements.has(node.id)) ids.add(node.id);
    }
    return ids;
  }, [displayNodes, placements]);

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

  const minimapPlacements = useMemo(
    () => placementsFromOccupiedCells(occupiedByBlockId),
    [occupiedByBlockId],
  );

  const minimapGraph = useMemo(
    () => buildMinimapClusterGraph(minimapPlacements),
    [minimapPlacements],
  );

  /** Mini map tiles + fog (no inter-cluster link edges). */
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

  /** Main-map camera projected onto the minimap frame (viewport indicator). */
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

  /** Drag state for the minimap viewport rect → main-map pan. */
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

  const panToMinimapCell = useCallback(
    (cell: MinimapGridCell) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      // Single cell: 1:1 zoom centered on that cell
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
    },
    [],
  );

  const panToCluster = useCallback(
    (cluster: MinimapCluster | MinimapCountLabel) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      // Resolve full cluster (labels only carry center + id)
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

      // Selective Explanation free-shape (independent of block/empty selection).
      // Capture on the stable viewport — never on a surface that unmounts mid-gesture.
      if (selectiveExplanationActiveRef.current && !viewOnly) {
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
      shapePromptOpen,
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
      annotationLayers,
      annotationStrokeThickness,
      canEdit,
      learnerMode,
      nodes,
      occupancy,
      onAddTargetChange,
      onEmptySelectionChange,
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

      // Public snapshot: pan/zoom only — no open/select.
      if (viewOnly) {
        event.preventDefault();
        return;
      }

      // Radius/density expand job membership — not selectable while generating.
      if (generationLockedBlockIdsRef.current.has(blockId)) {
        event.preventDefault();
        return;
      }

      // Dynamic pick: toggle unlock-after deps without changing focus.
      if (dynamicPickActive && onDynamicBlockToggle) {
        event.preventDefault();
        // Never toggle the focused dynamic block itself.
        if (blockId !== selectedNodeId) {
          onDynamicBlockToggle(blockId);
        }
        return;
      }

      if (!canEdit) {
        // Learner / read-only: sole-select for map highlight + open detail.
        // Map chrome keys off selectedBlockIds (not only selectedNodeId prop).
        selectedBlockIdsRef.current = [blockId];
        setSelectedBlockIds([blockId]);
        if (selectedEmptyCellsRef.current.length > 0) {
          selectedEmptyCellsRef.current = [];
          setSelectedEmptyCells([]);
        }
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
    [
      activeTool,
      applyBlockSelection,
      canEdit,
      dynamicPickActive,
      manipulationMode,
      onDynamicBlockToggle,
      onSelectNode,
      selectedNodeId,
      viewOnly,
    ],
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

      // Public view-only: swallow block press so pan still works on empty space.
      if (viewOnly) {
        event.stopPropagation();
        event.preventDefault();
        suppressBlockClickRef.current = true;
        return;
      }

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

      // ── Dynamic pick: toggle unlock-after deps without changing focus ──
      if (canEdit && dynamicPickActive && onDynamicBlockToggle) {
        event.stopPropagation();
        event.preventDefault();
        if (blockId !== selectedNodeId) {
          onDynamicBlockToggle(blockId);
        }
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
      dynamicPickActive,
      emitFilledBlockSelection,
      manipulationMode,
      onAddTargetChange,
      onDynamicBlockToggle,
      onEmptySelectionChange,
      onGridOp,
      onSelectNode,
      selectedNodeId,
      viewOnly,
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
      // Swallow only after empty-cell pan (do NOT share suppressBlockClickRef —
      // block click-and-drag left that true and blocked every empty select).
      if (suppressEmptyClickRef.current) {
        suppressEmptyClickRef.current = false;
        event.preventDefault?.();
        event.stopPropagation?.();
        return;
      }

      if (!canEdit || busy) return;
      if (isCellOccupied(occupancy, cell.row, cell.col)) return;
      // Lasso modes own the gesture — never open add or select empties from click.
      if (isLassoModeTool(activeToolRef.current)) return;

      const isUnusable = unusableKeys.has(`${cell.row}:${cell.col}`);

      // Generator pick: toggle empty (placeable) cells only; keep block focus.
      if (generatorPickActive && onGeneratorEmptyToggle && !isUnusable) {
        event.preventDefault?.();
        event.stopPropagation?.();
        onGeneratorEmptyToggle({ row: cell.row, col: cell.col });
        return;
      }

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
      generatorPickActive,
      occupancy,
      onGeneratorEmptyToggle,
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
      if (!onGridOp) return;
      const isGeometry = payload.op === "move" || payload.op === "resize";
      // Geometry ops never freeze the map — optimistic + quiet save under minimap.
      if (!isGeometry && busy) return;

      setAddError(null);

      if (isGeometry) {
        // ── Instant optimistic settle (map never freezes) ──────────────
        if (payload.op === "move") {
          const ids = (payload.blockIds || []).filter(Boolean);
          const moving = placedBlocksForStretch.filter((b) => ids.includes(b.id));
          const next = translateBlocksPreservingShape(
            moving,
            Number(payload.dRow) || 0,
            Number(payload.dCol) || 0,
            stretchOccupancy,
          );
          if (!next) {
            setAddError("Move collides with occupied cells");
            return;
          }
          setOptimisticPlacements((prev) => {
            const m = { ...prev };
            for (const b of next) {
              m[b.id] = {
                position_x: b.position_x,
                position_y: b.position_y,
                span_w: normalizeSpan(b.span_w),
                span_h: normalizeSpan(b.span_h),
                shape_cells: parseShapeCells(b.shape_cells ?? null),
              };
            }
            return m;
          });
        } else if (payload.op === "resize" && payload.blockId && payload.handle) {
          const source = placedBlocksForStretch.find((b) => b.id === payload.blockId);
          if (source) {
            const settled = stretchBlockFromHandle(
              source,
              payload.handle,
              Number(payload.dRow) || 0,
              Number(payload.dCol) || 0,
              stretchOccupancy,
            );
            if (!settled) {
              setAddError("Resize invalid (collision or no-op)");
              return;
            }
            setOptimisticPlacements((prev) => ({
              ...prev,
              [settled.id]: {
                position_x: settled.position_x,
                position_y: settled.position_y,
                span_w: normalizeSpan(settled.span_w),
                span_h: normalizeSpan(settled.span_h),
                shape_cells: null,
              },
            }));
          }
        }

        const saveId = `geom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const saveLabel = payload.op === "move" ? "Saving move…" : "Saving resize…";
        setMapSaveJobs((j) => [
          ...j,
          { id: saveId, label: saveLabel, status: "saving" },
        ]);

        // Network work is queued so rapid successive moves keep correct deltas
        // while UI already shows the settled geometry.
        const persistGeometry = async () => {
          try {
            await onGridOp(payload);
            setMapSaveJobs((j) =>
              j.map((x) =>
                x.id === saveId ? { ...x, status: "saved", label: "Saved" } : x,
              ),
            );
            window.setTimeout(() => {
              setMapSaveJobs((j) => j.filter((x) => x.id !== saveId));
            }, 1200);
          } catch (error) {
            // Revert optimistic geometry for this op's blocks only
            if (payload.op === "move" && payload.blockIds) {
              setOptimisticPlacements((prev) => {
                const m = { ...prev };
                for (const id of payload.blockIds || []) delete m[id];
                return m;
              });
            } else if (payload.op === "resize" && payload.blockId) {
              setOptimisticPlacements((prev) => {
                const m = { ...prev };
                delete m[payload.blockId!];
                return m;
              });
            }
            const msg =
              error instanceof Error ? error.message : "Grid operation failed";
            setMapSaveJobs((j) =>
              j.map((x) =>
                x.id === saveId
                  ? { ...x, status: "error", label: "Save failed", error: msg }
                  : x,
              ),
            );
            setAddError(msg);
            window.setTimeout(() => {
              setMapSaveJobs((j) => j.filter((x) => x.id !== saveId));
            }, 2800);
            throw error;
          }
        };

        const queued = geometrySaveChainRef.current.then(
          persistGeometry,
          persistGeometry,
        );
        // Keep the chain alive after errors so later geometry saves still run.
        geometrySaveChainRef.current = queued.then(
          () => undefined,
          () => undefined,
        );
        await queued.catch(() => undefined);
        return;
      }

      // Heavy ops (merge/split/generate): soft busy, no full-map freeze preferred —
      // still use localBusy only for double-submit guards; overlay removed globally.
      setLocalBusy(true);
      try {
        await onGridOp(payload);
        clearSelection();
      } catch (error) {
        setAddError(
          error instanceof Error ? error.message : "Grid operation failed",
        );
      } finally {
        setLocalBusy(false);
      }
    },
    [
      busy,
      clearSelection,
      onGridOp,
      placedBlocksForStretch,
      stretchOccupancy,
    ],
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
      case "clone": {
        if (!onCloneArm || !isBlockMapToolEnabled("clone", toolEnablement)) {
          // Toggle cancel when already armed even if selection changed mid-arm.
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
  /**
   * Stretch handles only when exactly one block is selected (sole selection),
   * edit + grid-ops available, not in prereq-edit. Multi-select / empty omit them.
   */
  const soleStretchBlockId =
    canEdit &&
    canDragBlocks &&
    !prereqEdit.active &&
    !busy &&
    selectedBlockIds.length === 1
      ? selectedBlockIds[0]
      : null;

  const stretchHandleStyle = (handle: StretchHandle): CSSProperties => {
    const base: CSSProperties = {
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 2,
      zIndex: 30,
      boxSizing: "border-box",
    };
    switch (handle) {
      case "n":
        return { ...base, top: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" };
      case "s":
        return { ...base, bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" };
      case "e":
        return { ...base, right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
      case "w":
        return { ...base, left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
      case "ne":
        return { ...base, top: -5, right: -5, cursor: "nesw-resize" };
      case "nw":
        return { ...base, top: -5, left: -5, cursor: "nwse-resize" };
      case "se":
        return { ...base, bottom: -5, right: -5, cursor: "nwse-resize" };
      case "sw":
        return { ...base, bottom: -5, left: -5, cursor: "nesw-resize" };
      default:
        return base;
    }
  };

  const renderStretchHandles = (blockId: string) => {
    if (soleStretchBlockId !== blockId) return null;
    if (generationLockedBlockIds.has(blockId)) return null;
    return (
      <div
        className="pointer-events-none absolute inset-0"
        data-stretch-handles
        data-stretch-block={blockId}
      >
        {STRETCH_HANDLES.map((handle) => (
          <div
            key={handle}
            role="presentation"
            data-stretch-handle={handle}
            data-stretch-block={blockId}
            className="pointer-events-auto border border-white/90 bg-neutral-200 shadow-sm hover:bg-neutral-300"
            style={stretchHandleStyle(handle)}
            title={`Stretch ${handle.toUpperCase()}`}
            onPointerDown={(e) => handleStretchPointerDown(blockId, handle, e)}
          />
        ))}
      </div>
    );
  };

  const renderToolButton = (tool: BlockMapToolId) => {
    // Clone stays clickable while armed so creators can cancel even if selection
    // briefly fails enablement mid-arm.
    const enabled =
      isBlockMapToolEnabled(tool, toolEnablement) ||
      (tool === "clone" && cloneArmed && Boolean(onCloneCancel));
    const isActiveMode =
      ((tool === "select" || tool === "lasso") && activeTool === tool) ||
      (tool === "lock_until" && prereqEdit.active) ||
      (tool === "clone" && cloneArmed);
    const title =
      tool === "lock_until" && prereqEdit.active
        ? prereqEdit.stagedPrereqIds.length === 0
          ? "Confirm: clear all prerequisites for this block"
          : "Confirm: save staged prerequisites (empty set clears all)"
        : tool === "lasso"
          ? `${toolTooltip(tool, labels, { cloneArmed })} · ${lassoShapeTooltip(lassoShape)}`
          : toolTooltip(tool, labels, { cloneArmed });
    return (
      <button
        key={tool}
        type="button"
        data-block-map-tool={tool}
        data-active={isActiveMode ? "true" : "false"}
        data-clone-armed={
          tool === "clone" ? (cloneArmed ? "true" : "false") : undefined
        }
        data-lasso-shape={tool === "lasso" ? lassoShape : undefined}
        data-prereq-edit-active={
          tool === "lock_until" && prereqEdit.active ? "true" : undefined
        }
        disabled={!enabled}
        onClick={() => handleToolClick(tool)}
        title={title}
        aria-label={title}
        aria-pressed={
          tool === "select" ||
          tool === "lasso" ||
          tool === "lock_until" ||
          tool === "clone"
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
      data-learner-mode={learnerMode ? "true" : "false"}
      data-map-view-only={viewOnly ? "true" : "false"}
      data-learner-notes={mountMapNotes ? "true" : "false"}
      data-map-notes={mountMapNotes ? "true" : "false"}
      data-map-notes-plane-visible={
        mountMapNotes && shouldRenderMapNotesOnPlane(mapNotesPlaneVisible)
          ? "true"
          : "false"
      }
      data-annotation-layers={String(annotationLayers.length)}
      data-annotation-drawing={annotationDrawingActive ? "true" : "false"}
      data-clone-armed={cloneArmed ? "true" : "false"}
      data-map-minimap="true"
    >
      {/* No full-map freeze on geometry saves — quiet indicator under minimap. */}
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        {/* Full-height icon rail — hidden in Learner / view-only modes.
            When an annotation layer is selected, strip becomes white-only draw tools. */}
        {!learnerMode && !viewOnly ? (
        <div
          data-block-map-tool-strip
          data-annotation-tool-strip={
            annotationDrawingActive ? "true" : "false"
          }
          data-annotation-active-layer={activeAnnotationLayerId || undefined}
          className="flex h-full w-11 shrink-0 flex-col items-center border-r border-neutral-800/80 bg-neutral-950/95 py-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {annotationDrawingActive ? (
            <div
              className="flex flex-col items-center gap-0.5"
              data-annotation-toolbox
              role="group"
              aria-label="Annotation tools"
            >
              <p className="mb-1 px-0.5 text-center text-[8px] font-medium uppercase tracking-wide text-neutral-500">
                Draw
              </p>
              {(
                [
                  { id: "circle" as const, label: "Circle", title: "Circle (white)" },
                  { id: "square" as const, label: "Square", title: "Square (white)" },
                  {
                    id: "freehand" as const,
                    label: "Free",
                    title: "Freehand (white)",
                  },
                  {
                    id: "eraser" as const,
                    label: "Erase",
                    title: "Eraser — remove strokes under the brush",
                  },
                ] as const
              ).map((tool) => {
                const active = annotationDrawTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    data-annotation-tool={tool.id}
                    data-active={active ? "true" : "false"}
                    title={tool.title}
                    aria-label={tool.title}
                    aria-pressed={active}
                    onClick={() => setAnnotationDrawTool(tool.id)}
                    className={`flex h-8 w-8 flex-col items-center justify-center rounded border text-white transition ${
                      active
                        ? "border-white/50 bg-white/15"
                        : "border-transparent text-white/70 hover:border-neutral-600 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {tool.id === "circle" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="7" />
                      </svg>
                    ) : tool.id === "square" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        aria-hidden
                      >
                        <rect x="5" y="5" width="14" height="14" rx="1" />
                      </svg>
                    ) : tool.id === "freehand" ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M5 17c2-4 4-8 7-8s5 2 7 6" />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M16.5 3.5l4 4-11 11H5.5v-4.1l11-10.9z" />
                        <path d="M14 6l4 4" />
                      </svg>
                    )}
                    <span className="sr-only">{tool.label}</span>
                  </button>
                );
              })}
              <div
                className="my-1.5 h-px w-6 bg-neutral-700/80"
                aria-hidden
              />
              <p className="mb-0.5 px-0.5 text-center text-[7px] font-medium uppercase tracking-wide text-neutral-500">
                Width
              </p>
              <div
                className="flex flex-col items-center gap-0.5"
                data-annotation-thickness-group
                role="group"
                aria-label="Stroke thickness"
              >
                {ANNOTATION_STROKE_THICKNESSES.map((w, idx) => {
                  const active = annotationStrokeThickness === w;
                  const label =
                    idx === 0 ? "Thin" : idx === 1 ? "Medium" : "Thick";
                  const dot = idx === 0 ? 4 : idx === 1 ? 7 : 10;
                  return (
                    <button
                      key={w}
                      type="button"
                      data-annotation-thickness={w}
                      data-active={active ? "true" : "false"}
                      title={`${label} stroke`}
                      aria-label={`${label} stroke`}
                      aria-pressed={active}
                      onClick={() => setAnnotationStrokeThickness(w)}
                      className={`flex h-7 w-8 items-center justify-center rounded border transition ${
                        active
                          ? "border-white/50 bg-white/15"
                          : "border-transparent hover:border-neutral-600 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className="rounded-full bg-white"
                        style={{ width: dot, height: dot }}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
              <div className="my-1.5 h-px w-6 bg-neutral-700/80" aria-hidden />
              <button
                type="button"
                data-annotation-exit
                title="Exit annotation drawing (back to map tools)"
                onClick={() => setActiveAnnotationLayerId(null)}
                className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-[10px] text-neutral-400 hover:border-neutral-600 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
        ) : null}

        <div
          ref={viewportRef}
          className={`relative min-h-0 flex-1 touch-none overflow-hidden ${
            spaceHeld
              ? "cursor-grab active:cursor-grabbing"
              : annotationDrawingActive
                ? "cursor-crosshair"
                : activeLassoShape
                  ? "cursor-crosshair"
                  : activeTool === "select"
                    ? "cursor-grab"
                    : "cursor-default"
          }`}
          data-map-lasso-mode={activeLassoShape || "false"}
          data-map-lasso-shape={activeLassoShape || undefined}
          data-annotation-drawing={annotationDrawingActive ? "true" : "false"}
          data-selective-explanation-active={
            selectiveExplanationActive ? "true" : "false"
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
        {/* Selective Explanation live free-shape (independent of lasso selection). */}
        {selectiveDrawOverlay && selectiveDrawOverlay.length > 0 ? (
          <svg
            data-selective-explanation-draw
            className="pointer-events-none absolute inset-0 z-[14] h-full w-full overflow-visible"
            aria-hidden
          >
            <polygon
              fill="rgba(255, 255, 255, 0.08)"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={selectiveDrawOverlay.map((p) => `${p.x},${p.y}`).join(" ")}
            />
          </svg>
        ) : null}
        {/* Completed selective overlay in world/grid space (rendered via continuous grid → screen). */}
        {selectiveExplanationPolygon &&
        selectiveExplanationPolygon.length >= 3 &&
        !selectiveDrawOverlay ? (
          <svg
            data-selective-explanation-overlay
            className="pointer-events-none absolute inset-0 z-[13] h-full w-full overflow-visible"
            aria-hidden
          >
            <polygon
              fill="rgba(255, 255, 255, 0.06)"
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeDasharray="4 3"
              points={selectiveExplanationPolygon
                .map((p) => {
                  const sx = p.x * SKILL_GRID_PITCH * zoom + pan.x;
                  const sy = p.y * SKILL_GRID_PITCH * zoom + pan.y;
                  return `${sx},${sy}`;
                })
                .join(" ")}
            />
          </svg>
        ) : null}
        {/* Full-map surface for Selective Explanation free-shape.
            Stay mounted for the entire active draw lifetime (mirror annotation surface).
            Unmounting on selectiveDrawOverlay would release pointer capture mid-gesture. */}
        {selectiveExplanationActive ? (
          <div
            data-selective-explanation-surface
            className="absolute inset-0 z-[11] cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ) : null}
        {lassoOverlay?.kind === "rect" ? (
          <div
            data-map-lasso-rect
            className="pointer-events-none absolute z-[12] border border-neutral-500/80 bg-neutral-800/10"
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
            className="pointer-events-none absolute z-[12] rounded-full border border-neutral-500/80 bg-neutral-800/10"
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

        {/* Full-map capture surface while annotation drawing is active (draw over blocks).
            Sits under minimap/stack chrome (z-20) so those stay clickable. */}
        {annotationDrawingActive ? (
          <div
            data-annotation-draw-surface
            className="absolute inset-0 z-[11] cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ) : null}

        {/* Live annotation draw preview (viewport-local, white / eraser dashed) */}
        {annotationDrawPreview ? (
          <svg
            data-annotation-draw-preview
            data-annotation-preview-kind={annotationDrawPreview.kind}
            className="pointer-events-none absolute inset-0 z-[13] h-full w-full overflow-visible"
            aria-hidden
          >
            {annotationDrawPreview.kind === "circle" ? (
              <circle
                cx={
                  (annotationDrawPreview.startX + annotationDrawPreview.curX) / 2
                }
                cy={
                  (annotationDrawPreview.startY + annotationDrawPreview.curY) / 2
                }
                r={Math.max(
                  1,
                  Math.hypot(
                    annotationDrawPreview.curX - annotationDrawPreview.startX,
                    annotationDrawPreview.curY - annotationDrawPreview.startY,
                  ) / 2,
                )}
                fill="none"
                stroke={ANNOTATION_STROKE_COLOR}
                strokeWidth={annotationDrawPreview.strokeWidth}
              />
            ) : annotationDrawPreview.kind === "square" ? (
              <rect
                x={Math.min(
                  annotationDrawPreview.startX,
                  annotationDrawPreview.curX,
                )}
                y={Math.min(
                  annotationDrawPreview.startY,
                  annotationDrawPreview.curY,
                )}
                width={Math.max(
                  1,
                  Math.abs(
                    annotationDrawPreview.curX - annotationDrawPreview.startX,
                  ),
                )}
                height={Math.max(
                  1,
                  Math.abs(
                    annotationDrawPreview.curY - annotationDrawPreview.startY,
                  ),
                )}
                fill="none"
                stroke={ANNOTATION_STROKE_COLOR}
                strokeWidth={annotationDrawPreview.strokeWidth}
              />
            ) : annotationDrawPreview.kind === "eraser" ? (
              <path
                d={annotationFreehandPathD(annotationDrawPreview.points)}
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth={Math.max(
                  6,
                  annotationDrawPreview.strokeWidth * 3,
                )}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 4"
              />
            ) : (
              <path
                d={annotationFreehandPathD(annotationDrawPreview.points)}
                fill="none"
                stroke={ANNOTATION_STROKE_COLOR}
                strokeWidth={annotationDrawPreview.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        ) : null}
        {/* Rectangular minimap: mini map tiles + soft fog (no hard bbox / no edges) */}
        <div
          data-block-minimap
          data-minimap-mode="tiles"
          data-minimap-cluster-count={minimapGraph.clusters.length}
          data-minimap-block-count={minimapTileView.totalBlocks}
          data-minimap-tile-count={minimapTileView.tiles.length}
          data-minimap-empty={
            minimapTileView.tiles.length === 0 ? "true" : "false"
          }
          className="pointer-events-auto absolute right-2 top-2 z-20 overflow-hidden rounded-md border border-neutral-700/90 bg-neutral-950/95 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
          style={{ width: MINIMAP_FRAME_WIDTH, height: MINIMAP_FRAME_HEIGHT }}
          onPointerDown={(e) => e.stopPropagation()}
          title={
            minimapTileView.tiles.length > 0
              ? "Minimap — click a cluster or square for 1:1 view"
              : "Minimap — create blocks to see them here"
          }
        >
          {minimapTileView.tiles.length === 0 ? (
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
              aria-label="Block map minimap"
              data-minimap-tile-view
            >
              <defs>
                <radialGradient
                  id="minimap-fog-gradient"
                  cx="50%"
                  cy="50%"
                  r="75%"
                >
                  <stop offset="0%" stopColor="rgba(14,14,16,0.2)" />
                  <stop offset="60%" stopColor="rgba(8,8,10,0.55)" />
                  <stop offset="100%" stopColor="rgba(4,4,6,0.88)" />
                </radialGradient>
                <pattern
                  id="minimap-fog-noise"
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="7" height="7" fill="rgba(16,16,20,0.35)" />
                  <circle cx="1.4" cy="2.2" r="0.5" fill="rgba(70,70,78,0.28)" />
                  <circle cx="4.5" cy="5" r="0.4" fill="rgba(55,55,62,0.3)" />
                  <circle cx="3.2" cy="1.2" r="0.3" fill="rgba(90,90,100,0.2)" />
                </pattern>
              </defs>
              {/* Soft ambient fog only — no hard rectangular fog-cell bbox around clusters */}
              <rect
                data-minimap-fog-base
                x={0}
                y={0}
                width={MINIMAP_FRAME_WIDTH}
                height={MINIMAP_FRAME_HEIGHT}
                fill="url(#minimap-fog-gradient)"
              />
              <rect
                data-minimap-fog-texture
                x={0}
                y={0}
                width={MINIMAP_FRAME_WIDTH}
                height={MINIMAP_FRAME_HEIGHT}
                fill="url(#minimap-fog-noise)"
                opacity={0.7}
                pointerEvents="none"
              />
              {/* Occupied mini squares (map tiles) — pointerdown → 1:1 navigation */}
              {minimapTileView.tiles.map((tile) => (
                <rect
                  key={`tile-${tile.blockId}-${tile.row}:${tile.col}`}
                  data-minimap-tile
                  data-minimap-tile-block={tile.blockId}
                  data-minimap-tile-row={tile.row}
                  data-minimap-tile-col={tile.col}
                  x={tile.x}
                  y={tile.y}
                  width={tile.w}
                  height={tile.h}
                  rx={Math.min(1.5, tile.w * 0.2)}
                  fill="rgba(255,255,255,0.82)"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={0.6}
                  className="cursor-pointer transition hover:fill-white"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    panToMinimapCell({ row: tile.row, col: tile.col });
                  }}
                />
              ))}
              {/* Invisible cluster hit targets (no visible circles / numbers) */}
              {minimapTileView.labels.map((label) => {
                const r = Math.min(16, 10 + Math.log2(label.count + 1) * 2);
                return (
                  <g
                    key={label.clusterId}
                    data-minimap-cluster={label.clusterId}
                    data-minimap-cluster-count={label.count}
                    data-minimap-center-block={label.centerBlockId}
                    className="cursor-pointer"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      panToCluster(label);
                    }}
                  >
                    <circle
                      data-minimap-cluster-hit
                      cx={label.x}
                      cy={label.y}
                      r={r}
                      fill="transparent"
                      stroke="none"
                    />
                  </g>
                );
              })}
              {/* Counts kept as data attrs only (not rendered) for tests / tooling */}
              <g
                data-minimap-total-blocks={minimapTileView.totalBlocks}
                data-minimap-counts-hidden="true"
              />
              {/* Main-map viewport indicator — drag pans the real map */}
              {minimapViewportRect ? (
                <rect
                  data-minimap-viewport-rect
                  data-minimap-viewport-window
                  x={minimapViewportRect.x}
                  y={minimapViewportRect.y}
                  width={minimapViewportRect.w}
                  height={minimapViewportRect.h}
                  fill="rgba(96, 165, 250, 0.18)"
                  stroke="rgba(147, 197, 253, 0.95)"
                  strokeWidth={1.5}
                  rx={2}
                  className="cursor-grab active:cursor-grabbing"
                  style={{ pointerEvents: "all" }}
                  onPointerDown={onMinimapViewportPointerDown}
                  onPointerMove={onMinimapViewportPointerMove}
                  onPointerUp={onMinimapViewportPointerUp}
                  onPointerCancel={onMinimapViewportPointerUp}
                />
              ) : null}
            </svg>
          )}
        </div>

        {/* Right stack under minimap: Build/Play, Explore Map, Add note, layers.
            View-only preview: only existing notes + handwriting toggles (no authoring). */}
        {(!viewOnly &&
          (mountMapNotes ||
            overlayPersist ||
            workspaceId ||
            onMapExploreToggle ||
            onInteractionModeChange)) ||
        (viewOnly &&
          (shouldShowMapNotesPlaneToggle(mapNotes.length) ||
            shouldShowAnnotationLayerToggles(annotationLayers.length))) ? (
          <div
            ref={minimapStackRef}
            data-map-minimap-stack
            data-learner-map-notes-toolbar={mountMapNotes ? "true" : undefined}
            data-learner-notes-under-minimap={mountMapNotes ? "true" : undefined}
            data-map-notes-mode={learnerMode ? "learner" : "creator"}
            className="pointer-events-auto absolute right-2 z-20 flex flex-col gap-1"
            style={{
              top: 8 + MINIMAP_FRAME_HEIGHT + 8,
              width: MINIMAP_FRAME_WIDTH,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {!viewOnly && typeof onInteractionModeChange === "function" ? (
              <div
                className="flex w-full shrink-0 items-center gap-0.5 rounded-md border border-neutral-700/90 bg-neutral-950/90 p-0.5 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                data-workspace-mode-toggle
                data-workspace-mode-under-minimap
                role="group"
                aria-label="Workspace mode"
              >
                {WORKSPACE_INTERACTION_MODES.map((id) => {
                  const mode: WorkspaceInteractionMode =
                    interactionModeProp === "learner" ||
                    interactionModeProp === "creator"
                      ? interactionModeProp
                      : learnerMode
                        ? "learner"
                        : "creator";
                  const active = mode === id;
                  const label = workspaceModeDisplayLabel(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      data-workspace-mode={id}
                      data-active={active ? "true" : "false"}
                      aria-pressed={active}
                      aria-label={label}
                      onClick={() => onInteractionModeChange(id)}
                      className={`min-w-0 flex-1 rounded px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide transition ${
                        active
                          ? "bg-white/15 text-white"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {!viewOnly && typeof onMapExploreToggle === "function" ? (
              <button
                type="button"
                data-map-explore-toggle
                data-map-explore-under-minimap
                data-map-explore-expand-toggle
                data-map-explore-open={mapExploreOpen ? "true" : "false"}
                aria-label={
                  mapExploreOpen
                    ? "Close Explore / Expand Map"
                    : "Open Explore / Expand Map"
                }
                aria-pressed={mapExploreOpen}
                title={
                  mapExploreOpen
                    ? "Close Expand Map drawers"
                    : "Explore / Expand Map: search, spots, overview, selective summary"
                }
                onClick={() => onMapExploreToggle()}
                className={`w-full rounded-md border px-2.5 py-1.5 text-left text-[11px] font-medium shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm transition ${
                  mapExploreOpen
                    ? "border-white/30 bg-white text-black hover:bg-neutral-200"
                    : "border-neutral-700/90 bg-neutral-950/90 text-neutral-200 hover:text-white"
                }`}
              >
                Explore / Expand Map
              </button>
            ) : null}
            {mountMapNotes &&
            (!viewOnly || shouldShowMapNotesPlaneToggle(mapNotes.length)) ? (
              <div
                className="flex items-stretch gap-0.5 rounded-md border border-neutral-700/90 bg-neutral-950/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                data-map-notes-visibility-row
                data-map-notes-visibility={
                  mapNotesPlaneVisible ? "visible" : "hidden"
                }
              >
                {!viewOnly ? (
                <button
                  type="button"
                  data-learner-note-add
                  data-map-note-add
                  title={
                    learnerMode
                      ? "Add a personal note in the middle of the map"
                      : "Add an author note in the middle of the map (visible to learners)"
                  }
                  onClick={() => handleMapNoteAddAtCenter()}
                  className="min-w-0 flex-1 px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200 transition hover:text-white"
                >
                  Add note
                </button>
                ) : (
                <span className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200">
                  Notes
                </span>
                )}
                <button
                  type="button"
                  data-map-notes-visibility-toggle
                  data-learner-notes-visibility-toggle
                  data-map-notes-visibility={
                    mapNotesPlaneVisible ? "visible" : "hidden"
                  }
                  title={
                    mapNotesPlaneVisible
                      ? "Hide all notes on the map"
                      : "Show notes on the map"
                  }
                  aria-label={
                    mapNotesPlaneVisible ? "Hide notes" : "Show notes"
                  }
                  aria-pressed={mapNotesPlaneVisible}
                  onClick={() =>
                    setMapNotesPlaneVisible((prev) =>
                      toggleMapNotesPlaneVisible(prev),
                    )
                  }
                  className={`flex shrink-0 items-center justify-center px-1.5 ${
                    mapNotesPlaneVisible ? "text-white" : "text-neutral-500"
                  }`}
                >
                  {mapNotesPlaneVisible ? (
                    <svg
                      data-map-notes-eye="open"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
                      />
                      <circle cx="12" cy="12" r="2.75" />
                    </svg>
                  ) : (
                    <svg
                      data-map-notes-eye="closed"
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.5 3.5l17 17"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.6 10.7a2.75 2.75 0 003.7 3.7"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.9 5.1A11 11 0 0112 4.9c5.5 0 9 5.9 9.5 7.1-.3.7-1.2 2.4-3 3.9M6.1 6.2C4.1 7.7 3 9.6 2.5 12c.4 1 3.5 6.5 9.5 6.5 1.1 0 2.1-.2 3-.5"
                      />
                    </svg>
                  )}
                </button>
              </div>
            ) : null}

            {/* Small separator between Add note and annotation layers */}
            {mountMapNotes &&
            overlayPersist &&
            (!viewOnly ||
              (shouldShowMapNotesPlaneToggle(mapNotes.length) &&
                shouldShowAnnotationLayerToggles(annotationLayers.length))) ? (
              <div
                data-map-notes-layers-separator
                role="separator"
                aria-hidden
                className="mx-1 my-0.5 h-px shrink-0 bg-neutral-700/70"
              />
            ) : null}

            {/* Annotation layers: creator add/select/delete; learner toggle under Add note */}
            {overlayPersist &&
            (!viewOnly ||
              shouldShowAnnotationLayerToggles(annotationLayers.length)) ? (
              <div
                data-annotation-layers-stack
                data-annotation-layers-under-notes="true"
                data-annotation-layer-count={annotationLayers.length}
                className="flex flex-col gap-1"
              >
                {!viewOnly && !learnerMode ? (
                  annotationNameOpen ? (
                    <div
                      className="rounded-md border border-neutral-700/90 bg-neutral-950/95 p-1.5 shadow-lg"
                      data-annotation-layer-name-form
                    >
                      <input
                        type="text"
                        data-annotation-layer-name-input
                        value={annotationNameDraft}
                        maxLength={48}
                        placeholder="Layer name"
                        autoFocus
                        onChange={(e) => setAnnotationNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAnnotationLayerAdd();
                          if (e.key === "Escape") {
                            setAnnotationNameOpen(false);
                            setAnnotationNameDraft("");
                          }
                        }}
                        className="mb-1 w-full rounded border border-neutral-700 bg-black/40 px-2 py-1 text-left text-[11px] text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          data-annotation-layer-add-confirm
                          onClick={() => handleAnnotationLayerAdd()}
                          className="flex-1 rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-white hover:bg-white/15"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          data-annotation-layer-add-cancel
                          onClick={() => {
                            setAnnotationNameOpen(false);
                            setAnnotationNameDraft("");
                          }}
                          className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-annotation-layer-add
                      title="Add a freehand annotation layer"
                      onClick={() => setAnnotationNameOpen(true)}
                      className="w-full rounded-md border border-neutral-700/90 bg-neutral-950/90 px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:border-neutral-500 hover:text-white"
                    >
                      Add layer
                    </button>
                  )
                ) : null}

                {annotationLayers.map((layer) => {
                  const selected =
                    !viewOnly &&
                    !learnerMode &&
                    activeAnnotationLayerId === layer.id;
                  const canDelete = canDeleteAnnotationLayer({
                    learnerMode,
                    viewOnly,
                  });
                  return (
                    <div
                      key={layer.id}
                      data-annotation-layer-row={layer.id}
                      data-annotation-layer-visible={
                        layer.visible ? "true" : "false"
                      }
                      className={`flex items-stretch gap-0.5 rounded-md border bg-neutral-950/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
                        selected
                          ? "border-white/40"
                          : "border-neutral-700/90"
                      }`}
                    >
                      {!viewOnly && !learnerMode ? (
                        <button
                          type="button"
                          data-annotation-layer-select={layer.id}
                          data-active={selected ? "true" : "false"}
                          title={
                            selected
                              ? "Drawing on this layer (click to deselect)"
                              : "Select layer to draw"
                          }
                          onClick={() => handleAnnotationLayerSelect(layer.id)}
                          className={`min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[11px] font-medium transition ${
                            selected
                              ? "text-white"
                              : "text-neutral-200 hover:text-white"
                          }`}
                        >
                          {layer.name}
                        </button>
                      ) : (
                        <span
                          className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-[11px] font-medium text-neutral-200"
                          data-annotation-layer-label={layer.id}
                        >
                          {layer.name}
                        </span>
                      )}
                      <button
                        type="button"
                        data-annotation-layer-toggle={layer.id}
                        data-annotation-visibility={
                          layer.visible ? "visible" : "hidden"
                        }
                        title={layer.visible ? "Hide layer" : "Show layer"}
                        aria-label={
                          layer.visible ? "Hide layer" : "Show layer"
                        }
                        aria-pressed={layer.visible}
                        onClick={() => handleAnnotationLayerToggle(layer.id)}
                        className={`flex shrink-0 items-center justify-center px-1.5 ${
                          layer.visible
                            ? "text-white"
                            : "text-neutral-500"
                        }`}
                      >
                        {layer.visible ? (
                          <svg
                            data-annotation-eye="open"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
                            />
                            <circle cx="12" cy="12" r="2.75" />
                          </svg>
                        ) : (
                          <svg
                            data-annotation-eye="closed"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3.5 3.5l17 17"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M10.6 10.7a2.75 2.75 0 003.7 3.7"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.9 5.1A11 11 0 0112 4.9c5.5 0 9 5.9 9.5 7.1-.3.7-1.2 2.4-3 3.9M6.1 6.2C4.1 7.7 3 9.6 2.5 12c.4 1 3.5 6.5 9.5 6.5 1.1 0 2.1-.2 3-.5"
                            />
                          </svg>
                        )}
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          data-annotation-layer-delete={layer.id}
                          title="Delete annotation layer"
                          aria-label={`Delete ${layer.name}`}
                          onClick={() => handleAnnotationLayerDelete(layer.id)}
                          className="shrink-0 px-1.5 text-[12px] text-neutral-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Quiet geometry save status (move/resize) — under minimap, map stays interactive */}
        {mapSaveJobs.length > 0 ? (
          <div
            data-map-geometry-saves
            data-map-geometry-save-count={mapSaveJobs.length}
            className="pointer-events-none absolute right-2 z-20 flex flex-col gap-1"
            style={{
              top:
                8 +
                MINIMAP_FRAME_HEIGHT +
                8 +
                (minimapStackHeight > 0
                  ? minimapStackHeight + 8
                  : mountMapNotes
                    ? 40
                    : 0),
              width: MINIMAP_FRAME_WIDTH,
            }}
          >
            {mapSaveJobs.map((job) => (
              <div
                key={job.id}
                data-map-geometry-save={job.id}
                data-map-geometry-save-status={job.status}
                className="rounded-md border border-white/15 bg-neutral-950/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  {job.status === "saving" ? (
                    <span
                      className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white/80"
                      data-map-geometry-save-pulse
                      aria-hidden
                    />
                  ) : job.status === "saved" ? (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/90"
                      aria-hidden
                    />
                  )}
                  <p
                    className={`min-w-0 flex-1 truncate text-[10px] font-medium ${
                      job.status === "error"
                        ? "text-rose-200"
                        : job.status === "saved"
                          ? "text-emerald-100/90"
                          : "text-neutral-100"
                    }`}
                  >
                    {job.label}
                  </p>
                </div>
                {job.status === "saving" ? (
                  <div
                    className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800"
                    data-map-geometry-save-bar
                  >
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-white/70" />
                  </div>
                ) : null}
                {job.error ? (
                  <p className="mt-1 text-[10px] text-rose-300/90">{job.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Cluster blocks progress — under minimap while computing/saving */}
        {clusterMapJob?.active ? (
          <div
            data-map-cluster-job
            data-map-cluster-job-active="true"
            className="pointer-events-none absolute right-2 z-20 flex flex-col gap-1"
            style={{
              top:
                8 +
                MINIMAP_FRAME_HEIGHT +
                8 +
                (minimapStackHeight > 0
                  ? minimapStackHeight + 8
                  : mountMapNotes
                    ? 40
                    : 0) +
                (mapSaveJobs.length > 0 ? mapSaveJobs.length * 52 + 8 : 0),
              width: MINIMAP_FRAME_WIDTH,
            }}
          >
            <div
              className="rounded-md border border-white/15 bg-neutral-950/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              data-map-cluster-progress
            >
              <div className="mb-1 flex items-start justify-between gap-1.5">
                <p
                  className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-100"
                  data-map-cluster-progress-label
                >
                  {clusterMapJob.label || "Clustering…"}
                </p>
                <span className="shrink-0 font-mono text-[10px] text-neutral-300">
                  {Math.round(Math.max(0, Math.min(1, clusterMapJob.progress)) * 100)}%
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800"
                role="progressbar"
                aria-valuenow={Math.round(
                  Math.max(0, Math.min(1, clusterMapJob.progress)) * 100,
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={clusterMapJob.label || "Clustering"}
                data-map-cluster-progress-bar
              >
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
                  data-map-cluster-progress-fill
                  style={{
                    width: `${Math.round(Math.max(0, Math.min(1, clusterMapJob.progress)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Background range/density multi-create jobs — under minimap; map stays interactive */}
        {Array.isArray(expandJobs) && expandJobs.length > 0 ? (
          <div
            data-map-expand-jobs
            data-map-expand-job-count={expandJobs.length}
            className="pointer-events-auto absolute right-2 z-20 flex max-h-[min(40vh,16rem)] flex-col gap-1.5 overflow-y-auto"
            style={{
              top:
                8 +
                MINIMAP_FRAME_HEIGHT +
                8 +
                (minimapStackHeight > 0
                  ? minimapStackHeight + 8
                  : mountMapNotes
                    ? 40
                    : 0) +
                (mapSaveJobs.length > 0 ? mapSaveJobs.length * 52 + 8 : 0) +
                (clusterMapJob?.active ? 56 : 0),
              width: MINIMAP_FRAME_WIDTH,
            }}
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
            const isGeneratorSparkEmpty = generatorSparkEmptyKeys.has(cellKeyStr);
            // Running-job slots pulse; host range/bridge previews are static white.
            const previewEmpty = generationPending || hostPreviewEmpty;
            const emptyHighlight =
              selectedEmpty || previewEmpty || isGeneratorSparkEmpty;
            const isUnusable = unusableKeys.has(cellKeyStr);
            return (
              <div
                key={`empty-${cell.row}:${cell.col}`}
                data-skill-cell
                data-map-cell-kind={isUnusable ? "unusable" : "open"}
                data-generator-target-empty={
                  isGeneratorSparkEmpty ? "true" : undefined
                }
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
                  // Keep enabled for empty-drag pan in Learner (!canEdit).
                  // Authoring (Add) still gated in handleEmptyCellClick via canEdit.
                  disabled={busy || generationPending}
                  data-map-cell-unusable={isUnusable ? "true" : "false"}
                  data-map-cell-selected={emptyHighlight ? "true" : "false"}
                  data-empty-preview={previewEmpty && !selectedEmpty ? "true" : "false"}
                  data-generator-spark-empty={
                    isGeneratorSparkEmpty ? "true" : undefined
                  }
                  data-generation-pending={generationPending ? "true" : "false"}
                  data-empty-pan-enabled={
                    !busy && !generationPending ? "true" : "false"
                  }
                  onClick={(e) => {
                    // Primary path for empty select / Add (plain + Shift multi).
                    // Empty pan sets suppressEmptyClickRef so this is skipped.
                    handleEmptyCellClick(cell, e);
                  }}
                  onPointerDown={(e) => handleEmptyCellPointerDown(cell, e)}
                  onPointerMove={handleEmptyCellPointerMove}
                  onPointerUp={handleEmptyCellPointerUp}
                  onPointerCancel={handleEmptyCellPointerUp}
                  className={`relative flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed transition ${
                    isUnusable
                      ? generationPending
                        ? `${MAP_CELL_UNUSABLE_CLASS} ring-2 ring-white/50 animate-pulse`
                        : emptyHighlight
                          ? `${MAP_CELL_UNUSABLE_CLASS} ring-2 ring-white/50`
                          : MAP_CELL_UNUSABLE_CLASS
                      : isGeneratorSparkEmpty
                        ? MAP_CELL_EMPTY_SELECTED_CLASS
                      : generationPending
                        ? MAP_CELL_GENERATION_PENDING_CLASS
                        : emptyHighlight
                          ? MAP_CELL_EMPTY_SELECTED_CLASS
                          : canEdit
                            ? "border-neutral-700/90 bg-neutral-950/35 text-neutral-600 hover:border-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300"
                            : learnerMode
                              ? "cursor-grab border-neutral-800/70 bg-neutral-950/20 text-neutral-600 active:cursor-grabbing"
                              : "border-neutral-800/70 bg-neutral-950/20 text-neutral-600 opacity-50"
                  }`}
                  title={
                    generationPending
                      ? "Generating block here…"
                      : isGeneratorSparkEmpty
                        ? generatorPickActive
                          ? "Generator target — click to remove"
                          : "Will be generated when the generator block completes"
                      : isUnusable
                      ? canEdit
                        ? activeLassoShape
                          ? "Unusable ground — drag lasso to multi-select, then Unusable tool to clear"
                          : "Unusable ground — click to select, then Unusable tool to clear"
                        : "Unusable ground — shapes paths"
                      : canEdit
                        ? generatorPickActive
                          ? "Click to select as generator target"
                          : activeLassoShape
                          ? "Drag to lasso-select blocks or empty cells"
                          : activeTool === "select" || activeTool === "move"
                            ? "Click empty to Add · drag empty to pan · Shift multi for shape form · Space/middle pan"
                            : labels.emptyCell
                        : learnerMode
                          ? "Drag empty to pan · Space/middle pan · click a block to practice"
                          : undefined
                  }
                >
                  {isGeneratorSparkEmpty ? <BlockGeneratorTargetSparkBadge /> : null}
                  {isUnusable ? (
                    <span className="text-[9px] uppercase tracking-wide text-neutral-600">∅</span>
                  ) : (
                    canEdit &&
                    !learnerMode &&
                    !isGeneratorSparkEmpty && (
                      <span
                        className="text-xl leading-none text-neutral-600"
                        data-empty-cell-plus
                      >
                        +
                      </span>
                    )
                  )}
                </button>
              </div>
            );
          })}

          {/* Map post-it notes — continuous plane layer (shares pan/zoom with blocks).
              Creator notes always in collection for learners; plane eye can hide all post-its. */}
          {mountMapNotes
            ? mapNotesOnPlane.map((note) => {
                const layer = learnerNoteLayerStyle(note);
                const permCtx = { learnerMode, viewOnly };
                return (
                  <LearnerMapNotePostIt
                    key={note.id}
                    note={note}
                    style={layer}
                    zoom={zoom}
                    canDelete={canDeleteMapNote(note, permCtx)}
                    canEdit={canEditMapNoteContent(note, permCtx)}
                    canDragResize={canMutateMapNoteGeometry(note, permCtx)}
                    onToggleCollapsed={handleLearnerNoteToggle}
                    onSaveBody={handleLearnerNoteSaveBody}
                    onDelete={handleLearnerNoteDelete}
                    onDragEnd={handleLearnerNoteDragEnd}
                    onResizeEnd={handleLearnerNoteResizeEnd}
                  />
                );
              })
            : null}

          {/* Occupied blocks: solid rect or freeform multi-tile lecture */}
          {[...renderedBlockIds].map((blockId) => {
            const node = nodesById.get(blockId);
            const nodeCell = placements.get(blockId);
            if (!node || !nodeCell) return null;
            const baseSpan = spans.get(blockId) || {
              span_w: normalizeSpan(node.span_w),
              span_h: normalizeSpan(node.span_h),
            };
            // Live stretch preview overrides geometry until mouseup settle (no persist mid-drag).
            const liveStretch =
              stretchPreview?.id === blockId ? stretchPreview : null;
            const span = liveStretch
              ? {
                  span_w: normalizeSpan(liveStretch.span_w),
                  span_h: normalizeSpan(liveStretch.span_h),
                }
              : baseSpan;
            const renderCell = liveStretch
              ? { row: liveStretch.position_y, col: liveStretch.position_x }
              : nodeCell;
            // During stretch preview always draw solid rect of the candidate bbox.
            const occupiedCells = liveStretch
              ? Array.from({ length: span.span_h }, (_, dr) =>
                  Array.from({ length: span.span_w }, (_, dc) => ({
                    row: renderCell.row + dr,
                    col: renderCell.col + dc,
                  })),
                ).flat()
              : skillNodeOccupiedCells(node);
            const freeform = liveStretch
              ? false
              : Array.isArray(node.shape_cells) &&
                node.shape_cells.length > 0 &&
                occupiedCells.length > 0 &&
                occupiedCells.length !== span.span_w * span.span_h;
            // Map multi-select membership. Also treat controlled selectedNodeId as
            // sole selection in learner / when list is empty (detail focus).
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

            // Sole focus from selectedNodeId when multi list empty or learner mode
            // (read-only click only set selectedNodeId historically).
            const chapterFocusOnly =
              (selectedBlockIds.length === 0 || learnerMode) &&
              !multiSelected &&
              (focusedNodeId === node.id || selectedNodeId === node.id);
            const isBlockHighlighted = multiSelected || chapterFocusOnly;
            const lockUntilIds = normalizeLockUntilBlockIds(
              node.lock_until_block_ids,
              node.id,
            );
            const learnerNodeRef = {
              id: node.id,
              title: node.title,
              status: node.status,
              lock_until_block_ids: node.lock_until_block_ids,
              next_block_ids: node.next_block_ids,
              creator_effects: (
                node as { creator_effects?: unknown }
              ).creator_effects,
            };
            const learnerBlocksRef = displayNodes.map((n) => ({
              id: n.id,
              title: n.title,
              status: n.status,
              lock_until_block_ids: n.lock_until_block_ids,
              next_block_ids: n.next_block_ids,
              creator_effects: (
                n as { creator_effects?: unknown }
              ).creator_effects,
            }));
            // Both modes: lock_until + inbound next (DAG leads-to) + Dynamic unlock-after.
            // Locked state: learner uses status-aware gate; creator uses lock_until complete.
            const lockedByPrereq =
              suggestMode === "chapter"
                ? isChapterMapTileLocked(learnerNodeRef, learnerBlocksRef)
                : learnerMode
                  ? isLearnerMapBlockLocked(learnerNodeRef, learnerBlocksRef)
                  : isBlockLockedUntilCompleted(node, nodesById);
            const inboundNextIncomplete = incompleteInboundNextPrerequisites(
              learnerNodeRef,
              learnerBlocksRef,
            );
            const dependencyIds = [
              ...lockUntilIds,
              ...inboundNextIncomplete.map((b) => b.id),
            ].filter((id, i, arr) => arr.indexOf(id) === i);
            // Chapter tiles: DAG lock only. Workspace: lock_until + inbound next + Dynamic.
            const hasDependencies =
              suggestMode === "chapter"
                ? chapterHasDagLockChrome(learnerNodeRef, learnerBlocksRef)
                : learnerBlockHasDependencyChrome(
                    learnerNodeRef,
                    learnerBlocksRef,
                  );
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
            const isLearnerDepHighlight =
              suggestMode === "chapter"
                ? !isBlockHighlighted &&
                  chapterUnlockHighlightIds.has(node.id)
                : learnerMode &&
                  !isBlockHighlighted &&
                  learnerDepHighlightIds.has(node.id);
            const itemWorkedOn = workedOnIds.has(node.id);
            const itemDone = isMapCellDoneStatus(displayStatus);
            const chapterChrome =
              suggestMode === "chapter"
                ? ileChapterCellChrome({
                    status: displayStatus,
                    selected: isBlockHighlighted,
                    focused: chapterFocusOnly || isBlockHighlighted,
                    workedOn: itemWorkedOn,
                  })
                : null;
            const occupiedChrome =
              chapterChrome ??
              resolveOccupiedMapTileChrome({
                learnerMode,
                status: displayStatus,
                selected: isBlockHighlighted,
                focused: chapterFocusOnly || isBlockHighlighted,
                isStart: Boolean(node.is_start),
                locked: lockedByPrereq && !isBlockHighlighted && !isLearnerDepHighlight,
                depHighlight: isLearnerDepHighlight,
                highlightRole: learnerMode ? null : highlightRole,
                workedOn: itemWorkedOn,
              });
            const baseChrome =
              suggestMode === "chapter" && isLearnerDepHighlight
                ? LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS
                : occupiedChrome.className;
            const chapterStatusIcon = occupiedChrome.statusIcon;
            // Must be declared before tileClass (TDZ) — used by rect + freeform chrome.
            const generationLocked = generationLockedBlockIds.has(node.id);
            const nodeEffects = parseBlockCreatorEffects(
              (node as { creator_effects?: unknown }).creator_effects,
              { selfBlockId: node.id },
            );
            const generatorBusy = isGeneratorEffectBusy(nodeEffects);
            const isDynamicUnlockHighlight = dynamicUnlockHighlightIds.has(
              node.id,
            );
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
              generatorBusy
                ? "ring-2 ring-white/55 shadow-[0_0_12px_rgba(255,255,255,0.14)]"
                : ""
            } ${
              isDynamicUnlockHighlight
                ? "ring-2 ring-white/55 shadow-[0_0_12px_rgba(255,255,255,0.14)]"
                : ""
            } ${
              !generationLocked && isAppearingTarget
                ? appeared
                  ? "opacity-100 scale-100 shadow-[0_0_14px_rgba(255,255,255,0.12)]"
                  : "opacity-0 scale-95"
                : ""
            }`;
            const hasOptimisticGeometry = Boolean(optimisticPlacements[node.id]);
            const tileTransition = {
              // No ease when live-dragging or holding optimistic settle — feels instant.
              transition: isAppearingTarget
                ? "opacity 380ms ease, transform 380ms ease, box-shadow 380ms ease"
                : (isDragParticipant && blockDragOffset) || hasOptimisticGeometry
                  ? "none"
                  : undefined,
            } as const;
            const hasLocalContext = blockHasAttachedLocalContext(node);
            const isStarter = Boolean(node.is_start);
            const tileBadges = resolveMapOccupiedTileBadges({
              surface: suggestMode === "chapter" ? "chapter" : "block",
              hasDagLock: hasDependencies || lockedByPrereq,
              isStart: isStarter,
              hasPractice:
                practiceOptionsIconKeys(
                  parseBlockPracticeOptions(
                    (node as { practice_options?: unknown }).practice_options,
                  ),
                ).length > 0,
              hasLocalContext,
              hasEffects: creatorEffectIconKeys(nodeEffects).length > 0,
              generatorBusy,
            });
            const lockBadge = tileBadges.showLock ? (
                <BlockDependencyLockBadge
                  dependencyCount={Math.max(
                    dependencyIds.length,
                    lockedByPrereq ? 1 : 0,
                  )}
                  currentlyLocked={lockedByPrereq}
                  // Red lock when currently locked (learner workspace or ILE chapter).
                  learnerSpottable={learnerMode || suggestMode === "chapter"}
                />
              ) : null;
            const learnerLockedLabel =
              tileBadges.showLock && learnerMode && lockedByPrereq ? (
                <span
                  className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-rose-300/95"
                  data-learner-locked-label
                >
                  Locked
                </span>
              ) : null;
            const localContextBadge = tileBadges.showLocalContext ? (
              <BlockLocalContextDocBadge />
            ) : null;
            const starterBadge = tileBadges.showStarter ? (
              <BlockStarterFlagBadge />
            ) : null;
            const practiceKeys = practiceOptionsIconKeys(
              parseBlockPracticeOptions(
                (node as { practice_options?: unknown }).practice_options,
              ),
            );
            const practiceBadge =
              tileBadges.showPractice && practiceKeys.length > 0 ? (
                <BlockPracticeOptionsBadge keys={practiceKeys} />
              ) : null;
            const effectKeys = creatorEffectIconKeys(nodeEffects);
            const effectBadge =
              tileBadges.showEffects && effectKeys.length > 0 ? (
                <BlockCreatorEffectsBadge
                  keys={effectKeys}
                  learnerMode={learnerMode}
                />
              ) : null;
            // Generator targets are empty cells (not filled blocks).
            const generatorSparkBadge = null;
            // Dynamic “?” once configured (creator + learner) until generated.
            const mapTitle = learnerDynamicMapLabel({
              effects: nodeEffects,
              title: node.title,
              description: node.description,
              contentGenerated: dynamicGeneratedSet.has(node.id),
            });
            // Freeform polyomino: seamless tiles (fill grid gaps) + outer edges only + one title.
            if (freeform) {
              const shapeKeys = freeformShapeKeySet(occupiedCells);
              const labelCell = freeformLabelCell(occupiedCells);
              const freeformColors =
                isPrereqHighlight && !learnerMode
                  ? mapCellFreeformPrereqColors()
                  : itemDone
                    ? mapCellFreeformDoneColors(
                        isBlockHighlighted || highlightRole === "target",
                      )
                    : itemWorkedOn
                      ? mapCellFreeformSelfProgressColors(
                          isBlockHighlighted || highlightRole === "target",
                        )
                    : learnerMode
                    ? learnerMapFreeformColors(
                        isBlockHighlighted || highlightRole === "target",
                        {
                          locked: lockedByPrereq && !isBlockHighlighted,
                          depHighlight: isLearnerDepHighlight,
                          done: itemDone,
                          workedOn: itemWorkedOn,
                        },
                      )
                    : highlightRole === "target" || isBlockHighlighted
                      ? mapCellFreeformColors(true)
                      : mapCellFreeformColors(false);
              const freeformFill = freeformColors.fill;
              const freeformBorder = freeformColors.border;
              const freeformText = freeformColors.text;
              const freeformBorderStyle: "solid" | "dashed" = isPrereqHighlight
                ? "dashed"
                : "solid";
              const freeformBorderWidth = isPrereqHighlight ? 2 : 1;
              const freeformBbox = footprintFromCells(occupiedCells);
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
                          data-map-cell-done={itemDone ? "true" : undefined}
                          data-map-cell-self-progress={
                            itemWorkedOn && !itemDone ? "true" : undefined
                          }
                          data-block-selected={isBlockHighlighted ? "true" : "false"}
                          data-block-locked={lockedByPrereq ? "true" : "false"}
                          data-block-has-dependencies={hasDependencies ? "true" : "false"}
                          data-ile-chapter-unlock-highlight={
                            suggestMode === "chapter" && isLearnerDepHighlight
                              ? "true"
                              : undefined
                          }
                          data-block-has-local-context={hasLocalContext ? "true" : "false"}
                          data-block-is-start={isStarter ? "true" : "false"}
                          data-block-generation-locked={generationLocked ? "true" : "false"}
                          data-generator-busy={generatorBusy ? "true" : "false"}
                          data-dynamic-unlock-highlight={
                            isDynamicUnlockHighlight ? "true" : undefined
                          }
                          data-learner-dep-highlight={
                            isLearnerDepHighlight ? "true" : undefined
                          }
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
                              isBlockHighlighted
                                ? freeformColors.shadow
                                : undefined,
                          }}
                        >
                          {isLabel ? (
                            <>
                              <MapCellStatusGlyph
                                status={node.status}
                                showProgress={showProgress}
                                title={mapTitle}
                                statusIcon={chapterStatusIcon}
                              />
                              {learnerLockedLabel}
                              {practiceBadge}
                              {effectBadge}
                              {generatorSparkBadge}
                              {localContextBadge}
                              {starterBadge}
                              {lockBadge}
                            </>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                  {/* BBox stretch chrome for freeform sole-select (solid rect of bbox). */}
                  {freeformBbox && soleStretchBlockId === node.id ? (
                    <div
                      className="pointer-events-none absolute"
                      data-stretch-bbox={node.id}
                      style={{
                        left: freeformBbox.position_x * SKILL_GRID_PITCH + dragDx,
                        top: freeformBbox.position_y * SKILL_GRID_PITCH + dragDy,
                        width:
                          freeformBbox.span_w * SKILL_GRID_CELL_SIZE +
                          (freeformBbox.span_w - 1) * SKILL_GRID_GAP,
                        height:
                          freeformBbox.span_h * SKILL_GRID_CELL_SIZE +
                          (freeformBbox.span_h - 1) * SKILL_GRID_GAP,
                        zIndex: 6,
                      }}
                    >
                      {renderStretchHandles(node.id)}
                    </div>
                  ) : null}
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
                  left: renderCell.col * SKILL_GRID_PITCH + dragDx,
                  top: renderCell.row * SKILL_GRID_PITCH + dragDy,
                  width,
                  height,
                  zIndex:
                    isDragParticipant && blockDragOffset
                      ? 5
                      : liveStretch
                        ? 5
                        : undefined,
                }}
              >
                <button
                  type="button"
                  data-block-id={node.id}
                  data-map-cell-done={itemDone ? "true" : undefined}
                  data-map-cell-self-progress={
                    itemWorkedOn && !itemDone ? "true" : undefined
                  }
                  data-ile-chapter-unlock-highlight={
                    suggestMode === "chapter" && isLearnerDepHighlight
                      ? "true"
                      : undefined
                  }
                  data-block-selected={isBlockHighlighted ? "true" : "false"}
                  data-block-locked={lockedByPrereq ? "true" : "false"}
                  data-block-has-dependencies={hasDependencies ? "true" : "false"}
                  data-block-has-local-context={hasLocalContext ? "true" : "false"}
                  data-block-is-start={isStarter ? "true" : "false"}
                  data-block-generation-locked={generationLocked ? "true" : "false"}
                  data-generator-busy={generatorBusy ? "true" : "false"}
                  data-dynamic-unlock-highlight={
                    isDynamicUnlockHighlight ? "true" : undefined
                  }
                  data-learner-dep-highlight={
                    isLearnerDepHighlight ? "true" : undefined
                  }
                  data-block-highlight={highlightRole}
                  data-block-stretch-preview={liveStretch ? "true" : undefined}
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
                  <MapCellStatusGlyph
                    status={node.status}
                    showProgress={showProgress}
                    title={mapTitle}
                    statusIcon={chapterStatusIcon}
                  />
                  {learnerLockedLabel}
                  {practiceBadge}
                  {effectBadge}
                  {generatorSparkBadge}
                  {localContextBadge}
                  {starterBadge}
                  {lockBadge}
                </button>
                {renderStretchHandles(node.id)}
              </div>
            );
          })}

          {/* Annotation strokes AFTER blocks so committed paint stays visible over tiles.
              z-[20] > block zIndex 2/5/6; pointer-events-none so map still receives hits.
              (Live preview is separate viewport-local layer at z-[13].) */}
          <svg
            data-annotation-strokes-layer
            className="pointer-events-none absolute left-0 top-0 z-[20] overflow-visible"
            style={{ width: 1, height: 1 }}
            aria-hidden
          >
            {annotationLayers.map((layer) => {
              if (!layer.visible) return null;
              return (
                <g
                  key={layer.id}
                  data-annotation-layer-strokes={layer.id}
                  data-annotation-layer-name={layer.name}
                >
                  {layer.strokes.map((stroke) => {
                    if (stroke.kind === "circle") {
                      return (
                        <circle
                          key={stroke.id}
                          data-annotation-stroke={stroke.id}
                          data-annotation-stroke-kind="circle"
                          cx={stroke.cx ?? 0}
                          cy={stroke.cy ?? 0}
                          r={stroke.r ?? 1}
                          fill="none"
                          stroke={ANNOTATION_STROKE_COLOR}
                          strokeWidth={stroke.strokeWidth}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    if (stroke.kind === "square") {
                      return (
                        <rect
                          key={stroke.id}
                          data-annotation-stroke={stroke.id}
                          data-annotation-stroke-kind="square"
                          x={stroke.x ?? 0}
                          y={stroke.y ?? 0}
                          width={stroke.width ?? 1}
                          height={stroke.height ?? 1}
                          fill="none"
                          stroke={ANNOTATION_STROKE_COLOR}
                          strokeWidth={stroke.strokeWidth}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    }
                    return (
                      <path
                        key={stroke.id}
                        data-annotation-stroke={stroke.id}
                        data-annotation-stroke-kind="freehand"
                        d={annotationFreehandPathD(stroke.points)}
                        fill="none"
                        stroke={ANNOTATION_STROKE_COLOR}
                        strokeWidth={stroke.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
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
              <p className="mt-1 text-[11px] text-neutral-300/90" data-shape-not-contiguous>
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
