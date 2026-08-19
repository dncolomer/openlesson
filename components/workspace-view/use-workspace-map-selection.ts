"use client";

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getOrderedSessions } from "@/components/SessionList";
import type {
  Block,
  ClusterMapJob,
  InjectMapNote,
  MobileColumn,
} from "@/components/workspace-view/types";
import {
  patchAddExpandJob,
  type AddExpandJob,
} from "@/lib/add-block-range-density";
import type { GeneratorTargetCell } from "@/lib/block-creator-effects";
import {
  armClone,
  cancelCloneArm,
  createDisarmedCloneState,
  type CloneArmState,
} from "@/lib/clone-block";
import {
  closeMapExploreShell,
  createMapExploreShellState,
  openMapExploreShell,
  resolveMapExploreRightColumn,
} from "@/lib/empty-map-pane";
import type { WorkspaceMapToggleId } from "@/lib/workspace-mode";
import { nextWorkspaceMapToggle } from "@/lib/workspace-mode";
import type { UnusableCell } from "@/lib/map-ground-rules";
import type { WorkspaceInteractionMode } from "@/lib/workspace-mode";
import {
  emptyWorkspaceMapSelection,
  mapSelectionEmptyCells,
  mapSelectionExpandedId,
  mapSelectionFilledIds,
  nextWorkspaceMapSelection,
  type WorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import {
  clearWorkspaceAddTarget,
  resolveEmptySelectionSurface,
  resolveWorkspaceRightPane,
} from "@/lib/workspace-right-pane";

export function useWorkspaceMapSelection(input: {
  interactionMode: WorkspaceInteractionMode;
  unusableCells: UnusableCell[];
  nodes: Block[];
  setMobileColumn: Dispatch<SetStateAction<MobileColumn>>;
}) {
  const { interactionMode, unusableCells, nodes, setMobileColumn } = input;

  /** Creator generator drawer / learner select → empty cells to spark. */
  const [generatorTargetPreviewCells, setGeneratorTargetPreviewCells] =
    useState<GeneratorTargetCell[] | null>(null);
  /** When true, empty map clicks toggle generator targets (not Add pane). */
  const [generatorPickActive, setGeneratorPickActive] = useState(false);
  const generatorPickActiveRef = useRef(false);
  const generatorEmptyToggleRef = useRef<
    ((cell: { row: number; col: number }) => void) | null
  >(null);
  /** Dynamic unlock-after pick: click filled blocks on the map. */
  const [dynamicPickActive, setDynamicPickActive] = useState(false);
  const dynamicPickActiveRef = useRef(false);
  const [dynamicUnlockPreviewIds, setDynamicUnlockPreviewIds] = useState<
    string[] | null
  >(null);
  const dynamicBlockToggleRef = useRef<((blockId: string) => void) | null>(
    null,
  );
  const setGeneratorPickActiveSafe = useCallback((active: boolean) => {
    generatorPickActiveRef.current = active;
    setGeneratorPickActive(active);
  }, []);
  const setDynamicPickActiveSafe = useCallback((active: boolean) => {
    dynamicPickActiveRef.current = active;
    setDynamicPickActive(active);
  }, []);
  const registerDynamicBlockToggle = useCallback(
    (fn: ((blockId: string) => void) | null) => {
      dynamicBlockToggleRef.current = fn;
    },
    [],
  );
  const registerGeneratorEmptyToggle = useCallback(
    (fn: ((cell: { row: number; col: number }) => void) | null) => {
      generatorEmptyToggleRef.current = fn;
    },
    [],
  );
  /** Stable: always wired; ignores clicks when pick mode is off (ref-checked). */
  const handleGeneratorEmptyToggle = useCallback(
    (cell: { row: number; col: number }) => {
      if (!generatorPickActiveRef.current) return;
      generatorEmptyToggleRef.current?.(cell);
    },
    [],
  );
  const handleDynamicBlockToggle = useCallback((blockId: string) => {
    if (!dynamicPickActiveRef.current) return;
    dynamicBlockToggleRef.current?.(blockId);
  }, []);

  /** Exclusive map selection — right-pane chrome is derived from this. */
  const [mapSelection, setMapSelection] = useState<WorkspaceMapSelection>(
    emptyWorkspaceMapSelection,
  );
  /** Map explore FAB toggle (not the default empty-selection pane). */
  const [mapExploreShell, setMapExploreShell] = useState(() =>
    createMapExploreShellState(),
  );
  /** Selective Explanation free-shape overlay (independent of selection). */
  const [selectiveExplanationActive, setSelectiveExplanationActive] =
    useState(false);
  const [selectiveExplanationPolygon, setSelectiveExplanationPolygon] =
    useState<Array<{ x: number; y: number }> | null>(null);
  const [injectMapNote, setInjectMapNote] = useState<InjectMapNote | null>(null);
  /** Add-block Range/Density expand preview (highlight only). */
  const [addExpandPreviewCells, setAddExpandPreviewCells] = useState<
    Array<{ row: number; col: number }> | null
  >(null);
  /** Background multi-create jobs (progress under minimap; map stays interactive). */
  const [expandJobs, setExpandJobs] = useState<AddExpandJob[]>([]);
  /** Cluster-blocks progress under minimap (compute + save). */
  const [clusterMapJob, setClusterMapJob] = useState<ClusterMapJob>(null);
  const expandAbortRef = useRef(new Map<string, boolean>());
  const expandJobSeqRef = useRef(0);
  /** Creator clone-paste arm (source filled block → empty target). */
  const [cloneArm, setCloneArm] = useState<CloneArmState>(() =>
    createDisarmedCloneState(),
  );

  const handleAbortExpandJob = useCallback((jobId: string) => {
    expandAbortRef.current.set(jobId, true);
    setExpandJobs((prev) =>
      patchAddExpandJob(prev, jobId, { aborted: true }),
    );
  }, []);

  const applyMapSelectionResult = useCallback((next: WorkspaceMapSelection) => {
    setMapSelection(next);
  }, []);

  const expandedBlockId = mapSelectionExpandedId(mapSelection);
  const selectedFilledBlockIds = mapSelectionFilledIds(mapSelection);
  const emptySurface = useMemo(() => {
    const emptyCells = mapSelectionEmptyCells(mapSelection);
    if (emptyCells.length === 0) return clearWorkspaceAddTarget();
    if (mapExploreShell.open) {
      return resolveEmptySelectionSurface({
        selectedEmptyCells: emptyCells,
        unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
        exploreActive: true,
      });
    }
    if (interactionMode === "learner") return clearWorkspaceAddTarget();
    return resolveEmptySelectionSurface({
      selectedEmptyCells: emptyCells,
      unusableKeys: unusableCells.map((c) => `${c.row}:${c.col}`),
    });
  }, [interactionMode, mapExploreShell.open, mapSelection, unusableCells]);

  const handleExpandedBlockChange = useCallback((blockId: string | null) => {
    const next = nextWorkspaceMapSelection({
      type: "open_block",
      blockId,
    });
    applyMapSelectionResult(next);
    if (mapSelectionExpandedId(next)) {
      setMobileColumn("workspace");
      setCloneArm((prev) =>
        prev.armed && prev.sourceBlockId === mapSelectionExpandedId(next)
          ? prev
          : createDisarmedCloneState(),
      );
    } else {
      setCloneArm(createDisarmedCloneState());
    }
  }, [applyMapSelectionResult, setMobileColumn]);

  const handleCloseBlockDetail = useCallback(() => {
    applyMapSelectionResult(
      nextWorkspaceMapSelection({ type: "open_block", blockId: null }),
    );
    setCloneArm(createDisarmedCloneState());
  }, [applyMapSelectionResult]);

  const handleCloneArm = useCallback((blockId: string) => {
    setCloneArm(armClone(blockId));
  }, []);

  const handleCloneCancel = useCallback(() => {
    setCloneArm(cancelCloneArm());
  }, []);

  const handleEmptyMapSearchBlocks = useCallback((blockIds: string[]) => {
    const next = nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds,
    });
    applyMapSelectionResult(next);
    setCloneArm(createDisarmedCloneState());
    if (mapSelectionExpandedId(next) || mapSelectionFilledIds(next).length > 0) {
      setMobileColumn("workspace");
    }
  }, [applyMapSelectionResult, setMobileColumn]);

  const handleEmptyMapSuggestCells = useCallback(
    (cells: Array<{ row: number; col: number }>) => {
      const next = nextWorkspaceMapSelection({
        type: "set_empty_cells",
        cells,
      });
      applyMapSelectionResult(next);
      setCloneArm(createDisarmedCloneState());
      setMobileColumn("workspace");
    },
    [applyMapSelectionResult, setMobileColumn],
  );

  const handleSelectiveExplanationComplete = useCallback(
    (polygon: Array<{ x: number; y: number }>) => {
      setSelectiveExplanationPolygon(polygon);
      setSelectiveExplanationActive(false);
    },
    [],
  );

  const handleCreateNoteFromSummary = useCallback(
    (note: {
      body: string;
      x: number;
      y: number;
      source: "creator" | "learner";
    }) => {
      setInjectMapNote((prev) => ({
        token: (prev?.token || 0) + 1,
        body: note.body,
        x: note.x,
        y: note.y,
        source: note.source,
      }));
    },
    [],
  );

  const handleCloseEmptyCreate = useCallback(() => {
    applyMapSelectionResult(
      nextWorkspaceMapSelection({ type: "clear" }),
    );
  }, [applyMapSelectionResult]);

  const handleCloseCombine = useCallback(() => {
    applyMapSelectionResult(
      nextWorkspaceMapSelection({ type: "clear" }),
    );
  }, [applyMapSelectionResult]);

  const handleMapSelectionChange = useCallback(
    (selection: WorkspaceMapSelection) => {
      applyMapSelectionResult(selection);
      if (selection.kind === "block" || selection.kind === "blocks" || selection.kind === "empties") {
        setMobileColumn("workspace");
      }
      if (selection.kind !== "block") {
        setCloneArm(createDisarmedCloneState());
      }
    },
    [applyMapSelectionResult, setMobileColumn],
  );

  const naturalRightPane = resolveWorkspaceRightPane(
    expandedBlockId,
    emptySurface,
    selectedFilledBlockIds,
  );
  const mapExploreColumn = resolveMapExploreRightColumn({
    exploreOpen: mapExploreShell.open,
    naturalPane: naturalRightPane,
    previousPane: mapExploreShell.previousPane,
  });
  /** When explore FAB is open, force explore surface (hide drawers). */
  const rightPane = mapExploreColumn.showExplore
    ? "map_tools"
    : mapExploreColumn.displayPane === "map_explore"
      ? "map_tools"
      : naturalRightPane;
  const showMapExplore = mapExploreColumn.showExplore;

  const handleToggleMapExplore = useCallback(() => {
    setMapExploreShell((prev) =>
      prev.open
        ? closeMapExploreShell(prev)
        : openMapExploreShell(prev, naturalRightPane),
    );
  }, [naturalRightPane]);

  const handleMapToggle = useCallback(
    (clicked: WorkspaceMapToggleId) => {
      const next = nextWorkspaceMapToggle({
        clicked,
        interactionMode,
        exploreOpen: mapExploreShell.open,
      });
      setMapExploreShell((prev) => {
        if (next.exploreOpen && !prev.open) {
          return openMapExploreShell(prev, naturalRightPane);
        }
        if (!next.exploreOpen && prev.open) {
          return closeMapExploreShell(prev);
        }
        return prev;
      });
      return next;
    },
    [interactionMode, mapExploreShell.open, naturalRightPane],
  );
  const addTargetCell =
    emptySurface?.kind === "add_block" ? emptySurface.cell : null;
  const exploreTargetCell =
    emptySurface?.kind === "explore_block" ? emptySurface.cell : null;
  const generateShapeCells =
    emptySurface?.kind === "generate_shape" ? emptySurface.cells : null;
  const combineBlockIds =
    rightPane === "combine_blocks" ? selectedFilledBlockIds : [];
  const orderedBlocks = getOrderedSessions(nodes as Parameters<typeof getOrderedSessions>[0]);
  const detailBlock =
    expandedBlockId != null
      ? orderedBlocks.find((n) => n.id === expandedBlockId) ?? null
      : null;
  const detailIndex = detailBlock
    ? orderedBlocks.findIndex((n) => n.id === detailBlock.id)
    : -1;

  const clearMapChromeForModeFlip = useCallback(() => {
    applyMapSelectionResult(nextWorkspaceMapSelection({ type: "clear" }));
    setAddExpandPreviewCells(null);
    setGeneratorTargetPreviewCells(null);
    setGeneratorPickActiveSafe(false);
    generatorEmptyToggleRef.current = null;
    setDynamicPickActiveSafe(false);
    setDynamicUnlockPreviewIds(null);
    dynamicBlockToggleRef.current = null;
  }, [applyMapSelectionResult, setDynamicPickActiveSafe, setGeneratorPickActiveSafe]);

  return {
    generatorTargetPreviewCells,
    setGeneratorTargetPreviewCells,
    generatorPickActive,
    setGeneratorPickActiveSafe,
    registerGeneratorEmptyToggle,
    handleGeneratorEmptyToggle,
    dynamicPickActive,
    setDynamicPickActiveSafe,
    dynamicUnlockPreviewIds,
    setDynamicUnlockPreviewIds,
    registerDynamicBlockToggle,
    handleDynamicBlockToggle,
    mapSelection,
    applyMapSelectionResult,
    handleMapSelectionChange,
    selectiveExplanationActive,
    setSelectiveExplanationActive,
    selectiveExplanationPolygon,
    setSelectiveExplanationPolygon,
    injectMapNote,
    addExpandPreviewCells,
    setAddExpandPreviewCells,
    expandJobs,
    setExpandJobs,
    clusterMapJob,
    setClusterMapJob,
    expandAbortRef,
    expandJobSeqRef,
    cloneArm,
    setCloneArm,
    handleAbortExpandJob,
    expandedBlockId,
    selectedFilledBlockIds,
    emptySurface,
    handleExpandedBlockChange,
    handleCloseBlockDetail,
    handleCloneArm,
    handleCloneCancel,
    handleEmptyMapSearchBlocks,
    handleEmptyMapSuggestCells,
    handleSelectiveExplanationComplete,
    handleCreateNoteFromSummary,
    handleCloseEmptyCreate,
    handleCloseCombine,
    rightPane,
    showMapExplore,
    handleToggleMapExplore,
    handleMapToggle,
    exploreTargetCell,
    addTargetCell,
    generateShapeCells,
    combineBlockIds,
    detailBlock,
    detailIndex,
    clearMapChromeForModeFlip,
  };
}
