"use client";

import { useEffect, useState } from "react";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import type { CombineBlockRef } from "@/components/WorkspaceCombineBlocksPane";

export function CombineBlocksDrawer({
  selected,
  contiguous,
  busy,
  selectionKey,
  onCombine,
  onCancel,
  labels,
}: {
  selected: CombineBlockRef[];
  contiguous: boolean;
  busy: boolean;
  selectionKey: string;
  onCombine: (input: {
    blockIds: string[];
    prompt?: string;
  }) => Promise<void> | void;
  onCancel: () => void;
  labels?: {
    combine?: string;
    cancel?: string;
    promptPlaceholder?: string;
  };
}) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt("");
    setError(null);
  }, [selectionKey, selected]);

  const submit = async () => {
    if (submitting || busy || selected.length < 2 || !contiguous) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCombine({
        blockIds: selected.map((n) => n.id),
        prompt: prompt.trim() || undefined,
      });
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to combine blocks");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawer
      variant="section"
      drawerId="combine"
      title="Combine blocks"
      // Contiguous group → Combine is the primary action; gaps → Bridge first.
      defaultExpanded={contiguous}
      bodyClassName="space-y-3"
    >
      {/*
        Single-column merge diagram — never wraps in the narrow right pane.
        Stack of compact rows with + separators → result strip.
      */}
      <div
        className="rounded-none border border-white/10 bg-neutral-950/70 p-2"
        data-combine-visual
        data-combine-layout="stack"
      >
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-600">
          {selected.length} selected
        </p>
        <ul className="space-y-0" data-combine-source-list>
          {selected.map((block, index) => {
            const marker = String.fromCharCode(65 + (index % 26));
            return (
              <li key={block.id} className="relative">
                {index > 0 ? (
                  <div
                    className="flex items-center justify-center py-1"
                    data-combine-plus
                    aria-hidden
                  >
                    <span className="text-sm font-semibold leading-none text-neutral-400">
                      +
                    </span>
                  </div>
                ) : null}
                <div
                  className="flex min-w-0 items-start gap-2.5 rounded-none border border-white/15 bg-neutral-900/90 px-2.5 py-2.5"
                  data-combine-block-card={block.id}
                  data-combine-marker={marker}
                >
                  <span className="mt-0.5 shrink-0 rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-400">
                    {marker}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-neutral-100 line-clamp-2">
                    {block.title || "Untitled"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className="my-1.5 flex flex-col items-center gap-0.5"
          data-combine-arrow
          aria-hidden
        >
          <span className="h-3 w-px bg-white/20" />
          <span className="text-[10px] text-neutral-500">↓</span>
        </div>

        <div
          className="rounded-none border border-white/25 bg-white/[0.07] px-2.5 py-2 text-center"
          data-combine-result
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            Result
          </p>
          <p
            className="mt-0.5 text-[12px] font-semibold leading-snug text-white"
            data-combine-result-hint
          >
            1 broader block
          </p>
        </div>
      </div>

      {!contiguous ? (
        <p
          className="rounded-none border border-neutral-600/30 bg-neutral-950/30 px-2.5 py-2 text-[11px] leading-snug text-neutral-300/90"
          data-combine-not-contiguous
        >
          Selected blocks must share edges (be contiguous on the map) before they
          can combine. Adjust the selection so every block touches the group.
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Combination prompt
        </span>
        <textarea
          data-combine-prompt
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={busy || submitting}
          placeholder={
            labels?.promptPlaceholder ||
            "Optional guidance for the merged topic (e.g. how to unify the lessons)…"
          }
          className="w-full resize-none rounded-none border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>

      {error ? (
        <p className="text-xs text-red-400/90" data-combine-error>
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          data-combine-cancel
          disabled={busy || submitting}
          onClick={onCancel}
          className="flex-1 rounded-none border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
        >
          {labels?.cancel || "Cancel"}
        </button>
        <button
          type="button"
          data-combine-submit
          disabled={
            busy || submitting || selected.length < 2 || !contiguous
          }
          onClick={() => void submit()}
          className="flex-1 rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {submitting || busy
            ? "Combining…"
            : labels?.combine || "Combine into one block"}
        </button>
      </div>
    </WorkspaceRightPaneDrawer>
  );
}
