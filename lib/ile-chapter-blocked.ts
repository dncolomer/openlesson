/**
 * ILE / workspace blocked chapter slots from the initial-map catalog.
 * Pure — stamps unusable ground and relocates colliding tiles.
 */
import { getCellKey } from "@/lib/block-skill-grid";
import {
  blockedChapterSlotsFromPattern,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import { isUnusableCell, type UnusableCell } from "@/lib/map-ground-rules";
import type { SessionPlan, SessionPlanStep } from "@/lib/domain/types";

export { blockedChapterSlotsFromPattern, formatBlockedChapterSlotsForPrompt } from "@/lib/initial-chapters";

export function planUnusableCells(
  plan: Pick<SessionPlan, "unusable_cells"> | null | undefined,
): UnusableCell[] {
  return Array.isArray(plan?.unusable_cells) ? plan.unusable_cells : [];
}

export function isChapterSlotBlocked(
  plan: Pick<SessionPlan, "unusable_cells"> | null | undefined,
  row: number,
  col: number,
): boolean {
  return isUnusableCell(planUnusableCells(plan), row, col);
}

type GridPos = { position_x?: number | null; position_y?: number | null };

function occupiedKeysFromPositions(items: readonly GridPos[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (typeof item.position_x !== "number" || typeof item.position_y !== "number") continue;
    keys.add(getCellKey(item.position_y, item.position_x));
  }
  return keys;
}

export function nextFreeChapterCell(input: {
  occupied: ReadonlySet<string>;
  blocked: readonly UnusableCell[];
  from: { row: number; col: number };
}): { row: number; col: number } {
  const blocked = new Set(input.blocked.map((cell) => getCellKey(cell.row, cell.col)));
  const taken = (row: number, col: number) => {
    const key = getCellKey(row, col);
    return input.occupied.has(key) || blocked.has(key);
  };
  if (!taken(input.from.row, input.from.col)) return input.from;
  const maxRing = 48;
  for (let dist = 1; dist <= maxRing; dist += 1) {
    for (let dr = -dist; dr <= dist; dr += 1) {
      for (let dc = -dist; dc <= dist; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== dist) continue;
        const row = input.from.row + dr;
        const col = input.from.col + dc;
        if (!taken(row, col)) return { row, col };
      }
    }
  }
  let col = input.from.col + 1;
  while (taken(input.from.row, col) && col < input.from.col + 200) col += 1;
  return { row: input.from.row, col };
}

export function relocatePositionsOffBlockedSlots<T extends GridPos>(
  items: readonly T[],
  blocked: readonly UnusableCell[],
): T[] {
  if (!blocked.length) return [...items];
  const occupied = occupiedKeysFromPositions(items);
  const blockedSet = new Set(blocked.map((cell) => getCellKey(cell.row, cell.col)));
  const next = items.map((item) => ({ ...item }));
  for (let i = 0; i < next.length; i += 1) {
    const item = next[i];
    if (typeof item.position_x !== "number" || typeof item.position_y !== "number") continue;
    const key = getCellKey(item.position_y, item.position_x);
    if (!blockedSet.has(key)) continue;
    occupied.delete(key);
    const free = nextFreeChapterCell({
      occupied,
      blocked,
      from: { row: item.position_y, col: item.position_x },
    });
    next[i] = { ...item, position_x: free.col, position_y: free.row };
    occupied.add(getCellKey(free.row, free.col));
  }
  return next;
}

export function relocateChapterStepsOffBlocked(
  steps: readonly SessionPlanStep[],
  blocked: readonly UnusableCell[],
): SessionPlanStep[] {
  return relocatePositionsOffBlockedSlots(steps, blocked);
}

export function applyPatternBlockedSlotsToPlan(
  plan: SessionPlan,
  level?: InitialChaptersLevel | string | null,
): SessionPlan {
  const blocked =
    planUnusableCells(plan).length > 0
      ? planUnusableCells(plan)
      : blockedChapterSlotsFromPattern(level);
  if (blocked.length === 0) {
    return plan.unusable_cells?.length ? plan : { ...plan, unusable_cells: [] };
  }
  const steps = relocateChapterStepsOffBlocked(plan.steps, blocked);
  return { ...plan, steps, unusable_cells: blocked };
}
