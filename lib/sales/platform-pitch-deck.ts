import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import { buildPrivacyDataSlides } from "@/lib/sales/privacy-data-slide";

/**
 * Platform pitch = product narrative with founder block mid-deck.
 * Open: thesis → config space → TAP method ×2
 * Mid: founder slides
 * Close: productized PoW → data posture ×2 → use cases (PoW / TAP / ILE)
 */
const PLATFORM_OPEN: SalesSlide[] = [
  {
    layout: "statement",
    kicker: "Our thesis",
    title: "Hard skills cannot be measured as a ratio of correct answers.",
    subtitle:
      "Quizzes sample thin outputs. Competence is proximity to a useful cognitive configuration — retrievable, applicable, and transformable under real work.",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    ...labeledHighlights([
      [
        "Knowledge configuration model",
        "Holistic representation of knowledge that extends beyond one's brain to the tools we rely on as well — not a scoreboard of right/wrong items.",
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
    layout: "fullImage",
    title: "Knowledge config · proximity model",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    image: "/config space.png",
    imageAlt: "Configuration space — proximity to a cognitive target",
    imageCaption: "Knowledge config · proximity model",
  },
  {
    layout: "media",
    kicker: "How we test it",
    title: "The Think Aloud Protocol.",
    subtitle:
      "A structured protocol to externalize and capture genuine thinking while staying practical with today's AI and LLMs. Example: “Does Person X know Algebra?”",
    backgroundImage: PITCH_ASSETS.aesthetics.products,
    video: "/animations/selective_interface.mp4",
    imageAlt: "Selective interface — submit and stash thought traces",
    imageCaption: "Submit–Stash · thought traces",
    ...labeledHighlights([
      [
        "Submit / Stash rule",
        "Think out loud naturally — but consciously submit (share) or stash (keep private) each thought. That deliberate choice is the key signal.",
      ],
      [
        "Embedding space",
        "Traces project into an embedding space where correctness is an explicit dimension — raw thought streams become rich, analyzable vectors.",
      ],
    ]),
    cards: [
      {
        label: "System 1",
        body: "Fast, intuitive thinking externalized as it fires.",
      },
      {
        label: "System 2",
        body: "Slow, deliberate reasoning made inspectable.",
      },
    ],
  },
  {
    layout: "media",
    kicker: "How we test it",
    title: "Practical with AI — and hard to game.",
    subtitle:
      "The protocol stays tool-agnostic and enforces purity so sessions remain verifiable even under real AI use.",
    backgroundImage: PITCH_ASSETS.aesthetics.products,
    video: "/animations/selective_interface.mp4",
    imageAlt: "Selective interface — tool-agnostic submit and stash",
    imageCaption: "Tool-agnostic · protocol purity",
    ...labeledHighlights([
      [
        "Tool agnostic",
        "Pen and paper, mental calc, or LLMs — value is the thinking you externalize, not the tool. Ends “you used AI so it doesn’t count.” Models still score reasoning quality and metacognitive depth in real time.",
      ],
      [
        "Protocol purity",
        "Submit–Stash keeps intent first-class: System 1 (stashed/unsent) and System 2 (submitted) both become proof of work. Scoring and GHC use that contrast—not polished finals alone—so over-filtering and non-cooperation show up in the evidence, not a vanity transcript.",
      ],
    ]),
  },
];

const PLATFORM_CLOSE: SalesSlide[] = [
  {
    layout: "statement",
    kicker: "Productized",
    title: "One interface: Proof of Work with stash / submit.",
    subtitle:
      "The PoW interface is the product surface. Work and thought stream continuously; each unit is either stashed (kept private / parked) or submitted (committed as evidence). Scoring attaches to that deliberate choice.",
    backgroundImage: PITCH_ASSETS.aesthetics.verticals,
    ...labeledHighlights([
      [
        "PoW interface",
        "Stash or submit every unit of work and thought. Intent is first-class evidence — the same contract for humans, agents, and tools.",
      ],
    ]),
    cards: [
      {
        label: "TAP implements it",
        body: "Think Aloud Protocol runs the stash / submit model on selective thought: spontaneous System 1 can be stashed; deliberate System 2 is submitted under probe.",
      },
      {
        label: "ILE implements it",
        body: "Integrated Learning Environment tools run the same model on practice work — notebook, canvas, and tool traces stash or submit as continuous proof of work.",
      },
    ],
    bullets: [
      "One contract: stream → stash or submit → score intent and evidence together",
      "TAP and ILE are not separate products — they are PoW surfaces that implement stash / submit",
    ],
  },
  ...buildPrivacyDataSlides(),
  {
    layout: "statement",
    kicker: "How they're used · PoW",
    title: "Proof of Work",
    subtitle:
      "Score real capability in the product surface — not tour completions or quiz pass rates.",
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
    cards: [
      {
        label: "PoW",
        ideas: [
          {
            title: "Dynamic SaaS onboarding",
            body: "After signup, score the first real workflow (import, configure, ship a unit of value). Severity-ranked gaps open only the failed skill blocks — power users skip the checklist entirely.",
          },
          {
            title: "Learning-to-conversion",
            body: "Tie proof of work to the aha path that predicts paid conversion. CS and product see who can run the product, not who finished a tour — trials convert on verified capability.",
          },
          {
            title: "Agent & CI deploy gates",
            body: "Pipe agent tool traces and PR artifacts into the same PoW model. Block merge or go-live until skill markers clear — humans and agents share one readiness bar.",
          },
        ],
      },
    ],
  },
  {
    layout: "statement",
    kicker: "How they're used · TAP",
    title: "Think Aloud Protocol",
    subtitle:
      "Externalize genuine thinking under probe — for humans you hire, interview, or need to verify live.",
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
    cards: [
      {
        label: "TAP",
        ideas: [
          {
            title: "TAP-cha",
            body: "A short Think Aloud Protocol that proves a live human is behind the keyboard — hesitations, self-corrections, and causal answers under probe that AI-fed polish cannot fake.",
          },
          {
            title: "Live skill interviews",
            body: "Replace polished take-homes with a timed think-aloud on the actual job task. Scores and gap reports land back in the ATS while the candidate still has context fresh.",
          },
          {
            title: "Expert capture",
            body: "Record how senior operators actually solve hard problems. Stash/submit traces become training gold and evaluation rubrics — not a polished slide deck of how work “should” go.",
          },
        ],
      },
    ],
  },
  {
    layout: "statement",
    kicker: "How they're used · ILE",
    title: "Integrated Learning Environment",
    subtitle:
      "Coached practice that closes the gaps verification found — in-product, on the job, under the same markers.",
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
    cards: [
      {
        label: "ILE",
        ideas: [
          {
            title: "Onboarding repair loops",
            body: "When PoW flags a failed onboarding skill, drop the user into a coached ILE scenario for that block only. Practice until the marker moves — then return them to product.",
          },
          {
            title: "Coached take-homes",
            body: "Senior and technical tracks get multi-step judgment in a workspace, not a weekend coding puzzle. Coach and score debugging, design tradeoffs, and tool use under realistic constraints.",
          },
          {
            title: "Role ramp scenarios",
            body: "New hires and internal mobility candidates run job-real scenarios instead of LMS module checklists. Gap reports route the next practice day — ramp becomes auditable skill movement.",
          },
        ],
      },
    ],
  },
];

export const PLATFORM_PITCH_DECK: SolutionSlideDeck = {
  vertical: "pitch",
  label: "Platform Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.science,
  slides: [...PLATFORM_OPEN, ...buildFounderSlides("platform"), ...PLATFORM_CLOSE],
};
