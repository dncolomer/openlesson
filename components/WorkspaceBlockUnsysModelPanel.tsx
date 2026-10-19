"use client";

import { AUTHOR_UNSYS_MODEL_SURFACE } from "@/lib/author-unsys-model";

const BUTTON_CLASS =
  "w-full rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400";

export function WorkspaceBlockUnsysModelPanel({
  blockId,
  canEdit,
  busy = false,
  onOpenStudio,
}: {
  blockId: string;
  blockTitle?: string;
  seed?: unknown;
  canEdit: boolean;
  busy?: boolean;
  workspaceId?: string | null;
  ayclToken?: string;
  locale?: string;
  onOpenStudio?: (blockId: string) => void;
  onSaveSeed?: unknown;
}) {
  if (!canEdit) {
    return (
      <div data-author-unsys-model data-author-unsys-readonly className="space-y-1.5" />
    );
  }

  return (
    <div
      data-author-unsys-model
      data-author-unsys-block={blockId}
      className="space-y-3"
    >
      <button
        type="button"
        data-author-unsys-open
        disabled={busy || !onOpenStudio}
        className={BUTTON_CLASS}
        onClick={() => onOpenStudio?.(blockId)}
      >
        Open unsys model
      </button>
    </div>
  );
}

export { AUTHOR_UNSYS_MODEL_SURFACE };
