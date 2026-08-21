"use client";

import { useCallback, useState } from "react";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

export type PromptContextMode = "adhoc" | "knowledge" | "simulation";

export type PromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
  rationale?: string;
};

/**
 * Shared control: adhoc free-text guidance vs Suggest from Knowledge vs
 * Suggest from Simulation. Accepting a suggestion calls onAccept(prompt).
 */
export function WorkspacePromptContextAlternatives({
  workspaceId,
  ayclToken,
  draftPrompt = "",
  surface = "map build",
  mode,
  onModeChange,
  adhocValue,
  onAdhocChange,
  onAccept,
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
  mode: PromptContextMode;
  onModeChange: (mode: PromptContextMode) => void;
  adhocValue: string;
  onAdhocChange: (value: string) => void;
  /** Called when a knowledge/simulation suggestion is accepted. */
  onAccept: (prompt: string) => void;
  disabled?: boolean;
  adhocPlaceholder?: string;
  adhocLabel?: string;
  /** Extra data-* marker on the adhoc field (e.g. pane-specific test hooks). */
  adhocInputDataAttr?: string;
  onAdhocEnter?: () => void;
  adhocAutoFocus?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);

  const runSuggest = useCallback(
    async (kind: "knowledge" | "simulation") => {
      if (!workspaceId || busy || disabled) return;
      setBusy(true);
      setError(null);
      setSuggestions([]);
      onModeChange(kind);
      try {
        const path =
          kind === "knowledge"
            ? "/api/workspace/suggest-from-knowledge"
            : "/api/workspace/suggest-from-simulation";
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            draftPrompt,
            surface,
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: unknown;
          suggestions?: PromptSuggestion[];
        };
        if (!res.ok) {
          throw new Error(
            errorMessageFromBody(data, `Failed to suggest from ${kind}`),
          );
        }
        const list = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        if (!list.length) {
          setError(
            kind === "knowledge"
              ? "No author prompts returned — try again or add more map/snapshot context."
              : "No simulation suggestions yet — curate the Simulation collection first.",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Suggest failed");
      } finally {
        setBusy(false);
      }
    },
    [ayclToken, busy, disabled, draftPrompt, onModeChange, surface, workspaceId],
  );

  return (
    <div
      className="space-y-2"
      data-prompt-context-alternatives
      data-prompt-context-mode={mode}
    >
      <div
        className="flex flex-wrap gap-1.5"
        data-prompt-context-mode-tabs
        role="group"
        aria-label="Prompt context alternatives"
      >
        <button
          type="button"
          data-prompt-context-mode="adhoc"
          data-suggest-adhoc
          disabled={disabled}
          onClick={() => {
            onModeChange("adhoc");
            setSuggestions([]);
            setError(null);
          }}
          className={`rounded-none border px-2 py-1 text-[10px] font-medium transition disabled:opacity-40 ${
            mode === "adhoc"
              ? "border-white/40 bg-white/10 text-white"
              : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
          }`}
        >
          Adhoc
        </button>
        <button
          type="button"
          data-prompt-context-mode="knowledge"
          data-suggest-from-knowledge
          disabled={disabled || !workspaceId || busy}
          onClick={() => void runSuggest("knowledge")}
          className={`rounded-none border px-2 py-1 text-[10px] font-medium transition disabled:opacity-40 ${
            mode === "knowledge"
              ? "border-white/40 bg-white/10 text-white"
              : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
          }`}
        >
          {busy && mode === "knowledge"
            ? "Generating prompts…"
            : "Suggest from Knowledge"}
        </button>
        <button
          type="button"
          data-prompt-context-mode="simulation"
          data-suggest-from-simulation
          disabled={disabled || !workspaceId || busy}
          onClick={() => void runSuggest("simulation")}
          className={`rounded-none border px-2 py-1 text-[10px] font-medium transition disabled:opacity-40 ${
            mode === "simulation"
              ? "border-white/40 bg-white/10 text-white"
              : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
          }`}
        >
          {busy && mode === "simulation" ? "Suggesting…" : "Suggest from Simulation"}
        </button>
      </div>

      {mode === "adhoc" ? (
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
      ) : null}

      {error ? (
        <p className="text-[11px] text-neutral-400" data-prompt-context-error>
          {error}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul
          className="space-y-1.5"
          data-prompt-context-suggestions
          data-suggest-source={mode}
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                data-prompt-context-suggestion={s.id}
                disabled={disabled}
                onClick={() => {
                  onAccept(s.prompt);
                  onAdhocChange(s.prompt);
                  onModeChange("adhoc");
                }}
                className="w-full rounded-none border border-neutral-700/80 bg-neutral-900/60 px-2.5 py-2 text-left transition hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-40"
              >
                <span className="block text-[11px] font-medium text-neutral-100">
                  {s.label}
                </span>
                {s.rationale ? (
                  <span className="mt-0.5 block text-[10px] text-neutral-500">
                    {s.rationale}
                  </span>
                ) : null}
                <span className="mt-1 block text-[10px] leading-snug text-neutral-400 line-clamp-3">
                  {s.prompt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
