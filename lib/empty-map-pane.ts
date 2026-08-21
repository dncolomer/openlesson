/**
 * Pure helpers for the empty-selection map right pane:
 * - Map Search: topic → multi filled block ids
 * - Suggest best empty spots for a topic
 * - Map overview (blocks + clusters)
 * - Selective Explanation free-shape area summary → map Note create input
 *
 * No React — unit-tested entry points for WorkspaceEmptyMapPane / host wiring.
 */

import {
  blocksIntersectingPolygon,
  emptyCellsIntersectingPolygon,
  type GridContinuousPoint,
} from "@/lib/block-map-tools";
import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";
import {
  buildMinimapClusterGraph,
  type MinimapBlockPlacement,
  type MinimapCluster,
  type MinimapClusterGraph,
} from "@/lib/map-minimap-clusters";
import {
  createLearnerMapNote,
  type LearnerMapNote,
  type LearnerMapNoteCreateInput,
  type MapNoteSource,
} from "@/lib/learner-map-notes";
import {
  buildOccupancyFromPlaced,
  placedBlockCells,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";
import { createMapFogLookup } from "@/lib/map-fog-of-war";

export type EmptyMapBlock = {
  id: string;
  title?: string | null;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: Array<{ dr: number; dc: number }> | null;
};

export type EmptyMapCell = { row: number; col: number };

/** Host request to apply multi-selection from search / suggest (token increments). */
export type ApplyMapSelectionRequest = {
  token: number;
  blockIds?: string[] | null;
  emptyCells?: EmptyMapCell[] | null;
};

/** Host request to inject a map Note from selective explanation. */
export type InjectMapNoteRequest = {
  token: number;
  body: string;
  x: number;
  y: number;
  source?: MapNoteSource;
};

export type SelectiveAreaSummary = {
  polygon: GridContinuousPoint[];
  blockIds: string[];
  blockTitles: string[];
  emptyCells: EmptyMapCell[];
  /** Human-readable summary of what the area contains. */
  text: string;
  /** Centroid in continuous grid coords (x=col, y=row). */
  centroid: GridContinuousPoint;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return clean(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.\u00c0-\u024f]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Strip conversational wrappers like "find me blocks about X" / "find blocks about X".
 */
export function normalizeMapSearchQuery(raw: unknown): string {
  let q = clean(raw);
  if (!q) return "";
  q = q.replace(
    /^(find\s+(me\s+)?)?(blocks?\s+)?(about|on|related\s+to|covering)\s+/i,
    "",
  );
  q = q.replace(/^(search\s+(for\s+)?)?(blocks?\s+)?(about\s+)?/i, "");
  q = q.replace(/^topics?\s*:\s*/i, "");
  return clean(q);
}

/**
 * Strip wrappers like "suggest best spot for X" / "best place for X".
 */
export function normalizeEmptySpotTopic(raw: unknown): string {
  let q = clean(raw);
  if (!q) return "";
  q = q.replace(
    /^(suggest\s+)?(the\s+)?(best\s+)?(spot|place|cell|location|empty)\s+(for\s+)?/i,
    "",
  );
  q = q.replace(/^(where\s+(should|to)\s+(i\s+)?(put|place|add)\s+)/i, "");
  q = q.replace(/^(recommend\s+(a\s+)?)?(spot|place)\s+(for\s+)?/i, "");
  return clean(q);
}

function scoreBlockAgainstTokens(
  block: EmptyMapBlock,
  tokens: readonly string[],
): number {
  if (!tokens.length) return 0;
  const title = clean(block.title).toLowerCase();
  const desc = clean(block.description).toLowerCase();
  const hay = `${title} ${desc}`;
  if (!hay.trim()) return 0;
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (title === t) score += 12;
    else if (title.includes(t)) score += 8;
    else if (desc.includes(t)) score += 4;
    else if (hay.includes(t)) score += 2;
  }
  // Phrase boost when full query is a substring of title
  return score;
}

/**
 * Map Search: topic/query → ordered matching filled block ids (multi-select).
 * Empty / whitespace query → [] (does not force required field failure).
 */
export function searchMapBlocksByTopic(
  blocks: readonly EmptyMapBlock[] | null | undefined,
  query: unknown,
): string[] {
  const topic = normalizeMapSearchQuery(query);
  if (!topic) return [];
  const tokens = tokenize(topic);
  if (!tokens.length) return [];
  const phrase = topic.toLowerCase();
  const scored: Array<{ id: string; score: number }> = [];
  for (const b of blocks || []) {
    const id = clean(b.id);
    if (!id) continue;
    let score = scoreBlockAgainstTokens(b, tokens);
    const title = clean(b.title).toLowerCase();
    const desc = clean(b.description).toLowerCase();
    if (phrase.length >= 3) {
      if (title.includes(phrase)) score += 10;
      else if (desc.includes(phrase)) score += 5;
    }
    if (score > 0) scored.push({ id, score });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored.map((s) => s.id);
}

function toPlacedRef(b: EmptyMapBlock): PlacedBlockRef | null {
  const id = clean(b.id);
  if (!id) return null;
  const px = Number(b.position_x);
  const py = Number(b.position_y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return {
    id,
    position_x: Math.trunc(px),
    position_y: Math.trunc(py),
    span_w: Number.isFinite(Number(b.span_w)) ? Math.max(1, Math.trunc(Number(b.span_w))) : 1,
    span_h: Number.isFinite(Number(b.span_h)) ? Math.max(1, Math.trunc(Number(b.span_h))) : 1,
    shape_cells: b.shape_cells ?? null,
  };
}

function keyOf(row: number, col: number): string {
  return `${row}:${col}`;
}

function toKeySet(
  keys?: ReadonlySet<string> | readonly string[] | null,
): Set<string> {
  if (keys instanceof Set) return new Set(keys);
  return new Set(keys || []);
}

/**
 * Collect placeable empty cells near a set of seed cells (Chebyshev ring expansion).
 * Excludes occupied + unusable. Deterministic order.
 */
export function collectPlaceableEmptyNearSeeds(input: {
  seeds: readonly EmptyMapCell[];
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
  /** How far to expand (Chebyshev). Default 3. */
  radius?: number;
  /** Max cells to return. Default 12. */
  limit?: number;
}): EmptyMapCell[] {
  const occupied = toKeySet(input.occupiedKeys);
  const unusable = toKeySet(input.unusableKeys);
  const radius = Math.max(1, Math.min(8, Math.floor(Number(input.radius) || 3)));
  const limit = Math.max(1, Math.min(48, Math.floor(Number(input.limit) || 12)));
  const seeds = (input.seeds || []).filter(
    (c) => Number.isFinite(c.row) && Number.isFinite(c.col),
  );
  if (!seeds.length) return [];

  const seen = new Set<string>();
  const out: EmptyMapCell[] = [];
  // Expand by ring distance so nearer empties win
  for (let d = 1; d <= radius && out.length < limit; d++) {
    const ring: EmptyMapCell[] = [];
    for (const s of seeds) {
      const sr = Math.trunc(s.row);
      const sc = Math.trunc(s.col);
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
          const row = sr + dr;
          const col = sc + dc;
          const k = keyOf(row, col);
          if (seen.has(k)) continue;
          seen.add(k);
          if (occupied.has(k) || unusable.has(k)) continue;
          ring.push({ row, col });
        }
      }
    }
    ring.sort((a, b) => a.row - b.row || a.col - b.col);
    for (const c of ring) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Suggest best empty placeable cells for a topic (multi-selection of empties).
 * Prefers empties near blocks matching the topic; falls back to near any block.
 * Empty topic → [] (optional field).
 */
/** Suggest-spot selection size slider (how many empty cells to multi-select). */
export const SUGGEST_SPOT_LIMIT_MIN = 1;
export const SUGGEST_SPOT_LIMIT_MAX = 16;
export const SUGGEST_SPOT_LIMIT_DEFAULT = 8;

/** Clamp slider / API limit for suggest-spot multi-select size. */
export function resolveSuggestSpotLimit(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return SUGGEST_SPOT_LIMIT_DEFAULT;
  return Math.max(
    SUGGEST_SPOT_LIMIT_MIN,
    Math.min(SUGGEST_SPOT_LIMIT_MAX, n),
  );
}

export function suggestEmptySpotsForTopic(input: {
  blocks: readonly EmptyMapBlock[] | null | undefined;
  topic: unknown;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
  limit?: number;
}): EmptyMapCell[] {
  const topic = normalizeEmptySpotTopic(input.topic);
  const blocks = input.blocks || [];
  const placed = blocks
    .map(toPlacedRef)
    .filter((p): p is PlacedBlockRef => Boolean(p));

  // Occupancy from placements when host did not pass keys
  let occupied = toKeySet(input.occupiedKeys);
  if (occupied.size === 0 && placed.length > 0) {
    occupied = new Set(buildOccupancyFromPlaced(placed).keys());
  }
  const unusable = toKeySet(input.unusableKeys);

  const matchIds = topic
    ? new Set(searchMapBlocksByTopic(blocks, topic))
    : new Set<string>();

  const seedBlocks =
    matchIds.size > 0
      ? placed.filter((p) => matchIds.has(p.id))
      : placed;

  if (seedBlocks.length === 0) {
    // No blocks on map: suggest a small patch around origin if free
    return collectPlaceableEmptyNearSeeds({
      seeds: [{ row: 0, col: 0 }],
      occupiedKeys: occupied,
      unusableKeys: unusable,
      radius: 2,
      limit: input.limit ?? 6,
    });
  }

  const seeds: EmptyMapCell[] = [];
  for (const p of seedBlocks) {
    const cells = placedBlockCells(p);
    if (cells.length) {
      // Prefer anchor / first cell as seed center
      seeds.push({ row: cells[0].row, col: cells[0].col });
    }
  }

  const limit = resolveSuggestSpotLimit(input.limit);
  // Search past occupancy fog so suggested empties can land in fogged rings
  // (extra-reveal then makes those cells fully visible).
  const pool = collectPlaceableEmptyNearSeeds({
    seeds,
    occupiedKeys: occupied,
    unusableKeys: unusable,
    radius: matchIds.size > 0 ? 6 : 5,
    limit: 48,
  });
  const fogLookup = createMapFogLookup({ occupiedKeys: occupied });
  const fogged: EmptyMapCell[] = [];
  const lit: EmptyMapCell[] = [];
  for (const c of pool) {
    if (fogLookup(c.row, c.col).fullyVisible) lit.push(c);
    else fogged.push(c);
  }
  const preferred = fogged.length > 0 ? fogged : lit;
  return preferred.slice(0, limit);
}

/**
 * Build minimap placements from empty-map blocks (for overview clusters).
 */
export function emptyMapBlocksToMinimapPlacements(
  blocks: readonly EmptyMapBlock[] | null | undefined,
): MinimapBlockPlacement[] {
  const out: MinimapBlockPlacement[] = [];
  for (const b of blocks || []) {
    const placed = toPlacedRef(b);
    if (!placed) continue;
    const cells = placedBlockCells(placed);
    if (!cells.length) continue;
    out.push({ id: placed.id, cells });
  }
  return out;
}

export type MapOverviewResult = {
  blockCount: number;
  clusterCount: number;
  clusters: MinimapCluster[];
  /** Short readable description for the overview box. */
  text: string;
  /** Sample block titles included in the blurb. */
  sampleTitles: string[];
};

/**
 * Short description of blocks + clusters on the map.
 * Empty map → explicit empty message (still valid UI state).
 */
export function buildMapOverviewSummary(
  blocks: readonly EmptyMapBlock[] | null | undefined,
): MapOverviewResult {
  const list = (blocks || []).filter((b) => clean(b.id));
  const titles = list
    .map((b) => clean(b.title) || "Untitled")
    .filter(Boolean);
  const placements = emptyMapBlocksToMinimapPlacements(list);
  const graph: MinimapClusterGraph = buildMinimapClusterGraph(placements);
  const clusterCount = graph.clusters.length;
  const sampleTitles = titles.slice(0, 6);

  if (list.length === 0) {
    return {
      blockCount: 0,
      clusterCount: 0,
      clusters: [],
      text: "This map is empty — no blocks yet. Use Build tools or search once content exists.",
      sampleTitles: [],
    };
  }

  const clusterBits = graph.clusters.map((c, i) => {
    const memberTitles = c.blockIds
      .map((id) => {
        const b = list.find((x) => x.id === id);
        return clean(b?.title) || id.slice(0, 8);
      })
      .slice(0, 3);
    const more =
      c.count > memberTitles.length
        ? ` +${c.count - memberTitles.length} more`
        : "";
    return `Cluster ${i + 1} (${c.count}): ${memberTitles.join(", ")}${more}`;
  });

  const head =
    list.length === 1
      ? `1 block on the map${sampleTitles[0] ? ` — “${sampleTitles[0]}”` : ""}.`
      : `${list.length} blocks in ${clusterCount} cluster${clusterCount === 1 ? "" : "s"}.`;

  const body =
    clusterBits.length > 0
      ? clusterBits.slice(0, 4).join(" · ")
      : sampleTitles.length
        ? `Topics: ${sampleTitles.join(", ")}${titles.length > sampleTitles.length ? "…" : ""}`
        : "";

  return {
    blockCount: list.length,
    clusterCount,
    clusters: graph.clusters,
    text: body ? `${head} ${body}` : head,
    sampleTitles,
  };
}

function polygonCentroid(
  polygon: readonly GridContinuousPoint[],
): GridContinuousPoint {
  if (!polygon.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of polygon) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    sx += p.x;
    sy += p.y;
    n += 1;
  }
  if (n === 0) return { x: 0, y: 0 };
  return { x: sx / n, y: sy / n };
}

/**
 * Free-shape overlay → blocks/cells inside + summary payload.
 * Does not mutate selection; pure geometry over map data.
 */
export function summarizeSelectiveArea(input: {
  polygon: readonly GridContinuousPoint[];
  blocks: readonly EmptyMapBlock[] | null | undefined;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): SelectiveAreaSummary {
  const polygon = (input.polygon || []).filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  const blocks = input.blocks || [];
  const placed = blocks
    .map(toPlacedRef)
    .filter((p): p is PlacedBlockRef => Boolean(p));

  let occupied = toKeySet(input.occupiedKeys);
  if (occupied.size === 0 && placed.length > 0) {
    occupied = new Set(buildOccupancyFromPlaced(placed).keys());
  }
  const unusable = toKeySet(input.unusableKeys);

  const blockInputs = placed.map((p) => {
    const cells = placedBlockCells(p);
    return {
      id: p.id,
      row: p.position_y,
      col: p.position_x,
      span_w: p.span_w,
      span_h: p.span_h,
      occupiedCells: cells,
    };
  });

  const blockIds =
    polygon.length >= 2
      ? blocksIntersectingPolygon(blockInputs, polygon)
      : [];
  const emptyCells =
    polygon.length >= 2
      ? emptyCellsIntersectingPolygon({
          polygon,
          occupiedKeys: occupied,
          unusableKeys: unusable,
          includeUnusable: false,
        })
      : [];

  const blockTitles = blockIds.map((id) => {
    const b = blocks.find((x) => x.id === id);
    return clean(b?.title) || "Untitled";
  });

  const centroid = polygonCentroid(polygon);
  let text: string;
  if (polygon.length < 3) {
    text = "Draw a closed free-shape area on the map to summarize its contents.";
  } else if (blockIds.length === 0 && emptyCells.length === 0) {
    text = "This area has no blocks and no free empty cells.";
  } else if (blockIds.length === 0) {
    text = `This area covers ${emptyCells.length} empty cell${emptyCells.length === 1 ? "" : "s"} (no filled blocks).`;
  } else {
    const titleList = blockTitles.slice(0, 8).join("; ");
    const more =
      blockTitles.length > 8 ? ` (+${blockTitles.length - 8} more)` : "";
    text = `This area contains ${blockIds.length} block${blockIds.length === 1 ? "" : "s"}: ${titleList}${more}. ${emptyCells.length} empty cell${emptyCells.length === 1 ? "" : "s"} inside.`;
  }

  return {
    polygon: polygon.map((p) => ({ x: p.x, y: p.y })),
    blockIds,
    blockTitles,
    emptyCells,
    text,
    centroid,
  };
}

/**
 * Convert selective-area summary → map Note create input (body + world position).
 * Position is top-left of the post-it near the polygon centroid on the map plane.
 */
export function mapNoteCreateInputFromAreaSummary(
  summary: SelectiveAreaSummary,
  opts?: {
    source?: MapNoteSource;
    id?: string;
    now?: number;
    pitch?: number;
  },
): LearnerMapNoteCreateInput {
  const pitch =
    Number.isFinite(opts?.pitch) && (opts?.pitch as number) > 0
      ? (opts!.pitch as number)
      : SKILL_GRID_PITCH;
  const body = clean(summary.text).slice(0, 280);
  const worldX = summary.centroid.x * pitch;
  const worldY = summary.centroid.y * pitch;
  // Offset slightly so the note sits on the area rather than dead-center only
  return {
    body: body || "Area summary",
    x: worldX - 40,
    y: worldY - 30,
    source: opts?.source ?? "creator",
    id: opts?.id,
    now: opts?.now,
  };
}

/** Create a full note record from a selective-area summary (drives real note helper). */
export function createMapNoteFromAreaSummary(
  summary: SelectiveAreaSummary,
  opts?: {
    source?: MapNoteSource;
    id?: string;
    now?: number;
    pitch?: number;
  },
): LearnerMapNote {
  return createLearnerMapNote(mapNoteCreateInputFromAreaSummary(summary, opts));
}

/** Whether the free-shape polygon is complete enough to summarize. */
export function isSelectivePolygonReady(
  polygon: readonly GridContinuousPoint[] | null | undefined,
): boolean {
  return (polygon?.length ?? 0) >= 3;
}

// ── Map explore drawer ids (right-column drawer group while FAB open) ──

/** Stable drawer ids for map-explore accordion (overview / search / spot / selective). */
export const MAP_EXPLORE_DRAWER_IDS = [
  "map_overview",
  "map_search",
  "map_suggest_spot",
  "map_selective",
  "map_explore_block",
] as const;

export type MapExploreDrawerId = (typeof MAP_EXPLORE_DRAWER_IDS)[number];

/** Default open drawer when map explore mounts (Map Search is the primary action). */
export const MAP_EXPLORE_DEFAULT_OPEN_DRAWER: MapExploreDrawerId = "map_search";

export function isMapExploreDrawerId(value: unknown): value is MapExploreDrawerId {
  return (
    typeof value === "string" &&
    (MAP_EXPLORE_DRAWER_IDS as readonly string[]).includes(value)
  );
}

// ── Map explore shell toggle (FAB open/close; restore prior right column) ──

/**
 * Right-column kinds the explore FAB can snapshot/restore.
 * `map_explore` is only the forced surface while the toggle is open.
 */
export type MapExplorePriorPane =
  | "map_tools"
  | "block_detail"
  | "combine_blocks"
  | "add_block"
  | "generate_shape"
  | "map_explore";

export type MapExploreShellState = {
  /** True while map explore UI is forced open (drawers hidden). */
  open: boolean;
  /**
   * Pane kind at the moment explore was opened (for restore semantics / tests).
   * Cleared on close; live selection still drives the natural pane after close.
   */
  previousPane: MapExplorePriorPane | null;
};

const PRIOR_PANES = new Set<MapExplorePriorPane>([
  "map_tools",
  "block_detail",
  "combine_blocks",
  "add_block",
  "generate_shape",
  "map_explore",
]);

export function normalizeMapExplorePriorPane(
  value: unknown,
  fallback: MapExplorePriorPane = "map_tools",
): MapExplorePriorPane {
  if (typeof value === "string" && PRIOR_PANES.has(value as MapExplorePriorPane)) {
    return value as MapExplorePriorPane;
  }
  return fallback;
}

export function createMapExploreShellState(): MapExploreShellState {
  return { open: false, previousPane: null };
}

/** Open explore; snapshot current pane. Idempotent if already open. */
export function openMapExploreShell(
  state: MapExploreShellState | null | undefined,
  currentPane?: unknown,
): MapExploreShellState {
  const prev = state ?? createMapExploreShellState();
  if (prev.open) return prev;
  const snapped = normalizeMapExplorePriorPane(currentPane, "map_tools");
  // Don't store map_explore as previous
  const previousPane =
    snapped === "map_explore" ? "map_tools" : snapped;
  return { open: true, previousPane };
}

/** Close explore and clear snapshot. Empty/omitted prior restores safely. */
export function closeMapExploreShell(
  state: MapExploreShellState | null | undefined,
): MapExploreShellState {
  void state;
  return createMapExploreShellState();
}

/** Toggle explore open/closed. Pass current natural pane when opening. */
export function toggleMapExploreShell(
  state: MapExploreShellState | null | undefined,
  currentPane?: unknown,
): MapExploreShellState {
  const prev = state ?? createMapExploreShellState();
  return prev.open
    ? closeMapExploreShell(prev)
    : openMapExploreShell(prev, currentPane);
}

/**
 * Resolve what the right column should render given the FAB toggle.
 * - open → show explore, hide drawers (`displayPane: "map_explore"`)
 * - closed → selection-driven natural pane (drawers or empty map_tools)
 * Empty/omitted previous still restores to naturalPane safely.
 */
export function resolveMapExploreRightColumn(input: {
  exploreOpen: boolean;
  /** Current selection-driven pane (ignore when explore is open). */
  naturalPane: unknown;
  /** Snapshot from open (optional; naturalPane wins after close). */
  previousPane?: unknown;
}): {
  showExplore: boolean;
  displayPane: MapExplorePriorPane;
  /** Pane after close (always natural when closed). */
  restoredPane: MapExplorePriorPane;
} {
  const natural = normalizeMapExplorePriorPane(input.naturalPane, "map_tools");
  if (input.exploreOpen) {
    return {
      showExplore: true,
      displayPane: "map_explore",
      restoredPane: natural,
    };
  }
  // Prefer live natural pane so drawers return when selection remains.
  // previousPane is only a fallback when natural is empty map_tools and a
  // non-empty snapshot was recorded (edge restore).
  const previous = normalizeMapExplorePriorPane(
    input.previousPane,
    natural,
  );
  const restored =
    natural !== "map_tools"
      ? natural
      : previous && previous !== "map_explore"
        ? previous
        : natural;
  return {
    showExplore: false,
    displayPane: restored === "map_explore" ? "map_tools" : restored,
    restoredPane: restored === "map_explore" ? "map_tools" : restored,
  };
}

// ── xAI-powered map exploration (prompts + response parsers) ──────────────

export type MapExploreOp =
  | "search"
  | "suggest_spot"
  | "overview"
  | "area_summary"
  | "explore_block";

export const MAP_EXPLORE_BLOCK_DRAWER_TITLE = "explore block";

/** Filled blocks whose footprint is within Chebyshev radius of a cell. */
export function collectNearbyFilledBlocks(input: {
  cell: EmptyMapCell;
  blocks: readonly EmptyMapBlock[] | null | undefined;
  radius?: number;
}): EmptyMapBlock[] {
  const cell = input.cell;
  if (!Number.isFinite(cell?.row) || !Number.isFinite(cell?.col)) return [];
  const radius = Math.max(1, Math.min(12, Math.floor(Number(input.radius) || 3)));
  const tr = Math.trunc(cell.row);
  const tc = Math.trunc(cell.col);
  const out: EmptyMapBlock[] = [];
  for (const b of input.blocks || []) {
    const placed = toPlacedRef(b);
    if (!placed) continue;
    const cells = placedBlockCells(placed);
    const hit = cells.some(
      (c) => Math.max(Math.abs(c.row - tr), Math.abs(c.col - tc)) <= radius,
    );
    if (hit) out.push(b);
  }
  return out;
}

export function buildExploreBlockSystemMessage(): string {
  return `You are Grok helping an author explore what could go in an empty cell on a learning-block map.
Given the target empty cell, nearby and already-filled blocks (map geometry), and an optional modifier, propose what is worth exploring in that empty spot.
Return ONLY JSON: { "summary": "..." }
Rules:
- 2–5 sentences of prose. Ground claims in neighboring/filled block titles and positions.
- Suggest themes, questions, or missing links — do not invent block ids.
- Honor the author modifier when present.
- No markdown.`;
}

export function buildExploreBlockUserPrompt(input: {
  cell: EmptyMapCell;
  blocks: readonly EmptyMapBlock[] | null | undefined;
  nearbyBlocks?: readonly EmptyMapBlock[] | null;
  modifierPrompt?: string | null;
}): string {
  const row = Math.trunc(Number(input.cell?.row));
  const col = Math.trunc(Number(input.cell?.col));
  const nearby = input.nearbyBlocks ?? collectNearbyFilledBlocks({
    cell: { row, col },
    blocks: input.blocks,
  });
  const modifier = clean(input.modifierPrompt);
  return [
    `Target empty cell: row=${row}, col=${col}`,
    modifier ? `Author modifier: ${modifier}` : null,
    `Already filled / explored blocks on the map:`,
    formatMapBlockCatalog(input.blocks),
    `Nearby filled blocks (geometry around the cell):`,
    formatMapBlockCatalog(nearby),
    `Return JSON with a prose summary of what to explore in this empty cell.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseExploreBlockAiResponse(raw: unknown): string {
  if (typeof raw === "string") return clean(raw);
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  return clean(obj.summary ?? obj.text ?? obj.exploration ?? obj.description);
}

/** Compact block catalog line for Grok prompts. */
export function formatMapBlockCatalogLine(block: EmptyMapBlock): string {
  const id = clean(block.id);
  const title = clean(block.title) || "Untitled";
  const desc = clean(block.description);
  const px = Number(block.position_x);
  const py = Number(block.position_y);
  const at =
    Number.isFinite(px) && Number.isFinite(py)
      ? ` @row=${Math.trunc(py)},col=${Math.trunc(px)}`
      : "";
  const body = desc ? ` — ${desc.slice(0, 160)}` : "";
  return `- id=${id} title="${title}"${at}${body}`;
}

export function formatMapBlockCatalog(
  blocks: readonly EmptyMapBlock[] | null | undefined,
  limit = 80,
): string {
  const list = (blocks || []).filter((b) => clean(b.id)).slice(0, limit);
  if (!list.length) return "(no blocks on map)";
  return list.map(formatMapBlockCatalogLine).join("\n");
}

export function buildMapSearchSystemMessage(): string {
  return `You are Grok helping explore a learning-block map.
Given a catalog of existing blocks and a user topic/query, select the blocks that best match.
Return ONLY JSON: { "blockIds": ["id1", "id2", ...], "rationale": "one short sentence" }
Rules:
- blockIds must be drawn ONLY from the catalog ids (never invent ids).
- Prefer semantic relevance over exact keyword match.
- Multi-select: return every strong match (0..N). Empty array if none fit.
- rationale: prose explanation, not a bullet list of titles.
- No markdown.`;
}

export function buildMapSearchUserPrompt(input: {
  query: string;
  blocks: readonly EmptyMapBlock[] | null | undefined;
}): string {
  const q = normalizeMapSearchQuery(input.query) || clean(input.query);
  return [
    `User request / topic: ${q || "(empty)"}`,
    `Block catalog:`,
    formatMapBlockCatalog(input.blocks),
    `Return JSON with blockIds for the multi-selection on the map.`,
  ].join("\n");
}

export function buildSuggestSpotSystemMessage(): string {
  return `You are Grok recommending empty map cells for new learning blocks.
Given existing blocks (with row/col anchors) and a topic, suggest placeable EMPTY grid coordinates.
Return ONLY JSON: { "cells": [ {"row": number, "col": number}, ... ], "rationale": "one short sentence" }
Rules:
- cells must be empty (not on any listed block anchor or its footprint if known).
- Prefer neighbors of topic-relevant blocks; keep multi-cell suggestions (3–8).
- Integer row/col only. Never invent cells far from content without reason.
- rationale: prose, not a dump of coordinates.
- No markdown.`;
}

export function buildSuggestSpotUserPrompt(input: {
  topic: string;
  blocks: readonly EmptyMapBlock[] | null | undefined;
  unusableKeys?: readonly string[] | null;
  limit?: number;
}): string {
  const topic = normalizeEmptySpotTopic(input.topic) || clean(input.topic);
  const limit = resolveSuggestSpotLimit(input.limit);
  const unusable = (input.unusableKeys || []).slice(0, 40).join(", ") || "(none)";
  return [
    `Topic for placement: ${topic || "(general — near existing content)"}`,
    `Suggest up to ${limit} empty cells as {row, col}.`,
    `Unusable cells (do not use): ${unusable}`,
    `Existing blocks:`,
    formatMapBlockCatalog(input.blocks),
    `Return JSON with cells array of map coordinates.`,
  ].join("\n");
}

export function buildMapOverviewSystemMessage(): string {
  return `You are Grok writing a short map overview for a learning workspace.
Given the blocks (and optional cluster structure), write a cohesive 2–4 sentence description of what the map is about — themes, depth, how clusters relate.
Return ONLY JSON: { "summary": "..." }
Rules:
- Do NOT bullet-list every block title. Synthesize.
- Mention clusters/regions only as thematic groups, not id dumps.
- If the map is empty, say so briefly and invite exploration once content exists.
- No markdown.`;
}

export function buildMapOverviewUserPrompt(input: {
  blocks: readonly EmptyMapBlock[] | null | undefined;
  clusterHints?: string | null;
}): string {
  const ov = buildMapOverviewSummary(input.blocks);
  const clusterHint =
    clean(input.clusterHints) ||
    (ov.clusterCount > 0
      ? `${ov.clusterCount} spatial clusters among ${ov.blockCount} blocks`
      : `${ov.blockCount} blocks`);
  return [
    `Map structure hint: ${clusterHint}`,
    `Block catalog:`,
    formatMapBlockCatalog(input.blocks),
    `Write a short overview summary (JSON).`,
  ].join("\n");
}

export function buildAreaSummarySystemMessage(): string {
  return `You are Grok summarizing a free-drawn region on a learning-block map.
The user drew an independent overlay (not a multi-select). Explain what that area is about using the blocks and empty space inside it.
Return ONLY JSON: { "summary": "..." }
Rules:
- 2–4 sentences of prose. Do not dump a raw title list as the whole answer.
- Ground claims in the provided in-area blocks and empty-cell context.
- Suitable to paste as a short map Note.
- No markdown.`;
}

export function buildAreaSummaryUserPrompt(input: {
  blocksInArea: readonly EmptyMapBlock[] | null | undefined;
  emptyCellCount: number;
  centroid?: GridContinuousPoint | null;
  userHint?: string | null;
}): string {
  const nEmpty = Math.max(0, Math.floor(Number(input.emptyCellCount) || 0));
  const c = input.centroid;
  const at =
    c && Number.isFinite(c.x) && Number.isFinite(c.y)
      ? `near continuous grid (~col ${c.x.toFixed(1)}, ~row ${c.y.toFixed(1)})`
      : "on the map";
  const hint = clean(input.userHint);
  return [
    `User drew a free-shape area ${at}.`,
    hint ? `User guidance: ${hint}` : null,
    `Empty cells inside area: ${nEmpty}`,
    `Blocks intersecting the area:`,
    formatMapBlockCatalog(input.blocksInArea),
    `Return JSON with a prose summary for this area.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Parse Grok search JSON → valid block ids only (order preserved). */
export function parseMapSearchAiResponse(
  raw: unknown,
  validBlockIds: ReadonlySet<string> | readonly string[],
): { blockIds: string[]; rationale: string } {
  const valid: Set<string> = Array.isArray(validBlockIds)
    ? new Set(validBlockIds.map((id) => clean(id)).filter(Boolean))
    : validBlockIds instanceof Set
      ? new Set(validBlockIds)
      : new Set(
          Array.from(validBlockIds as Iterable<string>)
            .map((id) => clean(id))
            .filter(Boolean),
        );
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.blockIds)
    ? obj.blockIds
    : Array.isArray(obj.ids)
      ? obj.ids
      : Array.isArray(raw)
        ? raw
        : [];
  const seen = new Set<string>();
  const blockIds: string[] = [];
  for (const item of list) {
    const id = clean(item);
    if (!id || seen.has(id) || !valid.has(id)) continue;
    seen.add(id);
    blockIds.push(id);
  }
  const rationale = clean(obj.rationale ?? obj.reason ?? obj.summary);
  return { blockIds, rationale };
}

/** Parse Grok suggest-spot JSON → integer cells, filtered to placeable. */
export function parseSuggestSpotAiResponse(
  raw: unknown,
  opts?: {
    occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
    unusableKeys?: ReadonlySet<string> | readonly string[] | null;
    limit?: number;
  },
): { cells: EmptyMapCell[]; rationale: string } {
  const occupied = toKeySet(opts?.occupiedKeys);
  const unusable = toKeySet(opts?.unusableKeys);
  const limit = resolveSuggestSpotLimit(opts?.limit);
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.cells)
    ? obj.cells
    : Array.isArray(obj.coordinates)
      ? obj.coordinates
      : Array.isArray(obj.spots)
        ? obj.spots
        : [];
  const seen = new Set<string>();
  const cells: EmptyMapCell[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const row = Math.trunc(Number(rec.row ?? rec.r ?? rec.y));
    const col = Math.trunc(Number(rec.col ?? rec.c ?? rec.x));
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
    const k = keyOf(row, col);
    if (seen.has(k) || occupied.has(k) || unusable.has(k)) continue;
    seen.add(k);
    cells.push({ row, col });
    if (cells.length >= limit) break;
  }
  const rationale = clean(obj.rationale ?? obj.reason ?? obj.summary);
  return { cells, rationale };
}

export function parseOverviewAiResponse(raw: unknown): string {
  if (typeof raw === "string") return clean(raw);
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  return clean(obj.summary ?? obj.text ?? obj.overview ?? obj.description);
}

export function parseAreaSummaryAiResponse(raw: unknown): string {
  if (typeof raw === "string") return clean(raw);
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  return clean(obj.summary ?? obj.text ?? obj.description);
}

/** Merge AI prose into a geometric area summary (keeps geometry + ids). */
export function applyAiTextToAreaSummary(
  base: SelectiveAreaSummary,
  aiText: string,
): SelectiveAreaSummary {
  const text = clean(aiText);
  if (!text) return base;
  return { ...base, text: text.slice(0, 280) };
}

export type { GridContinuousPoint, MinimapCluster };
