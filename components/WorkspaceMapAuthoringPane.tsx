"use client";

import type { UnusableCell } from "@/lib/map-ground-rules";
import type {
  BlockLocalContextInput,
  WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";
import {
  WorkspaceEmptyMapPane,
} from "@/components/WorkspaceEmptyMapPane";
import type { EmptyMapCell } from "@/lib/empty-map-pane";
import type { GridContinuousPoint } from "@/lib/block-map-tools";
import type { MapNoteSource } from "@/lib/learner-map-notes";

export type MapAuthoringBlock = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  is_start?: boolean;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  next_block_ids?: string[];
  lock_until_block_ids?: string[] | null;
  local_context?: BlockLocalContextInput | null;
};

/**
 * Map right pane when no block / empty create surface is open, OR when Map
 * Explore is toggled open via the floating search control.
 *
 * - exploreOpen=false (default empty selection): short idle tip only.
 * - exploreOpen=true: full map explore UI (search / suggest / overview / area).
 */
export function WorkspaceMapAuthoringPane({
  canEdit,
  interactionMode = "creator",
  workspaceId = null,
  ayclToken,
  locale = "en",
  blocks = [],
  unusableCells = null,
  exploreOpen = false,
  selectivePolygon = null,
  selectiveDrawing = false,
  onSearchSelectBlocks,
  onSuggestSelectEmptyCells,
  onStartSelectiveDraw,
  onClearSelectiveOverlay,
  onCreateNoteFromSummary,
  busy = false,
}: {
  canEdit: boolean;
  interactionMode?: "creator" | "learner";
  workspaceId?: string | null;
  ayclToken?: string | null;
  locale?: string;
  blocks?: MapAuthoringBlock[];
  unusableCells?: UnusableCell[] | null;
  /** When true, show map explore UI (FAB open). Default idle empty pane. */
  exploreOpen?: boolean;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  files?: WorkspaceFileContextItem[] | null;
  onSetLockUntil?: (blockId: string, prerequisiteIds: string[]) => Promise<void> | void;
  onToggleUnusable?: (row: number, col: number) => Promise<void> | void;
  selectivePolygon?: GridContinuousPoint[] | null;
  selectiveDrawing?: boolean;
  onSearchSelectBlocks?: (blockIds: string[]) => void;
  onSuggestSelectEmptyCells?: (cells: EmptyMapCell[]) => void;
  onStartSelectiveDraw?: () => void;
  onClearSelectiveOverlay?: () => void;
  onCreateNoteFromSummary?: (input: {
    body: string;
    x: number;
    y: number;
    source: MapNoteSource;
  }) => void;
  busy?: boolean;
}) {
  if (exploreOpen) {
    return (
      <div
        data-workspace-map-authoring-pane
        data-workspace-right-pane="map_explore"
        data-map-explore-open="true"
        className="flex h-full min-h-0 flex-col"
      >
        <WorkspaceEmptyMapPane
          canEdit={canEdit}
          interactionMode={interactionMode}
          workspaceId={workspaceId}
          ayclToken={ayclToken}
          locale={locale}
          blocks={blocks}
          unusableCells={unusableCells}
          selectivePolygon={selectivePolygon}
          selectiveDrawing={selectiveDrawing}
          onSearchSelectBlocks={onSearchSelectBlocks}
          onSuggestSelectEmptyCells={onSuggestSelectEmptyCells}
          onStartSelectiveDraw={onStartSelectiveDraw}
          onClearSelectiveOverlay={onClearSelectiveOverlay}
          onCreateNoteFromSummary={onCreateNoteFromSummary}
          busy={busy}
        />
      </div>
    );
  }

  return (
    <div
      data-workspace-right-pane="map_tools"
      data-workspace-map-authoring-pane
      data-map-explore-open="false"
      className="flex h-full min-h-0 flex-col items-center justify-center gap-2 overflow-y-auto p-4 text-center"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600">
        Map
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
        {canEdit
          ? "Left toolbar: select, move, lock-until, unusable ground. Double-click a block to open detail. Use the search control on the map to explore."
          : "Double-click a block to open detail. Use the search control on the map to explore."}
      </p>
      <p className="text-[11px] text-neutral-600">
        External sources, notes, and files are managed in{" "}
        <span className="text-neutral-400">Context</span>.
      </p>
    </div>
  );
}
