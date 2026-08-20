"use client";

import { useCallback, useState } from "react";
import type { ShapeContextSourceOption } from "@/lib/shape-context-select";
import {
  acceptExternalContextSuggestion,
  externalSuggestionToContextOption,
  mergeAcceptedExternalIntoSelection,
  type ExternalContextSuggestion,
} from "@/lib/suggest-external-context";

/**
 * Suggest internet external sources via xAI and attach accepted ones
 * into the shape-context / local-context picker selection.
 */
export function WorkspaceSuggestExternalContext({
  workspaceId,
  ayclToken,
  topic,
  disabled = false,
  selectedKeys,
  options,
  onChange,
}: {
  workspaceId?: string;
  ayclToken?: string;
  /** Draft block prompt / topic for the suggestion request. */
  topic: string;
  disabled?: boolean;
  selectedKeys: string[];
  options: ShapeContextSourceOption[];
  onChange: (next: {
    options: ShapeContextSourceOption[];
    selectedKeys: string[];
  }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ExternalContextSuggestion[]>(
    [],
  );

  const canSuggest = Boolean(workspaceId) && topic.trim().length > 0 && !disabled;

  const runSuggest = useCallback(async () => {
    if (!canSuggest || !workspaceId || busy) return;
    setBusy(true);
    setError(null);
    setSuggestions([]);
    try {
      const response = await fetch("/api/workspace/suggest-external-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          topic: topic.trim().slice(0, 2_000),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        suggestions?: ExternalContextSuggestion[];
      };
      if (!response.ok) {
        throw new Error(data.error || "Failed to suggest external sources");
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      if (!data.suggestions?.length) {
        setError("No external sources suggested — try a richer topic prompt.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to suggest external sources",
      );
    } finally {
      setBusy(false);
    }
  }, [ayclToken, busy, canSuggest, topic, workspaceId]);

  const acceptOne = useCallback(
    async (suggestion: ExternalContextSuggestion) => {
      if (!workspaceId || acceptingKey) return;
      const prepared = acceptExternalContextSuggestion(suggestion);
      if (!prepared) {
        setError("Invalid suggestion URL");
        return;
      }
      setAcceptingKey(suggestion.key);
      setError(null);
      try {
        const response = await fetch("/api/workspace/external-resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            ...(ayclToken ? { ayclToken } : {}),
            ...prepared.createInput,
            meta: { suggested_by: "xai_suggest_external_context" },
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          resource?: { id?: string };
        };
        if (!response.ok || !data.resource?.id) {
          throw new Error(data.error || "Failed to attach external source");
        }
        const option = externalSuggestionToContextOption(
          suggestion,
          data.resource.id,
        );
        const merged = mergeAcceptedExternalIntoSelection({
          selectedKeys,
          options,
          resourceId: data.resource.id,
          suggestion,
        });
        // Prefer option with real id from helper
        const optionsWithReal = merged.options.map((o) =>
          o.url === option.url ? option : o,
        );
        const selectedWithReal = merged.selectedKeys.map((k) =>
          k === suggestion.key || k.startsWith("suggest:")
            ? option.key
            : k,
        );
        // Ensure option.key is selected
        const selectedKeysFinal = selectedWithReal.includes(option.key)
          ? selectedWithReal
          : [...selectedWithReal, option.key];
        onChange({
          options: optionsWithReal.some((o) => o.key === option.key)
            ? optionsWithReal
            : [option, ...optionsWithReal],
          selectedKeys: selectedKeysFinal,
        });
        setSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to attach external source",
        );
      } finally {
        setAcceptingKey(null);
      }
    },
    [
      acceptingKey,
      ayclToken,
      onChange,
      options,
      selectedKeys,
      workspaceId,
    ],
  );

  return (
    <div
      className="space-y-2 rounded-md border border-neutral-800 bg-neutral-950/50 p-2"
      data-suggest-external-context
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Internet sources
        </p>
        <button
          type="button"
          data-suggest-external-context-button
          disabled={!canSuggest || busy}
          onClick={() => void runSuggest()}
          title={
            !topic.trim()
              ? "Enter a block prompt first"
              : "Suggest external sources for this topic"
          }
          className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Suggesting…" : "Suggest from web"}
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-red-400/90" data-suggest-external-context-error>
          {error}
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul
          className="max-h-40 space-y-1 overflow-y-auto"
          data-suggest-external-context-list
        >
          {suggestions.map((s) => (
            <li
              key={s.key}
              className="rounded-md border border-neutral-800 bg-neutral-900/50 px-2 py-1.5"
              data-suggest-external-context-item={s.key}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-neutral-100">
                    {s.title}
                  </p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[10px] text-neutral-300/80 hover:underline"
                  >
                    {s.url}
                  </a>
                  {s.rationale || s.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-neutral-500">
                      {s.rationale || s.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  data-suggest-external-context-accept={s.key}
                  disabled={Boolean(acceptingKey) || disabled}
                  onClick={() => void acceptOne(s)}
                  className="shrink-0 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
                >
                  {acceptingKey === s.key ? "…" : "Attach"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
