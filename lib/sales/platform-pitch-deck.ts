import type { SolutionSlideDeck } from "@/lib/sales/solution-slide-decks";

export const PLATFORM_PITCH_DECK: SolutionSlideDeck = {
  vertical: "pitch",
  label: "Sales Pitch",
  slides: [
    {
      layout: "title",
      kicker: "openLesson · Learning Verification",
      title: "Beyond benchmarks for AI. Beyond quizzes for humans.",
      subtitle:
        "Verify that learning actually happened for people using tools and for agents deployed to production.",
    },
    {
      layout: "statement",
      kicker: "The problem",
      title: "Outputs look ready before learning is verified.",
      subtitle:
        "Real-time assist and copilots make polished delivery easy. Quizzes and benchmark pass rates were never reliable proxies for learning.",
      bullets: [
        "Humans finish training without learning how to use tools",
        "Agents pass benchmark suites without reliable production tool use",
        "Completion dashboards and leaderboard accuracy hide shallow understanding",
        "The gap shows up in client work, incidents, bad deploys, and churn",
      ],
    },
    {
      layout: "bullets",
      kicker: "What breaks",
      title: "Vanity metrics fail when AI sits between the person and the task",
      bullets: [
        "Reps look prepared until procurement reframes the deal",
        "Users complete onboarding but never activate or convert",
        "Candidates deliver polished interviews fed by hidden AI assist",
        "Agents deploy on benchmark scores that do not predict production behavior",
      ],
    },
    {
      layout: "split",
      kicker: "Our thesis",
      title: "Learning verification, tied to learning-to-conversion",
      left: {
        label: "Our focus: learning verification",
        items: [
          "Evidence API verifies humans and agents from artifacts and tool traces",
          "Think Aloud Protocol captures live human cognition under probe",
          "ILE serves human learning; ALE helps skill.md developers evolve agent skills",
          "No exam. No benchmark theater.",
        ],
      },
      right: {
        label: "Our results: learning-to-conversion",
        items: [
          "Humans: did they learn enough to activate, adopt, and convert?",
          "Agents: did they learn enough to deploy and perform in production?",
          "Evidence tied to outcomes, not vanity completion or benchmark scores",
          "Verify learning, then close the gaps when scores fall short",
        ],
      },
    },
    {
      layout: "statement",
      kicker: "The platform",
      title: "Four products. One Verification Workspace.",
      subtitle:
        "Everything runs on Verification Workspaces: structured environments you create and enrich with documents, tool traces, screen shares, video, and any evidence from humans or agents.",
      bullets: [
        "Define skills, scenarios, and decision domains as assessable blocks",
        "Ingest evidence via API or upload; context enriches continuously",
        "One workspace powers verification, scoring, gap analysis, and improvement",
      ],
    },
    {
      layout: "split",
      kicker: "Product 1",
      title: "Evidence API",
      left: {
        label: "What it does",
        items: [
          "Headless verification for humans and agents",
          "Send artifacts, tool traces, transcripts, screen captures",
          "Receive continuous scores and severity-ranked gap analysis",
        ],
      },
      right: {
        label: "Best when",
        items: [
          "You need deploy gates for agents beyond benchmark pass rates",
          "You want to confirm humans learned a workflow, not clicked through training",
          "Your stack owns the UX: LMS, HRIS, CI pipelines, agentic products",
        ],
      },
    },
    {
      layout: "split",
      kicker: "Product 2",
      title: "Think Aloud Protocol",
      left: {
        label: "What it does",
        items: [
          "Hosted verification for live human cognition",
          "Shareable URLs scoped to a block or full workspace",
          "Socratic probes target hesitations, revisions, and causal chains",
        ],
      },
      right: {
        label: "Best when",
        items: [
          "AI assist makes polished output untrustworthy",
          "You need evidence before a hire, promotion, or live customer moment",
          "You want auditable marker scores and gap reports, not a single pass/fail",
        ],
      },
    },
    {
      layout: "split",
      kicker: "Product 3",
      title: "Integrated Learning Environment (ILE)",
      left: {
        label: "What it does",
        items: [
          "Where humans improve after verification surfaces gaps",
          "Guided practice: think-aloud sessions, Socratic probes, scenario blocks",
          "Track score movement with evidence at every step",
        ],
      },
      right: {
        label: "Best when",
        items: [
          "Gaps need to close, not just be labeled in a dashboard",
          "Managers need a repair path after evaluation",
          "You are building durable judgment, not checking a box",
        ],
      },
    },
    {
      layout: "split",
      kicker: "Product 4",
      title: "Agentic Learning Environment (ALE)",
      left: {
        label: "What it does",
        items: [
          "Where skill.md developers test and evolve agent skills",
          "Run agents against workspace scenarios with shared scoring",
          "Iterate on skill definitions until Evidence API clears the deploy bar",
        ],
      },
      right: {
        label: "Best when",
        items: [
          "Verification gaps should feed back into skill refinement",
          "You build agent skills, not just consume benchmark scores",
          "Agents and humans share the same workspace context",
        ],
      },
    },
    {
      layout: "statement",
      kicker: "The loop",
      title: "Verify learning. Close the gaps.",
      bullets: [
        "Pipe tool traces into Evidence API for human and agentic scoring",
        "Issue Think Aloud Protocol URLs for live human cognition under probe",
        "Route humans into the ILE to improve; use ALE to iterate agent skills",
        "New evidence flows back: learning becomes measurable over time",
      ],
    },
    {
      layout: "bullets",
      kicker: "How it works",
      title: "Workspace → Verify → Improve",
      bullets: [
        "Create a Verification Workspace around the skill, scenario, or decision domain",
        "Verify learning with Evidence API and/or Think Aloud Protocol",
        "Get continuous marker scores, severity-ranked gaps, and auditable rationale",
        "Close gaps in the ILE (humans) or ALE (agents) with evidence at every step",
      ],
    },
    {
      layout: "bullets",
      kicker: "Outcomes",
      title: "Stop measuring completion. Start measuring learning.",
      bullets: [
        "Verify agent skills and tool use before production, not just benchmark pass rates",
        "Confirm humans learned how to use a workflow, not just clicked through training",
        "Detect hidden gaps before they show up in client work, incidents, or bad deploys",
        "Separate genuine human thinking from AI-fed interview polish and take-home fluff",
        "Create auditable evidence for compliance, promotion, deploy gates, and high-stakes roles",
        "Close gaps with ILE practice so verification leads to improvement, not just labels",
      ],
    },
    {
      layout: "close",
      kicker: "Next step",
      title: "Verify humans and agents, not just their outputs.",
      bullets: [
        "Create your first Verification Workspace free",
        "Start with Evidence API, Think Aloud Protocol, or both on one scenario",
        "Pilot one high-stakes motion: onboarding, deploy gate, hiring, or escalation",
      ],
      footnote:
        "openlesson.academy · Evidence API · Think Aloud Protocol · ILE · Agentic Learning Environment",
    },
  ],
};