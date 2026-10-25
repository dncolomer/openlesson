"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import {
  skillGridMetrics,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import type { OptimisticPlacement, PlacedBlockRef } from "@/lib/skill-grid-ops";
import type { AnnotationLayer } from "@/lib/map-annotation-layers";
import { MapAnnotationStrokes } from "@/components/block-skill-grid/map-annotation-strokes";
import {
  canDeleteMapNote,
  canEditMapNoteContent,
  canMutateMapNoteGeometry,
  learnerNoteLayerStyle,
  type LearnerMapNote,
} from "@/lib/learner-map-notes";
import { LearnerMapNotePostIt } from "@/components/LearnerMapNotePostIt";
import {
  MAP_CELL_EMPTY_SELECTED_CLASS,
  MAP_CELL_GENERATION_PENDING_CLASS,
  MAP_CELL_UNUSABLE_CLASS,
} from "@/lib/map-cell-chrome";
import { resolveEmptyCellMarker } from "@/lib/map-tile-badges";
import {
  type LassoShapeKind,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import type { MapFogLookup } from "@/lib/map-fog-of-war";
import { BlockGeneratorTargetSparkBadge } from "@/components/block-skill-grid/map-tile-badges";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";
import { useSurfaceAestheticImages } from "@/lib/use-surface-aesthetic-images";
import { OccupiedMapTile } from "@/components/block-skill-grid/occupied-map-tile";

export function MapWorldLayer({
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
  aestheticImages = null,
  previousSessionBlockIds = new Set<string>(),
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
  blockProgressById,
  unseenGatherById,
}: {
  visibleCells: GridCell[];
  occupancy: Map<string, string>;
  selectedEmptyCells: GridCell[];
  generationPendingCellKeys: Set<string>;
  previewEmptyCells?: Array<{ row: number; col: number }> | null;
  generatorSparkEmptyKeys: Set<string>;
  unusableKeys: Set<string>;
  busy: boolean;
  handleEmptyCellClick: (cell: GridCell, e: MouseEvent | PointerEvent) => void;
  handleEmptyCellPointerDown: (cell: GridCell, e: PointerEvent) => void;
  handleEmptyCellPointerMove: (e: PointerEvent) => void;
  handleEmptyCellPointerUp: (e: PointerEvent) => void;
  fogLookup: MapFogLookup;
  generatorPickActive: boolean;
  activeLassoShape: LassoShapeKind | null | undefined;
  canEdit: boolean;
  activeTool: string;
  labels: BlockSkillGridProps["labels"];
  learnerMode: boolean;
  viewOnly: boolean;
  mountMapNotes: boolean;
  mapNotesOnPlane: LearnerMapNote[];
  zoom: number;
  handleLearnerNoteToggle: (id: string) => void;
  handleLearnerNoteSaveBody: (id: string, body: string) => void;
  handleLearnerNoteDelete: (id: string) => void;
  handleLearnerNoteDragEnd: (id: string, next: { x: number; y: number }) => void;
  handleLearnerNoteResizeEnd: (id: string, next: { width: number; height: number }) => void;
  renderedBlockIds: Iterable<string>;
  nodesById: Map<string, SkillGridNode>;
  placements: Map<string, GridCell>;
  spans: Map<string, { span_w: number; span_h: number }>;
  stretchPreview: PlacedBlockRef | null;
  selectedBlockIds: string[];
  blockDragIds: string[] | null;
  appearingNodeIds: string[];
  visibleAppearing: Set<string>;
  blockDragOffset: { dRow: number; dCol: number } | null;
  selectedNodeId: string | null;
  focusedNodeId?: string | null;
  displayNodes: SkillGridNode[];
  previewTargetId: string | null;
  previewPrereqIds: string[];
  prereqEdit: PrereqEditState;
  learnerDepHighlightIds: Set<string>;
  workedOnIds: Set<string>;
  aestheticImages?: readonly string[] | null;
  previousSessionBlockIds?: Set<string>;
  generationLockedBlockIds: Set<string>;
  dynamicUnlockHighlightIds: Set<string>;
  dynamicGeneratedSet: Set<string>;
  optimisticPlacements: Record<string, OptimisticPlacement>;
  canDragBlocks: boolean;
  spaceHeld: boolean;
  showProgress: boolean;
  handleCellSelect: (id: string, e: MouseEvent) => void;
  handleBlockDoubleClick: (id: string) => void;
  blockProgressById?: Readonly<Record<string, number>>;
  unseenGatherById?: Readonly<Record<string, boolean>>;
  handleBlockPointerDown: (id: string, cell: GridCell, e: PointerEvent) => void;
  handleBlockPointerMove: (e: PointerEvent) => void;
  handleBlockPointerUp: (e: PointerEvent) => void;
  soleStretchBlockId: string | null;
  renderStretchHandles: (blockId: string) => ReactNode;
  annotationLayers: AnnotationLayer[];
}) {
  const surface = useSurfaceAestheticImages(aestheticImages);
  const aestheticPool = surface.source === "pending" ? undefined : surface.images;
  const grid = skillGridMetrics("workspace");
  return (
    <>
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
            const emptyMarker = resolveEmptyCellMarker({
              canEdit,
              learnerMode,
              isUnusable,
              isGeneratorSpark: isGeneratorSparkEmpty,
              surface: "block",
            });
            const fog = fogLookup(cell.row, cell.col);
            return (
              <div
                key={`empty-${cell.row}:${cell.col}`}
                data-skill-cell
                data-map-cell-kind={isUnusable ? "unusable" : "open"}
                data-map-fog-fully-visible={fog.fullyVisible ? "true" : "false"}
                data-map-fog-opacity={String(fog.opacity)}
                data-generator-target-empty={
                  isGeneratorSparkEmpty ? "true" : undefined
                }
                className="absolute"
                style={{
                  left: cell.col * grid.pitch,
                  top: cell.row * grid.pitch,
                  width: grid.cellSize,
                  height: grid.cellSize,
                }}
              >
                {fog.opacity < 1 ? (
                  <div
                    aria-hidden
                    data-map-fog-veil
                    className="pointer-events-none absolute inset-0 rounded-none bg-[#080808]"
                    style={{ opacity: 1 - fog.opacity }}
                  />
                ) : null}
                <button
                  type="button"
                  // Keep enabled for empty-drag pan in Learner (!canEdit).
                  // Authoring (Add) still gated in handleEmptyCellClick via canEdit
                  // and fully-visible fog (fade/black empties cannot be used to add).
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
                  style={{
                    opacity: fog.opacity,
                  }}
                  onClick={(e) => {
                    // Primary path for empty select / Add (plain + Shift multi).
                    // Empty pan sets suppressEmptyClickRef so this is skipped.
                    handleEmptyCellClick(cell, e);
                  }}
                  onPointerDown={(e) => handleEmptyCellPointerDown(cell, e)}
                  onPointerMove={handleEmptyCellPointerMove}
                  onPointerUp={handleEmptyCellPointerUp}
                  onPointerCancel={handleEmptyCellPointerUp}
                  className={`relative flex h-full w-full flex-col items-center justify-center rounded-none border border-dashed transition ${
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
                      : canEdit && !fog.fullyVisible && !activeLassoShape
                        ? "Hidden by fog — add only on fully visible empty cells · drag a block or use Best spot to reveal"
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
                    <span
                      className="text-[9px] uppercase tracking-wide text-neutral-600"
                      data-map-cell-unusable-mark
                    >
                      ∅
                    </span>
                  ) : !isUnusable && emptyMarker === "plus" ? (
                    <span
                      className="text-xl leading-none text-neutral-600"
                      data-empty-cell-plus
                    >
                      +
                    </span>
                  ) : null}
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
          {[...renderedBlockIds].map((blockId) => (
            <OccupiedMapTile
              key={`block-${blockId}`}
              blockId={blockId}
              nodesById={nodesById}
              placements={placements}
              spans={spans}
              stretchPreview={stretchPreview}
              selectedBlockIds={selectedBlockIds}
              blockDragIds={blockDragIds}
              appearingNodeIds={appearingNodeIds}
              visibleAppearing={visibleAppearing}
              blockDragOffset={blockDragOffset}
              selectedNodeId={selectedNodeId}
              focusedNodeId={focusedNodeId}
              displayNodes={displayNodes}
              previewTargetId={previewTargetId}
              previewPrereqIds={previewPrereqIds}
              prereqEdit={prereqEdit}
              learnerMode={learnerMode}
              learnerDepHighlightIds={learnerDepHighlightIds}
              workedOnIds={workedOnIds}
              previousSessionBlockIds={previousSessionBlockIds}
              generationLockedBlockIds={generationLockedBlockIds}
              dynamicUnlockHighlightIds={dynamicUnlockHighlightIds}
              dynamicGeneratedSet={dynamicGeneratedSet}
              optimisticPlacements={optimisticPlacements}
              canDragBlocks={canDragBlocks}
              spaceHeld={spaceHeld}
              canEdit={canEdit}
              showProgress={showProgress}
              aestheticPool={aestheticPool}
              handleCellSelect={handleCellSelect}
              handleBlockDoubleClick={handleBlockDoubleClick}
              handleBlockPointerDown={handleBlockPointerDown}
              handleBlockPointerMove={handleBlockPointerMove}
              handleBlockPointerUp={handleBlockPointerUp}
              soleStretchBlockId={soleStretchBlockId}
              renderStretchHandles={renderStretchHandles}
              blockProgressById={blockProgressById}
              unseenGatherById={unseenGatherById}
            />
          ))}

      <MapAnnotationStrokes annotationLayers={annotationLayers} />
    </>
  );
}
