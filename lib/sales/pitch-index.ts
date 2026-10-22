import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";

export type PitchIndexEntry = {
  path: string;
  title: string;
  description: string;
  vertical: string;
  /** When true, listed on /sales but not openable (greyed out). */
  comingSoon?: boolean;
  /** Present for live decks; omitted or unused when comingSoon. */
  deck?: SolutionSlideDeck;
};

/** Canonical list of pitch routes linked from /sales. Live PDF is `/pitch`. */
export const PITCH_INDEX: PitchIndexEntry[] = [];

export const PITCH_PATHS = PITCH_INDEX.map((entry) => entry.path);

/** Paths that currently open a live deck (not coming soon). */
export const LIVE_PITCH_PATHS = PITCH_INDEX.filter((e) => !e.comingSoon).map((e) => e.path);
