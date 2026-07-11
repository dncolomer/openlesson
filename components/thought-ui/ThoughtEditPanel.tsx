"use client";

import { ThoughtButton } from "@/components/thought-ui/ThoughtUi";

interface ThoughtEditPanelProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onCancel: () => void;
  onSend: () => void;
  isSending?: boolean;
}

export function ThoughtEditPanel({
  draft,
  onDraftChange,
  onCancel,
  onSend,
  isSending = false,
}: ThoughtEditPanelProps) {
  const canSend = draft.trim().length > 0 && !isSending;

  return (
    <div className="mb-3 rounded-xl border border-neutral-800 bg-black/60 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-500">Edit thought</p>
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        rows={4}
        className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-relaxed text-neutral-100 outline-none transition focus:border-neutral-600"
        placeholder="Refine your thought before sending to Helios..."
        autoFocus
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <ThoughtButton size="sm" variant="ghost" onClick={onCancel} disabled={isSending}>
          cancel
        </ThoughtButton>
        <ThoughtButton size="sm" variant="primary" onClick={onSend} disabled={!canSend}>
          send
        </ThoughtButton>
      </div>
    </div>
  );
}