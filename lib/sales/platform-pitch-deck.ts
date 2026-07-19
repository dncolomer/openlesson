import { buildFounderSlides } from "@/lib/sales/founder-slides";
import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";
import { PITCH_ASSETS } from "@/lib/sales/solution-slide-decks";
import { buildPrivacyDataSlide } from "@/lib/sales/privacy-data-slide";
import { labeledHighlights } from "@/lib/sales/slide-highlights";
import {
  THESIS_HIGHLIGHT_LABELS,
  thesisScienceHighlights,
} from "@/lib/sales/thesis-science-snippet";

export const PLATFORM_PITCH_DECK: SolutionSlideDeck = {
  vertical: "pitch",
  label: "Platform Pitch",
  backgroundImage: PITCH_ASSETS.aesthetics.title,
  slides: [
    {
      layout: "title",
      kicker: "Uncertain Systems · Three verticals",
      title: "Beyond benchmarks for AI. Beyond tests for humans.",
      subtitle:
        "One learning world model and product suite for human and agentic learning.",
      backgroundImage: PITCH_ASSETS.aesthetics.title,
      cards: [
        {
          label: "Verification",
          body: "Prove skill before hire, promote, certify, or deploy.",
        },
        {
          label: "Optimization",
          body: "Route the next practice or coaching step from verified gaps until adoption, score movement, and deploy readiness improve.",
        },
        {
          label: "Augmentation",
          body: "Interrupt shallow fluency with probes inside onboarding, courses, and prep.",
        },
      ],
    },
    ...buildFounderSlides("platform"),
    {
      layout: "statement",
      kicker: "The problem",
      title: "Outputs look ready before learning is verified.",
      subtitle:
        "Real-time assist and copilots make polished delivery easy. Quizzes and benchmark pass rates were never reliable proxies for learning.",
      backgroundImage: PITCH_ASSETS.aesthetics.problem,
      ...labeledHighlights([
        [
          "The trap",
          "Outputs look ready before learning is verified.",
        ],
        [
          "Why proxies fail",
          "Quizzes and benchmark pass rates sample thin outputs, not configuration proximity under real work.",
        ],
      ]),
      bullets: [
        "Humans finish training without learning how to use tools in production",
        "Agents pass benchmark suites without reliable tool use under real constraints",
        "Completion dashboards and leaderboard accuracy hide shallow understanding",
        "The gap shows up in client work, incidents, bad deploys, and churn",
      ],
    },
    {
      layout: "statement",
      kicker: "Vision",
      title: "Automating human learning.",
      subtitle:
        "We are building self-driving technology for learning: non-invasive systems that raise attention and understanding without asking humans to burn proportionally more energy.",
      backgroundImage: PITCH_ASSETS.aesthetics.vision,
      ...labeledHighlights([
        [
          "The goal",
          "More attention and deeper understanding without proportional energy cost to the learner.",
        ],
        [
          "Software first",
          "Attention loops, Socratic probes, and proof of work today.",
        ],
      ]),
      bullets: [
        "Low-ROI learning still demands too much effort for the depth it returns",
        "Self-driving learning: more attention markers without a proportional energy cost",
        "Software first",
      ],
    },
    {
      layout: "statement",
      kicker: "Science",
      title: "A holistic model of knowledge",
      subtitle:
        "Learning is physics of mind, not a quiz score. Brains and agents sit in configuration space; useful knowledge is proximity to a state you can retrieve, apply, and transform.",
      backgroundImage: PITCH_ASSETS.aesthetics.science,
      ...labeledHighlights([
        [
          "Knowledge = proximity",
          "Closeness to a useful configuration. Not a binary flag or completion percentage.",
        ],
        [
          "PoW measures proximity",
          "Artifacts, tool traces, and think-aloud under probe. Better than thin test or benchmark slices.",
        ],
      ]),
      bullets: [
        "Brain configuration: the full physical (or agent) state at a point in time",
        "Learning = transformation: move through configuration space with less wasted effort",
        "Non-invasive path: software probes and proof of work today; world models and biofeedback later",
      ],
    },
    {
      layout: "statement",
      kicker: "Our thesis",
      title: "A learning world model, not linear analytics.",
      subtitle:
        "Uncertain Systems builds a live picture from skills, scenarios, proof of work, and where reasoning breaks. The Trace Interruption Model uses that model to drive verification, optimization, and augmentation in context.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      highlights: thesisScienceHighlights("platform"),
      highlightLabels: [...THESIS_HIGHLIGHT_LABELS],
      bullets: [
        "Verification scores whether humans and agents can perform before hire, deploy, or certify",
        "Optimization routes the next practice or coaching step when gaps show up in the model",
        "Augmentation interrupts shallow fluency with probes tuned to what the workspace already knows",
        "One model, three verticals",
      ],
    },
    {
      layout: "statement",
      kicker: "Foundation",
      title: "Workspace: where the learning world model lives",
      subtitle:
        "Everything runs on Workspaces: skills, scenarios, proof of work, and the live learning world model in one shared context. The Trace Interruption Model is the interruption layer on top of that context today; it is separate for practical development reasons and is on a path to merge into the learning world model.",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      ...labeledHighlights([
        [
          "Learning world model",
          "Lives in the Workspace: structured skills and scenarios, ingested proof of work, continuous scores and gaps.",
        ],
        [
          "TIM today → one model later",
          "Trace Interruption Model predicts when to probe, coach, or request proof. Built as a separate model for now so we can ship interruptions; destination is a single learning world model that includes interruption.",
        ],
      ]),
      bullets: [
        "Define skills, scenarios, and decision domains as assessable blocks inside the workspace",
        "Ingest proof of work via API, upload, screen share, or tool traces",
        "TIM is not a standalone SKU: it powers interruption under verification, optimization, and augmentation against workspace context",
        "Same interruption loop for human think-aloud and agent tool-use paths, acting on workspace state instead of linear funnel events",
        "Today: learning world model + TIM as two cooperating pieces; tomorrow: one unified model as the architecture converges",
      ],
    },
    {
      layout: "split",
      kicker: "Product suite · 01–02",
      title: "Proof-of-Work API & Think Aloud Protocol",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      left: {
        label: "Proof-of-Work API",
        items: [
          "Headless scoring for humans and agents",
          "Artifacts, tool traces, transcripts, screen captures",
          "TIM-powered interruption hints and severity-ranked gaps",
          "Programmable base for gates inside your stack",
        ],
      },
      right: {
        label: "Think Aloud Protocol",
        items: [
          "Hosted verification for live human cognition",
          "Shareable URLs scoped to a block or full workspace",
          "Socratic probes on hesitations, revisions, causal chains",
          "TAP-cha: confirm a live human, not AI-fed polish",
        ],
      },
    },
    {
      layout: "split",
      kicker: "Product suite · 03–04",
      title: "ILE & Agentic Learning Environment",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      left: {
        label: "Integrated Learning Environment",
        items: [
          "Hosted practice when depth beats checkbox tests",
          "Coached scenarios wired to verified gaps",
          "Score movement with proof of work at every step",
          "Take-home and quiz replacement for complex cognition",
        ],
      },
      right: {
        label: "Agentic Learning Environment",
        items: [
          "Evolve agent skill.md files from real runs",
          "Validate tool use inside your data boundary",
          "Iterate until deploy readiness clears",
          "Same workspace and TIM loop as human products",
        ],
      },
    },
    buildPrivacyDataSlide(),
    {
      layout: "statement",
      kicker: "The loop",
      title: "Three verticals, one business context. Synergy, not silos.",
      subtitle:
        "Verification, optimization, and augmentation share the same workspace and learning world model. Start where the decision is sharpest.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      cards: [
        {
          label: "Synergy",
          body: "Each vertical feeds the others.",
        },
        {
          label: "1 · Start in verification",
          body: "Talent platform example: ship TAP / PoW gates for hiring, promotion, and agent deploy readiness.",
        },
        {
          label: "2 · Then optimization",
          body: "Same foundation: gap reports become dynamic onboarding, post-hire ramp, and ALE skill loops for the people and agents you already verified.",
        },
        {
          label: "3 · Then augmentation",
          body: "Same foundation: probes in academy, certification prep, and in-product checks.",
        },
      ],
      bullets: [
        "One workspace, three verticals: verification establishes the signal; optimization and augmentation reuse that same proof of work across the business context.",
        "The learning world model is the foundation.",
      ],
    },
    {
      layout: "bullets",
      kicker: "Outcomes",
      title: "Stop measuring completion. Start measuring learning.",
      backgroundImage: PITCH_ASSETS.aesthetics.close,
      ...labeledHighlights([
        [
          "Stop equating completion with skill",
          "Stop treating module completion and benchmark pass rates as if they were skill.",
        ],
        [
          "Start learning proof",
          "Start measuring learning with auditable proof of work tied to hire, deploy, adopt, and certify decisions.",
        ],
      ]),
      bullets: [
        "Verify agent skills and tool use before production",
        "Confirm humans learned a workflow, not just clicked through training",
        "Detect hidden gaps before client work, incidents, or bad deploys",
        "Separate genuine human thinking from AI-fed interview polish",
        "Create auditable proof of work for compliance, promotion, and high-stakes roles",
        "Tie every intervention to adoption, deploy readiness, and conversion",
      ],
    },
    {
      layout: "close",
      kicker: "Next step",
      title: "Verify, optimize, and augment learning.",
      backgroundImage: PITCH_ASSETS.aesthetics.close,
      bullets: [
        "Create your first Workspace free",
        "Pilot one high-stakes motion: hiring, deploy gate, onboarding, or certification prep",
        "Start with Proof-of-Work API, Think Aloud Protocol, ILE, or ALE against one scenario",
      ],
      footnote:
        "uncertain.systems · Verification · Optimization · Augmentation · Trace Interruption Model · Workspace",
    },
  ],
};
