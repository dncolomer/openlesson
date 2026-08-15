/**
 * Occupied-tile badge visibility for workspace block maps vs ILE chapter maps.
 * Chapter tiles keep only DAG-lock chrome; workspace keeps the full suite.
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

export function resolveMapOccupiedTileBadges(input: {
  surface?: MapTileBadgeSurface | string | null;
  hasDagLock?: boolean;
  isStart?: boolean;
  hasPractice?: boolean;
  hasLocalContext?: boolean;
  hasEffects?: boolean;
  generatorBusy?: boolean;
}): MapOccupiedTileBadges {
  const surface = input.surface === "chapter" ? "chapter" : "block";
  if (surface === "chapter") {
    return {
      ...CHAPTER_BADGES,
      showLock: Boolean(input.hasDagLock),
    };
  }
  return {
    showLock: Boolean(input.hasDagLock),
    showStarter: Boolean(input.isStart),
    showPractice: Boolean(input.hasPractice),
    showLocalContext: Boolean(input.hasLocalContext),
    showEffects: Boolean(input.hasEffects),
    showGeneratorBusy: Boolean(input.generatorBusy),
  };
}
