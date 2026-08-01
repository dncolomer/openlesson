/**
 * Shared map cell chrome for workspace block maps and ILE chapter maps.
 * Neutral palette always; selection = white highlight; status = gear/tick icons only.
 */

export type MapCellStatusIcon = "gear" | "tick" | null;

/** White selection ring/border tokens (never cyan/blue neon). */
export const MAP_CELL_SELECTED_CLASS =
  "ring-2 ring-white/55 ring-offset-2 ring-offset-[#0b0b0b] border-white/45 bg-neutral-900/90 text-neutral-50";

/** Multi-select / empty-cell selection (same white language as single select). */
export const MAP_CELL_MULTI_SELECTED_CLASS =
  "border-white/50 bg-white/10 text-neutral-50 ring-2 ring-white/50 shadow-[0_0_14px_rgba(255,255,255,0.12)]";

export const MAP_CELL_EMPTY_SELECTED_CLASS =
  "border-white/45 bg-white/10 text-neutral-100 ring-2 ring-white/40";

/**
 * Milder white highlight for prerequisite blocks of the focused/edited target.
 * Dashed outline (not solid multi-select ring) so deps read as related, not selected.
 */
export const MAP_CELL_PREREQ_CLASS =
  "border-2 border-dashed border-white/45 bg-white/[0.05] text-neutral-100 shadow-[0_0_8px_rgba(255,255,255,0.06)]";

/** Target block under prereq-edit (full select language). */
export const MAP_CELL_TARGET_CLASS = MAP_CELL_SELECTED_CLASS;

/** Neutral unselected occupied tile. */
export const MAP_CELL_NEUTRAL_CLASS =
  "border-neutral-700/80 bg-neutral-950/75 text-neutral-100";

/** Locked tiles stay neutral but slightly dimmed — still fully clickable/selectable. */
export const MAP_CELL_LOCKED_CLASS =
  "border-neutral-800 bg-neutral-950/50 text-neutral-500 opacity-80 pointer-events-auto";

/** Unusable ground — shapes paths; not placeable open ground. */
export const MAP_CELL_UNUSABLE_CLASS =
  "border-neutral-900 bg-[repeating-linear-gradient(135deg,rgba(30,30,30,0.9)_0_4px,rgba(12,12,12,0.95)_4px_8px)] text-neutral-600 opacity-80";

/**
 * Status → icon for occupied map tiles.
 * Map tiles are title-only: never gear/tick — status is not reflected on cells.
 * (showProgress / status retained for API compatibility.)
 */
export function resolveMapCellStatusIcon(
  _status: string,
  _showProgress: boolean,
): MapCellStatusIcon {
  return null;
}

/**
 * Pure class mapper for occupied skill-grid tiles.
 * No emerald/amber/cyan status fills — selection/focus use white highlight only.
 */
export function mapCellChromeClasses(input: {
  status: string;
  selected: boolean;
  /** Active/loaded chapter or focused tile — same white language as selected. */
  focused?: boolean;
  showProgress?: boolean;
  /** Unusable ground cell (path-shaping). */
  unusable?: boolean;
  /**
   * Prereq-edit / preview role. When set, overrides selected/locked for target/prereq.
   * "prereq" → mild white; "target" → full select chrome.
   */
  highlightRole?: "target" | "prereq" | "selected" | "locked" | "neutral" | null;
}): string {
  const selected = Boolean(input.selected || input.focused);
  const status = String(input.status || "").toLowerCase();
  const role = input.highlightRole ?? null;

  if (input.unusable) {
    return selected
      ? `${MAP_CELL_UNUSABLE_CLASS} ring-1 ring-white/30`
      : MAP_CELL_UNUSABLE_CLASS;
  }

  if (role === "target") return MAP_CELL_TARGET_CLASS;
  if (role === "prereq") return MAP_CELL_PREREQ_CLASS;
  if (role === "selected") return MAP_CELL_MULTI_SELECTED_CLASS;

  if (status === "locked" || status === "skipped" || role === "locked") {
    return selected
      ? `${MAP_CELL_SELECTED_CLASS} opacity-80`
      : MAP_CELL_LOCKED_CLASS;
  }

  if (selected) {
    return MAP_CELL_SELECTED_CLASS;
  }

  return MAP_CELL_NEUTRAL_CLASS;
}

/** Freeform fill/border for mild prereq highlight (pair with dashed borderStyle). */
export function mapCellFreeformPrereqColors(): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
  borderStyle: "dashed";
} {
  return {
    fill: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.45)",
    text: "rgb(245, 245, 245)",
    shadow: "0 0 8px rgba(255,255,255,0.06)",
    borderStyle: "dashed",
  };
}

/** True if class string is free of progress tints and cyan selection chrome. */
export function mapCellChromeIsNeutral(className: string): boolean {
  const s = className.toLowerCase();
  if (s.includes("emerald") || s.includes("amber") || s.includes("yellow") || s.includes("green-")) {
    return false;
  }
  if (s.includes("cyan") || s.includes("blue-") || s.includes("sky-")) {
    return false;
  }
  return true;
}

/** Freeform multi-select fill/border as CSS rgba (inline styles path). */
export function mapCellFreeformColors(selected: boolean): {
  fill: string;
  border: string;
  text: string;
  shadow?: string;
} {
  if (selected) {
    return {
      fill: "rgba(255, 255, 255, 0.12)",
      border: "rgba(255, 255, 255, 0.55)",
      text: "rgb(250, 250, 250)",
      shadow: "0 0 14px rgba(255,255,255,0.14)",
    };
  }
  return {
    fill: "rgba(10, 10, 12, 0.88)",
    border: "rgba(82, 82, 91, 0.9)",
    text: "rgb(229, 229, 229)",
  };
}
