import type { SalesSlide } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";

/**
 * Enterprise data posture slides for the **platform** pitch deck (2 slides).
 * Text-only statement layout (no image placeholders).
 */
export function buildPrivacyDataSlides(): SalesSlide[] {
  return [
    {
      layout: "statement",
      kicker: "Data posture · 1/2",
      title: "Proprietary “knowing X” cannot live on a public quiz.",
      subtitle:
        "In the enterprise, skill is entangled with confidential systems. Example: does this new SRE know how to manage our production system? That knowledge is not a shareable answer key.",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      ...labeledHighlights([
        [
          "Confidential by nature",
          "Production runbooks, topology, customer workflows, and internal tooling must stay inside your boundary.",
        ],
        [
          "Quizzes break the model",
          "Public or vendor-hosted quiz banks force you to externalize secrets you cannot expose to Uncertain Systems or the outside world.",
        ],
      ]),
      bullets: [
        "Enterprise “knowing X” is often proprietary by construction — not something you can redact into a multiple-choice form",
        "Hiring, ramp, and internal mobility still need a measurable signal of competence without leaking production detail",
      ],
    },
    {
      layout: "statement",
      kicker: "Data posture · 2/2",
      title: "Custom verification models in hashed knowledge config space.",
      subtitle:
        "Distill internal talent into a high-validation region, then evaluate candidates on that geometry — with hashed or redacted traces only.",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      ...labeledHighlights([
        [
          "Custom verification models",
          "Pick internal experts in a workspace, distill their knowledge config embeddings into a high-validation region, and score others against that model.",
        ],
        [
          "Hashed / anonymized knowledge config",
          "Send hashed or redacted traces. Geometry still works for internal scoring; secrets never leave your control.",
        ],
      ]),
      bullets: [
        "Create custom verification models from existing internal talent embeddings",
        "Evaluate internal candidates without shipping proprietary source, topology, or customer secrets",
        "Same verification loop — custom eval against your high-validation region, not only platform vertical scores",
      ],
    },
  ];
}

/** @deprecated Prefer buildPrivacyDataSlides() — kept for call sites that need the first privacy beat. */
export function buildPrivacyDataSlide(): SalesSlide {
  return buildPrivacyDataSlides()[0];
}
