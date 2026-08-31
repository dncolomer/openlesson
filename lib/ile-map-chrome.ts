/**
 * ILE map-first overlay chrome tokens. Minimap stays at right-2 top-2.
 */
import { MINIMAP_FRAME_HEIGHT } from "@/lib/map-minimap-frame";

/** top-2 (8px) + minimap height + 8px gap — Helios widget sits under the minimap. */
export const ILE_HELIOS_WIDGET_TOP_PX = 8 + MINIMAP_FRAME_HEIGHT + 8;

/** Clearance above the full-width voice bar (tools widget + chapter inspector). */
export const ILE_MAP_VOICE_BAR_CLEARANCE_CLASS = "bottom-24";

export const ILE_HELIOS_WIDGET_WIDTH_PX = 440;

export const ILE_MAP_OVERLAY_TOOLS = [
  "canvas",
  "notebook",
  "thought-history",
  "grokipedia",
  "dantes",
  "data-input",
  "logs",
  "plan-resources",
] as const;

export type IleMapOverlayTool = (typeof ILE_MAP_OVERLAY_TOOLS)[number];

export function isIleMapOverlayTool(tool: string | null | undefined): boolean {
  if (!tool) return false;
  return (ILE_MAP_OVERLAY_TOOLS as readonly string[]).includes(tool);
}
