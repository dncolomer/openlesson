"use client";

import { formatGridCoordinate, type GridCell } from "@/lib/block-skill-grid";
import {
  toggleShapeContextSelection,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";
import type { BlockSkillGridProps } from "@/components/block-skill-grid/types";

type Labels = BlockSkillGridProps["labels"];

export function MapAuthoringForms({
  useRightPaneEmpty,
  localPendingCell,
  labels,
  canSuggest,
  isSuggesting,
  busy,
  onSuggestLocalAdd,
  suggestError,
  addError,
  suggestions,
  prompt,
  setPrompt,
  onCancelLocalAdd,
  onSubmitLocalAdd,
  shapePromptOpen,
  shapeFootprint,
  selectedEmptyCells,
  shapeFreeformOk,
  onSuggestShapeTopics,
  shapeContextLoading,
  shapeContextOptions,
  shapeContextSelected,
  setShapeContextSelected,
  onCancelShape,
  onSubmitShape,
  mergePromptOpen,
  selectedBlockIds,
  onCancelMerge,
  onSubmitMerge,
}: {
  useRightPaneEmpty: boolean;
  localPendingCell: GridCell | null;
  labels: Labels;
  canSuggest: boolean;
  isSuggesting: boolean;
  busy: boolean;
  onSuggestLocalAdd: () => void;
  suggestError: string | null;
  addError: string | null;
  suggestions: string[];
  prompt: string;
  setPrompt: (value: string) => void;
  onCancelLocalAdd: () => void;
  onSubmitLocalAdd: () => void;
  shapePromptOpen: boolean;
  shapeFootprint: {
    span_w: number;
    span_h: number;
    position_x: number;
    position_y: number;
  } | null;
  selectedEmptyCells: GridCell[];
  shapeFreeformOk: boolean;
  onSuggestShapeTopics: () => void;
  shapeContextLoading: boolean;
  shapeContextOptions: ShapeContextSourceOption[];
  shapeContextSelected: string[];
  setShapeContextSelected: (
    next: string[] | ((prev: string[]) => string[]),
  ) => void;
  onCancelShape: () => void;
  onSubmitShape: () => void;
  mergePromptOpen: boolean;
  selectedBlockIds: string[];
  onCancelMerge: () => void;
  onSubmitMerge: () => void;
}) {
  return (
    <>
      {!useRightPaneEmpty && localPendingCell ? (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center bg-black/55 p-3 sm:items-center"
          data-local-add-fallback
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl shadow-black/50">
            <h3 className="text-sm font-medium text-white">{labels.addTitle}</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              Slot {formatGridCoordinate(localPendingCell.row, localPendingCell.col)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={!canSuggest || isSuggesting || busy}
                onClick={() => void onSuggestLocalAdd()}
                className="rounded-md border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
              >
                {isSuggesting ? labels.suggesting : labels.suggestTopics}
              </button>
            </div>
            {suggestError && <p className="mt-2 text-xs text-red-400/90">{suggestError}</p>}
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
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
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={labels.addPlaceholder}
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelLocalAdd}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                disabled={!prompt.trim() || busy}
                onClick={() => void onSubmitLocalAdd()}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                {busy ? "..." : labels.addSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shapePromptOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div
            className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl"
            data-generate-shape-dialog
          >
            <h3 className="text-sm font-medium text-white">
              {labels.generateShape || "Generate block in shape"}
            </h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              {shapeFootprint
                ? `${selectedEmptyCells.length} cell${selectedEmptyCells.length === 1 ? "" : "s"} · bbox ${shapeFootprint.span_w}×${shapeFootprint.span_h} at ${formatGridCoordinate(shapeFootprint.position_y, shapeFootprint.position_x)}`
                : `${selectedEmptyCells.length} cells`}
            </p>
            {!shapeFreeformOk && shapeFootprint ? (
              <p className="mt-1 text-[11px] text-neutral-300/90" data-shape-not-contiguous>
                Select edge-connected cells only.
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                data-suggest-shape-topics
                disabled={
                  !canSuggest || isSuggesting || busy || !shapeFootprint || !shapeFreeformOk
                }
                onClick={() => void onSuggestShapeTopics()}
                className="rounded-md border border-neutral-700 bg-neutral-900/80 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
              >
                {isSuggesting ? labels.suggesting : labels.suggestTopics}
              </button>
            </div>
            {suggestError && <p className="mt-2 text-xs text-red-400/90">{suggestError}</p>}
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5" data-shape-suggestions>
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
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={labels.addPlaceholder}
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />

            <div
              className="mt-3 space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2.5"
              data-shape-context-picker
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Attach context sources
              </p>
              {shapeContextLoading ? (
                <p className="text-[11px] text-neutral-600" data-shape-context-loading>
                  Loading sources…
                </p>
              ) : shapeContextOptions.length === 0 ? (
                <p className="text-[11px] text-neutral-600">No sources yet</p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto" data-shape-context-list>
                  {shapeContextOptions.map((opt) => {
                    const checked = shapeContextSelected.includes(opt.key);
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
                              setShapeContextSelected((prev) =>
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
              {shapeContextSelected.length > 0 ? (
                <p className="text-[10px] text-neutral-500" data-shape-context-selected-count>
                  {shapeContextSelected.length} selected
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelShape}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                data-generate-shape-submit
                disabled={!prompt.trim() || busy || !shapeFreeformOk}
                onClick={onSubmitShape}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                {busy ? "..." : labels.addSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {mergePromptOpen && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl border border-neutral-700/80 bg-neutral-950 p-4 shadow-2xl">
            <h3 className="text-sm font-medium text-white">{labels.merge || "Merge blocks"}</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              Merging {selectedBlockIds.length} blocks into one larger geometric topic
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional guidance for the merged topic..."
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              rows={3}
              autoFocus
            />
            {addError && <p className="mt-2 text-xs text-red-400/90">{addError}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelMerge}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                {labels.addCancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSubmitMerge()}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
              >
                {busy ? "..." : labels.merge || "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
