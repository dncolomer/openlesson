"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SKILL_GRID_PITCH,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import { createMapFogLookup } from "@/lib/map-fog-of-war";
import {
  createLearnerMapNote,
  createLearnerMapNoteAtViewportCenter,
  shouldMountMapNotes,
  shouldRenderMapNotesOnPlane,
  upsertLearnerMapNote,
} from "@/lib/learner-map-notes";
import { resolveMapOverlayPersistScope } from "@/lib/map-overlay-persist";
import {
  DEFAULT_BLOCK_MAP_MODE,
  DEFAULT_LASSO_SHAPE,
  EMPTY_PREREQ_EDIT,
  type BlockMapModeTool,
  type LassoShapeKind,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import {
  EMPTY_APPEARING_NODE_IDS,
  type BlockSkillGridProps,
} from "@/components/block-skill-grid/types";
import { useMapNotes } from "@/components/block-skill-grid/use-map-notes";
import { useMapSelfProgress } from "@/components/block-skill-grid/use-map-self-progress";
import { useMapInteractionState } from "@/components/block-skill-grid/use-map-interaction-state";
import { useMapAnnotations } from "@/components/block-skill-grid/use-map-annotations";
import { useMapDerived } from "@/components/block-skill-grid/use-map-derived";
import { useMapViewport } from "@/components/block-skill-grid/use-map-viewport";
import { useMapTools } from "@/components/block-skill-grid/use-map-tools";
import { useMapAuthoring } from "@/components/block-skill-grid/use-map-authoring";
import { useMapGridMutate } from "@/components/block-skill-grid/use-map-grid-mutate";
import { useMapPanLasso } from "@/components/block-skill-grid/use-map-pan-lasso";
import { useMapSettleGestures } from "@/components/block-skill-grid/use-map-settle-gestures";
import { MapToolRail } from "@/components/block-skill-grid/map-tool-rail";
import { MapAuthoringForms } from "@/components/block-skill-grid/map-authoring-forms";
import { MapStatusBar } from "@/components/block-skill-grid/map-status-bar";
import { MapStretchHandles } from "@/components/block-skill-grid/map-stretch-handles";
import { MapRightStack } from "@/components/block-skill-grid/map-right-stack";
import { MapJobIndicators } from "@/components/block-skill-grid/map-job-indicators";
import { MapGestureOverlays } from "@/components/block-skill-grid/map-gesture-overlays";
import { MapWorldLayer } from "@/components/block-skill-grid/map-world-layer";
import { MapGridShell } from "@/components/block-skill-grid/map-grid-shell";
import {
  loadMapSelfProgressIds,
  MAP_SELF_PROGRESS_EVENT,
  recordMapItemWorkedOn,
  resolveMapSelfProgressScope,
  mapSelfProgressStorageKey,
} from "@/lib/map-self-progress";
import { MapMinimapChrome } from "@/components/block-skill-grid/map-minimap-chrome";
import { type WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { unusableCellKeySet } from "@/lib/map-ground-rules";
import { normalizeSpan, parseShapeCells, type PlacedBlockRef, type StretchHandle } from "@/lib/skill-grid-ops";
import {
  buildShapeContextSourceOptions,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";

const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;


export function BlockSkillGrid({
  nodes,
  selectedNodeId,
  focusedNodeId = null,
  onSelectNode,
  mapSelection: mapSelectionProp,
  onMapSelectionChange,
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
  selectiveExplanationActive = false,
  selectiveExplanationPolygon = null,
  onSelectiveExplanationComplete,
  injectMapNote = null,
  mapExploreOpen = false,
  onMapExploreToggle,
  onMapToggle,
  mapToggleIds,
  interactionMode: interactionModeProp,
  onInteractionModeChange,
  canEdit: canEditProp,
  learnerMode = false,
  viewOnly = false,
  learnerScopeId = null,
  cloneArmed = false,
  cloneSourceBlockId = null,
  onCloneArm,
  onCloneCancel,
  onClonePaste,
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
  const { workedOnIds } = useMapSelfProgress({
    resolvedLearnerScope,
    suggestMode,
    sessionId,
    workspaceId,
    focusedNodeId,
  });

  const {
    creatorNotes,
    setCreatorNotes,
    learnerNotes,
    setLearnerNotes,
    mapNotesPlaneVisible,
    setMapNotesPlaneVisible,
    mapNotes,
    mapNotesOnPlane,
    persistCreatorNotes,
    persistLearnerNotes,
    findMapNote,
    patchMapNote,
    handleLearnerNoteToggle,
    handleLearnerNoteSaveBody,
    handleLearnerNoteDelete,
    handleLearnerNoteDragEnd,
    handleLearnerNoteResizeEnd,
  } = useMapNotes({
    mountMapNotes,
    overlayPersist,
    learnerMode,
    viewOnly,
    resolvedLearnerScope,
  });

  const {
    annotationLayers,
    setAnnotationLayers,
    activeAnnotationLayerId,
    setActiveAnnotationLayerId,
    annotationDrawTool,
    setAnnotationDrawTool,
    annotationStrokeThickness,
    setAnnotationStrokeThickness,
    annotationNameDraft,
    setAnnotationNameDraft,
    annotationNameOpen,
    setAnnotationNameOpen,
    annotationDrawRef,
    annotationDrawPreview,
    setAnnotationDrawPreview,
    minimapStackRef,
    minimapStackHeight,
    persistAnnotationLayers,
    annotationDrawingActive,
    handleAnnotationLayerAdd,
    handleAnnotationLayerSelect,
    handleAnnotationLayerDelete,
    handleAnnotationLayerToggle,
  } = useMapAnnotations({
    overlayPersist,
    learnerMode,
    viewOnly,
    mountMapNotes,
  });

  const {
    useRightPaneEmpty,
    localPendingCell,
    setLocalPendingCell,
    commitSelectionRef,
    lassoDragRef,
    lassoOverlay,
    setLassoOverlay,
    dragRef,
    blockDragRef,
    suppressBlockClickRef,
    blockDragOffset,
    setBlockDragOffset,
    blockDragIds,
    setBlockDragIds,
    stretchDragRef,
    stretchPreview,
    setStretchPreview,
    prompt,
    setPrompt,
    suggestions,
    setSuggestions,
    isSuggesting,
    setIsSuggesting,
    suggestError,
    setSuggestError,
    addError,
    setAddError,
    selectedEmptyCells,
    setSelectedEmptyCells,
    selectedBlockIds,
    setSelectedBlockIds,
    selectedBlockIdsRef,
    selectedEmptyCellsRef,
    learnerModeRef,
    activeToolRef,
    activeTool,
    setActiveTool,
    lassoShape,
    setLassoShape,
    lassoShapeRef,
    pendingSelectClickRef,
    emptyCellPointerRef,
    suppressEmptyClickRef,
    prereqEdit,
    setPrereqEdit,
    prereqEditRef,
    shapePromptOpen,
    setShapePromptOpen,
    mergePromptOpen,
    setMergePromptOpen,
    localBusy,
    setLocalBusy,
    optimisticPlacements,
    setOptimisticPlacements,
    mapSaveJobs,
    setMapSaveJobs,
    geometrySaveChainRef,
    shapeContextOptions,
    setShapeContextOptions,
    shapeContextSelected,
    setShapeContextSelected,
    shapeContextLoading,
    setShapeContextLoading,
    selectiveDragRef,
    selectiveDrawOverlay,
    setSelectiveDrawOverlay,
    selectiveExplanationActiveRef,
  } = useMapInteractionState({
    onMapSelectionChange,
    learnerMode,
    selectiveExplanationActive,
  });

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
  const {
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
  } = useMapDerived({
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
  });

  const extraRevealCells = useMemo(() => {
    const cells = [...selectedEmptyCells];
    if (previewEmptyCells && previewEmptyCells.length > 0) {
      cells.push(...previewEmptyCells);
    }
    return cells;
  }, [selectedEmptyCells, previewEmptyCells]);

  const fogLookup = useMemo(
    () =>
      createMapFogLookup({
        occupancy,
        extraRevealCells,
        extraRevealKeys: generatorSparkEmptyKeys,
        dragBlockIds: blockDragIds,
        dragOffset: blockDragOffset,
      }),
    [
      occupancy,
      extraRevealCells,
      generatorSparkEmptyKeys,
      blockDragIds,
      blockDragOffset,
    ],
  );

  const {
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
  } = useMapViewport({
    viewportCenterCell,
    followCell,
    appearingNodeIds,
    onAppearingComplete,
    occupiedByBlockId,
  });

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
  const handleLearnerNoteAddAtCenter = handleMapNoteAddAtCenter;

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
            buildShapeContextSourceOptions({
              notes: workspaceNotes ?? "",
              files: [],
              externalResources: [],
            }),
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

  const {
    beginViewportPan,
    handlePointerDown,
    handlePointerMove,
    endDrag,
  } = useMapPanLasso({
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
    nodes: displayNodes,
    commitSelectionRef,
    onSelectNode,
    generationLockedBlockIdsRef,
  });

  const {
    applyStandaloneEmptyChrome,
    paintMapSelection,
    commitSelection,
    clearSelection,
    applyBlockSelection,
    manipulationMode,
    handleCellSelect,
    handleBlockDoubleClick,
    resolveCellFromClient,
    handleBlockPointerDown,
    handleBlockPointerMove,
    applyEmptyCellSelection,
    handleEmptyCellClick,
    shapeFootprint,
    shapeFreeform,
    shapeWeightedNeighbors,
  } = useMapAuthoring({
    selectedEmptyCells,
    setSelectedEmptyCells,
    selectedBlockIds,
    setSelectedBlockIds,
    selectedEmptyCellsRef,
    selectedBlockIdsRef,
    unusableKeys,
    setLocalPendingCell,
    setShapePromptOpen,
    setMergePromptOpen,
    setPrompt,
    setSuggestions,
    setSuggestError,
    useRightPaneEmpty,
    onMapSelectionChange,
    commitSelectionRef,
    mapSelectionProp,
    onSelectNode,
    learnerMode,
    viewOnly,
    canEdit,
    mapExploreOpen,
    prereqEdit,
    setPrereqEdit,
    prereqEditRef,
    activeTool,
    activeToolRef,
    nodesById,
    occupancy,
    fogLookup,
    placements,
    spans,
    busy,
    canSuggest,
    workspaceId,
    sessionId,
    ayclToken,
    ileToken,
    locale,
    suggestMode,
    labels,
    onAddBlock,
    onGridOp,
    setLocalBusy,
    setAddError,
    setIsSuggesting,
    isSuggesting,
    setOptimisticPlacements: setOptimisticPlacements as (next: any) => void,
    setMapSaveJobs,
    geometrySaveChainRef,
    localPendingCell,
    shapeContextSelected,
    displayNodes,
    selectedNodeId,
    focusedNodeId,
    cloneArmed,
    cloneSourceBlockId,
    onClonePaste,
    generatorPickActive,
    onGeneratorEmptyToggle,
    dynamicPickActive,
    onDynamicBlockToggle,
    suppressBlockClickRef,
    suppressEmptyClickRef,
    generationLockedBlockIdsRef,
    beginViewportPan,
    selectiveExplanationActiveRef,
    spaceHeldRef,
    blockDragRef,
    setBlockDragOffset,
    setBlockDragIds,
    pendingSelectClickRef,
    placedBlocksForStretch,
    stretchOccupancy,
    viewportRef,
    pan,
    zoom,
    prompt,
  });

  const {
    runSuggestTopics,
    handleSuggestShapeTopics,
    localPendingNeighbors,
    handleSuggestLocalAdd,
    submitLocalAdd,
    runGridOp,
  } = useMapGridMutate({
    canSuggest,
    isSuggesting,
    setIsSuggesting,
    setSuggestError,
    setSuggestions,
    workspaceId,
    sessionId,
    ayclToken,
    ileToken,
    locale,
    suggestMode,
    labels,
    shapeFootprint,
    selectedEmptyCells,
    shapeWeightedNeighbors,
    localPendingCell,
    placements,
    nodesById,
    occupancy,
    prompt,
    setPrompt,
    setLocalPendingCell,
    setAddError,
    busy,
    onAddBlock,
    clearSelection,
    onGridOp,
    placedBlocksForStretch,
    stretchOccupancy,
    setOptimisticPlacements: setOptimisticPlacements as (next: any) => void,
    setMapSaveJobs,
    geometrySaveChainRef,
    setLocalBusy,
    setShapePromptOpen,
    setMergePromptOpen,
    selectedBlockIds,
    setSelectedEmptyCells,
    setSelectedBlockIds,
    selectedEmptyCellsRef,
    selectedBlockIdsRef,
    displayNodes,
  });

  const {
    handleBlockPointerUp,
    endStretchDrag,
    handleStretchPointerDown,
    handleEmptyCellPointerDown,
    handleEmptyCellPointerMove,
    handleEmptyCellPointerUp,
  } = useMapSettleGestures({
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
  });

  const {
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
  } = useMapTools({
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
    shapeFreeformOk: shapeFreeform.ok,
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
  });

  const renderStretchHandles = (blockId: string) => (
    <MapStretchHandles
      blockId={blockId}
      soleStretchBlockId={soleStretchBlockId}
      generationLocked={generationLockedBlockIds.has(blockId)}
      onPointerDown={handleStretchPointerDown}
    />
  );

  return (
    <MapGridShell
      rail={{
        learnerMode,
        viewOnly,
        annotationDrawingActive,
        activeAnnotationLayerId,
        annotationDrawTool,
        setAnnotationDrawTool,
        annotationStrokeThickness,
        setAnnotationStrokeThickness,
        setActiveAnnotationLayerId,
        modeTools,
        actionTools,
        viewportTools,
        activeTool,
        lassoShape,
        setLassoShape,
        toolEnablement,
        labels,
        cloneArmed,
        onCloneCancel,
        prereqEditActive: prereqEdit.active,
        stagedPrereqCount: prereqEdit.stagedPrereqIds.length,
        onToolClick: handleToolClick,
      }}
      world={{
        visibleCells,
        occupancy,
        selectedEmptyCells,
        generationPendingCellKeys,
        previewEmptyCells,
        generatorSparkEmptyKeys,
        unusableKeys,
        mapExploreOpen,
        busy,
        handleEmptyCellClick,
        handleEmptyCellPointerDown,
        handleEmptyCellPointerMove,
        handleEmptyCellPointerUp,
        fogLookup,
        generatorPickActive,
        activeLassoShape,
        canEdit,
        activeTool,
        labels,
        learnerMode,
        viewOnly,
        mountMapNotes,
        mapNotesOnPlane,
        zoom,
        handleLearnerNoteToggle,
        handleLearnerNoteSaveBody,
        handleLearnerNoteDelete,
        handleLearnerNoteDragEnd,
        handleLearnerNoteResizeEnd,
        renderedBlockIds,
        nodesById,
        placements,
        spans,
        stretchPreview,
        selectedBlockIds,
        blockDragIds,
        appearingNodeIds,
        visibleAppearing,
        blockDragOffset,
        selectedNodeId,
        focusedNodeId,
        displayNodes,
        suggestMode,
        previewTargetId,
        previewPrereqIds,
        prereqEdit,
        chapterUnlockHighlightIds,
        learnerDepHighlightIds,
        workedOnIds,
        generationLockedBlockIds,
        dynamicUnlockHighlightIds,
        dynamicGeneratedSet,
        optimisticPlacements,
        canDragBlocks,
        spaceHeld,
        showProgress,
        handleCellSelect,
        handleBlockDoubleClick,
        handleBlockPointerDown,
        handleBlockPointerMove,
        handleBlockPointerUp,
        soleStretchBlockId,
        renderStretchHandles,
        annotationLayers,
      }}
      gestures={{
        selectiveDrawOverlay,
        selectiveExplanationPolygon,
        selectiveExplanationActive,
        lassoOverlay,
        annotationDrawingActive,
        annotationDrawPreview,
        zoom,
        pan,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: endDrag,
      }}
      minimap={{
        clusterCount: minimapGraph.clusters.length,
        totalBlocks: minimapTileView.totalBlocks,
        tiles: minimapTileView.tiles,
        labels: minimapTileView.labels,
        viewportRect: minimapViewportRect,
        onTilePointerDown: panToMinimapCell,
        onClusterPointerDown: panToCluster,
        onViewportPointerDown: onMinimapViewportPointerDown,
        onViewportPointerMove: onMinimapViewportPointerMove,
        onViewportPointerUp: onMinimapViewportPointerUp,
      }}
      right={{
        viewOnly,
        mountMapNotes,
        overlayPersist,
        workspaceId,
        onMapExploreToggle,
        onMapToggle,
        mapToggleIds,
        onInteractionModeChange,
        mapNotesCount: mapNotes.length,
        annotationLayers,
        minimapStackRef,
        learnerMode,
        interactionModeProp,
        mapExploreOpen,
        mapNotesPlaneVisible,
        setMapNotesPlaneVisible,
        handleMapNoteAddAtCenter,
        annotationNameOpen,
        annotationNameDraft,
        setAnnotationNameDraft,
        setAnnotationNameOpen,
        handleAnnotationLayerAdd,
        activeAnnotationLayerId,
        handleAnnotationLayerSelect,
        handleAnnotationLayerToggle,
        handleAnnotationLayerDelete,
      }}
      jobs={{
        mapSaveJobs,
        clusterMapJob,
        expandJobs,
        onAbortExpandJob,
        minimapStackHeight,
        mountMapNotes,
      }}
      status={{
        canEdit,
        prereqEdit,
        previewTargetId,
        previewPrereqIds,
        activeLassoShape,
        selectedBlockIds,
        selectedEmptyCells,
        manipulationMode: Boolean(manipulationMode),
        labels,
        shapeFootprint,
        shapeFreeformOk: shapeFreeform.ok,
        addError,
      }}
      forms={{
        useRightPaneEmpty,
        localPendingCell,
        labels,
        canSuggest,
        isSuggesting,
        busy,
        onSuggestLocalAdd: handleSuggestLocalAdd,
        suggestError,
        addError,
        suggestions,
        prompt,
        setPrompt,
        onCancelLocalAdd: () => {
          setLocalPendingCell(null);
          setPrompt("");
          setSuggestions([]);
          setSuggestError(null);
        },
        onSubmitLocalAdd: submitLocalAdd,
        shapePromptOpen,
        shapeFootprint,
        selectedEmptyCells,
        shapeFreeformOk: shapeFreeform.ok,
        onSuggestShapeTopics: handleSuggestShapeTopics,
        shapeContextLoading,
        shapeContextOptions,
        shapeContextSelected,
        setShapeContextSelected,
        onCancelShape: () => {
          setShapePromptOpen(false);
          setPrompt("");
          setSuggestions([]);
          setSuggestError(null);
          setShapeContextSelected([]);
        },
        onSubmitShape: () => {
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
        },
        mergePromptOpen,
        selectedBlockIds,
        onCancelMerge: () => {
          setMergePromptOpen(false);
          setPrompt("");
        },
        onSubmitMerge: () =>
          void runGridOp({
            op: "merge",
            prompt: prompt.trim() || undefined,
            blockIds: selectedBlockIds,
          }),
      }}
      chrome={{
        viewportRef,
        spaceHeld,
        zoom,
        pan,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: endDrag,
      }}
    />
  );

}
