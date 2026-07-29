/**
 * Shared infinite-grid canvas tokens for Map of Knowledge + workspace Knowledge.
 *
 * Used by Local Map 2D (SVG), Local Map 3D (Three.js), Global Map (SVG), and the
 * workspace Local projection canvas. No axis chrome — only a dark field +
 * repeating grid that reads as an infinite plane under pan/zoom.
 */

/** Near-black field behind every map surface. */
export const MAP_INFINITE_GRID_BACKGROUND = "#09090b";

/** Three.js / numeric hex for the same field. */
export const MAP_INFINITE_GRID_BACKGROUND_HEX = 0x09090b;

/** Primary grid stroke (zinc-700-ish @ ~35% opacity). */
export const MAP_INFINITE_GRID_STROKE = "rgba(63, 63, 70, 0.35)";

/** Grid line color without alpha (for Three.js materials). */
export const MAP_INFINITE_GRID_STROKE_HEX = 0x3f3f46;

/** Opacity applied to Three.js GridHelper materials. */
export const MAP_INFINITE_GRID_STROKE_OPACITY = 0.35;

/** Screen-space SVG pattern cell size in user units (matches 2D viewBox scale). */
export const MAP_INFINITE_GRID_CELL_PX = 40;

/**
 * Default SVG pattern id. Each SVG document may reuse this id in its own <defs>.
 */
export const MAP_INFINITE_GRID_PATTERN_ID = "map-infinite-grid";

/**
 * World-space 3D grid: large plane so the floor reads as infinite under orbit/pan.
 * Cell size ≈ MAP_INFINITE_GRID_3D_SIZE / MAP_INFINITE_GRID_3D_DIVISIONS.
 */
export const MAP_INFINITE_GRID_3D_SIZE = 200;
export const MAP_INFINITE_GRID_3D_DIVISIONS = 100;

/** Fog far distance so the large grid fades rather than hard-clipping. */
export const MAP_INFINITE_GRID_3D_FOG_NEAR = 40;
export const MAP_INFINITE_GRID_3D_FOG_FAR = 160;

/** Camera max distance for Local 3D so the large plane stays in frame. */
export const MAP_INFINITE_GRID_3D_MAX_DISTANCE = 120;

export type MapInfiniteGridTokens = {
  background: typeof MAP_INFINITE_GRID_BACKGROUND;
  backgroundHex: typeof MAP_INFINITE_GRID_BACKGROUND_HEX;
  stroke: typeof MAP_INFINITE_GRID_STROKE;
  strokeHex: typeof MAP_INFINITE_GRID_STROKE_HEX;
  strokeOpacity: typeof MAP_INFINITE_GRID_STROKE_OPACITY;
  cellPx: typeof MAP_INFINITE_GRID_CELL_PX;
  patternId: typeof MAP_INFINITE_GRID_PATTERN_ID;
  size3d: typeof MAP_INFINITE_GRID_3D_SIZE;
  divisions3d: typeof MAP_INFINITE_GRID_3D_DIVISIONS;
  fogNear3d: typeof MAP_INFINITE_GRID_3D_FOG_NEAR;
  fogFar3d: typeof MAP_INFINITE_GRID_3D_FOG_FAR;
  maxDistance3d: typeof MAP_INFINITE_GRID_3D_MAX_DISTANCE;
};

/** Single source of truth for all map infinite-grid surfaces. */
export const MAP_INFINITE_GRID: MapInfiniteGridTokens = {
  background: MAP_INFINITE_GRID_BACKGROUND,
  backgroundHex: MAP_INFINITE_GRID_BACKGROUND_HEX,
  stroke: MAP_INFINITE_GRID_STROKE,
  strokeHex: MAP_INFINITE_GRID_STROKE_HEX,
  strokeOpacity: MAP_INFINITE_GRID_STROKE_OPACITY,
  cellPx: MAP_INFINITE_GRID_CELL_PX,
  patternId: MAP_INFINITE_GRID_PATTERN_ID,
  size3d: MAP_INFINITE_GRID_3D_SIZE,
  divisions3d: MAP_INFINITE_GRID_3D_DIVISIONS,
  fogNear3d: MAP_INFINITE_GRID_3D_FOG_NEAR,
  fogFar3d: MAP_INFINITE_GRID_3D_FOG_FAR,
  maxDistance3d: MAP_INFINITE_GRID_3D_MAX_DISTANCE,
};

/**
 * SVG path `d` for one cell of the infinite grid pattern (top + left edges).
 * Pure — unit-tested so SVG surfaces share the same geometry.
 */
export function mapInfiniteGridPatternPath(cellPx: number = MAP_INFINITE_GRID_CELL_PX): string {
  const c = Number.isFinite(cellPx) && cellPx > 0 ? cellPx : MAP_INFINITE_GRID_CELL_PX;
  return `M ${c} 0 L 0 0 0 ${c}`;
}

/**
 * SVG pattern attributes for a screen-space infinite grid (userSpaceOnUse).
 * Pure — consumers spread or serialize into <pattern>.
 */
export function mapInfiniteGridPatternAttrs(
  patternId: string = MAP_INFINITE_GRID_PATTERN_ID,
  cellPx: number = MAP_INFINITE_GRID_CELL_PX,
): {
  id: string;
  width: number;
  height: number;
  patternUnits: "userSpaceOnUse";
  pathD: string;
  stroke: string;
  strokeWidth: number;
} {
  const c = Number.isFinite(cellPx) && cellPx > 0 ? cellPx : MAP_INFINITE_GRID_CELL_PX;
  return {
    id: patternId || MAP_INFINITE_GRID_PATTERN_ID,
    width: c,
    height: c,
    patternUnits: "userSpaceOnUse",
    pathD: mapInfiniteGridPatternPath(c),
    stroke: MAP_INFINITE_GRID_STROKE,
    strokeWidth: 0.5,
  };
}

/** CSS/SVG fill url() for the shared pattern id. */
export function mapInfiniteGridPatternFill(
  patternId: string = MAP_INFINITE_GRID_PATTERN_ID,
): string {
  const id = (patternId || MAP_INFINITE_GRID_PATTERN_ID).replace(/[^a-zA-Z0-9_-]/g, "");
  return `url(#${id || MAP_INFINITE_GRID_PATTERN_ID})`;
}
