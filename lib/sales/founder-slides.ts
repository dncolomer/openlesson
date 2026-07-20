import type { SalesSlide } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";

export type FounderPitchFocus =
  | "platform"
  | "verification"
  | "optimization"
  | "augmentation";

function trajectoryTitle(focus: FounderPitchFocus = "platform"): string {
  if (focus === "platform") {
    return "From modeling goals using i* to building learning verification, optimization, and augmentation tech";
  }
  return `From modeling goals using i* to building learning ${focus} tech`;
}

/**
 * Shared founder slide set for pitch decks.
 * Platform deck places this block first (before thesis).
 * Facts are intentional and should stay consistent if vertical decks return.
 */
export function buildFounderSlides(focus: FounderPitchFocus = "platform"): SalesSlide[] {
  return [
    {
      layout: "founder",
      kicker: "Founder",
      title: "Daniel Colomer",
      subtitle:
        "Building Uncertain Systems from Germany. Software engineer from Barcelona, Online Educator.",
      image: PITCH_ASSETS.founder,
      imageAlt: "Daniel Colomer, founder of Uncertain Systems",
      backgroundImage: PITCH_ASSETS.aesthetics.founder,
      bullets: [
        "Software engineer (UPC) with published research in goal-oriented modeling alongside Xavier Franch",
        "Quantum computing educator with hundreds of tutorial videos reaching builders worldwide",
        "Runs All-You-Can-Learn Hackathons at the frontier of knowledge, including ETH Zürich × Extropic on probabilistic computing",
        "Collaborated with Strangeworks and TheWiser.org on quantum computing educational material",
      ],
    },
    {
      layout: "statement",
      kicker: "Trajectory",
      title: trajectoryTitle(focus),
      subtitle:
        "Daniel's work sits at the intersection of how systems are specified, how machines reason under uncertainty, and how humans prove they can think.",
      backgroundImage: PITCH_ASSETS.aesthetics.founder,
      bullets: [
        "At UPC, research with Xavier Franch grounded goal-oriented modeling with i*, turning intent into structured, testable requirements.",
        "As a quantum educator, he made frontier computing legible at scale: hundreds of tutorials that teach builders to reason about hardware they cannot treat as classical black boxes.",
        "With Strangeworks and TheWiser.org, that pedagogy became production educational material for quantum programs, not demos alone.",
      ],
    },
    {
      layout: "statement",
      kicker: "All-You-Can-Learn Hackathons",
      title: "All-You-Can-Learn Hackathons",
      subtitle:
        "All-You-Can-Learn Hackathons sit at the frontier of knowledge: contestants do not only ship demos. They stress-test what they understand under time, peers, and real tooling. The aim is proof of learning as much as proof of build.",
      backgroundImage: PITCH_ASSETS.aesthetics.science,
      bullets: [
        "Format: frontier domains, live practice, and visible reasoning rather than leaderboard scores or overnight CRUD clones alone.",
        "ETH Zürich × Extropic (probabilistic computing): a flagship example with Guillaume Verdon (TensorFlow Quantum founder, ex-Google Moonshots). Builders worked the next compute stack while proving how fast they could learn it.",
        "Coming next: a Quantum Computing Hackathon in Barcelona, and another hackathon in the UK. Same philosophy, new frontiers.",
        "Why it matters for Uncertain Systems: these events are the living lab for verification and augmentation. Contestants hack products and their own knowledge at once.",
      ],
    },
    {
      layout: "media",
      kicker: "Recognition · August 2024",
      title: "Awarded by Andrej Karpathy as Omega Quest",
      subtitle:
        "Uncertain Systems was recognized and awarded a prize by Andrej Karpathy when presented as Omega Quest. External validation that verifying real cognition is the right problem to solve.",
      image: PITCH_ASSETS.andrej,
      imageAlt: "Screenshot of Andrej Karpathy awarding Omega Quest / Uncertain Systems, August 2024",
      imageCaption: "Andrej Karpathy · Omega Quest · August 2024",
      backgroundImage: PITCH_ASSETS.aesthetics.recognition,
      bullets: [
        "Public recognition from one of the most influential voices in modern AI research and education",
        "Omega Quest framed the bet early: measure learning through proof of work, not vanity metrics",
        "That award still anchors the company story: build systems that make uncertain minds and agents demonstrably capable",
      ],
    },
  ];
}
