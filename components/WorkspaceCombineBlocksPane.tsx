"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
} from "@/components/WorkspaceRightPaneDrawer";
import { areBlocksContiguous, type PlacedBlockRef } from "@/lib/skill-grid-ops";
import {
  buildSkillGridLayout,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  BRIDGE_DENSITY_MAX,
  BRIDGE_DENSITY_MIN,
  BRIDGE_MAX_HALF_WIDTH,
  bridgeAnchorsFromPlacedBlocks,
  bridgeHalfWidthForDensity,
  resolveBridgeSelection,
} from "@/lib/bridge-blocks";
import { unusableCellKeySet } from "@/lib/map-ground-rules";

export type CombineBlockRef = {
  id: string;
  title: string;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: SkillGridNode["shape_cells"];
};

/**
 * Right-column surface when ≥2 filled blocks are multi-selected.
 * Combine drawer (merge) + Bridge Blocks drawer (corridor multi-create).
 */
export function WorkspaceCombineBlocksPane({
  blockIds,
  nodes,
  busy = false,
  unusableCells = null,
  onCombine,
  onGenerateBridge,
  onBridgePreviewChange,
  onCancel,
  labels,
}: {
  blockIds: string[];
  nodes: CombineBlockRef[];
  busy?: boolean;
  unusableCells?: Array<{ row: number; col: number }> | null;
  onCombine: (input: {
    blockIds: string[];
    prompt?: string;
  }) => Promise<void> | void;
  /**
   * Enqueue background multi-create along a straight knowledge-bridge corridor.
   * Host freezes slots into the same expand-job path as range/density create.
   */
  onGenerateBridge?: (input: {
    blockIds: string[];
    density: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void> | void;
  /** Lift bridge corridor preview onto the map. */
  onBridgePreviewChange?: (
    cells: Array<{ row: number; col: number }> | null,
  ) => void;
  onCancel: () => void;
  labels?: {
    combine?: string;
    cancel?: string;
    promptPlaceholder?: string;
  };
}) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Start at min density (thin centerline); author can thicken via slider. */
  const [bridgeDensity, setBridgeDensity] = useState(BRIDGE_DENSITY_MIN);
  const [bridgePrompt, setBridgePrompt] = useState("");
  const [bridgeSubmitting, setBridgeSubmitting] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const selected = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return blockIds
      .map((id) => byId.get(id))
      .filter((n): n is CombineBlockRef => Boolean(n));
  }, [blockIds, nodes]);

  const skillNodes = useMemo(
    () =>
      selected.map(
        (n) =>
          ({
            id: n.id,
            title: n.title,
            description: n.description ?? "",
            status: "available",
            is_start: false,
            next_block_ids: [],
            position_x: n.position_x ?? null,
            position_y: n.position_y ?? null,
            span_w: n.span_w ?? 1,
            span_h: n.span_h ?? 1,
            shape_cells: n.shape_cells ?? null,
          }) as SkillGridNode,
      ),
    [selected],
  );

  const contiguous = useMemo(() => {
    const { placements, spans } = buildSkillGridLayout(skillNodes);
    const placed: PlacedBlockRef[] = selected.flatMap((n) => {
      const cell = placements.get(n.id);
      if (!cell) return [];
      const span = spans.get(n.id);
      return [
        {
          id: n.id,
          position_x: cell.col,
          position_y: cell.row,
          span_w: span?.span_w ?? 1,
          span_h: span?.span_h ?? 1,
          shape_cells: n.shape_cells ?? null,
        },
      ];
    });
    if (placed.length < 2) return false;
    return areBlocksContiguous(placed);
  }, [selected, skillNodes]);

  /** Accordion open drawer — bridge open ⇒ show corridor highlight on the map. */
  const defaultDrawerId = contiguous ? "combine" : "bridge";
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(defaultDrawerId);

  // Reset draft when the multi-selection set changes.
  const selectionKey = blockIds.join(",");
  useEffect(() => {
    setPrompt("");
    setError(null);
    setBridgeDensity(BRIDGE_DENSITY_MIN);
    setBridgePrompt("");
    setBridgeError(null);
    setOpenDrawerId(contiguous ? "combine" : "bridge");
  }, [selectionKey, contiguous]);

  const allSkillNodes = useMemo(
    () =>
      nodes.map(
        (n) =>
          ({
            id: n.id,
            title: n.title || "",
            description: n.description ?? "",
            status: "available",
            is_start: false,
            next_block_ids: [],
            position_x: n.position_x ?? null,
            position_y: n.position_y ?? null,
            span_w: n.span_w ?? 1,
            span_h: n.span_h ?? 1,
            shape_cells: n.shape_cells ?? null,
          }) as SkillGridNode,
      ),
    [nodes],
  );
  const { occupancy } = useMemo(
    () => buildSkillGridLayout(allSkillNodes),
    [allSkillNodes],
  );
  const occupiedKeys = useMemo(
    () => new Set(occupancy.keys()),
    [occupancy],
  );
  const unusableKeys = useMemo(
    () => unusableCellKeySet(unusableCells || []),
    [unusableCells],
  );

  const bridgeAnchors = useMemo(
    () => bridgeAnchorsFromPlacedBlocks(selected),
    [selected],
  );
  const bridgeSelection = useMemo(
    () =>
      resolveBridgeSelection({
        anchors: bridgeAnchors,
        density: bridgeDensity,
        occupiedKeys,
        unusableKeys,
      }),
    [bridgeAnchors, bridgeDensity, occupiedKeys, unusableKeys],
  );
  const bridgeHalfWidth = bridgeHalfWidthForDensity(bridgeDensity);
  const canBridge =
    Boolean(onGenerateBridge) &&
    bridgeAnchors.length >= 2 &&
    bridgeSelection.selected.length > 0;

  // Map preview for bridge corridor while the Bridge drawer is open.
  useEffect(() => {
    if (!onBridgePreviewChange) return;
    if (openDrawerId === "bridge" && bridgeSelection.selected.length > 0) {
      onBridgePreviewChange(
        bridgeSelection.selected.map((c) => ({ row: c.row, col: c.col })),
      );
    } else {
      onBridgePreviewChange(null);
    }
    return () => {
      onBridgePreviewChange(null);
    };
  }, [openDrawerId, bridgeSelection.selected, onBridgePreviewChange]);

  const submit = async () => {
    if (submitting || busy || selected.length < 2 || !contiguous) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCombine({
        blockIds: selected.map((n) => n.id),
        prompt: prompt.trim() || undefined,
      });
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to combine blocks");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBridge = async () => {
    if (!onGenerateBridge || bridgeSubmitting || busy || !canBridge) return;
    setBridgeSubmitting(true);
    setBridgeError(null);
    try {
      await onGenerateBridge({
        blockIds: selected.map((n) => n.id),
        density: bridgeDensity,
        userPrompt: bridgePrompt.trim() || undefined,
        frozenSlots: bridgeSelection.selected.map((c) => ({
          row: c.row,
          col: c.col,
        })),
        blockTitles: selected.map((n) => n.title || "Untitled"),
      });
      setBridgePrompt("");
    } catch (err) {
      setBridgeError(
        err instanceof Error ? err.message : "Failed to generate bridge",
      );
    } finally {
      setBridgeSubmitting(false);
    }
  };

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId={defaultDrawerId}
      openId={openDrawerId}
      onOpenIdChange={setOpenDrawerId}
      data-workspace-right-pane="combine_blocks"
      data-workspace-combine-blocks-pane
      data-combine-block-count={String(selected.length)}
      data-combine-contiguous={contiguous ? "true" : "false"}
      data-bridge-block-count={String(selected.length)}
      data-default-drawer={defaultDrawerId}
      data-bridge-drawer-open={openDrawerId === "bridge" ? "true" : "false"}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="combine"
        title="Combine blocks"
        // Contiguous group → Combine is the primary action; gaps → Bridge first.
        defaultExpanded={contiguous}
        bodyClassName="space-y-3"
      >
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Merge the selected map blocks into{" "}
          <span className="text-neutral-200">one broader block</span>. The combined
          topic spans the union of their shapes and covers more ground than either
          alone — useful when several small lectures belong together as one unit.
        </p>

        {/*
          Single-column merge diagram — never wraps in the narrow right pane.
          Stack of compact rows with + separators → result strip.
        */}
        <div
          className="rounded-lg border border-white/10 bg-neutral-950/70 p-2"
          data-combine-visual
          data-combine-layout="stack"
        >
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-600">
            {selected.length} selected
          </p>
          <ul className="space-y-0" data-combine-source-list>
            {selected.map((block, index) => {
              const marker = String.fromCharCode(65 + (index % 26));
              return (
                <li key={block.id} className="relative">
                  {index > 0 ? (
                    <div
                      className="flex items-center justify-center py-1"
                      data-combine-plus
                      aria-hidden
                    >
                      <span className="text-sm font-semibold leading-none text-neutral-400">
                        +
                      </span>
                    </div>
                  ) : null}
                  <div
                    className="flex min-w-0 items-start gap-2.5 rounded-md border border-white/15 bg-neutral-900/90 px-2.5 py-2.5"
                    data-combine-block-card={block.id}
                    data-combine-marker={marker}
                  >
                    <span className="mt-0.5 shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-400">
                      {marker}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-neutral-100 line-clamp-2">
                      {block.title || "Untitled"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className="my-1.5 flex flex-col items-center gap-0.5"
            data-combine-arrow
            aria-hidden
          >
            <span className="h-3 w-px bg-white/20" />
            <span className="text-[10px] text-neutral-500">↓</span>
          </div>

          <div
            className="rounded-md border border-white/25 bg-white/[0.07] px-2.5 py-2 text-center"
            data-combine-result
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              Result
            </p>
            <p
              className="mt-0.5 text-[12px] font-semibold leading-snug text-white"
              data-combine-result-hint
            >
              1 broader block
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
              Covers all {selected.length} selections as one larger topic
            </p>
          </div>
        </div>

        {!contiguous ? (
          <p
            className="rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-2 text-[11px] leading-snug text-amber-200/90"
            data-combine-not-contiguous
          >
            Selected blocks must share edges (be contiguous on the map) before they
            can combine. Adjust the selection so every block touches the group.
          </p>
        ) : null}

        <label className="block space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Combination prompt
          </span>
          <textarea
            data-combine-prompt
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={busy || submitting}
            placeholder={
              labels?.promptPlaceholder ||
              "Optional guidance for the merged topic (e.g. how to unify the lessons)…"
            }
            className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          />
        </label>

        {error ? (
          <p className="text-xs text-red-400/90" data-combine-error>
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            data-combine-cancel
            disabled={busy || submitting}
            onClick={onCancel}
            className="flex-1 rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-40"
          >
            {labels?.cancel || "Cancel"}
          </button>
          <button
            type="button"
            data-combine-submit
            disabled={
              busy || submitting || selected.length < 2 || !contiguous
            }
            onClick={() => void submit()}
            className="flex-1 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {submitting || busy
              ? "Combining…"
              : labels?.combine || "Combine into one block"}
          </button>
        </div>
      </WorkspaceRightPaneDrawer>

      {/* Bridge Blocks — straight corridor multi-create between selected concepts */}
      <WorkspaceRightPaneDrawer
        variant="section"
        title="Bridge Blocks"
        // Non-contiguous multi-select cannot combine — open Bridge by default.
        defaultExpanded={!contiguous}
        drawerId="bridge"
        bodyClassName="space-y-3"
        surfaceDataAttr="data-bridge-blocks-drawer"
      >
        <div data-bridge-blocks-pane className="space-y-3">
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Generate a{" "}
            <span className="text-neutral-200">knowledge bridge</span> of new
            1×1 blocks along a straight path linking the selected topics. Density
            controls how thick the corridor is (capped so it stays a bridge, not
            a blob).
          </p>

          <label className="block space-y-1" data-bridge-density>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">Density</span>
              <span className="font-mono text-[10px] text-neutral-500">
                {bridgeDensity}% · half-width {bridgeHalfWidth}/
                {BRIDGE_MAX_HALF_WIDTH} · {bridgeSelection.selected.length}{" "}
                cells
              </span>
            </div>
            <input
              type="range"
              min={BRIDGE_DENSITY_MIN}
              max={BRIDGE_DENSITY_MAX}
              step={5}
              value={bridgeDensity}
              disabled={busy || bridgeSubmitting || selected.length < 2}
              onChange={(e) => setBridgeDensity(Number(e.target.value))}
              className="w-full accent-white"
              data-bridge-density-input
            />
            <p className="text-[10px] leading-snug text-neutral-600">
              Higher density thickens the line (max half-width{" "}
              {BRIDGE_MAX_HALF_WIDTH}) and fills more placeable cells.
            </p>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Bridging prompt
            </span>
            <textarea
              data-bridge-prompt
              value={bridgePrompt}
              onChange={(e) => setBridgePrompt(e.target.value)}
              rows={3}
              disabled={busy || bridgeSubmitting}
              placeholder="Optional guidance for the bridge (e.g. emphasize causality, shared vocabulary, or a transition exercise)…"
              className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
            />
          </label>

          {bridgeAnchors.length < 2 ? (
            <p
              className="rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-2 text-[11px] leading-snug text-amber-200/90"
              data-bridge-need-anchors
            >
              Need at least two selected blocks with map positions to draw a
              bridge.
            </p>
          ) : bridgeSelection.selected.length === 0 ? (
            <p
              className="rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-2 text-[11px] leading-snug text-amber-200/90"
              data-bridge-no-cells
            >
              No placeable empty cells along the corridor — clear space between
              the blocks or lower density.
            </p>
          ) : null}

          {bridgeError ? (
            <p className="text-xs text-red-400/90" data-bridge-error>
              {bridgeError}
            </p>
          ) : null}

          <button
            type="button"
            data-bridge-generate
            disabled={
              busy ||
              bridgeSubmitting ||
              !canBridge ||
              selected.length < 2
            }
            onClick={() => void submitBridge()}
            className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {bridgeSubmitting
              ? "Starting bridge…"
              : bridgeSelection.selected.length > 0
                ? `Generate bridge (${bridgeSelection.selected.length} blocks)`
                : "Generate bridge"}
          </button>
          <p className="text-[10px] leading-snug text-neutral-600">
            Runs in the background like expand create — progress and Stop appear
            under the minimap; bridge tiles stay non-clickable until finished.
          </p>
        </div>
      </WorkspaceRightPaneDrawer>
    </WorkspaceRightPaneDrawerGroup>
  );
}
