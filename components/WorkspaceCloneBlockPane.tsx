"use client";

/**
 * Clone control for sole filled block detail (creator mode).
 * Click Clone to arm paste mode, then click a placeable empty cell on the map.
 */

export function WorkspaceCloneBlockPane({
  blockId,
  blockTitle,
  armed = false,
  busy = false,
  onArm,
  onCancel,
}: {
  blockId: string;
  blockTitle?: string | null;
  armed?: boolean;
  busy?: boolean;
  onArm: (blockId: string) => void;
  onCancel: () => void;
}) {
  void blockTitle;

  return (
    <div
      data-workspace-clone-block-pane
      data-clone-block-id={blockId}
      data-clone-armed={armed ? "true" : "false"}
      className="space-y-3"
    >
      {armed ? (
        <div
          className="rounded-none border border-neutral-600/30 bg-neutral-800/10 px-2.5 py-2"
          data-clone-armed-banner
        >
          <p className="text-[11px] font-medium text-neutral-200/95">
            Clone armed — click an empty cell
          </p>
          <button
            type="button"
            data-clone-cancel
            disabled={busy}
            onClick={onCancel}
            className="mt-2 w-full rounded-none border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            Cancel clone
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-clone-arm
          data-clone-control
          disabled={busy}
          onClick={() => onArm(blockId)}
          className="w-full rounded-none bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
        >
          Clone
        </button>
      )}
    </div>
  );
}
