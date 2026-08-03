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
  const title = String(blockTitle || "").trim() || "this block";

  return (
    <div
      data-workspace-clone-block-pane
      data-clone-block-id={blockId}
      data-clone-armed={armed ? "true" : "false"}
      className="space-y-3"
    >
      <p className="text-[11px] leading-relaxed text-neutral-400">
        Copy{" "}
        <span className="text-neutral-200">&ldquo;{title}&rdquo;</span> onto an
        empty map cell. Click <span className="text-neutral-200">Clone</span>,
        then click a <span className="text-neutral-200">placeable empty</span>{" "}
        cell — content is pasted as a new 1×1 block (not AI-invented).
      </p>

      {armed ? (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2"
          data-clone-armed-banner
        >
          <p className="text-[11px] font-medium text-amber-100/95">
            Clone armed — click an empty cell on the map
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-amber-100/70">
            Occupied or unusable cells are ignored. Cancel to disarm.
          </p>
          <button
            type="button"
            data-clone-cancel
            disabled={busy}
            onClick={onCancel}
            className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
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
          className="w-full rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
        >
          Clone
        </button>
      )}
    </div>
  );
}
