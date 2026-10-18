"use client";

export function WorkspacePlaySidebar({
  title,
  description,
  startLabel,
  busy,
  onStart,
  onClose,
}: {
  title: string;
  description: string;
  startLabel: string;
  busy?: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <aside
      data-workspace-play-block-sidebar
      className="flex h-full w-full shrink-0 flex-col border-t border-white/20 bg-black md:w-[22rem] md:border-l md:border-t-0"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/15 px-4 py-3">
        <h2 className="text-base font-medium text-white">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs text-neutral-400 hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
          {description || "No description yet."}
        </p>
      </div>
      <div className="border-t border-white/15 p-4">
        <button
          type="button"
          data-workspace-play-start-session
          disabled={busy}
          onClick={onStart}
          className="inline-flex h-11 w-full items-center justify-center rounded-none bg-white text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
        >
          {busy ? "Starting…" : startLabel}
        </button>
      </div>
    </aside>
  );
}
