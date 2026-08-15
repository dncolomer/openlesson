"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeStarterFlag } from "@/lib/block-starter-flag";
import {
  BLOCK_PRACTICE_DURATION_OPTIONS,
  normalizeBlockPracticeOptions,
  serializeBlockPracticeOptions,
  type BlockPracticeOptions,
} from "@/lib/block-practice-options";

function practiceOptionsEqual(a: BlockPracticeOptions, b: BlockPracticeOptions): boolean {
  if (a.allowExplore !== b.allowExplore) return false;
  if (a.allowDrill !== b.allowDrill) return false;
  if (a.allowOpenEnded !== b.allowOpenEnded) return false;
  if (a.allowTimed !== b.allowTimed) return false;
  if (a.allowedDurationsMinutes.length !== b.allowedDurationsMinutes.length) {
    return false;
  }
  return a.allowedDurationsMinutes.every((m, i) => m === b.allowedDurationsMinutes[i]);
}

/**
 * Owner-facing block update form for the block-detail Edit drawer.
 * Destructive delete is a sibling drawer, not part of this form.
 */
export function WorkspaceBlockEditPanel({
  blockId,
  title,
  description,
  isStart = false,
  practiceOptions: practiceOptionsProp = null,
  canEdit,
  busy = false,
  onUpdate,
}: {
  blockId: string;
  title: string;
  description?: string | null;
  /** Current starter / potential start flag on the block. */
  isStart?: boolean | null;
  /** Author practice launch limits (Explore/Drill × open/timed + durations). */
  practiceOptions?: BlockPracticeOptions | null;
  canEdit: boolean;
  busy?: boolean;
  onUpdate?: (input: {
    blockId: string;
    title: string;
    description: string;
    isStart: boolean;
    practiceOptions: BlockPracticeOptions;
  }) => Promise<void> | void;
}) {
  const savedPractice = useMemo(
    () => normalizeBlockPracticeOptions(practiceOptionsProp ?? null),
    [practiceOptionsProp],
  );
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description || "");
  const [editIsStart, setEditIsStart] = useState(Boolean(isStart));
  const [editPractice, setEditPractice] = useState<BlockPracticeOptions>(savedPractice);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft when switching blocks or when saved values change externally.
  useEffect(() => {
    setEditTitle(title);
    setEditDescription(description || "");
    setEditIsStart(Boolean(isStart));
    setEditPractice(normalizeBlockPracticeOptions(practiceOptionsProp ?? null));
    setError(null);
  }, [blockId, title, description, isStart, practiceOptionsProp]);

  if (!canEdit) {
    return (
      <div data-block-edit-readonly className="space-y-1.5">
        <p className="text-[11px] text-neutral-500">
          Only the workspace owner can update this block.
        </p>
        <p className="text-xs font-medium text-neutral-200">{title}</p>
        {description ? (
          <p className="text-[11px] leading-relaxed text-neutral-400">{description}</p>
        ) : null}
        {isStart ? (
          <p className="text-[10px] text-neutral-500" data-block-edit-starter-readonly>
            Starter block
          </p>
        ) : null}
        <p
          className="text-[10px] text-neutral-500"
          data-block-edit-practice-readonly
        >
          Practice:{" "}
          {[
            savedPractice.allowExplore ? "Explore" : null,
            savedPractice.allowDrill ? "Drill" : null,
            savedPractice.allowDialog ? "With AI" : null,
            savedPractice.allowSolo ? "Solo" : null,
            savedPractice.allowDrill && savedPractice.allowedDurationsMinutes.length
              ? `Durations (${savedPractice.allowedDurationsMinutes.join("/")}m)`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      </div>
    );
  }

  const dirty =
    editTitle.trim() !== (title || "").trim() ||
    (editDescription || "").trim() !== (description || "").trim() ||
    editIsStart !== Boolean(isStart) ||
    !practiceOptionsEqual(editPractice, savedPractice);

  const patchPractice = (patch: Partial<BlockPracticeOptions>) => {
    setEditPractice((prev) =>
      normalizeBlockPracticeOptions({ ...prev, ...patch }),
    );
  };

  const toggleDuration = (mins: number) => {
    setEditPractice((prev) => {
      if (!prev.allowDrill) return prev;
      const has = prev.allowedDurationsMinutes.includes(mins);
      const next = has
        ? prev.allowedDurationsMinutes.filter((m) => m !== mins)
        : [...prev.allowedDurationsMinutes, mins].sort((a, b) => a - b);
      return normalizeBlockPracticeOptions({
        ...prev,
        allowedDurationsMinutes: next,
      });
    });
  };

  const save = async () => {
    if (!onUpdate || !editTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        blockId,
        title: editTitle.trim(),
        description: editDescription.trim(),
        isStart: normalizeStarterFlag(editIsStart),
        practiceOptions: normalizeBlockPracticeOptions(editPractice),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  const disabled = busy || saving;

  return (
    <div data-block-edit-panel data-block-id={blockId} className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Update block
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-500">Title</span>
        <input
          data-block-edit-title
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          placeholder="Block title"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-neutral-500">Description</span>
        <textarea
          data-block-edit-description
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          disabled={disabled}
          rows={4}
          className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          placeholder="What this block covers…"
        />
      </label>

      <label
        className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2.5 py-2"
        data-block-edit-starter
      >
        <input
          type="checkbox"
          data-block-edit-starter-input
          checked={editIsStart}
          disabled={disabled}
          onChange={(e) => setEditIsStart(e.target.checked)}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-neutral-200">
            Starter block
          </span>
          <span className="mt-0.5 block text-[10px] leading-snug text-neutral-500">
            Flag as a potential start for learning paths on this map.
          </span>
        </span>
      </label>

      {/* Practice launch limits — Explore/Drill × Dialog/Solo + Drill durations */}
      <div
        className="space-y-2.5 rounded-md border border-neutral-800 bg-neutral-950/50 p-2.5"
        data-block-edit-practice-options
      >
        <div>
          <p className="text-[11px] font-medium text-neutral-200">Practice options</p>
          <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
            Explore launches ILE; Drill launches TAP. Second choice for both:
            With AI vs Solo. Durations apply to Drill (TAP) only.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5" data-block-edit-practice-styles>
          <label className="flex cursor-pointer items-center gap-1.5 rounded border border-neutral-800/80 bg-neutral-900/40 px-2 py-1.5">
            <input
              type="checkbox"
              data-block-edit-allow-explore
              checked={editPractice.allowExplore}
              disabled={disabled}
              onChange={(e) => patchPractice({ allowExplore: e.target.checked })}
            />
            <span className="text-[11px] text-neutral-200">Explore</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 rounded border border-neutral-800/80 bg-neutral-900/40 px-2 py-1.5">
            <input
              type="checkbox"
              data-block-edit-allow-drill
              checked={editPractice.allowDrill}
              disabled={disabled}
              onChange={(e) => patchPractice({ allowDrill: e.target.checked })}
            />
            <span className="text-[11px] text-neutral-200">Drill</span>
          </label>
        </div>

        <div
          className="grid grid-cols-2 gap-1.5"
          data-block-edit-practice-modalities
          data-block-edit-practice-horizons
        >
          <label className="flex cursor-pointer items-center gap-1.5 rounded border border-neutral-800/80 bg-neutral-900/40 px-2 py-1.5">
            <input
              type="checkbox"
              data-block-edit-allow-dialog
              data-block-edit-allow-open-ended
              checked={editPractice.allowDialog}
              disabled={disabled}
              onChange={(e) =>
                patchPractice({
                  allowDialog: e.target.checked,
                })
              }
            />
            <span className="text-[11px] text-neutral-200">With AI</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 rounded border border-neutral-800/80 bg-neutral-900/40 px-2 py-1.5">
            <input
              type="checkbox"
              data-block-edit-allow-solo
              data-block-edit-allow-timed
              checked={editPractice.allowSolo}
              disabled={disabled}
              onChange={(e) =>
                patchPractice({
                  allowSolo: e.target.checked,
                })
              }
            />
            <span className="text-[11px] text-neutral-200">Solo</span>
          </label>
        </div>

        {editPractice.allowDrill ? (
          <div data-block-edit-practice-durations>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Allowed timed lengths
            </p>
            <div className="grid grid-cols-4 gap-1">
              {BLOCK_PRACTICE_DURATION_OPTIONS.map((mins) => {
                const on = editPractice.allowedDurationsMinutes.includes(mins);
                return (
                  <button
                    key={mins}
                    type="button"
                    data-block-edit-duration={mins}
                    data-selected={on ? "true" : "false"}
                    disabled={disabled}
                    onClick={() => toggleDuration(mins)}
                    className={`h-7 rounded border text-[10px] font-semibold transition disabled:opacity-40 ${
                      on
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-neutral-700 bg-transparent text-neutral-500 hover:border-neutral-500"
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Hidden serialized snapshot for structural/tests */}
        <span className="sr-only" data-block-edit-practice-serialized>
          {JSON.stringify(serializeBlockPracticeOptions(editPractice))}
        </span>
      </div>

      {error ? (
        <p className="text-[11px] text-red-400/90" data-block-edit-error>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-block-edit-save
        disabled={disabled || !editTitle.trim() || !dirty}
        onClick={() => void save()}
        className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
