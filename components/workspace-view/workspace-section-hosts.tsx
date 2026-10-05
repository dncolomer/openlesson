"use client";

import type { Dispatch, SetStateAction } from "react";
import { WorkspaceContextPanel } from "@/components/WorkspaceContextPanel";
import { WorkspaceDagsPanel } from "@/components/WorkspaceDagsPanel";
import { WorkspaceMapTypesPanel } from "@/components/WorkspaceMapTypesPanel";
import { WorkspaceGoalsPanel } from "@/components/WorkspaceGoalsPanel";
import { CalibrationFlowsPanel } from "@/components/CalibrationFlowsPanel";
import { VerificationFlowsPanel } from "@/components/VerificationFlowsPanel";
import { WorkspaceIntegrationPanel } from "@/components/WorkspaceIntegrationPanel";
import { InsightsDashboardTab } from "@/components/InsightsDashboardTab";
import { WorkspaceKpisPanel } from "@/components/WorkspaceKpisPanel";
import { WorkspacePerformancePanel } from "@/components/WorkspacePerformancePanel";
import { WorkspaceSectionSurface } from "@/components/WorkspaceSectionSurface";
import type { Block, Workspace } from "@/components/workspace-view/types";
import type { WorkspaceDagRecord } from "@/lib/workspace-dags";
import type { WorkspaceMapTypesState } from "@/lib/workspace-map-types";
import type { WorkspaceModeShell } from "@/lib/workspace-mode";
import type { WorkspaceSectionLayout } from "@/lib/workspace-sections";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";

export function WorkspaceSectionHosts({
  isLearnerMode,
  isOwner,
  canAccessPrivilegedSections,
  sectionLayout,
  visibleSections,
  workspaceImage,
  plan,
  workspaceId,
  notesContent,
  setNotesContent,
  isEditingNotes,
  setIsEditingNotes,
  savingNotes,
  onSaveNotes,
  onCancelNotes,
  isAycl,
  ayclToken,
  nodes,
  workspaceDags,
  workspaceMapTypes,
  isAddingBlock,
  onSaveDagEdit,
  onDeleteDag,
  currentUserId,
  modeShell,
  knowledgeSubviewFromUrl,
  onPlanUpdate,
  t,
}: {
  isLearnerMode: boolean;
  isOwner: boolean;
  canAccessPrivilegedSections: boolean;
  sectionLayout: WorkspaceSectionLayout;
  visibleSections: WorkspaceSectionKey[];
  workspaceImage: string;
  plan: Workspace;
  workspaceId: string;
  notesContent: string;
  setNotesContent: Dispatch<SetStateAction<string>>;
  isEditingNotes: boolean;
  setIsEditingNotes: Dispatch<SetStateAction<boolean>>;
  savingNotes: boolean;
  onSaveNotes: () => void;
  onCancelNotes: () => void;
  isAycl: boolean;
  ayclToken?: string;
  nodes: Block[];
  workspaceDags: WorkspaceDagRecord[];
  workspaceMapTypes: WorkspaceMapTypesState;
  isAddingBlock: boolean;
  onSaveDagEdit: (input: {
    blockIds: string[];
    dagDraft: {
      blockIds: string[];
      edges: Array<{ from: string; to: string; kind: "next" | "lock" }>;
    };
    dagId?: string;
  }) => Promise<void>;
  onDeleteDag: (input: { dagId: string }) => Promise<void>;
  currentUserId: string | null;
  modeShell: WorkspaceModeShell;
  knowledgeSubviewFromUrl: string | null;
  onPlanUpdate: Dispatch<SetStateAction<Workspace | null>>;
  t: (key: string) => string;
}) {
  const identity = {
    title: plan.title || plan.root_topic,
    topic: plan.root_topic,
    description: plan.description,
    notes: plan.notes,
    workspaceId,
    isOwner,
  };

  return (
    <>
      {!isLearnerMode &&
        sectionLayout.mountsContextPanel &&
        visibleSections.includes("context") && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-context-section
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceContextPanel
              workspaceId={workspaceId}
              isOwner={isOwner}
              notesContent={notesContent}
              setNotesContent={setNotesContent}
              isEditingNotes={isEditingNotes}
              setIsEditingNotes={setIsEditingNotes}
              savingNotes={savingNotes}
              onSaveNotes={onSaveNotes}
              onCancelNotes={onCancelNotes}
              showFiles={!isAycl}
              seedQuery={plan.root_topic || plan.title}
              ayclToken={ayclToken}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        isOwner &&
        sectionLayout.mountsDagsPanel &&
        visibleSections.includes("dags") && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-dags-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceDagsPanel
              workspaceDags={workspaceDags}
              blocks={nodes}
              busy={isAddingBlock}
              onSaveEdit={async ({ dagId, dagDraft }) => {
                await onSaveDagEdit({
                  blockIds: dagDraft.blockIds,
                  dagDraft,
                  dagId,
                });
              }}
              onDelete={onDeleteDag}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        isOwner &&
        sectionLayout.mountsMapTypesPanel &&
        visibleSections.includes("map_types") && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-map-types-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceMapTypesPanel
              workspaceId={workspaceId}
              isOwner={isOwner}
              ayclToken={ayclToken}
              initialState={workspaceMapTypes}
              workspaceDags={workspaceDags}
              t={t}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        sectionLayout.mountsGoalsPanel &&
        visibleSections.includes("goals") && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-goals-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <WorkspaceGoalsPanel
              workspaceId={workspaceId}
              isOwner={isOwner}
              ayclToken={ayclToken}
              contextGeneration={isKnowledgeRegionWorkspace(plan.workspace_kind)}
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        sectionLayout.mountsVerificationFlowsPanel &&
        visibleSections.includes("verification_flows") && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-verification-flows-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <VerificationFlowsPanel workspaceId={workspaceId} ayclToken={ayclToken} />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        sectionLayout.mountsCalibrationFlowsPanel &&
        visibleSections.includes("calibration_flows") && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-calibration-flows-host
            className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4"
          >
            <CalibrationFlowsPanel workspaceId={workspaceId} ayclToken={ayclToken} />
          </div>
        </WorkspaceSectionSurface>
      )}

      {(canAccessPrivilegedSections || isLearnerMode) &&
        sectionLayout.mountsPerformancePanel &&
        visibleSections.includes("knowledge") && (
        <WorkspaceSectionSurface
          kind="knowledge"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-neutral-800/70 bg-neutral-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <WorkspacePerformancePanel
              workspaceId={workspaceId}
              isOwner={isOwner}
              currentUserId={currentUserId}
              workspaceKind={plan.workspace_kind}
              ayclToken={ayclToken}
              lwmEmbeddingsOnly={modeShell.knowledgeLwmEmbeddingsOnly}
              initialSubview={
                knowledgeSubviewFromUrl === "insights" ||
                knowledgeSubviewFromUrl === "score" ||
                knowledgeSubviewFromUrl === "pow" ||
                knowledgeSubviewFromUrl === "knowledge" ||
                knowledgeSubviewFromUrl === "lwm"
                  ? knowledgeSubviewFromUrl
                  : undefined
              }
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {sectionLayout.mountsKpisPanel && visibleSections.includes("kpis") && (
        <WorkspaceSectionSurface
          kind="kpis"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-kpis-host
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-neutral-800/70 bg-neutral-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md"
          >
            <WorkspaceKpisPanel workspaceId={workspaceId} />
          </div>
        </WorkspaceSectionSurface>
      )}

      {isLearnerMode &&
        sectionLayout.mountsInsightsPanel &&
        visibleSections.includes("insights") && (
        <WorkspaceSectionSurface
          kind="insights"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <div
            data-workspace-insights-host
            data-play-insights-tab
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-neutral-800/70 bg-neutral-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md"
          >
            <InsightsDashboardTab
              workspaceId={workspaceId}
              workspaceTitle={plan.title || plan.root_topic}
              compact
            />
          </div>
        </WorkspaceSectionSurface>
      )}

      {!isLearnerMode &&
        canAccessPrivilegedSections &&
        sectionLayout.mountsIntegrationPanel && (
        <WorkspaceSectionSurface
          kind="settings"
          imageSrc={workspaceImage}
          identity={identity}
        >
          <WorkspaceIntegrationPanel
            workspaceId={workspaceId}
            workspaceTitle={plan.title || plan.root_topic}
            planTopic={plan.root_topic}
            planDescription={plan.description}
            planNotes={plan.notes}
            isOwner={isOwner}
            currentUserId={currentUserId}
            plan={plan}
            onPlanUpdate={onPlanUpdate}
          />
        </WorkspaceSectionSurface>
      )}
    </>
  );
}
