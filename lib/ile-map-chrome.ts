/**
 * ILE map-first overlay chrome tokens. Minimap stays at right-2 top-2.
 */
import { MINIMAP_FRAME_HEIGHT } from "@/lib/map-minimap-frame";

/** top-2 (8px) + minimap height + 8px gap — leftover for overlays that still sit under the minimap. */
export const ILE_HELIOS_WIDGET_TOP_PX = 8 + MINIMAP_FRAME_HEIGHT + 8;

/** Clearance above the full-width voice bar (tools widget + work dock). */
export const ILE_MAP_VOICE_BAR_CLEARANCE_CLASS = "bottom-24";

/**
 * Shared left-column map widget box (chapter, global resources, future overlays).
 * Sits on the map only: same gutter below the PoW bar as above the transcription bar.
 * Width matches Global resources: 720px capped so 28rem stays for right-side chrome.
 */
export const ILE_MAP_WIDGET_TOP_CLASS = "top-14";
export const ILE_MAP_WIDGET_BOTTOM_CLASS = ILE_MAP_VOICE_BAR_CLEARANCE_CLASS;
export const ILE_MAP_WIDGET_WIDTH_CLASS = "w-[min(720px,calc(100%-28rem))]";
export const ILE_MAP_WIDGET_FRAME_CLASS = [
  "absolute left-2",
  ILE_MAP_WIDGET_TOP_CLASS,
  ILE_MAP_WIDGET_BOTTOM_CLASS,
  "flex min-h-0",
  ILE_MAP_WIDGET_WIDTH_CLASS,
  "flex-col",
].join(" ");

export const ILE_HELIOS_WIDGET_WIDTH_PX = 720;

/** Inner fill for a map widget body. */
export const ILE_CHAPTER_DOCK_PANEL_HEIGHT_CLASS = "min-h-0 flex-1";

/** @deprecated Use ILE_MAP_WIDGET_BOTTOM_CLASS. */
export const ILE_CHAPTER_DOCK_CLEARANCE_CLASS = ILE_MAP_WIDGET_BOTTOM_CLASS;
/** @deprecated Use ILE_MAP_WIDGET_TOP_CLASS. */
export const ILE_CHAPTER_PANEL_TOP_CLASS = ILE_MAP_WIDGET_TOP_CLASS;
/** @deprecated Use ILE_MAP_WIDGET_WIDTH_CLASS. */
export const ILE_CHAPTER_WIDGET_WIDTH_CLASS = ILE_MAP_WIDGET_WIDTH_CLASS;

/** Session-level overlays on the left (Global resources, Review work). */
export const ILE_MAP_OVERLAY_TOOLS = ["plan-resources", "thought-history"] as const;

export type IleMapOverlayTool = (typeof ILE_MAP_OVERLAY_TOOLS)[number];

export function isIleMapOverlayTool(tool: string | null | undefined): boolean {
  if (!tool) return false;
  return (ILE_MAP_OVERLAY_TOOLS as readonly string[]).includes(tool);
}

/** Tools that swap the chapter widget body instead of a separate overlay. */
export const ILE_CHAPTER_WIDGET_TOOLS = [
  "canvas",
  "notebook",
  "grokipedia",
  "dantes",
] as const;

export type IleChapterWidgetTool = (typeof ILE_CHAPTER_WIDGET_TOOLS)[number];

export function isIleChapterWidgetTool(tool: string | null | undefined): boolean {
  if (!tool) return false;
  return (ILE_CHAPTER_WIDGET_TOOLS as readonly string[]).includes(tool);
}

/** Help / Data / Logs open as a centered session modal. */
export const ILE_SESSION_MODAL_TOOLS = ["help", "data-input", "logs"] as const;

export type IleSessionModalTool = (typeof ILE_SESSION_MODAL_TOOLS)[number];

export function isIleSessionModalTool(tool: string | null | undefined): boolean {
  if (!tool) return false;
  return (ILE_SESSION_MODAL_TOOLS as readonly string[]).includes(tool);
}
