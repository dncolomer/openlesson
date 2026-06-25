import type { Metadata } from "next";

export type SeoSection = {
  title: string;
  paragraphs: string[];
};

export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoCtaLink = {
  label: string;
  href: string;
};

export type SeoSolutionPageConfig = {
  slug: string;
  path: string;
  eyebrow: string;
  h1: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  navLabel: string;
  navDescription: string;
  sections: SeoSection[];
  faqs: SeoFaq[];
  primaryCta: SeoCtaLink;
  secondaryCta?: SeoCtaLink;
  closingTitle: string;
  closingBody: string;
};

const BASE_URL = "https://openlesson.academy";
const DEFAULT_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

export const PLATFORM_PAGE: SeoSolutionPageConfig = {
  slug: "platform",
  path: "/platform",
  eyebrow: "openLesson Platform",
  h1: "Performance readiness software for AI-enabled learning",
  intro:
    "openLesson helps you prove genuine human cognition—not polished AI output or hidden interview assistance. Score real thinking with the Think-Aloud Protocol and Selective Thought Interface inside Performance Workspaces, the ILE, and evaluation sessions.",
  metaTitle: "Performance Readiness Platform — Think-Aloud Cognition Scoring",
  metaDescription:
    "Score genuine human thinking—not AI-assisted polish. openLesson uses the Think-Aloud Protocol and Selective Thought Interface to verify cognition in workspaces, ILE sessions, and evaluation environments.",
  keywords: [
    "performance readiness platform",
    "AI skill assessment",
    "think aloud protocol",
    "AI interview cheating detection",
    "genuine human cognition",
    "learning verification software",
    "immersive learning environment",
    "LMS integration API",
    "skills gap analysis",
  ],
  navLabel: "Platform",
  navDescription: "Workspaces, ILE, evaluation, and API overview",
  sections: [
    {
      title: "The problem: AI makes you look ready before you are",
      paragraphs: [
        "Generative AI gives instant answers, drafts, and confident-looking work. Real-time assist tools go further—feeding suggestions during live interviews, exams, and calls via hidden overlays. Outputs look competent; cognition often goes unmeasured.",
        "Training completion and quiz scores were never reliable proxies for judgment. AI-assisted cheating makes the illusion worse. openLesson surfaces readiness evidence early by scoring how people think out loud when probed—not what they can paste from an assistant.",
      ],
    },
    {
      title: "Think-Aloud Protocol + Selective Thought Interface",
      paragraphs: [
        "The Think-Aloud Protocol is a validated cognitive method: learners verbalize reasoning while working. Hesitations, self-corrections, causal chains, and skipped steps become observable—the gaps polished deliverables conceal.",
        "openLesson's Selective Thought Interface extends that signal. Learners submit transcribed thought fragments; the system responds with Socratic probes that elicit evidence of understanding, transfer, and repair. You measure live cognition under inquiry—the most reliable score of genuine human thinking available in an AI-enabled assessment stack.",
      ],
    },
    {
      title: "Performance Workspaces: structure what matters",
      paragraphs: [
        "Start with a prompt describing the skill or scenario you need to master. openLesson generates a Performance Workspace with assessable blocks linked in a learning graph.",
        "Each block defines what you should be able to demonstrate. Progress is tracked per block, not as a single course completion bar. That granularity makes gap analysis specific enough to act on.",
      ],
    },
    {
      title: "Immersive Learning Environment (ILE)",
      paragraphs: [
        "The ILE is where practice happens. You enter a learning session for a block, follow the Think-Aloud Protocol, and build the judgment AI cannot replace.",
        "Live speech is transcribed into think-aloud traces. Pauses become selectable thoughts for deeper probing. Reasoning accumulates as evidence—not as a final answer an overlay could supply.",
      ],
    },
    {
      title: "Evaluation Environment: verify readiness",
      paragraphs: [
        "When you need proof—not practice—openLesson's Evaluation Environment runs structured sessions that probe understanding, score learning markers, and return gap analysis with suggested repairs.",
        "Evaluation links can be scoped to a single block or an entire workspace. Results include overall scores, per-marker rationale, and evidence-backed gaps.",
      ],
    },
    {
      title: "Agentic API: integrate with any LMS or edtech platform",
      paragraphs: [
        "Teams building custom learning products can use the Agentic API v2 to create workspaces programmatically, upload evidence artifacts, request structured performance reports, issue private evaluation links, and poll completion results.",
        "Connect openLesson's readiness layer to Canvas, Moodle, internal academies, or any system that needs verified human performance data alongside AI tooling.",
      ],
    },
    {
      title: "Readiness evidence, not vanity metrics",
      paragraphs: [
        "openLesson synthesizes signals from ILE sessions, evaluation results, uploaded artifacts, and linked activity into performance reports: strengths, growth areas, severity-ranked gaps, and recommended practice.",
        "Whether you are an individual professional, an L&D lead, or a product team embedding learning verification, the goal is the same: know what you actually understand before AI-assisted work goes live.",
      ],
    },
  ],
  faqs: [
    {
      question: "What is a Performance Workspace in openLesson?",
      answer:
        "A Performance Workspace is a structured learning environment built around a real skill, decision domain, or scenario. It breaks work into assessable blocks, captures evidence from practice, and produces readiness reports—not just completion checkmarks.",
    },
    {
      question: "How is openLesson different from a traditional LMS?",
      answer:
        "Most LMS platforms track seat time, quizzes, and module completion. openLesson measures demonstrated judgment via think-aloud reasoning: how you explore, revise, and defend thinking when probed—not scripts from hidden AI assist tools.",
    },
    {
      question: "How does openLesson address AI cheating in interviews and assessments?",
      answer:
        "Tools that feed answers during live calls only test whether someone can read a suggestion. openLesson scores genuine cognition through the Think-Aloud Protocol and Selective Thought Interface—speech and thought fragments under Socratic probe. That signal is far harder to fake than polished written output.",
    },
    {
      question: "What is the Selective Thought Interface?",
      answer:
        "A structured layer where learners submit transcribed thought fragments and receive targeted Socratic follow-ups. It elicits evidence of definitions, causal reasoning, examples, application, and repair—turning live thinking into scorable readiness markers.",
    },
    {
      question: "What is the Immersive Learning Environment (ILE)?",
      answer:
        "The ILE is openLesson's practice layer. You work through real scenarios, articulate reasoning, and build skill that complements AI tools—instead of hiding weak understanding behind polished outputs.",
    },
    {
      question: "What is the Evaluation Environment?",
      answer:
        "The Evaluation Environment runs structured readiness sessions that probe depth, expose gaps, and return marker scores plus actionable gap analysis.",
    },
    {
      question: "Can I integrate openLesson with my existing LMS?",
      answer:
        "Yes. The Agentic API v2 lets agents and platforms create workspaces, upload evidence, run performance analysis, and issue evaluation links—without replacing your LMS front end.",
    },
    {
      question: "Who is openLesson for?",
      answer:
        "Professionals proving readiness before critical decisions, teams validating AI-enabled skill, L&D leaders who need evidence beyond completion rates, and builders embedding learning verification via API.",
    },
  ],
  primaryCta: { label: "Create a Performance Workspace", href: "/workspace/new" },
  secondaryCta: { label: "Agentic API docs", href: "/docs/agentic-v2" },
  closingTitle: "Start measuring readiness today",
  closingBody:
    "Create your first Performance Workspace free, or explore Teams pricing for organizations and API access.",
};

export const SOLUTION_PAGES: SeoSolutionPageConfig[] = [
  {
    slug: "sales-enablement",
    path: "/solutions/sales-enablement",
    eyebrow: "Sales Enablement",
    h1: "AI sales training that proves discovery judgment—not script recall",
    intro:
      "Your reps have AI drafts for talk tracks, ROI decks, and renewal emails. openLesson measures whether they can qualify pain, challenge assumptions, and defend tradeoffs when the buyer pushes back—before revenue is on the line.",
    metaTitle: "AI Sales Training & Readiness Verification",
    metaDescription:
      "Measure sales discovery judgment and renewal readiness with Performance Workspaces, ILE practice, and evaluation sessions—not completion rates on enablement videos.",
    keywords: [
      "AI sales training",
      "sales enablement software",
      "discovery call coaching",
      "renewal negotiation training",
      "sales readiness assessment",
      "revenue team learning",
    ],
    navLabel: "Sales Enablement",
    navDescription: "Discovery, renewals, and AI-assisted selling",
    sections: [
      {
        title: "The readiness illusion in modern sales orgs",
        paragraphs: [
          "AI copilots generate polished outreach, call summaries, and business cases in seconds. Reps look prepared in role-plays and LMS modules—but that output can mask shallow product understanding and weak discovery instincts.",
          "Managers see activity and completion, not whether someone will freeze when procurement reframes the deal or when an AI-drafted ROI table contains a fatal assumption.",
        ],
      },
      {
        title: "Practice real scenarios in the ILE",
        paragraphs: [
          "Build a Performance Workspace around your ICP, competitive landscape, and renewal motion. Reps practice by explaining decisions out loud in the Immersive Learning Environment: how they qualify pain, when they challenge the buyer's narrative, and how they revise strategy when new facts appear.",
          "Each block targets a demonstrable skill—multi-threading, objection handling, value framing—not a slide deck to memorize.",
        ],
      },
      {
        title: "Evaluate before live customer exposure",
        paragraphs: [
          "Run Evaluation Environment sessions scoped to high-risk blocks: enterprise renewal negotiations, technical validation calls, or competitive displacement scenarios. Results include marker scores, gap analysis, and specific practice recommendations.",
          "Use evaluation links for onboarding gates, promotion readiness, or manager checkpoints before assigning strategic accounts.",
        ],
      },
      {
        title: "Evidence leaders can act on",
        paragraphs: [
          "Performance reports synthesize ILE traces, evaluation results, and uploaded artifacts (CRM notes, call prep, demo scripts) into strengths, growth areas, and severity-ranked gaps.",
          "Move from subjective ride-alongs to structured readiness evidence—especially for teams scaling AI-assisted selling without scaling risk.",
        ],
      },
    ],
    faqs: [
      {
        question: "How is this different from sales coaching platforms?",
        answer:
          "Most tools optimize call recording and script adherence. openLesson measures reasoning quality: whether reps adapt when facts change, explain tradeoffs in their own words, and catch AI-generated errors before customers do.",
      },
      {
        question: "Can we model our own sales methodology?",
        answer:
          "Yes. Performance Workspaces are prompt-generated around your methodology, product nuance, and objection library—then broken into assessable blocks you can refine over time.",
      },
      {
        question: "Does openLesson replace our CRM or enablement LMS?",
        answer:
          "No. It adds a readiness verification layer. Use the Agentic API to pipe evidence from your stack or issue evaluation links alongside existing enablement programs.",
      },
    ],
    primaryCta: { label: "Build a sales readiness workspace", href: "/workspace/new" },
    secondaryCta: { label: "View pricing", href: "/pricing" },
    closingTitle: "Prove your reps are ready—not just AI-assisted",
    closingBody: "Create a workspace for your highest-stakes sales motion and measure judgment before it costs pipeline.",
  },
  {
    slug: "customer-success",
    path: "/solutions/customer-success",
    eyebrow: "Customer Success",
    h1: "Client escalation readiness for AI-enabled CS teams",
    intro:
      "When accounts heat up, polished AI summaries are not enough. openLesson helps CS leaders verify that managers can explain tradeoffs, update judgment when facts change, and spot AI failure modes before escalations become churn.",
    metaTitle: "Customer Success Training & Escalation Readiness",
    metaDescription:
      "Verify client escalation readiness with structured practice, evaluation sessions, and gap analysis—beyond AI-generated account plans and QBR decks.",
    keywords: [
      "customer success training",
      "client escalation readiness",
      "CS enablement",
      "account risk assessment",
      "customer success coaching",
      "AI customer success tools",
    ],
    navLabel: "Customer Success",
    navDescription: "Escalations, retention, and account judgment",
    sections: [
      {
        title: "Why CS teams need readiness evidence now",
        paragraphs: [
          "Customer success platforms and AI assistants produce health scores, outreach drafts, and renewal talking points at scale. The bottleneck is no longer document production—it is whether the human on the account can reason through ambiguity when the playbook breaks.",
          "Escalations expose gaps that QBR attendance never surfaced: weak causal reasoning, over-reliance on AI recommendations, and inability to reframe when stakeholder dynamics shift.",
        ],
      },
      {
        title: "Workspaces modeled on your escalation patterns",
        paragraphs: [
          "Create Performance Workspaces from real escalation archetypes: executive sponsor loss, security review surprises, adoption stalls, or competitive bake-offs. Blocks map to demonstrable CS skills—stakeholder mapping, risk quantification, mutual success planning.",
          "CSMs practice in the ILE by walking through decisions aloud, not by re-reading saved AI summaries.",
        ],
      },
      {
        title: "Evaluation before executive-facing moments",
        paragraphs: [
          "Issue Evaluation Environment sessions before promoting CSMs to strategic books or after major product launches. Structured probes reveal depth on product value, customer context, and repair strategies when relationships fray.",
          "Private evaluation links work for distributed teams without scheduling manager shadowing for every readiness check.",
        ],
      },
      {
        title: "Close the loop with performance analysis",
        paragraphs: [
          "Upload tool traces, account plans, and session artifacts via API or manual evidence. Performance analysis returns gap-ranked reports you can attach to coaching plans or promotion packets.",
          "Build a repeatable readiness standard for AI-enabled CS—not a one-off training event.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can managers run readiness checks without live escalations?",
        answer:
          "Yes. Evaluation sessions simulate high-pressure scenarios so you can assess judgment before customers experience gaps.",
      },
      {
        question: "How do CS teams typically start?",
        answer:
          "Most teams begin with one escalation archetype as a workspace, pilot with a pod lead group, then expand blocks as new product or pricing motions launch.",
      },
      {
        question: "Does this integrate with Gainsight or similar tools?",
        answer:
          "Use the Agentic API to upload evidence and run performance analysis alongside your existing CS stack. openLesson focuses on verification, not CRM replacement.",
      },
    ],
    primaryCta: { label: "Create a CS readiness workspace", href: "/workspace/new" },
    secondaryCta: { label: "Platform overview", href: "/platform" },
    closingTitle: "Know who can handle the next escalation",
    closingBody: "Stop assuming AI-assisted account plans mean your team is ready when executives get involved.",
  },
  {
    slug: "compliance-risk",
    path: "/solutions/compliance-risk",
    eyebrow: "Compliance & Risk",
    h1: "Compliance training verification when AI drafts the answers",
    intro:
      "Policy training that checks a box does not prove judgment on exceptions. openLesson helps risk and compliance teams measure whether staff can cite rationale, weigh blast radius, and flag undocumented AI assumptions—before auditors do.",
    metaTitle: "Compliance Training Verification & Risk Readiness",
    metaDescription:
      "Go beyond policy completion with evaluation sessions, readiness evidence, and gap analysis for exception review, regulatory judgment, and AI governance.",
    keywords: [
      "compliance training software",
      "risk readiness assessment",
      "regulatory training verification",
      "AI governance training",
      "compliance LMS integration",
      "audit readiness evidence",
    ],
    navLabel: "Compliance & Risk",
    navDescription: "Exceptions, policy judgment, and audit trails",
    sections: [
      {
        title: "Completion metrics fail under AI pressure",
        paragraphs: [
          "Employees can pass policy quizzes with AI assistance, summarize regulations they have not internalized, and approve exceptions using model-generated rationales that sound plausible but miss blast radius.",
          "Regulators and internal audit teams care about demonstrated judgment—not whether someone clicked through annual training.",
        ],
      },
      {
        title: "Scenario-based workspaces for your control framework",
        paragraphs: [
          "Model Performance Workspaces on real exception types, third-party risk reviews, data handling edge cases, or model governance decisions. Each block requires demonstrable reasoning tied to your policy library.",
          "The ILE captures how staff explain decisions in their own words—critical for firms moving from tick-box compliance to operational resilience.",
        ],
      },
      {
        title: "Auditable evaluation evidence",
        paragraphs: [
          "Evaluation Environment sessions produce structured scores, marker rationales, and gap analysis suitable for audit trails and remediation planning.",
          "Scope evaluation to high-risk roles or processes: approvers, model risk reviewers, or regional compliance leads.",
        ],
      },
      {
        title: "API integration for enterprise learning stacks",
        paragraphs: [
          "Embed readiness verification into existing LMS workflows via the Agentic API. Upload evidence from case management tools, issue evaluation links after module completion, and return JSON gap reports to GRC systems.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is this a replacement for our GRC platform?",
        answer:
          "No. openLesson verifies human judgment and produces readiness evidence. It complements policy management and control testing tools.",
      },
      {
        question: "Can we customize scenarios to our regulatory footprint?",
        answer:
          "Yes. Workspaces are generated from your prompts and refined per jurisdiction, product line, or control domain.",
      },
      {
        question: "What evidence is stored?",
        answer:
          "Session artifacts, evaluation results, uploaded files, and performance reports—scoped to workspaces and blocks you control.",
      },
    ],
    primaryCta: { label: "Start a compliance workspace", href: "/workspace/new" },
    secondaryCta: { label: "Agentic API", href: "/docs/agentic-v2" },
    closingTitle: "Verify judgment—not just policy awareness",
    closingBody: "Build readiness evidence before exceptions land on an examiner's desk.",
  },
  {
    slug: "hiring-assessment",
    path: "/solutions/hiring-assessment",
    eyebrow: "Hiring & Assessment",
    h1: "Hiring assessment that scores genuine thinking—not AI interview assist",
    intro:
      "Real-time AI tools can feed answers during live interviews—making traditional screens untrustworthy. openLesson evaluates genuine human cognition through the Think-Aloud Protocol and Selective Thought Interface: how candidates reason out loud when probed, not what a hidden overlay whispers.",
    metaTitle: "AI Interview Cheating Detection — Think-Aloud Hiring Assessment",
    metaDescription:
      "Stop hiring on AI-fed interview polish. openLesson scores genuine cognition with the Think-Aloud Protocol and Selective Thought Interface—beyond Cluely-style assist tools and memorized frameworks.",
    keywords: [
      "skills based hiring",
      "AI interview cheating",
      "interview assessment software",
      "think aloud protocol hiring",
      "candidate assessment software",
      "reasoning assessment",
      "hiring readiness evaluation",
      "genuine human cognition",
      "work sample assessment",
    ],
    navLabel: "Hiring & Assessment",
    navDescription: "Reasoning evidence for better hires",
    sections: [
      {
        title: "The Cluely problem: interviews that test assist tools, not people",
        paragraphs: [
          "A new class of products markets real-time AI help during live interviews—hidden overlays that suggest answers while the candidate speaks. Traditional screens, LeetCode, and take-homes were already gameable; generative AI and interview-assist tools make confident delivery almost meaningless.",
          "Hiring teams need a signal adversaries cannot paste in: genuine cognition under probe—how candidates explore, revise, explain, and recover when assumptions break.",
        ],
      },
      {
        title: "Think-Aloud Protocol: the anti-cheat layer",
        paragraphs: [
          "openLesson applies the Think-Aloud Protocol—verbalize reasoning while working—and scores the resulting traces. Hesitations, causal links, self-corrections, and repairs under challenge are evidence of real thinking, not rehearsed performance.",
          "The Selective Thought Interface submits thought fragments for Socratic follow-up. Candidates must demonstrate understanding in the moment. That is the most reliable way to measure genuine human thinking when AI cheating tools target your pipeline.",
        ],
      },
      {
        title: "Work samples in Performance Workspaces",
        paragraphs: [
          "Create role-specific workspaces: product prioritization under conflicting data, novel debugging scenarios, strategy cases with political stakeholders, or customer-facing escalation simulations.",
          "Candidates practice and demonstrate in the ILE. Evaluation sessions probe depth with structured follow-ups—not trick questions.",
        ],
      },
      {
        title: "Comparable evidence across candidates",
        paragraphs: [
          "Marker scores and gap analysis give recruiters and hiring managers a shared rubric beyond subjective debriefs. Compare reasoning quality across candidates on the same block, not just final presentation polish.",
          "Issue private evaluation links for async stages to reduce scheduling load on senior interviewers.",
        ],
      },
      {
        title: "Fairer signal for senior and cross-functional roles",
        paragraphs: [
          "Especially valuable for staff-plus engineers, product leaders, and strategy roles where the work is ambiguous and AI-generated templates are ubiquitous.",
          "Use the Agentic API to embed assessment blocks into your existing ATS workflow or internal hiring portal.",
        ],
      },
    ],
    faqs: [
      {
        question: "How is openLesson different from tools like Cluely?",
        answer:
          "Cluely-style tools optimize for feeding answers during live conversations. openLesson optimizes for measuring cognition: think-aloud speech and selective thought fragments under Socratic probe. One helps candidates perform; the other reveals whether they actually understand.",
      },
      {
        question: "How is this different from HackerRank or Codility?",
        answer:
          "Those tools optimize for correct outputs on constrained tasks. openLesson focuses on reasoning traces, adaptation under challenge, and gap analysis across learning markers—not binary pass/fail coding tests that AI can solve silently.",
      },
      {
        question: "Can candidates use AI during assessment?",
        answer:
          "You define the scenario. Evaluation probes whether candidates understand and can defend work—including identifying when AI output is wrong. Think-aloud and selective-thought sessions are specifically designed to score cognition that hidden assist tools cannot supply.",
      },
      {
        question: "Is this suitable for high-volume recruiting?",
        answer:
          "Async evaluation links scale better than panel interviews for early-stage filtering. Senior-stage loops still benefit from structured evidence before on-site investment.",
      },
    ],
    primaryCta: { label: "Prototype a hiring workspace", href: "/workspace/new" },
    secondaryCta: { label: "Talk to us", href: "mailto:daniel@uncertain.systems" },
    closingTitle: "Hire for genuine cognition—not assist-tool polish",
    closingBody: "Score how candidates think out loud when the overlay is gone.",
  },
  {
    slug: "lms-integration",
    path: "/solutions/lms-integration",
    eyebrow: "LMS & EdTech Integration",
    h1: "Embed performance readiness into any LMS or learning platform",
    intro:
      "Canvas, Moodle, corporate academies, and custom edtech products track completion. openLesson's Agentic API adds verified readiness—workspaces, evidence upload, evaluation links, and structured gap reports—without replacing your front end.",
    metaTitle: "LMS Integration API for Learning Verification",
    metaDescription:
      "Integrate performance readiness into Canvas, Moodle, or custom LMS platforms via the Agentic API—workspaces, evidence, evaluation, and gap analysis.",
    keywords: [
      "LMS integration API",
      "edtech API",
      "learning verification API",
      "corporate learning platform",
      "educational technology integration",
      "performance readiness API",
    ],
    navLabel: "LMS Integration",
    navDescription: "Agentic API for edtech builders",
    sections: [
      {
        title: "Completion is not competency",
        paragraphs: [
          "LMS dashboards show enrollments, video watch time, and quiz passes. They rarely answer whether a learner can perform under real constraints—especially when AI tools sit between the learner and the task.",
          "Platforms that differentiate on outcomes need a readiness layer they can call via API.",
        ],
      },
      {
        title: "Agentic API v2 surface area",
        paragraphs: [
          "Create Performance Workspaces from prompts, list assessable blocks, upload evidence (tool traces, screenshots, video, EEG), run structured performance reports or chat analysis, issue private evaluation links, and poll completion results.",
          "Designed for agents, automation, and product backends—not cookie-based browser sessions.",
        ],
      },
      {
        title: "Guest provisioning for external learners",
        paragraphs: [
          "Organization admins mint guest API keys for learners without full accounts. Guests create workspaces, run evaluation sessions, and return results to your platform via webhooks or polling patterns you control.",
          "Ideal for customer education portals, partner academies, and certification prep products.",
        ],
      },
      {
        title: "Keep your UX, add verification depth",
        paragraphs: [
          "Embed readiness checks at module boundaries, capstone projects, or certification gates. Return gap analysis JSON to your gradebook, coach dashboard, or recommendation engine.",
          "MCP transport is also available for agent-native integrations.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do we replace our LMS?",
        answer:
          "No. openLesson is a readiness and verification backend. Your LMS remains the learner-facing experience.",
      },
      {
        question: "What authentication does the API use?",
        answer:
          "Bearer API keys (sk_ for members, gsk_ for guests) with scoped permissions. See the Agentic API reference for full endpoint specs.",
      },
      {
        question: "Can we white-label evaluation sessions?",
        answer:
          "Evaluation links use bearer URLs on your domain path. Learners complete sessions without OpenLesson accounts when using private links.",
      },
    ],
    primaryCta: { label: "Read API docs", href: "/docs/agentic-v2" },
    secondaryCta: { label: "Teams pricing", href: "/pricing" },
    closingTitle: "Add readiness verification to your product",
    closingBody: "Ship competency evidence—not just completion badges.",
  },
  {
    slug: "engineering-oncall",
    path: "/solutions/engineering-oncall",
    eyebrow: "Engineering & On-Call",
    h1: "Incident response readiness when AI suggests the first move",
    intro:
      "Runbooks and AI copilots accelerate triage—but outages punish guesswork. openLesson helps engineering leaders verify that on-call engineers can narrow root cause, prioritize customer impact, and explain rollback tradeoffs before production teaches the lesson.",
    metaTitle: "Incident Response Training & On-Call Readiness",
    metaDescription:
      "Measure incident triage judgment and on-call readiness with ILE practice, evaluation sessions, and gap analysis—not runbook quizzes alone.",
    keywords: [
      "incident response training",
      "on-call readiness",
      "SRE training platform",
      "engineering judgment assessment",
      "AI runbook training",
      "production readiness learning",
    ],
    navLabel: "Engineering & On-Call",
    navDescription: "Incident triage and production judgment",
    sections: [
      {
        title: "Runbooks do not equal judgment",
        paragraphs: [
          "Engineers can follow AI-generated remediation steps without understanding blast radius, dependency chains, or when the model's first suggestion is wrong. Incidents are where that gap becomes expensive.",
          "Traditional training—lunch talks, postmortem readouts, certification courses—rarely tests live reasoning under incomplete telemetry.",
        ],
      },
      {
        title: "Simulate your failure modes",
        paragraphs: [
          "Build workspaces from past incidents, near-misses, or hypothesized failures: cascading latency, partial deploys, auth outages, data pipeline skew. Blocks target demonstrable skills—hypothesis formation, customer impact framing, rollback decisions.",
          "Engineers practice in the ILE by narrating triage logic, not by memorizing playbooks.",
        ],
      },
      {
        title: "Evaluate before expanding on-call scope",
        paragraphs: [
          "Use Evaluation Environment sessions as a gate before new hires take primary pager, before promoting to incident commander, or after major architecture changes.",
          "Gap analysis highlights weak causal links—exactly what postmortems surface too late.",
        ],
      },
      {
        title: "Evidence for staff engineering and SRE ladders",
        paragraphs: [
          "Performance reports document reasoning quality over time—useful for promotion cases, rotation planning, and identifying which teams need simulation drills versus tooling investment.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can we import real incident timelines?",
        answer:
          "Yes. Use workspace prompts and evidence upload to ground practice in anonymized production scenarios.",
      },
      {
        question: "Does this replace fire drills?",
        answer:
          "It complements them. openLesson scales judgment assessment between game days without staging full outages.",
      },
      {
        question: "Is this only for SRE teams?",
        answer:
          "Any role with high-stakes operational decisions benefits—platform engineering, database owners, security responders, and support escalations included.",
      },
    ],
    primaryCta: { label: "Build an on-call workspace", href: "/workspace/new" },
    secondaryCta: { label: "Platform overview", href: "/platform" },
    closingTitle: "Train judgment before the pager fires",
    closingBody: "Know who can triage—not just who has read the runbook.",
  },
  {
    slug: "corporate-learning",
    path: "/solutions/corporate-learning",
    eyebrow: "Corporate L&D",
    h1: "Corporate learning that measures readiness—not seat time",
    intro:
      "L&D teams are asked to prove ROI while AI makes every course easier to finish without learning. openLesson gives corporate academies structured workspaces, practice environments, and evaluation evidence that leaders can trust for role readiness.",
    metaTitle: "Corporate L&D & Workforce Readiness Platform",
    metaDescription:
      "Replace vanity completion metrics with performance readiness evidence for corporate learning, workforce development, and AI upskilling programs.",
    keywords: [
      "corporate learning platform",
      "workforce readiness",
      "L&D analytics",
      "employee upskilling AI",
      "corporate training verification",
      "learning and development software",
    ],
    navLabel: "Corporate L&D",
    navDescription: "Workforce readiness beyond completion",
    sections: [
      {
        title: "The executive question L&D cannot answer with LMS reports",
        paragraphs: [
          "Leadership asks: are we ready for the next product launch, regulatory change, or AI workflow shift? Completion dashboards answer a different question—who clicked through content.",
          "openLesson connects learning investment to demonstrable judgment on the scenarios that matter to the business.",
        ],
      },
      {
        title: "Academies built around business scenarios",
        paragraphs: [
          "Launch Performance Workspaces for role families: frontline managers, solutions consultants, analysts, operators. Blocks align to capabilities in your competency model—not generic course catalogs.",
          "Learners practice in the ILE and accumulate evidence as they progress through pathways you define.",
        ],
      },
      {
        title: "Manager-friendly evaluation summaries",
        paragraphs: [
          "Evaluation sessions produce gap analysis managers can use in 1:1s: specific repairs, severity-ranked risks, and suggested practice—not opaque scores.",
          "Scale coaching with async evaluation links instead of manager shadowing alone.",
        ],
      },
      {
        title: "Integrate with your existing stack",
        paragraphs: [
          "Use the Agentic API to trigger readiness checks from your LMS, HRIS learning modules, or internal portals. Guest keys support contractors, partners, and acquired teams without full enterprise accounts.",
        ],
      },
    ],
    faqs: [
      {
        question: "How does this fit with our existing LMS?",
        answer:
          "openLesson adds a verification layer. Many teams keep their LMS for content delivery and use openLesson for capstone readiness and role gates.",
      },
      {
        question: "Can we measure AI upskilling programs?",
        answer:
          "Yes. Workspaces can target AI literacy, prompt judgment, and human-in-the-loop review skills—exactly where completion-based training fails.",
      },
      {
        question: "What does Teams pricing include?",
        answer:
          "See the pricing page for workspace volume, API access, and organization features. Evaluation and ILE usage scales with blocks you assign.",
      },
    ],
    primaryCta: { label: "Start a corporate workspace", href: "/workspace/new" },
    secondaryCta: { label: "View pricing", href: "/pricing" },
    closingTitle: "Give L&D evidence executives trust",
    closingBody: "Measure readiness on the decisions that affect the P&L—not slide views.",
  },
];

export const SOLUTION_SLUGS = SOLUTION_PAGES.map((page) => page.slug);

export function getSolutionPage(slug: string): SeoSolutionPageConfig | undefined {
  return SOLUTION_PAGES.find((page) => page.slug === slug);
}

export function solutionMetadata(page: SeoSolutionPageConfig): Metadata {
  const url = `${BASE_URL}${page.path}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url,
      siteName: "openLesson",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
      creator: "@uncertainsys",
    },
    alternates: {
      canonical: url,
    },
  };
}

export { DEFAULT_BACKGROUND, BASE_URL };