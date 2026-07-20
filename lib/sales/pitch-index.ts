import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PLATFORM_PITCH_DECK } from "@/lib/sales/platform-pitch-deck";
import { VERIFICATION_PITCH_DECK } from "@/lib/sales/verification-pitch-deck";
import { OPTIMIZATION_PITCH_DECK } from "@/lib/sales/optimization-pitch-deck";
import { AUGMENTATION_PITCH_DECK } from "@/lib/sales/augmentation-pitch-deck";

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

/** Canonical list of pitch routes linked from /sales */
export const PITCH_INDEX: PitchIndexEntry[] = [
  {
    path: "/pitch",
    title: "Platform Pitch",
    description:
      "Product thesis and method: proximity over quiz scores, Think Aloud Protocol, Proof of Work stash/submit, and use cases across PoW · TAP · ILE — with founder story mid-deck.",
    vertical: "platform",
    deck: PLATFORM_PITCH_DECK,
  },
  {
    path: "/pitch-verification",
    title: "Verification Pitch",
    description:
      "Deep dive on learning verification: hiring, TAP-cha, deploy gates, certification, and human + agent skill validation.",
    vertical: "verification",
    comingSoon: true,
    deck: VERIFICATION_PITCH_DECK,
  },
  {
    path: "/pitch-optimization",
    title: "Optimization Pitch",
    description:
      "Deep dive on learning optimization: adoption, coaching, score movement, dynamic onboarding, and ALE skill loops.",
    vertical: "optimization",
    comingSoon: true,
    deck: OPTIMIZATION_PITCH_DECK,
  },
  {
    path: "/pitch-augmentation",
    title: "Augmentation Pitch",
    description:
      "Deep dive on learning augmentation: onboarding depth, course platforms, certification prep probes, and quiz replacement.",
    vertical: "augmentation",
    comingSoon: true,
    deck: AUGMENTATION_PITCH_DECK,
  },
];

export const PITCH_PATHS = PITCH_INDEX.map((entry) => entry.path);

/** Paths that currently open a live deck (not coming soon). */
export const LIVE_PITCH_PATHS = PITCH_INDEX.filter((e) => !e.comingSoon).map((e) => e.path);
