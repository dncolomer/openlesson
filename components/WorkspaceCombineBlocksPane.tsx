"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
} from "@/components/WorkspaceRightPaneDrawer";
import { MultiBlockDagCanvas } from "@/components/MultiBlockDagCanvas";
import {
  areBlocksContiguous,
  buildOccupancyFromPlaced,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import {
  buildSkillGridLayout,
  type SkillGridNode,
} from "@/lib/block-skill-grid";
import {
  BRIDGE_DENSITY_MAX,
  BRIDGE_DENSITY_MIN,
  BRIDGE_MAX_HALF_WIDTH,
  BRIDGE_WIDTH_MAX,
  BRIDGE_WIDTH_MIN,
  bridgeAnchorsFromPlacedBlocks,
  resolveBridgeSelection,
} from "@/lib/bridge-blocks";
import { unusableCellKeySet } from "@/lib/map-ground-rules";
import {
  draftMultiBlockDag,
  MULTI_BLOCK_DAG_MAX_BLOCKS,
  multiBlockDagEdgeCounts,
  multiBlockDagHasCycle,
  multiBlockDagSelectionTooLarge,
  setMultiBlockDagEdge,
  type MultiBlockDagDraft,
} from "@/lib/multi-block-dag";
import {
  CLUSTER_SEPARATION_DEFAULT,
  CLUSTER_SEPARATION_MAX,
  CLUSTER_SEPARATION_MIN,
  clusterBlocks,
  resolveAutoClusterCount,
  resolveClusterSeparation,
  type ClusterCountSpec,
} from "@/lib/cluster-blocks";

export type CombineBlockRef = {
  id: string;
  title: string;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: SkillGridNode["shape_cells"];
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
  is_start?: boolean | null;
};

/**
 * Right-column surface when ≥2 filled blocks are multi-selected.
 * Combine + Bridge + DAG (dependency graph) + Delete.
 */
export function WorkspaceCombineBlocksPane({
  blockIds,
  nodes,
  busy = false,
  unusableCells = null,
  onCombine,
  onGenerateBridge,
  onApplyDag,
  onClusterBlocks,
  onClusterProgress,
  onDeleteBlocks,
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
    width: number;
    userPrompt?: string;
    frozenSlots: Array<{ row: number; col: number }>;
    blockTitles: string[];
  }) => Promise<void> | void;
  /** Persist multi-select dependency DAG (next + lock_until among selection). */
  onApplyDag?: (input: {
    blockIds: string[];
    dagDraft: MultiBlockDagDraft;
  }) => Promise<void> | void;
  /**
   * Relocate selected blocks into physical clusters (positions only).
   * Host persists via grid-ops relocate.
   */
  onClusterBlocks?: (input: {
    blockIds: string[];
    placements: Array<{
      id: string;
      position_x: number;
      position_y: number;
    }>;
    clusterCount: number;
    /** Extra empty cells between clusters (0–10). */
    separation?: number;
    prompt?: string;
  }) => Promise<void> | void;
  /**
   * Progress under the minimap while clustering runs
   * (compute + persist). Host shows a progress bar.
   */
  onClusterProgress?: (
    job: {
      active: boolean;
      progress: number;
      label: string;
    } | null,
  ) => void;
  /** Batch-delete all multi-selected blocks. */
  onDeleteBlocks?: (input: { blockIds: string[] }) => Promise<void> | void;
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
  /** Width = corridor half-width; density = fill of thickened corridor. */
  const [bridgeWidth, setBridgeWidth] = useState(BRIDGE_WIDTH_MIN);
  const [bridgeDensity, setBridgeDensity] = useState(BRIDGE_DENSITY_MAX);
  const [bridgePrompt, setBridgePrompt] = useState("");
  const [bridgeSubmitting, setBridgeSubmitting] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [dagDraft, setDagDraft] = useState<MultiBlockDagDraft>(() =>
    draftMultiBlockDag(blockIds, nodes),
  );
  const [dagSubmitting, setDagSubmitting] = useState(false);
  const [dagError, setDagError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clusterAuto, setClusterAuto] = useState(true);
  const [clusterCountInput, setClusterCountInput] = useState(2);
  const [clusterSeparation, setClusterSeparation] = useState(
    CLUSTER_SEPARATION_DEFAULT,
  );
  const [clusterPrompt, setClusterPrompt] = useState("");
  const [clusterSubmitting, setClusterSubmitting] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

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
    setBridgeWidth(BRIDGE_WIDTH_MIN);
    setBridgeDensity(BRIDGE_DENSITY_MAX);
    setBridgePrompt("");
    setBridgeError(null);
    setDagDraft(draftMultiBlockDag(blockIds, nodes));
    setDagError(null);
    setDeleteError(null);
    setClusterAuto(true);
    setClusterCountInput(Math.max(2, resolveAutoClusterCount(blockIds.length)));
    setClusterSeparation(CLUSTER_SEPARATION_DEFAULT);
    setClusterPrompt("");
    setClusterError(null);
    setOpenDrawerId(contiguous ? "combine" : "bridge");
  }, [selectionKey, contiguous, blockIds, nodes]);

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
        width: bridgeWidth,
        density: bridgeDensity,
        occupiedKeys,
        unusableKeys,
      }),
    [bridgeAnchors, bridgeWidth, bridgeDensity, occupiedKeys, unusableKeys],
  );
  const bridgeHalfWidth = bridgeSelection.halfWidth;
  const canBridge =
    Boolean(onGenerateBridge) &&
    bridgeAnchors.length >= 2 &&
    bridgeSelection.selected.length > 0;
  const dagCounts = multiBlockDagEdgeCounts(dagDraft);
  const dagHasCycle = multiBlockDagHasCycle(dagDraft, "next");
  const dagTooManyBlocks = multiBlockDagSelectionTooLarge(selected.length);

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
        width: bridgeWidth,
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

  const submitDag = async () => {
    if (!onApplyDag || dagSubmitting || busy || selected.length < 2) return;
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

  const submitDelete = async () => {
    if (!onDeleteBlocks || deleteSubmitting || busy || selected.length < 2) {
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await onDeleteBlocks({ blockIds: selected.map((n) => n.id) });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete blocks",
      );
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const resolvedClusterCount: ClusterCountSpec = clusterAuto
    ? "auto"
    : clusterCountInput;

  const clusterPreviewCount = useMemo(() => {
    if (clusterAuto) return resolveAutoClusterCount(selected.length);
    return Math.max(1, Math.min(selected.length, Math.floor(clusterCountInput) || 1));
  }, [clusterAuto, clusterCountInput, selected.length]);

  const submitCluster = async () => {
    if (
      !onClusterBlocks ||
      clusterSubmitting ||
      busy ||
      selected.length < 2
    ) {
      return;
    }
    setClusterSubmitting(true);
    setClusterError(null);
    const separation = resolveClusterSeparation(clusterSeparation);
    const reportProgress = (
      progress: number,
      label: string,
      active = true,
    ) => {
      onClusterProgress?.({
        active,
        progress: Math.max(0, Math.min(1, progress)),
        label,
      });
    };
    try {
      reportProgress(0.06, "Clustering…");
      // Yield so the minimap progress bar paints before pure compute work.
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });
      const placedSelected = selected.filter(
        (n) => n.position_x != null && n.position_y != null,
      );
      if (placedSelected.length < 2) {
        throw new Error("Need at least two blocks with map positions");
      }
      const allPlaced: PlacedBlockRef[] = nodes
        .filter((n) => n.position_x != null && n.position_y != null)
        .map((n) => ({
          id: n.id,
          position_x: n.position_x!,
          position_y: n.position_y!,
          span_w: n.span_w ?? 1,
          span_h: n.span_h ?? 1,
          shape_cells: n.shape_cells ?? null,
        }));
      // Ensure occupancy map builds (side-effect free; validates shapes)
      buildOccupancyFromPlaced(allPlaced);

      reportProgress(0.22, "Assigning groups…");
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });

      reportProgress(0.38, "Placing clusters…");
      await new Promise<void>((r) => {
        window.setTimeout(r, 0);
      });

      const result = clusterBlocks({
        selected: placedSelected.map((n) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          position_x: n.position_x!,
          position_y: n.position_y!,
          span_w: n.span_w,
          span_h: n.span_h,
          shape_cells: n.shape_cells ?? null,
        })),
        allPlaced,
        unusableCells,
        clusterCount: resolvedClusterCount,
        separation,
        prompt: clusterPrompt.trim() || undefined,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      reportProgress(0.68, "Saving positions…");
      await onClusterBlocks({
        blockIds: result.placements.map((p) => p.id),
        placements: result.placements.map((p) => ({
          id: p.id,
          position_x: p.position_x,
          position_y: p.position_y,
        })),
        clusterCount: result.clusterCount,
        separation,
        prompt: clusterPrompt.trim() || undefined,
      });
      reportProgress(1, "Clusters updated");
      setClusterPrompt("");
    } catch (err) {
      setClusterError(
        err instanceof Error ? err.message : "Failed to cluster blocks",
      );
      onClusterProgress?.(null);
    } finally {
      setClusterSubmitting(false);
      // Brief complete flash then clear minimap progress.
      window.setTimeout(() => onClusterProgress?.(null), 500);
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
            1×1 blocks along a straight path linking the selected topics.{" "}
            <span className="text-neutral-300">Width</span> thickens the
            corridor; <span className="text-neutral-300">density</span> fills
            placeable cells inside it.
          </p>

          <label className="block space-y-1" data-bridge-width>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">Width</span>
              <span className="font-mono text-[10px] text-neutral-500">
                half-width {bridgeHalfWidth}/{BRIDGE_MAX_HALF_WIDTH} ·{" "}
                {bridgeSelection.candidates.length} corridor cells
              </span>
            </div>
            <input
              type="range"
              min={BRIDGE_WIDTH_MIN}
              max={BRIDGE_WIDTH_MAX}
              step={1}
              value={bridgeWidth}
              disabled={busy || bridgeSubmitting || selected.length < 2}
              onChange={(e) => setBridgeWidth(Number(e.target.value))}
              className="w-full accent-white"
              data-bridge-width-input
            />
            <p className="text-[10px] leading-snug text-neutral-600">
              Corridor thickness (0 = centerline only; max {BRIDGE_WIDTH_MAX}).
            </p>
          </label>

          <label className="block space-y-1" data-bridge-density>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">Density</span>
              <span className="font-mono text-[10px] text-neutral-500">
                {bridgeDensity}% · {bridgeSelection.selected.length} selected
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
              0% = placeable spine only; 100% = full thickened corridor.
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

      {/* Cluster blocks — physical relocation into spaced groups */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="cluster"
        title="Cluster blocks"
        defaultExpanded={false}
        bodyClassName="space-y-3"
        surfaceDataAttr="data-cluster-blocks-drawer"
      >
        <div data-cluster-blocks-pane className="space-y-3">
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Relocate the selected blocks into{" "}
            <span className="text-neutral-200">physical clusters</span> on the
            map. Content is unchanged — only positions move. Groups pack tightly
            by default (min 3 empty cells between them). Drag{" "}
            <span className="text-neutral-300">Separation</span> up if you want
            them farther apart. A progress bar appears under the minimap while
            clustering runs.
          </p>

          <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-2">
            <input
              type="checkbox"
              checked={clusterAuto}
              onChange={(e) => setClusterAuto(e.target.checked)}
              disabled={busy || clusterSubmitting}
              data-cluster-count-auto
              className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900 text-white focus:ring-white/30"
            />
            <span className="text-[12px] text-neutral-200">
              Let the system decide cluster count
            </span>
          </label>

          <label className="block space-y-1" data-cluster-count>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Number of clusters
              </span>
              <span className="font-mono text-[10px] text-neutral-500">
                {clusterPreviewCount} / {selected.length}
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={Math.max(1, selected.length)}
              step={1}
              value={clusterCountInput}
              disabled={busy || clusterSubmitting || clusterAuto}
              onChange={(e) =>
                setClusterCountInput(
                  Math.max(1, Math.min(selected.length, Number(e.target.value) || 1)),
                )
              }
              data-cluster-count-input
              className="w-full rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none disabled:opacity-50"
            />
            <p className="text-[10px] leading-snug text-neutral-600">
              {clusterAuto
                ? `Auto resolves to ${clusterPreviewCount} for this selection.`
                : "1 keeps the selection together; higher splits into more groups."}
            </p>
          </label>

          <label className="block space-y-1" data-cluster-separation>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Separation
              </span>
              <span
                className="font-mono text-[10px] text-neutral-500"
                data-cluster-separation-value
              >
                {clusterSeparation === 0
                  ? "tight"
                  : clusterSeparation <= 3
                    ? "near"
                    : clusterSeparation <= 7
                      ? "open"
                      : "far"}{" "}
                · +{clusterSeparation} cells
              </span>
            </div>
            <input
              type="range"
              min={CLUSTER_SEPARATION_MIN}
              max={CLUSTER_SEPARATION_MAX}
              step={1}
              value={clusterSeparation}
              disabled={busy || clusterSubmitting}
              onChange={(e) =>
                setClusterSeparation(
                  resolveClusterSeparation(Number(e.target.value)),
                )
              }
              className="w-full accent-white"
              data-cluster-separation-input
            />
            <p className="text-[10px] leading-snug text-neutral-600">
              0 = tightest legal (3 empty cells between groups). Higher values
              push clusters farther apart on the map.
            </p>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              Clustering prompt
            </span>
            <textarea
              data-cluster-prompt
              value={clusterPrompt}
              onChange={(e) => setClusterPrompt(e.target.value)}
              rows={3}
              disabled={busy || clusterSubmitting}
              placeholder="Optional guidance (e.g. group by theory vs practice, or by shared vocabulary)…"
              className="w-full resize-none rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
            />
          </label>

          {clusterError ? (
            <p className="text-xs text-red-400/90" data-cluster-error>
              {clusterError}
            </p>
          ) : null}

          <button
            type="button"
            data-cluster-apply
            disabled={
              busy ||
              clusterSubmitting ||
              selected.length < 2 ||
              !onClusterBlocks
            }
            onClick={() => void submitCluster()}
            className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {clusterSubmitting
              ? "Clustering…"
              : `Apply cluster (${clusterPreviewCount})`}
          </button>
        </div>
      </WorkspaceRightPaneDrawer>

      {/* DAG — visual connect graph among selected blocks */}
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
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-3 text-[12px] leading-relaxed text-neutral-200"
              data-dag-too-many-message
            >
              You can only have {MULTI_BLOCK_DAG_MAX_BLOCKS} blocks selected at
              once
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                Draw <span className="text-neutral-200">leads to</span> links
                among the selected blocks (journey order). Prerequisites still
                use the map lock tool. Links outside this selection stay intact.
                Apply to save.
              </p>

              <MultiBlockDagCanvas
                blocks={selected.map((b) => ({
                  id: b.id,
                  title: b.title || "Untitled",
                  position_x: b.position_x,
                  position_y: b.position_y,
                }))}
                draft={dagDraft}
                disabled={busy || dagSubmitting}
                onToggleEdge={toggleDagEdge}
              />

              {dagHasCycle ? (
                <p
                  className="rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-2 text-[11px] text-amber-200/90"
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
                data-dag-apply
                disabled={
                  busy ||
                  dagSubmitting ||
                  selected.length < 2 ||
                  !onApplyDag
                }
                onClick={() => void submitDag()}
                className="w-full rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                {dagSubmitting ? "Applying…" : "Apply"}
              </button>
            </>
          )}
        </div>
      </WorkspaceRightPaneDrawer>

      {/* Delete multi-selected blocks */}
      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="delete"
        title="Delete"
        defaultExpanded={false}
        bodyClassName="space-y-3"
        surfaceDataAttr="data-multi-block-delete-drawer"
      >
        <div data-multi-block-delete-pane className="space-y-3">
          <p className="text-[11px] leading-relaxed text-neutral-400">
            Permanently remove all{" "}
            <span className="text-neutral-200">{selected.length}</span> selected
            blocks from the map. Peer next-links and lock-until edges that pointed
            at them are cleaned up.
          </p>
          <ul className="space-y-1" data-delete-block-list>
            {selected.map((b) => (
              <li
                key={b.id}
                data-delete-block-row={b.id}
                className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[12px] text-neutral-200"
              >
                {b.title || "Untitled"}
              </li>
            ))}
          </ul>
          {deleteError ? (
            <p className="text-xs text-red-400/90" data-delete-error>
              {deleteError}
            </p>
          ) : null}
          <button
            type="button"
            data-multi-block-delete
            data-delete-blocks-submit
            disabled={
              busy ||
              deleteSubmitting ||
              selected.length < 2 ||
              !onDeleteBlocks
            }
            onClick={() => void submitDelete()}
            className="w-full rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleteSubmitting
              ? "Deleting…"
              : `Delete ${selected.length} blocks`}
          </button>
        </div>
      </WorkspaceRightPaneDrawer>
    </WorkspaceRightPaneDrawerGroup>
  );
}
