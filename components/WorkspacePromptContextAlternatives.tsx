"use client";

export type PromptContextMode = "adhoc" | "knowledge" | "simulation" | "context";

/**
 * Shared guidance field for generative drawers.
 * Knowledge / Simulation / Context sampling is retired.
 */
export function WorkspacePromptContextAlternatives({
  adhocValue,
  onAdhocChange,
  disabled = false,
  adhocPlaceholder = "Optional guidance for generation…",
  adhocLabel = "Adhoc guidance",
  adhocInputDataAttr,
  onAdhocEnter,
  adhocAutoFocus = false,
}: {
  workspaceId?: string;
  ayclToken?: string;
  draftPrompt?: string;
  surface?: string;
  mode?: PromptContextMode;
  onModeChange?: (mode: PromptContextMode) => void;
  adhocValue: string;
  onAdhocChange: (value: string) => void;
  onAccept?: (prompt: string) => void;
  disabled?: boolean;
  adhocPlaceholder?: string;
  adhocLabel?: string;
  /** Extra data-* marker on the guidance field (e.g. pane-specific test hooks). */
  adhocInputDataAttr?: string;
  onAdhocEnter?: () => void;
  adhocAutoFocus?: boolean;
}) {
  return (
    <div
      className="space-y-2"
      data-prompt-context-alternatives
      data-prompt-context-mode="adhoc"
    >
      <label className="block space-y-1" data-prompt-context-adhoc>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          {adhocLabel}
        </span>
        <textarea
          value={adhocValue}
          onChange={(e) => onAdhocChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && onAdhocEnter) {
              e.preventDefault();
              onAdhocEnter();
            }
          }}
          disabled={disabled}
          autoFocus={adhocAutoFocus}
          rows={3}
          placeholder={adhocPlaceholder}
          data-prompt-context-adhoc-input
          {...(adhocInputDataAttr ? { [adhocInputDataAttr]: true } : {})}
          className="w-full resize-none rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>
    </div>
  );
}
