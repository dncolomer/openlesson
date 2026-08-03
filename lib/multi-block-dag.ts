/**
 * Pure multi-select DAG helpers: "leads to" graph among a selected block
 * set only. Maps to next_block_ids. Prerequisite locks (lock_until) are
 * authored separately (map lock tool) and left untouched on Apply.
 * External next edges (outside the selection) are preserved on Apply.
 */

/** Visual connect canvas caps selection so the mini graph stays readable. */
export const MULTI_BLOCK_DAG_MAX_BLOCKS = 9;

export function multiBlockDagSelectionTooLarge(
  selectedCount: number,
  max = MULTI_BLOCK_DAG_MAX_BLOCKS,
): boolean {
  return Number(selectedCount) > max;
}

export type DagBlockRef = {
  id: string;
  title?: string | null;
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
};

/** Directed "leads to" edge among selected blocks (from → to). */
export type MultiBlockDagEdge = {
  from: string;
  to: string;
  /** Always "next" (leads to). "lock" kept for draft compatibility only. */
  kind: "next" | "lock";
};

export type MultiBlockDagDraft = {
  blockIds: string[];
  edges: MultiBlockDagEdge[];
};

export type MultiBlockDagApplyUpdate = {
  blockId: string;
  next_block_ids: string[];
  lock_until_block_ids: string[];
};

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function uniqIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Seed a draft graph from current next_block_ids only, restricted to the
 * multi-selected id set (edges that leave the set are omitted from the draft
 * but re-merged on apply). lock_until is not part of this graph.
 */
export function draftMultiBlockDag(
  selectedIds: readonly string[],
  blocks: readonly DagBlockRef[],
): MultiBlockDagDraft {
  const ids = uniqIds(selectedIds);
  const idSet = new Set(ids);
  const byId = new Map(
    blocks.filter((b) => b && cleanId(b.id)).map((b) => [cleanId(b.id), b]),
  );
  const edges: MultiBlockDagEdge[] = [];
  const edgeKey = new Set<string>();

  for (const id of ids) {
    const b = byId.get(id);
    if (!b) continue;
    for (const to of b.next_block_ids || []) {
      const t = cleanId(to);
      if (!t || t === id || !idSet.has(t)) continue;
      const k = `next:${id}->${t}`;
      if (edgeKey.has(k)) continue;
      edgeKey.add(k);
      edges.push({ from: id, to: t, kind: "next" });
    }
  }

  return { blockIds: ids, edges };
}

/** Toggle or set a leads-to edge in the draft (immutable). Always kind "next". */
export function setMultiBlockDagEdge(
  draft: MultiBlockDagDraft,
  edge: MultiBlockDagEdge,
  enabled: boolean,
): MultiBlockDagDraft {
  const from = cleanId(edge.from);
  const to = cleanId(edge.to);
  const kind = "next" as const;
  const idSet = new Set(draft.blockIds.map(cleanId).filter(Boolean));
  if (!from || !to || from === to) return draft;
  if (!idSet.has(from) || !idSet.has(to)) return draft;

  // Drop any legacy lock edges for this pair while editing leads-to.
  const rest = draft.edges.filter(
    (e) => !(e.from === from && e.to === to && (e.kind === kind || e.kind === "lock")),
  );
  // Keep only next edges in the working draft.
  const nextOnly = rest.filter((e) => e.kind === "next");
  if (!enabled) {
    return { blockIds: [...draft.blockIds], edges: nextOnly };
  }
  return {
    blockIds: [...draft.blockIds],
    edges: [...nextOnly, { from, to, kind }],
  };
}

export function hasMultiBlockDagEdge(
  draft: MultiBlockDagDraft,
  from: string,
  to: string,
  kind: "next" | "lock" = "next",
): boolean {
  const f = cleanId(from);
  const t = cleanId(to);
  // UI is leads-to only; treat lock queries as absent.
  if (kind === "lock") return false;
  return draft.edges.some(
    (e) => e.from === f && e.to === t && e.kind === "next",
  );
}

/**
 * Detect directed cycles among draft edges of a given kind (or all kinds).
 * Self-loops already forbidden by setMultiBlockDagEdge.
 */
export function multiBlockDagHasCycle(
  draft: MultiBlockDagDraft,
  kind?: "next" | "lock",
): boolean {
  const ids = draft.blockIds.map(cleanId).filter(Boolean);
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of draft.edges) {
    if (kind && e.kind !== kind) continue;
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const dfs = (u: string): boolean => {
    if (done.has(u)) return false;
    if (visiting.has(u)) return true;
    visiting.add(u);
    for (const v of adj.get(u) || []) {
      if (dfs(v)) return true;
    }
    visiting.delete(u);
    done.add(u);
    return false;
  };
  for (const id of ids) {
    if (dfs(id)) return true;
  }
  return false;
}

/**
 * Build per-block Apply updates: replace within-selection next edges with
 * draft leads-to edges; keep external next edges.
 *
 * Journey semantics: A leads-to B also means B is locked until A is done.
 * Within the selection, lock_until is set to the inverse of next edges
 * (external locks outside the selection are preserved).
 */
export function buildMultiBlockDagApplyUpdates(
  draft: MultiBlockDagDraft,
  blocks: readonly DagBlockRef[],
): MultiBlockDagApplyUpdate[] {
  const ids = uniqIds(draft.blockIds);
  const idSet = new Set(ids);
  const byId = new Map(
    blocks.filter((b) => b && cleanId(b.id)).map((b) => [cleanId(b.id), b]),
  );

  const nextByFrom = new Map<string, string[]>();
  /** Inverse of next: target → sources (prereqs for lock_until). */
  const lockByTo = new Map<string, string[]>();
  for (const id of ids) {
    nextByFrom.set(id, []);
    lockByTo.set(id, []);
  }
  for (const e of draft.edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) continue;
    // Only leads-to (next); ignore any legacy lock draft edges
    if (e.kind !== "next") continue;
    nextByFrom.get(e.from)!.push(e.to);
    lockByTo.get(e.to)!.push(e.from);
  }

  return ids.map((id) => {
    const existing = byId.get(id);
    const prevNext = (existing?.next_block_ids || [])
      .map(cleanId)
      .filter(Boolean);
    const prevLock = (existing?.lock_until_block_ids || [])
      .map(cleanId)
      .filter(Boolean);
    // External edges: point outside selection
    const externalNext = prevNext.filter((t) => t !== id && !idSet.has(t));
    const externalLock = prevLock.filter((t) => t !== id && !idSet.has(t));
    return {
      blockId: id,
      next_block_ids: uniqIds([
        ...externalNext,
        ...(nextByFrom.get(id) || []),
      ]),
      // Within selection: mirror next as lock-until so Learner sees Locked.
      lock_until_block_ids: uniqIds([
        ...externalLock,
        ...(lockByTo.get(id) || []),
      ]),
    };
  });
}

/** Count edges by kind (for UI badges / tests). */
export function multiBlockDagEdgeCounts(draft: MultiBlockDagDraft): {
  next: number;
  lock: number;
  total: number;
} {
  let next = 0;
  let lock = 0;
  for (const e of draft.edges) {
    if (e.kind === "next") next++;
    else lock++;
  }
  return { next, lock, total: next + lock };
}

// ── Visual connect layout ──────────────────────────────────────────────

export type MultiBlockDagLayoutNode = {
  id: string;
  title: string;
  /** Center X in canvas coords. */
  x: number;
  /** Center Y in canvas coords. */
  y: number;
};

export type MultiBlockDagLayoutOpts = {
  width?: number;
  height?: number;
  padding?: number;
};

const DEFAULT_DAG_LAYOUT = {
  width: 300,
  height: 200,
  padding: 36,
} as const;

/**
 * Place selected blocks for a mini connect canvas.
 * Prefer map (col,row) when present; otherwise a simple ring.
 */
export function layoutMultiBlockDagNodes(
  blocks: ReadonlyArray<{
    id: string;
    title?: string | null;
    position_x?: number | null;
    position_y?: number | null;
  }>,
  opts?: MultiBlockDagLayoutOpts,
): MultiBlockDagLayoutNode[] {
  const width = opts?.width ?? DEFAULT_DAG_LAYOUT.width;
  const height = opts?.height ?? DEFAULT_DAG_LAYOUT.height;
  const padding = opts?.padding ?? DEFAULT_DAG_LAYOUT.padding;
  const list = blocks
    .map((b) => ({
      id: cleanId(b.id),
      title: String(b.title || "").trim() || "Untitled",
      col: b.position_x,
      row: b.position_y,
    }))
    .filter((b) => b.id);
  if (list.length === 0) return [];

  const placed = list.filter(
    (b) =>
      typeof b.col === "number" &&
      Number.isFinite(b.col) &&
      typeof b.row === "number" &&
      Number.isFinite(b.row),
  );

  if (placed.length === list.length && list.length >= 1) {
    const cols = placed.map((b) => b.col as number);
    const rows = placed.map((b) => b.row as number);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const spanC = maxC - minC;
    const spanR = maxR - minR;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    return list.map((b) => {
      const c = (b.col as number) - minC;
      const r = (b.row as number) - minR;
      // Degenerate axis → center; otherwise scale into the padded box.
      const x =
        list.length === 1 || spanC === 0
          ? width / 2
          : padding + (c / spanC) * innerW;
      const y =
        list.length === 1 || spanR === 0
          ? height / 2
          : padding + (r / spanR) * innerH;
      return { id: b.id, title: b.title, x, y };
    });
  }

  // Ring fallback when map coords missing
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(innerRadius(width, height, padding), 72);
  const n = list.length;
  return list.map((b, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return {
      id: b.id,
      title: b.title,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}

function innerRadius(width: number, height: number, padding: number): number {
  return Math.max(24, Math.min(width, height) / 2 - padding);
}

/**
 * Resolve a connect gesture: toggle edge on if absent, off if present.
 * Same-node / invalid ids → no-op.
 */
export function resolveMultiBlockDagConnect(
  draft: MultiBlockDagDraft,
  from: string,
  to: string,
  _kind: "next" | "lock" = "next",
): { action: "none" } | { action: "toggle"; edge: MultiBlockDagEdge; enabled: boolean } {
  const f = cleanId(from);
  const t = cleanId(to);
  if (!f || !t || f === t) return { action: "none" };
  const idSet = new Set(draft.blockIds.map(cleanId).filter(Boolean));
  if (!idSet.has(f) || !idSet.has(t)) return { action: "none" };
  const enabled = !hasMultiBlockDagEdge(draft, f, t, "next");
  return {
    action: "toggle",
    edge: { from: f, to: t, kind: "next" },
    enabled,
  };
}

/**
 * Endpoint for an edge line between two node centers, shortened so the
 * arrowhead sits outside the node chip (approx half chip size).
 */
export function multiBlockDagEdgeEndpoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  nodeHalf = 28,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const inset = Math.min(nodeHalf, len / 3);
  return {
    x1: from.x + ux * inset,
    y1: from.y + uy * inset,
    x2: to.x - ux * inset,
    y2: to.y - uy * inset,
  };
}
