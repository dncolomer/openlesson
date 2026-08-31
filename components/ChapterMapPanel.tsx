"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { BlockSkillGrid } from "@/components/BlockSkillGrid";
import { buildSkillGridLayout } from "@/lib/block-skill-grid";
import {
  ensureChapterGridPositions,
  sessionStepsToSkillGridNodes,
} from "@/lib/chapter-skill-grid";

interface ChapterMapPanelProps {
  plan: SessionPlan | null;
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  locale?: string;
  loading?: boolean;
  activeChapterIndex: number;
  onChapterDoubleClick?: (stepId: string) => void;
  onAddChapter: (description: string, position: { row: number; col: number }) => Promise<void>;
  onEnsurePositions?: (plan: SessionPlan) => void;
  learnerScopeId?: string | null;
}

export function ChapterMapPanel({
  plan,
  sessionId,
  ayclToken,
  ileToken,
  locale = "en",
  loading = false,
  activeChapterIndex,
  onChapterDoubleClick,
  onAddChapter,
  onEnsurePositions,
  learnerScopeId = null,
}: ChapterMapPanelProps) {
  const { t } = useI18n();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const steps = plan?.steps ?? [];
  const nodes = useMemo(() => sessionStepsToSkillGridNodes(steps), [steps]);
  const { placements } = useMemo(() => buildSkillGridLayout(nodes), [nodes]);

  const activeStep = steps[activeChapterIndex];
  const activeCell = activeStep ? placements.get(activeStep.id) ?? null : null;

  useEffect(() => {
    if (!plan?.steps.length) return;
    const { plan: positioned, changed } = ensureChapterGridPositions(plan);
    if (changed) onEnsurePositions?.(positioned);
  }, [onEnsurePositions, plan]);

  useEffect(() => {
    if (!activeStep) return;
    setSelectedStepId(activeStep.id);
  }, [activeStep?.id]);

  const handleAddAtCell = useCallback(
    async (description: string, position: { row: number; col: number }) => {
      setAdding(true);
      try {
        await onAddChapter(description, position);
      } finally {
        setAdding(false);
      }
    },
    [onAddChapter],
  );

  const gridLabels = useMemo(
    () => ({
      emptyCell: t("chapterMap.gridEmptyCell"),
      addTitle: t("chapterMap.gridAddTitle"),
      addPlaceholder: t("chapterMap.gridAddPlaceholder"),
      addSubmit: t("chapterMap.gridAddSubmit"),
      addCancel: t("chapterMap.gridAddCancel"),
      suggestTopics: t("chapterMap.gridSuggestTopics"),
      suggesting: t("chapterMap.gridSuggesting"),
      suggestError: t("chapterMap.gridSuggestError"),
      recenter: t("chapterMap.gridRecenter"),
      zoomIn: t("chapterMap.gridZoomIn"),
      zoomOut: t("chapterMap.gridZoomOut"),
    }),
    [t],
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0b0b0b] p-6">
        <LoadingStatusMessage tone="subtle" message={t("chapterMap.preparing")} />
      </div>
    );
  }

  if (!plan || steps.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0b0b0b] p-6">
        {loading ? (
          <LoadingStatusMessage tone="subtle" message={t("chapterMap.preparing")} />
        ) : (
          <p className="text-sm text-neutral-600">{t("chapterMap.noChapters")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <BlockSkillGrid
        nodes={nodes}
        selectedNodeId={selectedStepId}
        focusedNodeId={activeStep?.id ?? null}
        onSelectNode={setSelectedStepId}
        onNodeDoubleClick={(nodeId) => {
          setSelectedStepId(nodeId);
          onChapterDoubleClick?.(nodeId);
        }}
        canEdit
        showProgress
        isAdding={adding}
        sessionId={sessionId}
        ayclToken={ayclToken}
        ileToken={ileToken}
        learnerScopeId={learnerScopeId}
        locale={locale}
        suggestMode="chapter"
        recenterCell={activeCell}
        followCell={activeCell}
        onAddBlock={handleAddAtCell}
        labels={gridLabels}
      />
    </div>
  );
}
