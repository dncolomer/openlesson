/**
 * Generic uncertainty-model tree specs for slow-create API / MCP.
 * Canonical persist shape is still { model: SessionBranchModel }.
 */

import {
  normalizeAuthorUnsysModel,
  normalizeAuthorUnsysModelSeed,
  type AuthorUnsysModelSeed,
} from "@/lib/author-unsys-model";
import {
  normalizeSessionBranchModel,
  type SessionBranch,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

const WRAPPER_KEYS = [
  "tree",
  "graph",
  "unsys",
  "unsys_model",
  "unsysModel",
  "uncertainty_model",
  "uncertaintyModel",
  "spec",
] as const;

export const UNSYS_SEED_BODY_KEYS = [
  "answers_model_seed",
  "answersModelSeed",
  "uncertainty_model",
  "uncertaintyModel",
  "unsys_model",
  "unsysModel",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : fallback;
}

function priceOf(value: unknown, fallback = 20): number {
  const price = Number(value);
  if (!Number.isFinite(price)) return fallback;
  return Math.max(0, Math.min(100, Math.round(price)));
}

function edgePriceOf(row: Record<string, unknown>, fallback = 20): number {
  return priceOf(
    row.weight ?? row.price ?? row.cost ?? row.edgePrice ?? row.w ?? row.mass,
    fallback,
  );
}

export function decodeUnsysSeedPayload(raw: unknown, depth = 0): unknown {
  if (depth > 4) return raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    try {
      return decodeUnsysSeedPayload(JSON.parse(text) as unknown, depth + 1);
    } catch {
      return null;
    }
  }
  return raw;
}

function unwrapTreeSpec(raw: unknown, depth = 0): unknown {
  if (depth > 4) return raw;
  const row = asRecord(raw);
  if (!row) return raw;
  for (const key of WRAPPER_KEYS) {
    if (row[key] != null && typeof row[key] === "object") {
      return unwrapTreeSpec(row[key], depth + 1);
    }
  }
  return raw;
}

function nodeTitle(row: Record<string, unknown>, fallback: string): string {
  return (
    textOf(row.title) ||
    textOf(row.name) ||
    textOf(row.label) ||
    textOf(row.state) ||
    textOf(row.id) ||
    fallback
  );
}

function nestedKids(row: Record<string, unknown>): unknown[] {
  for (const key of ["children", "nodes", "branches", "regions", "states"]) {
    const value = row[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function aliasNestedNode(raw: unknown, fallbackTitle: string): Record<string, unknown> {
  const row = asRecord(raw) ?? {};
  const kids = nestedKids(row);
  return {
    title: nodeTitle(row, fallbackTitle),
    question: textOf(row.question),
    observation: textOf(row.observation) || textOf(row.obs) || nodeTitle(row, fallbackTitle),
    territory: textOf(row.territory) || textOf(row.state) || nodeTitle(row, fallbackTitle),
    edgePrice: edgePriceOf(row),
    children: kids.map((child, index) =>
      aliasNestedNode(child, `${fallbackTitle} ${index + 1}`),
    ),
  };
}

function fromNestedTree(raw: unknown): SessionBranchModel | null {
  const row = asRecord(raw);
  if (!row) return null;
  const kids = nestedKids(row);
  if (!kids.length) return null;
  const title = nodeTitle(row, textOf(row.chapterTitle, "Uncertainty model"));
  return normalizeSessionBranchModel(
    {
      ...aliasNestedNode(row, title),
      premise: textOf(row.premise) || title,
      chapterTitle: title,
    },
    title,
  );
}

function listedNodes(row: Record<string, unknown>): unknown[] {
  for (const key of ["nodes", "states", "vertices", "hidden_states", "hiddenStates"]) {
    const value = row[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function listedEdges(row: Record<string, unknown>): unknown[] {
  for (const key of ["edges", "links", "transitions", "arcs"]) {
    const value = row[key];
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function edgeEnds(raw: unknown): { from: string; to: string; price: number } | null {
  const row = asRecord(raw);
  if (!row) return null;
  const from = textOf(
    row.from ?? row.fromId ?? row.source ?? row.parent ?? row.parentId ?? row.src,
  );
  const to = textOf(
    row.to ?? row.toId ?? row.target ?? row.child ?? row.childId ?? row.dst,
  );
  if (!from || !to || from === to) return null;
  return { from, to, price: edgePriceOf(row) };
}

function fromNodeEdgeGraph(raw: unknown): SessionBranchModel | null {
  const row = asRecord(raw);
  if (!row) return null;
  const nodeRows = listedNodes(row);
  const edgeRows = listedEdges(row).map(edgeEnds).filter(Boolean) as Array<{
    from: string;
    to: string;
    price: number;
  }>;
  if (!nodeRows.length && !edgeRows.length) return null;
  if (nodeRows.length && !edgeRows.length) {
    nodeRows.forEach((item) => {
      const rec = asRecord(item);
      if (!rec) return;
      const id = textOf(rec.id ?? rec.key);
      const parent = textOf(rec.parentId ?? rec.parent ?? rec.from);
      if (!id || !parent) return;
      edgeRows.push({ from: parent, to: id, price: edgePriceOf(rec) });
    });
    if (!edgeRows.length) return null;
  }
  if (!nodeRows.length && edgeRows.length) {
    const ids = new Set<string>();
    for (const edge of edgeRows) {
      ids.add(edge.from);
      ids.add(edge.to);
    }
    for (const id of ids) nodeRows.push({ id, title: id });
  }

  const nodes = new Map<string, Record<string, unknown>>();
  nodeRows.forEach((item, index) => {
    const rec = asRecord(item) ?? { id: String(item), title: String(item) };
    const id = textOf(rec.id ?? rec.key, `n${index + 1}`);
    if (!id || nodes.has(id)) return;
    nodes.set(id, rec);
  });
  for (const edge of edgeRows) {
    if (!nodes.has(edge.from)) nodes.set(edge.from, { id: edge.from, title: edge.from });
    if (!nodes.has(edge.to)) nodes.set(edge.to, { id: edge.to, title: edge.to });
  }
  if (!nodes.size) return null;

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, Array<{ to: string; price: number }>>();
  const parentOf = new Map<string, string>();
  for (const edge of edgeRows) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    if (!parentOf.has(edge.to)) parentOf.set(edge.to, edge.from);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), { to: edge.to, price: edge.price }]);
  }

  const declaredRoot = textOf(row.rootId ?? row.root_id ?? row.root);
  const roots = [...nodes.keys()].filter((id) => !parentOf.has(id));
  const rootId =
    (declaredRoot && nodes.has(declaredRoot) && declaredRoot) ||
    (nodes.has("root") ? "root" : null) ||
    roots[0] ||
    [...nodes.keys()][0]!;

  const depth = new Map<string, number>();
  const queue = [rootId];
  depth.set(rootId, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of outgoing.get(id) ?? []) {
      if (depth.has(edge.to)) continue;
      depth.set(edge.to, (depth.get(id) ?? 0) + 1);
      queue.push(edge.to);
    }
  }

  const title = textOf(row.chapterTitle, nodeTitle(nodes.get(rootId) || {}, "Uncertainty model"));
  const branches: SessionBranch[] = [...nodes.entries()].map(([id, rec]) => {
    const parentId = id === rootId ? null : parentOf.get(id) ?? null;
    const nodeDepth = depth.get(id) ?? (parentId == null ? 0 : 1);
    const label = nodeTitle(rec, id);
    const kids = outgoing.get(id) ?? [];
    return {
      id,
      parentId,
      title: label,
      question: textOf(rec.question),
      territory: textOf(rec.territory) || textOf(rec.state) || label,
      observation: textOf(rec.observation) || textOf(rec.obs) || label,
      depth: nodeDepth,
      status: nodeDepth <= 1 ? "open" : "latent",
      edges: kids.map((edge) => ({ toId: edge.to, price: edge.price })),
    };
  });

  const built: SessionBranchModel = {
    chapterTitle: title,
    rootId,
    focusId: rootId,
    step: 0,
    branches,
    boardNotes: branches
      .filter((branch) => branch.observation.trim())
      .map((branch) => ({ key: branch.id, text: branch.observation })),
  };
  return normalizeAuthorUnsysModel(built);
}

export function hydrateGenericUnsysTreeSpec(raw: unknown): AuthorUnsysModelSeed | null {
  const decoded = unwrapTreeSpec(decodeUnsysSeedPayload(raw));
  const canonical = normalizeAuthorUnsysModelSeed(decoded);
  if (canonical) return canonical;
  const graph = fromNodeEdgeGraph(decoded);
  if (graph) return { model: graph };
  const nested = fromNestedTree(decoded);
  if (nested) return { model: nested };
  return null;
}

export function parseUnsysSeedSpec(raw: unknown): AuthorUnsysModelSeed | null {
  const decoded = decodeUnsysSeedPayload(raw);
  return normalizeAuthorUnsysModelSeed(decoded) ?? hydrateGenericUnsysTreeSpec(decoded);
}

export function unsysSeedFromRequestBody(
  body: Record<string, unknown> | null | undefined,
): unknown {
  if (!body) return undefined;
  for (const key of UNSYS_SEED_BODY_KEYS) {
    if (body[key] !== undefined) return body[key];
  }
  return undefined;
}

export function requestHasUnsysSeed(
  body: Record<string, unknown> | null | undefined,
): boolean {
  return unsysSeedFromRequestBody(body) !== undefined;
}
