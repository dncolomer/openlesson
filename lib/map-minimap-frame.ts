/**
 * Shared minimap frame size tokens.
 * Kept separate so cluster graph and camera projection do not import each other.
 */

/** Default minimap overlay frame (px). Wide enough for Build / Play / Explore. */
export const MINIMAP_FRAME_WIDTH = 212;
export const MINIMAP_FRAME_HEIGHT = 152;
/** Prior frame size — tests assert the new frame is strictly larger. */
export const MINIMAP_FRAME_WIDTH_LEGACY = 148;
export const MINIMAP_FRAME_HEIGHT_LEGACY = 108;
/** Prior large overlay (2026) — tests assert the current frame is smaller. */
export const MINIMAP_FRAME_WIDTH_PREV = 220;
export const MINIMAP_FRAME_HEIGHT_PREV = 168;
/** Default inset so dots stay inside the rounded frame. */
export const MINIMAP_FRAME_PADDING = 18;
