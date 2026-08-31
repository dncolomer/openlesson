"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ThoughtButton } from "@/components/thought-ui/ThoughtUi";

export type IleChapterHeliosActionsProps = {
  sessionId?: string;
  ayclToken?: string;
  ileToken?: string;
  locale?: string;
  chapterId: string | null;
  chapterIndex: number;
  chapterDescription: string;
  chapterCompleted: boolean;
  activeChapterIndex: number;
  onChapterDone: (opts?: { closeOverride?: boolean }) => void;
  onUpdateChapter: (stepId: string, description: string) => Promise<void>;
  closeReviewBlocked?: boolean;
  closeReviewReason?: string | null;
};

export function IleChapterHeliosActions({
  sessionId,
  ayclToken,
  ileToken,
  locale = "en",
  chapterId,
  chapterIndex,
  chapterDescription,
  chapterCompleted,
  activeChapterIndex,
  onChapterDone,
  onUpdateChapter,
  closeReviewBlocked = false,
  closeReviewReason = null,
}: IleChapterHeliosActionsProps) {
  const { t } = useI18n();
  const guestAccessBody = ayclToken
    ? { ayclToken }
    : ileToken
      ? { ileToken }
      : {};
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);
  const [suggestingEdit, setSuggestingEdit] = useState(false);

  const suggestEdit = useCallback(async () => {
    if (!sessionId || !chapterId || suggestingEdit) return;
    setSuggestingEdit(true);
    try {
      const response = await fetch("/api/workspace/suggest-chapter-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          stepId: chapterId,
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
  }, [ayclToken, ileToken, chapterId, editDraft, editPrompt, locale, sessionId, suggestingEdit]);

  const saveEdit = useCallback(async () => {
    if (!chapterId || savingEdit) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      await onUpdateChapter(chapterId, trimmed);
      setEditing(false);
      setEditDraft("");
    } finally {
      setSavingEdit(false);
    }
  }, [chapterId, editDraft, onUpdateChapter, savingEdit]);

  if (!chapterId || chapterIndex < 0) return null;

  return (
    <div data-ile-chapter-helios-actions className="shrink-0">
      {editing ? (
        <div className="space-y-2">
          <input
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder={t("chapterMap.editPromptPlaceholder")}
            className="w-full rounded-none border border-neutral-700 bg-black/60 px-2 py-1.5 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
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
                  className="rounded-none border border-neutral-700/80 bg-neutral-900/60 px-2 py-1.5 text-left text-xs text-neutral-200 hover:border-neutral-500"
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
            className="w-full resize-none rounded-none border border-neutral-700 bg-black/60 px-2 py-1.5 text-sm text-neutral-200 focus:border-neutral-500 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <ThoughtButton
              size="lg"
              className="w-full"
              onClick={() => {
                setEditing(false);
                setEditDraft("");
              }}
            >
              {t("chapterMap.cancel")}
            </ThoughtButton>
            <ThoughtButton
              size="lg"
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
          <div className="grid grid-cols-2 gap-2">
            <ThoughtButton
              size="lg"
              className="h-12 w-full text-sm"
              onClick={() => {
                setEditing(true);
                setEditDraft(chapterDescription);
              }}
            >
              {t("chapterMap.edit")}
            </ThoughtButton>
            <ThoughtButton
              size="lg"
              className="h-12 w-full text-sm"
              disabled={
                chapterIndex !== activeChapterIndex
                || chapterCompleted
              }
              onClick={() => onChapterDone()}
            >
              {t("chapterMap.complete")}
            </ThoughtButton>
          </div>
          {closeReviewBlocked ? (
            <div className="mt-2 rounded-none border border-neutral-700 bg-neutral-950/90 p-2" data-ile-chapter-close-blocked>
              <p className="text-xs leading-relaxed text-neutral-400">
                {closeReviewReason || "Session proof of work is not enough to close this chapter."}
              </p>
              <button
                type="button"
                data-ile-close-override
                className="mt-2 w-full rounded-none border border-neutral-500 bg-neutral-800 px-2 py-1.5 text-[11px] font-medium text-neutral-100 hover:bg-neutral-700"
                onClick={() => onChapterDone({ closeOverride: true })}
              >
                Close override
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
