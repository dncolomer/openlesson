"use client";

import { useEffect, useState } from "react";
import { resolveModelsTabCanInspectOthers } from "@/lib/pow-api/models-tab-scope";
import { KnowledgeLwmView } from "@/components/knowledge-panel/lwm-view";
import { KnowledgeModelsView } from "@/components/knowledge-panel/models-view";
import { KnowledgeRankingView } from "@/components/knowledge-panel/ranking-view";
import { KnowledgeStrengthsGapsView } from "@/components/knowledge-panel/strengths-gaps-view";
import type { VerificationFlowFilterState } from "@/components/VerificationFlowSubtabFilter";
import type { VerificationKnowledgeRow } from "@/lib/verification-flow";

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
  /** Verification Workspace: expose a flow filter on this subtab. */
  verificationWorkspace?: boolean;
}

export function KnowledgeConfigTrajectoryPanel({
  workspaceId,
  currentUserId = null,
  isOwner = false,
  ayclToken,
  lockSubjectToSelf = false,
  panelView = "models",
  verificationWorkspace = false,
}: KnowledgeConfigTrajectoryPanelProps) {
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flows, setFlows] = useState<Array<{ id: string; topic: string }>>([]);
  const [rows, setRows] = useState<VerificationKnowledgeRow[]>([]);

  useEffect(() => {
    if (!verificationWorkspace) return;
    const params = new URLSearchParams({ workspaceId });
    if (ayclToken) params.set("ayclToken", ayclToken);
    let cancelled = false;
    void fetch(`/api/workspace/verification-flows?${params.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const listed = Array.isArray(payload.flows) ? payload.flows : [];
        setFlows(
          listed.map((flow: { id?: string; topic?: string }) => ({
            id: String(flow.id || ""),
            topic: String(flow.topic || "Flow"),
          })),
        );
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
      })
      .catch(() => {
        if (!cancelled) {
          setFlows([]);
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [verificationWorkspace, workspaceId, ayclToken]);

  const flowFilter: VerificationFlowFilterState = {
    enabled: verificationWorkspace,
    flows,
    flowId,
    rows,
    onFlowId: setFlowId,
  };
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
          flowFilter={flowFilter}
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
          flowFilter={flowFilter}
        />
      ) : null}

      {showRanking ? (
        <KnowledgeRankingView
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          canInspectOthers={canInspectOthers}
          flowFilter={flowFilter}
        />
      ) : null}

      {showStrengthsGaps ? (
        <KnowledgeStrengthsGapsView
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          ayclToken={ayclToken}
          canInspectOthers={canInspectOthers}
          flowFilter={flowFilter}
        />
      ) : null}
    </div>
  );
}
