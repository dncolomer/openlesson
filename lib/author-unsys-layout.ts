/**
 * 2D tree layout for an author unsys-model seed, in the same family as
 * the public Integrals explainer (radial parent/sibling fan).
 */

import type { SessionBranch, SessionBranchModel } from "@/lib/session-branch-model";

export type AuthorUnsysGraphPoint = { x: number; y: number };

const REGION_COLORS = [
  "#d4b45a",
  "#5ab8b4",
  "#c47aa0",
  "#8aa0c8",
  "#c4a07a",
  "#7ab87a",
] as const;

export const AUTHOR_UNSYS_ROOT_COLOR = "#e8e8e8";

function childrenOf(
  model: SessionBranchModel,
  parentId: string,
): SessionBranch[] {
  return model.branches.filter((branch) => branch.parentId === parentId);
}

export function authorUnsysRegionColor(
  model: SessionBranchModel,
  branchId: string,
): string {
  let current = model.branches.find((branch) => branch.id === branchId);
  if (!current) return AUTHOR_UNSYS_ROOT_COLOR;
  while (current.parentId && current.parentId !== model.rootId) {
    const parent = model.branches.find((branch) => branch.id === current?.parentId);
    if (!parent) break;
    current = parent;
  }
  if (!current.parentId) return AUTHOR_UNSYS_ROOT_COLOR;
  const regions = childrenOf(model, model.rootId);
  const index = regions.findIndex((branch) => branch.id === current?.id);
  if (index < 0) return AUTHOR_UNSYS_ROOT_COLOR;
  return REGION_COLORS[index % REGION_COLORS.length]!;
}

export function layoutAuthorUnsysGraph(
  model: SessionBranchModel,
  width: number,
  height: number,
): Map<string, AuthorUnsysGraphPoint> {
  const map = new Map<string, AuthorUnsysGraphPoint>();
  const cx = Math.max(1, width) * 0.5;
  const cy = Math.max(1, height) * 0.52;
  const span = Math.min(Math.max(1, width), Math.max(1, height));
  map.set(model.rootId, { x: cx, y: cy });

  function place(parentId: string): void {
    const kids = childrenOf(model, parentId);
    if (!kids.length) return;
    const parent = map.get(parentId) ?? { x: cx, y: cy };
    kids.forEach((child, index) => {
      if (parentId === model.rootId) {
        const angle = (index / kids.length) * Math.PI * 2 - Math.PI / 2;
        const radius = span * (0.2 + Math.min(kids.length, 16) * 0.008);
        map.set(child.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      } else {
        const dx = parent.x - cx;
        const dy = parent.y - cy;
        const base = Math.atan2(dy, dx);
        const fan =
          kids.length <= 1
            ? 0
            : (index - (kids.length - 1) / 2) * (0.7 / Math.max(1, kids.length - 1));
        const radius = span * (0.11 + Math.min(child.depth, 4) * 0.01);
        map.set(child.id, {
          x: parent.x + Math.cos(base + fan) * radius,
          y: parent.y + Math.sin(base + fan) * radius,
        });
      }
      place(child.id);
    });
  }

  place(model.rootId);
  for (const branch of model.branches) {
    if (!map.has(branch.id)) map.set(branch.id, { x: cx, y: cy });
  }
  return map;
}

export function authorUnsysGraphEdges(
  model: SessionBranchModel,
): Array<{ from: string; to: string }> {
  return model.branches
    .filter((branch) => branch.parentId)
    .map((branch) => ({ from: branch.parentId as string, to: branch.id }));
}

export function authorUnsysActionSpokeLayout(
  origin: AuthorUnsysGraphPoint,
  count: number,
  radius = 96,
): AuthorUnsysGraphPoint[] {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  return Array.from({ length: n }, (_, index) => {
    const angle = (index / n) * Math.PI * 2 - Math.PI / 2;
    return {
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius,
    };
  });
}

export function seedAuthorUnsysPositions(
  model: SessionBranchModel,
  width: number,
  height: number,
  existing: Record<string, AuthorUnsysGraphPoint> = {},
): Record<string, AuthorUnsysGraphPoint> {
  const layout = layoutAuthorUnsysGraph(model, width, height);
  const next: Record<string, AuthorUnsysGraphPoint> = {};
  for (const branch of model.branches) {
    const kept = existing[branch.id];
    if (kept) {
      next[branch.id] = kept;
      continue;
    }
    const laid = layout.get(branch.id) ?? {
      x: Math.max(1, width) * 0.5,
      y: Math.max(1, height) * 0.52,
    };
    const parent = branch.parentId ? existing[branch.parentId] : null;
    const layoutParent = branch.parentId ? layout.get(branch.parentId) : null;
    if (parent && layoutParent) {
      next[branch.id] = {
        x: laid.x + (parent.x - layoutParent.x),
        y: laid.y + (parent.y - layoutParent.y),
      };
    } else {
      next[branch.id] = laid;
    }
  }
  return next;
}
