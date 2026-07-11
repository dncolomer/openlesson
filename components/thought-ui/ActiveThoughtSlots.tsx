"use client";

import { ThoughtButton, ThoughtButtonLabel } from "@/components/thought-ui/ThoughtUi";

export const ACTIVE_THOUGHT_SLOT_COUNT = 3;

export interface ActiveThoughtSlotEntry {
  id: string;
  text: string;
}

interface ActiveThoughtSlotsProps {
  thoughts: ActiveThoughtSlotEntry[];
  selectedThoughtIds: ReadonlySet<string>;
  onToggleSelect: (thoughtId: string) => void;
  onEditThought: (thoughtId: string) => void;
}

function EmptyThoughtSlot({ index }: { index: number }) {
  return (
    <div
      className="flex h-32 max-h-32 flex-col gap-1.5 overflow-hidden rounded-xl border border-dashed border-neutral-800/90 bg-black/30 p-3"
      aria-hidden
    >
      <p className="shrink-0 text-[10px] uppercase tracking-[1.8px] text-neutral-600">Thought {index + 1}</p>
      <div className="min-h-0 flex-1 rounded-lg border border-dashed border-neutral-800/70 bg-black/20" />
      <div className="flex shrink-0 gap-2 border-t border-neutral-900/50 pt-2">
        <div className="h-8 flex-1 rounded-md border border-dashed border-neutral-800/70" />
        <div className="h-8 w-[4.5rem] rounded-md border border-dashed border-neutral-800/70" />
      </div>
    </div>
  );
}

export function ActiveThoughtSlots({
  thoughts,
  selectedThoughtIds,
  onToggleSelect,
  onEditThought,
  editingThoughtId = null,
}: ActiveThoughtSlotsProps & { editingThoughtId?: string | null }) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {Array.from({ length: ACTIVE_THOUGHT_SLOT_COUNT }, (_, index) => {
        const thought = thoughts[index];
        if (!thought) {
          return <EmptyThoughtSlot key={`empty-slot-${index}`} index={index} />;
        }

        const isSelected = selectedThoughtIds.has(thought.id);
        const isEditing = editingThoughtId === thought.id;

        return (
          <div
            key={thought.id}
            className={`group flex h-32 max-h-32 flex-col gap-1.5 overflow-hidden rounded-xl border bg-black/70 p-3 text-left transition hover:border-white/50 ${
              isEditing ? "border-amber-500/70" : isSelected ? "border-white/70" : "border-neutral-800"
            }`}
          >
            <p className="shrink-0 text-[10px] uppercase tracking-[1.8px] text-neutral-500">Thought {index + 1}</p>
            <p
              className="min-h-0 flex-1 overflow-hidden text-sm leading-relaxed text-neutral-200 line-clamp-3"
              title={thought.text}
            >
              {thought.text}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-neutral-900 pt-2">
              <ThoughtButton
                size="sm"
                variant={isSelected ? "toggleOn" : "toggleOff"}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSelect(thought.id);
                }}
              >
                {isSelected ? (
                  "selected"
                ) : (
                  <ThoughtButtonLabel shortcut={["⇧", String(index + 1)]}>select</ThoughtButtonLabel>
                )}
              </ThoughtButton>
              <ThoughtButton size="sm" variant={isEditing ? "toggleOn" : "ghost"} onClick={() => onEditThought(thought.id)}>
                <ThoughtButtonLabel shortcut={index + 1}>edit</ThoughtButtonLabel>
              </ThoughtButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}