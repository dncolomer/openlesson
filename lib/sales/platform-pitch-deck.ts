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
        "One learning world model and product suite for human and agentic learning — proof of work turned into hire, deploy, adopt, and certify decisions.",
      backgroundImage: PITCH_ASSETS.aesthetics.title,
      cards: [
        {
          label: "Verification",
          body: "Prove skill before hire, promote, certify, or deploy — for humans and agents, beyond surface polish and thin benchmark scores.",
        },
        {
          label: "Optimization",
          body: "Route the next practice or coaching step from verified gaps until adoption, score movement, and deploy readiness improve.",
        },
        {
          label: "Augmentation",
          body: "Interrupt shallow fluency with probes inside onboarding, courses, and prep — replace “check your knowledge” with real thinking.",
        },
      ],
    },
    ...buildFounderSlides("platform"),
    {
      layout: "statement",
      kicker: "The problem",
      title: "Outputs look ready before learning is verified.",
      subtitle:
        "Real-time assist and copilots make polished delivery easy. Quizzes and benchmark pass rates were never reliable proxies for learning — for people or agents.",
      backgroundImage: PITCH_ASSETS.aesthetics.problem,
      ...labeledHighlights([
        [
          "The trap",
          "Outputs look ready before learning is verified — copilots make polish cheap for humans and agents alike.",
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
          "Attention loops, Socratic probes, and proof of work today — world models and biofeedback on the path.",
        ],
      ]),
      bullets: [
        "Low-ROI learning still demands too much effort for the depth it returns",
        "Self-driving learning: more attention markers without a proportional energy cost",
        "Software first — attention loops, Socratic probes, proof of work — then world models and biofeedback",
      ],
    },
    {
      layout: "statement",
      kicker: "Science",
      title: "A holistic model of knowledge",
      subtitle:
        "We treat learning as physics of mind, not as a quiz score: brains and agent policies sit in configuration space. Useful knowledge is proximity to a state you can retrieve, apply, and transform — and educational technology should shorten that path without burning proportional human energy. Proof of work is how we measure that proximity in software today.",
      backgroundImage: PITCH_ASSETS.aesthetics.science,
      ...labeledHighlights([
        [
          "Knowledge = proximity",
          "Knowledge is not a binary flag — it is closeness to a configuration where you can retrieve, apply, and transform what the task demands.",
        ],
        [
          "PoW measures proximity",
          "Artifacts, tool traces, and think-aloud under probe are a better proxy for configuration than tests and benchmarks that sample thin output slices.",
        ],
      ]),
      bullets: [
        "Brain configuration: the full physical (or agent) state at a point in time — every skill, memory, and decision lives as a configuration of activity, not as a completion checkbox.",
        "Knowledge = proximity: knowledge is not a binary flag. It is how near the current configuration is to one where you can reliably retrieve, apply, and transform what the task demands. Closeness — not percent complete — is the signal that matters.",
        "Learning = transformation: to learn is to move through configuration space toward a more useful state, ideally with less wasted effort. Good edtech shortens that path while preserving depth of understanding.",
        "Non-invasive path: we start with software attention loops, Socratic probes, and proof-of-work verification; over time we layer world models, non-invasive stimulation, and biofeedback — toward self-driving learning without asking humans to spend proportionally more energy.",
        "Why measurement must change: tests and benchmarks sample thin slices of output; proof of work (artifacts, tool traces, think-aloud under probe) is a better proxy for configuration proximity — and that is what verification, optimization, and augmentation all score against.",
      ],
    },
    {
      layout: "statement",
      kicker: "Our thesis",
      title: "A learning world model — not linear analytics.",
      subtitle:
        "Uncertain Systems builds a live picture from skills, scenarios, proof of work, and where reasoning breaks. The Trace Interruption Model uses that model to drive verification, optimization, and augmentation in context.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      highlights: thesisScienceHighlights("platform"),
      highlightLabels: [...THESIS_HIGHLIGHT_LABELS],
      bullets: [
        "Verification scores whether humans and agents can perform before hire, deploy, or certify",
        "Optimization routes the next practice or coaching step when gaps show up in the model",
        "Augmentation interrupts shallow fluency with probes tuned to what the workspace already knows",
        "One model, three verticals — embedded in your existing tools",
      ],
    },
    {
      layout: "split",
      kicker: "Three verticals",
      title: "Where the platform meets real work",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      left: {
        label: "Verification · Optimization",
        items: [
          "Verify skills before hire, promote, certify, or deploy",
          "TAP-cha and hard-skill probes for humans; tool-trace gates for agents",
          "Optimize until adoption, score movement, and deploy readiness improve",
          "Dynamic onboarding and ALE skill loops from verified gaps",
        ],
      },
      right: {
        label: "Augmentation · Outcomes",
        items: [
          "Augment how people think inside onboarding, courses, and prep",
          "Replace “check your knowledge” widgets with reasoning under probe",
          "Humans: did they learn enough to activate, adopt, and convert?",
          "Agents: did they learn enough to deploy and perform in production?",
        ],
      },
    },
    {
      layout: "statement",
      kicker: "Foundation",
      title: "Workspace — one live learning world model",
      subtitle:
        "Everything runs on Workspaces: structure skills and scenarios, attach documents and proof of work, and run every product against one shared context.",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      bullets: [
        "Define skills, scenarios, and decision domains as assessable blocks",
        "Ingest proof of work via API, upload, screen share, or tool traces",
        "One workspace powers verification, scoring, gap analysis, and improvement",
      ],
    },
    {
      layout: "bullets",
      kicker: "Trace Interruption Model",
      title: "The shared model behind every product",
      backgroundImage: PITCH_ASSETS.aesthetics.products,
      bullets: [
        "Not a standalone SKU — the intelligence layer under verification, optimization, and augmentation",
        "Trained to predict optimal interruptions: when to probe, coach, or request proof",
        "Breaks turn-based quiz linearity; acts on the live learning world model instead of funnel events",
        "Same TIM loop for human think-aloud and agent tool-use paths",
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
      title: "Three verticals, one business context — synergy, not silos.",
      subtitle:
        "Verification, optimization, and augmentation share the same workspace and learning world model. Win one high-stakes entry motion, then unlock the other two inside the same customer relationship — without re-instrumenting the stack.",
      backgroundImage: PITCH_ASSETS.aesthetics.verticals,
      cards: [
        {
          label: "Synergy",
          body: "Each vertical feeds the others — verified gaps drive practice; practice and probes produce new proof of work; the model gets sharper over time.",
        },
        {
          label: "1 · Start in verification",
          body: "Talent platform example: ship TAP / PoW gates for hiring, promotion, and agent deploy readiness — proof of skill before the decision.",
        },
        {
          label: "2 · Unlock optimization",
          body: "Same context: gap reports become dynamic onboarding, post-hire ramp, and ALE skill loops for the people and agents you just verified.",
        },
        {
          label: "3 · Unlock augmentation",
          body: "Same context: probes in academy, certification prep, and in-product checks — L&D and product go deeper without a second vendor stack.",
        },
      ],
      bullets: [
        "One workspace, three revenue motions: verification opens the door; optimization and augmentation expand the account on the evidence you already score.",
        "Land and expand without re-instrumenting the stack — the same learning world model powers every vertical.",
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
        "Verify agent skills and tool use before production — not just benchmark pass rates",
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
      title: "Verify, optimize, and augment learning — not just outputs.",
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
