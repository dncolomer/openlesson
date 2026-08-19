"use client";

import { resolveModelsTabCanInspectOthers } from "@/lib/pow-api/models-tab-scope";
import { KnowledgeLwmView } from "@/components/knowledge-panel/lwm-view";
import { KnowledgeModelsView } from "@/components/knowledge-panel/models-view";
import { KnowledgeRankingView } from "@/components/knowledge-panel/ranking-view";
import { KnowledgeStrengthsGapsView } from "@/components/knowledge-panel/strengths-gaps-view";

export type KnowledgePanelView = "models" | "lwm" | "ranking" | "strengths_gaps";

interface KnowledgeConfigTrajectoryPanelProps {
  workspaceId: string;
  currentUserId?: string | null;
  /** Owners may inspect other users (creator Knowledge). */
  isOwner?: boolean;
  ayclToken?: string;
  /**
   * Self-view mode: force LWM + Embeddings to the logged-in user only —
   * no interactive subject picker even when isOwner is true.
   */
  lockSubjectToSelf?: boolean;
  /**
   * models — embeddings + custom knowledge regions
   * lwm — Learning World Model only (own Knowledge tab)
   * ranking — all-subjects latest Snapshot + GHC leaderboard
   * strengths_gaps — browsable strengths/gaps + PoW-linked analysis (same snapshot source as ranking)
   */
  panelView?: KnowledgePanelView;
}

export function KnowledgeConfigTrajectoryPanel({
  workspaceId,
  currentUserId = null,
  isOwner = false,
  ayclToken,
  lockSubjectToSelf = false,
  panelView = "models",
}: KnowledgeConfigTrajectoryPanelProps) {
  const showModels = panelView === "models";
  const showLwm = panelView === "lwm";
  const showRanking = panelView === "ranking";
  const showStrengthsGaps = panelView === "strengths_gaps";
  const canInspectOthers = resolveModelsTabCanInspectOthers({
    isOwner,
    lockSubjectToSelf,
  });

  return (
    <div
      className={
        showModels || showRanking || showStrengthsGaps
          ? "flex w-full min-h-0 flex-1 flex-col overflow-hidden"
          : "flex w-full min-h-0 flex-1 flex-col gap-5 overflow-y-auto"
      }
      data-models-tab={showModels ? "true" : undefined}
      data-lwm-tab={showLwm ? "true" : undefined}
      data-ranking-tab={showRanking ? "true" : undefined}
      data-strengths-gaps-tab={showStrengthsGaps ? "true" : undefined}
      data-knowledge-panel-view={panelView}
      data-knowledge-lock-subject-to-self={lockSubjectToSelf ? "true" : "false"}
      data-knowledge-can-inspect-others={canInspectOthers ? "true" : "false"}
    >
      {showModels ? (
        <KnowledgeModelsView
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          canInspectOthers={canInspectOthers}
          lockSubjectToSelf={lockSubjectToSelf}
        />
      ) : null}

      {showLwm ? (
        <KnowledgeLwmView
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          isOwner={isOwner}
          ayclToken={ayclToken}
          canInspectOthers={canInspectOthers}
          lockSubjectToSelf={lockSubjectToSelf}
        />
      ) : null}

      {showRanking ? (
        <KnowledgeRankingView
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          canInspectOthers={canInspectOthers}
        />
      ) : null}

      {showStrengthsGaps ? (
        <KnowledgeStrengthsGapsView
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          canInspectOthers={canInspectOthers}
        />
      ) : null}
    </div>
  );
}
