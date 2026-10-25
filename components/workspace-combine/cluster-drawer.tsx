"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkspaceRightPaneDrawer } from "@/components/WorkspaceRightPaneDrawer";
import {
  buildOccupancyFromPlaced,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import {
  CLUSTER_SEPARATION_DEFAULT,
  CLUSTER_SEPARATION_MAX,
  CLUSTER_SEPARATION_MIN,
  clusterBlocks,
  resolveAutoClusterCount,
  resolveClusterSeparation,
  type ClusterCountSpec,
} from "@/lib/cluster-blocks";
import type { CombineBlockRef } from "@/components/WorkspaceCombineBlocksPane";

export function ClusterBlocksDrawer({
  selected,
  nodes,
  busy,
  selectionKey,
  unusableCells,
  onClusterBlocks,
  onClusterProgress,
}: {
  selected: CombineBlockRef[];
  nodes: CombineBlockRef[];
  busy: boolean;
  selectionKey: string;
  unusableCells?: Array<{ row: number; col: number }> | null;
  onClusterBlocks?: (input: {
    blockIds: string[];
    placements: Array<{
      id: string;
      position_x: number;
      position_y: number;
    }>;
    clusterCount: number;
    separation?: number;
    prompt?: string;
  }) => Promise<void> | void;
  onClusterProgress?: (
    job: {
      active: boolean;
      progress: number;
      label: string;
    } | null,
  ) => void;
}) {
  const [clusterAuto, setClusterAuto] = useState(true);
  const [clusterCountInput, setClusterCountInput] = useState(2);
  const [clusterSeparation, setClusterSeparation] = useState(
    CLUSTER_SEPARATION_DEFAULT,
  );
  const [clusterPrompt, setClusterPrompt] = useState("");
  const [clusterSubmitting, setClusterSubmitting] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);

  useEffect(() => {
    setClusterAuto(true);
    setClusterCountInput(Math.max(2, resolveAutoClusterCount(selected.length)));
    setClusterSeparation(CLUSTER_SEPARATION_DEFAULT);
    setClusterPrompt("");
    setClusterError(null);
  }, [selectionKey, nodes, selected.length]);

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

  return (
    <WorkspaceRightPaneDrawer
      variant="section"
      drawerId="cluster"
      title="Cluster blocks"
      defaultExpanded={false}
      bodyClassName="space-y-3"
      surfaceDataAttr="data-cluster-blocks-drawer"
    >
      <div data-cluster-blocks-pane className="space-y-3">
        <label className="flex items-center gap-2 rounded-none border border-white/10 bg-black/30 px-2.5 py-2">
          <input
            type="checkbox"
            checked={clusterAuto}
            onChange={(e) => setClusterAuto(e.target.checked)}
            disabled={busy || clusterSubmitting}
            data-cluster-count-auto
            className="h-3.5 w-3.5 rounded-none border-neutral-600 bg-neutral-900 text-white focus:ring-white/30"
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
            className="w-full rounded-none border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white focus:border-neutral-500 focus:outline-none disabled:opacity-50"
          />
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
            className="w-full resize-none rounded-none border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
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
          className="w-full rounded-none bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {clusterSubmitting
            ? "Clustering…"
            : `Apply cluster (${clusterPreviewCount})`}
        </button>
      </div>
    </WorkspaceRightPaneDrawer>
  );
}
