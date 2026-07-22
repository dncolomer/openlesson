import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import { buildPrivacyDataSlides } from "@/lib/sales/privacy-data-slide";

/** Centered section divider (title layout) — always shows brand favicon. */
function sectionTitle(
  title: string,
  opts?: {
    backgroundImage?: string;
    image?: string;
    imageAlt?: string;
    kicker?: string;
    subtitle?: string;
  },
): SalesSlide {
  return {
    layout: "title",
    title,
    kicker: opts?.kicker,
    subtitle: opts?.subtitle,
    image: opts?.image ?? PITCH_ASSETS.logo,
    imageAlt: opts?.imageAlt ?? "Uncertain Systems logo",
    backgroundImage: opts?.backgroundImage ?? PITCH_ASSETS.aesthetics.title,
  };
}

/**
 * Platform pitch = cover + TOC, then section title before each block.
 * Sections: Founder · What is Uncertain Systems? · How do we ensure high quality data? · Data Privacy and Confidential Learning · Our products
 */
const PLATFORM_OPEN: SalesSlide[] = [
  sectionTitle("Uncertain Systems", {
    backgroundImage: PITCH_ASSETS.aesthetics.title,
  }),
  {
    layout: "bullets",
    kicker: "Agenda",
    title: "Table of contents",
    backgroundImage: PITCH_ASSETS.aesthetics.title,
    bullets: [
      "Founder",
      "What is Uncertain Systems?",
      "How do we ensure high quality data?",
      "Data Privacy and Confidential Learning",
      "Our products",
    ],
  },
];

const PLATFORM_FOUNDER: SalesSlide[] = [
  sectionTitle("Founder", {
    backgroundImage: PITCH_ASSETS.aesthetics.founder,
  }),
  ...buildFounderSlides("platform"),
];

const PLATFORM_THESIS: SalesSlide[] = [
  sectionTitle("What is Uncertain Systems?", {
    backgroundImage: PITCH_ASSETS.aesthetics.title,
  }),
  {
    layout: "statement",
    kicker: "Problem",
    title: "Knowledge cannot be measured as a ratio of correct test answers.",
    subtitle:
      "Traditional learning and skill validation has become impossible under AI.",
    bullets: [
      "Hiring is higher stakes than ever: leaner hybrid human and agent teams mean one bad hire compounds across agents, pipelines, and production. Resumes and multiple-choice screens no longer prove real skill when candidates can generate polished answers in seconds.",
      "Certification programs lose signal when exam banks and study packs are fully AI-solvable. A pass rate no longer means the holder can perform under real constraints.",
      "Complex physical and digital processes (ops, manufacturing, clinical, infra) need judgment under incomplete information. Quiz items cannot capture whether someone can actually run the system.",
      "Enterprise readiness of new hires is invisible until they are already on the job. Traditional onboarding quizzes miss whether someone can work with tools, agents, and teammates in context.",
      "Internal training (a new sales rep, a new SRE engineer) looks complete when modules are finished, but completion and quiz scores do not show whether behavior changed or whether the person can execute under load.",
    ],
    backgroundImage: PITCH_ASSETS.aesthetics.science,
  },
  {
    layout: "statement",
    kicker: "Our thesis",
    title:
      "We need a measurement system based on something abstracted away from pure result samples.",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    // Lead-in above the three concept boxes (rendered before CardGrid on statement layout).
    highlights: [
      "We cannot map a brain, biomarkers, or a fancy predictive model. Cognition is too complex to model that way. As a proxy, we watch how they solve problems, turn those signals into a mathematical space, and compare them to regions that correspond to the target knowledge we are validating.",
    ],
    highlightLabels: ["The Hypothesis"],
    highlightImages: ["/flywire.png"],
    highlightImageAlts: ["Flywire — problem-solving signals mapped into knowledge space"],
    highlightImageSources: ["Source: flywire.ai"],
    cards: [
      {
        label: "Proof of Work proxy",
        body: "Accredited expert work as the signal we can capture.",
        image: "/terrance.png",
        imageAlt: "Proof of Work — expert signal",
      },
      {
        label: "Configuration space",
        body: "Beyond the brain — tools, workplace, applied context.",
        image: "/mechaarm2.jpg",
        imageAlt: "Configuration space — proximity to a cognitive target",
      },
      {
        label: "Distance to “knowing X”",
        body: "Embeddings + labeled regions instead of pass-rates.",
        image: "/embeddings.png",
        imageAlt: "High-dimensional embeddings with labeled knowing-X regions",
      },
    ],
    // No supporting bullets — lead-in + three concept cards + fullImage slides that follow.
  },
  {
    layout: "fullImage",
    title: "Proof of Work · expert signal",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    image: "/terrance.png",
    imageAlt: "Proof of Work — expert signal",
    imageCaption: "Proof of Work · expert signal",
  },
  {
    layout: "fullImage",
    title: "Knowledge config · proximity model",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    image: "/mechaarm2.jpg",
    imageAlt: "Configuration space — proximity to a cognitive target",
    imageCaption: "Knowledge config · proximity model",
  },
  {
    layout: "fullImage",
    title: "Embeddings · knowing-X regions",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    image: "/embeddings.png",
    imageAlt: "High-dimensional embeddings with labeled knowing-X regions",
    imageCaption: "Embeddings · knowing-X regions",
  },
];

const PLATFORM_METHOD: SalesSlide[] = [
  sectionTitle("How do we ensure high quality data?", {
    backgroundImage: PITCH_ASSETS.aesthetics.products,
  }),
  {
    layout: "media",
    kicker: "How do we ensure high quality data?",
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
    kicker: "How do we ensure high quality data?",
    title: "Real World Grounded and extremely hard to game",
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
  sectionTitle("Data Privacy and Confidential Learning", {
    backgroundImage: PITCH_ASSETS.aesthetics.products,
  }),
  ...buildPrivacyDataSlides(),
  sectionTitle("Our products", {
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
  }),
  {
    layout: "statement",
    kicker: "Our products",
    title: "Four products. One measurement stack.",
    subtitle:
      "PoW API, Think Aloud Protocol, ILE, and Stash API are different surfaces for the same knowledge configuration model — measure proximity to “knowing X,” not quiz pass rates.",
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
    // Visual stack top→bottom: TAP|ILE shared layer → Stash → PoW foundation.
    cardLayout: "product-stack",
    cards: [
      {
        label: "TAP",
        body: "Think Aloud Protocol — live probes that externalize genuine human reasoning under pressure.",
      },
      {
        label: "ILE",
        body: "Integrated Learning Environment — coached practice that closes gaps verification found.",
      },
      {
        label: "Stash API",
        body: "Buffer agent proof of work, then Stash (System 1) or Submit (System 2) into PoW — Think Aloud for agents.",
      },
      {
        label: "PoW API",
        body: "Score real work and agent traces at the API layer — the measurement foundation every product shares.",
      },
    ],
  },
];

export const PLATFORM_PITCH_DECK: SolutionSlideDeck = {
  vertical: "pitch",
  label: "Verification Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.science,
  slides: [
    ...PLATFORM_OPEN,
    ...PLATFORM_FOUNDER,
    ...PLATFORM_THESIS,
    ...PLATFORM_METHOD,
    ...PLATFORM_CLOSE,
  ],
};
