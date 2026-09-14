/**
 * ILE map-first overlay chrome tokens. Minimap stays at right-2 top-2.
 */
import { MINIMAP_FRAME_HEIGHT } from "@/lib/map-minimap-frame";

/** top-2 (8px) + minimap height + 8px gap — leftover for overlays that still sit under the minimap. */
export const ILE_HELIOS_WIDGET_TOP_PX = 8 + MINIMAP_FRAME_HEIGHT + 8;

/** Voice bar inner height: action pad 7.25rem + py-2. */
export const ILE_VOICE_BAR_HEIGHT_CLASS = "h-[8.25rem]";

/** Bar height + 0.5rem gutter (same as left-2). Chapter widget, sensors, work dock. */
export const ILE_MAP_VOICE_BAR_CLEARANCE_CLASS = "bottom-[8.75rem]";

/**
 * Shared left-column map widget box (chapter, global resources, future overlays).
 * Sits on the map only: same gutter below the PoW bar as above the transcription bar.
 * Width matches Global resources: 720px capped so 28rem stays for right-side chrome.
 */
export const ILE_MAP_WIDGET_TOP_CLASS = "top-2";
/** Inner map/work region starts below the in-flow PoW bar. */
export const ILE_MAP_POW_BAR_CLEARANCE_CLASS = "top-0";
export const ILE_MAP_WIDGET_BOTTOM_CLASS = ILE_MAP_VOICE_BAR_CLEARANCE_CLASS;
export const ILE_MAP_WIDGET_WIDTH_CLASS = "w-[min(720px,calc(100%-28rem))]";
/** PoW resources / dock / voice stay above the Work canvas in full screen. */
export const ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS = "z-[55]";
/** Work canvas title bar (`IleChapterWidgetFrame` header). */
export const ILE_SESSION_TOP_BAR_PAD_CLASS = "px-2 py-1";
/** PoW strip: a step taller than the Work title bar. */
export const ILE_POW_RESOURCE_BAR_PAD_CLASS = "px-2 py-1.5";
/** Full-width strip at the top of the session stage. */
export const ILE_POW_RESOURCE_BAR_CLASS = [
  "pointer-events-auto relative shrink-0",
  ILE_SESSION_CHROME_ABOVE_WORK_Z_CLASS,
  "flex w-full items-center gap-2 border-b border-neutral-800 bg-neutral-950",
  ILE_POW_RESOURCE_BAR_PAD_CLASS,
].join(" ");
/**
 * Work widget: fill the inner map region (below the PoW bar).
 * Open = this full frame; closed = minimized to the dock.
 */
export const ILE_MAP_WIDGET_WIDE_FRAME_CLASS = [
  "absolute inset-0",
  "z-40",
  "flex min-h-0 flex-col",
].join(" ");
/** Full-stage overlay above PoW bar / dock / voice (z-[55]). */
export const ILE_MAP_INSIGHT_CRAFT_Z_CLASS = "z-[70]";
export const ILE_MAP_INSIGHT_CRAFT_FRAME_CLASS = [
  "absolute inset-0",
  ILE_MAP_INSIGHT_CRAFT_Z_CLASS,
  "flex min-h-0 flex-col",
].join(" ");
export const ILE_MAP_WIDGET_FRAME_CLASS = [
  "absolute left-2",
  ILE_MAP_WIDGET_TOP_CLASS,
  ILE_MAP_WIDGET_BOTTOM_CLASS,
  "flex min-h-0",
  ILE_MAP_WIDGET_WIDTH_CLASS,
  "flex-col",
].join(" ");

export function ileMapWorkFrameClass(_wide = true): string {
  return ILE_MAP_WIDGET_WIDE_FRAME_CLASS;
}

export function ileMapInsightCraftFrameClass(): string {
  return ILE_MAP_INSIGHT_CRAFT_FRAME_CLASS;
}

export function ileWorkCanvasCoversMap(input: {
  heliosOpen?: boolean;
  wide?: boolean;
  insightCraftOpen?: boolean;
}): boolean {
  return Boolean(input.heliosOpen || input.insightCraftOpen);
}

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

/**
 * Work is canvas-only: no chapter-tool tabs. Kept as an empty list so
 * isIleChapterWidgetTool stays false (overlays/modals are separate).
 */
export const ILE_CHAPTER_WIDGET_TOOLS = [] as const;

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
