"use client";

export interface ThoughtMemoryEntry {
  id: string;
  text: string;
  timestamp: number;
}

function formatThoughtTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

interface ThoughtMemoryPanelProps {
  thoughts: ThoughtMemoryEntry[];
  sentThoughtIds: ReadonlySet<string>;
  skippedThoughtIds: ReadonlySet<string>;
  onSendThought: (text: string, thoughtIds: string[]) => void;
  className?: string;
  listClassName?: string;
  emptyMessage?: string;
}

function statusClasses(isSent: boolean, isSkipped: boolean) {
  if (isSent) return "text-emerald-400";
  if (isSkipped) return "text-neutral-500";
  return "text-cyan-300";
}

export function ThoughtMemoryPanel({
  thoughts,
  sentThoughtIds,
  skippedThoughtIds,
  onSendThought,
  className = "flex h-full min-h-0 flex-col",
  listClassName = "min-h-0 flex-1 space-y-0 overflow-y-auto",
  emptyMessage = "Speak or press C to crystallize thoughts. Every trace appears here.",
}: ThoughtMemoryPanelProps) {
  return (
    <div className={className}>
      <div className="mb-3 shrink-0">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Thought Memory</p>
        <p className="mt-1 text-xs text-neutral-500">Send any trace back into the dialogue.</p>
      </div>
      <div className={listClassName}>
        {thoughts.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">{emptyMessage}</p>
        ) : (
          thoughts.map((thought) => {
            const isSent = sentThoughtIds.has(thought.id);
            const isSkipped = skippedThoughtIds.has(thought.id);
            const statusLabel = isSent ? "sent" : isSkipped ? "skipped" : "active";
            return (
              <article
                key={thought.id}
                className="border-b border-neutral-800/80 py-4 last:border-b-0"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] tabular-nums text-neutral-500">{formatThoughtTime(thought.timestamp)}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-medium uppercase tracking-[1px] ${statusClasses(isSent, isSkipped)}`}>
                      {statusLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSendThought(thought.text, [thought.id])}
                      className="text-[11px] font-medium text-neutral-300 underline decoration-neutral-600 underline-offset-2 transition hover:text-white hover:decoration-neutral-400"
                    >
                      {isSent ? "resend" : "send"}
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
                  {thought.text}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}