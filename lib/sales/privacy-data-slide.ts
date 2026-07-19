import type { SalesSlide } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";

/**
 * Shared enterprise data posture slide for every pitch deck.
 * PoW API + learning model work on anonymized / redacted proof of work so
 * customers do not need to leak proprietary secrets into our stack.
 */
export function buildPrivacyDataSlide(): SalesSlide {
  return {
    layout: "statement",
    kicker: "Data posture",
    title: "Anonymized proof of work. No need to leak enterprise secrets.",
    subtitle:
      "The Proof-of-Work API and learning world model are built to score skill from evidence you control. Send anonymized, redacted, or synthetic traces. Keep proprietary source, customer PII, and confidential IP inside your boundary.",
    backgroundImage: PITCH_ASSETS.aesthetics.products,
    ...labeledHighlights([
      [
        "Privacy-first PoW",
        "Score skill from anonymized, redacted, or synthetic proof of work rather than a dump of your enterprise corpus.",
      ],
      [
        "Keep secrets local",
        "Proprietary source, customer PII, and confidential IP stay inside your boundary; marker scores travel without the raw secrets.",
      ],
    ]),
    bullets: [
      "Pipe tool traces, transcripts, and artifacts with PII stripped or tokenized before they leave your environment",
      "Learning model and marker scores run on skill-relevant structure rather than your full enterprise corpus",
      "Hosted TAP and ILE sessions can be scoped to non-sensitive scenarios; PoW API integrates where data never leaves your VPC",
      "Auditable gap reports without shipping customer secrets, source code, or internal docs you cannot share",
      "Same verification, optimization, and augmentation loop with privacy-preserving design",
    ],
  };
}
