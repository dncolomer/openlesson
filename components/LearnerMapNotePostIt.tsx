"use client";

import { useEffect, useRef, useState } from "react";
import type { LearnerMapNote } from "@/lib/learner-map-notes";
import {
  LEARNER_NOTE_BODY_MAX,
  learnerNotePointerAllowsDragStart,
} from "@/lib/learner-map-notes";
import {
  learnerNoteCommitFromGestureBox,
  learnerNoteLiveBoxFromPointerMove,
  type LearnerNoteGestureBox,
} from "@/lib/learner-map-note-gestures";

type DragSession = {
  kind: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originLeft: number;
  originTop: number;
  originWidth: number;
  originHeight: number;
  /** Last computed box — commit from this on pointerup (not React `live` state). */
  last: LearnerNoteGestureBox;
};

/**
 * Free continuous-plane post-it: collapsible, inline edit/delete,
 * drag to move, corner resize. Lives on the map world layer (pan/zoom).
 *
 * Drag surface is a dedicated non-button handle; collapse/delete are separate
 * controls so pointerdown is never swallowed by `closest("button")`.
 */
export function LearnerMapNotePostIt({
  note,
  style,
  zoom = 1,
  canDelete = true,
  canEdit = true,
  canDragResize = true,
  onToggleCollapsed,
  onSaveBody,
  onDelete,
  onDragEnd,
  onResizeEnd,
}: {
  note: LearnerMapNote;
  style: { left: number; top: number; width: number; height: number };
  /** Map zoom — drag/resize screen deltas convert to world plane. */
  zoom?: number;
  /** False for creator notes viewed in learner mode. */
  canDelete?: boolean;
  /** False for creator notes viewed in learner mode (body read-only). */
  canEdit?: boolean;
  /** False for creator notes viewed in learner mode (fixed placement). */
  canDragResize?: boolean;
  onToggleCollapsed: (noteId: string) => void;
  onSaveBody: (noteId: string, body: string) => void;
  onDelete: (noteId: string) => void;
  onDragEnd: (
    noteId: string,
    next: { x: number; y: number },
  ) => void;
  onResizeEnd: (
    noteId: string,
    next: { width: number; height: number },
  ) => void;
}) {
  const [draft, setDraft] = useState(note.body);
  const [editing, setEditing] = useState(false);
  const [live, setLive] = useState<LearnerNoteGestureBox | null>(null);

  const dragRef = useRef<DragSession | null>(null);

  useEffect(() => {
    if (!editing) setDraft(note.body);
  }, [note.body, note.id, editing]);

  useEffect(() => {
    if (!canEdit && editing) setEditing(false);
  }, [canEdit, editing]);

  // Clear live override when note props change from host (e.g. after persist).
  useEffect(() => {
    setLive(null);
  }, [note.x, note.y, note.width, note.height, note.id]);

  const collapsed = note.collapsed;
  const preview =
    note.body.trim().length > 0
      ? note.body.trim().slice(0, 28) + (note.body.trim().length > 28 ? "…" : "")
      : "Note";

  const box: LearnerNoteGestureBox = live ?? {
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
  };

  const commit = () => {
    onSaveBody(note.id, draft);
    setEditing(false);
  };

  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;

  const endPointer = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // Capture last box from ref before clearing (do not rely on React `live`).
    const finalBox = drag.last;
    const kind = drag.kind;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture?.(
        event.pointerId,
      );
    } catch {
      /* ignore */
    }
    const payload = learnerNoteCommitFromGestureBox(kind, finalBox);
    if (payload.kind === "move") {
      onDragEnd(note.id, { x: payload.x, y: payload.y });
    } else {
      onResizeEnd(note.id, {
        width: payload.width,
        height: payload.height,
      });
    }
    setLive(null);
  };

  const applyPointerMove = (event: React.PointerEvent, kind: "move" | "resize") => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) {
      return;
    }
    const next = learnerNoteLiveBoxFromPointerMove({
      kind,
      originLeft: drag.originLeft,
      originTop: drag.originTop,
      originWidth: drag.originWidth,
      originHeight: drag.originHeight,
      startClientX: drag.startClientX,
      startClientY: drag.startClientY,
      clientX: event.clientX,
      clientY: event.clientY,
      zoom: z,
    });
    drag.last = next;
    setLive(next);
  };

  const startMoveDrag = (event: React.PointerEvent) => {
    if (!canDragResize) return;
    if (event.button !== 0) return;
    if (!learnerNotePointerAllowsDragStart(event.target as Element)) return;
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const origin: LearnerNoteGestureBox = {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    };
    dragRef.current = {
      kind: "move",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      originWidth: origin.width,
      originHeight: origin.height,
      last: origin,
    };
  };

  const startResizeDrag = (event: React.PointerEvent) => {
    if (!canDragResize) return;
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const origin: LearnerNoteGestureBox = {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    };
    dragRef.current = {
      kind: "resize",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      originWidth: origin.width,
      originHeight: origin.height,
      last: origin,
    };
  };

  return (
    <div
      data-learner-map-note
      data-learner-note-id={note.id}
      data-learner-note-source={note.source || "learner"}
      data-learner-note-collapsed={collapsed ? "true" : "false"}
      data-learner-note-can-delete={canDelete ? "true" : "false"}
      data-learner-note-can-edit={canEdit ? "true" : "false"}
      data-learner-note-x={String(note.x)}
      data-learner-note-y={String(note.y)}
      data-learner-note-width={String(note.width)}
      data-learner-note-height={String(note.height)}
      className="absolute z-[25] pointer-events-auto"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: collapsed ? undefined : box.height,
        minHeight: collapsed ? undefined : 56,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`relative flex h-full min-h-0 flex-col rounded-md border border-neutral-300/90 bg-white text-neutral-900 shadow-[0_4px_16px_rgba(0,0,0,0.22)] ${
          collapsed ? "px-1 py-1" : ""
        }`}
        data-learner-note-postit
        style={collapsed ? undefined : { height: "100%" }}
      >
        {/* Header: clear drag zone + separate control buttons */}
        <div
          className={`flex shrink-0 items-stretch gap-1 ${
            collapsed ? "gap-1" : "border-b border-neutral-200 px-1 py-1"
          }`}
          data-learner-note-header
        >
          <div
            role="presentation"
            data-learner-note-drag-handle
            title={canDragResize ? "Drag to move" : "Note (fixed)"}
            className={`flex min-w-0 flex-1 touch-none select-none items-center gap-1.5 rounded border border-dashed px-1.5 py-1 ${
              canDragResize
                ? "cursor-grab border-neutral-300 bg-neutral-50 active:cursor-grabbing active:border-neutral-400 active:bg-neutral-100"
                : "cursor-default border-neutral-200 bg-neutral-50/80"
            }`}
            onPointerDown={startMoveDrag}
            onPointerMove={(e) => applyPointerMove(e, "move")}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          >
            {/* Grip dots — visual affordance for the drag zone */}
            {canDragResize ? (
              <span
                className="grid shrink-0 grid-cols-2 gap-0.5"
                data-learner-note-drag-grip
                aria-hidden
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-0.5 w-0.5 rounded-full bg-neutral-400"
                  />
                ))}
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-600">
              {collapsed ? (
                <span className="truncate">{preview}</span>
              ) : canDragResize ? (
                <span className="uppercase tracking-[0.12em] text-neutral-500">
                  Drag
                </span>
              ) : (
                <span className="uppercase tracking-[0.12em] text-neutral-500">
                  {note.source === "creator" ? "Author note" : "Note"}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            data-learner-note-collapse
            data-learner-note-no-drag
            title={collapsed ? "Expand note" : "Collapse note"}
            aria-expanded={!collapsed}
            onClick={() => onToggleCollapsed(note.id)}
            className="shrink-0 self-center rounded border border-neutral-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {!collapsed && canDelete ? (
            <button
              type="button"
              data-learner-note-delete
              data-learner-note-no-drag
              title="Delete note"
              aria-label="Delete note"
              onClick={() => onDelete(note.id)}
              className="shrink-0 self-center rounded border border-neutral-200 bg-white px-1.5 py-1 text-[11px] leading-none text-neutral-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              ×
            </button>
          ) : null}
        </div>

        {!collapsed ? (
          <div
            className="flex min-h-0 flex-1 flex-col bg-white"
            data-learner-note-body
          >
            {/* Scrollable content — leaves room for the pinned footer */}
            <div
              className="min-h-0 flex-1 overflow-auto p-1.5 pb-1"
              data-learner-note-scroll
            >
              {editing ? (
                <textarea
                  data-learner-note-edit
                  data-learner-note-input
                  value={draft}
                  maxLength={LEARNER_NOTE_BODY_MAX}
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
                  className="h-full min-h-[3rem] w-full resize-none rounded border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-[11px] leading-snug text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
                  placeholder="Short note…"
                />
              ) : (
                <p
                  className="min-h-[2rem] whitespace-pre-wrap break-words text-[11px] leading-snug text-neutral-800"
                  data-learner-note-text
                >
                  {note.body.trim() ? (
                    note.body
                  ) : (
                    <span className="text-neutral-400 italic">Empty note</span>
                  )}
                </p>
              )}
            </div>

            {/* Footer always pinned to the bottom of the note */}
            {canEdit || editing ? (
              <div
                className="shrink-0 border-t border-neutral-100 bg-white px-1.5 py-1"
                data-learner-note-footer
              >
                {editing && canEdit ? (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      data-learner-note-cancel-edit
                      onClick={() => {
                        setDraft(note.body);
                        setEditing(false);
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      data-learner-note-save
                      onClick={commit}
                      className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black"
                    >
                      Save
                    </button>
                  </div>
                ) : canEdit ? (
                  <button
                    type="button"
                    data-learner-note-edit-start
                    onClick={() => {
                      setDraft(note.body);
                      setEditing(true);
                    }}
                    className="w-full rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Resize handle — bottom-right */}
        {!collapsed && canDragResize ? (
          <div
            data-learner-note-resize-handle
            title="Resize"
            className="absolute bottom-0 right-0 z-[2] h-3.5 w-3.5 cursor-se-resize touch-none"
            onPointerDown={startResizeDrag}
            onPointerMove={(e) => applyPointerMove(e, "resize")}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          >
            <svg
              className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-neutral-400"
              viewBox="0 0 12 12"
              fill="currentColor"
              aria-hidden
            >
              <path
                d="M10 2v8H2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10 6v4H6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  );
}
