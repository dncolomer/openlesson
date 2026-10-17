"use client";

import { useEffect, useState } from "react";
import { resolveModelsTabCanInspectOthers } from "@/lib/pow-api/models-tab-scope";
import { KnowledgeModelsView } from "@/components/knowledge-panel/models-view";
import type { VerificationFlowFilterState } from "@/components/VerificationFlowSubtabFilter";
import type { VerificationKnowledgeRow } from "@/lib/verification-flow";
import type { WorkspaceKnowledgeFlowKind } from "@/lib/workspace-kind";

export type KnowledgePanelView = "models";

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
  /** models — embeddings + custom knowledge regions */
  panelView?: KnowledgePanelView;
  /** Verification or Calibration workspace: expose a flow filter on this subtab. */
  verificationWorkspace?: boolean;
  /** Calibrate vs verify embeddings. Learning leaves this null. */
  knowledgeFlowKind?: WorkspaceKnowledgeFlowKind | null;
}

export function KnowledgeConfigTrajectoryPanel({
  workspaceId,
  currentUserId = null,
  isOwner = false,
  ayclToken,
  lockSubjectToSelf = false,
  panelView = "models",
  verificationWorkspace = false,
  knowledgeFlowKind = null,
}: KnowledgeConfigTrajectoryPanelProps) {
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flows, setFlows] = useState<Array<{ id: string; topic: string }>>([]);
  const [rows, setRows] = useState<VerificationKnowledgeRow[]>([]);
  const flowcfgEnabled = Boolean(knowledgeFlowKind || verificationWorkspace);
  const resolvedFlowKind: WorkspaceKnowledgeFlowKind | null =
    knowledgeFlowKind ?? (verificationWorkspace ? "verify" : null);

  useEffect(() => {
    if (!flowcfgEnabled || !resolvedFlowKind) return;
    const params = new URLSearchParams({ workspaceId });
    if (ayclToken) params.set("ayclToken", ayclToken);
    const path =
      resolvedFlowKind === "calibrate"
        ? "/api/workspace/calibration-flows"
        : "/api/workspace/verification-flows";
    let cancelled = false;
    void fetch(`${path}?${params.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const listed = Array.isArray(payload.flows) ? payload.flows : [];
        setFlows(
          listed.map((flow: { id?: string; topic?: string; goal?: string }) => ({
            id: String(flow.id || ""),
            topic: String(flow.topic || flow.goal || "Flow"),
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
  }, [ayclToken, flowcfgEnabled, resolvedFlowKind, workspaceId]);

  const flowFilter: VerificationFlowFilterState = {
    enabled: flowcfgEnabled,
    flowKind: resolvedFlowKind,
    flows,
    flowId,
    rows,
    onFlowId: setFlowId,
  };
  const showModels = panelView === "models" || panelView == null;
  const canInspectOthers = resolveModelsTabCanInspectOthers({
    isOwner,
    lockSubjectToSelf,
  });

  return (
    <div
      className={
        "flex w-full min-h-0 flex-1 flex-col overflow-hidden"
      }
      data-models-tab={showModels ? "true" : undefined}
      data-knowledge-judge-report="removed"
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
    </div>
  );
}
