"use client";

export const ACTIVE_THOUGHT_SLOT_COUNT = 3;

export interface ActiveThoughtSlotEntry {
  id: string;
  text: string;
}

interface ActiveThoughtSlotsProps {
  thoughts: ActiveThoughtSlotEntry[];
}

function EmptyThoughtSlot({ index }: { index: number }) {
  return (
    <div
      className="flex h-28 max-h-28 flex-col gap-1.5 overflow-hidden rounded-xl border border-dashed border-neutral-800/90 bg-black/30 p-3"
      aria-hidden
    >
      <p className="shrink-0 text-[10px] uppercase tracking-[1.8px] text-neutral-600">Thought {index + 1}</p>
      <div className="min-h-0 flex-1 rounded-lg border border-dashed border-neutral-800/70 bg-black/20" />
    </div>
  );
}

export function ActiveThoughtSlots({ thoughts }: ActiveThoughtSlotsProps) {
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
              className="min-h-0 flex-1 overflow-hidden text-sm leading-relaxed text-neutral-200 line-clamp-4"
              title={thought.text}
            >
              {thought.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}