"use client";

import { useCallback, useMemo } from "react";
import {
  getWeightedNeighborhood,
  isCellOccupied,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import { DEFAULT_MODEL } from "@/lib/xai-models";
import { MODEL_STORAGE_KEY } from "@/components/block-skill-grid/types";
import {
  normalizeSpan,
  parseShapeCells,
  stretchBlockFromHandle,
  translateBlocksPreservingShape,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";
import type { Dispatch, SetStateAction } from "react";

const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

export function useMapGridMutate(input: {
  canSuggest: boolean;
  isSuggesting: boolean;
  setIsSuggesting: (v: boolean) => void;
  setSuggestError: (next: string | null) => void;
  setSuggestions: (next: string[]) => void;
  workspaceId?: string;
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  locale: string;
  suggestMode: "block" | "chapter";
  labels: BlockSkillGridProps["labels"];
  shapeFootprint: {
    span_w: number;
    span_h: number;
    position_x: number;
    position_y: number;
  } | null;
  selectedEmptyCells: GridCell[];
  shapeWeightedNeighbors: ReturnType<typeof getWeightedNeighborhood>;
  localPendingCell: GridCell | null;
  placements: Map<string, GridCell>;
  nodesById: Map<string, SkillGridNode>;
  occupancy: Map<string, string>;
  prompt: string;
  setPrompt: (next: string) => void;
  setLocalPendingCell: (cell: GridCell | null) => void;
  setAddError: (err: string | null) => void;
  busy: boolean;
  onAddBlock: BlockSkillGridProps["onAddBlock"];
  clearSelection: () => void;
  onGridOp?: BlockSkillGridProps["onGridOp"];
  placedBlocksForStretch: PlacedBlockRef[];
  stretchOccupancy: Map<string, string>;
  setOptimisticPlacements: (
    next:
      | Record<string, unknown>
      | ((prev: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
  setMapSaveJobs: Dispatch<SetStateAction<Array<{
    id: string;
    label: string;
    status: "saving" | "saved" | "error";
    error?: string;
  }>>>;
  geometrySaveChainRef: { current: Promise<void> };
  setLocalBusy: (busy: boolean) => void;
  setShapePromptOpen: (open: boolean) => void;
  setMergePromptOpen: (open: boolean) => void;
  selectedBlockIds: string[];
  setSelectedEmptyCells: (next: GridCell[]) => void;
  setSelectedBlockIds: (next: string[]) => void;
  selectedEmptyCellsRef: { current: GridCell[] };
  selectedBlockIdsRef: { current: string[] };
  displayNodes: SkillGridNode[];
}) {
  const {
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
  } = input;

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



  return {
    runSuggestTopics,
    handleSuggestShapeTopics,
    localPendingNeighbors,
    handleSuggestLocalAdd,
    submitLocalAdd,
    runGridOp,
  };
}
