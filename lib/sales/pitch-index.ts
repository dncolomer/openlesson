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
  deck: SolutionSlideDeck;
};

/** Canonical list of all pitch routes linked from /sales */
export const PITCH_INDEX: PitchIndexEntry[] = [
  {
    path: "/pitch",
    title: "Platform Pitch",
    description:
      "Full Uncertain Systems narrative: three verticals, learning world model, Trace Interruption Model, Workspace foundation, and the product suite.",
    vertical: "platform",
    deck: PLATFORM_PITCH_DECK,
  },
  {
    path: "/pitch-verification",
    title: "Verification Pitch",
    description:
      "Deep dive on learning verification: hiring, TAP-cha, deploy gates, certification, and human + agent skill validation.",
    vertical: "verification",
    deck: VERIFICATION_PITCH_DECK,
  },
  {
    path: "/pitch-optimization",
    title: "Optimization Pitch",
    description:
      "Deep dive on learning optimization: adoption, coaching, score movement, dynamic onboarding, and ALE skill loops.",
    vertical: "optimization",
    deck: OPTIMIZATION_PITCH_DECK,
  },
  {
    path: "/pitch-augmentation",
    title: "Augmentation Pitch",
    description:
      "Deep dive on learning augmentation: onboarding depth, course platforms, certification prep probes, and quiz replacement.",
    vertical: "augmentation",
    deck: AUGMENTATION_PITCH_DECK,
  },
];

export const PITCH_PATHS = PITCH_INDEX.map((entry) => entry.path);
