"use client";

import { useMemo, type ReactNode } from "react";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
  resolveDetailDrawerDefaultOpenId,
} from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceBlockEditPanel } from "@/components/WorkspaceBlockEditPanel";
import { WorkspaceBlockSimulationPanel } from "@/components/WorkspaceBlockSimulationPanel";
import { WorkspaceSplitBlockPane } from "@/components/WorkspaceSplitBlockPane";
import {
  WorkspaceExpandBlockPane,
  type WorkspaceExpandBlockSubmitOpts,
} from "@/components/WorkspaceExpandBlockPane";
import {
  WorkspaceBlockDynamicEffectPanel,
  WorkspaceBlockGeneratorEffectPanel,
  type WorkspaceBlockEffectsSaveInput,
} from "@/components/WorkspaceBlockEffectsPanels";
import { BlockGoalsPanel } from "@/components/BlockGoalsPanel";
import {
  blockOffersSplitDrawer,
  type SplitCandidateBlock,
} from "@/lib/workspace-right-pane";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";
import type { ExpandSourceIdentity } from "@/lib/expand-block-from-source";
import type { SkillGridNode } from "@/lib/block-skill-grid";
import type { PlacedBlockRef } from "@/lib/skill-grid-ops";
import type { BlockPracticeOptions } from "@/lib/block-practice-options";
import type { BlockCreatorEffects } from "@/lib/block-creator-effects";

/**
 * Block-detail right column (creator mode): peer top-level drawers —
 * Simulation, Split (multi-cell), Expand, Edit, Goals (post-creation),
 * Dynamic / Generator effects, Local context.
 * Title/description live in Edit (not a separate Details/Sessions drawer).
 * Clone is a left map-strip tool (not a drawer).
 * Accordion: opening any drawer collapses the others.
 * No X close on drawers; dismiss via map selection clear.
 */
export function WorkspaceBlockDetailPane({
  localContextPanel,
  blockId,
  blockTitle,
  blockDescription,
  planningPrompt,
  localContext,
  blockStatus,
  isStart,
  practiceOptions = null,
  creatorEffects = null,
  lockUntilTitles,
  spanW,
  spanH,
  shapeCells,
  positionX = null,
  positionY = null,
  workspaceId,
  ayclToken,
  locale = "en",
  canEdit = false,
  editBusy = false,
  onUpdateBlock,
  onDeleteBlock,
  onSaveCreatorEffects,
  onSplitBlock,
  expandNodes,
  unusableCells = null,
  onExpandBlock,
  onExpandPreviewChange,
  onGeneratorTargetPreviewChange,
  onGeneratorPickModeChange,
  onRegisterGeneratorEmptyToggle,
  onDynamicUnlockPreviewChange,
  onDynamicPickModeChange,
  onRegisterDynamicBlockToggle,
  workspaceGoal,
  workspaceTitle,
  rootTopic,
  workspaceNotes,
}: {
  localContextPanel: ReactNode;
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  planningPrompt?: string | null;
  localContext?: BlockLocalContextInput | null;
  blockStatus?: string | null;
  isStart?: boolean | null;
  practiceOptions?: BlockPracticeOptions | null;
  /** Combinable Dynamic / Generator effects. */
  creatorEffects?: BlockCreatorEffects | null;
  lockUntilTitles?: string[];
  spanW?: number | null;
  spanH?: number | null;
  shapeCells?: SplitCandidateBlock["shape_cells"];
  /** Map anchor for Expand block center (col / row). */
  positionX?: number | null;
  positionY?: number | null;
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  /** Workspace identity for Simulation probe grounding (live Explore/Drill parity). */
  workspaceGoal?: string | null;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceNotes?: string | null;
  canEdit?: boolean;
  editBusy?: boolean;
  onUpdateBlock?: (input: {
    blockId: string;
    title: string;
    description: string;
    isStart: boolean;
    practiceOptions: BlockPracticeOptions;
  }) => Promise<void> | void;
  onDeleteBlock?: (blockId: string) => Promise<void> | void;
  onSaveCreatorEffects?: (
    input: WorkspaceBlockEffectsSaveInput,
  ) => Promise<void> | void;
  onSplitBlock?: (input: {
    blockId: string;
    prompt?: string;
  }) => Promise<void> | void;
  /** Map nodes for Expand block range/density occupancy. */
  expandNodes?: SkillGridNode[];
  unusableCells?: Array<{ row: number; col: number }> | null;
  onExpandBlock?: (
    source: ExpandSourceIdentity,
    opts: WorkspaceExpandBlockSubmitOpts,
  ) => Promise<void> | void;
  onExpandPreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
  /** Creator generator drawer → map spark preview of empty target cells. */
  onGeneratorTargetPreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
  /** Generator map pick mode (empty-cell click toggles targets). */
  onGeneratorPickModeChange?: (active: boolean) => void;
  onRegisterGeneratorEmptyToggle?: (
    toggle: ((cell: { row: number; col: number }) => void) | null,
  ) => void;
  /** Dynamic unlock-after map pick (filled blocks). */
  onDynamicUnlockPreviewChange?: (blockIds: string[] | null) => void;
  onDynamicPickModeChange?: (active: boolean) => void;
  onRegisterDynamicBlockToggle?: (
    toggle: ((blockId: string) => void) | null,
  ) => void;
  /** @deprecated Selection-driven dismiss; no drawer X. */
  onClose?: () => void;
}) {
  const localNorm = normalizeBlockLocalContext(localContext);
  const hasLocalMaterials = localNorm.hasLocalMaterials;
  const splitCandidate: SplitCandidateBlock & {
    id: string;
    title?: string | null;
    description?: string | null;
  } = {
    id: blockId,
    title: blockTitle,
    description: blockDescription,
    span_w: spanW,
    span_h: spanH,
    shape_cells: shapeCells ?? null,
  };
  const showSplitDrawer =
    canEdit && Boolean(onSplitBlock) && blockOffersSplitDrawer(splitCandidate);
  const showExpandDrawer =
    canEdit && Boolean(onExpandBlock) && Array.isArray(expandNodes);

  // Memoize so Expand pane does not see a new object every parent render
  // (that retriggers selection + map preview setState loops).
  const expandPlaced: PlacedBlockRef = useMemo(
    () => ({
      id: blockId,
      position_x:
        typeof positionX === "number" && Number.isFinite(positionX)
          ? Math.trunc(positionX)
          : 0,
      position_y:
        typeof positionY === "number" && Number.isFinite(positionY)
          ? Math.trunc(positionY)
          : 0,
      span_w: spanW ?? 1,
      span_h: spanH ?? 1,
      shape_cells: (shapeCells as PlacedBlockRef["shape_cells"]) ?? null,
    }),
    [blockId, positionX, positionY, shapeCells, spanH, spanW],
  );

  const defaultOpenId = resolveDetailDrawerDefaultOpenId({
    hasLocalMaterials,
    showSplit: showSplitDrawer,
    canEdit,
  });

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId={defaultOpenId}
      data-workspace-right-pane="block-detail"
      data-workspace-block-detail-pane
      data-block-detail-drawers
      data-block-detail-mini-tabs
      data-block-has-local-context={hasLocalMaterials ? "true" : "false"}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="simulation"
        title="Block Simulation"
        defaultExpanded={false}
        bodyClassName="space-y-3"
      >
        <div data-block-detail-tab-content="simulation">
          <WorkspaceBlockSimulationPanel
            workspaceId={workspaceId}
            blockId={blockId}
            blockTitle={blockTitle}
            blockDescription={blockDescription}
            planningPrompt={planningPrompt}
            localContext={localContext}
            blockStatus={blockStatus}
            isStart={isStart}
            lockUntilTitles={lockUntilTitles}
            canEdit={canEdit}
            ayclToken={ayclToken}
            locale={locale}
            workspaceGoal={workspaceGoal}
            workspaceTitle={workspaceTitle}
            rootTopic={rootTopic}
            workspaceNotes={workspaceNotes}
          />
        </div>
      </WorkspaceRightPaneDrawer>

      {showSplitDrawer ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="split"
          title="Split"
          defaultExpanded={false}
          bodyClassName="space-y-3"
        >
          <div data-block-detail-tab-content="split">
            <WorkspaceSplitBlockPane
              block={splitCandidate}
              busy={editBusy}
              onSplit={onSplitBlock!}
            />
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}

      {showExpandDrawer ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="expand_block"
          title="Expand block"
          defaultExpanded={false}
          bodyClassName="space-y-3"
        >
          <div
            data-block-detail-tab-content="expand_block"
            data-expand-block-drawer
          >
            <WorkspaceExpandBlockPane
              sourceBlock={expandPlaced}
              sourceIdentity={{
                id: blockId,
                title: blockTitle,
                description: blockDescription,
                planning_prompt: planningPrompt,
              }}
              nodes={expandNodes!}
              unusableCells={unusableCells}
              busy={editBusy}
              workspaceId={workspaceId}
              locale={locale}
              ayclToken={ayclToken}
              onSubmit={onExpandBlock!}
              onExpandPreviewChange={onExpandPreviewChange}
            />
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}

      {canEdit ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="edit"
          title="Edit"
          defaultExpanded={false}
          bodyClassName="space-y-2"
        >
          <div data-block-detail-tab-content="edit">
            <WorkspaceBlockEditPanel
              blockId={blockId}
              title={blockTitle}
              description={blockDescription}
              isStart={isStart}
              practiceOptions={practiceOptions}
              canEdit={canEdit}
              busy={editBusy}
              onUpdate={onUpdateBlock}
              onDelete={onDeleteBlock}
            />
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}

      {/* Goals drawer only for existing (persisted) blocks — not add-block/create flow. */}
      {blockId && workspaceId ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="goals"
          title="Goals"
          defaultExpanded={false}
          bodyClassName="space-y-2"
          surfaceDataAttr="data-block-goals-drawer"
        >
          <div data-block-detail-tab-content="goals" data-block-goals-drawer>
            <BlockGoalsPanel
              workspaceId={workspaceId}
              blockId={blockId}
              canEdit={canEdit}
              ayclToken={ayclToken}
            />
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}

      {/* Combinable creator effects — not separate block types. */}
      {canEdit || creatorEffects ? (
        <>
          <WorkspaceRightPaneDrawer
            variant="section"
            drawerId="effect_dynamic"
            title="Dynamic"
            defaultExpanded={false}
            bodyClassName="space-y-3"
            surfaceDataAttr="data-block-effect-drawer-dynamic"
          >
            <WorkspaceBlockDynamicEffectPanel
              blockId={blockId}
              effects={creatorEffects}
              nodes={expandNodes || []}
              canEdit={canEdit && Boolean(onSaveCreatorEffects)}
              busy={editBusy}
              onSave={onSaveCreatorEffects}
              onUnlockPreviewChange={onDynamicUnlockPreviewChange}
              onPickModeChange={onDynamicPickModeChange}
              onRegisterBlockToggle={onRegisterDynamicBlockToggle}
            />
          </WorkspaceRightPaneDrawer>

          <WorkspaceRightPaneDrawer
            variant="section"
            drawerId="effect_generator"
            title="Generator"
            defaultExpanded={false}
            bodyClassName="space-y-3"
            surfaceDataAttr="data-block-effect-drawer-generator"
          >
            <WorkspaceBlockGeneratorEffectPanel
              blockId={blockId}
              effects={creatorEffects}
              nodes={expandNodes || []}
              canEdit={canEdit && Boolean(onSaveCreatorEffects)}
              busy={editBusy}
              onSave={onSaveCreatorEffects}
              onTargetPreviewChange={onGeneratorTargetPreviewChange}
              onPickModeChange={onGeneratorPickModeChange}
              onRegisterEmptyToggle={onRegisterGeneratorEmptyToggle}
            />
          </WorkspaceRightPaneDrawer>
        </>
      ) : null}

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="local"
        title="Local context"
        // Prefer local when materials exist *and* it is the only default — still
        // collapses when another drawer is opened (accordion).
        defaultExpanded={hasLocalMaterials}
        bodyClassName="space-y-2"
      >
        <div data-block-detail-tab-content="local">{localContextPanel}</div>
      </WorkspaceRightPaneDrawer>
    </WorkspaceRightPaneDrawerGroup>
  );
}
