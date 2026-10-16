/**
 * 2D layout for the prepared hidden-state field.
 * A tidy tree by depth, scaled to the stage. Calibrate fogs every node
 * except the current stills and the path from the root.
 */

import type { SessionBranch, SessionBranchModel } from "@/lib/session-branch-model";

export type SessionBranchFieldPoint = {
  id: string;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
};

export type SessionBranchFieldEdge = {
  from: string;
  to: string;
};

function childrenOf(
  model: SessionBranchModel,
  parentId: string,
): SessionBranch[] {
  return model.branches.filter((branch) => branch.parentId === parentId);
}

function leafWeight(model: SessionBranchModel, id: string, memo: Map<string, number>): number {
  const cached = memo.get(id);
  if (cached != null) return cached;
  const kids = childrenOf(model, id);
  const weight = kids.length ? kids.reduce((sum, kid) => sum + leafWeight(model, kid.id, memo), 0) : 1;
  memo.set(id, weight);
  return weight;
}

export function layoutSessionBranchField(
  model: SessionBranchModel,
  width: number,
  height: number,
): { points: SessionBranchFieldPoint[]; edges: SessionBranchFieldEdge[] } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const padX = w * 0.06;
  const padY = h * 0.1;
  const innerW = Math.max(1, w - padX * 2);
  const innerH = Math.max(1, h - padY * 2);
  const maxDepth = Math.max(0, ...model.branches.map((branch) => branch.depth));
  const weights = new Map<string, number>();
  const root = model.branches.find((branch) => branch.id === model.rootId) ?? model.branches[0];
  const points: SessionBranchFieldPoint[] = [];
  const placed = new Set<string>();

  function place(branch: SessionBranch, x0: number, x1: number) {
    const x = (x0 + x1) / 2;
    const y = maxDepth <= 0 ? padY + innerH / 2 : padY + (branch.depth / maxDepth) * innerH;
    points.push({
      id: branch.id,
      x,
      y,
      depth: branch.depth,
      parentId: branch.parentId,
    });
    placed.add(branch.id);
    const kids = childrenOf(model, branch.id);
    const total = kids.reduce((sum, kid) => sum + leafWeight(model, kid.id, weights), 0) || 1;
    let cursor = x0;
    for (const kid of kids) {
      const span = (x1 - x0) * (leafWeight(model, kid.id, weights) / total);
      place(kid, cursor, cursor + span);
      cursor += span;
    }
  }

  if (root) place(root, padX, padX + innerW);

  for (const branch of model.branches) {
    if (placed.has(branch.id)) continue;
    points.push({
      id: branch.id,
      x: w / 2,
      y: h / 2,
      depth: branch.depth,
      parentId: branch.parentId,
    });
  }

  const ids = new Set(points.map((point) => point.id));
  const edges: SessionBranchFieldEdge[] = [];
  for (const point of points) {
    if (point.parentId && ids.has(point.parentId)) {
      edges.push({ from: point.parentId, to: point.id });
    }
  }
  return { points, edges };
}

export function sessionBranchPathFromRoot(
  model: SessionBranchModel,
  id: string | null | undefined,
): string[] {
  const byId = new Map(model.branches.map((branch) => [branch.id, branch]));
  const path: string[] = [];
  let cursor = String(id || "").trim();
  const seen = new Set<string>();
  while (cursor && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    path.push(cursor);
    cursor = byId.get(cursor)?.parentId ?? "";
  }
  path.reverse();
  return path;
}

/** Current stills plus every ancestor from the root. Everything else is fog. */
export function soundingRevealedIds(
  model: SessionBranchModel,
  stillIds: readonly string[],
): Set<string> {
  const revealed = new Set<string>();
  revealed.add(model.rootId);
  for (const id of stillIds) {
    for (const step of sessionBranchPathFromRoot(model, id)) {
      revealed.add(step);
    }
  }
  return revealed;
}
