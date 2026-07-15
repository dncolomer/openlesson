"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionPlan } from "@/lib/storage";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { ThoughtButton } from "@/components/thought-ui/ThoughtUi";
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
  locale?: string;
  loading?: boolean;
  activeChapterIndex: number;
  loadingChapterIndex?: number | null;
  onLoadChapter: (index: number) => void;
  onChapterDone: () => void;
  onAddChapter: (description: string, position: { row: number; col: number }) => Promise<void>;
  onUpdateChapter: (stepId: string, description: string) => Promise<void>;
  onEnsurePositions?: (plan: SessionPlan) => void;
  isSessionActive: boolean;
  isCurrentStepCompleted?: boolean;
  stuckCheckText?: string | null;
}

export function ChapterMapPanel({
  plan,
  sessionId,
  ayclToken,
  locale = "en",
  loading = false,
  activeChapterIndex,
  loadingChapterIndex = null,
  onLoadChapter,
  onChapterDone,
  onAddChapter,
  onUpdateChapter,
  onEnsurePositions,
  isSessionActive,
  isCurrentStepCompleted = false,
  stuckCheckText = null,
}: ChapterMapPanelProps) {
  const { t } = useI18n();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);
  const [suggestingEdit, setSuggestingEdit] = useState(false);

  const steps = plan?.steps ?? [];
  const nodes = useMemo(() => sessionStepsToSkillGridNodes(steps), [steps]);
  const { placements } = useMemo(() => buildSkillGridLayout(nodes), [nodes]);

  const activeStep = steps[activeChapterIndex];
  const activeCell = activeStep ? placements.get(activeStep.id) ?? null : null;

  const selectedStep = selectedStepId ? steps.find((s) => s.id === selectedStepId) : null;
  const selectedIndex = selectedStep ? steps.findIndex((s) => s.id === selectedStep.id) : -1;

  useEffect(() => {
    if (!plan?.steps.length) return;
    const { plan: positioned, changed } = ensureChapterGridPositions(plan);
    if (changed) onEnsurePositions?.(positioned);
  }, [onEnsurePositions, plan]);

  useEffect(() => {
    if (!activeStep) return;
    setSelectedStepId(activeStep.id);
  }, [activeStep?.id]);

  const suggestEdit = useCallback(async () => {
    if (!sessionId || !editingId || suggestingEdit) return;
    setSuggestingEdit(true);
    try {
      const response = await fetch("/api/workspace/suggest-chapter-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          stepId: editingId,
          currentDescription: editDraft,
          prompt: editPrompt,
          locale,
          ...(ayclToken ? { ayclToken } : {}),
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
  }, [ayclToken, editDraft, editPrompt, editingId, locale, sessionId, suggestingEdit]);

  const saveEdit = useCallback(async () => {
    if (!editingId || savingEdit) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      await onUpdateChapter(editingId, trimmed);
      setEditingId(null);
      setEditDraft("");
    } finally {
      setSavingEdit(false);
    }
  }, [editDraft, editingId, onUpdateChapter, savingEdit]);

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
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-500/70" />
        <LoadingStatusMessage tone="subtle" message={t("chapterMap.preparing")} />
      </div>
    );
  }

  if (!plan || steps.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0b0b0b] p-6">
        {loading ? (
          <>
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-800 border-t-amber-500/70" />
            <LoadingStatusMessage tone="subtle" message={t("chapterMap.preparing")} />
          </>
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
        canEdit
        showProgress
        isAdding={adding}
        sessionId={sessionId}
        ayclToken={ayclToken}
        locale={locale}
        suggestMode="chapter"
        recenterCell={activeCell}
        followCell={activeCell}
        onAddBlock={handleAddAtCell}
        labels={gridLabels}
      />

      {selectedStep && selectedIndex >= 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/95 to-transparent pt-8">
          <div className="pointer-events-auto mx-3 mb-3 rounded-xl border border-neutral-700/80 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
                {(() => {
                  const cell = placements.get(selectedStep.id);
                  return cell
                    ? `Chapter ${cell.row},${cell.col}`
                    : t("chapterMap.chapterLabel", { number: selectedIndex + 1 });
                })()}
              </p>
              <button
                type="button"
                onClick={() => setSelectedStepId(null)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-900 hover:text-neutral-400"
              >
                ✕
              </button>
            </div>

            {editingId === selectedStep.id ? (
              <div className="space-y-2">
                <input
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder={t("chapterMap.editPromptPlaceholder")}
                  className="w-full rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!sessionId || suggestingEdit}
                  onClick={() => void suggestEdit()}
                  className="text-[11px] text-neutral-400 underline underline-offset-2 hover:text-neutral-200 disabled:opacity-40"
                >
                  {suggestingEdit ? t("chapterMap.gridSuggesting") : t("chapterMap.editSuggest")}
                </button>
                {editSuggestions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {editSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setEditDraft(suggestion)}
                        className="rounded-md border border-neutral-700/80 bg-neutral-900/60 px-2.5 py-2 text-left text-xs text-neutral-200 hover:border-neutral-500"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-neutral-200 focus:border-neutral-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <ThoughtButton
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEditingId(null);
                      setEditDraft("");
                    }}
                  >
                    {t("chapterMap.cancel")}
                  </ThoughtButton>
                  <ThoughtButton
                    size="sm"
                    variant="primary"
                    className="w-full"
                    disabled={!editDraft.trim() || savingEdit}
                    onClick={() => void saveEdit()}
                  >
                    {savingEdit ? "…" : t("chapterMap.save")}
                  </ThoughtButton>
                </div>
              </div>
            ) : (
              <>
                <p className="line-clamp-3 text-sm leading-relaxed text-neutral-300">{selectedStep.description}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <ThoughtButton
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEditingId(selectedStep.id);
                      setEditDraft(selectedStep.description);
                    }}
                  >
                    {t("chapterMap.edit")}
                  </ThoughtButton>
                  <ThoughtButton
                    size="sm"
                    className="w-full"
                    disabled={selectedIndex === activeChapterIndex || loadingChapterIndex === selectedIndex}
                    onClick={() => onLoadChapter(selectedIndex)}
                  >
                    {loadingChapterIndex === selectedIndex ? "…" : t("chapterMap.loadChapter")}
                  </ThoughtButton>
                  <ThoughtButton
                    size="sm"
                    variant="primary"
                    className="w-full"
                    disabled={
                      selectedIndex !== activeChapterIndex
                      || selectedStep.status === "completed"
                      || selectedStep.status === "skipped"
                      || isCurrentStepCompleted
                    }
                    onClick={onChapterDone}
                  >
                    {t("chapterMap.markDone")}
                  </ThoughtButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}