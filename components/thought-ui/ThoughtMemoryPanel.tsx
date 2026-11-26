"use client";

import { useEffect, useMemo, useState } from "react";
import {
  thoughtSelectionActionClass,
  thoughtSelectionBarClass,
  thoughtSelectionBarTextClass,
  thoughtSelectionCardClass,
} from "@/components/thought-ui/ThoughtUi";
import { ThoughtEditPanel } from "@/components/thought-ui/ThoughtEditPanel";
import {
  beginEditSelectedThoughts,
  submitEditedThoughtSelection,
  submitSelectedThoughts,
} from "@/lib/learn-last-stash";
import { cn } from "@/lib/utils";

export interface ThoughtMemoryEntry {
  id: string;
  text: string;
  timestamp: number;
}

function formatThoughtTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

interface ThoughtMemoryPanelProps<T extends ThoughtMemoryEntry = ThoughtMemoryEntry> {
  thoughts: T[];
  workspaceId?: string;
  blockId?: string;
  sessionId?: string;
  className?: string;
  listClassName?: string;
  emptyMessage?: string;
  /** Unused. Insight generation is unmounted. */
  insightSurface?: "tap" | "ile" | "knowledge";
  /** Unused. Insight generation is unmounted. */
  allowInsightGeneration?: boolean;
  /** Helios send path for selected thoughts (TAP Learning Thought tool). */
  onSendThought?: (text: string, thoughtIds: string[]) => void | Promise<void>;
  isSending?: boolean;
  /** TAP: save an individual thought locally (no Helios submit). Speech keeps running. */
  onEditThought?: (thought: T, nextText: string) => void;
  /** TAP: delete an individual thought locally and record action PoW. */
  onDeleteThought?: (thought: T) => void;
}

export function ThoughtMemoryPanel<T extends ThoughtMemoryEntry = ThoughtMemoryEntry>({
  thoughts,
  className = "flex h-full min-h-0 max-h-full flex-col overflow-hidden",
  listClassName = "",
  emptyMessage = "Speak, press Del to stash thoughts, or I'm done answering to close. Every trace appears here.",
  onSendThought,
  isSending = false,
  onEditThought,
  onDeleteThought,
}: ThoughtMemoryPanelProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionEdit, setSelectionEdit] = useState<{
    draft: string;
    originalText: string;
    thoughtIds: string[];
  } | null>(null);

  const canManageThoughts = Boolean(onEditThought || onDeleteThought);
  const canSelectThoughts = !canManageThoughts && Boolean(onSendThought);
  const [itemEdit, setItemEdit] = useState<{
    id: string;
    draft: string;
    originalText: string;
  } | null>(null);

  useEffect(() => {
    if (!canManageThoughts) setItemEdit(null);
  }, [canManageThoughts]);

  const selectedThoughts = useMemo(
    () => thoughts.filter((thought) => selectedIds.has(thought.id)),
    [selectedIds, thoughts],
  );

  const toggleSelected = (thoughtId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(thoughtId)) next.delete(thoughtId);
      else next.add(thoughtId);
      return next;
    });
  };

  const scrollListClassName = cn(listClassName, "h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain");

  return (
    <div className={className}>
      <div className="mb-3 shrink-0">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Thought Memory</p>
        <p className="mt-1 text-xs text-neutral-500">
          {canManageThoughts
            ? "Edit or delete individual thoughts. Keep speaking — new thoughts still come in."
            : "Review thought traces from this session."}
        </p>
      </div>

      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        {canSelectThoughts && selectedThoughts.length > 0 && (
          <div className={cn(thoughtSelectionBarClass, "mb-3 shrink-0 flex items-center justify-between gap-2 px-2.5 py-2")}>
            <span className={thoughtSelectionBarTextClass}>{selectedThoughts.length} selected</span>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {onSendThought ? (
                <>
                  <button
                    type="button"
                    data-submit-selection
                    disabled={isSending}
                    onClick={() => {
                      void submitSelectedThoughts({
                        thoughts,
                        selectedIds,
                        sendThought: onSendThought,
                      }).then((result) => {
                        if (result.submitted) setSelectedIds(new Set());
                      });
                    }}
                    className={cn(thoughtSelectionActionClass, "font-medium")}
                  >
                    Submit Selection
                  </button>
                  <button
                    type="button"
                    data-edit-selection
                    disabled={isSending}
                    onClick={() => {
                      const draft = beginEditSelectedThoughts({ thoughts, selectedIds });
                      if (draft) setSelectionEdit(draft);
                    }}
                    className={cn(thoughtSelectionActionClass, "font-medium")}
                  >
                    Edit Selection
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => setSelectedIds(new Set())} className={thoughtSelectionActionClass}>
                Clear
              </button>
            </div>
          </div>
        )}
        <div className={scrollListClassName}>
          {thoughts.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">{emptyMessage}</p>
          ) : (
            thoughts.map((thought) => {
              const isSelected = canSelectThoughts && selectedIds.has(thought.id);
              if (canManageThoughts) {
                return (
                  <article
                    key={thought.id}
                    data-tap-thought-item={thought.id}
                    className="rounded-none border-b border-neutral-800/80 py-4 last:border-b-0"
                  >
                    <p className="mb-2 text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                      {thought.text}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {onEditThought ? (
                        <button
                          type="button"
                          data-tap-edit-thought={thought.id}
                          onClick={() =>
                            setItemEdit({
                              id: thought.id,
                              draft: thought.text,
                              originalText: thought.text,
                            })
                          }
                          className="rounded-none border border-neutral-700 bg-neutral-900/80 px-2 py-1 text-[11px] font-medium text-neutral-100 transition hover:border-neutral-500"
                        >
                          Edit
                        </button>
                      ) : null}
                      {onDeleteThought ? (
                        <button
                          type="button"
                          data-tap-delete-thought={thought.id}
                          onClick={() => onDeleteThought(thought)}
                          className="rounded-none border border-neutral-800 bg-transparent px-2 py-1 text-[11px] font-medium text-neutral-400 transition hover:border-red-500/40 hover:text-red-300"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              }
              if (!canSelectThoughts) {
                return (
                  <article
                    key={thought.id}
                    className="rounded-none border-b border-neutral-800/80 py-4 last:border-b-0"
                  >
                    <p className="mb-2 text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                      {thought.text}
                    </p>
                  </article>
                );
              }
              return (
                <article
                  key={thought.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => toggleSelected(thought.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleSelected(thought.id);
                    }
                  }}
                  className={thoughtSelectionCardClass(
                    isSelected,
                    "cursor-pointer rounded-none border-b border-neutral-800/80 py-4 transition last:border-b-0 hover:bg-neutral-900/35",
                  )}
                >
                  <p className="mb-2 text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                    {thought.text}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </div>

      {itemEdit ? (
        <ThoughtEditPanel
          title="Edit thought"
          submitLabel="Save"
          placeholder="Edit this thought. Keep speaking — new thoughts still come in."
          draft={itemEdit.draft}
          onDraftChange={(draft) =>
            setItemEdit((current) => (current ? { ...current, draft } : null))
          }
          onCancel={() => setItemEdit(null)}
          onSend={() => {
            if (!onEditThought || !itemEdit) return;
            const thought = thoughts.find((entry) => entry.id === itemEdit.id);
            if (!thought) {
              setItemEdit(null);
              return;
            }
            onEditThought(thought, itemEdit.draft);
            setItemEdit(null);
          }}
        />
      ) : null}

      {selectionEdit ? (
        <ThoughtEditPanel
          title="Edit selection"
          submitLabel="Submit"
          draft={selectionEdit.draft}
          onDraftChange={(draft) =>
            setSelectionEdit((current) => (current ? { ...current, draft } : null))
          }
          onCancel={() => setSelectionEdit(null)}
          onSend={() => {
            if (!onSendThought || !selectionEdit) return;
            void submitEditedThoughtSelection({
              draft: selectionEdit.draft,
              thoughtIds: selectionEdit.thoughtIds,
              sendThought: onSendThought,
            }).then((result) => {
              if (!result.submitted) return;
              setSelectionEdit(null);
              setSelectedIds(new Set());
            });
          }}
          isSending={isSending}
        />
      ) : null}
    </div>
  );
}
