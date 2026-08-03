/**
 * First-class created-DAG records for a workspace.
 * Map multi-select Apply registers a DAG; the Creator DAGs tab lists/edits/deletes
 * those records. Edges live on blocks as next_block_ids; this list is identity.
 *
 * Fallback: graphs that only exist as next_block_ids (Apply before registry, or
 * registry write failed) are still listed via discovery so the DAGs tab is never empty
 * when the map has real leads-to structure.
 */

import {
  buildMultiBlockDagApplyUpdates,
  MULTI_BLOCK_DAG_MAX_BLOCKS,
  type DagBlockRef,
  type MultiBlockDagApplyUpdate,
  type MultiBlockDagDraft,
  type MultiBlockDagEdge,
} from "@/lib/multi-block-dag";

export type WorkspaceDagRecord = {
  id: string;
  blockIds: string[];
  /** Optional display title; empty → derived from block titles. */
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceDagListItem = WorkspaceDagRecord & {
  displayTitle: string;
  blockCount: number;
  missingBlockCount: number;
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

function isoNow(now?: string): string {
  if (now && String(now).trim()) return String(now).trim();
  return new Date().toISOString();
}

/** Stable-ish id for a new created DAG (no crypto required). */
export function newWorkspaceDagId(seed?: string | number): string {
  const s =
    seed !== undefined
      ? String(seed)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `dag_${s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
}

export function isWorkspaceDagRecord(value: unknown): value is WorkspaceDagRecord {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    cleanId(o.id).length > 0 &&
    Array.isArray(o.blockIds)
  );
}

/** Normalize jsonb / API payload into a clean record list. */
export function normalizeWorkspaceDags(raw: unknown): WorkspaceDagRecord[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { dags?: unknown }).dags)
      ? (raw as { dags: unknown[] }).dags
      : [];
  const out: WorkspaceDagRecord[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!isWorkspaceDagRecord(item)) continue;
    const id = cleanId(item.id);
    if (!id || seen.has(id)) continue;
    const blockIds = uniqIds(item.blockIds);
    if (blockIds.length < 2) continue;
    seen.add(id);
    out.push({
      id,
      blockIds,
      title: String(item.title || "").trim(),
      createdAt: String(item.createdAt || item.updatedAt || "").trim() || isoNow(),
      updatedAt: String(item.updatedAt || item.createdAt || "").trim() || isoNow(),
    });
  }
  return out;
}

export function findWorkspaceDag(
  dags: readonly WorkspaceDagRecord[],
  dagId: string,
): WorkspaceDagRecord | null {
  const id = cleanId(dagId);
  if (!id) return null;
  return dags.find((d) => d.id === id) || null;
}

/**
 * Derive list label from stored title or block titles among the DAG’s set.
 */
export function workspaceDagDisplayTitle(
  record: Pick<WorkspaceDagRecord, "title" | "blockIds">,
  blocks: readonly { id: string; title?: string | null }[],
): string {
  const stored = String(record.title || "").trim();
  if (stored) return stored;
  const byId = new Map(blocks.map((b) => [cleanId(b.id), b]));
  const titles = record.blockIds
    .map((id) => {
      const b = byId.get(cleanId(id));
      return String(b?.title || "").trim() || null;
    })
    .filter((t): t is string => Boolean(t));
  if (titles.length === 0) {
    return `DAG · ${record.blockIds.length} blocks`;
  }
  if (titles.length <= 3) return titles.join(" → ");
  return `${titles.slice(0, 2).join(" → ")} +${titles.length - 2}`;
}

/**
 * Stable id for a discovered component (from next_block_ids only).
 * Prefix `discovered_` so delete/edit can treat it as non-registry until saved.
 */
export function discoveredWorkspaceDagId(blockIds: readonly string[]): string {
  const key = uniqIds(blockIds).sort().join("|");
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `discovered_${(h >>> 0).toString(36)}`;
}

export function isDiscoveredWorkspaceDagId(id: string): boolean {
  return cleanId(id).startsWith("discovered_");
}

/**
 * Discover multi-block DAGs from live next_block_ids (undirected connected components).
 * Used when first-class workspace_dags is empty or incomplete.
 */
export function discoverWorkspaceDagsFromBlocks(
  blocks: readonly {
    id: string;
    title?: string | null;
    next_block_ids?: string[] | null;
  }[],
  now?: string,
): WorkspaceDagRecord[] {
  const ids = blocks.map((b) => cleanId(b.id)).filter(Boolean);
  if (ids.length < 2) return [];
  const idSet = new Set(ids);
  const parent = new Map<string, string>();
  for (const id of ids) parent.set(id, id);
  const find = (x: string): string => {
    let p = parent.get(x) || x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const b of blocks) {
    const from = cleanId(b.id);
    if (!from || !idSet.has(from)) continue;
    for (const raw of b.next_block_ids || []) {
      const to = cleanId(raw);
      if (!to || !idSet.has(to) || to === from) continue;
      union(from, to);
    }
  }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const list = groups.get(root) || [];
    list.push(id);
    groups.set(root, list);
  }

  const ts = isoNow(now);
  const out: WorkspaceDagRecord[] = [];
  for (const members of groups.values()) {
    // Only components that actually have ≥1 next edge among them
    const set = new Set(members);
    let hasEdge = false;
    for (const b of blocks) {
      const from = cleanId(b.id);
      if (!set.has(from)) continue;
      for (const raw of b.next_block_ids || []) {
        const to = cleanId(raw);
        if (set.has(to) && to !== from) {
          hasEdge = true;
          break;
        }
      }
      if (hasEdge) break;
    }
    if (!hasEdge || members.length < 2) continue;
    const blockIds = uniqIds(members).sort();
    out.push({
      id: discoveredWorkspaceDagId(blockIds),
      blockIds,
      title: "",
      createdAt: ts,
      updatedAt: ts,
    });
  }
  return out;
}

function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b.map(cleanId));
  return a.every((id) => sb.has(cleanId(id)));
}

/** True if every id in `subset` is present in `superset`. */
function isIdSubset(subset: readonly string[], superset: readonly string[]): boolean {
  const s = new Set(superset.map(cleanId));
  return subset.every((id) => s.has(cleanId(id)));
}

/**
 * Resolve a DAG for delete/edit: registry record, or discovered component by id.
 */
export function resolveWorkspaceDagForMutation(
  raw: unknown,
  dagId: string,
  blocks: readonly {
    id: string;
    title?: string | null;
    next_block_ids?: string[] | null;
  }[],
): WorkspaceDagRecord | null {
  const id = cleanId(dagId);
  if (!id) return null;
  const registered = findWorkspaceDag(normalizeWorkspaceDags(raw), id);
  if (registered) return registered;
  const discovered = discoverWorkspaceDagsFromBlocks(blocks);
  return discovered.find((d) => d.id === id) || null;
}

/** List items for the DAGs tab (sorted newest updated first). */
export function listWorkspaceDagsForTab(
  raw: unknown,
  blocks: readonly {
    id: string;
    title?: string | null;
    next_block_ids?: string[] | null;
  }[],
): WorkspaceDagListItem[] {
  const registered = normalizeWorkspaceDags(raw);
  const discovered = discoverWorkspaceDagsFromBlocks(blocks);
  const dags: WorkspaceDagRecord[] = [...registered];
  for (const d of discovered) {
    // Skip if already registered as the same set or fully covered by a managed DAG
    if (
      registered.some(
        (r) =>
          sameIdSet(r.blockIds, d.blockIds) ||
          isIdSubset(d.blockIds, r.blockIds),
      )
    ) {
      continue;
    }
    dags.push(d);
  }

  const live = new Set(blocks.map((b) => cleanId(b.id)).filter(Boolean));
  return dags
    .map((d) => {
      const present = d.blockIds.filter((id) => live.has(id));
      const missingBlockCount = d.blockIds.length - present.length;
      return {
        ...d,
        // Prefer live membership for display counts
        blockIds: present.length >= 2 ? present : d.blockIds,
        displayTitle: workspaceDagDisplayTitle(
          { title: d.title, blockIds: present.length >= 2 ? present : d.blockIds },
          blocks,
        ),
        blockCount: present.length >= 2 ? present.length : d.blockIds.length,
        missingBlockCount,
      };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/**
 * Register or update a created DAG when multi-select Apply (create) or tab edit succeeds.
 * - With dagId: update existing (edit path).
 * - Without: create new record (map multi-select create path).
 */
export function registerWorkspaceDagOnApply(
  existing: readonly WorkspaceDagRecord[] | unknown,
  input: {
    dagId?: string | null;
    blockIds: readonly string[];
    title?: string | null;
    now?: string;
  },
): { dags: WorkspaceDagRecord[]; record: WorkspaceDagRecord; created: boolean } {
  const prev = normalizeWorkspaceDags(existing);
  const blockIds = uniqIds(input.blockIds);
  if (blockIds.length < 2) {
    throw new Error("DAG requires at least 2 blocks");
  }
  if (blockIds.length > MULTI_BLOCK_DAG_MAX_BLOCKS) {
    throw new Error(
      `You can only have ${MULTI_BLOCK_DAG_MAX_BLOCKS} blocks selected at once`,
    );
  }
  const now = isoNow(input.now);
  const title = String(input.title || "").trim();
  const dagId = cleanId(input.dagId);
  if (dagId) {
    const idx = prev.findIndex((d) => d.id === dagId);
    if (idx >= 0) {
      const record: WorkspaceDagRecord = {
        ...prev[idx],
        blockIds,
        title: title || prev[idx].title,
        updatedAt: now,
      };
      const dags = [...prev];
      dags[idx] = record;
      return { dags, record, created: false };
    }
    // Unknown id → treat as create with that id
    const record: WorkspaceDagRecord = {
      id: dagId,
      blockIds,
      title,
      createdAt: now,
      updatedAt: now,
    };
    return { dags: [...prev, record], record, created: true };
  }
  const record: WorkspaceDagRecord = {
    id: newWorkspaceDagId(),
    blockIds,
    title,
    createdAt: now,
    updatedAt: now,
  };
  return { dags: [...prev, record], record, created: true };
}

/** Remove a created-DAG record (does not touch block edges — call delete updates separately). */
export function removeWorkspaceDag(
  existing: readonly WorkspaceDagRecord[] | unknown,
  dagId: string,
): WorkspaceDagRecord[] {
  const id = cleanId(dagId);
  return normalizeWorkspaceDags(existing).filter((d) => d.id !== id);
}

/**
 * Edit apply: same leads-to draft model as multi-select DAG.
 * Returns per-block next/lock updates (locks preserved by multi-block helper).
 */
export function buildWorkspaceDagEditUpdates(
  draft: MultiBlockDagDraft,
  blocks: readonly DagBlockRef[],
): MultiBlockDagApplyUpdate[] {
  return buildMultiBlockDagApplyUpdates(draft, blocks);
}

/**
 * Delete apply: clear within-DAG next links; keep external next + all locks.
 */
export function buildWorkspaceDagDeleteUpdates(
  blockIds: readonly string[],
  blocks: readonly DagBlockRef[],
): MultiBlockDagApplyUpdate[] {
  const draft: MultiBlockDagDraft = {
    blockIds: uniqIds(blockIds),
    edges: [],
  };
  return buildMultiBlockDagApplyUpdates(draft, blocks);
}

/** Seed edit draft from live block next edges among the DAG’s block set. */
export function seedWorkspaceDagEditDraft(
  record: Pick<WorkspaceDagRecord, "blockIds">,
  blocks: readonly DagBlockRef[],
): MultiBlockDagDraft {
  const blockIds = uniqIds(record.blockIds);
  const idSet = new Set(blockIds);
  const byId = new Map(
    blocks.filter((b) => b && cleanId(b.id)).map((b) => [cleanId(b.id), b]),
  );
  const edges: MultiBlockDagEdge[] = [];
  const edgeKey = new Set<string>();
  for (const id of blockIds) {
    const b = byId.get(id);
    if (!b) continue;
    for (const to of b.next_block_ids || []) {
      const t = cleanId(to);
      if (!t || t === id || !idSet.has(t)) continue;
      const k = `${id}->${t}`;
      if (edgeKey.has(k)) continue;
      edgeKey.add(k);
      edges.push({ from: id, to: t, kind: "next" });
    }
  }
  return { blockIds, edges };
}

/**
 * Whether Creator nav should include DAGs.
 * Owner-only: edit/delete hit grid-ops as the workspace owner (org-admin alone cannot mutate).
 */
export function canAccessWorkspaceDagsSection(options: {
  isOwner?: boolean;
  isOrgAdmin?: boolean;
}): boolean {
  return Boolean(options.isOwner);
}
