"use client";

import { useMemo } from "react";
import { SimulateInsightsSurface } from "@/components/SimulateInsightsSurface";

/**
 * Multi-block drawer body for Simulate Insights.
 */
export function WorkspaceMultiBlockSimulationPanel({
  workspaceId,
  blockIds,
  blockTitles = [],
  ayclToken,
}: {
  workspaceId?: string;
  blockIds: string[];
  blockTitles?: string[];
  ayclToken?: string;
  locale?: string;
}) {
  const origin = useMemo(
    () => ({
      kind: "multi_block" as const,
      blockIds,
      blockTitles: blockTitles.length ? blockTitles : null,
    }),
    [blockIds, blockTitles],
  );
  return (
    <div
      data-multi-block-simulation
      data-multi-block-simulation-pane
      data-simulation-multi-block
      data-simulation-block-count={blockIds.length}
    >
      <SimulateInsightsSurface
        workspaceId={workspaceId}
        ayclToken={ayclToken}
        scope="multi_block"
        blockIds={blockIds}
        origin={origin}
      />
    </div>
  );
}
