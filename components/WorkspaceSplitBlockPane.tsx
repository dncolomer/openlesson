"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import {
  blockOffersSplitDrawer,
  splitTargetCellCount,
  type SplitCandidateBlock,
} from "@/lib/workspace-right-pane";

/**
 * Split drawer body (combine-equivalent): one broader multi-cell block → focused
 * 1×1 pieces, with an optional splitting prompt → grid-ops split.
 */
export function WorkspaceSplitBlockPane({
  block,
  busy = false,
  onSplit,
  labels,
}: {
  block: SplitCandidateBlock & {
    id: string;
    title?: string | null;
    description?: string | null;
  };
  busy?: boolean;
  onSplit: (input: { blockId: string; prompt?: string }) => Promise<void> | void;
  labels?: {
    split?: string;
    promptPlaceholder?: string;
  };
}) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt("");
    setError(null);
  }, [block.id]);

  const canSplit = blockOffersSplitDrawer(block);
  const cellCount = useMemo(() => splitTargetCellCount(block), [block]);
  const resultSlots = Math.max(2, Math.min(cellCount, 6));

  const submit = async () => {
    if (submitting || busy || !canSplit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSplit({
        blockId: block.id,
        prompt: prompt.trim() || undefined,
      });
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to split block");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-workspace-split-block-pane
      data-split-block-id={block.id}
      data-split-available={canSplit ? "true" : "false"}
      data-split-cell-count={cellCount}
      className="space-y-3"
    >
      <p className="text-[11px] leading-relaxed text-neutral-400">
        Split this{" "}
        <span className="text-neutral-200">broader multi-cell block</span> into{" "}
        <span className="text-neutral-200">more focused 1×1 pieces</span>. Each
        result covers a narrower slice of the same topic — useful after a merge
        when you want lectures that stand alone again.
      </p>

      <div
        className="rounded-lg border border-white/10 bg-neutral-950/70 p-2"
        data-split-visual
        data-split-layout="stack"
      >
        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-600">
          Source
        </p>
        <div
          className="rounded-md border border-white/25 bg-white/[0.07] px-2.5 py-2.5"
          data-split-source-card
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            1 broader block
          </p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-white line-clamp-2">
            {block.title?.trim() || "Untitled"}
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-500">
            {cellCount} cell{cellCount === 1 ? "" : "s"} on the map
          </p>
        </div>

        <div
          className="my-1.5 flex flex-col items-center gap-0.5"
          data-split-arrow
          aria-hidden
        >
          <span className="h-3 w-px bg-white/20" />
          <span className="text-[10px] text-neutral-500">↓</span>
        </div>

        <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-600">
          Result · {cellCount} focused block{cellCount === 1 ? "" : "s"}
        </p>
        <ul className="space-y-1.5" data-split-result-list>
          {Array.from({ length: resultSlots }, (_, i) => {
            const marker = String.fromCharCode(65 + (i % 26));
            const isOverflowHint = cellCount > 6 && i === resultSlots - 1;
            return (
              <li key={i} className="relative">
                {i > 0 ? (
                  <div
                    className="flex items-center justify-center py-0.5"
                    data-split-plus
                    aria-hidden
                  >
                    <span className="text-sm font-semibold leading-none text-neutral-500">
                      +
                    </span>
                  </div>
                ) : null}
                <div
                  className="flex min-w-0 items-start gap-2.5 rounded-md border border-white/15 bg-neutral-900/90 px-2.5 py-2"
                  data-split-result-slot={i}
                >
                  <span className="mt-0.5 shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-400">
                    {marker}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-neutral-300">
                    {isOverflowHint
                      ? `…and ${cellCount - (resultSlots - 1)} more 1×1 pieces`
                      : `Focused piece ${i + 1}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!canSplit ? (
        <p
          className="rounded-md border border-neutral-600/30 bg-neutral-950/30 px-2.5 py-2 text-[11px] leading-snug text-neutral-300/90"
          data-split-not-available
        >
          This block is already a single cell — there is nothing to split. Merge
          blocks first if you want a broader footprint to decompose.
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Splitting prompt
        </span>
        <textarea
          data-split-prompt
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={busy || submitting || !canSplit}
          placeholder={
            labels?.promptPlaceholder ||
            "Optional guidance for the split (e.g. how to name the focused pieces)…"
          }
          className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
      </label>

      {error ? (
        <p className="text-xs text-red-400/90" data-split-error>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-split-submit
        disabled={busy || submitting || !canSplit}
        onClick={() => void submit()}
        className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {submitting || busy
          ? "Splitting…"
          : labels?.split || "Split into focused blocks"}
      </button>
    </div>
  );
}
