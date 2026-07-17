/**
 * Initial-chapters levels for ILE session plans and workspace skill-grid
 * block graphs. Chosen at session welcome / workspace create (prompt+files)
 * and accepted via REST / MCP as `initial_chapters` (or camelCase / legacy aliases).
 */

export type InitialChaptersLevel = "narrow" | "mid" | "broad";

export const INITIAL_CHAPTERS_LEVELS: readonly InitialChaptersLevel[] = [
  "narrow",
  "mid",
  "broad",
] as const;

export const DEFAULT_INITIAL_CHAPTERS: InitialChaptersLevel = "mid";

export interface InitialChaptersBand {
  min: number;
  max: number;
  /** Preferred count to request within the band. */
  target: number;
  label: string;
  audience: string;
}

/**
 * Raised count bands (vs historical ~5–8 / prior map-size ~5/8/12).
 * narrow < mid < broad; broad target clearly above the prior ~12 scale.
 */
export const INITIAL_CHAPTERS_BANDS: Record<InitialChaptersLevel, InitialChaptersBand> = {
  narrow: {
    min: 6,
    max: 10,
    target: 8,
    label: "narrow",
    audience: "beginners — fewer initial chapters, less anxious, focused start",
  },
  mid: {
    min: 10,
    max: 15,
    target: 12,
    label: "mid",
    audience: "typical learners — balanced initial chapter count",
  },
  broad: {
    min: 15,
    max: 22,
    target: 18,
    label: "broad",
    audience: "confident explorers — more initial chapters and deeper branch arms",
  },
};

export function isInitialChaptersLevel(value: unknown): value is InitialChaptersLevel {
  return value === "narrow" || value === "mid" || value === "broad";
}

/**
 * Coerce API/UI body values. Accepts level strings and common field aliases
 * when callers pass the whole body key value already extracted.
 */
export function parseInitialChaptersLevel(value: unknown): InitialChaptersLevel {
  return isInitialChaptersLevel(value) ? value : DEFAULT_INITIAL_CHAPTERS;
}

/**
 * Resolve level from a create-request body, accepting:
 * `initial_chapters` | `initialChapters` | legacy `map_size` | `mapSize`.
 */
export function resolveInitialChaptersFromBody(
  body: Record<string, unknown> | null | undefined,
): InitialChaptersLevel {
  if (!body || typeof body !== "object") return DEFAULT_INITIAL_CHAPTERS;
  const candidates = [
    body.initial_chapters,
    body.initialChapters,
    body.map_size,
    body.mapSize,
  ];
  for (const value of candidates) {
    if (isInitialChaptersLevel(value)) return value;
  }
  return DEFAULT_INITIAL_CHAPTERS;
}

export function getInitialChaptersBand(
  level: InitialChaptersLevel | unknown,
): InitialChaptersBand {
  return INITIAL_CHAPTERS_BANDS[parseInitialChaptersLevel(level)];
}

/** Prompt-facing summary of the chosen initial-chapters band. */
export function formatInitialChaptersForPrompt(level: InitialChaptersLevel | unknown): {
  level: InitialChaptersLevel;
  band: InitialChaptersBand;
  countInstruction: string;
} {
  const parsed = parseInitialChaptersLevel(level);
  const band = INITIAL_CHAPTERS_BANDS[parsed];
  return {
    level: parsed,
    band,
    countInstruction: `Generate about ${band.target} initial chapters/blocks (acceptable range ${band.min}-${band.max}). Initial chapters level is "${band.label}" (${band.audience}).`,
  };
}

/**
 * Shared spatial layout rules for ILE steps and workspace blocks.
 * Origin start, signed multi-quadrant coords, sparse paths, branching arms.
 */
export const SPATIAL_MAP_LAYOUT_RULES = `SPATIAL MAP DESIGN (critical — nodes live on a 2D skill grid, not a linear checklist or filled rectangle):
- The start / foundation node MUST be at position_x=0, position_y=0 (origin).
- Place nodes across positive AND negative integer coordinates (use all four quadrants: +/+, +/−, −/+, −/−). Do NOT keep everything in the positive quadrant.
- Layout may be sparse and non-rectilinear: follow paths and rings with empty cells; do not force a clean filled grid.
- Support branching paths: some nodes should have multiple next neighbors, and some arms may explore deeper than others.
- Axis paths still matter: following a row or column should feel thematically related.
- Adjacent cells (Chebyshev distance 1) should be related or natural progressions.
- Every node needs unique integer (position_x, position_y). Never place two nodes on the same cell.`;

// ---- Backward-compatible aliases (prior "map size" naming) ----

/** @deprecated Prefer InitialChaptersLevel */
export type MapSizeLevel = InitialChaptersLevel;
/** @deprecated Prefer INITIAL_CHAPTERS_LEVELS */
export const MAP_SIZE_LEVELS = INITIAL_CHAPTERS_LEVELS;
/** @deprecated Prefer DEFAULT_INITIAL_CHAPTERS */
export const DEFAULT_MAP_SIZE = DEFAULT_INITIAL_CHAPTERS;
/** @deprecated Prefer InitialChaptersBand */
export type MapSizeStepBand = InitialChaptersBand;
/** @deprecated Prefer INITIAL_CHAPTERS_BANDS */
export const MAP_SIZE_STEP_BANDS = INITIAL_CHAPTERS_BANDS;

export const isMapSizeLevel = isInitialChaptersLevel;
export const parseMapSizeLevel = parseInitialChaptersLevel;
export const getMapSizeStepBand = getInitialChaptersBand;
export const formatMapSizeForPrompt = formatInitialChaptersForPrompt;
