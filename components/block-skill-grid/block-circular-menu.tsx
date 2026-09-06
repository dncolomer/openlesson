"use client";

import type { ReactNode } from "react";
import { Binoculars, BookOpen, Check, History, Pencil, Pickaxe, Play, Plus, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX,
  BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX,
  BLOCK_CIRCULAR_MENU_RING_RADIUS_PX,
  BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX,
  blockCircularMenuActions,
  circularMenuActionPosition,
  type BlockCircularMenuActionId,
  type BlockCircularMenuSurface,
} from "@/lib/block-circular-menu";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<BlockCircularMenuActionId, ReactNode> = {
  work: <Pickaxe className="size-4" strokeWidth={2.4} aria-hidden />,
  mark_completed: <Check className="size-4" strokeWidth={2.4} aria-hidden />,
  edit: <Pencil className="size-4" strokeWidth={2.4} aria-hidden />,
  gather_resources: <Binoculars className="size-4" strokeWidth={2.4} aria-hidden />,
  see_resources: <BookOpen className="size-4" strokeWidth={2.4} aria-hidden />,
  add_chapter: <Plus className="size-4" strokeWidth={2.4} aria-hidden />,
  accept_chapter: <Check className="size-4" strokeWidth={2.4} aria-hidden />,
  reject_chapter: <X className="size-4" strokeWidth={2.4} aria-hidden />,
  start_session: <Play className="size-4" strokeWidth={2.4} aria-hidden />,
  continue_session: <History className="size-4" strokeWidth={2.4} aria-hidden />,
  mark_done: <Check className="size-4" strokeWidth={2.4} aria-hidden />,
};

export function BlockCircularMenuRing({
  surface,
  onAction,
  disabledIds,
  empty = false,
  timUnopened = false,
}: {
  surface: BlockCircularMenuSurface;
  onAction: (id: BlockCircularMenuActionId) => void;
  disabledIds?: ReadonlySet<string>;
  empty?: boolean;
  timUnopened?: boolean;
}) {
  const actions = blockCircularMenuActions(surface, { empty, timUnopened });
  if (actions.length === 0) return null;
  const diameter = BLOCK_CIRCULAR_MENU_RING_RADIUS_PX * 2;
  return (
    <div
      data-block-circular-menu
      data-block-circular-menu-surface={surface}
      data-block-circular-menu-empty={empty ? "true" : undefined}
      data-block-circular-menu-tim={timUnopened ? "true" : undefined}
      className="pointer-events-none absolute inset-0 z-30 overflow-visible"
    >
      <div
        data-block-circular-menu-ring
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-white/75 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
        style={{
          width: diameter,
          height: diameter,
          borderWidth: BLOCK_CIRCULAR_MENU_RING_THICKNESS_PX,
          transform: "translate(-50%, -50%)",
        }}
      />
      {actions.map((action, index) => {
        const pos = circularMenuActionPosition(index, actions.length);
        const disabled = disabledIds?.has(action.id);
        const prominent = action.id === "work";
        return (
          <button
            key={action.id}
            type="button"
            data-block-circular-menu-action={action.id}
            data-block-circular-menu-prominent={prominent ? "true" : undefined}
            aria-label={action.label}
            disabled={disabled}
            className={cn(
              "group pointer-events-auto absolute left-1/2 top-1/2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-white/55 bg-neutral-950 text-neutral-100 shadow-[0_6px_16px_rgba(0,0,0,0.55)] hover:z-10 hover:w-auto hover:min-w-10 hover:border-white/90 hover:bg-neutral-900 hover:px-2.5 disabled:cursor-not-allowed disabled:opacity-40",
              prominent &&
                "z-[1] outline outline-2 outline-offset-[3px] outline-white/80",
            )}
            style={{
              height: BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX,
              minHeight: BLOCK_CIRCULAR_MENU_ACTION_SIZE_PX,
              borderWidth: BLOCK_CIRCULAR_MENU_ACTION_BORDER_PX,
              transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              if (disabled) return;
              onAction(action.id);
            }}
          >
            <span
              data-block-circular-menu-icon
              className="flex items-center justify-center group-hover:hidden group-focus-visible:hidden"
            >
              {ACTION_ICONS[action.id]}
            </span>
            <span
              data-block-circular-menu-label
              className="hidden max-w-[7.5rem] whitespace-nowrap px-1.5 text-center text-[9px] font-medium leading-tight group-hover:inline group-focus-visible:inline"
            >
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function BlockInTileProgress({ fraction }: { fraction: number }) {
  if (!(fraction > 0 && fraction <= 1)) return null;
  return (
    <div
      data-block-circular-progress
      className="pointer-events-none absolute inset-x-1 bottom-1 z-20 h-1 overflow-hidden rounded-none bg-neutral-900/80"
    >
      <div
        data-block-circular-progress-bar
        className="h-full bg-white/80"
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </div>
  );
}

export function BlockGatherNotificationDot({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      data-block-gather-notification
      className="absolute right-1 top-1 z-20 h-2 w-2 rounded-full bg-white shadow-[0_0_0_2px_rgba(10,10,10,0.9)]"
      aria-label="New resources"
    />
  );
}

export function BlockCircularEditForm({
  draft,
  prompt,
  suggestions,
  suggesting,
  saving,
  onDraftChange,
  onPromptChange,
  onSuggest,
  onSave,
  onCancel,
  suggestLabel,
  saveLabel,
  cancelLabel,
  title = "Edit",
  promptPlaceholder = "Describe how to rewrite…",
}: {
  draft: string;
  prompt: string;
  suggestions: string[];
  suggesting: boolean;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onSuggest: () => void;
  onSave: () => void;
  onCancel: () => void;
  suggestLabel: string;
  saveLabel: string;
  cancelLabel: string;
  title?: string;
  promptPlaceholder?: string;
}) {
  return (
    <ConfirmDialog
      open
      onCancel={onCancel}
      onConfirm={onSave}
      title={title}
      variant="neutral"
      hideIcon
      confirmLabel={saveLabel}
      cancelLabel={cancelLabel}
      confirmDisabled={!draft.trim() || saving}
      confirmBusy={saving}
      confirmTone="primary"
      autoFocusConfirm={false}
      testId="block-circular-edit"
    >
      <input
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={promptPlaceholder}
        className="w-full rounded-none border border-neutral-700 bg-black/60 px-2 py-1 text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
      />
      <button
        type="button"
        disabled={suggesting}
        onClick={() => onSuggest()}
        className="mt-2 text-[11px] text-neutral-400 underline underline-offset-2 hover:text-neutral-200 disabled:opacity-40"
      >
        {suggesting ? "Suggesting…" : suggestLabel}
      </button>
      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onDraftChange(suggestion)}
              className="rounded-none border border-neutral-700/80 bg-neutral-900/60 px-2 py-1 text-left text-xs text-neutral-200 hover:border-neutral-500"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={4}
        className="mt-2 w-full resize-none rounded-none border border-neutral-700 bg-black/60 px-2 py-1.5 text-sm text-neutral-200 focus:border-neutral-500 focus:outline-none"
      />
    </ConfirmDialog>
  );
}
