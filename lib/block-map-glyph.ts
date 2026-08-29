/**
 * Workspace map-tile glyph: one keyword + a 3×3 rearrangement of solid squares.
 * Keyword is generated with the block; the mark is a random occupancy of a
 * 3×3 grid (not topic-matched). Displayed instead of the truncated title.
 */

export const BLOCK_MAP_GRID_SIZE = 3;
export const BLOCK_MAP_CELL_COUNT = BLOCK_MAP_GRID_SIZE * BLOCK_MAP_GRID_SIZE;
/** Non-empty 3×3 occupancy masks: bits 1..511. */
export const BLOCK_MAP_PATTERN_MAX = (1 << BLOCK_MAP_CELL_COUNT) - 1;

/** `g{bits}` — bits is a 9-bit occupancy mask (1 = filled cell). */
export type BlockMapIconName = `g${number}`;

/** 2×2 in the top-left of the 3×3 (cells 0,1,3,4). */
export const DEFAULT_BLOCK_MAP_ICON: BlockMapIconName = "g27";

export type BlockMapGlyph = {
  keyword: string;
  icon: BlockMapIconName;
};

const KEYWORD_MAX = 18;
const PATTERN_RE = /^g(\d+)$/;

function clean(s: unknown): string {
  return String(s ?? "").trim();
}

function firstToken(s: string): string {
  const stripped = s
    .replace(/[_/\\]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .trim();
  if (!stripped) return "";
  const token = stripped.split(/\s+/)[0] || "";
  return token.replace(/^-+|-+$/g, "").slice(0, KEYWORD_MAX);
}

function capitalizeKeyword(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function encodeBlockMapPattern(bits: number): BlockMapIconName | null {
  if (!Number.isInteger(bits) || bits < 1 || bits > BLOCK_MAP_PATTERN_MAX) {
    return null;
  }
  return `g${bits}`;
}

export function blockMapPatternBits(name: BlockMapIconName): number {
  return Number(name.slice(1));
}

/** Which of the 9 cells are filled, row-major. */
export function blockMapPatternCells(name: BlockMapIconName): boolean[] {
  const bits = blockMapPatternBits(name);
  const cells: boolean[] = [];
  for (let i = 0; i < BLOCK_MAP_CELL_COUNT; i++) {
    cells.push(((bits >> i) & 1) === 1);
  }
  return cells;
}

function catalogIndex(n: number): BlockMapIconName {
  const bits = 1 + (((n % BLOCK_MAP_PATTERN_MAX) + BLOCK_MAP_PATTERN_MAX) % BLOCK_MAP_PATTERN_MAX);
  return `g${bits}`;
}

/** Deterministic PRNG so TAP/ILE reconstructed tiles keep the same pattern. */
export function randFromSeed(seed: string): () => number {
  let t = 0;
  for (let i = 0; i < seed.length; i++) t = (Math.imul(t, 31) + seed.charCodeAt(i)) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Keyword from the label + a 3×3 pattern.
 * Pass `seed` (stable id) so reconstructed TAP/ILE tiles do not flicker.
 */
export function blockMapGlyphForLabel(
  label: string,
  seed?: string,
): { map_keyword: string; map_icon: string } {
  return blockMapGlyphDbFields(
    { title: label },
    label,
    seed ? randFromSeed(seed) : Math.random,
  );
}

/** Random 3×3 occupancy used when creating a block. */
export function pickRandomBlockMapIcon(
  rand: () => number = Math.random,
): BlockMapIconName {
  const bits = 1 + Math.floor(rand() * BLOCK_MAP_PATTERN_MAX);
  return encodeBlockMapPattern(bits) ?? DEFAULT_BLOCK_MAP_ICON;
}

/** Stable 3×3 occupancy for iconless existing tiles (no flicker). */
export function blockMapIconFromTitle(title: string): BlockMapIconName {
  const s = clean(title);
  if (!s) return DEFAULT_BLOCK_MAP_ICON;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return catalogIndex(h);
}

export function isBlockMapIconName(value: unknown): value is BlockMapIconName {
  return parseBlockMapIconName(value) != null;
}

export function parseBlockMapIconName(raw: unknown): BlockMapIconName | null {
  const s = clean(raw);
  const m = PATTERN_RE.exec(s);
  if (!m) return null;
  return encodeBlockMapPattern(Number(m[1]));
}

export function normalizeBlockMapKeyword(
  raw: unknown,
  fallbackTitle?: string | null,
): string {
  const fromRaw = capitalizeKeyword(firstToken(clean(raw)));
  if (fromRaw.length >= 1) return fromRaw;
  const fromTitle = capitalizeKeyword(firstToken(clean(fallbackTitle)));
  return fromTitle || "Topic";
}

/** Keep a stored 3×3 pattern; otherwise a stable hash into the grid. */
export function normalizeBlockMapIcon(
  raw: unknown,
  fallbackTitle?: string | null,
): BlockMapIconName {
  return parseBlockMapIconName(raw) ?? blockMapIconFromTitle(clean(fallbackTitle));
}

export function normalizeBlockMapGlyph(
  raw: { keyword?: unknown; icon?: unknown } | null | undefined,
  fallbackTitle?: string | null,
): BlockMapGlyph {
  const title = clean(fallbackTitle);
  return {
    keyword: normalizeBlockMapKeyword(raw?.keyword, title),
    icon: normalizeBlockMapIcon(raw?.icon, title),
  };
}

/**
 * Columns written to `blocks` on create.
 * Keyword from the model (or title fallback); icon is a random 3×3 occupancy.
 */
export function blockMapGlyphDbFields(
  raw: unknown,
  fallbackTitle?: string | null,
  rand: () => number = Math.random,
): { map_keyword: string; map_icon: string } {
  const rec =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const title =
    fallbackTitle ?? (typeof rec.title === "string" ? rec.title : null);
  return {
    map_keyword: normalizeBlockMapKeyword(
      rec.keyword ?? rec.map_keyword ?? rec.mapKeyword,
      title,
    ),
    map_icon: pickRandomBlockMapIcon(rand),
  };
}

/** Resolve display glyph from stored columns or title fallback. */
export function resolveBlockMapGlyph(input: {
  map_keyword?: string | null;
  map_icon?: string | null;
  keyword?: string | null;
  icon?: string | null;
  title?: string | null;
}): BlockMapGlyph {
  const title = clean(input.title);
  return {
    keyword: normalizeBlockMapKeyword(
      input.map_keyword ?? input.keyword,
      title,
    ),
    icon: normalizeBlockMapIcon(input.map_icon ?? input.icon, title),
  };
}

/** Prompt instruction: keyword only — 3×3 mark is assigned server-side. */
export function composeBlockMapGlyphJsonInstruction(): string {
  return [
    'Also return "keyword" (exactly one map word, 2–18 characters, no spaces).',
    "Keyword is the tile label shown on the map instead of the full title.",
    "Do not pick an icon — the server assigns a random 3×3 rearrangement of squares (workspace: filled; TAP/ILE: outlines).",
  ].join(" ");
}

export const BLOCK_MAP_GLYPH_JSON_SHAPE =
  '{ "title": "...", "description": "...", "keyword": "..." }';

/** Regex fragment for missing-column retries. */
export const BLOCK_MAP_GLYPH_COLUMN_ERROR_RE = /map_keyword|map_icon/;
