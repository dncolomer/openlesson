"use client";

import { useEffect, useRef, useState } from "react";
import type { GridCell } from "@/lib/block-skill-grid";
import {
  DEFAULT_BLOCK_MAP_MODE,
  DEFAULT_LASSO_SHAPE,
  EMPTY_PREREQ_EDIT,
  type BlockMapModeTool,
  type LassoShapeKind,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import { parseShapeCells, type PlacedBlockRef, type StretchHandle } from "@/lib/skill-grid-ops";
import type { WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { workspaceModeFlipClearsMapSelection } from "@/lib/workspace-mode";
import type { ShapeContextSourceOption } from "@/lib/shape-context-select";
import type { LassoOverlay } from "@/components/block-skill-grid/map-gesture-overlays";

export function useMapInteractionState(input: {
  onMapSelectionChange?: (selection: WorkspaceMapSelection) => void;
  learnerMode: boolean;
  selectiveExplanationActive: boolean;
}) {
  const { onMapSelectionChange, learnerMode, selectiveExplanationActive } = input;

  const useRightPaneEmpty = typeof onMapSelectionChange === "function";
  const [localPendingCell, setLocalPendingCell] = useState<GridCell | null>(null);
  const commitSelectionRef = useRef<
    (selection: WorkspaceMapSelection, opts?: { resetChrome?: boolean }) => void
  >(() => {});
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

  // Creator ↔ Learner: drop authoring chrome; keep block/empty selection.
  useEffect(() => {
    if (learnerModeRef.current === learnerMode) return;
    learnerModeRef.current = learnerMode;
    if (workspaceModeFlipClearsMapSelection()) {
      selectedEmptyCellsRef.current = [];
      selectedBlockIdsRef.current = [];
      setSelectedEmptyCells([]);
      setSelectedBlockIds([]);
    }
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
  // Must stay live: pointerdown reads the ref, not React state. A stale
  // false here lets the gesture fall through to beginViewportPan.
  selectiveExplanationActiveRef.current = selectiveExplanationActive;

  return {
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
  };
}
