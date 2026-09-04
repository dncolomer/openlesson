/**
 * Initial-chapters catalog for ILE session plans and workspace skill-grid
 * block graphs. Chosen at session welcome / workspace create and accepted via
 * REST as `initial_chapters` (camelCase / legacy `map_size` aliases).
 *
 * Six named technique shapes + random sparse/dense count-band layouts.
 * Legacy `narrow` → random sparse, `broad` → random dense, `mid` → islands.
 */

export const INITIAL_CHAPTERS_TECHNIQUE_IDS = [
  "islands",
  "spiral",
  "ladder",
  "hub",
  "tracks",
  "ring",
] as const;

export const INITIAL_CHAPTERS_RANDOM_IDS = ["random_sparse", "random_dense"] as const;

export type InitialChaptersTechniqueId = (typeof INITIAL_CHAPTERS_TECHNIQUE_IDS)[number];
export type InitialChaptersRandomId = (typeof INITIAL_CHAPTERS_RANDOM_IDS)[number];
export type InitialChaptersLevel = InitialChaptersTechniqueId | InitialChaptersRandomId;

export const INITIAL_CHAPTERS_LEVELS: readonly InitialChaptersLevel[] = [
  ...INITIAL_CHAPTERS_TECHNIQUE_IDS,
  ...INITIAL_CHAPTERS_RANDOM_IDS,
] as const;

/** Documented default when the body omits the field or the value is unknown. */
export const DEFAULT_INITIAL_CHAPTERS: InitialChaptersLevel = "islands";

export const LEGACY_INITIAL_CHAPTERS_ALIASES = {
  narrow: "random_sparse",
  mid: "islands",
  broad: "random_dense",
} as const;

export type LegacyInitialChaptersAlias = keyof typeof LEGACY_INITIAL_CHAPTERS_ALIASES;

export interface InitialChaptersBand {
  min: number;
  max: number;
  /** Preferred count to request within the band. */
  target: number;
  label: string;
  audience: string;
}

type Cell = { row: number; col: number };

export type InitialChaptersKind = "technique" | "random";

export type InitialChaptersOption = {
  id: InitialChaptersLevel;
  kind: InitialChaptersKind;
  label: string;
  description: string;
  audience: string;
  band: InitialChaptersBand;
  /** Extra spatial recipe injected into generate prompts (empty for random). */
  layoutInstruction: string;
  occupied: readonly Cell[];
  blocked: readonly Cell[];
  /** i18n key suffix under session.* / planMode.* */
  titleKey: string;
  descKey: string;
};

const SPARSE_BAND: InitialChaptersBand = {
  min: 6,
  max: 10,
  target: 8,
  label: "random sparse",
  audience: "a light scatter of chapters — fewer tiles, focused start (legacy narrow)",
};

const SHAPED_BAND: InitialChaptersBand = {
  min: 10,
  max: 15,
  target: 12,
  label: "shaped",
  audience: "a named learning-technique layout at a standard chapter count",
};

const DENSE_BAND: InitialChaptersBand = {
  min: 15,
  max: 22,
  target: 18,
  label: "random dense",
  audience: "a fuller scatter of chapters and deeper branch arms (legacy broad)",
};

function bandFor(
  option: Pick<InitialChaptersOption, "id" | "label" | "audience">,
  source: InitialChaptersBand,
): InitialChaptersBand {
  return {
    ...source,
    label: option.label,
    audience: option.audience,
  };
}

const ISLANDS_OCCUPIED: Cell[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 0, col: 5 },
  { row: 0, col: 6 },
  { row: 1, col: 5 },
  { row: 1, col: 6 },
  { row: 5, col: 5 },
  { row: 5, col: 6 },
  { row: 6, col: 5 },
  { row: 6, col: 6 },
];

/** One-cell-wide spiral corridor; blocked walls between turns show the form. */
const SPIRAL_OCCUPIED: Cell[] = [
  { row: 3, col: 3 },
  { row: 3, col: 4 },
  { row: 3, col: 5 },
  { row: 2, col: 5 },
  { row: 1, col: 5 },
  { row: 1, col: 4 },
  { row: 1, col: 3 },
  { row: 1, col: 2 },
  { row: 1, col: 1 },
  { row: 2, col: 1 },
  { row: 3, col: 1 },
  { row: 4, col: 1 },
  { row: 5, col: 1 },
  { row: 5, col: 2 },
  { row: 5, col: 3 },
  { row: 5, col: 4 },
  { row: 5, col: 5 },
];

const SPIRAL_BLOCKED: Cell[] = (() => {
  const spawn = new Set(SPIRAL_OCCUPIED.map((c) => `${c.row}:${c.col}`));
  const out: Cell[] = [];
  for (let row = 0; row <= 6; row += 1) {
    for (let col = 0; col <= 6; col += 1) {
      if (!spawn.has(`${row}:${col}`)) out.push({ row, col });
    }
  }
  return out;
})();

const ISLANDS_BLOCKED: Cell[] = [
  { row: 0, col: 3 },
  { row: 1, col: 3 },
  { row: 2, col: 2 },
  { row: 2, col: 3 },
  { row: 2, col: 4 },
  { row: 3, col: 0 },
  { row: 3, col: 1 },
  { row: 3, col: 2 },
  { row: 3, col: 4 },
  { row: 3, col: 5 },
  { row: 3, col: 6 },
  { row: 4, col: 2 },
  { row: 4, col: 3 },
  { row: 4, col: 4 },
  { row: 5, col: 3 },
  { row: 6, col: 3 },
];

export const INITIAL_CHAPTERS_CATALOG: readonly InitialChaptersOption[] = [
  {
    id: "islands",
    kind: "technique",
    label: "Islands",
    description:
      "Three core clusters with blocked corridors between them — learn each island, then build bridges.",
    audience: "learn separate cores first, then connect them with bridges",
    band: bandFor(
      {
        id: "islands",
        label: "Islands",
        audience: "learn separate cores first, then connect them with bridges",
      },
      SHAPED_BAND,
    ),
    layoutInstruction:
      'LAYOUT PATTERN "Islands": Place chapters in THREE spatially separated clusters (islands) of related core concepts. Leave empty corridors between islands so later work can build bridges. Do not occupy corridor cells. You may treat corridor cells as blocked / non-placeable. Start at (0, 0) inside one island.',
    occupied: ISLANDS_OCCUPIED,
    blocked: ISLANDS_BLOCKED,
    titleKey: "initialChaptersIslands",
    descKey: "initialChaptersIslandsDesc",
  },
  {
    id: "spiral",
    kind: "technique",
    label: "Spiral",
    description:
      "Start at the core and wind outward, revisiting ideas at rising complexity (spiral curriculum).",
    audience: "revisit the same ideas in widening loops of difficulty",
    band: bandFor(
      {
        id: "spiral",
        label: "Spiral",
        audience: "revisit the same ideas in widening loops of difficulty",
      },
      SHAPED_BAND,
    ),
    layoutInstruction:
      'LAYOUT PATTERN "Spiral": Place chapters along a ONE-CELL-WIDE spiral corridor winding out from the core. Foundation sits at the inner end of the spiral, not at a far-off origin. Do not fill the interior and do not occupy the blocked walls between turns — those hatched cells keep the spiral shape readable. Later tiles along the path revisit earlier themes at higher complexity.',
    occupied: SPIRAL_OCCUPIED,
    blocked: SPIRAL_BLOCKED,
    titleKey: "initialChaptersSpiral",
    descKey: "initialChaptersSpiralDesc",
  },
  {
    id: "ladder",
    kind: "technique",
    label: "Ladder",
    description:
      "A scaffolded climb: each rung is a prerequisite, with small practice steps off the spine.",
    audience: "master one rung before the next, with side practice",
    band: bandFor(
      {
        id: "ladder",
        label: "Ladder",
        audience: "master one rung before the next, with side practice",
      },
      SHAPED_BAND,
    ),
    layoutInstruction:
      'LAYOUT PATTERN "Ladder": Place a vertical (or horizontal) spine of prerequisite chapters from the origin, with short side rungs for worked examples or practice. Later rungs depend on earlier ones. Do not scatter off-spine except as short rungs.',
    occupied: [
      { row: 0, col: 3 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
      { row: 2, col: 3 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
      { row: 4, col: 5 },
      { row: 5, col: 3 },
      { row: 6, col: 2 },
      { row: 6, col: 3 },
    ],
    blocked: [],
    titleKey: "initialChaptersLadder",
    descKey: "initialChaptersLadderDesc",
  },
  {
    id: "hub",
    kind: "technique",
    label: "Hub",
    description:
      "One foundation in the center with radiating arms to elaborate and connect (schema building).",
    audience: "build a core schema, then elaborate along spokes",
    band: bandFor(
      {
        id: "hub",
        label: "Hub",
        audience: "build a core schema, then elaborate along spokes",
      },
      SHAPED_BAND,
    ),
    layoutInstruction:
      'LAYOUT PATTERN "Hub": Place the start at (0, 0) as the hub. Radiate 3–4 arms of related chapters outward (elaboration / schema building). Keep arms distinct; leave gaps between spokes.',
    occupied: [
      { row: 3, col: 3 },
      { row: 3, col: 2 },
      { row: 3, col: 1 },
      { row: 3, col: 4 },
      { row: 3, col: 5 },
      { row: 2, col: 3 },
      { row: 1, col: 3 },
      { row: 4, col: 3 },
      { row: 5, col: 3 },
      { row: 1, col: 1 },
      { row: 1, col: 5 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
    ],
    blocked: [
      { row: 2, col: 2 },
      { row: 2, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 4 },
    ],
    titleKey: "initialChaptersHub",
    descKey: "initialChaptersHubDesc",
  },
  {
    id: "tracks",
    kind: "technique",
    label: "Tracks",
    description:
      "Two parallel tracks (theory and practice) with a blocked median and a few crossing points.",
    audience: "interleave two related streams and cross only at planned bridges",
    band: bandFor(
      {
        id: "tracks",
        label: "Tracks",
        audience: "interleave two related streams and cross only at planned bridges",
      },
      SHAPED_BAND,
    ),
    layoutInstruction:
      'LAYOUT PATTERN "Tracks": Place two parallel tracks of chapters (for example theory vs practice). Leave a blocked or empty median between them except at 1–3 crossing cells where the tracks may connect. Do not fill the median.',
    occupied: [
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 4, col: 1 },
      { row: 5, col: 1 },
      { row: 6, col: 1 },
      { row: 0, col: 5 },
      { row: 1, col: 5 },
      { row: 2, col: 5 },
      { row: 4, col: 5 },
      { row: 5, col: 5 },
      { row: 6, col: 5 },
      { row: 2, col: 3 },
      { row: 4, col: 3 },
    ],
    blocked: [
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
      { row: 5, col: 2 },
      { row: 5, col: 3 },
      { row: 5, col: 4 },
      { row: 6, col: 2 },
      { row: 6, col: 3 },
      { row: 6, col: 4 },
    ],
    titleKey: "initialChaptersTracks",
    descKey: "initialChaptersTracksDesc",
  },
  {
    id: "ring",
    kind: "technique",
    label: "Ring",
    description:
      "A ring around a blocked center — space practice around a core you keep returning to.",
    audience: "orbit a core idea with spaced practice on the ring",
    band: bandFor(
      {
        id: "ring",
        label: "Ring",
        audience: "orbit a core idea with spaced practice on the ring",
      },
      SHAPED_BAND,
    ),
    layoutInstruction:
      'LAYOUT PATTERN "Ring": Place chapters in a ring around a blocked or empty center. The start may sit on the ring. Do not occupy the interior; leave it blocked/non-placeable so the learner returns around the core.',
    occupied: [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
      { row: 0, col: 5 },
      { row: 1, col: 0 },
      { row: 1, col: 6 },
      { row: 2, col: 0 },
      { row: 2, col: 6 },
      { row: 3, col: 0 },
      { row: 3, col: 6 },
      { row: 4, col: 0 },
      { row: 4, col: 6 },
      { row: 5, col: 0 },
      { row: 5, col: 6 },
      { row: 6, col: 1 },
      { row: 6, col: 2 },
      { row: 6, col: 3 },
      { row: 6, col: 4 },
      { row: 6, col: 5 },
    ],
    blocked: [
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
    ],
    titleKey: "initialChaptersRing",
    descKey: "initialChaptersRingDesc",
  },
  {
    id: "random_sparse",
    kind: "random",
    label: "Random sparse",
    description: "A light scatter of chapters — the old Narrow count, with no named shape.",
    audience: SPARSE_BAND.audience,
    band: SPARSE_BAND,
    layoutInstruction: "",
    occupied: [
      { row: 1, col: 1 },
      { row: 1, col: 4 },
      { row: 3, col: 2 },
      { row: 5, col: 1 },
      { row: 5, col: 5 },
    ],
    blocked: [],
    titleKey: "initialChaptersRandomSparse",
    descKey: "initialChaptersRandomSparseDesc",
  },
  {
    id: "random_dense",
    kind: "random",
    label: "Random dense",
    description: "A fuller scatter of chapters — the old Broad count, with no named shape.",
    audience: DENSE_BAND.audience,
    band: DENSE_BAND,
    layoutInstruction: "",
    occupied: [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
    ],
    blocked: [],
    titleKey: "initialChaptersRandomDense",
    descKey: "initialChaptersRandomDenseDesc",
  },
] as const;

const OPTION_BY_ID: Record<InitialChaptersLevel, InitialChaptersOption> = INITIAL_CHAPTERS_CATALOG.reduce(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {} as Record<InitialChaptersLevel, InitialChaptersOption>,
);

export const INITIAL_CHAPTERS_BANDS: Record<InitialChaptersLevel, InitialChaptersBand> =
  INITIAL_CHAPTERS_LEVELS.reduce(
    (acc, id) => {
      acc[id] = OPTION_BY_ID[id].band;
      return acc;
    },
    {} as Record<InitialChaptersLevel, InitialChaptersBand>,
  );

export function isInitialChaptersLevel(value: unknown): value is InitialChaptersLevel {
  return (
    typeof value === "string" &&
    (INITIAL_CHAPTERS_LEVELS as readonly string[]).includes(value)
  );
}

export function isInitialChaptersTechniqueId(
  value: unknown,
): value is InitialChaptersTechniqueId {
  return (
    typeof value === "string" &&
    (INITIAL_CHAPTERS_TECHNIQUE_IDS as readonly string[]).includes(value)
  );
}

export function isLegacyInitialChaptersAlias(
  value: unknown,
): value is LegacyInitialChaptersAlias {
  return typeof value === "string" && value in LEGACY_INITIAL_CHAPTERS_ALIASES;
}

/** Canonicalize a known id or legacy alias; null if neither. */
export function canonicalizeInitialChapters(
  value: unknown,
): InitialChaptersLevel | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (isInitialChaptersLevel(raw)) return raw;
  if (isLegacyInitialChaptersAlias(raw)) return LEGACY_INITIAL_CHAPTERS_ALIASES[raw];
  return null;
}

/**
 * Coerce API/UI body values. Known ids and legacy aliases map in;
 * unknown values become the documented default (`islands`).
 */
export function parseInitialChaptersLevel(value: unknown): InitialChaptersLevel {
  return canonicalizeInitialChapters(value) ?? DEFAULT_INITIAL_CHAPTERS;
}

/**
 * Resolve level from a create-request body, accepting:
 * `initial_chapters` | `initialChapters` | legacy `map_size` | `mapSize`.
 * Legacy `narrow` → random_sparse, `broad` → random_dense, `mid` → islands.
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
    const parsed = canonicalizeInitialChapters(value);
    if (parsed) return parsed;
  }
  return DEFAULT_INITIAL_CHAPTERS;
}

export function getInitialChaptersOption(
  level: InitialChaptersLevel | unknown,
): InitialChaptersOption {
  return OPTION_BY_ID[parseInitialChaptersLevel(level)];
}

export function getInitialChaptersBand(
  level: InitialChaptersLevel | unknown,
): InitialChaptersBand {
  return getInitialChaptersOption(level).band;
}

/** Wrap-around catalog step for the single-card picker arrows. */
export function stepInitialChaptersCatalog(
  current: InitialChaptersLevel | unknown,
  delta: number,
): InitialChaptersLevel {
  const parsed = parseInitialChaptersLevel(current);
  const idx = INITIAL_CHAPTERS_LEVELS.indexOf(parsed);
  const n = INITIAL_CHAPTERS_LEVELS.length;
  const from = idx < 0 ? 0 : idx;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const next = ((from + step) % n + n) % n;
  return INITIAL_CHAPTERS_LEVELS[next];
}

/** One of the eight catalog types, chosen uniformly. */
export function pickRandomInitialChapters(
  rand: () => number = Math.random,
): InitialChaptersLevel {
  const n = INITIAL_CHAPTERS_LEVELS.length;
  if (n <= 0) return DEFAULT_INITIAL_CHAPTERS;
  const raw = rand();
  const roll = Number.isFinite(raw) ? raw : Math.random();
  const i = Math.min(n - 1, Math.max(0, Math.floor(roll * n)));
  return INITIAL_CHAPTERS_LEVELS[i];
}

/** Prompt-facing summary of the chosen initial-chapters option. */
export function formatInitialChaptersForPrompt(level: InitialChaptersLevel | unknown): {
  level: InitialChaptersLevel;
  band: InitialChaptersBand;
  countInstruction: string;
  layoutInstruction: string;
  blockedInstruction: string;
} {
  const option = getInitialChaptersOption(level);
  const band = option.band;
  const layoutInstruction = option.layoutInstruction.trim();
  const blockedInstruction = formatBlockedChapterSlotsForPrompt(option.id);
  const countInstruction = [
    `Generate about ${band.target} initial chapters/blocks (acceptable range ${band.min}-${band.max}). Initial chapters level is "${option.id}" — ${option.label} (${band.audience}).`,
    layoutInstruction,
    blockedInstruction,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    level: option.id,
    band,
    countInstruction,
    layoutInstruction,
    blockedInstruction,
  };
}

/** Pattern blocked cells as map-ground unusable slots (row/col = position_y/position_x). */
export function blockedChapterSlotsFromPattern(
  level: InitialChaptersLevel | unknown,
): Array<{ row: number; col: number }> {
  return getInitialChaptersOption(level).blocked.map((cell) => ({
    row: cell.row,
    col: cell.col,
  }));
}

export function formatBlockedChapterSlotsForPrompt(
  level: InitialChaptersLevel | unknown,
): string {
  const blocked = blockedChapterSlotsFromPattern(level);
  if (blocked.length === 0) return "";
  const list = blocked
    .map((cell) => `(position_x=${cell.col}, position_y=${cell.row})`)
    .join(", ");
  return `BLOCKED CHAPTER SLOTS (non-placeable ground): do not place any chapter or block on these cells: ${list}. Persist them as blocked/unusable so corridors stay empty for later bridges.`;
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
