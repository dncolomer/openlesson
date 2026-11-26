"use client";

/**
 * Multi-block drawer body for simulation. Insight rehearsal is unmounted.
 */
export function WorkspaceMultiBlockSimulationPanel({
  blockIds,
}: {
  workspaceId?: string;
  blockIds: string[];
  blockTitles?: string[];
  ayclToken?: string;
  locale?: string;
}) {
  return (
    <div
      data-multi-block-simulation
      data-multi-block-simulation-pane
      data-simulation-multi-block
      data-simulation-block-count={blockIds.length}
    />
  );
}
