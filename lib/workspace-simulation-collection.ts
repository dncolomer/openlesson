/**
 * Durable curated Simulation collection (workspace-scoped).
 * Items are generated from block / multi-block / workspace simulation runs,
 * then authors can edit/delete before using them as Suggest from Simulation
 * context for map authoring.
 *
 * Pure helpers — unit-tested without React/DB.
 */

import type { SimulateInsightsJob } from "@/lib/simulate-insights";

export type SimulationCollectionItemKind = "insight";

export type SimulationCollectionOrigin =
  | { kind: "workspace" }
  | { kind: "block"; blockId: string; blockTitle?: string | null }
  | { kind: "multi_block"; blockIds: string[]; blockTitles?: string[] | null };

export type SimulationCollectionItem = {
  id: string;
  title: string;
  body: string;
  /** Origin of the rehearsal that produced this insight. */
  origin: SimulationCollectionOrigin;
  /** Soft remove — list reads skip removed unless includeRemoved. */
  removed?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SimulationCollection = {
  items: SimulationCollectionItem[];
  /** In-progress and finished Simulate Insights jobs. */
  jobs: SimulateInsightsJob[];
  updatedAt: string | null;
};

export function emptySimulationCollection(): SimulationCollection {
  return { items: [], jobs: [], updatedAt: null };
}

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Stable identity for a kept insight (title + body). */
export function simulationCollectionItemKey(title: string, body: string): string {
  return `${clean(title).toLowerCase()}\n${clean(body).toLowerCase()}`;
}

export function simulationCollectionActiveKeys(
  collection: SimulationCollection | null | undefined,
): Set<string> {
  const col = normalizeSimulationCollection(collection ?? null);
  const keys = new Set<string>();
  for (const item of col.items) {
    if (item.removed) continue;
    keys.add(simulationCollectionItemKey(item.title, item.body));
  }
  return keys;
}

/** Normalize origin from raw JSON. */
export function normalizeSimulationCollectionOrigin(
  raw: unknown,
): SimulationCollectionOrigin {
  if (!raw || typeof raw !== "object") return { kind: "workspace" };
  const rec = raw as Record<string, unknown>;
  const kind = clean(rec.kind).toLowerCase();
  if (kind === "block") {
    const blockId = clean(rec.blockId ?? rec.block_id);
    if (!blockId) return { kind: "workspace" };
    return {
      kind: "block",
      blockId,
      blockTitle: clean(rec.blockTitle ?? rec.block_title) || null,
    };
  }
  if (kind === "multi_block" || kind === "multiblock" || kind === "multi-block") {
    const idsRaw = Array.isArray(rec.blockIds)
      ? rec.blockIds
      : Array.isArray(rec.block_ids)
        ? rec.block_ids
        : [];
    const blockIds = idsRaw
      .map((id) => clean(id))
      .filter(Boolean);
    if (blockIds.length === 0) return { kind: "workspace" };
    if (blockIds.length === 1) {
      return {
        kind: "block",
        blockId: blockIds[0]!,
        blockTitle: null,
      };
    }
    const titlesRaw = Array.isArray(rec.blockTitles)
      ? rec.blockTitles
      : Array.isArray(rec.block_titles)
        ? rec.block_titles
        : null;
    return {
      kind: "multi_block",
      blockIds,
      blockTitles: titlesRaw
        ? titlesRaw.map((t) => clean(t) || "")
        : null,
    };
  }
  return { kind: "workspace" };
}

/**
 * Parse a kept insight. Question/exercise rows from the previous simulation
 * are discarded and do not become kept insights.
 */
export function parseSimulationCollectionItem(
  raw: unknown,
): SimulationCollectionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const kindRaw = clean(rec.kind ?? rec.type).toLowerCase();
  if (kindRaw === "question" || kindRaw === "exercise" || kindRaw === "solo") {
    return null;
  }
  const title = clean(rec.title);
  const body = clean(rec.body ?? rec.insight);
  if (title.length < 2 || body.length < 8) return null;
  const id = clean(rec.id) || makeId("insight");
  const createdAt = clean(rec.createdAt ?? rec.created_at) || nowIso();
  const updatedAt = clean(rec.updatedAt ?? rec.updated_at) || createdAt;
  return {
    id,
    title,
    body,
    origin: normalizeSimulationCollectionOrigin(rec.origin),
    removed: rec.removed === true,
    createdAt,
    updatedAt,
  };
}

function parseStoredJob(raw: unknown): SimulateInsightsJob | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = clean(rec.id);
  const status = clean(rec.status);
  if (!id) return null;
  if (status !== "running" && status !== "completed" && status !== "error") return null;
  const scopeRaw = clean(rec.scope);
  const scope =
    scopeRaw === "block" || scopeRaw === "multi_block" || scopeRaw === "workspace"
      ? scopeRaw
      : "workspace";
  const insights = Array.isArray(rec.insights)
    ? rec.insights
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const item = row as Record<string, unknown>;
          const title = clean(item.title);
          const body = clean(item.body);
          if (title.length < 2 || body.length < 8) return null;
          return { id: clean(item.id) || makeId("insight"), title, body };
        })
        .filter((row): row is { id: string; title: string; body: string } => Boolean(row))
    : [];
  const completedSteps = Number(rec.completedSteps ?? rec.completed_steps ?? 0);
  return {
    id,
    status,
    completedSteps: Number.isFinite(completedSteps) ? completedSteps : 0,
    insights: status === "completed" && completedSteps >= 2 ? insights : [],
    error: clean(rec.error) || null,
    scope,
    blockId: clean(rec.blockId ?? rec.block_id) || null,
    blockIds: Array.isArray(rec.blockIds)
      ? rec.blockIds.map((id) => clean(id)).filter(Boolean)
      : [],
    createdAt: clean(rec.createdAt ?? rec.created_at) || nowIso(),
    updatedAt: clean(rec.updatedAt ?? rec.updated_at) || nowIso(),
  };
}

/** Normalize full collection payload (DB jsonb or API body). */
export function normalizeSimulationCollection(raw: unknown): SimulationCollection {
  if (!raw || typeof raw !== "object") return emptySimulationCollection();
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(rec.items)
    ? rec.items
    : Array.isArray(raw)
      ? (raw as unknown[])
      : [];
  const items: SimulationCollectionItem[] = [];
  const seen = new Set<string>();
  for (const row of list) {
    const item = parseSimulationCollectionItem(row);
    if (!item) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  const jobs: SimulateInsightsJob[] = [];
  const jobRows = Array.isArray(rec.jobs) ? rec.jobs : [];
  for (const row of jobRows) {
    const job = parseStoredJob(row);
    if (!job) continue;
    jobs.push(job);
  }
  return {
    items,
    jobs,
    updatedAt: clean(rec.updatedAt ?? rec.updated_at) || null,
  };
}

/** Active (non-removed) items, newest first. */
export function listSimulationCollectionItems(
  collection: SimulationCollection | null | undefined,
  opts?: { includeRemoved?: boolean; kind?: SimulationCollectionItemKind | null },
): SimulationCollectionItem[] {
  const col = normalizeSimulationCollection(collection ?? null);
  let items = col.items;
  if (!opts?.includeRemoved) {
    items = items.filter((i) => !i.removed);
  }
  if (opts?.kind && opts.kind !== "insight") {
    items = [];
  }
  return [...items].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

/** Keep insight candidates the author wants learners to discover. */
export function keepSimulatedInsights(
  collection: SimulationCollection | null | undefined,
  input: {
    insights: ReadonlyArray<{ id?: string; title?: string | null; body?: string | null }>;
    origin?: SimulationCollectionOrigin;
  },
): SimulationCollection {
  const col = normalizeSimulationCollection(collection ?? null);
  const ts = nowIso();
  const next = [...col.items];
  const activeKeys = new Set(
    next
      .filter((item) => !item.removed)
      .map((item) => simulationCollectionItemKey(item.title, item.body)),
  );
  for (const insight of input.insights) {
    const title = clean(insight.title);
    const body = clean(insight.body);
    if (title.length < 2 || body.length < 8) continue;
    const key = simulationCollectionItemKey(title, body);
    if (activeKeys.has(key)) continue;
    const removedIdx = next.findIndex(
      (item) => item.removed && simulationCollectionItemKey(item.title, item.body) === key,
    );
    if (removedIdx >= 0) {
      next[removedIdx] = {
        ...next[removedIdx]!,
        removed: false,
        origin: input.origin ?? next[removedIdx]!.origin,
        updatedAt: ts,
      };
      activeKeys.add(key);
      continue;
    }
    next.push({
      id: clean(insight.id) || makeId("insight"),
      title,
      body,
      origin: input.origin ?? { kind: "workspace" },
      removed: false,
      createdAt: ts,
      updatedAt: ts,
    });
    activeKeys.add(key);
  }
  return { items: next, jobs: col.jobs, updatedAt: ts };
}

/** @deprecated Question/exercise deposits are discarded. Use keepSimulatedInsights. */
export function appendSimulationCollectionItems(
  collection: SimulationCollection | null | undefined,
  _inputs: unknown,
): SimulationCollection {
  void _inputs;
  return normalizeSimulationCollection(collection ?? null);
}

/**
 * Legacy question/exercise deposits are discarded.
 * Pass `insights` to keep craftable insight candidates.
 */
export function depositSimulationGeneration(
  collection: SimulationCollection | null | undefined,
  input: {
    questions?: string[] | null;
    exercises?: string[] | null;
    probes?: readonly unknown[] | null;
    insights?: ReadonlyArray<{ title?: string | null; body?: string | null }> | null;
    origin: SimulationCollectionOrigin;
    modifierPrompt?: string | null;
  },
): SimulationCollection {
  void input.questions;
  void input.exercises;
  void input.probes;
  void input.modifierPrompt;
  if (input.insights?.length) {
    return keepSimulatedInsights(collection, {
      insights: input.insights,
      origin: input.origin,
    });
  }
  return normalizeSimulationCollection(collection ?? null);
}

/** Update a kept insight; null if not found. */
export function updateSimulationCollectionItem(
  collection: SimulationCollection | null | undefined,
  itemId: string,
  patch: {
    title?: string;
    body?: string;
    text?: string;
  },
): SimulationCollection | null {
  const col = normalizeSimulationCollection(collection ?? null);
  const id = clean(itemId);
  if (!id) return null;
  const idx = col.items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const prev = col.items[idx]!;
  const ts = nowIso();
  const title = patch.title !== undefined ? clean(patch.title) : prev.title;
  const body =
    patch.body !== undefined
      ? clean(patch.body)
      : patch.text !== undefined
        ? clean(patch.text)
        : prev.body;
  if (title.length < 2 || body.length < 8) return null;
  const next = [...col.items];
  next[idx] = { ...prev, title, body, updatedAt: ts };
  return { items: next, jobs: col.jobs, updatedAt: ts };
}

/** Soft-delete (removed flag). */
export function removeSimulationCollectionItem(
  collection: SimulationCollection | null | undefined,
  itemId: string,
): SimulationCollection | null {
  const col = normalizeSimulationCollection(collection ?? null);
  const id = clean(itemId);
  if (!id) return null;
  const idx = col.items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const ts = nowIso();
  const next = [...col.items];
  next[idx] = { ...next[idx]!, removed: true, updatedAt: ts };
  return { items: next, jobs: col.jobs, updatedAt: ts };
}

/** Hard-delete (drop from array). */
export function hardDeleteSimulationCollectionItem(
  collection: SimulationCollection | null | undefined,
  itemId: string,
): SimulationCollection | null {
  const col = normalizeSimulationCollection(collection ?? null);
  const id = clean(itemId);
  if (!id) return null;
  const next = col.items.filter((i) => i.id !== id);
  if (next.length === col.items.length) return null;
  return { items: next, jobs: col.jobs, updatedAt: nowIso() };
}

/** True when stored JSON still has question/exercise rows to drop. */
export function simulationCollectionHasLegacyRows(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const items = Array.isArray((raw as { items?: unknown }).items)
    ? ((raw as { items: unknown[] }).items)
    : [];
  return items.some((row) => {
    if (!row || typeof row !== "object") return false;
    const kind = String(
      (row as { kind?: unknown }).kind || (row as { type?: unknown }).type || "",
    ).toLowerCase();
    return kind === "question" || kind === "exercise" || kind === "solo";
  });
}

/**
 * Write one job onto the latest collection. Retries when the saved version
 * changed, so a Keep or Remove that landed after the read is not overwritten.
 */
export async function commitSimulationJob(input: {
  job: SimulateInsightsJob;
  load: () => Promise<SimulationCollection>;
  saveIfVersion: (
    next: SimulationCollection,
    expectedVersion: string | null,
  ) => Promise<boolean>;
  attempts?: number;
}): Promise<SimulationCollection> {
  const attempts = Math.max(1, input.attempts ?? 5);
  for (let i = 0; i < attempts; i++) {
    const latest = normalizeSimulationCollection(await input.load());
    const next = upsertSimulationJob(latest, input.job);
    if (await input.saveIfVersion(next, latest.updatedAt)) return next;
  }
  throw new Error("Could not save the simulation job without dropping kept insights");
}

/** Replace or insert one Simulate Insights job on the collection. */
export function upsertSimulationJob(
  collection: SimulationCollection | null | undefined,
  job: SimulateInsightsJob,
): SimulationCollection {
  const col = normalizeSimulationCollection(collection ?? null);
  const jobs = col.jobs.filter((row) => row.id !== job.id);
  jobs.push(job);
  return { ...col, jobs: jobs.slice(-12), updatedAt: nowIso() };
}

/** Wire shape for DB jsonb column. */
export function serializeSimulationCollection(
  collection: SimulationCollection,
): Record<string, unknown> {
  const col = normalizeSimulationCollection(collection);
  return {
    items: col.items.map((i) => ({
      id: i.id,
      title: i.title,
      body: i.body,
      origin: i.origin,
      removed: Boolean(i.removed),
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    })),
    jobs: col.jobs,
    updated_at: col.updatedAt,
  };
}

/**
 * Append modifier prompt guidance into a generation system/user prompt pair.
 * Pure — used by API routes and unit tests.
 */
export function applySimulationModifierToPrompt(
  baseUserPrompt: string,
  modifierPrompt: string | null | undefined,
): string {
  const base = String(baseUserPrompt || "").trim();
  const mod = clean(modifierPrompt);
  if (!mod) return base;
  const block = [
    "",
    "## Author modifier (must influence the insight rehearsal)",
    mod.slice(0, 2_000),
  ].join("\n");
  return base ? `${base}\n${block}` : block.trim();
}

/**
 * Compact text corpus for Suggest from Simulation (active items only).
 */
export function simulationCollectionAsSuggestCorpus(
  collection: SimulationCollection | null | undefined,
  limit = 24,
): Array<{ id: string; kind: "insight"; text: string }> {
  return listSimulationCollectionItems(collection)
    .slice(0, Math.max(1, limit))
    .map((i) => ({
      id: i.id,
      kind: "insight" as const,
      text: `${i.title}\n${i.body}`,
    }));
}
