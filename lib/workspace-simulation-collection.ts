/**
 * Durable curated Simulation collection (workspace-scoped).
 * Items are generated from block / multi-block / workspace simulation runs,
 * then authors can edit/delete before using them as Suggest from Simulation
 * context for map authoring.
 *
 * Pure helpers — unit-tested without React/DB.
 */

import {
  SIMULATION_EXERCISE_COUNT,
  SIMULATION_QUESTION_COUNT,
  type SimulationProbe,
  probeKindOf,
} from "@/lib/block-simulation";

export type SimulationCollectionItemKind = "question" | "exercise";

export type SimulationCollectionOrigin =
  | { kind: "workspace" }
  | { kind: "block"; blockId: string; blockTitle?: string | null }
  | { kind: "multi_block"; blockIds: string[]; blockTitles?: string[] | null };

export type SimulationCollectionItem = {
  id: string;
  kind: SimulationCollectionItemKind;
  text: string;
  /** Optional coach / success cue. */
  coachCue?: string | null;
  /** Origin of generation. */
  origin: SimulationCollectionOrigin;
  /** Modifier prompt that influenced generation (if any). */
  modifierPrompt?: string | null;
  /** Soft remove — list reads skip removed unless includeRemoved. */
  removed?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SimulationCollection = {
  items: SimulationCollectionItem[];
  updatedAt: string | null;
};

export function emptySimulationCollection(): SimulationCollection {
  return { items: [], updatedAt: null };
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

/** Parse a single item; null if invalid. */
export function parseSimulationCollectionItem(
  raw: unknown,
): SimulationCollectionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const text = clean(rec.text ?? rec.question ?? rec.prompt);
  if (text.length < 4) return null;
  const kindRaw = clean(rec.kind ?? rec.type).toLowerCase();
  const kind: SimulationCollectionItemKind =
    kindRaw === "exercise" || kindRaw === "solo" ? "exercise" : "question";
  const id = clean(rec.id) || makeId(kind === "exercise" ? "ex" : "q");
  const createdAt = clean(rec.createdAt ?? rec.created_at) || nowIso();
  const updatedAt = clean(rec.updatedAt ?? rec.updated_at) || createdAt;
  return {
    id,
    kind,
    text,
    coachCue: clean(rec.coachCue ?? rec.coach_cue) || null,
    origin: normalizeSimulationCollectionOrigin(rec.origin),
    modifierPrompt: clean(rec.modifierPrompt ?? rec.modifier_prompt) || null,
    removed: rec.removed === true,
    createdAt,
    updatedAt,
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
  return {
    items,
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
  if (opts?.kind) {
    items = items.filter((i) => i.kind === opts.kind);
  }
  return [...items].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

/** Create item(s) and append to collection. */
export function appendSimulationCollectionItems(
  collection: SimulationCollection | null | undefined,
  inputs: Array<{
    kind: SimulationCollectionItemKind;
    text: string;
    coachCue?: string | null;
    origin?: SimulationCollectionOrigin;
    modifierPrompt?: string | null;
    id?: string;
  }>,
): SimulationCollection {
  const col = normalizeSimulationCollection(collection ?? null);
  const ts = nowIso();
  const next = [...col.items];
  for (const input of inputs) {
    const text = clean(input.text);
    if (text.length < 4) continue;
    next.push({
      id: clean(input.id) || makeId(input.kind === "exercise" ? "ex" : "q"),
      kind: input.kind,
      text,
      coachCue: clean(input.coachCue) || null,
      origin: input.origin ?? { kind: "workspace" },
      modifierPrompt: clean(input.modifierPrompt) || null,
      removed: false,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  return { items: next, updatedAt: ts };
}

/**
 * Deposit probes / Q+E strings from a generation run into the collection.
 */
export function depositSimulationGeneration(
  collection: SimulationCollection | null | undefined,
  input: {
    questions?: string[] | null;
    exercises?: string[] | null;
    probes?: readonly SimulationProbe[] | null;
    origin: SimulationCollectionOrigin;
    modifierPrompt?: string | null;
  },
): SimulationCollection {
  const toAdd: Array<{
    kind: SimulationCollectionItemKind;
    text: string;
    coachCue?: string | null;
    origin: SimulationCollectionOrigin;
    modifierPrompt?: string | null;
  }> = [];

  for (const p of input.probes || []) {
    const text = clean(p.question);
    if (text.length < 4) continue;
    toAdd.push({
      kind: probeKindOf(p) === "exercise" ? "exercise" : "question",
      text,
      coachCue: p.coachCue ?? null,
      origin: input.origin,
      modifierPrompt: input.modifierPrompt,
    });
  }

  if (toAdd.length === 0) {
    for (const q of input.questions || []) {
      const text = clean(q);
      if (text.length < 4) continue;
      toAdd.push({
        kind: "question",
        text,
        origin: input.origin,
        modifierPrompt: input.modifierPrompt,
      });
    }
    for (const ex of input.exercises || []) {
      const text = clean(ex);
      if (text.length < 4) continue;
      toAdd.push({
        kind: "exercise",
        text,
        origin: input.origin,
        modifierPrompt: input.modifierPrompt,
      });
    }
  }

  // Cap per deposit to avoid flooding (still allow multi-block batches).
  const capped = toAdd.slice(
    0,
    (SIMULATION_QUESTION_COUNT + SIMULATION_EXERCISE_COUNT) * 4,
  );
  return appendSimulationCollectionItems(collection, capped);
}

/** Update item text/kind; null if not found. */
export function updateSimulationCollectionItem(
  collection: SimulationCollection | null | undefined,
  itemId: string,
  patch: {
    text?: string;
    kind?: SimulationCollectionItemKind;
    coachCue?: string | null;
  },
): SimulationCollection | null {
  const col = normalizeSimulationCollection(collection ?? null);
  const id = clean(itemId);
  if (!id) return null;
  const idx = col.items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const prev = col.items[idx]!;
  const ts = nowIso();
  const nextText =
    patch.text !== undefined ? clean(patch.text) : prev.text;
  if (nextText.length < 4) return null;
  const next = [...col.items];
  next[idx] = {
    ...prev,
    text: nextText,
    kind: patch.kind ?? prev.kind,
    coachCue:
      patch.coachCue !== undefined
        ? clean(patch.coachCue) || null
        : prev.coachCue,
    updatedAt: ts,
  };
  return { items: next, updatedAt: ts };
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
  return { items: next, updatedAt: ts };
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
  return { items: next, updatedAt: nowIso() };
}

/** Wire shape for DB jsonb column. */
export function serializeSimulationCollection(
  collection: SimulationCollection,
): Record<string, unknown> {
  const col = normalizeSimulationCollection(collection);
  return {
    items: col.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      text: i.text,
      coach_cue: i.coachCue,
      origin: i.origin,
      modifier_prompt: i.modifierPrompt,
      removed: Boolean(i.removed),
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    })),
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
    "## Author modifier (must influence every question and exercise)",
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
): Array<{ id: string; kind: SimulationCollectionItemKind; text: string }> {
  return listSimulationCollectionItems(collection)
    .slice(0, Math.max(1, limit))
    .map((i) => ({ id: i.id, kind: i.kind, text: i.text }));
}
