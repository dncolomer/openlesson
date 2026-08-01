"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSkillGridLayout,
  formatGridCoordinate,
  getWeightedNeighborhood,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import {
  buildShapeContextSourceOptions,
  toggleShapeContextSelection,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import { DEFAULT_MODEL } from "@/lib/xai-models";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

/**
 * Right-column Add block form for a single empty placeable cell.
 * Includes the same local-context / context-sources attach as multi-cell create.
 */
export function WorkspaceAddBlockPane({
  cell,
  nodes,
  workspaceId,
  ayclToken,
  locale = "en",
  busy = false,
  workspaceNotes = null,
  onSubmit,
  onCancel,
  labels,
}: {
  cell: WorkspaceAddTargetCell;
  nodes: SkillGridNode[];
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  busy?: boolean;
  workspaceNotes?: string | null;
  onSubmit: (
    prompt: string,
    position: WorkspaceAddTargetCell,
    opts?: { contextSourceKeys?: string[] },
  ) => Promise<void>;
  onCancel: () => void;
  labels: {
    addTitle: string;
    addPlaceholder: string;
    addSubmit: string;
    addCancel: string;
    suggestTopics: string;
    suggesting: string;
    suggestError: string;
  };
}) {
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contextOptions, setContextOptions] = useState<ShapeContextSourceOption[]>([]);
  const [contextSelected, setContextSelected] = useState<string[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  // Reset draft when the target cell changes.
  useEffect(() => {
    setPrompt("");
    setSuggestions([]);
    setSuggestError(null);
    setAddError(null);
    setContextSelected([]);
  }, [cell.row, cell.col]);

  // Load Context inventory for local-context attach (same catalog as generate-in-shape).
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setContextLoading(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({ workspaceId });
        if (ayclToken) qs.set("ayclToken", ayclToken);
        const [filesRes, extRes] = await Promise.all([
          fetch(`/api/workspace/files?workspaceId=${encodeURIComponent(workspaceId)}`),
          fetch(`/api/workspace/external-resources?${qs}`),
        ]);
        const filesData = (await filesRes.json().catch(() => ({}))) as {
          files?: Array<{ id?: string; file_name?: string }>;
        };
        const extData = (await extRes.json().catch(() => ({}))) as {
          resources?: Array<{
            id: string;
            title?: string | null;
            url?: string | null;
            description?: string | null;
          }>;
        };
        if (cancelled) return;
        setContextOptions(
          buildShapeContextSourceOptions({
            notes: workspaceNotes ?? "",
            files: filesData.files || [],
            externalResources: extData.resources || [],
          }),
        );
      } catch {
        if (!cancelled) setContextOptions([]);
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ayclToken, workspaceId, workspaceNotes]);

  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );
  const { placements } = useMemo(() => buildSkillGridLayout(nodes), [nodes]);
  const weightedNeighbors = useMemo(
    () =>
      getWeightedNeighborhood(
        { row: cell.row, col: cell.col },
        placements,
        nodesById,
      ),
    [cell.col, cell.row, nodesById, placements],
  );

  const canSuggest = Boolean(workspaceId);

  const handleSuggest = useCallback(async () => {
    if (!canSuggest || isSuggesting || !workspaceId) return;
    setIsSuggesting(true);
    setSuggestError(null);
    try {
      const savedModel =
        typeof window !== "undefined"
          ? window.localStorage.getItem(MODEL_STORAGE_KEY)?.replace(/^x-ai\//, "")
          : null;
      const model = savedModel || DEFAULT_PLANNER_MODEL;
      const response = await fetch("/api/workspace/suggest-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mode: "block",
          row: cell.row,
          col: cell.col,
          weightedNeighbors,
          model,
          locale,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || labels.suggestError);
      }
      const data = (await response.json()) as { suggestions?: string[] };
      setSuggestions((data.suggestions || []).filter(Boolean).slice(0, 3));
    } catch (error) {
      console.error("Failed to suggest block topics:", error);
      setSuggestions([]);
      setSuggestError(error instanceof Error ? error.message : labels.suggestError);
    } finally {
      setIsSuggesting(false);
    }
  }, [
    ayclToken,
    canSuggest,
    cell.col,
    cell.row,
    isSuggesting,
    labels.suggestError,
    locale,
    weightedNeighbors,
    workspaceId,
  ]);

  const handleSubmit = async () => {
    if (!prompt.trim() || busy || submitting) return;
    setSubmitting(true);
    setAddError(null);
    try {
      await onSubmit(prompt.trim(), cell, {
        contextSourceKeys: contextSelected.length > 0 ? [...contextSelected] : undefined,
      });
      setPrompt("");
      setSuggestions([]);
      setContextSelected([]);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  const contextSubtitle =
    contextSelected.length > 0
      ? `${contextSelected.length} source${contextSelected.length === 1 ? "" : "s"} selected`
      : contextLoading
        ? "Loading…"
        : undefined;

  return (
    <div
      data-workspace-right-pane="add_block"
      data-workspace-add-block-pane
      data-add-target-row={cell.row}
      data-add-target-col={cell.col}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      {/* Primary form drawer — top-anchored, full width */}
      <WorkspaceRightPaneDrawer
        variant="section"
        title={labels.addTitle}
        defaultExpanded
        bodyClassName="space-y-3"
      >
        {weightedNeighbors.length > 0 && (
          <div data-add-block-neighbors>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Influenced by
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {weightedNeighbors.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  title={entry.title}
                  className="rounded-lg border border-neutral-700/80 bg-neutral-900/70 px-2 py-1.5"
                >
                  <span className="font-mono text-[9px] text-neutral-500">
                    {formatGridCoordinate(entry.row, entry.col)}
                    <span className="text-neutral-600"> · d{entry.distance}</span>
                  </span>
                  <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-neutral-200">
                    {entry.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-add-block-suggest
            disabled={!canSuggest || isSuggesting || busy || submitting}
            onClick={() => void handleSuggest()}
            className="rounded-md border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
          >
            {isSuggesting ? labels.suggesting : labels.suggestTopics}
          </button>
        </div>

        {suggestError && (
          <p className="text-xs text-red-400/90" data-add-block-suggest-error>
            {suggestError}
          </p>
        )}
        {addError && (
          <p className="text-xs text-red-400/90" data-add-block-error>
            {addError}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5" data-add-block-suggestions>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="rounded-md border border-neutral-700/80 bg-neutral-900/60 px-2.5 py-2 text-left text-xs text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <textarea
          data-add-block-prompt
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={labels.addPlaceholder}
          className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          rows={4}
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-add-block-cancel
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
          >
            {labels.addCancel}
          </button>
          <button
            type="button"
            data-add-block-submit
            disabled={!prompt.trim() || busy || submitting}
            onClick={() => void handleSubmit()}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
          >
            {busy || submitting ? "..." : labels.addSubmit}
          </button>
        </div>
      </WorkspaceRightPaneDrawer>

      {/* Local context — sibling top-level drawer, collapsed by default */}
      <WorkspaceRightPaneDrawer
        variant="section"
        title="Local context"
        subtitle={contextSubtitle}
        defaultExpanded={false}
        surfaceDataAttr="data-add-block-context-picker"
        bodyClassName="space-y-2"
      >
        <div data-shape-context-picker className="space-y-2">
          <p className="text-[10px] leading-relaxed text-neutral-600">
            Selected files, external links, and notes become local context on the new block and
            feed generation.
          </p>
          {contextLoading ? (
            <p className="text-[11px] text-neutral-600" data-shape-context-loading>
              Loading sources…
            </p>
          ) : contextOptions.length === 0 ? (
            <p className="text-[11px] text-neutral-600">
              No Context sources yet — add files or links under the Context tab.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto" data-shape-context-list>
              {contextOptions.map((opt) => {
                const checked = contextSelected.includes(opt.key);
                return (
                  <li key={opt.key}>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[11px] transition ${
                        checked
                          ? "border-white/30 bg-white/10 text-neutral-100"
                          : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600"
                      }`}
                      data-shape-context-option={opt.key}
                      data-shape-context-kind={opt.kind}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() =>
                          setContextSelected((prev) =>
                            toggleShapeContextSelection(prev, opt.key),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{opt.label}</span>
                        <span className="block text-[10px] uppercase tracking-wide text-neutral-600">
                          {opt.kind}
                          {opt.url ? ` · link` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {contextSelected.length > 0 ? (
            <p className="text-[10px] text-neutral-500" data-shape-context-selected-count>
              {contextSelected.length} selected
            </p>
          ) : null}
        </div>
      </WorkspaceRightPaneDrawer>
    </div>
  );
}
