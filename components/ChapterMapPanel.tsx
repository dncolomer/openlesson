"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { BlockSkillGrid } from "@/components/BlockSkillGrid";
import { BlockCircularEditForm } from "@/components/block-skill-grid/block-circular-menu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buildSkillGridLayout } from "@/lib/block-skill-grid";
import {
  ensureChapterGridPositions,
  sessionStepsToSkillGridNodes,
} from "@/lib/chapter-skill-grid";
import type { IleGatherJob } from "@/lib/ile-gather-resources";
import {
  blockCircularMenuProgressFraction,
  blockHasUnseenGatherNotification,
  gatherJobToBlockProgress,
  ileGatherJobTileId,
  ileWorkOnCompletedRequiresConfirm,
  type BlockCircularMenuActionId,
} from "@/lib/block-circular-menu";

interface ChapterMapPanelProps {
  plan: SessionPlan | null;
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  locale?: string;
  loading?: boolean;
  activeChapterIndex: number;
  onAddChapter: (description: string, position: { row: number; col: number }) => Promise<void>;
  onEnsurePositions?: (plan: SessionPlan) => void;
  learnerScopeId?: string | null;
  gatherJobs?: readonly IleGatherJob[] | null;
  onOpenGatherResources?: (opts?: { jobId?: string | null; tileId?: string | null }) => void;
  onWorkChapter?: (stepId: string) => void;
  onUndoChapterDone?: (stepId: string) => void | Promise<void>;
  onMarkChapterCompleted?: (stepId: string) => void;
  onGatherChapterResources?: (stepId: string, description: string) => void;
  onSeeChapterResources?: (stepId: string) => void;
  onUpdateChapter?: (stepId: string, description: string) => Promise<void>;
  blockActionProgress?: Readonly<Record<string, { running: boolean; completed: number; total: number }>>;
  unseenGatherBlockIds?: ReadonlySet<string> | readonly string[];
  gatherReadyCountByBlock?: Readonly<Record<string, number>>;
}

export function ChapterMapPanel({
  plan,
  sessionId,
  ayclToken,
  ileToken,
  locale = "en",
  loading = false,
  activeChapterIndex,
  onAddChapter,
  onEnsurePositions,
  learnerScopeId = null,
  gatherJobs = null,
  onOpenGatherResources,
  onWorkChapter,
  onUndoChapterDone,
  onMarkChapterCompleted,
  onGatherChapterResources,
  onSeeChapterResources,
  onUpdateChapter,
  blockActionProgress,
  unseenGatherBlockIds,
  gatherReadyCountByBlock,
}: ChapterMapPanelProps) {
  const { t } = useI18n();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);
  const [suggestingEdit, setSuggestingEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [undoWorkStepId, setUndoWorkStepId] = useState<string | null>(null);

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

  const unseenSet = useMemo(() => {
    if (!unseenGatherBlockIds) return new Set<string>();
    if (unseenGatherBlockIds instanceof Set) return unseenGatherBlockIds;
    return new Set(unseenGatherBlockIds);
  }, [unseenGatherBlockIds]);

  const blockProgressById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const job of gatherJobs || []) {
      const tileId = ileGatherJobTileId(job);
      const frac = blockCircularMenuProgressFraction(gatherJobToBlockProgress(job));
      if (tileId && frac > 0) out[tileId] = frac;
    }
    for (const [id, progress] of Object.entries(blockActionProgress || {})) {
      const frac = blockCircularMenuProgressFraction(progress);
      if (frac > 0) out[id] = frac;
    }
    return out;
  }, [blockActionProgress, gatherJobs]);

  const unseenGatherById = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const id of unseenSet) {
      out[id] = blockHasUnseenGatherNotification({
        readyCount: gatherReadyCountByBlock?.[id] ?? 1,
        seen: false,
      });
    }
    return out;
  }, [gatherReadyCountByBlock, unseenSet]);

  const guestAccessBody = ayclToken
    ? { ayclToken }
    : ileToken
      ? { ileToken }
      : {};

  const suggestEdit = useCallback(async () => {
    if (!sessionId || !editingStepId || suggestingEdit) return;
    setSuggestingEdit(true);
    try {
      const response = await fetch("/api/workspace/suggest-chapter-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          stepId: editingStepId,
          currentDescription: editDraft,
          prompt: editPrompt,
          locale,
          ...guestAccessBody,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to suggest");
      setEditSuggestions((data.suggestions || []).slice(0, 3));
    } catch {
      setEditSuggestions([]);
    } finally {
      setSuggestingEdit(false);
    }
  }, [ayclToken, ileToken, editingStepId, editDraft, editPrompt, locale, sessionId, suggestingEdit]);

  const saveEdit = useCallback(async () => {
    if (!editingStepId || savingEdit || !onUpdateChapter) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      await onUpdateChapter(editingStepId, trimmed);
      setEditingStepId(null);
      setEditDraft("");
    } finally {
      setSavingEdit(false);
    }
  }, [editingStepId, editDraft, onUpdateChapter, savingEdit]);

  const handleCircularMenuAction = useCallback(
    (blockId: string, action: BlockCircularMenuActionId) => {
      setSelectedStepId(blockId);
      const step = steps.find((s) => s.id === blockId);
      if (action === "work") {
        if (ileWorkOnCompletedRequiresConfirm(step?.status === "completed")) {
          setUndoWorkStepId(blockId);
          return;
        }
        onWorkChapter?.(blockId);
        return;
      }
      if (action === "mark_completed") {
        onMarkChapterCompleted?.(blockId);
        return;
      }
      if (action === "edit") {
        setEditingStepId(blockId);
        setEditDraft(step?.description || "");
        setEditPrompt("");
        setEditSuggestions([]);
        return;
      }
      if (action === "gather_resources") {
        onGatherChapterResources?.(blockId, step?.description || "");
        return;
      }
      if (action === "see_resources") {
        onSeeChapterResources?.(blockId);
        onOpenGatherResources?.({ tileId: blockId });
      }
    },
    [
      onWorkChapter,
      onGatherChapterResources,
      onMarkChapterCompleted,
      onOpenGatherResources,
      onSeeChapterResources,
      steps,
    ],
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
        onSelectNode={(id) => {
          setSelectedStepId(id);
        }}
        circularMenuSurface="ile"
        onCircularMenuAction={handleCircularMenuAction}
        blockProgressById={blockProgressById}
        unseenGatherById={unseenGatherById}
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
        onAddBlock={handleAddAtCell}
        labels={gridLabels}
        gatherJobs={gatherJobs}
        onOpenGatherResources={onOpenGatherResources}
      />
      {editingStepId ? (
        <BlockCircularEditForm
          title={t("chapterMap.edit")}
          promptPlaceholder={t("chapterMap.editPromptPlaceholder")}
          draft={editDraft}
          prompt={editPrompt}
          suggestions={editSuggestions}
          suggesting={suggestingEdit}
          saving={savingEdit}
          onDraftChange={setEditDraft}
          onPromptChange={setEditPrompt}
          onSuggest={() => void suggestEdit()}
          onSave={() => void saveEdit()}
          onCancel={() => {
            setEditingStepId(null);
            setEditDraft("");
          }}
          suggestLabel={t("chapterMap.editSuggest")}
          saveLabel={t("chapterMap.save")}
          cancelLabel={t("chapterMap.cancel")}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(undoWorkStepId)}
        onCancel={() => setUndoWorkStepId(null)}
        onConfirm={() => {
          const id = undoWorkStepId;
          setUndoWorkStepId(null);
          if (!id) return;
          void (async () => {
            await onUndoChapterDone?.(id);
            onWorkChapter?.(id);
          })();
        }}
        title={t("chapterMap.undoWorkTitle")}
        description={t("chapterMap.undoWorkBody")}
        variant="warning"
        confirmLabel={t("chapterMap.undoWorkConfirm")}
        cancelLabel={t("chapterMap.cancel")}
        testId="ile-undo-chapter-done"
      />
    </div>
  );
}
