import { SOLUTION_SLUGS, getSolutionPage } from "@/lib/seo/solution-pages";

export type SalesSlide = {
  layout: "title" | "statement" | "bullets" | "split" | "close";
  kicker?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  left?: { label: string; items: string[] };
  right?: { label: string; items: string[] };
  footnote?: string;
};

export type SolutionSlideDeck = {
  vertical: string;
  label: string;
  slides: SalesSlide[];
};

const PLATFORM_SLIDES: SalesSlide[] = [
  {
    layout: "statement",
    kicker: "Learning verification",
    title: "Beyond benchmarks for AI. Beyond tests for humans.",
    subtitle:
      "openLesson verifies learning through evidence, proof of work, and cognitive analysis for people as well as AI agents performing knowledge work.",
    bullets: [
      "Focus: learning verification with Evidence API, TAP, ILE, and ALE",
      "Results: learning-to-conversion tied to activation, deploy gates, and production performance",
      "No exam. No benchmark theater.",
    ],
  },
  {
    layout: "statement",
    kicker: "The platform",
    title: "Four products. One Verification Workspace.",
    subtitle:
      "A structured environment around a real skill or scenario, broken into assessable blocks on a learning graph. Evidence accumulates as work happens.",
    bullets: [
      "Create and enrich workspaces programmatically via Agentic API v2",
      "Ingest documents, call transcripts, screen shares, video, EEG, tool traces",
      "One workspace context powers verification, scoring, and improvement",
    ],
  },
  {
    layout: "split",
    kicker: "Product 1",
    title: "Evidence API: headless verification",
    left: {
      label: "What it does",
      items: [
        "Send unstructured evidence; receive continuous readiness scores",
        "Gap analysis updates as new artifacts arrive",
        "No hosted session required: embed in LMS, HRIS, or agent pipelines",
      ],
    },
    right: {
      label: "Best when",
      items: [
        "You already have call recordings, CRM notes, or work artifacts",
        "You need ongoing scoring, not a one-time test event",
        "Your stack owns the learner or employee UX",
      ],
    },
  },
  {
    layout: "split",
    kicker: "Product 2",
    title: "Think Aloud Protocol: hosted verification",
    left: {
      label: "What it does",
      items: [
        "Shareable evaluation URLs scoped to a block or full workspace",
        "Humans verbalize reasoning while working: live cognition under probe",
        "Socratic follow-ups target hesitations, revisions, and causal chains",
      ],
    },
    right: {
      label: "Best when",
      items: [
        "You need a high-trust signal before a live customer or hire decision",
        "AI assist tools make polished output untrustworthy",
        "You want auditable marker scores and gap reports",
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
        "Routes gap findings into guided practice, not another content library",
        "Think-aloud sessions, Socratic probes, targeted scenario blocks",
        "Humans improve scores with evidence at every step",
      ],
    },
    right: {
      label: "Best when",
      items: [
        "Gaps need to close, not just be labeled in a dashboard",
        "Managers need a repair path after evaluation, not a failing grade",
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
        "Sandbox for skill developers to test and evolve agent skills",
        "Run agents against workspace scenarios with shared scoring",
        "Iterate on skill definitions until Evidence API clears deploy bar",
      ],
    },
    right: {
      label: "Best when",
      items: [
        "You build agent skills, not just consume benchmark scores",
        "Verification gaps should feed back into skill refinement",
        "Agents and humans share the same workspace context",
      ],
    },
  },
  {
    layout: "statement",
    kicker: "The loop",
    title: "Verify learning. Close the gaps.",
    bullets: [
      "Evidence API or Think Aloud Protocol surfaces weak spots with shared scoring",
      "ILE closes human gaps; ALE helps skill.md developers evolve agent skills",
      "New evidence flows back: learning becomes measurable over time",
    ],
  },
];

function deck(
  vertical: string,
  label: string,
  opening: SalesSlide[],
  verticalMiddle: SalesSlide[],
  closing: SalesSlide[],
): SolutionSlideDeck {
  return {
    vertical,
    label,
    slides: [...opening, ...PLATFORM_SLIDES, ...verticalMiddle, ...closing],
  };
}

export const SOLUTION_SLIDE_DECKS: Record<string, SolutionSlideDeck> = {
  "sales-enablement": deck(
    "sales-enablement",
    "Sales Enablement",
    [
      {
        layout: "title",
        kicker: "openLesson · Sales Enablement",
        title: "Prove discovery judgment, not script recall",
        subtitle: "For revenue leaders whose reps look ready until procurement reframes the deal.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "AI made your reps look prepared. It did not make them ready.",
        bullets: [
          "Copilots draft talk tracks, ROI decks, and renewal emails in seconds",
          "LMS completion and role-play polish mask shallow product understanding",
          "Managers see activity, not whether someone freezes when the buyer pushes back",
        ],
      },
      {
        layout: "bullets",
        kicker: "What breaks on live calls",
        title: "The readiness illusion in modern sales orgs",
        bullets: [
          "AI-drafted business cases with fatal assumptions nobody catches",
          "Discovery that sounds confident but never qualifies real pain",
          "Renewal negotiations where reps cannot defend tradeoffs without a copilot",
          "Promotion and account assignment based on subjective ride-alongs",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "Sales motion",
        title: "Model your ICP, competitive landscape, and renewal motion",
        left: {
          label: "Workspace blocks",
          items: [
            "Multi-threading and stakeholder mapping",
            "Objection handling without script drift",
            "Value framing when procurement reframes ROI",
            "Competitive displacement under time pressure",
          ],
        },
        right: {
          label: "How teams use the four products",
          items: [
            "Evidence API: score call prep, CRM notes, and demo artifacts continuously",
            "Think-Aloud: gate strategic accounts before live customer exposure",
            "ILE: repair discovery gaps before pipeline is at risk",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Evidence leaders can act on, not another coaching recording",
        bullets: [
          "Marker scores and severity-ranked gaps per rep and per skill block",
          "Onboarding gates and promotion readiness with structured evaluation links",
          "Repeatable standard for AI-assisted selling without scaling revenue risk",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "Start with your highest-stakes motion",
        bullets: [
          "Week 1: one Verification Workspace around enterprise renewal or competitive displacement",
          "Week 2: pilot pod runs ILE practice + Think-Aloud evaluation on critical blocks",
          "Week 3: performance report for managers, gaps, repairs, and readiness evidence",
        ],
        footnote: "Does not replace CRM or enablement LMS. Adds the verification layer you are missing.",
      },
    ],
  ),

  "customer-success": deck(
    "customer-success",
    "Customer Success",
    [
      {
        layout: "title",
        kicker: "openLesson · Customer Success",
        title: "Client escalation readiness for AI-enabled CS teams",
        subtitle: "For CS leaders who need to know who can handle executives, not who can read an AI account plan.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "Health scores are green. Escalations still become churn.",
        bullets: [
          "AI assistants produce outreach drafts, QBR decks, and renewal talking points at scale",
          "The bottleneck is human judgment when the playbook breaks",
          "Escalations expose gaps QBR attendance never surfaced",
        ],
      },
      {
        layout: "bullets",
        kicker: "What fails under pressure",
        title: "When the account heats up",
        bullets: [
          "Weak causal reasoning about adoption stalls and root risk",
          "Over-reliance on AI recommendations without customer context",
          "Inability to reframe when executive sponsors or security reviews shift",
          "Promoting CSMs to strategic books without structured readiness proof",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "CS motion",
        title: "Workspaces modeled on your escalation archetypes",
        left: {
          label: "Scenario blocks",
          items: [
            "Executive sponsor loss and stakeholder realignment",
            "Security review surprises mid-renewal",
            "Adoption stalls and mutual success plan repairs",
            "Competitive bake-offs with incomplete product fit data",
          ],
        },
        right: {
          label: "How teams use the four products",
          items: [
            "Evidence API: ingest account plans, tool traces, and session artifacts",
            "Think-Aloud: evaluate before executive-facing moments or book promotions",
            "ILE: practice repair strategies, not re-reading saved AI summaries",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "A repeatable readiness standard, not a one-off training event",
        bullets: [
          "Gap-ranked reports attachable to coaching plans and promotion packets",
          "Async evaluation links for distributed teams without manager shadowing",
          "Continuous scoring as new evidence arrives on the account",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "Know who can handle the next escalation",
        bullets: [
          "Week 1: workspace from one real escalation archetype your team sees quarterly",
          "Week 2: pod leads complete Think-Aloud evaluation on high-risk blocks",
          "Week 3: gap analysis feeds manager 1:1s and book-assignment decisions",
        ],
        footnote: "Complements Gainsight and CS platforms, verification, not CRM replacement.",
      },
    ],
  ),

  "compliance-risk": deck(
    "compliance-risk",
    "Compliance & Risk",
    [
      {
        layout: "title",
        kicker: "openLesson · Compliance & Risk",
        title: "Verify judgment, not policy awareness",
        subtitle: "For risk teams who need demonstrated reasoning before exceptions land on an examiner's desk.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "Annual training completion is not operational resilience.",
        bullets: [
          "Staff pass policy quizzes with AI assistance and sound plausible on exceptions",
          "Model-generated rationales miss blast radius and undocumented assumptions",
          "Auditors care about demonstrated judgment, not click-through rates",
        ],
      },
      {
        layout: "bullets",
        kicker: "Where AI raises stakes",
        title: "Completion metrics fail under AI pressure",
        bullets: [
          "Exception approvals using confident-sounding AI drafts",
          "Third-party risk reviews without internalized control frameworks",
          "Model governance decisions treated as checkbox exercises",
          "Remediation plans with no evidence staff can explain decisions aloud",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "Risk motion",
        title: "Scenario workspaces tied to your control framework",
        left: {
          label: "Scenario blocks",
          items: [
            "Exception types with jurisdictional nuance",
            "Data handling edge cases and breach triage",
            "Third-party and vendor risk judgment calls",
            "AI governance and model risk review decisions",
          ],
        },
        right: {
          label: "How teams use the four products",
          items: [
            "Evidence API: pipe case management artifacts and continuous scoring",
            "Think-Aloud: auditable evaluation for approvers and regional leads",
            "ILE: capture how staff explain decisions in their own words",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Audit-ready evidence, not another LMS certificate",
        bullets: [
          "Structured scores, marker rationales, and gap analysis for remediation",
          "Scope evaluation to high-risk roles and processes, not entire workforce blindly",
          "Agentic API embeds readiness gates into existing enterprise learning stacks",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "Start where exceptions hurt most",
        bullets: [
          "Week 1: workspace for one exception class or control domain you audit frequently",
          "Week 2: targeted cohort runs Think-Aloud evaluation on approval judgment blocks",
          "Week 3: gap reports feed remediation and examiner-ready evidence trails",
        ],
        footnote: "Complements GRC platforms, human judgment verification, not policy management replacement.",
      },
    ],
  ),

  "hiring-assessment": deck(
    "hiring-assessment",
    "Hiring & Assessment",
    [
      {
        layout: "title",
        kicker: "openLesson · Hiring & Assessment",
        title: "Hire for genuine cognition, not assist-tool polish",
        subtitle: "For talent teams who cannot trust live interviews when real-time AI feeds the answers.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "The Cluely problem: interviews test overlays, not people.",
        bullets: [
          "Real-time AI assist suggests answers while candidates speak",
          "LeetCode, take-homes, and traditional screens were already gameable",
          "Confident delivery is almost meaningless without cognition under probe",
        ],
      },
      {
        layout: "bullets",
        kicker: "What you are buying today",
        title: "Signals that collapse under adversarial pressure",
        bullets: [
          "Rehearsed frameworks that break when assumptions change",
          "Polished presentations with no visible reasoning trace",
          "Subjective debriefs with no shared rubric across interviewers",
          "Senior loops that cost panel time before depth is proven",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "Hiring motion",
        title: "Role-specific workspaces, not generic coding tests",
        left: {
          label: "Assessment blocks",
          items: [
            "Product prioritization under conflicting data",
            "Novel debugging and incident triage scenarios",
            "Strategy cases with political stakeholders",
            "Customer-facing escalation simulations",
          ],
        },
        right: {
          label: "How teams use the four products",
          items: [
            "Think-Aloud: primary anti-cheat layer, verbalized reasoning under Socratic probe",
            "Evidence API: async work-sample scoring before panel investment",
            "ILE: optional practice path for internal mobility, not external candidates",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Comparable evidence across candidates",
        bullets: [
          "Marker scores and gap analysis on the same block, not presentation polish",
          "Private async evaluation links reduce senior interviewer scheduling load",
          "Agentic API embeds assessment blocks into ATS or internal hiring portals",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "Prototype one role family first",
        bullets: [
          "Week 1: workspace for staff-plus, product, or strategy role archetype",
          "Week 2: run async Think-Aloud evaluation on 5–10 candidates or internal calibrations",
          "Week 3: compare marker scores and gaps, shared rubric for hiring managers",
        ],
        footnote: "Measures cognition adversaries cannot paste in. Not another HackerRank clone.",
      },
    ],
  ),

  "lms-integration": deck(
    "lms-integration",
    "LMS & EdTech Integration",
    [
      {
        layout: "title",
        kicker: "openLesson · LMS Integration",
        title: "Stop measuring completion. Start measuring learning.",
        subtitle: "For edtech builders and L&D platforms whose customers ask whether learners can actually perform.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "Your dashboards show completion. Buyers ask for outcomes.",
        bullets: [
          "Enrollments, watch time, and quiz passes do not prove performance under constraints",
          "AI tools sit between the learner and the task, finishing is not learning",
          "Platforms that differentiate on outcomes need a readiness layer via API",
        ],
      },
      {
        layout: "bullets",
        kicker: "What your customers cannot answer",
        title: "Completion is not competency",
        bullets: [
          "Capstone projects graded on output polish, not reasoning quality",
          "Certification prep products with no verification beyond multiple choice",
          "Partner academies without guest provisioning for external learners",
          "Coach dashboards missing structured gap analysis to act on",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "Integration motion",
        title: "Agentic API v2, built for your backend, not browser sessions",
        left: {
          label: "API surface",
          items: [
            "Create workspaces, list blocks, upload evidence programmatically",
            "Run performance reports and structured gap analysis",
            "Issue private Think-Aloud evaluation links; poll completion results",
            "Guest keys (gsk_) for learners without full accounts",
          ],
        },
        right: {
          label: "Where you embed it",
          items: [
            "Module boundaries and capstone gates in Canvas or Moodle",
            "Customer education portals and partner academies",
            "Certification prep and coach recommendation engines",
            "MCP transport for agent-native product stacks",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Keep your UX. Add verification depth.",
        bullets: [
          "Return gap analysis JSON to gradebooks, dashboards, or recommendation engines",
          "White-label evaluation sessions, learners need not have OpenLesson accounts",
          "Same workspace context across Evidence API, Think-Aloud, and ILE products",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "One integration path, one proof point",
        bullets: [
          "Week 1: API key + workspace creation from your staging environment",
          "Week 2: evidence upload + evaluation link at a single module gate",
          "Week 3: gap JSON returned to your gradebook or coach view, demo to customer",
        ],
        footnote: "Readiness backend, not an LMS replacement. Your front end stays yours.",
      },
    ],
  ),

  "engineering-oncall": deck(
    "engineering-oncall",
    "Engineering & On-Call",
    [
      {
        layout: "title",
        kicker: "openLesson · Engineering & On-Call",
        title: "Train judgment before the pager fires",
        subtitle: "For engineering leaders whose runbooks and copilots accelerate triage, but outages punish guesswork.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "Runbooks do not equal judgment.",
        bullets: [
          "Engineers follow AI remediation steps without understanding blast radius",
          "Postmortems surface weak causal links, after customers already felt the pain",
          "Traditional training rarely tests reasoning under incomplete telemetry",
        ],
      },
      {
        layout: "bullets",
        kicker: "What production teaches too late",
        title: "Incidents expose the gap",
        bullets: [
          "First-suggestion triage when the model's move is wrong",
          "Rollback decisions without customer impact framing",
          "New hires on primary pager before hypothesis formation is proven",
          "Promotion cases for IC+ roles with no reasoning evidence over time",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "On-call motion",
        title: "Simulate your failure modes, not generic SRE trivia",
        left: {
          label: "Workspace blocks",
          items: [
            "Cascading latency and partial deploy scenarios",
            "Auth outages and dependency chain reasoning",
            "Data pipeline skew and rollback tradeoffs",
            "Incident commander decisions under incomplete data",
          ],
        },
        right: {
          label: "How teams use the four products",
          items: [
            "Evidence API: score postmortem writeups and triage artifacts over time",
            "Think-Aloud: gate pager scope expansion and IC promotion loops",
            "ILE: narrate triage logic in practice, not memorize playbooks",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Scale judgment assessment between game days",
        bullets: [
          "Gap analysis highlights weak causal links before the next outage",
          "Performance reports document reasoning quality for staff engineering ladders",
          "Complements fire drills, without staging full production failures",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "Start from a real near-miss or anonymized incident",
        bullets: [
          "Week 1: workspace grounded in one failure mode your team knows well",
          "Week 2: on-call rotation subset runs Think-Aloud triage evaluation",
          "Week 3: gap report informs drill planning and pager assignment decisions",
        ],
        footnote: "Platform, security, database, and support escalation roles, not SRE-only.",
      },
    ],
  ),

  "saas-product-learning": deck(
    "saas-product-learning",
    "SaaS Product",
    [
      {
        layout: "title",
        kicker: "openLesson · SaaS Product",
        title: "Measure learning-to-conversion, not tutorial completion",
        subtitle: "For product teams whose users finish onboarding but never activate, expand, or convert.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "Your funnel shows completion. Your revenue shows something else.",
        bullets: [
          "Users click through tours, watch walkthroughs, and check every onboarding box",
          "Activation and trial-to-paid stall anyway, support tickets reveal they never learned the workflow",
          "Product analytics answer exposure; nobody verifies capability on the path to conversion",
        ],
      },
      {
        layout: "bullets",
        kicker: "What vanity onboarding hides",
        title: "The learning-to-conversion gap in PLG",
        bullets: [
          "Tooltip completion with no ability to configure, integrate, or recover from errors",
          "Academy certificates and quiz passes that do not predict in-product success",
          "Enterprise trials where solutions teams cannot tell if the champion actually learned the setup",
          "Expansion and upgrade moments that fail because users never absorbed the prior feature",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "Product motion",
        title: "Model the workflows that drive activation and revenue",
        left: {
          label: "Workspace blocks",
          items: [
            "First project or workspace setup",
            "Integration connect and data import",
            "Team invite and permission model",
            "Upgrade, expansion, and billing decision points",
          ],
        },
        right: {
          label: "How teams use the product stack",
          items: [
            "Evidence API: score session replays, tool traces, and support transcripts",
            "Think Aloud Protocol: verify high-touch trial and enterprise setup flows",
            "ILE: repair adoption gaps before churn, not after the downgrade",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Learning evidence product and growth teams can act on",
        bullets: [
          "Readiness scores as leading indicators for activation and conversion KPIs",
          "Gap analysis tied to specific product workflows, not generic NPS dips",
          "Agentic API embeds verification at onboarding gates without leaving your UX",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "Start from your highest-drop activation step",
        bullets: [
          "Week 1: Verification Workspace around one workflow your funnel loses users on",
          "Week 2: pipe in-app evidence or run TAP on strategic trial accounts",
          "Week 3: correlate readiness gaps with activation and support ticket patterns",
        ],
        footnote: "Product growth, customer education, solutions, and CS, not a replacement for your analytics stack.",
      },
    ],
  ),

  "corporate-learning": deck(
    "corporate-learning",
    "Corporate L&D",
    [
      {
        layout: "title",
        kicker: "openLesson · Corporate L&D",
        title: "Measure learning, not seat time",
        subtitle: "For L&D leaders asked to prove ROI while AI makes every course easier to finish without learning.",
      },
      {
        layout: "statement",
        kicker: "The pain",
        title: "Executives ask if you are ready. LMS reports answer a different question.",
        bullets: [
          "Launch readiness, regulatory change, and AI workflow shifts need judgment evidence",
          "Completion dashboards show who clicked, not who can decide under pressure",
          "L&D investment needs a line to demonstrable business scenarios",
        ],
      },
      {
        layout: "bullets",
        kicker: "What vanity metrics hide",
        title: "The executive question L&D cannot answer today",
        bullets: [
          "Role readiness after generic course catalogs with no scenario alignment",
          "AI upskilling programs measured by completion, not prompt judgment",
          "Manager coaching without structured gap summaries from practice",
          "Contractors and acquired teams with no lightweight guest access path",
        ],
      },
    ],
    [
      {
        layout: "split",
        kicker: "L&D motion",
        title: "Academies built around business scenarios, not content libraries",
        left: {
          label: "Workspace pathways",
          items: [
            "Role families aligned to your competency model",
            "Frontline managers, analysts, operators, solutions consultants",
            "AI literacy and human-in-the-loop review skills",
            "Capstone readiness gates before role or project assignment",
          ],
        },
        right: {
          label: "How teams use the four products",
          items: [
            "ILE: practice on scenarios that affect the P&L, not slide views",
            "Think-Aloud: manager-friendly evaluation summaries for 1:1 coaching",
            "Evidence API + Agentic API: trigger checks from LMS, HRIS, or internal portals",
          ],
        },
      },
      {
        layout: "bullets",
        kicker: "Outcome",
        title: "Evidence executives and managers trust",
        bullets: [
          "Severity-ranked gaps and specific repair recommendations, not opaque scores",
          "Async evaluation scales coaching beyond manager shadowing alone",
          "Guest keys support contractors, partners, and acquired teams",
        ],
      },
    ],
    [
      {
        layout: "close",
        kicker: "Pilot shape",
        title: "One role family. One readiness gate.",
        bullets: [
          "Week 1: Verification Workspace for highest-priority role family or launch scenario",
          "Week 2: learners practice in ILE; managers receive evaluation gap summaries",
          "Week 3: executive readout, readiness evidence tied to business scenario, not seat time",
        ],
        footnote: "Verification layer on top of your existing LMS, not a rip-and-replace.",
      },
    ],
  ),
};

export const SLIDE_DECK_SLUGS = SOLUTION_SLUGS.filter((slug) => slug in SOLUTION_SLIDE_DECKS);

export function getSolutionSlideDeck(slug: string): SolutionSlideDeck | undefined {
  return SOLUTION_SLIDE_DECKS[slug];
}

export function getSlideDeckLabel(slug: string): string {
  return getSolutionPage(slug)?.navLabel ?? slug;
}