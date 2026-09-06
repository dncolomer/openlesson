"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ThoughtEditPanelProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onCancel: () => void;
  onSend: () => void;
  isSending?: boolean;
  title?: string;
  submitLabel?: string;
  placeholder?: string;
}

export function ThoughtEditPanel({
  draft,
  onDraftChange,
  onCancel,
  onSend,
  isSending = false,
  title = "Edit transcription",
  submitLabel = "send",
  placeholder = "Refine your transcription before sending...",
}: ThoughtEditPanelProps) {
  const canSend = draft.trim().length > 0 && !isSending;

  return (
    <ConfirmDialog
      open
      onCancel={onCancel}
      onConfirm={onSend}
      title={title}
      variant="neutral"
      hideIcon
      confirmLabel={submitLabel}
      cancelLabel="cancel"
      confirmDisabled={!canSend}
      confirmBusy={isSending}
      confirmTone="primary"
      autoFocusConfirm={false}
      size="lg"
      testId="thought-edit-panel"
    >
      <textarea
        data-thought-edit-panel
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        rows={6}
        className="w-full resize-y rounded-none border border-neutral-800 bg-black px-3 py-2 text-sm leading-relaxed text-neutral-100 outline-none transition focus:border-neutral-600"
        placeholder={placeholder}
        autoFocus
      />
    </ConfirmDialog>
  );
}
