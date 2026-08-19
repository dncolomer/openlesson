"use client";

import { formatGridCoordinate } from "@/lib/block-skill-grid";
import type { LassoShapeKind, PrereqEditState } from "@/lib/block-map-tools";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";

export function MapStatusBar({
  canEdit,
  prereqEdit,
  previewTargetId,
  previewPrereqIds,
  activeLassoShape,
  selectedBlockIds,
  selectedEmptyCells,
  manipulationMode,
  labels,
  shapeFootprint,
  shapeFreeformOk,
  addError,
}: {
  canEdit: boolean;
  prereqEdit: PrereqEditState;
  previewTargetId: string | null;
  previewPrereqIds: string[];
  activeLassoShape: LassoShapeKind | null | undefined;
  selectedBlockIds: string[];
  selectedEmptyCells: Array<{ row: number; col: number }>;
  manipulationMode: boolean;
  labels: BlockSkillGridProps["labels"];
  shapeFootprint: {
    span_w: number;
    span_h: number;
    position_x: number;
    position_y: number;
  } | null;
  shapeFreeformOk: boolean;
  addError: string | null;
}) {
  if (!canEdit) return null;
  return (
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
          {!shapeFreeformOk ? " · must be edge-connected" : ""}
        </span>
      )}
      {addError && <span className="ml-1 text-red-400/90">· {addError}</span>}
    </div>
  );
}
