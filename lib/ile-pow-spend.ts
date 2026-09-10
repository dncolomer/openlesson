/**
 * Unified ILE Proof-of-Work spend: Work start + Gather share one pool
 * and one expense slider. Pure — no React.
 *
 * Cheaper expense → more parallel Work. More expensive → more linear.
 * See docs/ile-pow-resources.md.
 */
import {
  emptyIlePowTypeCounts,
  ilePowCounterTotal,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";

export const ILE_POW_EXPENSE_MIN = 1;
export const ILE_POW_EXPENSE_MAX = 5;
export const ILE_POW_EXPENSE_DEFAULT = 3;

export type IlePowExpenseLevel = 1 | 2 | 3 | 4 | 5;

export type IleWorkStartReason = "ok" | "already_open" | "insufficient_pow";

export type IleWorkStartDecision = {
  allowed: boolean;
  reason: IleWorkStartReason;
  consumeUnits: number;
  consume: IlePowTypeCounts;
  openWorkIds: string[];
  warning: string | null;
  cost: number;
  pool: number;
};

export const ILE_WORK_INSUFFICIENT_POW_WARNING =
  "Not enough Proof of Work to start another chapter. End turn or do more work first — or choose a cheaper Work expense in settings.";

export const ILE_END_TURN_LABEL = "End turn";
/** Same control as End turn (legacy export name). */
export const ILE_SUBMIT_TURN_LABEL = ILE_END_TURN_LABEL;

const WORK_START_COST: Record<IlePowExpenseLevel, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 5,
  5: 8,
};

export function clampIlePowExpense(value: unknown): IlePowExpenseLevel {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return ILE_POW_EXPENSE_DEFAULT;
  if (n <= ILE_POW_EXPENSE_MIN) return ILE_POW_EXPENSE_MIN;
  if (n >= ILE_POW_EXPENSE_MAX) return ILE_POW_EXPENSE_MAX;
  return n as IlePowExpenseLevel;
}

export function ilePowExpenseScale(expense: unknown): number {
  return clampIlePowExpense(expense) / ILE_POW_EXPENSE_DEFAULT;
}

/** Unified remaining units: leftover typed PoW + unspent thoughts. */
export function ilePowUnifiedPool(input: {
  available: IlePowTypeCounts;
  thoughts?: number | null;
  spentUnits?: number | null;
  spentTyped?: IlePowTypeCounts | null;
}): number {
  const typed = Math.max(0, ilePowCounterTotal(input.available));
  const thoughts = Math.max(0, Math.floor(Number(input.thoughts) || 0));
  const spentTyped = ilePowCounterTotal(input.spentTyped ?? emptyIlePowTypeCounts());
  const spentUnits = Math.max(0, Math.floor(Number(input.spentUnits) || 0));
  const extraSpent = Math.max(0, spentUnits - spentTyped);
  return Math.max(0, typed + thoughts - extraSpent);
}

export function ilePowWorkStartCost(expense: unknown): number {
  return WORK_START_COST[clampIlePowExpense(expense)];
}

/** First Work is free; extras cost `ilePowWorkStartCost`. Total slots from a full pool. */
export function ilePowParallelWorkCapacity(input: {
  pool: number;
  expense?: unknown;
}): number {
  const cost = ilePowWorkStartCost(input.expense ?? ILE_POW_EXPENSE_DEFAULT);
  const pool = Math.max(0, Math.floor(Number(input.pool) || 0));
  return 1 + Math.floor(pool / Math.max(1, cost));
}

/**
 * Extra Works still startable from the *remaining* pool.
 * After the free first Work is open, do not add that free slot again.
 */
export function ilePowAdditionalWorkRemaining(input: {
  pool: number;
  expense?: unknown;
  openWorkCount: number;
}): number {
  const cost = ilePowWorkStartCost(input.expense ?? ILE_POW_EXPENSE_DEFAULT);
  const pool = Math.max(0, Math.floor(Number(input.pool) || 0));
  const open = Math.max(0, Math.floor(Number(input.openWorkCount) || 0));
  const extras = Math.floor(pool / Math.max(1, cost));
  if (open === 0) return 1 + extras;
  return extras;
}

/** Default gather floors at expense 3 — keep in lockstep with lib/ile-gather-resources.ts. */
const GATHER_MIN_TOTAL_AT_DEFAULT = 3;
const GATHER_MIN_TOOL_AT_DEFAULT = 2;
const GATHER_CONSUME_TOOL_AT_DEFAULT = 2;

export function ilePowGatherMinTotal(expense: unknown): number {
  return Math.max(1, Math.round(GATHER_MIN_TOTAL_AT_DEFAULT * ilePowExpenseScale(expense)));
}

export function ilePowGatherMinTool(expense: unknown): number {
  return Math.max(1, Math.round(GATHER_MIN_TOOL_AT_DEFAULT * ilePowExpenseScale(expense)));
}

export function ilePowGatherConsumeBase(expense: unknown): IlePowTypeCounts {
  const tool = Math.max(
    1,
    Math.round(GATHER_CONSUME_TOOL_AT_DEFAULT * ilePowExpenseScale(expense)),
  );
  return { ...emptyIlePowTypeCounts(), tool };
}

export function normalizeIleOpenWorkId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function ileOpenWorkHas(
  openWorkIds: readonly string[] | null | undefined,
  chapterId: unknown,
): boolean {
  const id = normalizeIleOpenWorkId(chapterId);
  if (!id) return false;
  return (openWorkIds ?? []).some((row) => normalizeIleOpenWorkId(row) === id);
}

export function addIleOpenWork(
  openWorkIds: readonly string[] | null | undefined,
  chapterId: unknown,
): string[] {
  const id = normalizeIleOpenWorkId(chapterId);
  const current = (openWorkIds ?? [])
    .map(normalizeIleOpenWorkId)
    .filter(Boolean);
  if (!id) return current;
  if (current.includes(id)) return current;
  return [...current, id];
}

export function removeIleOpenWork(
  openWorkIds: readonly string[] | null | undefined,
  chapterId: unknown,
): string[] {
  const id = normalizeIleOpenWorkId(chapterId);
  return (openWorkIds ?? [])
    .map(normalizeIleOpenWorkId)
    .filter((row) => row && row !== id);
}

/** Session metadata key for chapters in open Work (clicked Work, not closed). */
export const ILE_OPEN_WORK_IDS_META_KEY = "ile_open_work_ids" as const;

export function uniqueIleOpenWorkIds(
  openWorkIds: readonly string[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of openWorkIds ?? []) {
    const id = normalizeIleOpenWorkId(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseIleOpenWorkIdsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const rec = metadata as Record<string, unknown>;
  const raw = rec[ILE_OPEN_WORK_IDS_META_KEY] ?? rec.openWorkIds;
  if (!Array.isArray(raw)) return [];
  return uniqueIleOpenWorkIds(raw.map((row) => String(row ?? "")));
}

export function applyIleOpenWorkIdsToMetadata<T extends Record<string, unknown>>(
  metadata: T | null | undefined,
  openWorkIds: readonly string[] | null | undefined,
): T {
  const next = { ...(metadata || {}) } as T;
  const rec = next as Record<string, unknown>;
  const ids = uniqueIleOpenWorkIds(openWorkIds);
  if (ids.length === 0) {
    delete rec[ILE_OPEN_WORK_IDS_META_KEY];
  } else {
    rec[ILE_OPEN_WORK_IDS_META_KEY] = ids;
  }
  return next;
}

export function restoreIleOpenWorkIds(input: {
  stored: readonly string[] | null | undefined;
  steps?: ReadonlyArray<{ id?: string | null; status?: string | null }> | null;
}): string[] {
  const ids = uniqueIleOpenWorkIds(input.stored);
  const steps = input.steps;
  if (!steps || steps.length === 0) return ids;
  const byId = new Map(
    steps
      .map((step) => [normalizeIleOpenWorkId(step.id), step] as const)
      .filter(([id]) => Boolean(id)),
  );
  const kept = ids.filter((id) => {
    const step = byId.get(id);
    if (!step) return false;
    const status = String(step.status || "").trim().toLowerCase();
    return status !== "completed" && status !== "skipped";
  });
  const inProgress = steps
    .map((step) => ({
      id: normalizeIleOpenWorkId(step.id),
      status: String(step.status || "").trim().toLowerCase(),
    }))
    .filter((step) => step.id && step.status === "in_progress")
    .map((step) => step.id);
  return uniqueIleOpenWorkIds([...kept, ...inProgress]);
}

export function consumeIlePowUnits(
  available: IlePowTypeCounts,
  units: number,
): IlePowTypeCounts {
  const consume = emptyIlePowTypeCounts();
  let left = Math.max(0, Math.floor(Number(units) || 0));
  const order: Array<keyof IlePowTypeCounts> = ["tool", "screen", "eeg", "video"];
  for (const type of order) {
    if (left <= 0) break;
    const take = Math.min(Math.max(0, available[type]), left);
    consume[type] = take;
    left -= take;
  }
  return consume;
}

export function applyIlePowSpend(
  spent: IlePowTypeCounts,
  consume: IlePowTypeCounts,
): IlePowTypeCounts {
  return {
    tool: spent.tool + consume.tool,
    screen: spent.screen + consume.screen,
    video: spent.video + consume.video,
    eeg: spent.eeg + consume.eeg,
  };
}

export function decideIleWorkStart(input: {
  chapterId: string;
  openWorkIds?: readonly string[] | null;
  available: IlePowTypeCounts;
  thoughts?: number | null;
  spentUnits?: number | null;
  spentTyped?: IlePowTypeCounts | null;
  expense?: unknown;
}): IleWorkStartDecision {
  const expense = clampIlePowExpense(input.expense);
  const openWorkIds = (input.openWorkIds ?? [])
    .map(normalizeIleOpenWorkId)
    .filter(Boolean);
  const chapterId = normalizeIleOpenWorkId(input.chapterId);
  const pool = ilePowUnifiedPool({
    available: input.available,
    thoughts: input.thoughts,
    spentUnits: input.spentUnits,
    spentTyped: input.spentTyped,
  });
  const cost = ilePowWorkStartCost(expense);

  if (!chapterId) {
    return {
      allowed: false,
      reason: "insufficient_pow",
      consumeUnits: 0,
      consume: emptyIlePowTypeCounts(),
      openWorkIds,
      warning: ILE_WORK_INSUFFICIENT_POW_WARNING,
      cost,
      pool,
    };
  }

  if (ileOpenWorkHas(openWorkIds, chapterId)) {
    return {
      allowed: true,
      reason: "already_open",
      consumeUnits: 0,
      consume: emptyIlePowTypeCounts(),
      openWorkIds,
      warning: null,
      cost,
      pool,
    };
  }

  const nextIds = addIleOpenWork(openWorkIds, chapterId);
  if (openWorkIds.length === 0) {
    return {
      allowed: true,
      reason: "ok",
      consumeUnits: 0,
      consume: emptyIlePowTypeCounts(),
      openWorkIds: nextIds,
      warning: null,
      cost,
      pool,
    };
  }

  if (pool < cost) {
    return {
      allowed: false,
      reason: "insufficient_pow",
      consumeUnits: 0,
      consume: emptyIlePowTypeCounts(),
      openWorkIds,
      warning: ILE_WORK_INSUFFICIENT_POW_WARNING,
      cost,
      pool,
    };
  }

  return {
    allowed: true,
    reason: "ok",
    consumeUnits: cost,
    consume: consumeIlePowUnits(input.available, cost),
    openWorkIds: nextIds,
    warning: null,
    cost,
    pool,
  };
}


