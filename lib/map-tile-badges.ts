/**
 * Occupied-tile badge visibility for workspace block maps vs ILE chapter maps.
 * Workspace tiles show keyword + Lucide icon only (no occupancy modifiers).
 * Chapter tiles keep only DAG-lock chrome.
 */

export type MapTileBadgeSurface = "block" | "chapter";

export type MapOccupiedTileBadges = {
  showLock: boolean;
  showStarter: boolean;
  showPractice: boolean;
  showLocalContext: boolean;
  showEffects: boolean;
  showGeneratorBusy: boolean;
};

const CHAPTER_BADGES: MapOccupiedTileBadges = {
  showLock: false,
  showStarter: false,
  showPractice: false,
  showLocalContext: false,
  showEffects: false,
  showGeneratorBusy: false,
};

const HIDDEN_OCCUPIED_BADGES: MapOccupiedTileBadges = {
  showLock: false,
  showStarter: false,
  showPractice: false,
  showLocalContext: false,
  showEffects: false,
  showGeneratorBusy: false,
};

export function resolveMapOccupiedTileBadges(input: {
  surface?: MapTileBadgeSurface | string | null;
  hasDagLock?: boolean;
  isStart?: boolean;
  hasPractice?: boolean;
  hasLocalContext?: boolean;
  hasEffects?: boolean;
  generatorBusy?: boolean;
  /** Explore map: name-only occupied tiles (no occupancy icons). */
  exploreActive?: boolean;
}): MapOccupiedTileBadges {
  if (input.exploreActive) return { ...HIDDEN_OCCUPIED_BADGES };
  const surface = input.surface === "chapter" ? "chapter" : "block";
  if (surface === "chapter") {
    return {
      ...CHAPTER_BADGES,
      showLock: Boolean(input.hasDagLock),
    };
  }
  // Workspace occupied tiles: keyword + catalog icon only.
  return { ...HIDDEN_OCCUPIED_BADGES };
}

/** Empty-cell glyph: Build plus, Explore search, otherwise none. */
export type EmptyCellMarker = "plus" | "search" | "none";

export function resolveEmptyCellMarker(input: {
  exploreActive?: boolean;
  canEdit?: boolean;
  learnerMode?: boolean;
  isUnusable?: boolean;
  isGeneratorSpark?: boolean;
}): EmptyCellMarker {
  if (input.isUnusable || input.isGeneratorSpark) return "none";
  if (input.exploreActive) return "search";
  if (input.canEdit && !input.learnerMode) return "plus";
  return "none";
}
