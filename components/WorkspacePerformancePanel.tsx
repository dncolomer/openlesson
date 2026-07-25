"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { KnowledgeConfigTrajectoryPanel } from "@/components/KnowledgeConfigTrajectoryPanel";
import { ProofOfWorkStatsPanel } from "@/components/ProofOfWorkStatsPanel";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import { SECTION_TAB_CONTENT_CLASS } from "@/lib/workspace-section-surface";

type PerformanceSubview = "pow" | "knowledge" | "lwm" | "ranking" | "insights";

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
  initialSubview?: PerformanceSubview | "score";
}

/** Insights temporarily hidden from nav (may return later). */
const PERFORMANCE_SUBVIEWS: readonly PerformanceSubview[] = [
  "lwm",
  "ranking",
  "knowledge",
  "pow",
];

/**
 * Knowledge surface: LWM (Generate new snapshot), Ranking, Models, PoW.
 * Insights tab hidden for now. Eval removed — snapshot generation lives in LWM.
 */
export function WorkspacePerformancePanel({
  workspaceId,
  isOwner,
  currentUserId,
  isGroup: _isGroup = false,
  hideTap: _hideTap = false,
  ayclToken,
  initialSubview,
}: WorkspacePerformancePanelProps) {
  void _hideTap;
  void _isGroup;
  const { t } = useI18n();
  const [activeSubview, setActiveSubview] = useState<PerformanceSubview>(() => {
    if (initialSubview === "score") return "lwm";
    // Deep-links to insights fall back to LWM while the tab is hidden.
    if (initialSubview === "insights") return "lwm";
    if (initialSubview && (PERFORMANCE_SUBVIEWS as readonly string[]).includes(initialSubview)) {
      return initialSubview as PerformanceSubview;
    }
    return "lwm";
  });

  const subTabs: Array<{ id: PerformanceSubview; label: string }> = useMemo(
    () => [
      { id: "lwm", label: t("planView.performanceSubTabLwm") },
      { id: "ranking", label: t("planView.performanceSubTabRanking") },
      { id: "knowledge", label: t("planView.performanceSubTabModels") },
      { id: "pow", label: t("planView.performanceSubTabPow") },
    ],
    [t],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-knowledge-panel>
      <WorkspaceSectionSubTabs
        activeId={activeSubview}
        onChange={setActiveSubview}
        tabs={subTabs}
        ariaLabel={t("planView.performanceSectionsAriaLabel")}
        dataAttr="knowledge"
      />

      <div className={SECTION_TAB_CONTENT_CLASS} data-knowledge-tab-body={activeSubview}>
        {activeSubview === "pow" && (
          <ProofOfWorkStatsPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            ayclToken={ayclToken}
          />
        )}

        {activeSubview === "knowledge" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
            panelView="models"
          />
        )}

        {activeSubview === "lwm" && (
          <KnowledgeConfigTrajectoryPanel
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            ayclToken={ayclToken}
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
      </div>
    </div>
  );
}
