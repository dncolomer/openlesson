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
  loading = false,
  loadingLabel,
}: {
  steps: SessionPlanStep[] | null | undefined;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const list = Array.isArray(steps) ? steps : [];
  const nodes = sessionStepsToSkillGridNodes(list);
  return (
    <div
      data-ile-continue-mini-map
      data-ile-continue-map-preview
      data-ile-continue-map-loading={loading && nodes.length === 0 ? "true" : "false"}
      data-map-view-only="true"
      className={ILE_CONTINUE_MAP_PREVIEW_FRAME_CLASS}
    >
      {nodes.length === 0 ? (
        <div className="flex h-full min-h-[16rem] items-center justify-center gap-2.5 px-3 text-center text-[11px] text-neutral-600">
          {loading ? (
            <>
              <div
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-neutral-600 border-t-neutral-300"
                aria-hidden
              />
              <span>{loadingLabel || "Checking for existing chapters"}</span>
            </>
          ) : (
            "Chapter map will appear when this session’s plan is loaded."
          )}
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
