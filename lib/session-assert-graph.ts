import {
  sessionBranchById,
  type SessionBranch,
  type SessionBranchModel,
  type SessionBranchStatus,
} from "@/lib/session-branch-model";

export const SESSION_ASSERT_GRAPH_WIDTH = 280;
const CENTER = SESSION_ASSERT_GRAPH_WIDTH / 2;
/** Leaves sit inside the focus frame, which is 9px past the outer ring. */
const OUTER = CENTER - 16;

export type SessionAssertGraphNode = {
  id: string;
  parentId: string | null;
  title: string;
  depth: number;
  status: SessionBranchStatus;
  focused: boolean;
  x: number;
  y: number;
};

export type SessionAssertGraphEdge = {
  from: string;
  to: string;
};

export type SessionAssertGraphRing = {
  depth: number;
  radius: number;
};

export type SessionAssertGraphLayout = {
  width: number;
  height: number;
  nodes: SessionAssertGraphNode[];
  edges: SessionAssertGraphEdge[];
  rings: SessionAssertGraphRing[];
  focus: SessionBranch | null;
};

/** Stable ring positions. Later branches fade onto the ring they already belong to. */
export function layoutSessionAssertGraph(model: SessionBranchModel): SessionAssertGraphLayout {
  const children = new Map<string | null, SessionBranch[]>();
  for (const branch of model.branches) {
    const list = children.get(branch.parentId) ?? [];
    list.push(branch);
    children.set(branch.parentId, list);
  }
  const maxDepth = model.branches.reduce((max, branch) => Math.max(max, branch.depth), 0);
  const radiusFor = (depth: number) => (maxDepth === 0 || depth <= 0 ? 0 : (depth / maxDepth) * OUTER);
  const nodes: SessionAssertGraphNode[] = [];
  const place = (parentId: string | null, a0: number, a1: number) => {
    const kids = children.get(parentId) ?? [];
    if (!kids.length) return;
    const span = (a1 - a0) / kids.length;
    kids.forEach((branch, index) => {
      const left = a0 + span * index;
      const right = left + span;
      const angle = (left + right) / 2;
      const radius = radiusFor(branch.depth);
      nodes.push({
        id: branch.id,
        parentId: branch.parentId,
        title: branch.title,
        depth: branch.depth,
        status: branch.status,
        focused: branch.id === model.focusId,
        x: CENTER + radius * Math.cos(angle),
        y: CENTER + radius * Math.sin(angle),
      });
      place(branch.id, left, right);
    });
  };
  place(null, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = nodes.flatMap((node) => {
    if (!node.parentId || !byId.has(node.parentId)) return [];
    return [{ from: node.parentId, to: node.id }];
  });
  const rings = [...new Set(nodes.map((node) => node.depth).filter((depth) => depth > 0))]
    .sort((a, b) => a - b)
    .map((depth) => ({ depth, radius: radiusFor(depth) }));
  return {
    width: SESSION_ASSERT_GRAPH_WIDTH,
    height: SESSION_ASSERT_GRAPH_WIDTH,
    nodes,
    edges,
    rings,
    focus: sessionBranchById(model, model.focusId),
  };
}

/** Root first, then each deeper ring from left to right. */
export function sessionAssertRevealOrder(model: SessionBranchModel): string[] {
  return layoutSessionAssertGraph(model)
    .nodes.slice()
    .sort((a, b) => a.depth - b.depth || a.x - b.x || a.id.localeCompare(b.id))
    .map((node) => node.id);
}

export function cheapestAssertAction(branch: SessionBranch | null | undefined): string | null {
  if (!branch) return null;
  const ranked = branch.actions
    .filter((action) => action.id !== "insight")
    .slice()
    .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  return ranked[0]?.id ?? branch.actions.find((action) => action.id === "insight")?.id ?? null;
}
