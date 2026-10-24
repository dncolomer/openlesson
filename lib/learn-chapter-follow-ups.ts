/**
 * Closest empty chapter-grid slot for TIM expansion.
 */
import type { SessionPlan, SessionPlanStep } from "@/lib/storage";
import { isChapterSlotBlocked } from "@/lib/learn-chapter-blocked";

/** Chebyshev distance on the chapter grid. */
function chebyshev(dr: number, dc: number): number {
  return Math.max(Math.abs(dr), Math.abs(dc));
}

/**
 * Occupancy from plan step positions only (chapter grid).
 * Avoids skill-layout remapping which can mark free neighbors occupied.
 */
function isChapterCellOccupied(
  plan: SessionPlan,
  row: number,
  col: number,
): boolean {
  return plan.steps.some(
    (step) =>
      typeof step.position_x === "number" &&
      typeof step.position_y === "number" &&
      step.position_x === col &&
      step.position_y === row,
  );
}

/**
 * Tie-break for equal Chebyshev distance:
 * 1) prefer axis-aligned (smaller Manhattan) over diagonals
 * 2) prefer east, then south, then west, then north
 * Deterministic so repeated adds fan out predictably.
 */
function compareOffsets(
  a: { dr: number; dc: number },
  b: { dr: number; dc: number },
): number {
  const da = chebyshev(a.dr, a.dc);
  const db = chebyshev(b.dr, b.dc);
  if (da !== db) return da - db;
  const ma = Math.abs(a.dr) + Math.abs(a.dc);
  const mb = Math.abs(b.dr) + Math.abs(b.dc);
  if (ma !== mb) return ma - mb;
  // Direction rank: E=0, S=1, W=2, N=3, then SE/SW/NE/NW
  const dirRank = (dr: number, dc: number) => {
    if (dr === 0 && dc > 0) return 0;
    if (dc === 0 && dr > 0) return 1;
    if (dr === 0 && dc < 0) return 2;
    if (dc === 0 && dr < 0) return 3;
    if (dr > 0 && dc > 0) return 4;
    if (dr > 0 && dc < 0) return 5;
    if (dr < 0 && dc > 0) return 6;
    return 7;
  };
  const ra = dirRank(a.dr, a.dc);
  const rb = dirRank(b.dr, b.dc);
  if (ra !== rb) return ra - rb;
  if (a.dc !== b.dc) return b.dc - a.dc;
  return b.dr - a.dr;
}

/**
 * Closest empty chapter square to the completed chapter (Chebyshev distance).
 * Always returns a free cell: expands rings until one is found, then falls back
 * to past the rightmost occupied column on the anchor row.
 */
export function findClosestEmptyChapterSlot(
  plan: SessionPlan,
  anchor: Pick<SessionPlanStep, "position_x" | "position_y"> | null | undefined,
): { row: number; col: number } {
  const col = typeof anchor?.position_x === "number" ? anchor.position_x : 0;
  const row = typeof anchor?.position_y === "number" ? anchor.position_y : 0;

  const maxRing = 48;
  for (let dist = 1; dist <= maxRing; dist += 1) {
    const offsets: Array<{ dr: number; dc: number }> = [];
    for (let dr = -dist; dr <= dist; dr += 1) {
      for (let dc = -dist; dc <= dist; dc += 1) {
        if (chebyshev(dr, dc) !== dist) continue;
        offsets.push({ dr, dc });
      }
    }
    offsets.sort(compareOffsets);
    for (const { dr, dc } of offsets) {
      const next = { row: row + dr, col: col + dc };
      if (
        !isChapterCellOccupied(plan, next.row, next.col) &&
        !isChapterSlotBlocked(plan, next.row, next.col)
      ) {
        return next;
      }
    }
  }

  // Guaranteed free fallback: right of the furthest occupied column on any row.
  let maxCol = col;
  for (const step of plan.steps) {
    if (typeof step.position_x === "number" && step.position_x > maxCol) {
      maxCol = step.position_x;
    }
  }
  let fallbackCol = maxCol + 1;
  while (
    (isChapterCellOccupied(plan, row, fallbackCol) ||
      isChapterSlotBlocked(plan, row, fallbackCol)) &&
    fallbackCol < maxCol + 200
  ) {
    fallbackCol += 1;
  }
  return { row, col: fallbackCol };
}
