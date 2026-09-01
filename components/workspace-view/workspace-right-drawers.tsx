"use client";

import {
  WorkspaceAddBlockPane,
  type WorkspaceAddBlockSubmitOpts,
} from "@/components/WorkspaceAddBlockPane";
import { WorkspaceBlockDetailPane } from "@/components/WorkspaceBlockDetailPane";
import { WorkspaceBlockLocalContextPanel } from "@/components/WorkspaceBlockLocalContextPanel";
import { WorkspaceCombineBlocksPane } from "@/components/WorkspaceCombineBlocksPane";
import { WorkspaceGenerateShapePane } from "@/components/WorkspaceGenerateShapePane";
import { WorkspaceLearnerBlockPane } from "@/components/WorkspaceLearnerBlockPane";
import { WorkspaceMapAuthoringPane } from "@/components/WorkspaceMapAuthoringPane";
import type { Block, MobileColumn, Workspace } from "@/components/workspace-view/types";
import type { ProductLaunchOptions } from "@/components/BlockDetailCard";
import type { BlockCreatorEffects, GeneratorTargetCell } from "@/lib/block-creator-effects";
import { parseBlockCreatorEffects } from "@/lib/block-creator-effects";
import {
  parseWorkspacePracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";
import type { ExpandSourceIdentity } from "@/lib/expand-block-from-source";
import type { UnusableCell } from "@/lib/map-ground-rules";
import type { ProductLaunchTarget } from "@/lib/product-intent";
import type { BlockLocalContextInput, WorkspaceFileContextItem } from "@/lib/prompt-workspace-context";
import type { WorkspaceExpandBlockSubmitOpts } from "@/components/WorkspaceExpandBlockPane";
import type { WorkspaceInteractionMode } from "@/lib/workspace-mode";
import type { LearnerDoneProgressPhase, LearnerPowSummary } from "@/lib/workspace-learner-done";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import { WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS } from "@/lib/workspace-right-pane";
import { useI18n } from "@/lib/i18n";

export function WorkspaceRightDrawers({
  mobileColumn,
  workspaceImage,
  showMapExplore,
  rightPane,
  isOwner,
  showCreatorDrawers,
  showLearnerDrawer,
  requestedDrawerId,
  requestedDrawerNonce,
  isLearnerMode,
  interactionMode,
  workspaceId,
  ayclToken,
  locale,
  nodes,
  unusableCells,
  selectiveExplanationPolygon,
  selectiveExplanationActive,
  onSearchSelectBlocks,
  onSuggestSelectEmptyCells,
  onStartSelectiveDraw,
  onClearSelectiveOverlay,
  onCreateNoteFromSummary,
  exploreTargetCell,
  detailBlock,
  detailIndex,
  currentUserId,
  locked,
  onBlocksUpdated,
  onDynamicGenerated,
  onSavePlanningPrompt,
  onLaunchIntent,
  onFetchPowSummary,
  onMarkDone,
  combineBlockIds,
  isAddingBlock,
  onCombine,
  onGenerateBridge,
  onApplyDag,
  onClusterBlocks,
  onClusterProgress,
  onDeleteBlocks,
  onBridgePreviewChange,
  onCancelCombine,
  detailLockTitles,
  plan,
  notesContent,
  onUpdateBlock,
  onDeleteBlock,
  onSaveCreatorEffects,
  onSplitBlock,
  onExpandBlock,
  onExpandPreviewChange,
  onGeneratorTargetPreviewChange,
  onGeneratorPickModeChange,
  onRegisterGeneratorEmptyToggle,
  onDynamicUnlockPreviewChange,
  onDynamicPickModeChange,
  onRegisterDynamicBlockToggle,
  workspaceFileItems,
  onSaveLocalContext,
  mapGroundBusy,
  addTargetCell,
  onSubmitAddBlock,
  onCancelEmptyCreate,
  generateShapeCells,
  onSubmitGenerateShape,
}: {
  mobileColumn: MobileColumn;
  workspaceImage: string;
  showMapExplore: boolean;
  rightPane: string;
  isOwner: boolean;
  showCreatorDrawers: boolean;
  showLearnerDrawer: boolean;
  requestedDrawerId?: string | null;
  requestedDrawerNonce?: number | null;
  isLearnerMode: boolean;
  interactionMode: WorkspaceInteractionMode;
  workspaceId: string;
  ayclToken?: string;
  locale: string;
  nodes: Block[];
  unusableCells: UnusableCell[];
  selectiveExplanationPolygon: Array<{ x: number; y: number }> | null;
  selectiveExplanationActive: boolean;
  onSearchSelectBlocks: (blockIds: string[]) => void;
  onSuggestSelectEmptyCells: (cells: Array<{ row: number; col: number }>) => void;
  onStartSelectiveDraw: () => void;
  onClearSelectiveOverlay: () => void;
  onCreateNoteFromSummary: (input: {
    body: string;
    x: number;
    y: number;
    source: "creator" | "learner";
  }) => void;
  exploreTargetCell?: { row: number; col: number } | null;
  detailBlock: Block | null;
  detailIndex: number;
  currentUserId: string | null;
  locked: boolean;
  onBlocksUpdated: (raw: unknown[]) => void;
  onDynamicGenerated: (blockId: string) => void;
  onSavePlanningPrompt: (prompt: string) => Promise<void>;
  onLaunchIntent?: (
    target: ProductLaunchTarget,
    options?: ProductLaunchOptions,
  ) => Promise<void>;
  onFetchPowSummary: (blockId: string) => Promise<LearnerPowSummary>;
  onMarkDone: (input: {
    blockId: string;
    status: string;
    onPhase?: (phase: LearnerDoneProgressPhase) => void;
  }) => Promise<{
    unlockedIds?: string[];
    generatedCells?: number;
    dynamicGenerated?: number;
  } | void>;
  combineBlockIds: string[];
  isAddingBlock: boolean;
  onCombine: (input: { blockIds: string[]; prompt?: string }) => Promise<void>;
  onGenerateBridge: (input: {
    blockIds: string[];
    density: number;
    width?: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void>;
  onApplyDag: (input: {
    blockIds: string[];
    dagDraft: {
      blockIds: string[];
      edges: Array<{ from: string; to: string; kind: "next" | "lock" }>;
    };
    dagId?: string;
  }) => Promise<void>;
  onClusterBlocks: (input: {
    blockIds: string[];
    placements: Array<{ id: string; position_x: number; position_y: number }>;
    clusterCount: number;
    separation?: number;
    prompt?: string;
  }) => Promise<void>;
  onClusterProgress: (
    job: { active: boolean; progress: number; label: string } | null,
  ) => void;
  onDeleteBlocks: (input: { blockIds: string[] }) => Promise<void>;
  onBridgePreviewChange: (cells: Array<{ row: number; col: number }> | null) => void;
  onCancelCombine: () => void;
  detailLockTitles: string[];
  plan: Workspace;
  notesContent: string;
  onUpdateBlock: (input: {
    blockId: string;
    title: string;
    description: string;
    isStart?: boolean;
    practiceOptions?: BlockPracticeOptions;
  }) => Promise<void>;
  onDeleteBlock: (blockId: string) => Promise<void>;
  onSaveCreatorEffects?: (input: {
    blockId: string;
    effects: BlockCreatorEffects;
  }) => Promise<void>;
  onSplitBlock?: (input: { blockId: string; prompt?: string }) => Promise<void>;
  onExpandBlock?: (
    source: ExpandSourceIdentity,
    opts: WorkspaceExpandBlockSubmitOpts,
  ) => Promise<void>;
  onExpandPreviewChange: (cells: Array<{ row: number; col: number }> | null) => void;
  onGeneratorTargetPreviewChange: (cells: GeneratorTargetCell[] | null) => void;
  onGeneratorPickModeChange: (active: boolean) => void;
  onRegisterGeneratorEmptyToggle: (
    fn: ((cell: { row: number; col: number }) => void) | null,
  ) => void;
  onDynamicUnlockPreviewChange: (ids: string[] | null) => void;
  onDynamicPickModeChange: (active: boolean) => void;
  onRegisterDynamicBlockToggle: (fn: ((blockId: string) => void) | null) => void;
  workspaceFileItems: WorkspaceFileContextItem[];
  onSaveLocalContext: (blockId: string, localContext: BlockLocalContextInput) => Promise<void>;
  mapGroundBusy: boolean;
  addTargetCell: WorkspaceAddTargetCell | null;
  onSubmitAddBlock: (
    prompt: string,
    position: WorkspaceAddTargetCell,
    opts?: WorkspaceAddBlockSubmitOpts,
  ) => Promise<void>;
  onCancelEmptyCreate: () => void;
  generateShapeCells: WorkspaceAddTargetCell[] | null;
  onSubmitGenerateShape: (payload: {
    prompt: string;
    cells: WorkspaceAddTargetCell[];
    contextSourceKeys?: string[];
    isStart?: boolean;
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <section className={`${mobileColumn === "workspace" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080808] md:flex ${WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS} md:flex-none`}>
      {workspaceImage && (
        <img
          src={workspaceImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35 saturate-75"
        />
      )}
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" />

      <main
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        data-workspace-right-column
        data-workspace-right-pane={
          showMapExplore ? "map_explore" : rightPane
        }
        data-map-explore-open={showMapExplore ? "true" : "false"}
      >
        {showMapExplore ? (
          <WorkspaceMapAuthoringPane
            canEdit={isOwner && showCreatorDrawers}
            interactionMode={interactionMode}
            ayclToken={ayclToken}
            locale={locale}
            blocks={nodes}
            unusableCells={unusableCells}
            workspaceId={workspaceId}
            exploreOpen
            selectivePolygon={selectiveExplanationPolygon}
            selectiveDrawing={selectiveExplanationActive}
            onSearchSelectBlocks={onSearchSelectBlocks}
            onSuggestSelectEmptyCells={onSuggestSelectEmptyCells}
            onStartSelectiveDraw={onStartSelectiveDraw}
            onClearSelectiveOverlay={onClearSelectiveOverlay}
            onCreateNoteFromSummary={onCreateNoteFromSummary}
            exploreTargetCell={exploreTargetCell}
          />
        ) : showLearnerDrawer &&
        detailBlock &&
        detailIndex >= 0 ? (
          <WorkspaceLearnerBlockPane
            key={`learner-${detailBlock.id}`}
            block={detailBlock}
            blocks={nodes}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            learnerUserKey={currentUserId || ayclToken || "local"}
            requestedDrawerId={requestedDrawerId}
            requestedDrawerNonce={requestedDrawerNonce}
            locked={locked}
            onBlocksUpdated={onBlocksUpdated}
            onDynamicGenerated={onDynamicGenerated}
            onSavePlanningPrompt={onSavePlanningPrompt}
            onLaunchIntent={onLaunchIntent}
            onFetchPowSummary={onFetchPowSummary}
            onMarkDone={onMarkDone}
          />
        ) : showCreatorDrawers &&
          rightPane === "combine_blocks" &&
          combineBlockIds.length >= 2 ? (
          <WorkspaceCombineBlocksPane
            key={`combine-${combineBlockIds.join(",")}`}
            blockIds={combineBlockIds}
            nodes={nodes}
            busy={isAddingBlock}
            unusableCells={unusableCells}
            workspaceId={workspaceId}
            ayclToken={ayclToken || undefined}
            onCombine={onCombine}
            onGenerateBridge={onGenerateBridge}
            onApplyDag={onApplyDag}
            onClusterBlocks={onClusterBlocks}
            onClusterProgress={onClusterProgress}
            onDeleteBlocks={onDeleteBlocks}
            onBridgePreviewChange={onBridgePreviewChange}
            onCancel={onCancelCombine}
            labels={{
              combine: t("sessionList.gridMerge") || "Combine into one block",
              cancel: t("sessionList.gridAddCancel") || "Cancel",
            }}
          />
        ) : showCreatorDrawers &&
          rightPane === "block_detail" &&
          detailBlock &&
          detailIndex >= 0 ? (
          <WorkspaceBlockDetailPane
            key={detailBlock.id}
            blockId={detailBlock.id}
            blockTitle={detailBlock.title}
            blockDescription={detailBlock.description}
            planningPrompt={detailBlock.planning_prompt}
            localContext={detailBlock.local_context}
            blockStatus={detailBlock.status}
            isStart={detailBlock.is_start}
            practiceOptions={parseWorkspacePracticeOptions(
              detailBlock.practice_options,
              { ayclClone: Boolean(ayclToken) },
            )}
            creatorEffects={parseBlockCreatorEffects(
              detailBlock.creator_effects,
              { selfBlockId: detailBlock.id },
            )}
            lockUntilTitles={detailLockTitles}
            spanW={detailBlock.span_w}
            spanH={detailBlock.span_h}
            shapeCells={detailBlock.shape_cells}
            positionX={detailBlock.position_x}
            positionY={detailBlock.position_y}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            canEdit={isOwner}
            editBusy={isAddingBlock}
            workspaceGoal={plan.workspace_goal}
            workspaceTitle={plan.title || plan.root_topic}
            rootTopic={plan.root_topic}
            workspaceNotes={notesContent || plan.notes}
            onUpdateBlock={onUpdateBlock}
            onDeleteBlock={onDeleteBlock}
            onSaveCreatorEffects={onSaveCreatorEffects}
            onSplitBlock={onSplitBlock}
            expandNodes={nodes}
            unusableCells={unusableCells}
            onExpandBlock={onExpandBlock}
            onExpandPreviewChange={onExpandPreviewChange}
            onGeneratorTargetPreviewChange={onGeneratorTargetPreviewChange}
            onGeneratorPickModeChange={onGeneratorPickModeChange}
            onRegisterGeneratorEmptyToggle={onRegisterGeneratorEmptyToggle}
            onDynamicUnlockPreviewChange={onDynamicUnlockPreviewChange}
            onDynamicPickModeChange={onDynamicPickModeChange}
            onRegisterDynamicBlockToggle={onRegisterDynamicBlockToggle}
            localContextPanel={
              <WorkspaceBlockLocalContextPanel
                key={detailBlock.id}
                canEdit={isOwner}
                blockId={detailBlock.id}
                blockTitle={detailBlock.title}
                blockDescription={detailBlock.description}
                blockStatus={detailBlock.status}
                lockUntilTitles={detailLockTitles}
                localContext={detailBlock.local_context}
                workspaceFiles={workspaceFileItems}
                onSaveLocalContext={onSaveLocalContext}
                busy={mapGroundBusy}
              />
            }
          />
        ) : showCreatorDrawers && rightPane === "add_block" && addTargetCell ? (
          <WorkspaceAddBlockPane
            key={`add-${addTargetCell.row}-${addTargetCell.col}`}
            cell={addTargetCell}
            nodes={nodes}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            busy={false}
            workspaceNotes={notesContent || plan.notes}
            unusableCells={unusableCells}
            onSubmit={onSubmitAddBlock}
            onCancel={onCancelEmptyCreate}
            onExpandPreviewChange={onExpandPreviewChange}
            labels={{
              addTitle: t("sessionList.gridAddTitle"),
              addPlaceholder: t("sessionList.gridAddPlaceholder"),
              addSubmit: t("sessionList.gridAddSubmit"),
              addCancel: t("sessionList.gridAddCancel"),
              suggestTopics: t("sessionList.gridSuggestTopics"),
              suggesting: t("sessionList.gridSuggesting"),
              suggestError: t("sessionList.gridSuggestError"),
            }}
          />
        ) : showCreatorDrawers &&
          rightPane === "generate_shape" &&
          generateShapeCells ? (
          <WorkspaceGenerateShapePane
            ayclToken={ayclToken}
            key={`shape-${generateShapeCells.map((c) => `${c.row}:${c.col}`).join(",")}`}
            cells={generateShapeCells}
            nodes={nodes}
            workspaceId={workspaceId}
            locale={locale}
            busy={isAddingBlock}
            workspaceNotes={notesContent || plan.notes}
            onSubmit={onSubmitGenerateShape}
            onCancel={onCancelEmptyCreate}
            labels={{
              generateShape: t("sessionList.gridGenerateShape"),
              addPlaceholder: t("sessionList.gridAddPlaceholder"),
              addSubmit: t("sessionList.gridAddSubmit"),
              addCancel: t("sessionList.gridAddCancel"),
              suggestTopics: t("sessionList.gridSuggestTopics"),
              suggesting: t("sessionList.gridSuggesting"),
              suggestError: t("sessionList.gridSuggestError"),
            }}
          />
        ) : (
          <WorkspaceMapAuthoringPane
            canEdit={isOwner && showCreatorDrawers}
            interactionMode={interactionMode}
            ayclToken={ayclToken}
            locale={locale}
            blocks={nodes}
            unusableCells={unusableCells}
            workspaceId={workspaceId}
            exploreOpen={false}
          />
        )}
      </main>
    </section>
  );
}
