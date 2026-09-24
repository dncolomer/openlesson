"use client";

import { useCallback, useRef, useState } from "react";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { pickNextDistinctAuthorPrompt } from "@/lib/suggest-next-prompt";

export type PromptContextMode = "adhoc" | "knowledge" | "simulation" | "context";

export type PromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
  rationale?: string;
};

type SuggestKind = "knowledge" | "simulation" | "context";

const SUGGEST_ENDPOINTS: Record<SuggestKind, string> = {
  knowledge: "/api/workspace/suggest-from-knowledge",
  simulation: "/api/workspace/suggest-from-simulation",
  context: "/api/workspace/suggest-from-context",
};

const EMPTY_SOURCE_ERROR: Record<SuggestKind, string> = {
  knowledge:
    "No author prompt from Knowledge. Add map or snapshot context and try again.",
  simulation:
    "No simulation prompt yet. Curate the Simulation collection first.",
  context: "No context prompt yet. Add notes, files, or links in Context.",
};

/**
 * Shared control for the single guidance field. sample from Knowledge,
 * sample from Simulation, and sample from Context are equal-width actions. Each click writes
 * one author prompt into that field; the next click writes a different one.
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
  /** Called with the one prompt written into the guidance field. */
  onAccept: (prompt: string) => void;
  disabled?: boolean;
  adhocPlaceholder?: string;
  adhocLabel?: string;
  /** Extra data-* marker on the guidance field (e.g. pane-specific test hooks). */
  adhocInputDataAttr?: string;
  onAdhocEnter?: () => void;
  adhocAutoFocus?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Partial<Record<SuggestKind, unknown>>>({});
  const fieldRef = useRef(adhocValue);
  fieldRef.current = adhocValue;

  const applyPrompt = useCallback(
    (prompt: string) => {
      fieldRef.current = prompt;
      onAccept(prompt);
      onAdhocChange(prompt);
    },
    [onAccept, onAdhocChange],
  );

  const runSuggest = useCallback(
    async (kind: SuggestKind) => {
      if (!workspaceId || busy || disabled) return;
      onModeChange(kind);
      setError(null);
      const current = fieldRef.current;
      const cached = cacheRef.current[kind];
      if (cached) {
        const fromCache = pickNextDistinctAuthorPrompt(cached, current);
        if (fromCache) {
          applyPrompt(fromCache);
          return;
        }
      }
      setBusy(true);
      try {
        const res = await fetch(SUGGEST_ENDPOINTS[kind], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            draftPrompt: current || draftPrompt,
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
        cacheRef.current[kind] = data;
        const next = pickNextDistinctAuthorPrompt(data, fieldRef.current);
        if (!next) {
          setError(EMPTY_SOURCE_ERROR[kind]);
          return;
        }
        applyPrompt(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Suggest failed");
      } finally {
        setBusy(false);
      }
    },
    [
      applyPrompt,
      ayclToken,
      busy,
      disabled,
      draftPrompt,
      onModeChange,
      surface,
      workspaceId,
    ],
  );

  const sourceClass = (active: boolean) =>
    `w-full min-w-0 rounded-none border px-1.5 py-1.5 text-center text-[10px] font-medium leading-tight transition disabled:opacity-40 ${
      active
        ? "border-white/40 bg-white/10 text-white"
        : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
    }`;

  return (
    <div
      className="space-y-2"
      data-prompt-context-alternatives
      data-prompt-context-mode={mode}
    >
      <div
        className="grid w-full grid-cols-3 gap-1.5"
        data-prompt-context-mode-tabs
        data-prompt-context-equal-sources
        role="group"
        aria-label="Sample from knowledge, simulation, or context"
      >
        <button
          type="button"
          data-prompt-context-mode="knowledge"
          data-suggest-from-knowledge
          disabled={disabled || !workspaceId || busy}
          onClick={() => void runSuggest("knowledge")}
          className={sourceClass(mode === "knowledge")}
        >
          {busy && mode === "knowledge" ? "…" : "sample from Knowledge"}
        </button>
        <button
          type="button"
          data-prompt-context-mode="simulation"
          data-suggest-from-simulation
          disabled={disabled || !workspaceId || busy}
          onClick={() => void runSuggest("simulation")}
          className={sourceClass(mode === "simulation")}
        >
          {busy && mode === "simulation" ? "…" : "sample from Simulation"}
        </button>
        <button
          type="button"
          data-prompt-context-mode="context"
          data-suggest-from-context
          disabled={disabled || !workspaceId || busy}
          onClick={() => void runSuggest("context")}
          className={sourceClass(mode === "context")}
        >
          {busy && mode === "context" ? "…" : "sample from Context"}
        </button>
      </div>

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

      {error ? (
        <p className="text-[11px] text-neutral-400" data-prompt-context-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}
