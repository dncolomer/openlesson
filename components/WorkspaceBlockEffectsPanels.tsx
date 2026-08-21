"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  creatorEffectsEqual,
  generatorCellKey,
  normalizeBlockCreatorEffects,
  serializeBlockCreatorEffects,
  toggleDynamicUnlockAfterId,
  toggleGeneratorTargetCell,
  type BlockCreatorEffects,
  type GeneratorTargetCell,
} from "@/lib/block-creator-effects";
import type { SkillGridNode } from "@/lib/block-skill-grid";

/**
 * Creator-mode drawers for combinable block effects.
 * Mounted on block detail — not separate create types.
 */

export type WorkspaceBlockEffectsSaveInput = {
  blockId: string;
  effects: BlockCreatorEffects;
};

function EffectToggle({
  checked,
  disabled,
  onChange,
  label,
  description,
  dataAttr,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  dataAttr: string;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-2.5 rounded-none border border-white/10 bg-black/20 px-2.5 py-2"
      data-effect-toggle={dataAttr}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-none border-neutral-600 bg-neutral-900 text-white focus:ring-neutral-500 disabled:opacity-40"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        data-effect-enabled={dataAttr}
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-[12px] font-medium text-neutral-100">
          {label}
        </span>
        {description ? (
          <span className="block text-[11px] leading-relaxed text-neutral-400">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function SaveBar({
  dirty,
  busy,
  error,
  onSave,
  saveLabel,
}: {
  dirty: boolean;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  /** Override primary action label (e.g. “Apply” on blank-cell create). */
  saveLabel?: string;
}) {
  const action = saveLabel || "Save effect";
  return (
    <div className="space-y-1.5" data-effect-save-bar>
      {error ? (
        <p className="text-[11px] text-rose-300/95" data-effect-save-error>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!dirty || busy}
        onClick={() => void onSave()}
        className="w-full rounded-none border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-neutral-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
        data-effect-save
      >
        {busy ? "Saving…" : dirty ? action : "Saved"}
      </button>
    </div>
  );
}

/**
 * Dynamic effect: unlock when chosen map blocks are all Done, then generate
 * content from learner history. Deps are map-picked + saved — not DAG edges.
 */
export function WorkspaceBlockDynamicEffectPanel({
  blockId,
  effects: effectsProp,
  nodes,
  canEdit,
  busy = false,
  onSave,
  onUnlockPreviewChange,
  onPickModeChange,
  onRegisterBlockToggle,
  /**
   * Empty-cell create: Dynamic needs an existing block (like Generator).
   */
  requiresExistingBlock = false,
}: {
  blockId: string;
  effects?: BlockCreatorEffects | null;
  nodes: SkillGridNode[];
  canEdit: boolean;
  busy?: boolean;
  onSave?: (input: WorkspaceBlockEffectsSaveInput) => Promise<void> | void;
  /** Draft unlock-after ids while editing (map highlight). */
  onUnlockPreviewChange?: (blockIds: string[] | null) => void;
  /** True while Dynamic is on and this panel is mounted (map pick mode). */
  onPickModeChange?: (active: boolean) => void;
  /** Register map filled-block toggle handler for pick mode. */
  onRegisterBlockToggle?: ((toggle: ((blockId: string) => void) | null) => void) | null;
  requiresExistingBlock?: boolean;
  /** @deprecated ignored */
  allowWithoutDag?: boolean;
  saveLabel?: string;
  onLiveChange?: (effects: BlockCreatorEffects) => void;
}) {
  // Parent often passes a fresh object each render — fingerprint by content.
  const savedKey = JSON.stringify(
    serializeBlockCreatorEffects(
      normalizeBlockCreatorEffects(effectsProp, { selfBlockId: blockId }),
      { selfBlockId: blockId },
    ),
  );
  const [draft, setDraft] = useState(() =>
    normalizeBlockCreatorEffects(effectsProp, { selfBlockId: blockId }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedKeyRef = useRef(savedKey);

  // Reset draft only when block or *persisted* effects content changes.
  // Do not clobber local edits when parent re-renders with a new object identity.
  useEffect(() => {
    if (lastSavedKeyRef.current === savedKey) return;
    lastSavedKeyRef.current = savedKey;
    setDraft(
      normalizeBlockCreatorEffects(effectsProp, { selfBlockId: blockId }),
    );
    setError(null);
    // effectsProp intentionally omitted — savedKey is the content signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, savedKey]);

  const commitDraft = (next: BlockCreatorEffects) => {
    setDraft(next);
  };

  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) {
      m.set(n.id, String(n.title || "").trim() || "Untitled");
    }
    return m;
  }, [nodes]);

  const unlockIdsKey = draft.dynamic.unlockAfterBlockIds.join(",");
  const onUnlockPreviewChangeRef = useRef(onUnlockPreviewChange);
  onUnlockPreviewChangeRef.current = onUnlockPreviewChange;
  const onPickModeChangeRef = useRef(onPickModeChange);
  onPickModeChangeRef.current = onPickModeChange;

  const setDynamicPickActive = (active: boolean) => {
    onPickModeChangeRef.current?.(active);
  };

  // Draft map highlight while drawer is open (no per-key clear that races parent).
  useEffect(() => {
    const cb = onUnlockPreviewChangeRef.current;
    if (!cb) return;
    if (draft.dynamic.enabled) {
      cb([...draft.dynamic.unlockAfterBlockIds]);
    } else {
      cb(null);
    }
  }, [draft.dynamic.enabled, unlockIdsKey]);

  useEffect(() => {
    return () => {
      onUnlockPreviewChangeRef.current?.(null);
      onPickModeChangeRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    const active = Boolean(
      canEdit && !requiresExistingBlock && draft.dynamic.enabled,
    );
    setDynamicPickActive(active);
  }, [canEdit, draft.dynamic.enabled, requiresExistingBlock]);

  // Register once per block/editability — ref avoids inline-callback churn.
  const registerBlockToggleRef = useRef(onRegisterBlockToggle);
  registerBlockToggleRef.current = onRegisterBlockToggle;
  useEffect(() => {
    const register = registerBlockToggleRef.current;
    if (!register || !canEdit || requiresExistingBlock) {
      register?.(null);
      return;
    }
    register((targetId) => {
      setDraft((prev) => {
        if (!prev.dynamic.enabled) return prev;
        return {
          ...prev,
          dynamic: {
            ...prev.dynamic,
            unlockAfterBlockIds: toggleDynamicUnlockAfterId(
              prev.dynamic.unlockAfterBlockIds,
              targetId,
              blockId,
            ),
          },
        };
      });
      setError(null);
    });
    return () => {
      registerBlockToggleRef.current?.(null);
    };
  }, [blockId, canEdit, requiresExistingBlock]);

  if (requiresExistingBlock) {
    return (
      <div
        data-block-dynamic-effect-needs-base
        className="space-y-1.5 rounded-none border border-neutral-600/30 bg-neutral-950/20 px-2.5 py-2"
      >
        <p className="text-[12px] font-medium text-neutral-200/95">
          Create a base block first
        </p>
      </div>
    );
  }

  const persisted = normalizeBlockCreatorEffects(effectsProp, {
    selfBlockId: blockId,
  });

  if (!canEdit) {
    return (
      <div data-block-dynamic-effect-readonly className="space-y-1.5">
        <p className="text-[11px] text-neutral-500">
          {persisted.dynamic.enabled
            ? `Dynamic is on — unlocks after ${persisted.dynamic.unlockAfterBlockIds.length} block(s) are Done.`
            : "Dynamic is off."}
        </p>
      </div>
    );
  }

  const dirty = !creatorEffectsEqual(draft, persisted);
  const deps = draft.dynamic.unlockAfterBlockIds;

  const handleSave = async () => {
    if (!onSave || !dirty) return;
    if (draft.dynamic.enabled && deps.length === 0) {
      setError(
        "Click filled blocks on the map to select at least one unlock-after block.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ blockId, effects: draft });
      // Align fingerprint so a successful save does not look like external churn.
      lastSavedKeyRef.current = JSON.stringify(
        serializeBlockCreatorEffects(draft, { selfBlockId: blockId }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-block-dynamic-effect-panel className="space-y-3">
      <EffectToggle
        dataAttr="dynamic"
        checked={draft.dynamic.enabled}
        onChange={(enabled) => {
          setError(null);
          // Immediate pick mode so the next map click cannot clear selection.
          if (canEdit && !requiresExistingBlock) {
            setDynamicPickActive(enabled);
          }
          commitDraft({
            ...draft,
            dynamic: {
              ...draft.dynamic,
              enabled,
            },
          });
        }}
        label="Dynamic"
      />

      {draft.dynamic.enabled ? (
        <div className="space-y-1.5" data-dynamic-unlock-picker>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Unlock after all done ({deps.length})
          </p>
          {deps.length === 0 ? (
            <p className="text-[11px] text-neutral-500" data-dynamic-no-peers>
              No blocks selected yet.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
              {deps.map((id) => (
                <li key={id}>
                  <div
                    className="flex items-center justify-between gap-2 rounded-none border border-white/25 bg-white/10 px-2 py-1.5 text-[11px] text-neutral-100"
                    data-dynamic-unlock-dep={id}
                  >
                    <span className="truncate">
                      {titleById.get(id) || id}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] text-neutral-300 underline-offset-2 hover:text-white hover:underline"
                      data-dynamic-unlock-remove
                      onClick={() => {
                        commitDraft({
                          ...draft,
                          dynamic: {
                            ...draft.dynamic,
                            unlockAfterBlockIds: toggleDynamicUnlockAfterId(
                              draft.dynamic.unlockAfterBlockIds,
                              id,
                              blockId,
                            ),
                          },
                        });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {deps.length > 0 ? (
            <button
              type="button"
              data-dynamic-clear-deps
              className="text-[10px] text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
              onClick={() => {
                commitDraft({
                  ...draft,
                  dynamic: { ...draft.dynamic, unlockAfterBlockIds: [] },
                });
              }}
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-rose-300/95" data-effect-save-error>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-dynamic-save
        disabled={!dirty || busy || saving || !onSave}
        onClick={() => void handleSave()}
        className="w-full rounded-none border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving
          ? "Saving…"
          : dirty
            ? draft.dynamic.enabled
              ? "Save as Dynamic ?"
              : "Save effect"
            : "Saved"}
      </button>
    </div>
  );
}

/**
 * Generator: on complete, spawn blocks on empty cells picked by map click.
 * Only for already-created blocks — requires explicit Save for targets.
 */
export function WorkspaceBlockGeneratorEffectPanel({
  blockId,
  effects: effectsProp,
  nodes: _nodes,
  canEdit,
  busy = false,
  onSave,
  onTargetPreviewChange,
  onPickModeChange,
  onRegisterEmptyToggle,
  /**
   * Empty-cell create surface: Generator cannot be configured until a base
   * block exists. Shows a short notice instead of the picker.
   */
  requiresExistingBlock = false,
}: {
  blockId: string;
  effects?: BlockCreatorEffects | null;
  nodes: SkillGridNode[];
  canEdit: boolean;
  busy?: boolean;
  onSave?: (input: WorkspaceBlockEffectsSaveInput) => Promise<void> | void;
  /** Lift draft empty-cell targets while editing (overrides saved highlight). */
  onTargetPreviewChange?: (cells: GeneratorTargetCell[] | null) => void;
  /** True while Generator is enabled and this panel is mounted (map pick mode). */
  onPickModeChange?: (active: boolean) => void;
  /**
   * Register a map empty-cell toggle handler for the host.
   * Host calls the handler when an empty cell is clicked in pick mode.
   */
  onRegisterEmptyToggle?: (
    toggle: ((cell: GeneratorTargetCell) => void) | null,
  ) => void;
  requiresExistingBlock?: boolean;
}) {
  const savedKey = JSON.stringify(
    serializeBlockCreatorEffects(
      normalizeBlockCreatorEffects(effectsProp, { selfBlockId: blockId }),
      { selfBlockId: blockId },
    ),
  );
  const [draft, setDraft] = useState(() =>
    normalizeBlockCreatorEffects(effectsProp, { selfBlockId: blockId }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedKeyRef = useRef(savedKey);

  useEffect(() => {
    if (lastSavedKeyRef.current === savedKey) return;
    lastSavedKeyRef.current = savedKey;
    setDraft(
      normalizeBlockCreatorEffects(effectsProp, { selfBlockId: blockId }),
    );
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, savedKey]);

  const commitDraft = (next: BlockCreatorEffects) => {
    setDraft(next);
  };

  const targetCellsKey = draft.generator.targetCells
    .map((c) => generatorCellKey(c))
    .join(",");
  const onTargetPreviewChangeRef = useRef(onTargetPreviewChange);
  onTargetPreviewChangeRef.current = onTargetPreviewChange;
  const onPickModeChangeRef = useRef(onPickModeChange);
  onPickModeChangeRef.current = onPickModeChange;

  const setPickActive = (active: boolean) => {
    onPickModeChangeRef.current?.(active);
  };

  // Draft spark preview while this panel is open (saved highlight is host-side).
  // Avoid clearing on every targetCellsKey change — only update or clear on unmount.
  useEffect(() => {
    const cb = onTargetPreviewChangeRef.current;
    if (!cb) return;
    if (draft.generator.enabled) {
      cb(draft.generator.targetCells.map((c) => ({ row: c.row, col: c.col })));
    } else {
      cb(null);
    }
  }, [draft.generator.enabled, targetCellsKey]);

  useEffect(() => {
    return () => {
      onTargetPreviewChangeRef.current?.(null);
      onPickModeChangeRef.current?.(false);
    };
  }, []);

  // Keep host pick mode in sync when enabled flips (also set synchronously on toggle).
  useEffect(() => {
    const active = Boolean(
      canEdit && !requiresExistingBlock && draft.generator.enabled,
    );
    setPickActive(active);
  }, [canEdit, draft.generator.enabled, requiresExistingBlock]);

  const registerEmptyToggleRef = useRef(onRegisterEmptyToggle);
  registerEmptyToggleRef.current = onRegisterEmptyToggle;
  useEffect(() => {
    const register = registerEmptyToggleRef.current;
    if (!register || !canEdit || requiresExistingBlock) {
      register?.(null);
      return;
    }
    register((cell) => {
      setDraft((prev) => {
        if (!prev.generator.enabled) return prev;
        return {
          ...prev,
          generator: {
            ...prev.generator,
            targetCells: toggleGeneratorTargetCell(
              prev.generator.targetCells,
              cell,
            ),
          },
        };
      });
      setError(null);
    });
    return () => {
      registerEmptyToggleRef.current?.(null);
    };
  }, [canEdit, requiresExistingBlock]);

  if (requiresExistingBlock) {
    return (
      <div
        data-block-generator-effect-needs-base
        className="space-y-1.5 rounded-none border border-neutral-600/30 bg-neutral-950/20 px-2.5 py-2"
      >
        <p className="text-[12px] font-medium text-neutral-200/95">
          Create a base block first
        </p>
      </div>
    );
  }

  const persisted = normalizeBlockCreatorEffects(effectsProp, {
    selfBlockId: blockId,
  });

  if (!canEdit) {
    return (
      <div data-block-generator-effect-readonly className="space-y-1.5">
        <p className="text-[11px] text-neutral-500">
          {persisted.generator.enabled
            ? `Generator is on — ${persisted.generator.targetCells.length} empty cell(s).`
            : "Generator is off."}
        </p>
      </div>
    );
  }

  const dirty = !creatorEffectsEqual(draft, persisted);
  const cells = draft.generator.targetCells;

  const handleSave = async () => {
    if (!onSave || !dirty) return;
    if (draft.generator.enabled && cells.length === 0) {
      setError(
        "Click empty cells on the map to select at least one generation target.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ blockId, effects: draft });
      lastSavedKeyRef.current = JSON.stringify(
        serializeBlockCreatorEffects(draft, { selfBlockId: blockId }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-block-generator-effect-panel className="space-y-3">
      <EffectToggle
        dataAttr="generator"
        checked={draft.generator.enabled}
        onChange={(enabled) => {
          // Flip pick mode immediately so the next map click cannot open Add
          // or clear block selection (useEffect alone is one frame too late).
          if (canEdit && !requiresExistingBlock) {
            setPickActive(enabled);
          }
          commitDraft({
            ...draft,
            generator: { ...draft.generator, enabled },
          });
        }}
        label="Generator"
      />

      {draft.generator.enabled ? (
        <div className="space-y-1.5" data-generator-target-picker>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Empty targets ({cells.length})
          </p>
          {cells.length === 0 ? (
            <p className="text-[11px] text-neutral-500" data-generator-no-targets>
              No empty cells selected yet.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
              {cells.map((c) => (
                <li key={generatorCellKey(c)}>
                  <div
                    className="flex items-center justify-between gap-2 rounded-none border border-white/25 bg-white/10 px-2 py-1.5 text-[11px] text-neutral-100"
                    data-generator-target-cell={`${c.row}:${c.col}`}
                  >
                    <span className="font-mono">
                      row {c.row}, col {c.col}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] text-neutral-300 underline-offset-2 hover:text-white hover:underline"
                      data-generator-target-remove
                      onClick={() => {
                        commitDraft({
                          ...draft,
                          generator: {
                            ...draft.generator,
                            targetCells: toggleGeneratorTargetCell(
                              draft.generator.targetCells,
                              c,
                            ),
                          },
                        });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {cells.length > 0 ? (
            <button
              type="button"
              data-generator-clear-targets
              className="text-[10px] text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
              onClick={() => {
                commitDraft({
                  ...draft,
                  generator: { ...draft.generator, targetCells: [] },
                });
              }}
            >
              Clear all targets
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-rose-300/95" data-effect-save-error>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-generator-save-targets
        disabled={!dirty || busy || saving || !onSave}
        onClick={() => void handleSave()}
        className="w-full rounded-none border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving
          ? "Saving…"
          : dirty
            ? draft.generator.enabled
              ? "Save targets"
              : "Save effect"
            : "Saved"}
      </button>
    </div>
  );
}
