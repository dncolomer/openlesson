"use client";

import { ChevronsRight } from "lucide-react";
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

function StashSlotHeader({ index, filled }: { index: number; filled?: boolean }) {
  const labelClass = filled ? "text-neutral-500" : "text-neutral-600";

  return (
    <div className="flex shrink-0 items-center justify-between gap-2">
      <p className={`text-[10px] uppercase tracking-[1.8px] ${labelClass}`}>Stash {index + 1}</p>
      <span
        title={
          index < ACTIVE_THOUGHT_SLOT_COUNT - 1
            ? `Queue flows to Stash ${index + 2}`
            : "End of stash queue"
        }
      >
        <ChevronsRight
          className={`size-3.5 shrink-0 ${filled ? "text-neutral-500" : "text-neutral-600"}`}
          strokeWidth={2}
          aria-hidden
        />
      </span>
    </div>
  );
}

function EmptyThoughtSlot({ index }: { index: number }) {
  return (
    <div
      className="flex h-28 min-h-28 w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-dashed border-neutral-800/90 bg-black/30 p-3"
      aria-hidden
    >
      <StashSlotHeader index={index} filled={false} />
      <div className="min-h-0 flex-1 rounded-lg border border-dashed border-neutral-800/70 bg-black/20" />
      <div className="flex shrink-0 justify-end border-t border-neutral-900/50 pt-2">
        <div className="h-7 w-7 rounded-md border border-dashed border-neutral-800/70" />
      </div>
    </div>
  );
}

function ThoughtSlot({
  index,
  thought,
  isSending,
  onSendThought,
}: {
  index: number;
  thought?: ActiveThoughtSlotEntry;
  isSending: boolean;
  onSendThought: (text: string, thoughtId: string) => void;
}) {
  if (!thought) {
    return <EmptyThoughtSlot index={index} />;
  }

  return (
    <div className="group flex h-28 min-h-28 w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-neutral-800 bg-black/70 p-3 text-left">
      <StashSlotHeader index={index} filled />
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
}

export function ActiveThoughtSlots({ thoughts, onSendThought, isSending = false }: ActiveThoughtSlotsProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-3">
      {Array.from({ length: ACTIVE_THOUGHT_SLOT_COUNT }, (_, index) => (
        <ThoughtSlot
          key={`stash-slot-${index}`}
          index={index}
          thought={thoughts[index]}
          isSending={isSending}
          onSendThought={onSendThought}
        />
      ))}
    </div>
  );
}