"use client";

import type { UnusableCell } from "@/lib/map-ground-rules";
import type {
  BlockLocalContextInput,
  WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

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
 * Map right pane when no block is open.
 * Ground tools live on the left strip; double-click a block for detail.
 */
export function WorkspaceMapAuthoringPane({
  canEdit,
}: {
  canEdit: boolean;
  workspaceId?: string | null;
  ayclToken?: string;
  blocks?: MapAuthoringBlock[];
  unusableCells?: UnusableCell[];
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  files?: WorkspaceFileContextItem[] | null;
  onSetLockUntil?: (blockId: string, prerequisiteIds: string[]) => Promise<void> | void;
  onToggleUnusable?: (row: number, col: number) => Promise<void> | void;
  busy?: boolean;
}) {
  return (
    <div
      data-workspace-right-pane="map_tools"
      data-workspace-map-authoring-pane
      className="flex h-full min-h-0 flex-col items-center justify-center gap-2 overflow-y-auto p-4 text-center"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600">
        Map
      </p>
      <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
        {canEdit
          ? "Left toolbar: select, move, lock-until, unusable ground. Double-click a block to open detail."
          : "Double-click a block to open detail. Context materials live under the Context tab."}
      </p>
      <p className="text-[11px] text-neutral-600">
        External sources, notes, and files are managed in{" "}
        <span className="text-neutral-400">Context</span>.
      </p>
    </div>
  );
}
