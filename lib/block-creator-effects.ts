/**
 * Creator-mode combinable block effects: Dynamic, Generator.
 * (Promptable removed — learners already customize session prompts before practice.)
 * Pure helpers — unit-tested without React/DB.
 *
 * Dynamic unlock deps live only in creator_effects — they are NOT DAG /
 * lock_until / next_block_ids edges.
 */

import { isBlockCompletedStatus } from "@/lib/map-ground-rules";

/** Canonical effect keys (stable for map badges / data attrs). */
export type BlockCreatorEffectKey = "dynamic" | "generator";

export const BLOCK_CREATOR_EFFECT_KEYS: readonly BlockCreatorEffectKey[] = [
  "dynamic",
  "generator",
] as const;

export type BlockDynamicEffect = {
  /**
   * Generate content when unlocked from learner history.
   * Unlocks when every block in unlockAfterBlockIds is completed.
   */
  enabled: boolean;
  /**
   * Other map blocks that must all be Done before this dynamic block unlocks.
   * Stored only on the dynamic config — not as DAG / lock_until edges.
   */
  unlockAfterBlockIds: string[];
};

/** Empty map cell selected as a generator spawn target. */
export type GeneratorTargetCell = { row: number; col: number };

export type BlockGeneratorEffect = {
  /** When this block is completed, generate new blocks on target empty cells. */
  enabled: boolean;
  /**
   * Empty map cells (click-to-pick on the map) where blocks will be generated
   * when this generator completes. Not filled blocks — empty slots only.
   */
  targetCells: GeneratorTargetCell[];
};

/**
 * Combinable creator effects stored on `blocks.creator_effects` (jsonb).
 */
export type BlockCreatorEffects = {
  dynamic: BlockDynamicEffect;
  generator: BlockGeneratorEffect;
};

export type BlockCreatorEffectsInput = Partial<{
  dynamic:
    | Partial<
        BlockDynamicEffect & {
          unlock_after_block_ids?: unknown;
          unlockAfterBlockIds?: unknown;
        }
      >
    | boolean
    | null;
  /** @deprecated ignored — Promptable removed */
  promptable?: unknown;
  generator:
    | Partial<
        BlockGeneratorEffect & {
          target_cells?: unknown;
          targetCells?: unknown;
          /** @deprecated legacy filled-block ids — ignored */
          target_block_ids?: unknown;
          targetBlockIds?: unknown;
        }
      >
    | boolean
    | null;
  /** snake_case aliases */
  target_cells?: unknown;
}> | null;

function asBool(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function uniqIds(ids: readonly unknown[]): string[] {
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

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return uniqIds(raw);
}

/** Stable key for a grid cell. */
export function generatorCellKey(cell: { row: number; col: number }): string {
  return `${Math.trunc(cell.row)}:${Math.trunc(cell.col)}`;
}

/**
 * Parse / normalize a list of empty-cell targets.
 * Accepts `{row,col}` or `{r,c}` objects; drops non-finite values; de-dupes.
 */
export function parseGeneratorTargetCells(raw: unknown): GeneratorTargetCell[] {
  if (!Array.isArray(raw)) return [];
  const out: GeneratorTargetCell[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const row = Number(o.row ?? o.r ?? o.position_y);
    const col = Number(o.col ?? o.c ?? o.position_x);
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
    const cell = { row: Math.trunc(row), col: Math.trunc(col) };
    const k = generatorCellKey(cell);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(cell);
  }
  // Stable order: row then col
  out.sort((a, b) => a.row - b.row || a.col - b.col);
  return out;
}

/** Empty / off defaults. */
export function defaultBlockCreatorEffects(): BlockCreatorEffects {
  return {
    dynamic: { enabled: false, unlockAfterBlockIds: [] },
    generator: { enabled: false, targetCells: [] },
  };
}

function normalizeDynamic(
  raw: unknown,
  selfBlockId?: string | null,
): BlockDynamicEffect {
  const self = cleanId(selfBlockId);
  if (raw === true) return { enabled: true, unlockAfterBlockIds: [] };
  if (raw === false) return { enabled: false, unlockAfterBlockIds: [] };
  if (raw && typeof raw === "object") {
    const o = raw as {
      enabled?: unknown;
      unlockAfterBlockIds?: unknown;
      unlock_after_block_ids?: unknown;
    };
    let ids = parseIdList(
      o.unlockAfterBlockIds ?? o.unlock_after_block_ids,
    );
    if (self) ids = ids.filter((id) => id !== self);
    return {
      enabled: asBool(o.enabled, false),
      unlockAfterBlockIds: ids,
    };
  }
  return { enabled: false, unlockAfterBlockIds: [] };
}

function normalizeGenerator(
  raw: unknown,
  rootTargetCells?: unknown,
): BlockGeneratorEffect {
  if (raw === true) {
    return {
      enabled: true,
      targetCells: parseGeneratorTargetCells(rootTargetCells),
    };
  }
  if (raw === false) {
    return { enabled: false, targetCells: [] };
  }
  if (raw && typeof raw === "object") {
    const o = raw as {
      enabled?: unknown;
      targetCells?: unknown;
      target_cells?: unknown;
    };
    return {
      enabled: asBool(o.enabled, false),
      // Keep targets even when disabled so re-enabling restores selection.
      targetCells: parseGeneratorTargetCells(
        o.targetCells ?? o.target_cells ?? rootTargetCells,
      ),
    };
  }
  return { enabled: false, targetCells: [] };
}

/**
 * Normalize author/DB payload into a valid effects object.
 */
export function normalizeBlockCreatorEffects(
  raw?: BlockCreatorEffectsInput | unknown,
  opts?: { selfBlockId?: string | null },
): BlockCreatorEffects {
  const def = defaultBlockCreatorEffects();
  if (raw == null || typeof raw !== "object") return def;

  const o = raw as Record<string, unknown>;
  const dynamic = normalizeDynamic(o.dynamic, opts?.selfBlockId);
  // Legacy `promptable` field in stored JSON is ignored.
  const generator = normalizeGenerator(o.generator, o.target_cells);

  return { dynamic, generator };
}

/** Parse unknown DB/JSON value (null/undefined → defaults). */
export function parseBlockCreatorEffects(
  raw: unknown,
  opts?: { selfBlockId?: string | null },
): BlockCreatorEffects {
  if (raw == null) return defaultBlockCreatorEffects();
  if (typeof raw === "string") {
    try {
      return normalizeBlockCreatorEffects(JSON.parse(raw), opts);
    } catch {
      return defaultBlockCreatorEffects();
    }
  }
  if (typeof raw === "object") {
    return normalizeBlockCreatorEffects(raw, opts);
  }
  return defaultBlockCreatorEffects();
}

/** Wire shape for DB / API (snake_case nested). */
export function serializeBlockCreatorEffects(
  effects: BlockCreatorEffects,
  opts?: { selfBlockId?: string | null },
): Record<string, unknown> {
  const n = normalizeBlockCreatorEffects(effects, opts);
  return {
    dynamic: {
      enabled: n.dynamic.enabled,
      unlock_after_block_ids: n.dynamic.unlockAfterBlockIds,
    },
    generator: {
      enabled: n.generator.enabled,
      target_cells: n.generator.targetCells.map((c) => ({
        row: c.row,
        col: c.col,
      })),
    },
  };
}

export function isDynamicEffectEnabled(
  effects: BlockCreatorEffects | null | undefined,
): boolean {
  return Boolean(normalizeBlockCreatorEffects(effects).dynamic.enabled);
}

export function isGeneratorEffectEnabled(
  effects: BlockCreatorEffects | null | undefined,
): boolean {
  return Boolean(normalizeBlockCreatorEffects(effects).generator.enabled);
}

/**
 * True when Generator is configured with at least one empty target (saved).
 * Used for map “busy” chrome on the source block.
 */
export function isGeneratorEffectBusy(
  effects: BlockCreatorEffects | null | undefined,
): boolean {
  const n = normalizeBlockCreatorEffects(effects);
  return n.generator.enabled && n.generator.targetCells.length > 0;
}

/** Icon keys for map badges (only enabled effects). */
export function creatorEffectIconKeys(
  effects: BlockCreatorEffects | null | undefined,
): BlockCreatorEffectKey[] {
  const n = normalizeBlockCreatorEffects(effects);
  const keys: BlockCreatorEffectKey[] = [];
  if (n.dynamic.enabled) keys.push("dynamic");
  if (n.generator.enabled) keys.push("generator");
  return keys;
}

/** True when any effect is enabled (for badge density). */
export function hasAnyCreatorEffect(
  effects: BlockCreatorEffects | null | undefined,
): boolean {
  return creatorEffectIconKeys(effects).length > 0;
}

/**
 * Toggle a block id in/out of Dynamic unlock-after deps.
 * Self id is never accepted.
 */
export function toggleDynamicUnlockAfterId(
  current: readonly string[],
  targetId: unknown,
  selfBlockId?: string | null,
): string[] {
  const id = cleanId(targetId);
  const self = cleanId(selfBlockId);
  if (!id || (self && id === self)) return uniqIds(current);
  const set = new Set(uniqIds(current));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set];
}

/**
 * Whether a Dynamic block is still locked given peer statuses.
 * Not enabled / no deps → not locked by dynamic rules.
 * Enabled with deps → locked until every dep is completed.
 */
export function isDynamicEffectLocked(input: {
  effects?: BlockCreatorEffects | null | unknown;
  selfBlockId?: string | null;
  blocks: readonly { id: string; status?: string | null }[];
}): boolean {
  const self = cleanId(input.selfBlockId);
  const effects = normalizeBlockCreatorEffects(input.effects as unknown, {
    selfBlockId: self,
  });
  if (!effects.dynamic.enabled) return false;
  const deps = effects.dynamic.unlockAfterBlockIds;
  if (deps.length === 0) return false;
  const byId = new Map(
    input.blocks.map((b) => [cleanId(b.id), b] as const),
  );
  for (const depId of deps) {
    if (self && depId === self) continue;
    const b = byId.get(depId);
    if (!b || !isBlockCompletedStatus(b.status)) return true;
  }
  return false;
}

/** True when Dynamic is enabled and all unlock-after deps are completed. */
export function isDynamicEffectUnlocked(input: {
  effects?: BlockCreatorEffects | null | unknown;
  selfBlockId?: string | null;
  blocks: readonly { id: string; status?: string | null }[];
}): boolean {
  const effects = normalizeBlockCreatorEffects(input.effects as unknown, {
    selfBlockId: input.selfBlockId,
  });
  if (!effects.dynamic.enabled) return false;
  if (effects.dynamic.unlockAfterBlockIds.length === 0) return true;
  return !isDynamicEffectLocked(input);
}

/**
 * Validate effects before persist.
 * Dynamic-on requires ≥1 unlock-after block (not self).
 * Generator requires ≥1 empty target cell (optionally still empty vs occupancy).
 */
export function validateBlockCreatorEffects(input: {
  blockId: string;
  effects: BlockCreatorEffects | null | undefined;
  blocks: readonly {
    id: string;
    lock_until_block_ids?: readonly string[] | null;
    next_block_ids?: readonly string[] | null;
    position_x?: number | null;
    position_y?: number | null;
  }[];
  /**
   * @deprecated Dynamic no longer uses DAG membership.
   * Kept so older callers compile; ignored.
   */
  allowDynamicWithoutDag?: boolean;
  /**
   * Occupied / unusable cell keys `"row:col"`. When provided, generator targets
   * that are no longer empty are dropped.
   */
  occupiedOrUnusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): { ok: true; effects: BlockCreatorEffects } | { ok: false; error: string } {
  const self = cleanId(input.blockId);
  if (!self) return { ok: false, error: "blockId is required" };
  const effects = normalizeBlockCreatorEffects(input.effects, {
    selfBlockId: self,
  });
  const known = new Set(
    input.blocks.map((b) => cleanId(b.id)).filter(Boolean),
  );

  if (effects.dynamic.enabled) {
    const cleaned = effects.dynamic.unlockAfterBlockIds.filter(
      (id) => id !== self && known.has(id),
    );
    effects.dynamic = {
      ...effects.dynamic,
      unlockAfterBlockIds: cleaned,
    };
    if (cleaned.length === 0) {
      return {
        ok: false,
        error:
          "Dynamic requires at least one other block. When all selected blocks are Done, this block unlocks.",
      };
    }
  }

  if (effects.generator.enabled) {
    let cells = [...effects.generator.targetCells];
    const blocked = new Set<string>();
    if (input.occupiedOrUnusableKeys instanceof Set) {
      for (const k of input.occupiedOrUnusableKeys) blocked.add(String(k));
    } else if (Array.isArray(input.occupiedOrUnusableKeys)) {
      for (const k of input.occupiedOrUnusableKeys) blocked.add(String(k));
    }
    // Always treat currently placed blocks as occupied.
    for (const b of input.blocks) {
      if (
        typeof b.position_x === "number" &&
        typeof b.position_y === "number" &&
        Number.isFinite(b.position_x) &&
        Number.isFinite(b.position_y)
      ) {
        blocked.add(
          generatorCellKey({
            row: Math.trunc(b.position_y),
            col: Math.trunc(b.position_x),
          }),
        );
      }
    }
    if (blocked.size > 0) {
      cells = cells.filter((c) => !blocked.has(generatorCellKey(c)));
    }
    effects.generator = {
      ...effects.generator,
      targetCells: cells,
    };
    if (cells.length === 0) {
      return {
        ok: false,
        error:
          "Generator requires at least one empty map cell. Click empty cells on the map to select them.",
      };
    }
  }

  return { ok: true, effects };
}

/** Generator empty-cell targets when effect is on (empty when off). */
export function generatorTargetHighlightCells(
  effects: BlockCreatorEffects | null | undefined,
): GeneratorTargetCell[] {
  const n = normalizeBlockCreatorEffects(effects);
  if (!n.generator.enabled) return [];
  return n.generator.targetCells.map((c) => ({ row: c.row, col: c.col }));
}

/**
 * @deprecated Use generatorTargetHighlightCells — generator targets are empty cells.
 */
export function generatorTargetHighlightIds(
  effects: BlockCreatorEffects | null | undefined,
): string[] {
  return generatorTargetHighlightCells(effects).map(generatorCellKey);
}

/**
 * Learner map title: Dynamic blocks show "?" until content is considered
 * generated (non-empty description after unlock, or explicit flag).
 */
export function learnerDynamicMapLabel(input: {
  effects: BlockCreatorEffects | null | undefined;
  title?: string | null;
  description?: string | null;
  /** When true, content has been generated for this learner/session. */
  contentGenerated?: boolean;
}): string {
  const n = normalizeBlockCreatorEffects(input.effects);
  if (!n.dynamic.enabled) {
    return String(input.title || "").trim() || "Block";
  }
  if (input.contentGenerated) {
    return String(input.title || "").trim() || "Block";
  }
  // Prefer "?" while dynamic and not yet generated for the learner.
  return "?";
}

/** sessionStorage key for dynamic content-generated flag. */
export function dynamicGeneratedStorageKey(input: {
  workspaceId: string;
  blockId: string;
  userKey?: string | null;
}): string {
  const ws = cleanId(input.workspaceId) || "ws";
  const block = cleanId(input.blockId) || "block";
  const user = cleanId(input.userKey) || "anon";
  return `ol:dynamic-generated:${ws}:${block}:${user}`;
}

/**
 * After mark-done, which Dynamic blocks just became fully unlocked
 * (all unlock-after deps completed, and the completed block was one of them
 * or we re-check all). Generates content from learner history.
 */
export function dynamicBlocksUnlockedAfterDone(input: {
  completedBlockId: string;
  blocks: readonly {
    id: string;
    status?: string | null;
    creator_effects?: unknown;
  }[];
}): string[] {
  const completed = cleanId(input.completedBlockId);
  // Simulate completed status on the done block for unlock checks.
  const withDone = input.blocks.map((b) =>
    cleanId(b.id) === completed
      ? { ...b, status: "completed" as const }
      : b,
  );
  const before = input.blocks;
  const out: string[] = [];
  for (const b of withDone) {
    const id = cleanId(b.id);
    if (!id || id === completed) continue;
    const effects = parseBlockCreatorEffects(b.creator_effects, {
      selfBlockId: id,
    });
    if (!effects.dynamic.enabled) continue;
    if (effects.dynamic.unlockAfterBlockIds.length === 0) continue;
    // Only care if this completion was relevant OR we check transition.
    const wasLocked = isDynamicEffectLocked({
      effects,
      selfBlockId: id,
      blocks: before,
    });
    const nowLocked = isDynamicEffectLocked({
      effects,
      selfBlockId: id,
      blocks: withDone,
    });
    if (wasLocked && !nowLocked) out.push(id);
  }
  return out;
}

/**
 * @deprecated Prefer dynamicBlocksUnlockedAfterDone (unlock deps, not lock_until).
 * Kept for callers that pass unlockedIds from DAG unlocks only.
 */
export function dynamicBlocksNeedingGeneration(input: {
  unlockedIds: readonly string[];
  blocks: readonly {
    id: string;
    status?: string | null;
    creator_effects?: unknown;
  }[];
}): string[] {
  // Merge legacy unlocked ids with dynamic unlock-after transitions when
  // completed id is unknown — treat all listed unlocked dynamic blocks.
  const unlocked = new Set(uniqIds(input.unlockedIds));
  const out: string[] = [];
  for (const b of input.blocks) {
    const id = cleanId(b.id);
    if (!id || !unlocked.has(id)) continue;
    const effects = parseBlockCreatorEffects(b.creator_effects, {
      selfBlockId: id,
    });
    if (effects.dynamic.enabled) out.push(id);
  }
  return out;
}

/**
 * After mark-done on a generator block, which empty cells should receive
 * newly generated blocks (still empty vs current occupancy).
 */
export function generatorTargetCellsAfterDone(input: {
  completedBlockId: string;
  blocks: readonly {
    id: string;
    creator_effects?: unknown;
    position_x?: number | null;
    position_y?: number | null;
  }[];
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): GeneratorTargetCell[] {
  const completed = cleanId(input.completedBlockId);
  if (!completed) return [];
  const self = input.blocks.find((b) => cleanId(b.id) === completed);
  if (!self) return [];
  const effects = parseBlockCreatorEffects(self.creator_effects, {
    selfBlockId: completed,
  });
  if (!effects.generator.enabled) return [];

  const blocked = new Set<string>();
  if (input.unusableKeys instanceof Set) {
    for (const k of input.unusableKeys) blocked.add(String(k));
  } else if (Array.isArray(input.unusableKeys)) {
    for (const k of input.unusableKeys) blocked.add(String(k));
  }
  for (const b of input.blocks) {
    if (
      typeof b.position_x === "number" &&
      typeof b.position_y === "number" &&
      Number.isFinite(b.position_x) &&
      Number.isFinite(b.position_y)
    ) {
      blocked.add(
        generatorCellKey({
          row: Math.trunc(b.position_y),
          col: Math.trunc(b.position_x),
        }),
      );
    }
  }
  return effects.generator.targetCells.filter(
    (c) => !blocked.has(generatorCellKey(c)),
  );
}

/**
 * @deprecated Use generatorTargetCellsAfterDone.
 */
export function generatorTargetsAfterDone(input: {
  completedBlockId: string;
  blocks: readonly {
    id: string;
    creator_effects?: unknown;
    position_x?: number | null;
    position_y?: number | null;
  }[];
}): string[] {
  return generatorTargetCellsAfterDone(input).map(generatorCellKey);
}

/** Equality for dirty checks in creator drawers. */
export function creatorEffectsEqual(
  a: BlockCreatorEffects | null | undefined,
  b: BlockCreatorEffects | null | undefined,
): boolean {
  const na = normalizeBlockCreatorEffects(a);
  const nb = normalizeBlockCreatorEffects(b);
  if (na.dynamic.enabled !== nb.dynamic.enabled) return false;
  if (
    na.dynamic.unlockAfterBlockIds.length !==
    nb.dynamic.unlockAfterBlockIds.length
  ) {
    return false;
  }
  for (let i = 0; i < na.dynamic.unlockAfterBlockIds.length; i++) {
    if (
      na.dynamic.unlockAfterBlockIds[i] !== nb.dynamic.unlockAfterBlockIds[i]
    ) {
      return false;
    }
  }
  if (na.generator.enabled !== nb.generator.enabled) return false;
  if (na.generator.targetCells.length !== nb.generator.targetCells.length) {
    return false;
  }
  for (let i = 0; i < na.generator.targetCells.length; i++) {
    const ca = na.generator.targetCells[i]!;
    const cb = nb.generator.targetCells[i]!;
    if (ca.row !== cb.row || ca.col !== cb.col) return false;
  }
  return true;
}

/** Toggle an empty cell in/out of the generator target list. */
export function toggleGeneratorTargetCell(
  current: readonly GeneratorTargetCell[],
  cell: { row: number; col: number } | null | undefined,
): GeneratorTargetCell[] {
  if (
    !cell ||
    !Number.isFinite(cell.row) ||
    !Number.isFinite(cell.col)
  ) {
    return parseGeneratorTargetCells(current);
  }
  const next = { row: Math.trunc(cell.row), col: Math.trunc(cell.col) };
  const k = generatorCellKey(next);
  const existing = parseGeneratorTargetCells(current);
  if (existing.some((c) => generatorCellKey(c) === k)) {
    return existing.filter((c) => generatorCellKey(c) !== k);
  }
  return parseGeneratorTargetCells([...existing, next]);
}

/**
 * @deprecated Generator targets are empty cells — use toggleGeneratorTargetCell.
 */
export function toggleGeneratorTargetId(
  current: readonly string[],
  targetId: unknown,
  _selfBlockId?: string | null,
): string[] {
  // Legacy no-op path: treat targetId as "row:col" if possible.
  const raw = cleanId(targetId);
  const m = /^(-?\d+):(-?\d+)$/.exec(raw);
  if (!m) return uniqIds(current);
  const cells = current
    .map((k) => {
      const p = /^(-?\d+):(-?\d+)$/.exec(String(k));
      if (!p) return null;
      return { row: Number(p[1]), col: Number(p[2]) };
    })
    .filter((c): c is GeneratorTargetCell => c != null);
  return toggleGeneratorTargetCell(cells, {
    row: Number(m[1]),
    col: Number(m[2]),
  }).map(generatorCellKey);
}
