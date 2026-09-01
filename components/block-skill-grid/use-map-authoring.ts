"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type SetStateAction,
} from "react";
import {
  getWeightedNeighborhood,
  isCellOccupied,
  SKILL_GRID_PITCH,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  allowsBlockDragInMode,
  allowsMapClickSelection,
  blockDragMoveDelta,
  clientPointToGridCell,
  isBlockMapManipulationMode,
  isLassoModeTool,
  isMapPanGesture,
  resolveBlockPointerGestureSelection,
  resolveMoveDragBlockIds,
  shouldEmptyCellClickSelect,
  toggleOrReplaceBlockSelection as toggleOrReplaceBlockSelectionPure,
  toggleOrReplaceEmptyCellSelection as toggleOrReplaceEmptyCellSelectionPure,
  toggleStagedPrereq,
  type BlockMapModeTool,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import { resolveEmptySelectionSurface } from "@/lib/workspace-right-pane";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import { MODEL_STORAGE_KEY } from "@/components/block-skill-grid/types";
import {
  mapSelectionEmptyCells,
  mapSelectionExpandedId,
  mapSelectionHighlightIds,
  nextWorkspaceMapSelection,
  type WorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import { resolveClonePasteTarget } from "@/lib/clone-block";
import {
  canBuildOnFogVisibleEmpty,
  type MapFogLookup,
} from "@/lib/map-fog-of-war";
import {
  footprintFromCells,
  normalizeSpan,
  parseShapeCells,
  selectionIsFreeformLectureShape,
  stretchBlockFromHandle,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";

const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

export function useMapAuthoring(input: {
  selectedEmptyCells: GridCell[];
  setSelectedEmptyCells: (next: GridCell[]) => void;
  selectedBlockIds: string[];
  setSelectedBlockIds: (next: string[]) => void;
  selectedEmptyCellsRef: { current: GridCell[] };
  selectedBlockIdsRef: { current: string[] };
  unusableKeys: Set<string>;
  setLocalPendingCell: (cell: GridCell | null) => void;
  setShapePromptOpen: (open: boolean) => void;
  setMergePromptOpen: (open: boolean) => void;
  setPrompt: (next: string) => void;
  setSuggestions: (next: string[]) => void;
  setSuggestError: (next: string | null) => void;
  useRightPaneEmpty: boolean;
  onMapSelectionChange?: (selection: WorkspaceMapSelection) => void;
  commitSelectionRef: { current: ((selection: WorkspaceMapSelection) => void) | null };
  mapSelectionProp?: WorkspaceMapSelection;
  onSelectNode: (blockId: string | null) => void;
  learnerMode: boolean;
  viewOnly: boolean;
  canEdit: boolean;
  mapExploreOpen?: boolean;
  prereqEdit: PrereqEditState;
  setPrereqEdit: (next: PrereqEditState | ((prev: PrereqEditState) => PrereqEditState)) => void;
  prereqEditRef: { current: PrereqEditState };
  activeTool: BlockMapModeTool;
  activeToolRef: { current: BlockMapModeTool };
  nodesById: Map<string, SkillGridNode>;
  occupancy: Map<string, string>;
  fogLookup: MapFogLookup;
  placements: Map<string, GridCell>;
  spans: Map<string, { span_w: number; span_h: number }>;
  busy: boolean;
  canSuggest: boolean;
  workspaceId?: string;
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  locale: string;
  suggestMode: "block" | "chapter";
  labels: BlockSkillGridProps["labels"];
  onAddBlock: BlockSkillGridProps["onAddBlock"];
  onGridOp?: BlockSkillGridProps["onGridOp"];
  setLocalBusy: (busy: boolean) => void;
  setAddError: (err: string | null) => void;
  setIsSuggesting: (v: boolean) => void;
  isSuggesting: boolean;
  setOptimisticPlacements: (
    next:
      | Record<
          string,
          {
            position_x: number;
            position_y: number;
            span_w: number;
            span_h: number;
            shape_cells?: unknown;
          }
        >
      | ((
          prev: Record<
            string,
            {
              position_x: number;
              position_y: number;
              span_w: number;
              span_h: number;
              shape_cells?: unknown;
            }
          >,
        ) => Record<
          string,
          {
            position_x: number;
            position_y: number;
            span_w: number;
            span_h: number;
            shape_cells?: unknown;
          }
        >),
  ) => void;
  setMapSaveJobs: Dispatch<SetStateAction<Array<{
    id: string;
    label: string;
    status: "saving" | "saved" | "error";
    error?: string;
  }>>>;
  geometrySaveChainRef: { current: Promise<void> };
  localPendingCell: GridCell | null;
  shapeContextSelected: string[];
  displayNodes: SkillGridNode[];
  selectedNodeId: string | null;
  focusedNodeId?: string | null;
  cloneArmed: boolean;
  cloneSourceBlockId?: string | null;
  onClonePaste?: (sourceBlockId: string, target: GridCell) => void;
  generatorPickActive: boolean;
  onGeneratorEmptyToggle?: (cell: { row: number; col: number }) => void;
  dynamicPickActive: boolean;
  onDynamicBlockToggle?: (blockId: string) => void;
  onPeekBlock?: (blockId: string) => void;
  onNodeDoubleClick?: (blockId: string) => void;
  suppressBlockClickRef: { current: boolean };
  suppressEmptyClickRef: { current: boolean };
  generationLockedBlockIdsRef: { current: Set<string> };
  beginViewportPan: (event: PointerEvent, captureTarget?: EventTarget | null) => void;
  selectiveExplanationActiveRef: { current: boolean };
  spaceHeldRef: { current: boolean };
  blockDragRef: {
    current: {
      pointerId: number;
      originRow: number;
      originCol: number;
      moved: boolean;
      [key: string]: unknown;
    } | null;
  };
  setBlockDragOffset: (next: { dRow: number; dCol: number } | null) => void;
  setBlockDragIds: (next: string[] | null) => void;
  pendingSelectClickRef: { current: unknown };
  placedBlocksForStretch: PlacedBlockRef[];
  stretchOccupancy: Map<string, string>;
  viewportRef: { current: HTMLDivElement | null };
  pan: { x: number; y: number };
  zoom: number;
  prompt: string;
}) {
  const {
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
    mapExploreOpen = false,
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
    onPeekBlock,
    onNodeDoubleClick,
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
  } = input;

  const applyStandaloneEmptyChrome = useCallback(
    (cells: readonly GridCell[]) => {
      const surface = resolveEmptySelectionSurface({
        selectedEmptyCells: cells,
        unusableKeys,
      });
      if (surface?.kind === "add_block") {
        // ILE empty cells open an Add-chapter ring first; the ring action
        // sets localPendingCell. Workspace still opens the add chrome here.
        if (suggestMode === "chapter") {
          setLocalPendingCell(null);
          setShapePromptOpen(false);
          return;
        }
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
    [onGridOp, suggestMode, unusableKeys],
  );

  const paintMapSelection = useCallback((selection: WorkspaceMapSelection) => {
    const localFilled = mapSelectionHighlightIds(selection);
    const empties = mapSelectionEmptyCells(selection);
    selectedBlockIdsRef.current = localFilled;
    setSelectedBlockIds(localFilled);
    selectedEmptyCellsRef.current = empties;
    setSelectedEmptyCells(empties);
  }, []);

  const commitSelection = useCallback(
    (selection: WorkspaceMapSelection, opts?: { resetChrome?: boolean }) => {
      paintMapSelection(selection);

      if (opts?.resetChrome !== false) {
        setShapePromptOpen(false);
        setMergePromptOpen(false);
        setPrompt("");
        setLocalPendingCell(null);
      }

      if (onMapSelectionChange) {
        onMapSelectionChange(selection);
        return;
      }

      if (selection.kind === "empties") {
        applyStandaloneEmptyChrome(mapSelectionEmptyCells(selection));
      }
      onSelectNode(mapSelectionExpandedId(selection));
    },
    [applyStandaloneEmptyChrome, onMapSelectionChange, onSelectNode, paintMapSelection],
  );
  commitSelectionRef.current = commitSelection;

  useEffect(() => {
    if (mapSelectionProp == null) return;
    paintMapSelection(mapSelectionProp);
    if (mapSelectionProp.kind !== "empties") {
      setShapePromptOpen(false);
      setLocalPendingCell(null);
    }
  }, [mapSelectionProp, paintMapSelection]);

  const clearSelection = useCallback(() => {
    commitSelection(nextWorkspaceMapSelection({ type: "clear" }));
  }, [commitSelection]);

  const applyBlockSelection = useCallback((blockId: string, multi: boolean): string[] => {
    const prev = selectedBlockIdsRef.current;
    const nextIds = toggleOrReplaceBlockSelectionPure({
      blockId,
      multi,
      prevSelectedBlockIds: prev,
    });
    commitSelection(
      nextWorkspaceMapSelection({ type: "set_filled_ids", blockIds: nextIds }),
    );
    return nextIds;
  }, [commitSelection]);

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
        commitSelection(
          nextWorkspaceMapSelection({ type: "open_block", blockId }),
        );
        return;
      }

      if (!allowsMapClickSelection(activeTool)) return;

      const multiModifier = event.metaKey || event.ctrlKey || event.shiftKey;

      if (activeTool === "move" && !multiModifier && manipulationMode) {
        event.preventDefault();
        return;
      }

      // Fallback when pointerdown path didn't run (e.g. chapter map).
      applyBlockSelection(blockId, multiModifier);
    },
    [
      activeTool,
      applyBlockSelection,
      canEdit,
      dynamicPickActive,
      manipulationMode,
      onDynamicBlockToggle,
      selectedNodeId,
      viewOnly,
    ],
  );

  const handleBlockDoubleClick = useCallback(
    (blockId: string) => {
      if (generationLockedBlockIdsRef.current.has(blockId)) return;
      if (onNodeDoubleClick) {
        onNodeDoubleClick(blockId);
        return;
      }
      onPeekBlock?.(blockId);
    },
    [onPeekBlock, onNodeDoubleClick],
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

      // Selective Explanation owns the gesture — do not arm block drag / select.
      if (selectiveExplanationActiveRef.current) {
        return;
      }

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
        commitSelection(
          nextWorkspaceMapSelection({
            type: "set_filled_ids",
            blockIds: resolved.selectedBlockIds,
          }),
        );
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
        commitSelection(
          nextWorkspaceMapSelection({
            type: "set_filled_ids",
            blockIds: resolved.selectedBlockIds,
          }),
        );
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
      commitSelection,
      dynamicPickActive,
      manipulationMode,
      onDynamicBlockToggle,
      onGridOp,
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
   */
  const applyEmptyCellSelection = useCallback((cell: GridCell, multi: boolean): GridCell[] => {
    const next = toggleOrReplaceEmptyCellSelectionPure({
      cell,
      multi,
      prevSelectedEmptyCells: selectedEmptyCellsRef.current,
    });
    commitSelection(
      nextWorkspaceMapSelection({ type: "set_empty_cells", cells: next }),
    );
    return next;
  }, [commitSelection]);

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

      if (busy) return;
      if (isCellOccupied(occupancy, cell.row, cell.col)) return;
      if (mapExploreOpen) {
        if (unusableKeys.has(`${cell.row}:${cell.col}`)) return;
        applyEmptyCellSelection(cell, false);
        return;
      }
      if (!canEdit) return;
      // Lasso modes own the gesture — never open add or select empties from click.
      if (isLassoModeTool(activeToolRef.current)) return;
      if (selectiveExplanationActiveRef.current) return;

      const isUnusable = unusableKeys.has(`${cell.row}:${cell.col}`);
      // Fade / black fog empties cannot be used to add, clone, or generator-pick.
      // Pan and explore-click are handled above / in pointer-down, not here.
      if (
        !isUnusable &&
        !canBuildOnFogVisibleEmpty(fogLookup(cell.row, cell.col))
      ) {
        return;
      }

      // Generator pick: toggle empty (placeable) cells only; keep block focus.
      if (generatorPickActive && onGeneratorEmptyToggle && !isUnusable) {
        event.preventDefault?.();
        event.stopPropagation?.();
        onGeneratorEmptyToggle({ row: cell.row, col: cell.col });
        return;
      }

      if (cloneArmed && onClonePaste && !isUnusable) {
        const resolved = resolveClonePasteTarget({
          state: {
            armed: true,
            sourceBlockId: cloneSourceBlockId || selectedNodeId || "",
          },
          target: cell,
          occupiedKeys: [...occupancy.keys()],
          unusableKeys,
        });
        if (resolved.ok) {
          event.preventDefault?.();
          event.stopPropagation?.();
          onClonePaste(resolved.sourceBlockId, resolved.target);
          return;
        }
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
        return;
      }

      // Legacy path (no select mode): single empty still drives right-pane add.
      if (isUnusable) return;
      applyEmptyCellSelection(cell, false);
    },
    [
      applyEmptyCellSelection,
      busy,
      canEdit,
      mapExploreOpen,
      cloneArmed,
      cloneSourceBlockId,
      generatorPickActive,
      occupancy,
      fogLookup,
      onClonePaste,
      onGeneratorEmptyToggle,
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

  return {
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
  };
}
