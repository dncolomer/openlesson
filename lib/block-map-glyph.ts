/**
 * Workspace map-tile glyph: two keywords + a 3×3 rearrangement of solid squares.
 * Keywords are generated with the block; the mark is a random occupancy of a
 * 3×3 grid (not topic-matched). Displayed instead of the truncated title.
 */

export const BLOCK_MAP_GRID_SIZE = 3;
export const BLOCK_MAP_CELL_COUNT = BLOCK_MAP_GRID_SIZE * BLOCK_MAP_GRID_SIZE;
/** Non-empty 3×3 occupancy masks: bits 1..511. */
export const BLOCK_MAP_PATTERN_MAX = (1 << BLOCK_MAP_CELL_COUNT) - 1;

/** TIM-sourced ILE chapter that has not been opened yet (explore/map glyph). */
export const TIM_EXPLORE_MAP_ICON = "tim-explore" as const;
export type TimExploreMapIcon = typeof TIM_EXPLORE_MAP_ICON;

/** Display-only: completed ILE chapter (flag). Not persisted — storage keeps the 3×3. */
export const CHAPTER_DONE_MAP_ICON = "chapter-done" as const;
export type ChapterDoneMapIcon = typeof CHAPTER_DONE_MAP_ICON;

/** Display-only: running Gather resources (binoculars). Not persisted. */
export const ILE_GATHER_RUNNING_MAP_ICON = "gather-resources" as const;
export type IleGatherRunningMapIcon = typeof ILE_GATHER_RUNNING_MAP_ICON;

export function isIleGatherRunningMapIcon(value: unknown): value is IleGatherRunningMapIcon {
  return value === ILE_GATHER_RUNNING_MAP_ICON;
}

/** `g{bits}` — bits is a 9-bit occupancy mask (1 = filled cell). */
export type BlockMapIconName = `g${number}` | TimExploreMapIcon | ChapterDoneMapIcon;

export function isTimExploreMapIcon(value: unknown): value is TimExploreMapIcon {
  return value === TIM_EXPLORE_MAP_ICON;
}

export function isChapterDoneMapIcon(value: unknown): value is ChapterDoneMapIcon {
  return value === CHAPTER_DONE_MAP_ICON;
}

/** 2×2 in the top-left of the 3×3 (cells 0,1,3,4). */
export const DEFAULT_BLOCK_MAP_ICON: BlockMapIconName = "g27";

export type BlockMapGlyph = {
  keyword: string;
  icon: BlockMapIconName;
};

const KEYWORD_MIN_WORDS = 1;
const KEYWORD_MAX_WORDS = 2;
const KEYWORD_MAX = 28;
const PATTERN_RE = /^g(\d+)$/;

function clean(s: unknown): string {
  return String(s ?? "").trim();
}

function keywordTokens(s: string): string[] {
  const stripped = s
    .replace(/[_/\\]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .trim();
  if (!stripped) return [];
  return stripped
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
}

function capitalizeKeyword(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function formatKeywordPhrase(tokens: string[]): string {
  const words = tokens.slice(0, KEYWORD_MAX_WORDS).map(capitalizeKeyword);
  if (words.length === 0) return "";
  const phrase = words.join(" ");
  if (phrase.length <= KEYWORD_MAX) return phrase;
  return phrase.slice(0, KEYWORD_MAX).trim().replace(/-+$/g, "");
}

export function encodeBlockMapPattern(bits: number): BlockMapIconName | null {
  if (!Number.isInteger(bits) || bits < 1 || bits > BLOCK_MAP_PATTERN_MAX) {
    return null;
  }
  return `g${bits}`;
}

export function blockMapPatternBits(name: BlockMapIconName): number {
  if (isTimExploreMapIcon(name) || isChapterDoneMapIcon(name)) return 0;
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
 * Two-word keyword from the label + a 3×3 pattern.
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
  if (s === TIM_EXPLORE_MAP_ICON) return TIM_EXPLORE_MAP_ICON;
  if (s === CHAPTER_DONE_MAP_ICON) return CHAPTER_DONE_MAP_ICON;
  const m = PATTERN_RE.exec(s);
  if (!m) return null;
  return encodeBlockMapPattern(Number(m[1]));
}

export function normalizeBlockMapKeyword(
  raw: unknown,
  fallbackTitle?: string | null,
): string {
  const fromRaw = keywordTokens(clean(raw));
  // Keep the model's 1 or 2 words as-is. Title words are only a fallback
  // when the title request did not return a keyword.
  if (fromRaw.length >= KEYWORD_MIN_WORDS) return formatKeywordPhrase(fromRaw);
  const fromTitle = keywordTokens(clean(fallbackTitle));
  if (fromTitle.length >= KEYWORD_MIN_WORDS) return formatKeywordPhrase(fromTitle);
  return "Topic";
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
 * 1–2 word keyword from the model (or title fallback); icon is a random 3×3 occupancy.
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

/** Prompt instruction: 1–2 keyword words — 3×3 mark is assigned server-side. */
export function composeBlockMapGlyphJsonInstruction(): string {
  return [
    'Also return "keyword" (1 or 2 map words, 4–28 characters, no punctuation).',
    "Keyword is the 1–2 word tile label shown on the map instead of the full title.",
    "Suggest it with the title/description — do not truncate the title to its first words.",
    "Do not pick an icon — the server assigns a random 3×3 rearrangement of squares (workspace: filled; TAP/ILE: outlines).",
  ].join(" ");
}

/**
 * ILE chapters: each step must carry its own map keyword, same as workspace
 * blocks. Generic "also return keyword" is easy to miss when the JSON example
 * is a plan with nested steps.
 */
export function composeChapterMapGlyphJsonInstruction(): string {
  return [
    'Each chapter/step must include "keyword" (1 or 2 map words, 4–28 characters, no punctuation).',
    "Keyword is suggested as part of title/description generation — the 1–2 word tile label shown on the map instead of the full chapter text.",
    "Do not copy the first words of the description. Invent a short map label (e.g. description 'Prove AVL rotate-left after insert' → keyword 'AVL Rotate').",
    "Do not pick an icon — the server assigns a random 3×3 rearrangement of squares (TAP/ILE: outlines).",
  ].join(" ");
}

export const BLOCK_MAP_GLYPH_JSON_SHAPE =
  '{ "title": "...", "description": "...", "keyword": "Two Words" }';

/** Regex fragment for missing-column retries. */
export const BLOCK_MAP_GLYPH_COLUMN_ERROR_RE = /map_keyword|map_icon/;
