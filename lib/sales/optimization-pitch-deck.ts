import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import {
  THESIS_HIGHLIGHT_LABELS,
  thesisScienceHighlights,
} from "@/lib/sales/thesis-science-snippet";

export const OPTIMIZATION_PITCH_DECK: SolutionSlideDeck = {
  vertical: "optimization",
  label: "Optimization Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.optimization,
  slides: [
    {
      layout: "title",
      kicker: "Learning Optimization · Uncertain Systems",
      title: "Make learning convert.",
      subtitle:
        "Turn verification findings into learning that shows up downstream: adoption, deployment, and real use. Example: a B2B SaaS product team wires gap scores into onboarding, success, and agent skill loops.",
      backgroundImage: PITCH_ASSETS.aesthetics.optimization,
      cards: [
        {
          label: "1 · Score post-signup work",
          body: "After trial activation, PoW API or short TAP sessions score whether users can run the core workflow. Severity-ranked gaps feed the CRM or customer-success queue, not a vanity completion dashboard.",
        },
        {
          label: "2 · Dynamic onboarding in product",
          body: "Only the failed skill blocks trigger ILE practice or in-app coaching. High scorers skip ahead. Learning-to-conversion replaces fixed module checklists for every cohort.",
        },
        {
          label: "3 · Agent skill loops (ALE)",
          body: "The same workspace scores agent tool traces in CI. ALE iterates skill.md until deploy readiness clears. Human onboarding and agent eval share one model.",
        },
      ],
    },
    ...buildFounderSlides("optimization"),
    {
      layout: "statement",
      kicker: "The problem",
      title: "Training finishes. Behavior does not change.",
      subtitle:
        "Static checklists and one-off courses ignore what verification already knows. Gaps stay open; activation stalls; agents ship without skill movement you can prove.",
      backgroundImage: PITCH_ASSETS.aesthetics.problem,
      ...labeledHighlights([
        [
          "The trap",
          "Training finishes. Behavior does not change.",
        ],
        [
          "What breaks",
          "Activation stalls, agents ship without proven skill movement, and ramp burns calendar without auditable scores.",
        ],
      ]),
      bullets: [
        "Onboarding is linear even when every user fails on different concepts",
        "Enablement teaches catalog content, not the blockers that stop conversion",
        "Agent evals show vanity benchmark deltas without deploy readiness",
        "Post-hire ramp burns calendar time without score movement you can audit",
      ],
    },
    {
      layout: "statement",
      kicker: "Our thesis",
      title: "Verification findings drive what gets practiced next.",
      subtitle:
        "Optimization is the second vertical: route humans into ILE practice and agents into ALE skill iteration until scores move and outcomes improve.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      highlights: thesisScienceHighlights("optimization"),
      highlightLabels: [...THESIS_HIGHLIGHT_LABELS],
      bullets: [
        "Dynamic onboarding flows triggered by proof-of-work severity",
        "Agentic skill optimization (ALE) until learning efficiency clears the deploy bar",
        "Same workspace context as verification",
        "Tie every intervention to adoption, deploy, and conversion metrics",
      ],
    },
    {
      layout: "split",
      kicker: "How it works",
      title: "From gap report to closed loop",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      left: {
        label: "Humans · ILE",
        items: [
          "Severity-ranked gaps from TAP or Proof-of-Work API",
          "Coached scenarios only where the model says it is needed",
          "Track score movement with proof of work at every step",
          "Managers get a repair path after evaluation",
        ],
      },
      right: {
        label: "Agents · ALE",
        items: [
          "Evolve skill.md files from real runs",
          "Validate tool use inside your data boundary",
          "Compare runs over time with auditable reports",
          "Clear deploy readiness, not vanity benchmark deltas alone",
        ],
      },
    },
    {
      layout: "statement",
      kicker: "Use case · Adoption",
      title: "Product activation & feature adoption",
      subtitle:
        "Diagnose which concepts block conversion after signup. Rank gaps by severity so enablement teaches what actually stops users from succeeding.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      ...labeledHighlights([
        [
          "Use case",
          "Product activation: diagnose which concepts block conversion after signup.",
        ],
        [
          "Outcome",
          "Enablement teaches what actually stops users from succeeding.",
        ],
      ]),
      bullets: [
        "Workspace evidence from real product work, not survey self-report",
        "Trigger ILE or in-product guidance only when scores demand it",
        "Measure learning-to-conversion, not module completion rates",
        "Customer success intervenes before churn or support load spikes",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · Coaching",
      title: "Dynamic onboarding & post-hire ramp",
      subtitle:
        "Adapt the next coaching step to verified gaps.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      bullets: [
        "Compound efficiency gains instead of one-off training completions",
        "Role transitions get the same gap-driven practice as day-one onboarding",
        "TIM interrupts shallow fluency mid-path, not only at the end of a course",
        "Managers see marker movement, not attendance logs",
      ],
    },
    {
      layout: "statement",
      kicker: "Use case · Score movement",
      title: "CI and eval improvement loops for agents",
      subtitle:
        "Embed scoring in agent pipelines. Compare runs over time and prove skill movement with auditable reports.",
      backgroundImage: PITCH_ASSETS.aesthetics.useCase,
      bullets: [
        "ALE iterates capabilities until learning efficiency clears your bar",
        "Agents are not born with skills",
        "Same TIM loop as human optimization, shared workspace blocks",
        "Vendor and internal agents judged on deploy readiness, not demos",
      ],
    },
    {
      layout: "bullets",
      kicker: "More optimization motions",
      title: "Where score movement pays for itself",
      backgroundImage: PITCH_ASSETS.aesthetics.optimization,
      bullets: [
        "Customer success & expansion plays",
        "Agentic skill optimization (ALE) until adoption and deploy readiness clear",
        "Post-hire ramp & role transitions with targeted practice blocks",
        "Enablement that teaches blockers to conversion, not the full catalog",
      ],
    },
    {
      layout: "close",
      kicker: "Next step",
      title: "Close the gaps until learning converts.",
      backgroundImage: PITCH_ASSETS.aesthetics.close,
      bullets: [
        "Wire dynamic onboarding and ALE skill loops to your verification signals",
        "Pilot one adoption, coaching, or agent eval motion",
        "Create a Workspace and measure score movement on a live cohort",
      ],
      footnote: "uncertain.systems · Learning Optimization · ILE · ALE · Trace Interruption Model",
    },
  ],
};
