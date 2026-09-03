/**
 * @deprecated Import from `@/lib/initial-chapters` instead.
 * Re-exports kept so existing imports keep working during the rename.
 */
export {
  type InitialChaptersLevel,
  type InitialChaptersBand,
  type MapSizeLevel,
  type MapSizeStepBand,
  INITIAL_CHAPTERS_LEVELS,
  INITIAL_CHAPTERS_TECHNIQUE_IDS,
  INITIAL_CHAPTERS_CATALOG,
  INITIAL_CHAPTERS_BANDS,
  DEFAULT_INITIAL_CHAPTERS,
  MAP_SIZE_LEVELS,
  MAP_SIZE_STEP_BANDS,
  DEFAULT_MAP_SIZE,
  isInitialChaptersLevel,
  parseInitialChaptersLevel,
  resolveInitialChaptersFromBody,
  getInitialChaptersBand,
  formatInitialChaptersForPrompt,
  SPATIAL_MAP_LAYOUT_RULES,
  isMapSizeLevel,
  parseMapSizeLevel,
  getMapSizeStepBand,
  formatMapSizeForPrompt,
} from "@/lib/initial-chapters";
