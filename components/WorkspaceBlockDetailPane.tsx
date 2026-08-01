"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceBlockEditPanel } from "@/components/WorkspaceBlockEditPanel";
import { deriveBlockExampleTopics } from "@/lib/block-example-topics";
import {
  normalizeBlockLocalContext,
  type BlockLocalContextInput,
} from "@/lib/prompt-workspace-context";

/**
 * Block-detail right column: peer top-level drawers —
 * Details (expanded), Edit (update/delete for owners), Local context,
 * Examples (collapsed by default unless local materials exist).
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
  const examples = deriveBlockExampleTopics({
    title: blockTitle,
    description: blockDescription,
    planningPrompt,
    localNotes: localContext?.notes ?? null,
  });

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
        subtitle={hasLocalMaterials ? "Materials attached" : undefined}
        // Open when create-time / saved local materials exist so they are visible on select.
        defaultExpanded={hasLocalMaterials}
        bodyClassName="space-y-2"
      >
        <div data-block-detail-tab-content="local">{localContextPanel}</div>
      </WorkspaceRightPaneDrawer>

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="examples"
        title="Examples"
        defaultExpanded={false}
        bodyClassName="space-y-3"
      >
        <div data-block-detail-tab-content="examples" className="space-y-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Topics this block explores
            </p>
            {examples.topics.length > 0 ? (
              <ul className="mt-1.5 flex flex-wrap gap-1" data-block-example-topics>
                {examples.topics.map((topic) => (
                  <li
                    key={topic}
                    className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-neutral-300"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[11px] text-neutral-600">No topics derived yet.</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Example questions
            </p>
            {examples.questions.length > 0 ? (
              <ul className="mt-1.5 space-y-1" data-block-example-questions>
                {examples.questions.map((q) => (
                  <li
                    key={q}
                    className="flex gap-1.5 text-[11px] leading-snug text-neutral-400"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/25"
                      aria-hidden
                    />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[11px] text-neutral-600">No example questions yet.</p>
            )}
          </div>
        </div>
      </WorkspaceRightPaneDrawer>
    </div>
  );
}
