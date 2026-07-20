import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SalesSlide, SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import { buildPrivacyDataSlides } from "@/lib/sales/privacy-data-slide";

/** Centered section divider (title layout). */
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
    image: opts?.image,
    imageAlt: opts?.imageAlt,
    backgroundImage: opts?.backgroundImage ?? PITCH_ASSETS.aesthetics.title,
  };
}

/**
 * Platform pitch = section title before each block, founder first.
 * Sections: Founder · What is Uncertain Systems? · How we test it · Productized · Data posture · Our products
 */
const PLATFORM_FOUNDER: SalesSlide[] = [
  sectionTitle("Founder", {
    backgroundImage: PITCH_ASSETS.aesthetics.founder,
  }),
  ...buildFounderSlides("platform"),
];

const PLATFORM_THESIS: SalesSlide[] = [
  sectionTitle("What is Uncertain Systems?", {
    image: PITCH_ASSETS.logo,
    imageAlt: "Uncertain Systems logo",
    backgroundImage: PITCH_ASSETS.aesthetics.title,
  }),
  {
    layout: "statement",
    kicker: "Our thesis",
    title: "Knowledge cannot be measured as a ratio of correct test answers.",
    subtitle:
      "We need a measurement system based on knowledge configuration space — not hand-crafted rubrics of “knows X.”",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    cards: [
      {
        label: "Configuration space",
        body: "Beyond the brain — tools, workplace, applied context.",
      },
      {
        label: "Proof of Work proxy",
        body: "Accredited expert work as the signal we can capture.",
      },
      {
        label: "Distance to “knowing X”",
        body: "Embeddings + labeled regions instead of pass-rates.",
      },
    ],
    bullets: [
      "“Knows X” is a function of inputs we cannot hand-craft — the degrees of freedom of cognition alone are intractable.",
      "We cannot fully model knowledge, but we can find solid proxies. Proof of Work from accredited experts is one.",
      "Expert PoW → high-dimensional embeddings → regions labeled “knows X.”",
      "Distance of new traces to those regions measures more than correctness: ways of thinking and tools used.",
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
    layout: "fullImage",
    title: "Embeddings · knowing-X regions",
    backgroundImage: PITCH_ASSETS.aesthetics.science,
    image: "/embeddings.png",
    imageAlt: "High-dimensional embeddings with labeled knowing-X regions",
    imageCaption: "Embeddings · knowing-X regions",
  },
];

const PLATFORM_METHOD: SalesSlide[] = [
  sectionTitle("How we test it", {
    backgroundImage: PITCH_ASSETS.aesthetics.products,
  }),
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
  sectionTitle("Productized", {
    backgroundImage: PITCH_ASSETS.aesthetics.verticals,
  }),
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
  sectionTitle("Data posture", {
    backgroundImage: PITCH_ASSETS.aesthetics.products,
  }),
  ...buildPrivacyDataSlides(),
  sectionTitle("Our products", {
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
  }),
  {
    layout: "statement",
    kicker: "Our products",
    title: "Three products. One measurement stack.",
    subtitle: "Each surface captures proof under the same knowledge configuration model.",
    backgroundImage: PITCH_ASSETS.aesthetics.useCase,
    cards: [
      {
        label: "PoW API",
        body: "Dynamic SaaS onboarding — score the first real workflow after signup; open only the failed skill blocks.",
      },
      {
        label: "TAP",
        body: "TAP-cha — a short Think Aloud that proves a live human is behind the keyboard under probe.",
      },
      {
        label: "ILE",
        body: "Onboarding repair loops — when PoW flags a gap, coached practice on that block until the marker moves.",
      },
    ],
  },
];

export const PLATFORM_PITCH_DECK: SolutionSlideDeck = {
  vertical: "pitch",
  label: "Platform Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.science,
  slides: [...PLATFORM_FOUNDER, ...PLATFORM_THESIS, ...PLATFORM_METHOD, ...PLATFORM_CLOSE],
};
