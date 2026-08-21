"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSkillGridLayout,
  getWeightedNeighborhood,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  footprintFromCells,
  selectionIsFreeformLectureShape,
} from "@/lib/skill-grid-ops";
import type { WorkspaceAddTargetCell } from "@/lib/workspace-right-pane";
import {
  buildShapeContextSourceOptions,
  toggleShapeContextSelection,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import { WorkspaceSuggestExternalContext } from "@/components/WorkspaceSuggestExternalContext";
import {
  WorkspacePromptContextAlternatives,
  type PromptContextMode,
} from "@/components/WorkspacePromptContextAlternatives";
import { DEFAULT_MODEL } from "@/lib/xai-models";

const MODEL_STORAGE_KEY = "planner-model";
const DEFAULT_PLANNER_MODEL = DEFAULT_MODEL;

/**
 * Right-column multi-empty create form (generate-in-shape).
 * Opens automatically when 2+ placeable empties are multi-selected — no toolbar button.
 */
export function WorkspaceGenerateShapePane({
  cells,
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
  cells: readonly WorkspaceAddTargetCell[];
  nodes: SkillGridNode[];
  workspaceId?: string;
  ayclToken?: string;
  locale?: string;
  busy?: boolean;
  workspaceNotes?: string | null;
  onSubmit: (payload: {
    prompt: string;
    cells: WorkspaceAddTargetCell[];
    contextSourceKeys?: string[];
    isStart?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  labels: {
    generateShape?: string;
    addPlaceholder: string;
    addSubmit: string;
    addCancel: string;
    suggestTopics: string;
    suggesting: string;
    suggestError: string;
  };
}) {
  const [prompt, setPrompt] = useState("");
  const [contextMode, setContextMode] = useState<PromptContextMode>("adhoc");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contextOptions, setContextOptions] = useState<ShapeContextSourceOption[]>([]);
  const [contextSelected, setContextSelected] = useState<string[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [isStarter, setIsStarter] = useState(false);

  const cellKey = cells.map((c) => `${c.row}:${c.col}`).join(",");

  useEffect(() => {
    setPrompt("");
    setSuggestions([]);
    setSuggestError(null);
    setAddError(null);
    setContextSelected([]);
    setIsStarter(false);
  }, [cellKey]);

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

  const shapeFootprint = useMemo(
    () => (cells.length > 0 ? footprintFromCells([...cells]) : null),
    [cells],
  );
  const shapeFreeform = useMemo(
    () => selectionIsFreeformLectureShape([...cells]),
    [cells],
  );

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const { placements } = useMemo(() => buildSkillGridLayout(nodes), [nodes]);
  const weightedNeighbors = useMemo(() => {
    if (!shapeFootprint) return [];
    return getWeightedNeighborhood(
      { row: shapeFootprint.position_y, col: shapeFootprint.position_x },
      placements,
      nodesById,
    );
  }, [nodesById, placements, shapeFootprint]);

  const canSuggest = Boolean(workspaceId);

  const handleSuggest = useCallback(async () => {
    if (!canSuggest || isSuggesting || !workspaceId || !shapeFootprint || !shapeFreeform.ok) {
      return;
    }
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
          row: shapeFootprint.position_y,
          col: shapeFootprint.position_x,
          weightedNeighbors,
          model,
          locale,
          shape: true,
          span_w: shapeFootprint.span_w,
          span_h: shapeFootprint.span_h,
          cells,
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
      console.error("Failed to suggest shape topics:", error);
      setSuggestions([]);
      setSuggestError(error instanceof Error ? error.message : labels.suggestError);
    } finally {
      setIsSuggesting(false);
    }
  }, [
    ayclToken,
    canSuggest,
    cells,
    isSuggesting,
    labels.suggestError,
    locale,
    shapeFootprint,
    shapeFreeform.ok,
    weightedNeighbors,
    workspaceId,
  ]);

  const handleSubmit = async () => {
    if (!prompt.trim() || busy || submitting) return;
    if (!shapeFreeform.ok) {
      setAddError(
        "Select a contiguous region of empty cells (edge-connected). Any shape is allowed.",
      );
      return;
    }
    setSubmitting(true);
    setAddError(null);
    try {
      await onSubmit({
        prompt: prompt.trim(),
        cells: cells.map((c) => ({ row: c.row, col: c.col })),
        contextSourceKeys: contextSelected.length > 0 ? [...contextSelected] : undefined,
        isStart: isStarter,
      });
      setPrompt("");
      setSuggestions([]);
      setContextSelected([]);
      setIsStarter(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to generate block");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawer
      paneKind="generate_shape"
      surfaceDataAttr="data-workspace-generate-shape-pane"
      title={labels.generateShape || "Generate block in shape"}
      bodyClassName="space-y-3"
    >
      <div
        data-generate-shape-dialog
        data-selected-empty-count={cells.length}
        className="space-y-3"
      >
        {!shapeFreeform.ok && shapeFootprint ? (
          <p className="text-[11px] text-neutral-300/90" data-shape-not-contiguous>
            Select edge-connected cells only.
          </p>
        ) : null}

        <div className="mb-1 flex items-center justify-between gap-2 pb-1">
          <button
            type="button"
            data-suggest-shape-topics
            disabled={
              !canSuggest || isSuggesting || busy || submitting || !shapeFootprint || !shapeFreeform.ok
            }
            onClick={() => void handleSuggest()}
            className="rounded-none border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
          >
            {isSuggesting ? labels.suggesting : labels.suggestTopics}
          </button>
        </div>

        {suggestError && (
          <p className="text-xs text-red-400/90" data-generate-shape-suggest-error>
            {suggestError}
          </p>
        )}
        {addError && (
          <p className="text-xs text-red-400/90" data-generate-shape-error>
            {addError}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5" data-shape-suggestions>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="rounded-none border border-neutral-700/80 bg-neutral-900/60 px-2.5 py-2 text-left text-xs text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div data-generate-shape-context-alternatives data-generative-context-alternatives>
          <WorkspacePromptContextAlternatives
            workspaceId={workspaceId}
            ayclToken={ayclToken}
            draftPrompt={prompt}
            surface="generate shape"
            mode={contextMode}
            onModeChange={setContextMode}
            adhocValue={prompt}
            onAdhocChange={setPrompt}
            onAccept={setPrompt}
            disabled={busy || submitting}
            adhocPlaceholder={labels.addPlaceholder}
            adhocLabel="Shape prompt"
            adhocInputDataAttr="data-generate-shape-prompt"
            adhocAutoFocus
          />
        </div>

        <div
          className="space-y-1.5 rounded-none border border-neutral-800 bg-neutral-950/80 p-2.5"
          data-shape-context-picker
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Attach context sources
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
            <p className="text-[11px] text-neutral-600">No sources yet</p>
          ) : (
            <ul className="max-h-36 space-y-1 overflow-y-auto" data-shape-context-list>
              {contextOptions.map((opt) => {
                const checked = contextSelected.includes(opt.key);
                return (
                  <li key={opt.key}>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-none border px-2 py-1.5 text-[11px] transition ${
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

        <label
          className="flex cursor-pointer items-start gap-2 rounded-none border border-neutral-800 bg-neutral-950/50 px-2.5 py-2"
          data-generate-shape-starter
        >
          <input
            type="checkbox"
            data-generate-shape-starter-input
            checked={isStarter}
            disabled={busy || submitting}
            onChange={(e) => setIsStarter(e.target.checked)}
            className="mt-0.5"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-neutral-200">
              Starter block
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-generate-shape-cancel
            onClick={onCancel}
            className="rounded-none px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
          >
            {labels.addCancel}
          </button>
          <button
            type="button"
            data-generate-shape-submit
            disabled={!prompt.trim() || busy || submitting || !shapeFreeform.ok}
            onClick={() => void handleSubmit()}
            className="rounded-none bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
          >
            {busy || submitting ? "..." : labels.addSubmit}
          </button>
        </div>
      </div>
    </WorkspaceRightPaneDrawer>
  );
}
