"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceBlockUnsysHeliosChat } from "@/components/WorkspaceBlockUnsysHeliosChat";
import { WorkspaceUnsysSeedGraph } from "@/components/WorkspaceUnsysSeedGraph";
import { WorkspaceUnsysSeedInspector } from "@/components/WorkspaceUnsysSeedInspector";
import type { AuthorUnsysHeliosApplyState } from "@/lib/author-unsys-helios";
import {
  AUTHOR_UNSYS_GENERATE_PATH,
  addAuthorUnsysBranch,
  authorUnsysSeedForPersist,
  normalizeAuthorUnsysModel,
  normalizeAuthorUnsysModelSeed,
  removeAuthorUnsysBranch,
  setAuthorUnsysBranchFields,
  setAuthorUnsysEdgePrice,
  type AuthorUnsysModelSeed,
} from "@/lib/author-unsys-model";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import {
  DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE,
  HELIOS_MAP_MODE_LABEL,
  MANUAL_MAP_MODE_LABEL,
  normalizeWorkspaceHeliosColumnMode,
  resolveWorkspaceHeliosColumnSurface,
  type WorkspaceHeliosColumnMode,
} from "@/lib/workspace-helios-mode";

const BUTTON_CLASS =
  "rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400";
const GHOST_BUTTON_CLASS =
  "rounded-none border border-neutral-700 px-3 py-2 text-[11px] text-neutral-200 hover:border-neutral-500 disabled:opacity-40";

export function WorkspaceUnsysSeedStudio({
  blockId,
  blockTitle,
  blockDescription,
  seed,
  workspaceId,
  ayclToken,
  locale,
  busy = false,
  onClose,
  onSaveSeed,
}: {
  blockId: string;
  blockTitle: string;
  blockDescription?: string | null;
  seed?: unknown;
  workspaceId: string;
  ayclToken?: string;
  locale?: string;
  busy?: boolean;
  onClose?: () => void;
  onSaveSeed?: (input: {
    blockId: string;
    seed: AuthorUnsysModelSeed | null;
  }) => Promise<void> | void;
}) {
  const parsed = useMemo(() => normalizeAuthorUnsysModelSeed(seed), [seed]);
  const [model, setModel] = useState<SessionBranchModel | null>(
    () => parsed?.model ?? null,
  );
  const [focusId, setFocusId] = useState(() => model?.rootId ?? "root");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [graphEpoch, setGraphEpoch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [heliosColumnMode, setHeliosColumnMode] =
    useState<WorkspaceHeliosColumnMode>(DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE);
  const heliosSurface = resolveWorkspaceHeliosColumnSurface({
    authoring: true,
    mode: heliosColumnMode,
  });

  useEffect(() => {
    const nextSeed = normalizeAuthorUnsysModelSeed(seed);
    const nextModel = nextSeed?.model ?? null;
    setModel(nextModel);
    setFocusId((focus) =>
      nextModel?.branches.some((branch) => branch.id === focus)
        ? focus
        : nextModel?.rootId ?? "root",
    );
    setError(null);
  }, [blockId, seed]);

  const hasSavedSeed = Boolean(parsed?.model);
  const disabled = busy || saving || generating;

  const commitModel = (next: SessionBranchModel, nextFocus = focusId) => {
    setModel(next);
    if (next.branches.some((branch) => branch.id === nextFocus)) setFocusId(nextFocus);
    else setFocusId(next.rootId);
  };

  const generateSample = async (input?: {
    parentId?: string;
    seedModel?: SessionBranchModel | null;
  }): Promise<AuthorUnsysHeliosApplyState | null> => {
    const parentId = input?.parentId;
    const source = input?.seedModel ?? model;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(AUTHOR_UNSYS_GENERATE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...(ayclToken ? { ayclToken } : {}),
          blockId,
          blockTitle,
          blockDescription: blockDescription || "",
          ...(parentId && source ? { parentId, seedModel: source } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          errorMessageFromBody(data, "The unsys field could not be generated."),
        );
      }
      const sample = normalizeAuthorUnsysModel(data.model);
      if (!sample) throw new Error("The unsys field came back empty.");
      const nextFocus = parentId || sample.rootId;
      commitModel(sample, nextFocus);
      if (!parentId) setGraphEpoch((value) => value + 1);
      return { model: sample, focusId: nextFocus };
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The unsys field could not be generated.",
      );
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const applyHelios = (next: AuthorUnsysHeliosApplyState) => {
    setModel(next.model);
    setFocusId(next.focusId);
  };

  const addBranch = (parentId: string) => {
    if (!model) return;
    const next = addAuthorUnsysBranch(model, parentId, {
      title: "New hidden state",
    });
    const added = next.branches.find(
      (branch) => !model.branches.some((row) => row.id === branch.id),
    );
    commitModel(next, added?.id || parentId);
  };

  const persist = async (nextSeed: AuthorUnsysModelSeed | null) => {
    if (!onSaveSeed) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveSeed({ blockId, seed: nextSeed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the unsys model seed.");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!model) return;
    await persist(authorUnsysSeedForPersist(model));
  };

  const deleteSeed = async () => {
    await persist(null);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black text-white"
      data-author-unsys-studio=""
      data-author-unsys-studio-block={blockId}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <button
          type="button"
          data-author-unsys-back
          className={GHOST_BUTTON_CLASS}
          onClick={onClose}
        >
          Back to map
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">{blockTitle}</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            Unsys model
          </p>
        </div>
        <button
          type="button"
          data-author-unsys-generate
          data-author-unsys-regenerate={model ? "true" : undefined}
          className={GHOST_BUTTON_CLASS}
          disabled={disabled}
          onClick={() => void generateSample()}
        >
          {generating
            ? "Generating…"
            : model
              ? "Regenerate sample"
              : "Generate sample"}
        </button>
        {hasSavedSeed ? (
          <button
            type="button"
            data-author-unsys-delete-seed
            className={GHOST_BUTTON_CLASS}
            disabled={disabled}
            onClick={() => void deleteSeed()}
          >
            Delete seed
          </button>
        ) : null}
        <button
          type="button"
          data-author-unsys-save-seed
          className={BUTTON_CLASS}
          disabled={disabled || !model}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save seed"}
        </button>
      </header>

      {error ? (
        <p className="px-3 text-[11px] text-red-400/90" data-author-unsys-error>
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative min-h-[22rem] flex-1 overflow-hidden lg:min-h-0">
          <div
            className={
              generating
                ? "pointer-events-none absolute inset-0 select-none blur-sm saturate-50"
                : "absolute inset-0"
            }
            inert={generating ? true : undefined}
          >
            <WorkspaceUnsysSeedGraph
              key={`${blockId}:${graphEpoch}`}
              model={model}
              focusId={focusId}
              disabled={disabled}
              onSelect={setFocusId}
            />
          </div>
          {generating ? (
            <div
              data-author-unsys-generating=""
              aria-busy="true"
              className="absolute inset-0 z-10 cursor-wait bg-black/45"
            />
          ) : null}
        </div>

        <aside
          className="flex max-h-[50vh] w-full shrink-0 flex-col overflow-hidden border-t border-white/10 bg-[#080808] lg:max-h-none lg:w-1/4 lg:flex-none lg:border-l lg:border-t-0"
          data-workspace-right-column=""
          data-helios-map-mode={heliosSurface.mode}
        >
          {heliosSurface.showModeToggle ? (
            <div
              className="flex shrink-0 border-b border-white/10"
              data-workspace-helios-mode-toggle=""
            >
              <button
                type="button"
                className={`flex-1 px-2 py-2 text-[10px] uppercase tracking-[0.16em] ${
                  heliosSurface.mode === "helios"
                    ? "bg-white/10 text-neutral-100"
                    : "text-neutral-500"
                }`}
                aria-pressed={heliosSurface.mode === "helios"}
                data-helios-map-mode-option="helios"
                onClick={() =>
                  setHeliosColumnMode(normalizeWorkspaceHeliosColumnMode("helios"))
                }
              >
                {HELIOS_MAP_MODE_LABEL}
              </button>
              <button
                type="button"
                className={`flex-1 px-2 py-2 text-[10px] uppercase tracking-[0.16em] ${
                  heliosSurface.mode === "manual"
                    ? "bg-white/10 text-neutral-100"
                    : "text-neutral-500"
                }`}
                aria-pressed={heliosSurface.mode === "manual"}
                data-helios-map-mode-option="manual"
                onClick={() =>
                  setHeliosColumnMode(normalizeWorkspaceHeliosColumnMode("manual"))
                }
              >
                {MANUAL_MAP_MODE_LABEL}
              </button>
            </div>
          ) : null}
          {heliosSurface.showHeliosChat ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <WorkspaceBlockUnsysHeliosChat
                workspaceId={workspaceId}
                ayclToken={ayclToken}
                locale={locale}
                blockId={blockId}
                blockTitle={blockTitle}
                model={model}
                focusId={focusId}
                disabled={disabled}
                onApplied={applyHelios}
                onGenerateGraph={generateSample}
              />
            </div>
          ) : (
            <WorkspaceUnsysSeedInspector
              model={model}
              focusId={focusId}
              disabled={disabled}
              onChangeTitle={(branchId, title) => {
                if (!model) return;
                commitModel(setAuthorUnsysBranchFields(model, branchId, { title }));
              }}
              onChangeQuestion={(branchId, question) => {
                if (!model) return;
                commitModel(setAuthorUnsysBranchFields(model, branchId, { question }));
              }}
              onChangeObservation={(branchId, observation) => {
                if (!model) return;
                commitModel(
                  setAuthorUnsysBranchFields(model, branchId, { observation }),
                );
              }}
              onChangePrice={(fromId, toId, price) => {
                if (!model) return;
                commitModel(setAuthorUnsysEdgePrice(model, fromId, toId, price));
              }}
              onAddBranch={addBranch}
              onGenerateDeeper={(parentId) => void generateSample({ parentId })}
              onRemoveBranch={(branchId) => {
                if (!model) return;
                const parentId =
                  model.branches.find((branch) => branch.id === branchId)?.parentId ||
                  model.rootId;
                commitModel(removeAuthorUnsysBranch(model, branchId), parentId);
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
