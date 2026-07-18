import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";

/**
 * Crisp product pitch: thesis → method → productization → integrations.
 * Four media slides; each reserves a right-side image placeholder for art later.
 */
export const PRODUCT_PITCH_DECK: SolutionSlideDeck = {
  vertical: "product",
  label: "Product Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.science,
  slides: [
    {
      layout: "media",
      kicker: "Our thesis",
      title: "Hard skills cannot be measured as a ratio of correct answers.",
      subtitle:
        "Quizzes sample thin outputs. Competence is proximity to a useful cognitive configuration — retrievable, applicable, and transformable under real work.",
      backgroundImage: PITCH_ASSETS.aesthetics.science,
      imagePlaceholder: true,
      imageCaption: "Brain config · proximity model",
      ...labeledHighlights([
        [
          "Brain configuration model",
          "Holistic state of mind — not a scoreboard of right/wrong items.",
        ],
        [
          "Proximity, not pass-rate",
          "We built a model that measures distance to a learning model — a cognitive target — instead of percent correct.",
        ],
      ]),
      bullets: [
        "Correct-answer ratios collapse under AI assist and polished delivery",
        "Useful knowledge is closeness to a configuration you can retrieve, apply, and transform",
        "The product scores that proximity continuously from proof of work and thought under probe",
      ],
    },
    {
      layout: "media",
      kicker: "How we test it",
      title: "Three layers that make proximity measurable.",
      subtitle:
        "We implement the thesis as a stack: evidence basis, genuine cognition analysis, then a learning model that interrupts traces world-model style.",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      imagePlaceholder: true,
      imageCaption: "PoW · cognition · interruptions",
      cards: [
        {
          label: "01 · Proof of Work",
          body: "Basis layer. Artifacts, tool traces, and think-aloud — evidence of real work, not a multiple-choice snapshot.",
        },
        {
          label: "02 · Genuine human cognition analysis",
          body: "Chain-of-thought linearity analysis. Capture method is decisive — Selective Thought Interface, not free-form dump.",
        },
        {
          label: "03 · Learning model · trace interruptions",
          body: "World-model style. Trace interruptions probe gaps mid-reasoning and measure how interruption changes learning effectiveness.",
        },
      ],
    },
    {
      layout: "media",
      kicker: "Productized",
      title: "Model surfaces as two product primitives.",
      subtitle:
        "Proof of Work and selective thought capture are not research demos — they ship as interaction models inside the product suite.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      imagePlaceholder: true,
      imageCaption: "Submit–Stash · thought UI",
      cards: [
        {
          label: "PoW · Submit–Stash",
          body: "Stream answers continuously. Learner or agent signals submit or stash — scoring attaches to intent, not only the final paste.",
        },
        {
          label: "Selective Thought Interface",
          body: "UI lives inside TAP and ILE tool surfaces. How thought is captured is the product — not a bolt-on form after the fact.",
        },
      ],
      bullets: [
        "Submit–Stash pairs streamed proof of work with an explicit commit/park signal",
        "Selective Thought Interface sits inside Think Aloud Protocol and Integrated Learning Environment tools",
      ],
    },
    {
      layout: "media",
      kicker: "How they're used",
      title: "Integration surfaces.",
      subtitle:
        "Same proximity stack embeds where decisions already happen — hiring, learning paths, enablement, and agent pipelines.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      imagePlaceholder: true,
      imageCaption: "Integration map",
      cards: [
        {
          label: "PoW API gates",
          body: "Embed score + submit/stash into hiring, cert, compliance, or CI pipelines you already own.",
        },
        {
          label: "TAP sessions",
          body: "Shareable think-aloud links for live human verification under probe.",
        },
        {
          label: "ILE practice",
          body: "Coached scenarios as take-home and quiz replacements with continuous proof of work.",
        },
        {
          label: "LMS · courses · enablement",
          body: "Interruption + proximity scoring inside existing learning paths, onboarding, and sales/tech readiness.",
        },
        {
          label: "Agent eval",
          body: "Same PoW + trace interruption loop for tool-use traces and skill.md iteration until deploy readiness.",
        },
        {
          label: "ATS · HRIS · product UX",
          body: "Native hooks when you own the surface; hosted TAP/ILE when you need speed without building UX.",
        },
      ],
    },
  ],
};
