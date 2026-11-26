"use client";

/**
 * Block drawer body for simulation. Insight rehearsal is unmounted.
 */
export function WorkspaceBlockSimulationPanel({
  blockId,
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
  return <div data-block-simulation data-block-id={blockId} />;
}

/** @deprecated Prefer WorkspaceBlockSimulationPanel */
export { WorkspaceBlockSimulationPanel as WorkspaceBlockContentSamplesPanel };
