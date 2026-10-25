"use client";

import { useEffect, useState } from "react";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import { MultiBlockDagCanvas } from "@/components/MultiBlockDagCanvas";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { normalizeSuggestDagResponse } from "@/lib/suggest-dag";
import {
  draftMultiBlockDag,
  MULTI_BLOCK_DAG_MAX_BLOCKS,
  multiBlockDagEdgeCounts,
  multiBlockDagHasCycle,
  multiBlockDagSelectionTooLarge,
  setMultiBlockDagEdge,
  type MultiBlockDagDraft,
} from "@/lib/multi-block-dag";
import type { CombineBlockRef } from "@/components/WorkspaceCombineBlocksPane";

export function DagBlocksDrawer({
  selected,
  nodes,
  blockIds,
  busy,
  selectionKey,
  workspaceId,
  ayclToken,
  onApplyDag,
}: {
  selected: CombineBlockRef[];
  nodes: CombineBlockRef[];
  blockIds: string[];
  busy: boolean;
  selectionKey: string;
  workspaceId?: string;
  ayclToken?: string;
  onApplyDag?: (input: {
    blockIds: string[];
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void> | void;
}) {
  const [dagDraft, setDagDraft] = useState<MultiBlockDagDraft>(() =>
    draftMultiBlockDag(blockIds, nodes),
  );
  const [dagSubmitting, setDagSubmitting] = useState(false);
  const [dagSuggesting, setDagSuggesting] = useState(false);
  const [dagError, setDagError] = useState<string | null>(null);

  useEffect(() => {
    setDagDraft(draftMultiBlockDag(blockIds, nodes));
    setDagError(null);
    setDagSuggesting(false);
  }, [selectionKey, blockIds, nodes]);

  const dagCounts = multiBlockDagEdgeCounts(dagDraft);
  const dagHasCycle = multiBlockDagHasCycle(dagDraft, "next");
  const dagTooManyBlocks = multiBlockDagSelectionTooLarge(selected.length);

  const submitDag = async () => {
    if (!onApplyDag || dagSubmitting || dagSuggesting || busy || selected.length < 2) return;
    setDagSubmitting(true);
    setDagError(null);
    try {
      await onApplyDag({
        blockIds: selected.map((n) => n.id),
        dagDraft,
      });
    } catch (err) {
      setDagError(err instanceof Error ? err.message : "Failed to apply DAG");
    } finally {
      setDagSubmitting(false);
    }
  };

  const suggestDag = async () => {
    if (
      !workspaceId ||
      dagSuggesting ||
      dagSubmitting ||
      busy ||
      selected.length < 2 ||
      dagTooManyBlocks
    ) {
      return;
    }
    setDagSuggesting(true);
    setDagError(null);
    const ids = selected.map((n) => n.id);
    try {
      const res = await fetch("/api/workspace/suggest-dag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          blockIds: ids,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        draft?: unknown;
      };
      if (!res.ok) {
        throw new Error(errorMessageFromBody(data, "Failed to suggest DAG"));
      }
      setDagDraft(normalizeSuggestDagResponse(data, ids, selected));
    } catch (err) {
      setDagError(err instanceof Error ? err.message : "Failed to suggest DAG");
    } finally {
      setDagSuggesting(false);
    }
  };

  const toggleDagEdge = (
    from: string,
    to: string,
    _kind: "next" | "lock",
    enabled: boolean,
  ) => {
    setDagDraft((prev) =>
      setMultiBlockDagEdge(prev, { from, to, kind: "next" }, enabled),
    );
  };

  return (
    <WorkspaceRightPaneDrawer
      variant="section"
      drawerId="dag"
      title="DAG"
      defaultExpanded={false}
      bodyClassName="space-y-3"
      surfaceDataAttr="data-multi-block-dag-drawer"
    >
      <div
        data-multi-block-dag-pane
        data-dag-edge-count={dagCounts.total}
        data-dag-next-count={dagCounts.next}
        data-dag-lock-count={dagCounts.lock}
        data-dag-max-blocks={MULTI_BLOCK_DAG_MAX_BLOCKS}
        data-dag-too-many={dagTooManyBlocks ? "true" : "false"}
        className="space-y-3"
      >
        {dagTooManyBlocks ? (
          <p
            className="rounded-none border border-white/15 bg-white/[0.04] px-3 py-3 text-[12px] leading-relaxed text-neutral-200"
            data-dag-too-many-message
          >
            You can only have {MULTI_BLOCK_DAG_MAX_BLOCKS} blocks selected at
            once
          </p>
        ) : (
          <>
            <MultiBlockDagCanvas
              blocks={selected.map((b) => ({
                id: b.id,
                title: b.title || "Untitled",
                position_x: b.position_x,
                position_y: b.position_y,
              }))}
              draft={dagDraft}
              disabled={busy || dagSubmitting || dagSuggesting}
              onToggleEdge={toggleDagEdge}
            />

            {dagHasCycle ? (
              <p
                className="rounded-none border border-neutral-600/30 bg-neutral-950/30 px-2.5 py-2 text-[11px] text-neutral-300/90"
                data-dag-cycle-warning
              >
                Draft has a directed cycle. You can still Apply; prefer
                acyclic journeys when order matters.
              </p>
            ) : null}

            {dagError ? (
              <p className="text-xs text-red-400/90" data-dag-error>
                {dagError}
              </p>
            ) : null}

            <button
              type="button"
              data-dag-suggest
              disabled={
                busy ||
                dagSubmitting ||
                dagSuggesting ||
                selected.length < 2 ||
                dagTooManyBlocks ||
                !workspaceId
              }
              onClick={() => void suggestDag()}
              className="w-full rounded-none border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dagSuggesting ? "Suggesting…" : "Suggest DAG"}
            </button>
            <button
              type="button"
              data-dag-apply
              disabled={
                busy ||
                dagSubmitting ||
                dagSuggesting ||
                selected.length < 2 ||
                !onApplyDag
              }
              onClick={() => void submitDag()}
              className="w-full rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {dagSubmitting ? "Applying…" : "Apply"}
            </button>
          </>
        )}
      </div>
    </WorkspaceRightPaneDrawer>
  );
}
