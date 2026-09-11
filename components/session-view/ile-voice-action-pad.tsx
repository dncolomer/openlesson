"use client";

import { BLOCK_CIRCULAR_MENU_ACTION_ICONS } from "@/components/block-skill-grid/block-circular-menu";
import type {
  BlockCircularMenuAction,
  BlockCircularMenuActionId,
} from "@/lib/block-circular-menu";

export function IleVoiceActionPad({
  actions,
  disabledIds,
  onAction,
}: {
  actions: readonly BlockCircularMenuAction[];
  disabledIds?: ReadonlySet<string>;
  onAction: (id: BlockCircularMenuActionId) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div
      data-ile-voice-action-pad
      className="grid aspect-square h-[7.25rem] w-[7.25rem] shrink-0 grid-cols-3 content-start gap-1 self-stretch rounded-none border border-white/20 bg-black/40 p-1"
    >
      {actions.map((action) => {
        const disabled = disabledIds?.has(action.id);
        const prominent = action.id === "work";
        return (
          <button
            key={action.id}
            type="button"
            data-ile-voice-action={action.id}
            data-ile-voice-action-prominent={prominent ? "true" : undefined}
            aria-label={action.label}
            title={action.label}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onAction(action.id);
            }}
            className={`flex aspect-square items-center justify-center rounded-none border bg-neutral-950 text-neutral-100 transition hover:border-white hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 ${
              prominent
                ? "border-white outline outline-1 outline-offset-[-1px] outline-white/80"
                : "border-white/40"
            }`}
          >
            {BLOCK_CIRCULAR_MENU_ACTION_ICONS[action.id]}
          </button>
        );
      })}
    </div>
  );
}
