"use client";

import { SimulateInsightsSurface } from "@/components/SimulateInsightsSurface";

/**
 * Block drawer body for Simulate Insights.
 * Starts a background job; insight candidates are read after it finishes.
 */
export function WorkspaceBlockSimulationPanel({
  workspaceId,
  blockId,
  ayclToken,
}: {
  workspaceId?: string;
  blockId: string;
  blockTitle?: string;
  blockDescription?: string | null;
  planningPrompt?: string | null;
  localContext?: unknown;
  blockStatus?: string | null;
  isStart?: boolean | null;
  lockUntilTitles?: string[] | null;
  canEdit?: boolean;
  ayclToken?: string;
  locale?: string;
  workspaceGoal?: string | null;
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceNotes?: string | null;
}) {
  return (
    <div data-block-simulation data-block-id={blockId}>
      <SimulateInsightsSurface
        workspaceId={workspaceId}
        ayclToken={ayclToken}
        scope="block"
        blockId={blockId}
        origin={{ kind: "block", blockId }}
      />
    </div>
  );
}

/** @deprecated Prefer WorkspaceBlockSimulationPanel */
export { WorkspaceBlockSimulationPanel as WorkspaceBlockContentSamplesPanel };
