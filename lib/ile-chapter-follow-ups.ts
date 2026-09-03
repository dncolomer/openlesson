/**
 * Project Mode: after Mark as Done, suggest 3 adjacent follow-up exercise chapters
 * and place a chosen one next to the completed chapter on the grid.
 */
import type { SessionPlan, SessionPlanStep } from "@/lib/storage";
import { isChapterSlotBlocked } from "@/lib/ile-chapter-blocked";

export type ChapterFollowUpSuggestion = {
  title: string;
  description: string;
  /** 1–2 word map-tile label generated with title/description. */
  keyword?: string;
};

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

/**
 * @deprecated Prefer findClosestEmptyChapterSlot — always places on nearest free square.
 * Kept as a named alias for older call sites.
 */
export function findAdjacentFreeChapterSlot(
  plan: SessionPlan,
  anchor: Pick<SessionPlanStep, "position_x" | "position_y"> | null | undefined,
): { row: number; col: number } {
  return findClosestEmptyChapterSlot(plan, anchor);
}

/** Compact context for the follow-up model (chapter + solution/stash PoW). */
export function buildChapterFollowUpContext(input: {
  chapterDescription: string;
  solutionTexts: string[];
  stashTexts: string[];
  existingChapterDescriptions?: string[];
}): {
  chapter: string;
  solutionSummary: string;
  stashSummary: string;
  existingChapters: string;
} {
  const chapter = String(input.chapterDescription || "").trim() || "Untitled chapter";
  const solutionSummary =
    input.solutionTexts
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((t, i) => `${i + 1}. ${t.slice(0, 280)}`)
      .join("\n") || "(no solution thoughts)";
  const stashSummary =
    input.stashTexts
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((t, i) => `${i + 1}. ${t.slice(0, 280)}`)
      .join("\n") || "(no stashed thoughts)";
  const existingChapters =
    (input.existingChapterDescriptions || [])
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 24)
      .map((t) => `- ${t.slice(0, 160)}`)
      .join("\n") || "(none)";

  return { chapter, solutionSummary, stashSummary, existingChapters };
}

export function normalizeChapterFollowUpSuggestions(
  raw: unknown,
  limit = 3,
): ChapterFollowUpSuggestion[] {
  if (!raw || typeof raw !== "object") return [];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { suggestions?: unknown }).suggestions)
      ? (raw as { suggestions: unknown[] }).suggestions
      : [];

  const out: ChapterFollowUpSuggestion[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const title = item.trim();
      if (!title) continue;
      out.push({ title: title.slice(0, 120), description: title.slice(0, 280) });
    } else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const title = String(rec.title || rec.topic || rec.name || "").trim();
      const description = String(rec.description || rec.body || rec.summary || title).trim();
      const keyword = String(rec.keyword || rec.map_keyword || rec.mapKeyword || "").trim();
      if (!title && !description) continue;
      out.push({
        title: (title || description).slice(0, 120),
        description: (description || title).slice(0, 400),
        ...(keyword ? { keyword: keyword.slice(0, 28) } : {}),
      });
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Description used when adding a follow-up as a new Project Mode chapter. */
export function buildFollowUpChapterDescription(suggestion: ChapterFollowUpSuggestion): string {
  const title = suggestion.title.trim();
  const desc = suggestion.description.trim();
  if (!title) return desc;
  if (!desc || desc === title) return title;
  // Prefer a single exercise-style sentence the map can show.
  if (desc.toLowerCase().startsWith(title.toLowerCase())) return desc;
  return `${title}. ${desc}`;
}
