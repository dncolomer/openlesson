"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { KnowledgeConfigTrajectoryPanel } from "@/components/KnowledgeConfigTrajectoryPanel";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import { SECTION_TAB_CONTENT_CLASS } from "@/lib/workspace-section-surface";
import { isNoMapWorkspace, workspaceKnowledgeFlowKind } from "@/lib/workspace-kind";

type PerformanceSubview = "knowledge" | "insights";

interface WorkspacePerformancePanelProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  /** Group workspaces allow non-owners self-eval. */
  isGroup?: boolean;
  /** @deprecated TAP/TAP Learning guest links live in Settings; kept for call-site compat. */
  hideTap?: boolean;
  ayclToken?: string;
  /** Verification Workspaces (knowledge_region) can filter Knowledge by flow. */
  workspaceKind?: unknown;
  /** Optional initial Knowledge subview (e.g. insights deep-link). */
  initialSubview?: PerformanceSubview | "score" | "pow";
  /**
   * Learner maps lock the embeddings subject to the signed-in person.
   * Driven by workspaceShell().knowledgeLwmEmbeddingsOnly.
   */
  lwmEmbeddingsOnly?: boolean;
}

/** Knowledge shows embeddings. Ranking, strengths, gaps, and the model report are removed. */
const PERFORMANCE_SUBVIEWS: readonly PerformanceSubview[] = ["knowledge"];

/** Learner Knowledge is the same embeddings surface, locked to self. */
const LEARNER_KNOWLEDGE_SUBVIEWS: readonly PerformanceSubview[] = ["knowledge"];

/**
 * Knowledge surface: embeddings.
 * Ranking, the spider, strengths and gaps paragraphs, and the model report are not shown.
 */
export function WorkspacePerformancePanel({
  workspaceId,
  isOwner,
  currentUserId,
  isGroup: _isGroup = false,
  hideTap: _hideTap = false,
  ayclToken,
  workspaceKind,
  initialSubview,
  lwmEmbeddingsOnly = false,
}: WorkspacePerformancePanelProps) {
  void _hideTap;
  void _isGroup;
  const { t } = useI18n();
  const verificationWorkspace = isNoMapWorkspace(workspaceKind);
  const knowledgeFlowKind = workspaceKnowledgeFlowKind(workspaceKind);
  const allowedSubviews = lwmEmbeddingsOnly
    ? LEARNER_KNOWLEDGE_SUBVIEWS
    : PERFORMANCE_SUBVIEWS;
  const [activeSubview, setActiveSubview] = useState<PerformanceSubview>(() => {
    if (
      initialSubview &&
      (allowedSubviews as readonly string[]).includes(initialSubview)
    ) {
      return initialSubview as PerformanceSubview;
    }
    return "knowledge";
  });

  const subTabs: Array<{ id: PerformanceSubview; label: string }> = useMemo(() => {
    const all: Array<{ id: PerformanceSubview; label: string }> = [
      { id: "knowledge", label: t("planView.performanceSubTabModels") },
    ];
    return all.filter((tab) =>
      (allowedSubviews as readonly string[]).includes(tab.id),
    );
  }, [t, allowedSubviews]);

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-knowledge-panel
      data-knowledge-lwm-embeddings-only={lwmEmbeddingsOnly ? "true" : "false"}
    >
      <WorkspaceSectionSubTabs
        activeId={activeSubview}
        onChange={setActiveSubview}
        tabs={subTabs}
        ariaLabel={t("planView.performanceSectionsAriaLabel")}
        dataAttr="knowledge"
      />

      <div className={SECTION_TAB_CONTENT_CLASS} data-knowledge-tab-body={activeSubview}>
        {activeSubview === "knowledge" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            lockSubjectToSelf={lwmEmbeddingsOnly}
            panelView="models"
            verificationWorkspace={verificationWorkspace}
            knowledgeFlowKind={knowledgeFlowKind}
          />
        )}
      </div>
    </div>
  );
}
