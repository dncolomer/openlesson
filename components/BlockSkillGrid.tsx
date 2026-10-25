"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { skillGridMetrics } from "@/lib/block-skill-grid";
import { createMapFogLookup } from "@/lib/map-fog-of-war";
import {
  createLearnerMapNoteAtViewportCenter,
  upsertLearnerMapNote,
} from "@/lib/learner-map-notes";
import { resolveMapOverlayPersistScope } from "@/lib/map-overlay-persist";
import {
  EMPTY_APPEARING_NODE_IDS,
  type BlockSkillGridProps,
} from "@/components/block-skill-grid/types";
import { useMapNotes } from "@/components/block-skill-grid/use-map-notes";
import { useMapSelfProgress } from "@/components/block-skill-grid/use-map-self-progress";
import { useWorkspacePreviousSessionBlockIds } from "@/components/block-skill-grid/use-workspace-previous-session-blocks";
import { useMapInteractionState } from "@/components/block-skill-grid/use-map-interaction-state";
import { useMapAnnotations } from "@/components/block-skill-grid/use-map-annotations";
import { useMapDerived } from "@/components/block-skill-grid/use-map-derived";
import { useMapViewport } from "@/components/block-skill-grid/use-map-viewport";
import { useMapTools } from "@/components/block-skill-grid/use-map-tools";
import { useMapAuthoring } from "@/components/block-skill-grid/use-map-authoring";
import { useMapGridMutate } from "@/components/block-skill-grid/use-map-grid-mutate";
import { useMapPanLasso } from "@/components/block-skill-grid/use-map-pan-lasso";
import { useMapSettleGestures } from "@/components/block-skill-grid/use-map-settle-gestures";
import { useMapCircularMenu } from "@/components/block-skill-grid/use-map-circular-menu";
import { MapStretchHandles } from "@/components/block-skill-grid/map-stretch-handles";
import { MapGridShell } from "@/components/block-skill-grid/map-grid-shell";
import { fetchAestheticPackages } from "@/lib/aesthetics";
import { type WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { resolveMapBlockPeek } from "@/lib/block-map-peek";
import { unusableCellKeySet } from "@/lib/map-ground-rules";

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
  gatherJobs = null,
  onOpenGatherResources,
  aestheticImages = null,
  circularMenuSurface: circularMenuSurfaceProp,
  onEmptyCellSelect,
  onBlockedCellSelect,
  emptyAddNonce = 0,
  blockProgressById,
  unseenGatherById,
  clusterMapJob = null,
  selectiveExplanationActive = false,
  selectiveExplanationPolygon = null,
  onSelectiveExplanationComplete,
  injectMapNote = null,
  injectHeliosOverlay = null,
  onMapOverlayChange,
  canEdit: canEditProp,
  learnerMode = false,
  viewOnly = false,
  showMinimap = true,
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
  locale = "en",
  recenterCell = null,
  followCell = null,
  defaultZoomAtReference,
  onAddBlock,
  onNodeDoubleClick,
  peekOnDoubleClick = true,
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
  const [fetchedAestheticImages, setFetchedAestheticImages] = useState<string[] | null>(
    null,
  );
  useEffect(() => {
    if (aestheticImages && aestheticImages.length > 0) {
      setFetchedAestheticImages(null);
      return;
    }
    let cancelled = false;
    void fetchAestheticPackages()
      .then((packages) => {
        if (cancelled) return;
        const images = packages.flatMap((pkg) => pkg.images).filter(Boolean);
        if (images.length > 0) setFetchedAestheticImages(images);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [aestheticImages]);
  const resolvedAestheticImages =
    aestheticImages && aestheticImages.length > 0
      ? aestheticImages
      : fetchedAestheticImages;
  const [peekBlockId, setPeekBlockId] = useState<string | null>(null);
  const unusableKeys = useMemo(
    () => unusableCellKeySet(unusableCells || []),
    [unusableCells],
  );

  /**
   * Map post-it notes (continuous plane):
   * - Creator notes: workspace-scoped, always visible in learner mode, not deletable by learners
   * - Learner notes: personal, learner mode only
   * - TAP Learning chapter maps: session-scoped (no workspace store)
   * - Public view-only snapshots: existing notes/layers are shown (no authoring).
   */
  const overlayPersist = useMemo(
    () =>
      resolveMapOverlayPersistScope({
        workspaceId,
        sessionId,
        mapKind: "workspace",
      }),
    [workspaceId, sessionId],
  );
  const mountMapNotes = Boolean(overlayPersist);
  const resolvedLearnerScope =
    String(learnerScopeId || ayclToken || "local").trim() || "local";
  const { workedOnIds } = useMapSelfProgress({
    resolvedLearnerScope,
    workspaceId,
  });
  const previousSessionBlockIds = useWorkspacePreviousSessionBlockIds({
    workspaceId,
    ayclToken,
    ileToken,
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
    injectMapNote,
  });

  const {
    annotationLayers,
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
    injectHeliosOverlay,
    persistCreatorNotes,
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
    setSuggestions,
    isSuggesting,
    setIsSuggesting,
    setSuggestError,
    addError,
    setAddError,
    selectedEmptyCells,
    setSelectedEmptyCells,
    selectedBlockIds,
    setSelectedBlockIds,
    selectedBlockIdsRef,
    selectedEmptyCellsRef,
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

  useEffect(() => {
    onMapOverlayChange?.({
      notes: creatorNotes,
      annotationLayers,
    });
  }, [annotationLayers, creatorNotes, onMapOverlayChange]);

  /** Nodes with optimistic move/resize applied for live map chrome. */
  const {
    displayNodes,
    nodesById,
    learnerDepHighlightIds,
    generatorSparkEmptyKeys,
    dynamicGeneratedSet,
    dynamicUnlockHighlightIds,
    occupancy,
    placements,
    spans,
    placedBlocksForStretch,
    stretchOccupancy,
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
    setOptimisticPlacements,
    learnerMode,
    selectedNodeId,
    selectedBlockIds,
    generatorTargetPreviewCells,
    dynamicContentGeneratedIds,
    dynamicUnlockPreviewIds,
    expandJobs,
    workspaceId,
    recenterCell,
    isAdding,
    localBusy,
  });

  useEffect(() => {
    if (peekBlockId && !nodesById.has(peekBlockId)) setPeekBlockId(null);
  }, [peekBlockId, nodesById]);

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

  const mapGrid = skillGridMetrics("workspace");

  const {
    viewportRef,
    panMovedRef,
    viewportSize,
    pan,
    setPan,
    zoom,
    spaceHeldRef,
    spaceHeld,
    visibleAppearing,
    visibleCells,
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
    defaultZoomAtReference,
    gridPitch: mapGrid.pitch,
    gridCellSize: mapGrid.cellSize,
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
    pitch: mapGrid.pitch,
  });

  const {
    commitSelection,
    clearSelection,
    manipulationMode,
    handleCellSelect,
    handleBlockDoubleClick,
    resolveCellFromClient,
    handleBlockPointerDown,
    handleBlockPointerMove,
    handleEmptyCellClick: handleEmptyCellClickRaw,
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
    labels,
    onAddBlock,
    onGridOp,
    setLocalBusy,
    setAddError,
    setIsSuggesting,
    isSuggesting,
    setOptimisticPlacements,
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
    onPeekBlock: setPeekBlockId,
    onNodeDoubleClick,
    peekOnDoubleClick,
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
    shapePromptOpen,
    setShapeContextLoading,
    setShapeContextOptions,
    workspaceNotes,
  });

  const {
    handleCellSelectWithMenu,
    handleBlockDoubleClickGuarded,
    handleEmptyCellClick,
  } = useMapCircularMenu({
    viewOnly,
    circularMenuSurfaceProp,
    onEmptyCellSelect,
    onBlockedCellSelect,
    emptyAddNonce,
    unusableKeys,
    handleCellSelect,
    handleBlockDoubleClick,
    handleEmptyCellClickRaw,
    clearSelection,
    setLocalPendingCell,
    setPeekBlockId,
  });

  const { submitLocalAdd, runGridOp } = useMapGridMutate({
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
    setOptimisticPlacements,
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
    previewTargetId,
    previewPrereqIds,
    handleToolClick,
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
        overlayAnchorClass: "top-2",
      }}
      world={{
        visibleCells,
        occupancy,
        selectedEmptyCells,
        generationPendingCellKeys,
        previewEmptyCells,
        generatorSparkEmptyKeys,
        unusableKeys,
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
        previewTargetId,
        previewPrereqIds,
        prereqEdit,
        learnerDepHighlightIds,
        workedOnIds,
        aestheticImages: resolvedAestheticImages,
        previousSessionBlockIds,
        generationLockedBlockIds,
        dynamicUnlockHighlightIds,
        dynamicGeneratedSet,
        optimisticPlacements,
        canDragBlocks,
        spaceHeld,
        showProgress,
        handleCellSelect: handleCellSelectWithMenu,
        handleBlockDoubleClick: handleBlockDoubleClickGuarded,
        blockProgressById,
        unseenGatherById,
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
        pitch: mapGrid.pitch,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: endDrag,
      }}
      minimap={{
        hidden: showMinimap === false,
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
        minimapHidden: showMinimap === false,
        workspaceId,
        mapNotesCount: mapNotes.length,
        annotationLayers,
        minimapStackRef,
        learnerMode,
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
        gatherJobs,
        onOpenGatherResources,
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
        busy,
        addError,
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
      peek={{
        block: resolveMapBlockPeek(displayNodes, peekBlockId),
        onClose: () => setPeekBlockId(null),
      }}
    />
  );

}
