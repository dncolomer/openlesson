"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import {
  blockHasAttachedLocalContext,
  skillNodeOccupiedCells,
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_GAP,
  SKILL_GRID_PITCH,
  type GridCell,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  freeformCellExternalEdges,
  freeformLabelCell,
  freeformShapeKeySet,
  freeformTilePixelSize,
  footprintFromCells,
  normalizeSpan,
} from "@/lib/skill-grid-ops";
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
  parseBlockPracticeOptions,
  practiceOptionsIconKeys,
} from "@/lib/block-practice-options";
import {
  creatorEffectIconKeys,
  isGeneratorEffectBusy,
  learnerDynamicMapLabel,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import {
  MAP_CELL_EMPTY_SELECTED_CLASS,
  MAP_CELL_GENERATION_PENDING_CLASS,
  MAP_CELL_TIM_UNOPENED_CLASS,
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
  chapterHasDagLockChrome,
  incompleteInboundNextPrerequisites,
  isChapterMapTileLocked,
  isLearnerMapBlockLocked,
  learnerBlockHasDependencyChrome,
} from "@/lib/learner-local-dag";
import {
  resolveEmptyCellMarker,
  resolveMapOccupiedTileBadges,
} from "@/lib/map-tile-badges";
import {
  resolveMapBlockHighlightRole,
  type LassoShapeKind,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import {
  isBlockLockedUntilCompleted,
  normalizeLockUntilBlockIds,
} from "@/lib/map-ground-rules";
import type { PlacedBlockRef } from "@/lib/skill-grid-ops";
import type { MapFogLookup } from "@/lib/map-fog-of-war";
import {
  BlockCreatorEffectsBadge,
  BlockDependencyLockBadge,
  BlockGeneratorTargetSparkBadge,
  BlockLocalContextDocBadge,
  BlockPracticeOptionsBadge,
  BlockPreviousSessionsPickaxeBadge,
  BlockStarterFlagBadge,
  MapCellStatusGlyph,
} from "@/components/block-skill-grid/map-tile-badges";
import { workspaceTileShowsPreviousSessionsPickaxe } from "@/lib/block-previous-sessions";
import {
  DEFAULT_BLOCK_MAP_ICON,
  ILE_GATHER_RUNNING_MAP_ICON,
  isTimExploreMapIcon,
  resolveBlockMapGlyph,
} from "@/lib/block-map-glyph";
import { ileGatherRunningTileIds, type IleGatherJob } from "@/lib/ile-gather-resources";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";
import {
  BlockCircularMenuRing,
  BlockGatherNotificationDot,
  BlockInTileProgress,
} from "@/components/block-skill-grid/block-circular-menu";
import {
  ileCircularMenuDisabledActionIds,
  type BlockCircularMenuActionId,
  type BlockCircularMenuSurface,
} from "@/lib/block-circular-menu";

export function MapWorldLayer({
  visibleCells,
  occupancy,
  selectedEmptyCells,
  generationPendingCellKeys,
  previewEmptyCells,
  generatorSparkEmptyKeys,
  unusableKeys,
  mapExploreOpen = false,
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
  circularMenuSurface = "none",
  circularMenuBlockId = null,
  circularMenuEmptyCell = null,
  onCircularMenuAction,
  onEmptyCircularMenuAction,
  blockProgressById,
  unseenGatherById,
  gatherJobs = null,
}: {
  visibleCells: GridCell[];
  occupancy: Map<string, string>;
  selectedEmptyCells: GridCell[];
  generationPendingCellKeys: Set<string>;
  previewEmptyCells?: Array<{ row: number; col: number }> | null;
  generatorSparkEmptyKeys: Set<string>;
  unusableKeys: Set<string>;
  mapExploreOpen?: boolean;
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
  suggestMode: "block" | "chapter";
  previewTargetId: string | null;
  previewPrereqIds: string[];
  prereqEdit: PrereqEditState;
  chapterUnlockHighlightIds: Set<string>;
  learnerDepHighlightIds: Set<string>;
  workedOnIds: Set<string>;
  previousSessionBlockIds?: Set<string>;
  generationLockedBlockIds: Set<string>;
  dynamicUnlockHighlightIds: Set<string>;
  dynamicGeneratedSet: Set<string>;
  optimisticPlacements: Record<string, unknown>;
  canDragBlocks: boolean;
  spaceHeld: boolean;
  showProgress: boolean;
  handleCellSelect: (id: string, e: MouseEvent) => void;
  handleBlockDoubleClick: (id: string) => void;
  circularMenuSurface?: BlockCircularMenuSurface;
  circularMenuBlockId?: string | null;
  circularMenuEmptyCell?: { row: number; col: number } | null;
  onCircularMenuAction?: (blockId: string, action: BlockCircularMenuActionId) => void;
  onEmptyCircularMenuAction?: (action: BlockCircularMenuActionId) => void;
  blockProgressById?: Readonly<Record<string, number>>;
  unseenGatherById?: Readonly<Record<string, boolean>>;
  gatherJobs?: readonly IleGatherJob[] | null;
  handleBlockPointerDown: (id: string, cell: GridCell, e: PointerEvent) => void;
  handleBlockPointerMove: (e: PointerEvent) => void;
  handleBlockPointerUp: (e: PointerEvent) => void;
  soleStretchBlockId: string | null;
  renderStretchHandles: (blockId: string) => ReactNode;
  annotationLayers: AnnotationLayer[];
}) {
  const gatheringTileIds = ileGatherRunningTileIds(gatherJobs);
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
              exploreActive: mapExploreOpen,
              canEdit,
              learnerMode,
              isUnusable,
              isGeneratorSpark: isGeneratorSparkEmpty,
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
                  left: cell.col * SKILL_GRID_PITCH,
                  top: cell.row * SKILL_GRID_PITCH,
                  width: SKILL_GRID_CELL_SIZE,
                  height: SKILL_GRID_CELL_SIZE,
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
                  style={{ opacity: fog.opacity }}
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
                      : mapExploreOpen
                        ? "Click empty to explore this cell"
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
                    <span className="text-[9px] uppercase tracking-wide text-neutral-600">∅</span>
                  ) : emptyMarker === "search" ? (
                    <span
                      className="text-neutral-400"
                      data-empty-cell-search
                      aria-hidden
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <circle cx="11" cy="11" r="6" />
                        <path
                          strokeLinecap="round"
                          d="M16.5 16.5L20 20"
                        />
                      </svg>
                    </span>
                  ) : emptyMarker === "plus" ? (
                    <span
                      className="text-xl leading-none text-neutral-600"
                      data-empty-cell-plus
                    >
                      +
                    </span>
                  ) : null}
                </button>
                {circularMenuSurface === "ile" &&
                circularMenuEmptyCell?.row === cell.row &&
                circularMenuEmptyCell?.col === cell.col ? (
                  <BlockCircularMenuRing
                    surface={circularMenuSurface}
                    empty
                    onAction={(action) => onEmptyCircularMenuAction?.(action)}
                  />
                ) : null}
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

            const isBlockHighlighted =
              multiSelected ||
              selectedNodeId === node.id ||
              focusedNodeId === node.id;
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
                    focused: isBlockHighlighted,
                    workedOn: itemWorkedOn,
                  })
                : null;
            const occupiedChrome =
              chapterChrome ??
              resolveOccupiedMapTileChrome({
                learnerMode,
                status: displayStatus,
                selected: isBlockHighlighted,
                focused: isBlockHighlighted,
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
            const timUnopened = isTimExploreMapIcon(node.map_icon);
            const tileClass = `relative flex h-full w-full flex-col items-center justify-center rounded-none border px-2 text-center transition ${
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
            } ${timUnopened ? MAP_CELL_TIM_UNOPENED_CLASS : ""}`;
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
              exploreActive: mapExploreOpen,
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
            const hasPreviousSessions = workspaceTileShowsPreviousSessionsPickaxe({
              suggestMode,
              blockId: node.id,
              previousSessionBlockIds,
            });
            const previousSessionsBadge = hasPreviousSessions ? (
              <BlockPreviousSessionsPickaxeBadge />
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
            const isChapterSurface = suggestMode === "chapter";
            const mapGlyph = resolveBlockMapGlyph({
              map_keyword: node.map_keyword,
              map_icon: node.map_icon,
              title: node.title,
            });
            const glyphKeyword = mapTitle === "?" ? "?" : mapGlyph.keyword;
            const gathering = gatheringTileIds.has(node.id);
            const glyphIcon = gathering
              ? ILE_GATHER_RUNNING_MAP_ICON
              : mapTitle === "?"
                ? DEFAULT_BLOCK_MAP_ICON
                : mapGlyph.icon;
            const statusGlyph = (
              <MapCellStatusGlyph
                status={node.status}
                showProgress={showProgress}
                title={mapTitle}
                statusIcon={chapterStatusIcon}
                keyword={glyphKeyword}
                icon={glyphIcon}
                labelMode="glyph"
                glyphVariant={isChapterSurface ? "outline" : "solid"}
              />
            );
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
                    const radius = 0;
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
                          zIndex:
                            circularMenuBlockId === node.id
                              ? 40
                              : isDragParticipant && blockDragOffset
                                ? 5
                                : 2,
                        }}
                      >
                        <button
                          type="button"
                          data-block-id={node.id}
                          data-tim-unopened={timUnopened ? "true" : undefined}
                          data-tim-explore-icon={timUnopened ? "true" : undefined}
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
                          data-block-has-previous-sessions={
                            hasPreviousSessions ? "true" : "false"
                          }
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
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleBlockDoubleClick(node.id);
                          }}
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
                              {statusGlyph}
                              <BlockInTileProgress fraction={blockProgressById?.[node.id] ?? 0} />
                              <BlockGatherNotificationDot visible={Boolean(unseenGatherById?.[node.id])} />
                              {learnerLockedLabel}
                              {practiceBadge}
                              {effectBadge}
                              {generatorSparkBadge}
                              {localContextBadge}
                              {starterBadge}
                              {previousSessionsBadge}
                              {lockBadge}
                            </>
                          ) : null}
                        </button>
                        {isLabel &&
                        circularMenuSurface !== "none" &&
                        !mapExploreOpen &&
                        circularMenuBlockId === node.id ? (
                          <BlockCircularMenuRing
                            surface={circularMenuSurface}
                            timUnopened={timUnopened}
                            onAction={(action) => onCircularMenuAction?.(node.id, action)}
                            disabledIds={
                              circularMenuSurface === "ile"
                                ? ileCircularMenuDisabledActionIds({ completed: itemDone })
                                : undefined
                            }
                          />
                        ) : null}
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
                    circularMenuBlockId === node.id
                      ? 40
                      : isDragParticipant && blockDragOffset
                        ? 5
                        : liveStretch
                          ? 5
                          : undefined,
                }}
              >
                <button
                  type="button"
                  data-block-id={node.id}
                  data-tim-unopened={timUnopened ? "true" : undefined}
                  data-tim-explore-icon={timUnopened ? "true" : undefined}
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
                  data-block-has-previous-sessions={
                    hasPreviousSessions ? "true" : "false"
                  }
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
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleBlockDoubleClick(node.id);
                  }}
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
                  {statusGlyph}
                  <BlockInTileProgress fraction={blockProgressById?.[node.id] ?? 0} />
                  <BlockGatherNotificationDot visible={Boolean(unseenGatherById?.[node.id])} />
                  {learnerLockedLabel}
                  {practiceBadge}
                  {effectBadge}
                  {generatorSparkBadge}
                  {localContextBadge}
                  {starterBadge}
                  {previousSessionsBadge}
                  {lockBadge}
                </button>
                {circularMenuSurface !== "none" &&
                !mapExploreOpen &&
                circularMenuBlockId === node.id ? (
                  <BlockCircularMenuRing
                    surface={circularMenuSurface}
                    timUnopened={timUnopened}
                    onAction={(action) => onCircularMenuAction?.(node.id, action)}
                    disabledIds={
                      circularMenuSurface === "ile"
                        ? ileCircularMenuDisabledActionIds({ completed: itemDone })
                        : undefined
                    }
                  />
                ) : null}
                {renderStretchHandles(node.id)}
              </div>
            );
          })}

      <MapAnnotationStrokes annotationLayers={annotationLayers} />
    </>
  );
}
