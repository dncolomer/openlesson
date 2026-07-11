"use client";

import { ThoughtCompactAction } from "@/components/thought-ui/ThoughtUi";

export const ACTIVE_THOUGHT_SLOT_COUNT = 3;

export interface ActiveThoughtSlotEntry {
  id: string;
  text: string;
}

interface ActiveThoughtSlotsProps {
  thoughts: ActiveThoughtSlotEntry[];
  onSendThought: (text: string, thoughtId: string) => void;
  isSending?: boolean;
}

function EmptyThoughtSlot({ index }: { index: number }) {
  return (
    <div
      className="flex h-28 max-h-28 flex-col gap-1.5 overflow-hidden rounded-xl border border-dashed border-neutral-800/90 bg-black/30 p-3"
      aria-hidden
    >
      <p className="shrink-0 text-[10px] uppercase tracking-[1.8px] text-neutral-600">Thought {index + 1}</p>
      <div className="min-h-0 flex-1 rounded-lg border border-dashed border-neutral-800/70 bg-black/20" />
      <div className="flex shrink-0 justify-end border-t border-neutral-900/50 pt-2">
        <div className="h-7 w-7 rounded-md border border-dashed border-neutral-800/70" />
      </div>
    </div>
  );
}

export function ActiveThoughtSlots({ thoughts, onSendThought, isSending = false }: ActiveThoughtSlotsProps) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {Array.from({ length: ACTIVE_THOUGHT_SLOT_COUNT }, (_, index) => {
        const thought = thoughts[index];
        if (!thought) {
          return <EmptyThoughtSlot key={`empty-slot-${index}`} index={index} />;
        }

        return (
          <div
            key={thought.id}
            className="group flex h-28 max-h-28 flex-col gap-1.5 overflow-hidden rounded-xl border border-neutral-800 bg-black/70 p-3 text-left"
          >
            <p className="shrink-0 text-[10px] uppercase tracking-[1.8px] text-neutral-500">Thought {index + 1}</p>
            <p
              className="min-h-0 flex-1 overflow-hidden text-sm leading-relaxed text-neutral-200 line-clamp-3"
              title={thought.text}
            >
              {thought.text}
            </p>
            <div className="flex shrink-0 justify-end border-t border-neutral-900 pt-2">
              <ThoughtCompactAction
                shortcut={String(index + 1)}
                label="Send to Helios"
                disabled={isSending}
                onClick={() => onSendThought(thought.text, thought.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}