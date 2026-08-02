"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
  resolveDetailDrawerDefaultOpenId,
} from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceBlockEditPanel } from "@/components/WorkspaceBlockEditPanel";
import { WorkspaceBlockSimulationPanel } from "@/components/WorkspaceBlockSimulationPanel";
import { WorkspaceSplitBlockPane } from "@/components/WorkspaceSplitBlockPane";
import {
  blockOffersSplitDrawer,
  type SplitCandidateBlock,
} from "@/lib/workspace-right-pane";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";

/**
 * Block-detail right column: peer top-level drawers —
 * 1 Details (expanded), 2 Simulation, 3 Split (multi-cell only), 4 Edit (owners), 5 Local context.
 * Accordion: opening any drawer collapses the others.
 * No X close on drawers; dismiss via map selection clear.
 */
export function WorkspaceBlockDetailPane({
  title,
  children,
  localContextPanel,
  blockId,
  blockTitle,
  blockDescription,
  planningPrompt,
  localContext,
  blockStatus,
  isStart,
  lockUntilTitles,
  spanW,
  spanH,
  shapeCells,
  workspaceId,
  ayclToken,
  locale = "en",
  canEdit = false,
  editBusy = false,
  onUpdateBlock,
  onDeleteBlock,
  onSplitBlock,
}: {
  title?: string;
  /** Block launch / detail body (e.g. SessionItem). */
  children: ReactNode;
  localContextPanel: ReactNode;
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  planningPrompt?: string | null;
  localContext?: BlockLocalContextInput | null;
  blockStatus?: string | null;
  isStart?: boolean | null;
  lockUntilTitles?: string[];
  spanW?: number | null;
  spanH?: number | null;
  shapeCells?: SplitCandidateBlock["shape_cells"];
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  canEdit?: boolean;
  editBusy?: boolean;
  onUpdateBlock?: (input: {
    blockId: string;
    title: string;
    description: string;
    isStart: boolean;
  }) => Promise<void> | void;
  onDeleteBlock?: (blockId: string) => Promise<void> | void;
  onSplitBlock?: (input: {
    blockId: string;
    prompt?: string;
  }) => Promise<void> | void;
  /** @deprecated Selection-driven dismiss; no drawer X. */
  onClose?: () => void;
}) {
  const { t } = useI18n();
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
        drawerId="detail"
        title={title || t("sessionList.sessions")}
        defaultExpanded
        bodyClassName="space-y-3"
      >
        {children}
      </WorkspaceRightPaneDrawer>

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="simulation"
        title="Simulation"
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
              onDelete={onDeleteBlock}
            />
          </div>
        </WorkspaceRightPaneDrawer>
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
