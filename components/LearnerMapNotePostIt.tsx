"use client";

import { useEffect, useState } from "react";
import type { LearnerMapNote } from "@/lib/learner-map-notes";
import { LEARNER_NOTE_BODY_MAX } from "@/lib/learner-map-notes";

/**
 * Small collapsible post-it on the learner map.
 * CRUD controls live on the note itself (edit / delete / collapse).
 */
export function LearnerMapNotePostIt({
  note,
  style,
  onToggleCollapsed,
  onSaveBody,
  onDelete,
}: {
  note: LearnerMapNote;
  style: { left: number; top: number; width: number };
  onToggleCollapsed: (noteId: string) => void;
  onSaveBody: (noteId: string, body: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [draft, setDraft] = useState(note.body);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(note.body);
  }, [note.body, note.id, editing]);

  const collapsed = note.collapsed;
  const preview =
    note.body.trim().length > 0
      ? note.body.trim().slice(0, 28) + (note.body.trim().length > 28 ? "…" : "")
      : "Note";

  const commit = () => {
    onSaveBody(note.id, draft);
    setEditing(false);
  };

  return (
    <div
      data-learner-map-note
      data-learner-note-id={note.id}
      data-learner-note-collapsed={collapsed ? "true" : "false"}
      data-learner-note-col={String(note.col)}
      data-learner-note-row={String(note.row)}
      className="absolute z-[25] pointer-events-auto"
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`rounded-sm border border-amber-700/40 shadow-md transition ${
          collapsed
            ? "bg-amber-200/95 px-1.5 py-1"
            : "bg-amber-100 text-neutral-900"
        }`}
        data-learner-note-postit
      >
        {/* Header: collapse + delete */}
        <div
          className={`flex items-center gap-0.5 ${
            collapsed ? "" : "border-b border-amber-800/15 px-1.5 py-1"
          }`}
          data-learner-note-header
        >
          <button
            type="button"
            data-learner-note-collapse
            title={collapsed ? "Expand note" : "Collapse note"}
            aria-expanded={!collapsed}
            onClick={() => onToggleCollapsed(note.id)}
            className="min-w-0 flex-1 truncate text-left text-[10px] font-semibold uppercase tracking-wide text-amber-950/80 hover:text-amber-950"
          >
            {collapsed ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>📌</span>
                <span className="truncate normal-case tracking-normal font-medium">
                  {preview}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>📌</span>
                Note
              </span>
            )}
          </button>
          {!collapsed ? (
            <button
              type="button"
              data-learner-note-delete
              title="Delete note"
              aria-label="Delete note"
              onClick={() => onDelete(note.id)}
              className="shrink-0 rounded px-1 text-[11px] text-amber-950/60 hover:bg-amber-900/10 hover:text-red-700"
            >
              ×
            </button>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="space-y-1 p-1.5" data-learner-note-body>
            {editing ? (
              <>
                <textarea
                  data-learner-note-edit
                  data-learner-note-input
                  value={draft}
                  maxLength={LEARNER_NOTE_BODY_MAX}
                  rows={3}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setDraft(note.body);
                      setEditing(false);
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      commit();
                    }
                  }}
                  className="w-full resize-none rounded border border-amber-800/20 bg-amber-50/90 px-1.5 py-1 text-[11px] leading-snug text-neutral-900 placeholder:text-neutral-500 focus:border-amber-700/50 focus:outline-none"
                  placeholder="Short note…"
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    data-learner-note-cancel-edit
                    onClick={() => {
                      setDraft(note.body);
                      setEditing(false);
                    }}
                    className="rounded px-1.5 py-0.5 text-[10px] text-amber-950/70 hover:bg-amber-900/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-learner-note-save
                    onClick={commit}
                    className="rounded bg-amber-900/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-50 hover:bg-amber-950"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <p
                  className="min-h-[2.5rem] whitespace-pre-wrap break-words text-[11px] leading-snug text-neutral-800"
                  data-learner-note-text
                >
                  {note.body.trim() ? note.body : (
                    <span className="text-neutral-500 italic">Empty note</span>
                  )}
                </p>
                <button
                  type="button"
                  data-learner-note-edit-start
                  onClick={() => {
                    setDraft(note.body);
                    setEditing(true);
                  }}
                  className="w-full rounded border border-amber-800/15 bg-amber-50/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-950/80 hover:bg-amber-50"
                >
                  Edit
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
