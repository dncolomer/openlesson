"use client";

import { useMemo } from "react";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
  resolveDetailDrawerDefaultOpenId,
} from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceBlockEditPanel } from "@/components/WorkspaceBlockEditPanel";
import { WorkspaceBlockUnsysModelPanel } from "@/components/WorkspaceBlockUnsysModelPanel";
import {
  AUTHOR_UNSYS_MODEL_DRAWER_ID,
  AUTHOR_UNSYS_MODEL_DRAWER_TITLE,
  type AuthorUnsysModelSeed,
} from "@/lib/author-unsys-model";
import { WorkspaceSplitBlockPane } from "@/components/WorkspaceSplitBlockPane";
import { WorkspaceCloneBlockPane } from "@/components/WorkspaceCloneBlockPane";
import {
  WorkspaceExpandBlockPane,
  type WorkspaceExpandBlockSubmitOpts,
} from "@/components/WorkspaceExpandBlockPane";
import {
  WorkspaceBlockDynamicEffectPanel,
  WorkspaceBlockGeneratorEffectPanel,
  type WorkspaceBlockEffectsSaveInput,
} from "@/components/WorkspaceBlockEffectsPanels";
import {
  blockOffersSplitDrawer,
  type SplitCandidateBlock,
} from "@/lib/workspace-right-pane";
import type { ExpandSourceIdentity } from "@/lib/expand-block-from-source";
import type { SkillGridNode } from "@/lib/block-skill-grid";
import type { PlacedBlockRef } from "@/lib/skill-grid-ops";
import type { BlockCreatorEffects } from "@/lib/block-creator-effects";

/**
 * Block-detail right column (creator mode): peer top-level drawers —
 * Unsys model, Split (multi-cell), Expand, Edit,
 * Dynamic / Generator effects. The Goals drawer is unmounted.
 * Title/description live in Edit; delete lives in the Danger zone drawer
 * at the bottom of the authoring column.
 * Clone is a drawer on this stack (arm, then click an empty cell).
 * Accordion: opening any drawer collapses the others.
 * No X close on drawers; dismiss via map selection clear.
 */
export function WorkspaceBlockDetailPane({
  blockId,
  blockTitle,
  blockDescription,
  planningPrompt,
  isStart,
  creatorEffects = null,
  answersModelSeed = null,
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
  onSaveCreatorEffects,
  onSaveAnswersModelSeed,
  onOpenUnsysStudio,
  onSplitBlock,
  cloneArmed = false,
  onCloneArm,
  onCloneCancel,
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
}: {
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  planningPrompt?: string | null;
  isStart?: boolean | null;
  /** Combinable Dynamic / Generator effects. */
  creatorEffects?: BlockCreatorEffects | null;
  /** Saved unsys answers-model seed for this block. */
  answersModelSeed?: unknown;
  spanW?: number | null;
  spanH?: number | null;
  shapeCells?: SplitCandidateBlock["shape_cells"];
  /** Map anchor for Expand block center (col / row). */
  positionX?: number | null;
  positionY?: number | null;
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  canEdit?: boolean;
  editBusy?: boolean;
  onUpdateBlock?: (input: {
    blockId: string;
    title: string;
    description: string;
    isStart?: boolean;
  }) => Promise<void> | void;
  onSaveCreatorEffects?: (
    input: WorkspaceBlockEffectsSaveInput,
  ) => Promise<void> | void;
  onSaveAnswersModelSeed?: (input: {
    blockId: string;
    seed: AuthorUnsysModelSeed | null;
  }) => Promise<void> | void;
  onOpenUnsysStudio?: (blockId: string) => void;
  onSplitBlock?: (input: {
    blockId: string;
    prompt?: string;
  }) => Promise<void> | void;
  cloneArmed?: boolean;
  onCloneArm?: (blockId: string) => void;
  onCloneCancel?: () => void;
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
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      {canEdit ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId={AUTHOR_UNSYS_MODEL_DRAWER_ID}
          title={AUTHOR_UNSYS_MODEL_DRAWER_TITLE}
          defaultExpanded={false}
          bodyClassName="space-y-3"
          surfaceDataAttr="data-author-unsys-model-drawer"
        >
          <div data-block-detail-tab-content="unsys_model">
            <WorkspaceBlockUnsysModelPanel
              blockId={blockId}
              blockTitle={blockTitle}
              seed={answersModelSeed}
              canEdit={canEdit}
              busy={editBusy}
              workspaceId={workspaceId}
              ayclToken={ayclToken}
              locale={locale}
              onOpenStudio={onOpenUnsysStudio}
              onSaveSeed={onSaveAnswersModelSeed}
            />
          </div>
        </WorkspaceRightPaneDrawer>
      ) : null}

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

      {canEdit && onCloneArm ? (
        <WorkspaceRightPaneDrawer
          variant="section"
          drawerId="clone"
          title="Clone"
          defaultExpanded={false}
          bodyClassName="space-y-3"
          surfaceDataAttr="data-block-clone-drawer"
        >
          <WorkspaceCloneBlockPane
            blockId={blockId}
            blockTitle={blockTitle}
            armed={cloneArmed}
            busy={editBusy}
            onArm={onCloneArm}
            onCancel={onCloneCancel ?? (() => {})}
          />
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
              canEdit={canEdit}
              busy={editBusy}
              onUpdate={onUpdateBlock}
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
    </WorkspaceRightPaneDrawerGroup>
  );
}
