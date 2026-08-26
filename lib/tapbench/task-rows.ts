/**
 * One TAPBench results row per catalog workspace, with the best region.
 */

import type { TapbenchTask } from "./catalog";
import type { TapbenchPublicRegion } from "./region";

export const TAPBENCH_WORKSPACE_PATH = "tapbench/workspace" as const;

export function tapbenchWorkspaceHref(workspaceId: string): string {
  return `/${TAPBENCH_WORKSPACE_PATH}/${workspaceId}`;
}

export const TAPBENCH_WORKSPACE_TOP_N = 10;

function regionRank(region: TapbenchPublicRegion): [number, number, number, number] {
  const inRank = region.in_region === true ? 0 : region.in_region === false ? 1 : 2;
  const center =
    region.distance_to_center != null && Number.isFinite(region.distance_to_center)
      ? region.distance_to_center
      : Number.POSITIVE_INFINITY;
  const border =
    region.distance_to_closest_border != null &&
    Number.isFinite(region.distance_to_closest_border)
      ? region.distance_to_closest_border
      : Number.POSITIVE_INFINITY;
  const recency = Date.parse(region.created_at) || 0;
  return [inRank, center, border, -recency];
}

export function compareTapbenchRegions(
  a: TapbenchPublicRegion,
  b: TapbenchPublicRegion,
): number {
  const ra = regionRank(a);
  const rb = regionRank(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] - rb[i];
  }
  return b.subject_count - a.subject_count;
}

export function rankTapbenchRegions(
  regions: readonly TapbenchPublicRegion[],
): TapbenchPublicRegion[] {
  return [...regions].sort(compareTapbenchRegions);
}

export function pickBestTapbenchRegion(
  regions: readonly TapbenchPublicRegion[],
): TapbenchPublicRegion | null {
  return rankTapbenchRegions(regions)[0] ?? null;
}

export function topTapbenchRegions(
  regions: readonly TapbenchPublicRegion[],
  limit: number = TAPBENCH_WORKSPACE_TOP_N,
): TapbenchPublicRegion[] {
  const n = limit > 0 ? limit : TAPBENCH_WORKSPACE_TOP_N;
  return rankTapbenchRegions(regions).slice(0, n);
}

export type TapbenchWorkspaceRow = {
  task: TapbenchTask;
  best: TapbenchPublicRegion | null;
};

export function tapbenchWorkspaceRows(
  tasks: readonly TapbenchTask[],
  regions: readonly TapbenchPublicRegion[],
): TapbenchWorkspaceRow[] {
  const byWorkspace = new Map<string, TapbenchPublicRegion[]>();
  for (const region of regions) {
    const list = byWorkspace.get(region.workspace_id) ?? [];
    list.push(region);
    byWorkspace.set(region.workspace_id, list);
  }
  return tasks.map((task) => ({
    task,
    best: pickBestTapbenchRegion(byWorkspace.get(task.id) ?? []),
  }));
}
