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
  h1: "Learning verification for humans and agents",
  intro:
    "openLesson is built on Verification Workspaces you create and enrich programmatically, with documents, tool traces, screen shares, video assets, and any evidence from humans or agents. Four products sit on top: Evidence API for verification, Think Aloud Protocol and the Integrated Learning Environment for human learning, and the upcoming Agentic Learning Environment for skill developers.",
  metaTitle: "Platform: Learning Verification for Humans & Agents",
  metaDescription:
    "Beyond benchmarks for AI and beyond quizzes for humans. Evidence API, Think Aloud Protocol, ILE, and Agentic Learning Environment on Verification Workspaces.",
  keywords: [
    "verification workspace",
    "learning verification",
    "agentic learning verification",
    "evidence API",
    "think aloud protocol",
    "integrated learning environment",
    "agentic learning environment",
    "AI skill assessment",
    "genuine human cognition",
    "LMS integration API",
    "skills gap analysis",
  ],
  navLabel: "Platform",
  navDescription: "Workspaces, verification, learning, and ALE",
  sections: [
    {
      title: "The problem: outputs look ready before learning is verified",
      paragraphs: [
        "Humans finish training without learning how to use tools. Agents pass benchmark suites without reliable production tool use. Real-time assist and copilots make both problems worse: polished outputs with shallow understanding underneath.",
        "Quizzes and leaderboard accuracy were never reliable proxies for learning. openLesson verifies readiness with evidence, then helps humans close gaps in the ILE, and gives teams deploy gates for agents.",
      ],
    },
    {
      title: "Verification Workspaces: the foundation",
      paragraphs: [
        "Every openLesson product runs on a Verification Workspace, a structured environment around a real skill, decision domain, or scenario. Workspaces break work into assessable blocks linked in a learning graph.",
        "Create and enhance workspaces programmatically via the Agentic API v2. Ingest documents, screen recordings, video assets, EEG traces, transcripts, and other unstructured evidence. The workspace accumulates context as new artifacts arrive, fueling continuous scoring across all four products.",
      ],
    },
    {
      title: "Product 1: Evidence API: human and agentic verification",
      paragraphs: [
        "The Evidence API is openLesson's headless learning verification product, for humans and agents. Send unstructured evidence, tool traces, documents, call transcripts, screen captures, and receive continuous readiness scores with gap analysis. No hosted session required.",
        "For agents: verify skills and tool use before production deployment, beyond benchmark pass rates. For humans: confirm they learned how to use a workflow or tool, not just completed a module. Integrate into LMS, HRIS, CI gates, or any agentic pipeline.",
      ],
    },
    {
      title: "Product 2: Think Aloud Protocol: human verification",
      paragraphs: [
        "Think Aloud Protocol (TAP) is openLesson's hosted human learning verification product. Generate shareable URLs scoped to a block or entire workspace. Humans verbalize reasoning while working: the signal hidden AI overlays cannot fabricate.",
        "Live speech is transcribed into think-aloud traces. Socratic probes target hesitations, revisions, and causal chains. Results include marker scores, per-marker rationale, and auditable gap reports.",
      ],
    },
    {
      title: "Product 3: Integrated Learning Environment (ILE)",
      paragraphs: [
        "The ILE is where humans improve. Gap findings from either verification product route into guided practice: think-aloud sessions, Socratic follow-ups, and targeted blocks until scores move.",
        "The ILE is not a pass/fail checker. It is the improvement layer. Humans practice real scenarios, build judgment that complements AI tools, and produce evidence of progress along the way.",
      ],
    },
    {
      title: "Product 4: Agentic Learning Environment (ALE): coming soon",
      paragraphs: [
        "The Agentic Learning Environment (ALE) is where skill developers test and evolve agent skills. Run agents against workspace scenarios, inspect tool-use traces, and iterate on skill definitions until Evidence API scores clear your deploy bar.",
        "ALE mirrors the ILE's improvement loop for the agentic side: verification surfaces gaps in tool use and reasoning; developers refine skills in a sandbox until readiness evidence supports production.",
      ],
    },
    {
      title: "The verify-and-improve loop",
      paragraphs: [
        "Choose Evidence API when you have artifacts or tool traces, for humans or agents. Choose Think Aloud Protocol URLs when you need live human cognition under probe. Use the ILE when human gaps need to close. Use ALE, when available, to evolve agent skills against the same workspace context.",
        "All products share the same workspace, scoring model, and gap analysis. Verification surfaces weak spots; ILE and ALE repair them, with auditable evidence at every step.",
      ],
    },
    {
      title: "Agentic API v2: programmatic access to everything",
      paragraphs: [
        "The Agentic API v2 is how builders integrate the product stack. Create workspaces, upload evidence, request continuous performance reports, issue Think Aloud Protocol links, poll session results, and trigger ILE practice blocks.",
        "Connect openLesson's learning verification layer to Canvas, Moodle, internal academies, hiring stacks, CI pipelines, or any system that needs human and agentic readiness evidence.",
      ],
    },
  ],
  faqs: [
    {
      question: "What is a Verification Workspace?",
      answer:
        "A Verification Workspace is the foundation every openLesson product runs on. It structures a skill or scenario into assessable blocks and accumulates evidence, documents, screen shares, video, EEG data, transcripts, and session artifacts, that fuels continuous scoring and gap analysis.",
    },
    {
      question: "What are the openLesson products?",
      answer:
        "Evidence API (headless verification for humans and agents), Think Aloud Protocol (hosted URLs for live human cognition), the Integrated Learning Environment (ILE) for human guided practice, and the upcoming Agentic Learning Environment (ALE) where skill developers test and evolve agent skills.",
    },
    {
      question: "When should I use the Evidence API vs. Think Aloud Protocol?",
      answer:
        "Use the Evidence API when you have artifacts or tool traces and want continuous scoring without a hosted session, ideal for agent deploy gates, LMS integrations, and verifying human tool adoption. Use Think Aloud Protocol URLs when you need live human cognition under probe, such as hiring assessments or high-stakes readiness checks.",
    },
    {
      question: "What is the Integrated Learning Environment (ILE)?",
      answer:
        "The ILE is openLesson's human learning product. It turns gap findings from verification into targeted practice, think-aloud sessions, Socratic probes, and scenario blocks, so humans improve their scores with evidence at every step.",
    },
    {
      question: "What is the Agentic Learning Environment (ALE)?",
      answer:
        "ALE is an upcoming openLesson product for skill developers. It provides a sandbox to run agents against workspace scenarios, compare skill versions, and iterate on definitions until Evidence API scores support production deployment.",
    },
    {
      question: "How does openLesson address AI cheating?",
      answer:
        "Polished output is easy to fake with AI assist tools. openLesson scores genuine cognition, either from accumulated evidence artifacts or from live think-aloud reasoning under Socratic probe. That signal is far harder to manufacture than a generated deliverable.",
    },
    {
      question: "What evidence can I add to a workspace?",
      answer:
        "Documents, screen recordings, video assets, EEG traces, call transcripts, tool traces, and any human-generated data. Workspaces are enriched programmatically via the Agentic API v2 or through manual upload.",
    },
    {
      question: "Can I integrate openLesson with my existing LMS?",
      answer:
        "Yes. The Agentic API v2 lets agents and platforms create workspaces, pipe evidence, run continuous performance analysis, issue Think Aloud Protocol links, and trigger ILE practice, without replacing your LMS front end.",
    },
    {
      question: "Who is openLesson for?",
      answer:
        "Teams gating agent deployments, L&D leaders verifying human tool adoption, hiring orgs scoring live cognition, and builders embedding learning verification for humans and agents via API.",
    },
  ],
  primaryCta: { label: "Create a Verification Workspace", href: "/workspace/new" },
  secondaryCta: { label: "Agentic API docs", href: "/docs/agentic-v2" },
  closingTitle: "Start with a workspace. Verify humans, agents, or both.",
  closingBody:
    "Create your first Verification Workspace free, then verify with Evidence API, Think Aloud Protocol, or both, and help humans improve in the ILE.",
};

export const SOLUTION_PAGES: SeoSolutionPageConfig[] = [
  {
    slug: "sales-enablement",
    path: "/solutions/sales-enablement",
    eyebrow: "Sales Enablement",
    h1: "AI sales training that proves discovery judgment, not script recall",
    intro:
      "Your reps have AI drafts for talk tracks, ROI decks, and renewal emails. openLesson measures whether they can qualify pain, challenge assumptions, and defend tradeoffs when the buyer pushes back, before revenue is on the line.",
    metaTitle: "AI Sales Training & Readiness Verification",
    metaDescription:
      "Measure sales discovery judgment and renewal readiness with Verification Workspaces, ILE practice, and Think Aloud Protocol sessions, not completion rates on enablement videos.",
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
          "AI copilots generate polished outreach, call summaries, and business cases in seconds. Reps look prepared in role-plays and LMS modules, but that output can mask shallow product understanding and weak discovery instincts.",
          "Managers see activity and completion, not whether someone will freeze when procurement reframes the deal or when an AI-drafted ROI table contains a fatal assumption.",
        ],
      },
      {
        title: "Practice real scenarios in the ILE",
        paragraphs: [
          "Build a Verification Workspace around your ICP, competitive landscape, and renewal motion. Reps practice by explaining decisions out loud in the Immersive Learning Environment: how they qualify pain, when they challenge the buyer's narrative, and how they revise strategy when new facts appear.",
          "Each block targets a demonstrable skill, multi-threading, objection handling, value framing, not a slide deck to memorize.",
        ],
      },
      {
        title: "Evaluate before live customer exposure",
        paragraphs: [
          "Run Think Aloud Protocol sessions scoped to high-risk blocks: enterprise renewal negotiations, technical validation calls, or competitive displacement scenarios. Results include marker scores, gap analysis, and specific practice recommendations.",
          "Use evaluation links for onboarding gates, promotion readiness, or manager checkpoints before assigning strategic accounts.",
        ],
      },
      {
        title: "Evidence leaders can act on",
        paragraphs: [
          "Performance reports synthesize ILE traces, evaluation results, and uploaded artifacts (CRM notes, call prep, demo scripts) into strengths, growth areas, and severity-ranked gaps.",
          "Move from subjective ride-alongs to structured readiness evidence, especially for teams scaling AI-assisted selling without scaling risk.",
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
          "Yes. Verification Workspaces are prompt-generated around your methodology, product nuance, and objection library, then broken into assessable blocks you can refine over time.",
      },
      {
        question: "Does openLesson replace our CRM or enablement LMS?",
        answer:
          "No. It adds a readiness verification layer. Use the Agentic API to pipe evidence from your stack or issue evaluation links alongside existing enablement programs.",
      },
    ],
    primaryCta: { label: "Build a sales readiness workspace", href: "/workspace/new" },
    secondaryCta: { label: "View pricing", href: "/pricing" },
    closingTitle: "Prove your reps are ready, not just AI-assisted",
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
      "Verify client escalation readiness with structured practice, Think Aloud Protocol sessions, and gap analysis, beyond AI-generated account plans and QBR decks.",
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
          "Customer success platforms and AI assistants produce health scores, outreach drafts, and renewal talking points at scale. The bottleneck is no longer document production. It is whether the human on the account can reason through ambiguity when the playbook breaks.",
          "Escalations expose gaps that QBR attendance never surfaced: weak causal reasoning, over-reliance on AI recommendations, and inability to reframe when stakeholder dynamics shift.",
        ],
      },
      {
        title: "Workspaces modeled on your escalation patterns",
        paragraphs: [
          "Create Verification Workspaces from real escalation archetypes: executive sponsor loss, security review surprises, adoption stalls, or competitive bake-offs. Blocks map to demonstrable CS skills, stakeholder mapping, risk quantification, mutual success planning.",
          "CSMs practice in the ILE by walking through decisions aloud, not by re-reading saved AI summaries.",
        ],
      },
      {
        title: "Evaluation before executive-facing moments",
        paragraphs: [
          "Issue Think Aloud Protocol sessions before promoting CSMs to strategic books or after major product launches. Structured probes reveal depth on product value, customer context, and repair strategies when relationships fray.",
          "Private evaluation links work for distributed teams without scheduling manager shadowing for every readiness check.",
        ],
      },
      {
        title: "Close the loop with performance analysis",
        paragraphs: [
          "Upload tool traces, account plans, and session artifacts via API or manual evidence. Performance analysis returns gap-ranked reports you can attach to coaching plans or promotion packets.",
          "Build a repeatable readiness standard for AI-enabled CS, not a one-off training event.",
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
      "Policy training that checks a box does not prove judgment on exceptions. openLesson helps risk and compliance teams measure whether staff can cite rationale, weigh blast radius, and flag undocumented AI assumptions, before auditors do.",
    metaTitle: "Compliance Training Verification & Risk Readiness",
    metaDescription:
      "Go beyond policy completion with Think Aloud Protocol sessions, readiness evidence, and gap analysis for exception review, regulatory judgment, and AI governance.",
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
          "Regulators and internal audit teams care about demonstrated judgment, not whether someone clicked through annual training.",
        ],
      },
      {
        title: "Scenario-based workspaces for your control framework",
        paragraphs: [
          "Model Verification Workspaces on real exception types, third-party risk reviews, data handling edge cases, or model governance decisions. Each block requires demonstrable reasoning tied to your policy library.",
          "The ILE captures how staff explain decisions in their own words, critical for firms moving from tick-box compliance to operational resilience.",
        ],
      },
      {
        title: "Auditable evaluation evidence",
        paragraphs: [
          "Think Aloud Protocol sessions produce structured scores, marker rationales, and gap analysis suitable for audit trails and remediation planning.",
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
          "Session artifacts, evaluation results, uploaded files, and performance reports, scoped to workspaces and blocks you control.",
      },
    ],
    primaryCta: { label: "Start a compliance workspace", href: "/workspace/new" },
    secondaryCta: { label: "Agentic API", href: "/docs/agentic-v2" },
    closingTitle: "Verify judgment, not just policy awareness",
    closingBody: "Build readiness evidence before exceptions land on an examiner's desk.",
  },
  {
    slug: "hiring-assessment",
    path: "/solutions/hiring-assessment",
    eyebrow: "Hiring & Assessment",
    h1: "Hiring assessment that scores genuine thinking, not AI interview assist",
    intro:
      "Real-time AI tools can feed answers during live interviews, making traditional screens untrustworthy. openLesson evaluates genuine human cognition through the Think-Aloud Protocol and Selective Thought Interface: how candidates reason out loud when probed, not what a hidden overlay whispers.",
    metaTitle: "AI Interview Cheating Detection: Think-Aloud Hiring Assessment",
    metaDescription:
      "Stop hiring on AI-fed interview polish. openLesson scores genuine cognition with the Think-Aloud Protocol and Selective Thought Interface, beyond Cluely-style assist tools and memorized frameworks.",
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
          "A new class of products markets real-time AI help during live interviews, hidden overlays that suggest answers while the candidate speaks. Traditional screens, LeetCode, and take-homes were already gameable; generative AI and interview-assist tools make confident delivery almost meaningless.",
          "Hiring teams need a signal adversaries cannot paste in: genuine cognition under probe, how candidates explore, revise, explain, and recover when assumptions break.",
        ],
      },
      {
        title: "Think-Aloud Protocol: the anti-cheat layer",
        paragraphs: [
          "openLesson applies the Think-Aloud Protocol, verbalize reasoning while working, and scores the resulting traces. Hesitations, causal links, self-corrections, and repairs under challenge are evidence of real thinking, not rehearsed performance.",
          "The Selective Thought Interface submits thought fragments for Socratic follow-up. Candidates must demonstrate understanding in the moment. That is the most reliable way to measure genuine human thinking when AI cheating tools target your pipeline.",
        ],
      },
      {
        title: "Work samples in Verification Workspaces",
        paragraphs: [
          "Create role-specific workspaces: product prioritization under conflicting data, novel debugging scenarios, strategy cases with political stakeholders, or customer-facing escalation simulations.",
          "Candidates practice and demonstrate in the ILE. Evaluation sessions probe depth with structured follow-ups, not trick questions.",
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
          "Those tools optimize for correct outputs on constrained tasks. openLesson focuses on reasoning traces, adaptation under challenge, and gap analysis across learning markers, not binary pass/fail coding tests that AI can solve silently.",
      },
      {
        question: "Can candidates use AI during assessment?",
        answer:
          "You define the scenario. Evaluation probes whether candidates understand and can defend work, including identifying when AI output is wrong. Think-aloud and selective-thought sessions are specifically designed to score cognition that hidden assist tools cannot supply.",
      },
      {
        question: "Is this suitable for high-volume recruiting?",
        answer:
          "Async evaluation links scale better than panel interviews for early-stage filtering. Senior-stage loops still benefit from structured evidence before on-site investment.",
      },
    ],
    primaryCta: { label: "Prototype a hiring workspace", href: "/workspace/new" },
    secondaryCta: { label: "Talk to us", href: "mailto:daniel@uncertain.systems" },
    closingTitle: "Hire for genuine cognition, not assist-tool polish",
    closingBody: "Score how candidates think out loud when the overlay is gone.",
  },
  {
    slug: "lms-integration",
    path: "/solutions/lms-integration",
    eyebrow: "LMS & EdTech Integration",
    h1: "Embed performance readiness into any LMS or learning platform",
    intro:
      "Canvas, Moodle, corporate academies, and custom edtech products track completion. openLesson's Agentic API adds verified readiness, workspaces, evidence upload, evaluation links, and structured gap reports, without replacing your front end.",
    metaTitle: "LMS Integration API for Learning Verification",
    metaDescription:
      "Integrate performance readiness into Canvas, Moodle, or custom LMS platforms via the Agentic API, workspaces, evidence, evaluation, and gap analysis.",
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
          "LMS dashboards show enrollments, video watch time, and quiz passes. They rarely answer whether a learner can perform under real constraints, especially when AI tools sit between the learner and the task.",
          "Platforms that differentiate on outcomes need a readiness layer they can call via API.",
        ],
      },
      {
        title: "Agentic API v2 surface area",
        paragraphs: [
          "Create Verification Workspaces from prompts, list assessable blocks, upload evidence (tool traces, screenshots, video, EEG), run structured performance reports or chat analysis, issue private evaluation links, and poll completion results.",
          "Designed for agents, automation, and product backends, not cookie-based browser sessions.",
        ],
      },
      {
        title: "Guest provisioning for external learners",
        paragraphs: [
          "Organization admins mint guest API keys for learners without full accounts. Guests create workspaces, run Think Aloud Protocol sessions, and return results to your platform via webhooks or polling patterns you control.",
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
        question: "Can we white-label Think Aloud Protocol sessions?",
        answer:
          "Evaluation links use bearer URLs on your domain path. Learners complete sessions without OpenLesson accounts when using private links.",
      },
    ],
    primaryCta: { label: "Read API docs", href: "/docs/agentic-v2" },
    secondaryCta: { label: "Teams pricing", href: "/pricing" },
    closingTitle: "Add readiness verification to your product",
    closingBody: "Ship competency evidence, not just completion badges.",
  },
  {
    slug: "engineering-oncall",
    path: "/solutions/engineering-oncall",
    eyebrow: "Engineering & On-Call",
    h1: "Incident response readiness when AI suggests the first move",
    intro:
      "Runbooks and AI copilots accelerate triage, but outages punish guesswork. openLesson helps engineering leaders verify that on-call engineers can narrow root cause, prioritize customer impact, and explain rollback tradeoffs before production teaches the lesson.",
    metaTitle: "Incident Response Training & On-Call Readiness",
    metaDescription:
      "Measure incident triage judgment and on-call readiness with ILE practice, Think Aloud Protocol sessions, and gap analysis, not runbook quizzes alone.",
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
          "Traditional training, lunch talks, postmortem readouts, certification courses, rarely tests live reasoning under incomplete telemetry.",
        ],
      },
      {
        title: "Simulate your failure modes",
        paragraphs: [
          "Build workspaces from past incidents, near-misses, or hypothesized failures: cascading latency, partial deploys, auth outages, data pipeline skew. Blocks target demonstrable skills, hypothesis formation, customer impact framing, rollback decisions.",
          "Engineers practice in the ILE by narrating triage logic, not by memorizing playbooks.",
        ],
      },
      {
        title: "Evaluate before expanding on-call scope",
        paragraphs: [
          "Use Think Aloud Protocol sessions as a gate before new hires take primary pager, before promoting to incident commander, or after major architecture changes.",
          "Gap analysis highlights weak causal links, exactly what postmortems surface too late.",
        ],
      },
      {
        title: "Evidence for staff engineering and SRE ladders",
        paragraphs: [
          "Performance reports document reasoning quality over time, useful for promotion cases, rotation planning, and identifying which teams need simulation drills versus tooling investment.",
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
          "Any role with high-stakes operational decisions benefits, platform engineering, database owners, security responders, and support escalations included.",
      },
    ],
    primaryCta: { label: "Build an on-call workspace", href: "/workspace/new" },
    secondaryCta: { label: "Platform overview", href: "/platform" },
    closingTitle: "Train judgment before the pager fires",
    closingBody: "Know who can triage, not just who has read the runbook.",
  },
  {
    slug: "corporate-learning",
    path: "/solutions/corporate-learning",
    eyebrow: "Corporate L&D",
    h1: "Corporate learning that measures readiness, not seat time",
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
          "Leadership asks: are we ready for the next product launch, regulatory change, or AI workflow shift? Completion dashboards answer a different question: who clicked through content.",
          "openLesson connects learning investment to demonstrable judgment on the scenarios that matter to the business.",
        ],
      },
      {
        title: "Academies built around business scenarios",
        paragraphs: [
          "Launch Verification Workspaces for role families: frontline managers, solutions consultants, analysts, operators. Blocks align to capabilities in your competency model, not generic course catalogs.",
          "Learners practice in the ILE and accumulate evidence as they progress through pathways you define.",
        ],
      },
      {
        title: "Manager-friendly evaluation summaries",
        paragraphs: [
          "Evaluation sessions produce gap analysis managers can use in 1:1s: specific repairs, severity-ranked risks, and suggested practice, not opaque scores.",
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
          "Yes. Workspaces can target AI literacy, prompt judgment, and human-in-the-loop review skills, exactly where completion-based training fails.",
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
    closingBody: "Measure readiness on the decisions that affect the P&L, not slide views.",
  },
  {
    slug: "saas-product-learning",
    path: "/solutions/saas-product-learning",
    eyebrow: "SaaS Product",
    h1: "Measure learning-to-conversion, not tutorial completion",
    intro:
      "Your users finish onboarding checklists and watch walkthroughs, but still churn before they reach activation, expansion, or paid conversion. openLesson helps SaaS product teams verify that users actually learned how to use your product, then connect that evidence to the conversion outcomes you care about.",
    metaTitle: "SaaS Learning-to-Conversion Verification",
    metaDescription:
      "Verify product learning drives activation and conversion, not tooltip completion. Evidence API, Think Aloud Protocol, and ILE for SaaS onboarding, adoption, and customer education teams.",
    keywords: [
      "learning to conversion",
      "SaaS product onboarding",
      "product-led growth learning",
      "user activation verification",
      "in-app onboarding analytics",
      "customer education SaaS",
      "product adoption measurement",
      "SaaS conversion optimization",
    ],
    navLabel: "SaaS Product",
    navDescription: "Learning-to-conversion for PLG teams",
    sections: [
      {
        title: "Completion is not conversion",
        paragraphs: [
          "Product analytics show tours completed, videos watched, and help articles opened. They rarely show whether a user can configure the workflow, recover from errors, or make the decision that leads to upgrade, especially when AI copilots and templates make every screen look successful.",
          "Learning-to-conversion breaks when you measure clicks instead of capability. Users who never learned the product do not activate, expand, or retain, no matter how polished your onboarding UX.",
        ],
      },
      {
        title: "Verify learning on the workflows that drive revenue",
        paragraphs: [
          "Build Verification Workspaces around your activation path: first project setup, integration connect, team invite, billing upgrade, or the aha moment your growth model depends on. Each block targets a demonstrable skill, not a tooltip sequence.",
          "Pipe in-app evidence, screen captures, session replays, support transcripts, tool traces, via the Evidence API. Score whether users learned the workflow, not whether they saw the modal.",
        ],
      },
      {
        title: "High-touch segments: live cognition under probe",
        paragraphs: [
          "For enterprise trials, solutions consultants, or strategic accounts, issue Think Aloud Protocol sessions on high-stakes setup flows. Hear users explain configuration tradeoffs, integration choices, and upgrade rationale in their own words: the signal a 100% onboarding checklist cannot provide.",
          "Gap analysis routes struggling users into the ILE for targeted practice on the exact blocks where scores fall short, before they abandon trial or downgrade.",
        ],
      },
      {
        title: "Connect verification evidence to conversion KPIs",
        paragraphs: [
          "Readiness scores and gap reports become leading indicators for activation rate, trial-to-paid conversion, expansion revenue, and support ticket volume. Product, growth, and customer education teams share one evidence layer instead of arguing over funnel drop-off alone.",
          "Embed checks via the Agentic API at onboarding gates, certification milestones, or pre-upgrade moments, return structured gap JSON to your product analytics stack, CRM, or customer success platform.",
        ],
      },
      {
        title: "Customer education and in-product academies",
        paragraphs: [
          "SaaS companies ship academies, certification paths, and partner enablement portals that track completion. openLesson adds verification: did the learner actually absorb how to use the feature in production, not just pass a quiz generated from your docs?",
          "Guest API keys let external users, partners, and trial accounts complete verification flows without full OpenLesson accounts, ideal for embedded education products.",
        ],
      },
    ],
    faqs: [
      {
        question: "How is this different from product analytics or Pendo-style guides?",
        answer:
          "Analytics and in-app guides measure exposure and completion. openLesson measures learning verification, whether users can explain decisions, recover from errors, and execute workflows with evidence-backed readiness scores and gap analysis.",
      },
      {
        question: "Can we tie readiness scores to activation and conversion?",
        answer:
          "Yes. Export verification results via API and correlate readiness markers with your activation events, trial conversion, expansion milestones, or support escalations. Learning-to-conversion becomes measurable, not inferred from funnel position alone.",
      },
      {
        question: "Do users need to leave our product?",
        answer:
          "Evidence API accepts artifacts you already capture, session replays, screenshots, transcripts, tool traces. Think Aloud Protocol links can be issued at high-touch moments. Your product remains the primary experience; openLesson is the verification layer.",
      },
      {
        question: "Who owns this inside a SaaS company?",
        answer:
          "Common owners include product growth, onboarding PMs, customer education, solutions engineering, and customer success, for any team accountable for activation, adoption, and conversion beyond vanity onboarding metrics.",
      },
    ],
    primaryCta: { label: "Build an onboarding workspace", href: "/workspace/new" },
    secondaryCta: { label: "Agentic API docs", href: "/docs/agentic-v2" },
    closingTitle: "Stop guessing why users do not convert",
    closingBody:
      "Verify they learned the product first, then watch activation and conversion move with evidence, not hope.",
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