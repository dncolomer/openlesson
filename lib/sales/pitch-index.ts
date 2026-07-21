import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";

export type PitchIndexEntry = {
  path: string;
  title: string;
  description: string;
  vertical: string;
  /** When true, listed but not openable (greyed out). */
  comingSoon?: boolean;
  /** Present for live decks; omitted or unused when comingSoon. */
  deck?: SolutionSlideDeck;
};

/** Canonical list of pitch routes — platform only for now. */
export const PITCH_INDEX: PitchIndexEntry[] = [
  {
    path: "/pitch",
    title: "Platform Pitch",
    description:
      "Founder story first, then product thesis and method: proximity over quiz scores, Think Aloud Protocol, and use cases across PoW · TAP · ILE · Stash API (alaTAP).",
    vertical: "platform",
    deck: PLATFORM_PITCH_DECK,
  },
];

export const PITCH_PATHS = PITCH_INDEX.map((entry) => entry.path);

/** Paths that currently open a live deck (not coming soon). */
export const LIVE_PITCH_PATHS = PITCH_INDEX.filter((e) => !e.comingSoon).map((e) => e.path);
