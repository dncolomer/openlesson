/**
 * Dual membership color coding for Global Map of Knowledge (2D + 3D only).
 * Inside ≈ cyan/blue family; near ≈ orange/amber family.
 * Intentionally scoped to Global dual-orbit surfaces — not product-wide chrome.
 */

export const GLOBAL_MAP_INSIDE_COLOR = {
  /** Primary cyan (core, orbit base, Three.js) */
  hex: "#22d3ee",
  /** Lighter cyan when selected */
  hexSelected: "#67e8f9",
  /** Deep cyan for bubble fill / emissive */
  hexDeep: "#0e7490",
  /** Three.js integer equivalents */
  three: 0x22d3ee,
  threeSelected: 0x67e8f9,
  threeEmissive: 0x0e7490,
  /** 2D orbit stroke */
  orbitStroke: "rgba(34,211,238,0.45)",
  orbitStrokeSelected: "rgba(34,211,238,0.85)",
  /** Count bubble / sprite accents */
  bubbleFill: "#0e7490",
  bubbleStroke: "#67e8f9",
  sprite: "#67e8f9",
  /** Legend + summary Tailwind (Global maps only) */
  legendTextClass: "text-cyan-300",
  summaryCardClass: "border border-cyan-500/25 bg-cyan-950/20 px-2 py-1.5",
  summaryDtClass: "font-mono text-[9px] uppercase tracking-wide text-cyan-500/90",
  summaryDdClass: "mt-0.5 font-mono text-base text-cyan-100",
} as const;

export const GLOBAL_MAP_NEAR_COLOR = {
  hex: "#fbbf24",
  hexSelected: "#fbbf24",
  hexDeep: "#78350f",
  three: 0xfbbf24,
  threeSelected: 0xfbbf24,
  orbitStroke: "rgba(251,191,36,0.35)",
  orbitStrokeSelected: "rgba(251,191,36,0.7)",
  bubbleFill: "#78350f",
  bubbleStroke: "#fbbf24",
  sprite: "#fbbf24",
  legendTextClass: "text-amber-300",
  summaryCardClass: "border border-amber-500/25 bg-amber-950/20 px-2 py-1.5",
  summaryDtClass: "font-mono text-[9px] uppercase tracking-wide text-amber-500/90",
  summaryDdClass: "mt-0.5 font-mono text-base text-amber-100",
  bubbleTextClass: "fill-amber-50",
} as const;

/** Shared dual coding used by Global Map 2D and 3D. */
export const GLOBAL_MAP_MEMBERSHIP_COLORS = {
  inside: GLOBAL_MAP_INSIDE_COLOR,
  near: GLOBAL_MAP_NEAR_COLOR,
} as const;
