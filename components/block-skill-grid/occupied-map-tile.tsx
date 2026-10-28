"use client";

import type { MouseEvent, PointerEvent, ReactNode } from "react";
import {
  skillGridMetrics,
  skillNodeOccupiedCells,
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
  type OptimisticPlacement,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import {
  isGeneratorEffectBusy,
  learnerDynamicMapLabel,
  parseBlockCreatorEffects,
} from "@/lib/block-creator-effects";
import {
  MAP_CELL_TIM_UNOPENED_CLASS,
  isMapCellDoneStatus,
  mapCellFreeformColors,
  mapCellFreeformDoneColors,
  mapCellFreeformPrereqColors,
  mapCellFreeformPreviousSessionsColors,
  mapCellFreeformSelfProgressColors,
} from "@/lib/map-cell-chrome";
import {
  LEARNER_MAP_CELL_DEP_HIGHLIGHT_CLASS,
  learnerMapFreeformColors,
  resolveOccupiedMapTileChrome,
} from "@/lib/workspace-learner-chrome";
import {
  incompleteInboundNextPrerequisites,
  isLearnerMapBlockLocked,
  learnerBlockHasDependencyChrome,
} from "@/lib/learner-local-dag";
import {
  resolveMapBlockHighlightRole,
  type PrereqEditState,
} from "@/lib/block-map-tools";
import {
  isBlockLockedUntilCompleted,
  normalizeLockUntilBlockIds,
} from "@/lib/map-ground-rules";
import { MapCellStatusGlyph } from "@/components/block-skill-grid/map-tile-badges";
import { workspaceTileShowsPreviousSessionsPickaxe } from "@/lib/block-previous-sessions";
import { parseMapBlock } from "@/lib/block-kind";
import {
  DEFAULT_BLOCK_MAP_ICON,
  PREVIOUS_SESSIONS_MAP_ICON,
  isTimExploreMapIcon,
  isTypedMapBlockKindIcon,
  mapBlockKindIconName,
  resolveBlockMapGlyph,
} from "@/lib/block-map-glyph";
import { aestheticImageForId } from "@/lib/aesthetics";
import {
  BlockGatherNotificationDot,
  BlockInTileProgress,
} from "@/components/block-skill-grid/block-circular-menu";

function OpenWorkTileAesthetic({
  src,
  opacity,
}: {
  src: string;
  /** Below 1, the still lets the route underneath show through. */
  opacity?: number;
}) {
  return (
    <span
      data-ile-open-work-tile-image
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${src})`, opacity }}
    />
  );
}

export type OccupiedMapTileProps = {
  blockId: string;
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
  learnerMode: boolean;
  learnerDepHighlightIds: Set<string>;
  workedOnIds: Set<string>;
  previousSessionBlockIds: Set<string>;
  generationLockedBlockIds: Set<string>;
  dynamicUnlockHighlightIds: Set<string>;
  dynamicGeneratedSet: Set<string>;
  optimisticPlacements: Record<string, OptimisticPlacement>;
  canDragBlocks: boolean;
  spaceHeld: boolean;
  canEdit: boolean;
  showProgress: boolean;
  aestheticPool: readonly string[] | undefined;
  handleCellSelect: (id: string, e: MouseEvent) => void;
  handleBlockDoubleClick: (id: string) => void;
  handleBlockPointerDown: (id: string, cell: GridCell, e: PointerEvent) => void;
  handleBlockPointerMove: (e: PointerEvent) => void;
  handleBlockPointerUp: (e: PointerEvent) => void;
  soleStretchBlockId: string | null;
  renderStretchHandles: (blockId: string) => ReactNode;
  blockProgressById?: Readonly<Record<string, number>>;
  unseenGatherById?: Readonly<Record<string, boolean>>;
};

export function OccupiedMapTile({
  blockId,
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
  learnerMode,
  learnerDepHighlightIds,
  workedOnIds,
  previousSessionBlockIds,
  generationLockedBlockIds,
  dynamicUnlockHighlightIds,
  dynamicGeneratedSet,
  optimisticPlacements,
  canDragBlocks,
  spaceHeld,
  canEdit,
  showProgress,
  aestheticPool,
  handleCellSelect,
  handleBlockDoubleClick,
  handleBlockPointerDown,
  handleBlockPointerMove,
  handleBlockPointerUp,
  soleStretchBlockId,
  renderStretchHandles,
  blockProgressById,
  unseenGatherById,
}: OccupiedMapTileProps) {
  const grid = skillGridMetrics("workspace");
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
    const freeform =
      !liveStretch &&
      Array.isArray(node.shape_cells) &&
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
        ? blockDragOffset.dCol * grid.pitch
        : 0;
    const dragDy =
      isDragParticipant && blockDragOffset
        ? blockDragOffset.dRow * grid.pitch
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
    const lockedByPrereq = learnerMode
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
    const hasDependencies = learnerBlockHasDependencyChrome(
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
      learnerMode &&
      !isBlockHighlighted &&
      learnerDepHighlightIds.has(node.id);
    const hasPreviousSessions = workspaceTileShowsPreviousSessionsPickaxe({
      blockId: node.id,
      previousSessionBlockIds,
    });
    const itemWorkedOn =
      workedOnIds.has(node.id) && !hasPreviousSessions;
    const itemDone = isMapCellDoneStatus(displayStatus);
    const tileAesthetic = hasPreviousSessions
      ? aestheticImageForId(node.id, aestheticPool)
      : null;
    const occupiedChrome = resolveOccupiedMapTileChrome({
        learnerMode,
        status: displayStatus,
        selected: isBlockHighlighted,
        focused: isBlockHighlighted,
        isStart: Boolean(node.is_start),
        locked: lockedByPrereq && !isBlockHighlighted && !isLearnerDepHighlight,
        depHighlight: isLearnerDepHighlight,
        highlightRole: learnerMode ? null : highlightRole,
        workedOn: itemWorkedOn,
        hasPreviousSessions,
      });
    const baseChrome = isLearnerDepHighlight
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
    const tileClass = `relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-none border px-2 text-center transition ${
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
    const isStarter = Boolean(node.is_start);
    // Dynamic “?” once configured (creator + learner) until generated.
    const mapTitle = learnerDynamicMapLabel({
      effects: nodeEffects,
      title: node.title,
      description: node.description,
      contentGenerated: dynamicGeneratedSet.has(node.id),
    });
    const mapGlyph = resolveBlockMapGlyph({
      map_keyword: node.map_keyword,
      map_icon: node.map_icon,
      map_block: node.map_block,
      title: node.title,
    });
    const glyphKeyword = mapTitle === "?" ? "?" : mapGlyph.keyword;
    const typedKindIcon = mapBlockKindIconName(
      parseMapBlock(node.map_block).kind,
    );
    const glyphIcon =
      typedKindIcon ||
      (isTypedMapBlockKindIcon(mapGlyph.icon) ? mapGlyph.icon : null) ||
      (mapTitle === "?"
        ? DEFAULT_BLOCK_MAP_ICON
        : hasPreviousSessions
          ? PREVIOUS_SESSIONS_MAP_ICON
          : mapGlyph.icon);
    const statusGlyph = (
      <MapCellStatusGlyph
        status={node.status}
        showProgress={showProgress}
        title={mapTitle}
        statusIcon={chapterStatusIcon}
        keyword={glyphKeyword}
        icon={glyphIcon}
        labelMode="glyph"
        glyphVariant="solid"
        glyphScale="block"
        hideIcon={Boolean(tileAesthetic)}
        labelPlate={false}
      />
    );
    // Names fill the tile. The badge span is shrink-wrapped, so an
    // absolute plate inside it collapses to nothing and overflow clips the word.
    const blockNameFrame = (
      <span className="pointer-events-none absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col">
        {statusGlyph}
      </span>
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
                  hasPreviousSessions,
                },
              )
            : hasPreviousSessions
              ? mapCellFreeformPreviousSessionsColors(
                  isBlockHighlighted || highlightRole === "target",
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
              grid.cellSize,
              grid.gap,
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
                  left: cell.col * grid.pitch + dragDx,
                  top: cell.row * grid.pitch + dragDy,
                  width,
                  height,
                  zIndex:
                    selectedBlockIds.includes(node.id)
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
                            : node.title
                  }
                  className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-2 text-center transition ${
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
                  data-block-session-aesthetic={
                    hasPreviousSessions && tileAesthetic ? "true" : undefined
                  }
                  style={{
                    ...tileTransition,
                    backgroundColor: tileAesthetic ? undefined : freeformFill,
                    color: tileAesthetic ? "#fff" : freeformText,
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
                  {tileAesthetic ? (
                    <OpenWorkTileAesthetic src={tileAesthetic} />
                  ) : null}
                  {isLabel ? (
                    <>
                      {blockNameFrame}
                      <span className="relative z-10 flex max-w-full flex-col items-center">
                      <BlockGatherNotificationDot visible={Boolean(unseenGatherById?.[node.id])} />
                      </span>
                      <BlockInTileProgress fraction={blockProgressById?.[node.id] ?? 0} />
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
                left: freeformBbox.position_x * grid.pitch + dragDx,
                top: freeformBbox.position_y * grid.pitch + dragDy,
                width:
                  freeformBbox.span_w * grid.cellSize +
                  (freeformBbox.span_w - 1) * grid.gap,
                height:
                  freeformBbox.span_h * grid.cellSize +
                  (freeformBbox.span_h - 1) * grid.gap,
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
      span.span_w * grid.cellSize + (span.span_w - 1) * grid.gap;
    const height =
      span.span_h * grid.cellSize + (span.span_h - 1) * grid.gap;

    return (
      <div
        key={`block-${node.id}`}
        data-skill-cell
        className="absolute"
        style={{
          left: renderCell.col * grid.pitch + dragDx,
          top: renderCell.row * grid.pitch + dragDy,
          width,
          height,
          zIndex:
            selectedBlockIds.includes(node.id)
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
          data-block-selected={isBlockHighlighted ? "true" : "false"}
          data-block-locked={lockedByPrereq ? "true" : "false"}
          data-block-has-dependencies={hasDependencies ? "true" : "false"}
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
          className={`${tileClass} ${tileAesthetic ? "text-white" : ""}`}
          style={tileTransition}
          data-block-session-aesthetic={
            hasPreviousSessions && tileAesthetic ? "true" : undefined
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
                    : node.title
          }
        >
          {tileAesthetic ? (
            <OpenWorkTileAesthetic src={tileAesthetic} />
          ) : null}
          {blockNameFrame}
          <span className="relative z-10 flex max-w-full flex-col items-center">
          <BlockGatherNotificationDot visible={Boolean(unseenGatherById?.[node.id])} />
          </span>
          <BlockInTileProgress fraction={blockProgressById?.[node.id] ?? 0} />
        </button>
        {renderStretchHandles(node.id)}
      </div>
    );
}
