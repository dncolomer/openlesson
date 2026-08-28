"use client";

import { BlockSkillGrid } from "@/components/BlockSkillGrid";
import { sessionStepsToSkillGridNodes } from "@/lib/chapter-skill-grid";
import {
  ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS,
  ILE_CONTINUE_MAP_PREVIEW_LABELS,
} from "@/lib/ile-chapter-mini-map";
import type { SessionPlanStep } from "@/lib/domain/types";

/** View-only chapter map like the AYCL landing preview, sized for the welcome column. */
export function IleContinueMapPreview({
  steps,
}: {
  steps: SessionPlanStep[] | null | undefined;
}) {
  const nodes = sessionStepsToSkillGridNodes(steps || []);
  return (
    <div
      data-ile-continue-mini-map
      data-ile-continue-map-preview
      data-map-view-only="true"
      className={ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS}
    >
      {nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[11px] text-neutral-600">
          Chapter map will appear when this session’s plan is loaded.
        </div>
      ) : (
        <BlockSkillGrid
          nodes={nodes}
          selectedNodeId={null}
          onSelectNode={() => {}}
          canEdit={false}
          viewOnly
          showMinimap={false}
          learnerMode
          showProgress={false}
          onAddBlock={async () => {}}
          labels={{ ...ILE_CONTINUE_MAP_PREVIEW_LABELS }}
        />
      )}
    </div>
  );
}
