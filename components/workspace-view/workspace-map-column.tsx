"use client";

import { SessionList } from "@/components/SessionList";
import type { Block, ClusterMapJob, InjectMapNote, MobileColumn, Workspace } from "@/components/workspace-view/types";
import type { AddExpandJob } from "@/lib/add-block-range-density";
import type { AyclCapabilities } from "@/lib/aycl-shared";
import type { GeneratorTargetCell } from "@/lib/block-creator-effects";
import type { UnusableCell } from "@/lib/map-ground-rules";
import type { SupabaseBrowserClient } from "@/lib/supabase/client";
import {
  visibleWorkspaceMapToggleIds,
  type WorkspaceInteractionMode,
} from "@/lib/workspace-mode";
import type { WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import { WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS } from "@/lib/workspace-right-pane";

export function WorkspaceMapColumn({
  mobileColumn,
  nodes,
  isOwner,
  isLearnerMode,
  currentUserId,
  ayclToken,
  isAycl,
  cloneArmed,
  cloneSourceBlockId,
  onCloneArm,
  onCloneCancel,
  onClonePaste,
  supabase,
  plan,
  workspaceId,
  onRefresh,
  onNodesUpdate,
  expandedBlockId,
  onExpandedNodeIdChange,
  onMapSelectionChange,
  mapSelection,
  selectiveExplanationActive,
  selectiveExplanationPolygon,
  onSelectiveExplanationComplete,
  injectMapNote,
  unusableCells,
  onMapGround,
  workspaceNotes,
  previewEmptyCells,
  generatorTargetPreviewCells,
  generatorPickActive,
  onGeneratorEmptyToggle,
  dynamicPickActive,
  onDynamicBlockToggle,
  dynamicUnlockPreviewIds,
  dynamicContentGeneratedIds,
  expandJobs,
  clusterMapJob,
  onAbortExpandJob,
  mapExploreOpen,
  onMapExploreToggle,
  onMapToggle,
  interactionMode,
  ayclCapabilities,
  selectInteractionMode,
}: {
  mobileColumn: MobileColumn;
  nodes: Block[];
  isOwner: boolean;
  isLearnerMode: boolean;
  currentUserId: string | null;
  ayclToken?: string;
  isAycl: boolean;
  cloneArmed: boolean;
  cloneSourceBlockId: string | null;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel: () => void;
  onClonePaste?: (sourceBlockId: string, target: { row: number; col: number }) => void;
  supabase: SupabaseBrowserClient;
  plan: Workspace;
  workspaceId: string;
  onRefresh: () => void;
  onNodesUpdate: (nodes: Block[]) => void;
  expandedBlockId: string | null;
  onExpandedNodeIdChange: (blockId: string | null) => void;
  onMapSelectionChange: (selection: WorkspaceMapSelection) => void;
  mapSelection: WorkspaceMapSelection;
  selectiveExplanationActive: boolean;
  selectiveExplanationPolygon: Array<{ x: number; y: number }> | null;
  onSelectiveExplanationComplete: (polygon: Array<{ x: number; y: number }>) => void;
  injectMapNote: InjectMapNote | null;
  unusableCells: UnusableCell[];
  onMapGround?: (payload: {
    op: "set_lock_until" | "set_unusable_cells";
    blockId?: string;
    prerequisiteIds?: string[];
    unusableCells?: Array<{ row: number; col: number }>;
  }) => Promise<void> | void;
  workspaceNotes: string;
  previewEmptyCells: Array<{ row: number; col: number }> | null;
  generatorTargetPreviewCells: ReadonlyArray<GeneratorTargetCell> | null;
  generatorPickActive: boolean;
  onGeneratorEmptyToggle?: (cell: { row: number; col: number }) => void;
  dynamicPickActive: boolean;
  onDynamicBlockToggle?: (blockId: string) => void;
  dynamicUnlockPreviewIds: readonly string[] | null;
  dynamicContentGeneratedIds: ReadonlySet<string>;
  expandJobs: AddExpandJob[];
  clusterMapJob: ClusterMapJob;
  onAbortExpandJob: (jobId: string) => void;
  mapExploreOpen: boolean;
  onMapExploreToggle: () => void;
  onMapToggle?: (id: "creator" | "learner" | "explore") => void;
  interactionMode: WorkspaceInteractionMode;
  ayclCapabilities: AyclCapabilities | null;
  selectInteractionMode: (mode: WorkspaceInteractionMode) => void;
}) {
  return (
    <aside className={`${mobileColumn === "sessions" ? "flex" : "hidden"} relative flex-1 min-h-0 flex-col border-b border-neutral-800/50 bg-[#0b0b0b] md:flex md:h-full ${WORKSPACE_MAP_DESKTOP_MAP_WIDTH_CLASS} md:border-b-0 md:border-r`}>
      <SessionList
        nodes={nodes}
        onSelect={() => {}}
        onDelete={() => {}}
        onFork={() => {}}
        isOwner={isOwner}
        learnerMode={isLearnerMode}
        learnerScopeId={currentUserId || ayclToken || "local"}
        cloneArmed={cloneArmed}
        cloneSourceBlockId={cloneSourceBlockId}
        onCloneArm={onCloneArm}
        onCloneCancel={onCloneCancel}
        onClonePaste={onClonePaste}
        isLoggedIn={!!currentUserId || isAycl}
        supabase={supabase}
        planTopic={plan.root_topic}
        workspaceId={workspaceId}
        onRefresh={onRefresh}
        onNodesUpdate={onNodesUpdate}
        ayclToken={ayclToken}
        expandedNodeId={expandedBlockId}
        onExpandedNodeIdChange={onExpandedNodeIdChange}
        onMapSelectionChange={onMapSelectionChange}
        mapSelection={mapSelection}
        selectiveExplanationActive={selectiveExplanationActive}
        selectiveExplanationPolygon={selectiveExplanationPolygon}
        onSelectiveExplanationComplete={onSelectiveExplanationComplete}
        injectMapNote={injectMapNote}
        unusableCells={unusableCells}
        onMapGround={onMapGround}
        workspaceNotes={workspaceNotes}
        previewEmptyCells={previewEmptyCells}
        generatorTargetPreviewCells={generatorTargetPreviewCells}
        generatorPickActive={generatorPickActive}
        onGeneratorEmptyToggle={onGeneratorEmptyToggle}
        dynamicPickActive={dynamicPickActive}
        onDynamicBlockToggle={onDynamicBlockToggle}
        dynamicUnlockPreviewIds={dynamicUnlockPreviewIds}
        dynamicContentGeneratedIds={dynamicContentGeneratedIds}
        expandJobs={expandJobs}
        clusterMapJob={clusterMapJob}
        onAbortExpandJob={onAbortExpandJob}
        mapExploreOpen={mapExploreOpen}
        onMapExploreToggle={onMapExploreToggle}
        onMapToggle={onMapToggle}
        mapToggleIds={visibleWorkspaceMapToggleIds({
          allowCreator: ayclCapabilities
            ? ayclCapabilities.allowCreatorModeToggle
            : true,
          allowExplore: ayclCapabilities ? ayclCapabilities.allowExplore : true,
        })}
        interactionMode={interactionMode}
        onInteractionModeChange={
          isAycl &&
          ayclCapabilities &&
          !ayclCapabilities.allowCreatorModeToggle
            ? undefined
            : selectInteractionMode
        }
      />
    </aside>
  );
}
