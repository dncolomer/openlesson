"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceBlockEditPanel } from "@/components/WorkspaceBlockEditPanel";
import { WorkspaceBlockSimulationPanel } from "@/components/WorkspaceBlockSimulationPanel";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";

/**
 * Block-detail right column: peer top-level drawers —
 * 1 Details (expanded), 2 Simulation, 3 Edit (owners), 4 Local context.
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
  workspaceId,
  ayclToken,
  locale = "en",
  canEdit = false,
  editBusy = false,
  onUpdateBlock,
  onDeleteBlock,
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
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  canEdit?: boolean;
  editBusy?: boolean;
  onUpdateBlock?: (input: {
    blockId: string;
    title: string;
    description: string;
  }) => Promise<void> | void;
  onDeleteBlock?: (blockId: string) => Promise<void> | void;
  /** @deprecated Selection-driven dismiss; no drawer X. */
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const localNorm = normalizeBlockLocalContext(localContext);
  const hasLocalMaterials = localNorm.hasLocalMaterials;

  return (
    <div
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
        // Open when create-time / saved local materials exist so they are visible on select.
        defaultExpanded={hasLocalMaterials}
        bodyClassName="space-y-2"
      >
        <div data-block-detail-tab-content="local">{localContextPanel}</div>
      </WorkspaceRightPaneDrawer>
    </div>
  );
}
