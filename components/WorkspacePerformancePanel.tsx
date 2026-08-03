"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { KnowledgeConfigTrajectoryPanel } from "@/components/KnowledgeConfigTrajectoryPanel";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import { SECTION_TAB_CONTENT_CLASS } from "@/lib/workspace-section-surface";

type PerformanceSubview =
  | "knowledge"
  | "lwm"
  | "ranking"
  | "strengths_gaps"
  | "insights";

interface WorkspacePerformancePanelProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  /** Group workspaces allow non-owners self-eval. */
  isGroup?: boolean;
  /** @deprecated TAP/ILE guest links live in Settings; kept for call-site compat. */
  hideTap?: boolean;
  ayclToken?: string;
  /** Optional initial Knowledge subview (e.g. insights deep-link). */
  initialSubview?: PerformanceSubview | "score" | "pow";
  /**
   * Learner mode: only LWM + Embeddings (models) subtabs — no Ranking / Strengths & Gaps.
   * Driven by resolveWorkspaceModeShell().knowledgeLwmEmbeddingsOnly.
   */
  lwmEmbeddingsOnly?: boolean;
}

/** Insights temporarily hidden from nav (may return later). PoW tab removed from Knowledge. */
const PERFORMANCE_SUBVIEWS: readonly PerformanceSubview[] = [
  "ranking",
  "strengths_gaps",
  "lwm",
  "knowledge",
];

/** Learner Knowledge = LWM + Embeddings only. */
const LEARNER_KNOWLEDGE_SUBVIEWS: readonly PerformanceSubview[] = [
  "lwm",
  "knowledge",
];

/**
 * Knowledge surface: Ranking, Strengths & Gaps, LWM (next to Embeddings), Embeddings.
 * Insights tab hidden for now. PoW tab removed. Eval removed — snapshot generation lives in LWM.
 * Learner (`lwmEmbeddingsOnly`): LWM + Embeddings only.
 */
export function WorkspacePerformancePanel({
  workspaceId,
  isOwner,
  currentUserId,
  isGroup: _isGroup = false,
  hideTap: _hideTap = false,
  ayclToken,
  initialSubview,
  lwmEmbeddingsOnly = false,
}: WorkspacePerformancePanelProps) {
  void _hideTap;
  void _isGroup;
  const { t } = useI18n();
  const allowedSubviews = lwmEmbeddingsOnly
    ? LEARNER_KNOWLEDGE_SUBVIEWS
    : PERFORMANCE_SUBVIEWS;
  const [activeSubview, setActiveSubview] = useState<PerformanceSubview>(() => {
    if (initialSubview === "score") return "lwm";
    // Deep-links to insights / legacy pow fall back to LWM while those tabs are hidden.
    if (initialSubview === "insights" || initialSubview === "pow") return "lwm";
    if (
      initialSubview &&
      (allowedSubviews as readonly string[]).includes(initialSubview)
    ) {
      return initialSubview as PerformanceSubview;
    }
    return "lwm";
  });

  const subTabs: Array<{ id: PerformanceSubview; label: string }> = useMemo(() => {
    const all: Array<{ id: PerformanceSubview; label: string }> = [
      { id: "ranking", label: t("planView.performanceSubTabRanking") },
      { id: "strengths_gaps", label: t("planView.performanceSubTabStrengthsGaps") },
      { id: "lwm", label: t("planView.performanceSubTabLwm") },
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
          />
        )}

        {activeSubview === "lwm" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            lockSubjectToSelf={lwmEmbeddingsOnly}
            panelView="lwm"
          />
        )}

        {activeSubview === "ranking" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            panelView="ranking"
          />
        )}

        {activeSubview === "strengths_gaps" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            panelView="strengths_gaps"
          />
        )}
      </div>
    </div>
  );
}
