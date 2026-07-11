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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onCancel}
        disabled={isSending}
        aria-label="Close edit"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thought-edit-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        <p id="thought-edit-title" className="mb-2 text-[10px] uppercase tracking-[2px] text-neutral-500">
          Edit transcription
        </p>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          rows={6}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm leading-relaxed text-neutral-100 outline-none transition focus:border-neutral-600"
          placeholder="Refine your transcription before sending to Helios..."
          autoFocus
        />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <ThoughtButton size="sm" variant="ghost" onClick={onCancel} disabled={isSending}>
            cancel
          </ThoughtButton>
          <ThoughtButton size="sm" variant="primary" onClick={onSend} disabled={!canSend}>
            send
          </ThoughtButton>
        </div>
      </div>
    </div>
  );
}