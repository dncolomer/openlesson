"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
} from "@/components/WorkspaceRightPaneDrawer";
import { UnusableGroundDrawer } from "@/components/UnusableGroundDrawer";
import { canPlaceOnMapGround } from "@/lib/map-ground-rules";
import { WorkspaceSuggestExternalContext } from "@/components/WorkspaceSuggestExternalContext";
import {
  WorkspacePromptContextAlternatives,
  type PromptContextMode,
} from "@/components/WorkspacePromptContextAlternatives";
/**
 * Right-column multi-empty create form (generate-in-shape).
 * Opens automatically when 2+ placeable empties are multi-selected — no toolbar button.
 */
export function WorkspaceGenerateShapePane({
  cells,
  workspaceId,
  ayclToken,
  busy = false,
  workspaceNotes = null,
  unusableCells = null,
  onSubmit,
  onCancel,
  onSetUnusableCells,
  labels,
}: {
  cells: readonly WorkspaceAddTargetCell[];
  workspaceId?: string;
  ayclToken?: string;
  busy?: boolean;
  workspaceNotes?: string | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
  onSubmit: (payload: {
    prompt: string;
    cells: WorkspaceAddTargetCell[];
    contextSourceKeys?: string[];
    isStart?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  /** Existing unusable-ground action for this pane's empty cells. */
  onSetUnusableCells?: (cells: Array<{ row: number; col: number }>) => Promise<void> | void;
  labels: {
    generateShape?: string;
    addPlaceholder: string;
    addSubmit: string;
    addCancel: string;
  };
}) {
  const [prompt, setPrompt] = useState("");
  const [contextMode, setContextMode] = useState<PromptContextMode>("adhoc");
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contextOptions, setContextOptions] = useState<ShapeContextSourceOption[]>([]);
  const [contextSelected, setContextSelected] = useState<string[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  const cellKey = cells.map((c) => `${c.row}:${c.col}`).join(",");

  useEffect(() => {
    setPrompt("");
    setAddError(null);
    setContextSelected([]);
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

  const submitBlockedByUnusable =
    canPlaceOnMapGround(cells, unusableCells || []).reason === "unusable";

  const handleSubmit = async () => {
    if (!prompt.trim() || busy || submitting || submitBlockedByUnusable) return;
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
      });
      setPrompt("");
      setContextSelected([]);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Failed to generate block");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId="generate_shape"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-workspace-generate-shape-stack
    >
    <WorkspaceRightPaneDrawer
      variant="section"
      drawerId="generate_shape"
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

        {addError && (
          <p className="text-xs text-red-400/90" data-generate-shape-error>
            {addError}
          </p>
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
            disabled={
              !prompt.trim() ||
              busy ||
              submitting ||
              !shapeFreeform.ok ||
              submitBlockedByUnusable
            }
            onClick={() => void handleSubmit()}
            className="rounded-none bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
          >
            {busy || submitting ? "..." : labels.addSubmit}
          </button>
        </div>
      </div>
    </WorkspaceRightPaneDrawer>
    <WorkspaceRightPaneDrawer
      variant="section"
      drawerId="unusable_ground"
      title="Unusable ground"
      defaultExpanded={false}
      bodyClassName="space-y-3"
      surfaceDataAttr="data-shape-unusable-drawer"
    >
      <UnusableGroundDrawer
        cells={cells.map((cell) => ({ row: cell.row, col: cell.col }))}
        unusableCells={unusableCells || []}
        busy={busy}
        onSetUnusableCells={onSetUnusableCells}
      />
    </WorkspaceRightPaneDrawer>
    </WorkspaceRightPaneDrawerGroup>
  );
}
