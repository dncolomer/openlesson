"use client";

import { useMemo, useState } from "react";
import {
  WorkspaceAddBlockPane,
  type WorkspaceAddBlockSubmitOpts,
} from "@/components/WorkspaceAddBlockPane";
import { WorkspaceHeliosChat } from "@/components/WorkspaceHeliosChat";
import { WorkspaceBlockDangerDrawer } from "@/components/WorkspaceBlockDangerPanel";
import { WorkspaceBlockDetailPane } from "@/components/WorkspaceBlockDetailPane";
import { WorkspaceBlockLocalContextPanel } from "@/components/WorkspaceBlockLocalContextPanel";
import { WorkspaceCombineBlocksPane } from "@/components/WorkspaceCombineBlocksPane";
import { WorkspaceGenerateShapePane } from "@/components/WorkspaceGenerateShapePane";
import { WorkspaceLearnerBlockPane } from "@/components/WorkspaceLearnerBlockPane";
import { WorkspaceMapAuthoringPane } from "@/components/WorkspaceMapAuthoringPane";
import type {
  Block,
  HeliosMapOverlay,
  MobileColumn,
  Workspace,
} from "@/components/workspace-view/types";
import type { ProductLaunchOptions } from "@/components/BlockDetailCard";
import type { BlockCreatorEffects, GeneratorTargetCell } from "@/lib/block-creator-effects";
import { parseBlockCreatorEffects } from "@/lib/block-creator-effects";
import type { BlockPracticeOptions } from "@/lib/block-practice-options";
import type { ExpandSourceIdentity } from "@/lib/expand-block-from-source";
import type { UnusableCell } from "@/lib/map-ground-rules";
import type { ProductLaunchTarget } from "@/lib/product-intent";
import type { BlockLocalContextInput, WorkspaceFileContextItem } from "@/lib/prompt-workspace-context";
import type { WorkspaceExpandBlockSubmitOpts } from "@/components/WorkspaceExpandBlockPane";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import type { WorkspaceMapSelection } from "@/lib/workspace-map-selection";
import type { WorkspaceMapTypesState } from "@/lib/workspace-map-types";
import { WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS } from "@/lib/workspace-right-pane";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE,
  normalizeWorkspaceHeliosColumnMode,
  resolveWorkspaceHeliosColumnSurface,
  type WorkspaceHeliosColumnMode,
} from "@/lib/workspace-helios-mode";
import {
  heliosMapSnapshotFromBlocks,
  heliosMapSnapshotToAuthoringNodes,
  type HeliosMapToolHost,
} from "@/lib/workspace-helios-tools";

export function WorkspaceRightDrawers({
  mobileColumn,
  workspaceImage,
  idleExplore = false,
  rightPane,
  isOwner,
  showCreatorDrawers,
  showLearnerDrawer,
  requestedDrawerId,
  requestedDrawerNonce,
  isLearnerMode,
  learnerNotes,
  workspaceId,
  ayclToken,
  locale,
  nodes,
  mapSelection,
  workspaceMapTypes,
  unusableCells,
  selectiveExplanationPolygon,
  selectiveExplanationActive,
  onSearchSelectBlocks,
  onSuggestSelectEmptyCells,
  onStartSelectiveDraw,
  onClearSelectiveOverlay,
  onCreateNoteFromSummary,
  detailBlock,
  detailIndex,
  currentUserId,
  locked,
  onBlocksUpdated,
  onDynamicGenerated,
  onSavePlanningPrompt,
  onLaunchIntent,
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
  cloneArmed = false,
  onCloneArm,
  onCloneCancel,
  onClonePaste,
  onExpandBlock,
  onGenerateMap,
  onGenerateMapPreviewChange,
  onSetUnusableCells,
  onPreviewUnusableCells,
  onApplyHeliosOverlay,
  mapOverlay,
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
  /** Explore search / suggest / overview on the idle pane. */
  idleExplore?: boolean;
  rightPane: string;
  isOwner: boolean;
  showCreatorDrawers: boolean;
  showLearnerDrawer: boolean;
  requestedDrawerId?: string | null;
  requestedDrawerNonce?: number | null;
  isLearnerMode: boolean;
  learnerNotes: boolean;
  workspaceId: string;
  ayclToken?: string;
  locale: string;
  nodes: Block[];
  mapSelection?: WorkspaceMapSelection | null;
  workspaceMapTypes?: WorkspaceMapTypesState | null;
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
  cloneArmed?: boolean;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel?: () => void;
  onClonePaste?: (
    sourceBlockId: string,
    target: { row: number; col: number },
  ) => Promise<void>;
  onExpandBlock?: (
    source: ExpandSourceIdentity,
    opts: WorkspaceExpandBlockSubmitOpts,
  ) => Promise<void>;
  onGenerateMap?: (input: {
    anchorRow: number;
    anchorCol: number;
    modifier: string;
    mapTypeId: string;
  }) => Promise<void>;
  onGenerateMapPreviewChange?: (cells: Array<{ row: number; col: number }> | null) => void;
  onSetUnusableCells?: (cells: Array<{ row: number; col: number }>) => Promise<void>;
  onPreviewUnusableCells?: (cells: Array<{ row: number; col: number }>) => void;
  onApplyHeliosOverlay?: (overlay: HeliosMapOverlay) => void;
  mapOverlay?: HeliosMapOverlay | null;
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
  const [heliosColumnMode, setHeliosColumnMode] =
    useState<WorkspaceHeliosColumnMode>(DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE);
  const heliosSurface = resolveWorkspaceHeliosColumnSurface({
    authoring: showCreatorDrawers,
    mode: heliosColumnMode,
  });
  const heliosSnapshot = useMemo(
    () =>
      heliosMapSnapshotFromBlocks({
        blocks: nodes.map((n) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          position_x: n.position_x ?? 0,
          position_y: n.position_y ?? 0,
          span_w: n.span_w,
          span_h: n.span_h,
          shape_cells: n.shape_cells,
          next_block_ids: n.next_block_ids,
          lock_until_block_ids: n.lock_until_block_ids,
          creator_effects: n.creator_effects,
          planning_prompt: n.planning_prompt,
        })),
        unusableCells,
        notes: mapOverlay?.notes,
        annotationLayers: mapOverlay?.annotationLayers,
      }),
    [mapOverlay, nodes, unusableCells],
  );
  const heliosHost = useMemo<HeliosMapToolHost>(
    () => ({
      applySnapshot: (snap) => {
        onBlocksUpdated(heliosMapSnapshotToAuthoringNodes(snap, nodes));
        onPreviewUnusableCells?.(snap.unusableCells);
        onApplyHeliosOverlay?.({
          notes: snap.notes || [],
          annotationLayers: snap.annotationLayers || [],
        });
      },
      addBlock: async ({ prompt, cell }) => {
        await onSubmitAddBlock(prompt, cell);
      },
      generateShape: async ({ prompt, cells }) => {
        await onSubmitGenerateShape({ prompt, cells });
      },
      splitBlock: onSplitBlock
        ? async ({ blockId, prompt }) => {
            await onSplitBlock({ blockId, prompt });
          }
        : undefined,
      cloneBlock: onClonePaste
        ? async ({ blockId, cell }) => {
            await onClonePaste(blockId, cell);
          }
        : undefined,
      editBlock: async ({ blockId, title, description }) => {
        await onUpdateBlock({ blockId, title, description });
      },
      expandBlock: onExpandBlock
        ? async ({ blockId, prompt, range, density, frozenSlots }) => {
            const source = nodes.find((n) => n.id === blockId);
            if (!source) return;
            await onExpandBlock(
              {
                id: source.id,
                title: source.title,
                description: source.description,
                planning_prompt: source.planning_prompt,
              },
              {
                frozenSlots,
                range,
                density,
                userGuidance: prompt,
              },
            );
          }
        : undefined,
      combineBlocks: onCombine,
      generateBridge: onGenerateBridge,
      clusterBlocks: onClusterBlocks,
      applyDag: onApplyDag,
      setUnusableCells: onSetUnusableCells,
      saveCreatorEffects: onSaveCreatorEffects,
      deleteBlock: onDeleteBlock,
    }),
    [
      nodes,
      onApplyDag,
      onBlocksUpdated,
      onPreviewUnusableCells,
      onApplyHeliosOverlay,
      onClonePaste,
      onClusterBlocks,
      onCombine,
      onDeleteBlock,
      onExpandBlock,
      onGenerateBridge,
      onSaveCreatorEffects,
      onSetUnusableCells,
      onSplitBlock,
      onSubmitAddBlock,
      onSubmitGenerateShape,
      onUpdateBlock,
    ],
  );
  return (
    <section className={`${mobileColumn === "workspace" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0 bg-[#080808] md:flex ${WORKSPACE_MAP_DESKTOP_RIGHT_WIDTH_CLASS} md:flex-none`}>
      {workspaceImage && (
        <img
          src={workspaceImage}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 saturate-75"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/70" />

      <main
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto p-0"
        data-workspace-right-column
        data-workspace-right-pane={rightPane}
        data-helios-map-mode={heliosSurface.mode}
      >
        {heliosSurface.showModeToggle ? (
          <div
            className="flex shrink-0 border-b border-white/10"
            data-workspace-helios-mode-toggle=""
          >
            <button
              type="button"
              className={`flex-1 px-2 py-2 text-[10px] uppercase tracking-[0.16em] ${
                heliosSurface.mode === "helios"
                  ? "bg-white/10 text-neutral-100"
                  : "text-neutral-500"
              }`}
              aria-pressed={heliosSurface.mode === "helios"}
              data-helios-map-mode-option="helios"
              onClick={() =>
                setHeliosColumnMode(normalizeWorkspaceHeliosColumnMode("helios"))
              }
            >
              Helios
            </button>
            <button
              type="button"
              className={`flex-1 px-2 py-2 text-[10px] uppercase tracking-[0.16em] ${
                heliosSurface.mode === "manual"
                  ? "bg-white/10 text-neutral-100"
                  : "text-neutral-500"
              }`}
              aria-pressed={heliosSurface.mode === "manual"}
              data-helios-map-mode-option="manual"
              onClick={() =>
                setHeliosColumnMode(normalizeWorkspaceHeliosColumnMode("manual"))
              }
            >
              Manual Mode
            </button>
          </div>
        ) : null}
        {heliosSurface.showHeliosChat ? (
          <WorkspaceHeliosChat
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            locale={locale}
            snapshot={heliosSnapshot}
            host={heliosHost}
            mapSelection={mapSelection}
            workspaceFileItems={workspaceFileItems}
            workspaceMapTypes={workspaceMapTypes}
          />
        ) : heliosSurface.showManualDrawers &&
          showCreatorDrawers &&
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
        ) : heliosSurface.showManualDrawers &&
          showCreatorDrawers &&
          rightPane === "add_block" &&
          addTargetCell ? (
          <WorkspaceAddBlockPane
            key={`add-${addTargetCell.row}-${addTargetCell.col}`}
            cell={addTargetCell}
            nodes={nodes}
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            busy={false}
            workspaceNotes={notesContent || plan.notes}
            unusableCells={unusableCells}
            onSubmit={onSubmitAddBlock}
            onCancel={onCancelEmptyCreate}
            onExpandPreviewChange={onExpandPreviewChange}
            onGenerateMap={onGenerateMap}
            onGenerateMapPreviewChange={onGenerateMapPreviewChange}
            onSetUnusableCells={onSetUnusableCells}
            labels={{
              addTitle: t("sessionList.gridAddTitle"),
              addPlaceholder: t("sessionList.gridAddPlaceholder"),
              addSubmit: t("sessionList.gridAddSubmit"),
              addCancel: t("sessionList.gridAddCancel"),
            }}
          />
        ) : heliosSurface.showManualDrawers &&
          showCreatorDrawers &&
          rightPane === "generate_shape" &&
          generateShapeCells ? (
          <WorkspaceGenerateShapePane
            ayclToken={ayclToken}
            key={`shape-${generateShapeCells.map((c) => `${c.row}:${c.col}`).join(",")}`}
            cells={generateShapeCells}
            workspaceId={workspaceId}
            busy={isAddingBlock}
            workspaceNotes={notesContent || plan.notes}
            onSubmit={onSubmitGenerateShape}
            onCancel={onCancelEmptyCreate}
            unusableCells={unusableCells}
            onSetUnusableCells={onSetUnusableCells}
            labels={{
              generateShape: t("sessionList.gridGenerateShape"),
              addPlaceholder: t("sessionList.gridAddPlaceholder"),
              addSubmit: t("sessionList.gridAddSubmit"),
              addCancel: t("sessionList.gridAddCancel"),
            }}
          />
        ) : heliosSurface.showManualDrawers &&
          rightPane === "block_detail" &&
          detailBlock &&
          detailIndex >= 0 &&
          (showCreatorDrawers || showLearnerDrawer) ? (
          <div
            className="flex h-full min-h-0 flex-col overflow-y-auto"
            data-workspace-block-drawers=""
          >
            {showCreatorDrawers ? (
              <div className="min-h-0 shrink-0">
                <WorkspaceBlockDetailPane
                  key={detailBlock.id}
                  blockId={detailBlock.id}
                  blockTitle={detailBlock.title}
                  blockDescription={detailBlock.description}
                  planningPrompt={detailBlock.planning_prompt}
                  localContext={detailBlock.local_context}
                  blockStatus={detailBlock.status}
                  isStart={detailBlock.is_start}
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
                  onSaveCreatorEffects={onSaveCreatorEffects}
                  onSplitBlock={onSplitBlock}
                  cloneArmed={cloneArmed}
                  onCloneArm={onCloneArm}
                  onCloneCancel={onCloneCancel}
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
              </div>
            ) : null}
            {showLearnerDrawer ? (
              <div className="min-h-0 shrink-0">
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
                />
              </div>
            ) : null}
            {showCreatorDrawers && isOwner ? (
              <div
                className="mt-auto min-h-0 shrink-0"
                data-workspace-block-danger-host
              >
                <WorkspaceBlockDangerDrawer
                  blockId={detailBlock.id}
                  title={detailBlock.title}
                  canEdit={isOwner}
                  busy={isAddingBlock}
                  onDelete={onDeleteBlock}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <WorkspaceMapAuthoringPane
            canEdit={isOwner && showCreatorDrawers}
            learnerNotes={learnerNotes}
            ayclToken={ayclToken}
            locale={locale}
            blocks={nodes}
            unusableCells={unusableCells}
            workspaceId={workspaceId}
            exploreOpen={idleExplore}
            selectivePolygon={idleExplore ? selectiveExplanationPolygon : null}
            selectiveDrawing={idleExplore ? selectiveExplanationActive : false}
            onSearchSelectBlocks={idleExplore ? onSearchSelectBlocks : undefined}
            onSuggestSelectEmptyCells={
              idleExplore ? onSuggestSelectEmptyCells : undefined
            }
            onStartSelectiveDraw={idleExplore ? onStartSelectiveDraw : undefined}
            onClearSelectiveOverlay={
              idleExplore ? onClearSelectiveOverlay : undefined
            }
            onCreateNoteFromSummary={
              idleExplore ? onCreateNoteFromSummary : undefined
            }
          />
        )}
      </main>
    </section>
  );
}
