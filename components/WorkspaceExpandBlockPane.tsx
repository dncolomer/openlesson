"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ADD_DENSITY_MAX,
  ADD_RANGE_MAX,
  ADD_RANGE_MIN,
  nextRandomizeSeed,
} from "@/lib/add-block-range-density";
import {
  resolveExpandFromSourceSelection,
  type ExpandSourceIdentity,
} from "@/lib/expand-block-from-source";
import {
  buildSkillGridLayout,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import type { PlacedBlockRef } from "@/lib/skill-grid-ops";
import { RabbitHoleExpandModal } from "@/components/RabbitHoleExpandModal";
import { mapCandidatesToFrozenSlots } from "@/lib/rabbit-hole-expand";
import {
  WorkspacePromptContextAlternatives,
  type PromptContextMode,
} from "@/components/WorkspacePromptContextAlternatives";

export type WorkspaceExpandBlockSubmitOpts = {
  frozenSlots: Array<{ row: number; col: number }>;
  range: number;
  density: number;
  /**
   * Optional free-text modifier / guidance for expand generation.
   * Empty or omitted is allowed and does not block submit.
   */
  userGuidance?: string;
  /**
   * Ordered rabbit-hole candidate questions mapped 1:1 onto frozen slots
   * (prompt overrides per slot). When set, expand uses these topics instead
   * of the generic expand-from-source slot prompt.
   */
  candidatePrompts?: string[];
};

/**
 * Expand block drawer: Range/Density around the selected filled block.
 * Same multi 1×1 placement mechanics as empty-cell expand; source is context.
 */
export function WorkspaceExpandBlockPane({
  sourceBlock,
  sourceIdentity,
  nodes,
  unusableCells = null,
  busy = false,
  workspaceId,
  locale = "en",
  ayclToken = null,
  onSubmit,
  onExpandPreviewChange,
}: {
  sourceBlock: PlacedBlockRef;
  sourceIdentity: ExpandSourceIdentity;
  nodes: SkillGridNode[];
  unusableCells?: Array<{ row: number; col: number }> | null;
  busy?: boolean;
  workspaceId?: string;
  locale?: string;
  ayclToken?: string | null;
  onSubmit: (
    source: ExpandSourceIdentity,
    opts: WorkspaceExpandBlockSubmitOpts,
  ) => Promise<void> | void;
  onExpandPreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
}) {
  const [range, setRange] = useState(1);
  const [density, setDensity] = useState(ADD_DENSITY_MAX);
  const [sampleSeed, setSampleSeed] = useState(1);
  const [userGuidance, setUserGuidance] = useState("");
  const [contextMode, setContextMode] = useState<PromptContextMode>("adhoc");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rabbitHoleOpen, setRabbitHoleOpen] = useState(false);

  // Stable callback ref so parent re-renders don't re-fire the preview effect.
  const onExpandPreviewChangeRef = useRef(onExpandPreviewChange);
  onExpandPreviewChangeRef.current = onExpandPreviewChange;

  useEffect(() => {
    setRange(1);
    setDensity(ADD_DENSITY_MAX);
    setSampleSeed(1);
    setUserGuidance("");
    setError(null);
  }, [sourceBlock.id]);

  const { occupancy } = useMemo(
    () => buildSkillGridLayout(nodes),
    [nodes],
  );
  // Occupancy key set identity: depend on a stable string of keys, not Map/Set refs.
  const occupiedKeyStr = useMemo(
    () => [...occupancy.keys()].sort().join("|"),
    [occupancy],
  );
  const occupiedKeys = useMemo(
    () => new Set(occupiedKeyStr ? occupiedKeyStr.split("|") : []),
    [occupiedKeyStr],
  );
  const unusableKeyStr = useMemo(
    () =>
      (unusableCells || [])
        .map((c) => `${c.row}:${c.col}`)
        .sort()
        .join("|"),
    [unusableCells],
  );
  const unusableKeys = useMemo(
    () => new Set(unusableKeyStr ? unusableKeyStr.split("|") : []),
    [unusableKeyStr],
  );

  // Primitives only — parent often allocates a fresh sourceBlock object each render.
  const sourceId = sourceBlock.id;
  const sourceX = sourceBlock.position_x;
  const sourceY = sourceBlock.position_y;
  const sourceW = sourceBlock.span_w;
  const sourceH = sourceBlock.span_h;
  const shapeKey = useMemo(
    () =>
      Array.isArray(sourceBlock.shape_cells)
        ? sourceBlock.shape_cells.map((c) => `${c.dr}:${c.dc}`).join("|")
        : "",
    [sourceBlock.shape_cells],
  );
  const stableSourceBlock = useMemo((): PlacedBlockRef => {
    return {
      id: sourceId,
      position_x: sourceX,
      position_y: sourceY,
      span_w: sourceW,
      span_h: sourceH,
      shape_cells:
        shapeKey.length > 0
          ? shapeKey.split("|").map((s) => {
              const [dr, dc] = s.split(":").map(Number);
              return { dr, dc };
            })
          : sourceBlock.shape_cells ?? null,
    };
  }, [shapeKey, sourceH, sourceId, sourceW, sourceX, sourceY, sourceBlock.shape_cells]);

  const expandSelection = useMemo(
    () =>
      resolveExpandFromSourceSelection({
        sourceBlock: stableSourceBlock,
        range,
        density,
        seed: sampleSeed,
        occupiedKeys,
        unusableKeys,
      }),
    [density, occupiedKeys, range, sampleSeed, stableSourceBlock, unusableKeys],
  );

  // Content-stable key so new array identities do not retrigger setState loops.
  const previewKey = useMemo(
    () =>
      expandSelection.selected.map((c) => `${c.row}:${c.col}`).join(","),
    [expandSelection.selected],
  );

  useEffect(() => {
    const cb = onExpandPreviewChangeRef.current;
    if (!cb) return;
    if (!previewKey) {
      cb(null);
      return;
    }
    cb(
      previewKey.split(",").map((pair) => {
        const [row, col] = pair.split(":").map(Number);
        return { row, col };
      }),
    );
  }, [previewKey]);

  // Clear map highlight only when this pane unmounts (not on every preview change).
  useEffect(() => {
    return () => {
      onExpandPreviewChangeRef.current?.(null);
    };
  }, []);

  const densityIsMax = density >= ADD_DENSITY_MAX;
  const cellsToCreate = expandSelection.selected;

  const handleSubmit = async (candidatePrompts?: string[]) => {
    if (submitting || busy || cellsToCreate.length === 0) return;
    setSubmitting(true);
    setError(null);
    const slots = expandSelection.frozenSlots;
    try {
      let frozenSlots = slots;
      let prompts = candidatePrompts;
      if (candidatePrompts && candidatePrompts.length > 0) {
        const mapped = mapCandidatesToFrozenSlots({
          candidates: candidatePrompts,
          frozenSlots: slots,
        });
        frozenSlots = mapped.map((m) => m.slot);
        prompts = mapped.map((m) => m.candidate);
      }
      const guidance = userGuidance.trim();
      await onSubmit(sourceIdentity, {
        frozenSlots,
        range,
        density,
        ...(guidance ? { userGuidance: guidance } : {}),
        ...(prompts && prompts.length > 0
          ? { candidatePrompts: prompts }
          : {}),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to expand block",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRabbitHoleConfirm = (candidates: string[]) => {
    setRabbitHoleOpen(false);
    void handleSubmit(candidates);
  };

  return (
    <div
      data-workspace-expand-block-pane
      data-expand-source-block-id={sourceBlock.id}
      className="space-y-3"
    >
      {error ? (
        <p className="text-xs text-red-400/90" data-expand-block-error>
          {error}
        </p>
      ) : null}

      <div
        className="space-y-2.5 rounded-none border border-neutral-800 bg-neutral-950/60 p-2.5"
        data-expand-block-controls
        data-add-expand-controls
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          Expand block
        </p>

        <div data-expand-block-modifier data-generative-context-alternatives>
          <WorkspacePromptContextAlternatives
            workspaceId={workspaceId}
            draftPrompt={userGuidance}
            surface="expand block"
            mode={contextMode}
            onModeChange={setContextMode}
            adhocValue={userGuidance}
            onAdhocChange={setUserGuidance}
            onAccept={setUserGuidance}
            disabled={busy || submitting}
            adhocPlaceholder="Optional guidance for the expansion (e.g. emphasize applications, keep beginner-friendly, or focus on proofs)…"
            adhocLabel="Modifier prompt"
            adhocInputDataAttr="data-expand-block-modifier-input"
          />
        </div>

        <label className="block space-y-1" data-expand-block-range data-add-range>
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
            data-expand-block-range-input
            data-add-range-input
          />
        </label>

        <label
          className="block space-y-1"
          data-expand-block-density
          data-add-density
        >
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
              busy ||
              submitting ||
              expandSelection.candidates.length <= 1
            }
            onChange={(e) => setDensity(Number(e.target.value))}
            className="w-full accent-white"
            data-expand-block-density-input
            data-add-density-input
          />
        </label>

        <div
          className="flex flex-col gap-1.5 sm:flex-row"
          data-expand-block-selection-actions
        >
          <button
            type="button"
            data-expand-block-randomize
            data-add-randomize
            disabled={
              busy ||
              submitting ||
              densityIsMax ||
              expandSelection.candidates.length <= 1
            }
            onClick={() => setSampleSeed((s) => nextRandomizeSeed(s))}
            className="min-w-0 flex-1 rounded-none border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Randomize selection
          </button>
          <button
            type="button"
            data-expand-block-rabbit-hole
            data-rabbit-hole-expansion
            disabled={
              busy ||
              submitting ||
              cellsToCreate.length === 0 ||
              !workspaceId
            }
            onClick={() => setRabbitHoleOpen(true)}
            className="min-w-0 flex-1 rounded-none border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              !workspaceId
                ? "Workspace required"
                : cellsToCreate.length === 0
                  ? "Select empty cells with Range/Density first"
                  : "Explore rabbit-hole questions to seed expansion topics"
            }
          >
            Rabbit Hole Expansion
          </button>
        </div>
      </div>

      <button
        type="button"
        data-expand-block-submit
        disabled={busy || submitting || cellsToCreate.length === 0}
        onClick={() => void handleSubmit()}
        className="w-full rounded-none bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
      >
        {submitting
          ? "Starting…"
          : cellsToCreate.length === 0
            ? "No empty cells in range"
            : cellsToCreate.length === 1
              ? "Expand 1 block"
              : `Expand ${cellsToCreate.length} blocks`}
      </button>

      {workspaceId ? (
        <RabbitHoleExpandModal
          open={rabbitHoleOpen}
          source={sourceIdentity}
          outlineTarget={cellsToCreate.length}
          workspaceId={workspaceId}
          locale={locale}
          ayclToken={ayclToken}
          onClose={() => setRabbitHoleOpen(false)}
          onConfirm={handleRabbitHoleConfirm}
        />
      ) : null}
    </div>
  );
}
