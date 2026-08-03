"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSkillGridLayout,
  formatGridCoordinate,
  getWeightedNeighborhood,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import {
  ADD_DENSITY_MAX,
  ADD_RANGE_MAX,
  ADD_RANGE_MIN,
  nextRandomizeSeed,
  resolveAddExpandSelection,
  snapshotAddExpandSlots,
} from "@/lib/add-block-range-density";
import {
  buildShapeContextSourceOptions,
  toggleShapeContextSelection,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
} from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceSuggestExternalContext } from "@/components/WorkspaceSuggestExternalContext";
import { DEFAULT_MODEL } from "@/lib/xai-models";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

/**
 * Options for multi-slot expand create.
 * Host enqueues a background job (progress under minimap); this pane only
 * snapshots slots at submit — it does not own progress/stop.
 */
export type WorkspaceAddBlockSubmitOpts = {
  contextSourceKeys?: string[];
  /**
   * Additional placeable cells for individual 1×1 creates (not shape merge).
   * Snapshot taken at submit — host must not re-sample mid-run.
   */
  expandCells?: WorkspaceAddTargetCell[];
  /** Full ordered slot list (center first); host freezes this into a job. */
  frozenSlots?: WorkspaceAddTargetCell[];
  /** Author flag: treat created block(s) as potential starter(s). */
  isStart?: boolean;
};

/**
 * Right-column Add block form for a single empty placeable cell.
 * Range/Density expand a circle of placeable empties for multi 1×1 create
 * (cold-start) — not generate-in-shape.
 */
export function WorkspaceAddBlockPane({
  cell,
  nodes,
  workspaceId,
  ayclToken,
  locale = "en",
  busy = false,
  workspaceNotes = null,
  unusableCells = null,
  onSubmit,
  onCancel,
  onExpandPreviewChange,
  labels,
}: {
  cell: WorkspaceAddTargetCell;
  nodes: SkillGridNode[];
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  busy?: boolean;
  workspaceNotes?: string | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
  onSubmit: (
    prompt: string,
    position: WorkspaceAddTargetCell,
    opts?: WorkspaceAddBlockSubmitOpts,
  ) => Promise<void>;
  onCancel: () => void;
  /** Lift active expand selection so the map can highlight candidates. */
  onExpandPreviewChange?: (cells: WorkspaceAddTargetCell[] | null) => void;
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
  const [range, setRange] = useState(0);
  const [density, setDensity] = useState(ADD_DENSITY_MAX);
  const [sampleSeed, setSampleSeed] = useState(1);
  const [isStarter, setIsStarter] = useState(false);

  // Reset draft when the target cell changes.
  useEffect(() => {
    setPrompt("");
    setSuggestions([]);
    setSuggestError(null);
    setAddError(null);
    setContextSelected([]);
    setRange(0);
    setDensity(ADD_DENSITY_MAX);
    setSampleSeed(1);
    setIsStarter(false);
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
  const { placements, occupancy } = useMemo(
    () => buildSkillGridLayout(nodes),
    [nodes],
  );
  const occupiedKeys = useMemo(
    () => new Set(occupancy.keys()),
    [occupancy],
  );
  const unusableKeys = useMemo(
    () =>
      new Set(
        (unusableCells || []).map((c) => `${c.row}:${c.col}`),
      ),
    [unusableCells],
  );

  // Live expand for the draft form only — host freezes membership when a job starts.
  const expandSelection = useMemo(
    () =>
      resolveAddExpandSelection({
        center: { row: cell.row, col: cell.col },
        range,
        density,
        seed: sampleSeed,
        occupiedKeys,
        unusableKeys,
      }),
    [cell.col, cell.row, density, occupiedKeys, range, sampleSeed, unusableKeys],
  );

  // Lift expand highlight for draft Range/Density (host jobs use their own previews).
  // Use a content key + callback ref so parent re-renders / new array identities
  // do not cause setState → re-render → effect loops (max update depth).
  const onExpandPreviewChangeRef = useRef(onExpandPreviewChange);
  onExpandPreviewChangeRef.current = onExpandPreviewChange;
  const expandPreviewKey = useMemo(
    () => expandSelection.selected.map((c) => `${c.row}:${c.col}`).join(","),
    [expandSelection.selected],
  );
  useEffect(() => {
    const cb = onExpandPreviewChangeRef.current;
    if (!cb) return;
    if (!expandPreviewKey) {
      cb(null);
      return;
    }
    cb(
      expandPreviewKey.split(",").map((pair) => {
        const [row, col] = pair.split(":").map(Number);
        return { row, col };
      }),
    );
  }, [expandPreviewKey]);
  useEffect(() => {
    return () => {
      onExpandPreviewChangeRef.current?.(null);
    };
  }, []);

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
  const densityIsMax = density >= ADD_DENSITY_MAX;
  const cellsToCreate = expandSelection.selected;

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
    // Snapshot membership at submit — host freezes into a background job.
    const slots = snapshotAddExpandSlots({
      center: { row: cell.row, col: cell.col },
      selected: cellsToCreate,
    });
    try {
      const expandCells =
        slots.length > 1
          ? slots.filter((c) => !(c.row === cell.row && c.col === cell.col))
          : undefined;
      // Host enqueues async job and returns quickly — map stays interactive.
      await onSubmit(prompt.trim(), cell, {
        contextSourceKeys:
          contextSelected.length > 0 ? [...contextSelected] : undefined,
        expandCells,
        frozenSlots: slots,
        isStart: isStarter,
      });
      setPrompt("");
      setSuggestions([]);
      setContextSelected([]);
      setRange(0);
      setDensity(ADD_DENSITY_MAX);
      setSampleSeed(1);
      setIsStarter(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId="add"
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
      data-workspace-right-pane="add_block"
      data-workspace-add-block-pane="true"
      data-add-target-row={String(cell.row)}
      data-add-target-col={String(cell.col)}
    >
      {/* Primary form drawer — top-anchored, full width */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="add"
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

        {/* Cold-start multi 1×1: Range = circle radius; Density = how many cells */}
        <div
          className="space-y-2.5 rounded-lg border border-neutral-800 bg-neutral-950/60 p-2.5"
          data-add-expand-controls
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Expand around this cell
          </p>
          <p className="text-[10px] leading-snug text-neutral-600">
            Places separate 1×1 blocks (not one multi-cell shape). Use Range for
            neighborhood size and Density for how many slots fill.
          </p>

          <label className="block space-y-1" data-add-range>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">Range</span>
              <span className="font-mono text-[10px] text-neutral-500">
                {range}
              </span>
            </div>
            <input
              type="range"
              min={ADD_RANGE_MIN}
              max={ADD_RANGE_MAX}
              step={1}
              value={range}
              disabled={busy || submitting}
              onChange={(e) => setRange(Number(e.target.value))}
              className="w-full accent-white"
              data-add-range-input
            />
          </label>

          <label className="block space-y-1" data-add-density>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">Density</span>
              <span className="font-mono text-[10px] text-neutral-500">
                {density}% · {cellsToCreate.length}/
                {expandSelection.candidates.length} cells
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={ADD_DENSITY_MAX}
              step={5}
              value={density}
              disabled={
                busy || submitting || expandSelection.candidates.length <= 1
              }
              onChange={(e) => setDensity(Number(e.target.value))}
              className="w-full accent-white"
              data-add-density-input
            />
          </label>

          <button
            type="button"
            data-add-randomize
            disabled={
              busy ||
              submitting ||
              densityIsMax ||
              expandSelection.candidates.length <= 1
            }
            onClick={() => setSampleSeed((s) => nextRandomizeSeed(s))}
            className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Randomize selection
          </button>
          <p className="text-[10px] leading-snug text-neutral-600">
            Multi-create runs in the background — progress and Stop appear under
            the minimap so you can keep editing the map.
          </p>
        </div>

        <label
          className="flex cursor-pointer items-start gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2.5 py-2"
          data-add-block-starter
        >
          <input
            type="checkbox"
            data-add-block-starter-input
            checked={isStarter}
            disabled={busy || submitting}
            onChange={(e) => setIsStarter(e.target.checked)}
            className="mt-0.5"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-neutral-200">
              Starter block
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-neutral-500">
              Flag created block(s) as potential starts for learning paths.
            </span>
          </span>
        </label>

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
            {submitting
              ? "Starting…"
              : cellsToCreate.length > 1
                ? `Create ${cellsToCreate.length} blocks`
                : labels.addSubmit}
          </button>
        </div>
      </WorkspaceRightPaneDrawer>

      {/* Local context — sibling top-level drawer; accordion with Add */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="local"
        title="Local context"
        defaultExpanded={false}
        surfaceDataAttr="data-add-block-context-picker"
        bodyClassName="space-y-2"
      >
        <div data-shape-context-picker className="space-y-2">
          <p className="text-[10px] leading-relaxed text-neutral-600">
            Selected files, external links, and notes become local context on the new block and
            feed generation.
          </p>
          <WorkspaceSuggestExternalContext
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            topic={prompt}
            disabled={busy || submitting}
            selectedKeys={contextSelected}
            options={contextOptions}
            onChange={({ options, selectedKeys }) => {
              setContextOptions(options);
              setContextSelected(selectedKeys);
            }}
          />
          {contextLoading ? (
            <p className="text-[11px] text-neutral-600" data-shape-context-loading>
              Loading sources…
            </p>
          ) : contextOptions.length === 0 ? (
            <p className="text-[11px] text-neutral-600">
              No Context sources yet — add files or links under the Context tab, or suggest
              from the web above.
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
    </WorkspaceRightPaneDrawerGroup>
  );
}

