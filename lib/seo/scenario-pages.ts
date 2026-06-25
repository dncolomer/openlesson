import type { Metadata } from "next";
import type { SeoSolutionPageConfig } from "./solution-pages";
import { BASE_URL, getSolutionPage, solutionMetadata } from "./solution-pages";

export type SeoScenarioPageConfig = SeoSolutionPageConfig & {
  verticalSlug: string;
};

type ScenarioInput = Omit<SeoSolutionPageConfig, "slug" | "path" | "eyebrow"> & {
  slug: string;
  verticalSlug: string;
  eyebrow?: string;
};

function buildScenario(input: ScenarioInput): SeoScenarioPageConfig {
  const { verticalSlug, slug, eyebrow: eyebrowOverride, ...rest } = input;
  const vertical = getSolutionPage(verticalSlug);
  return {
    ...rest,
    slug,
    verticalSlug,
    path: `/solutions/${verticalSlug}/${slug}`,
    eyebrow: eyebrowOverride ?? (vertical ? `${vertical.eyebrow} · Scenario` : "Readiness Scenario"),
    secondaryCta: rest.secondaryCta ?? {
      label: `All ${vertical?.navLabel ?? "solutions"}`,
      href: `/solutions/${verticalSlug}`,
    },
  };
}

export const SCENARIO_PAGES: SeoScenarioPageConfig[] = [
  // ── Customer Success (5) ──────────────────────────────────────────
  buildScenario({
    verticalSlug: "customer-success",
    slug: "client-escalation-readiness",
    h1: "Client escalation readiness assessment for AI-enabled CS teams",
    intro:
      "When an enterprise account heats up, AI-generated account plans and QBR summaries are not proof your CSM can reason through tradeoffs under pressure. Measure escalation readiness before executives get involved.",
    metaTitle: "Client Escalation Readiness Assessment",
    metaDescription:
      "Verify customer success escalation judgment with Performance Workspaces, ILE practice, and evaluation sessions—not AI-polished account plans.",
    keywords: [
      "client escalation training",
      "customer success readiness",
      "CS escalation assessment",
      "account risk readiness",
      "AI customer success coaching",
    ],
    navLabel: "Client escalation readiness",
    navDescription: "Verify CS judgment before executives engage",
    sections: [
      {
        title: "Why escalations expose the AI readiness gap",
        paragraphs: [
          "CSMs can produce confident-looking health narratives and next-step plans with AI assistance. Escalations test a different skill: updating judgment when stakeholders contradict the model, explaining tradeoffs without a script, and spotting when an AI recommendation is confidently wrong.",
          "openLesson captures readiness evidence on those exact signals before the escalation becomes churn.",
        ],
      },
      {
        title: "Model your escalation archetypes",
        paragraphs: [
          "Create a Performance Workspace from real patterns: executive sponsor loss, scope disputes, security surprises, or value realization stalls. Each block defines what the CSM must demonstrate—not generic platform training.",
          "Practice in the ILE with think-aloud sessions that leave reasoning traces managers can review.",
        ],
      },
      {
        title: "Evaluate before the executive call",
        paragraphs: [
          "Run Evaluation Environment sessions scoped to the escalation block. Structured probes surface gaps in causal reasoning, stakeholder mapping, and repair planning.",
          "Issue private evaluation links for async readiness checks across distributed CS pods.",
        ],
      },
    ],
    faqs: [
      {
        question: "What signals does openLesson measure for escalations?",
        answer:
          "Tradeoff explanation without scripts, judgment updates when facts change, identification of AI failure modes, and quality of proposed repair paths.",
      },
      {
        question: "Can we use our own escalation playbooks?",
        answer:
          "Yes. Workspaces are generated from your prompts and playbooks, then broken into assessable blocks you refine over time.",
      },
    ],
    primaryCta: { label: "Build an escalation workspace", href: "/workspace/new" },
    closingTitle: "Know who can handle the next escalation",
    closingBody: "Stop assuming AI-assisted account plans mean your CSM is ready when executives join the call.",
  }),
  buildScenario({
    verticalSlug: "customer-success",
    slug: "executive-sponsor-loss",
    h1: "Executive sponsor loss readiness for strategic accounts",
    intro:
      "Losing an executive sponsor resets the entire account narrative. Measure whether your CSM can rebuild alignment, quantify risk, and adapt strategy—not just regenerate an AI account plan.",
    metaTitle: "Executive Sponsor Loss CS Training & Readiness",
    metaDescription:
      "Train and verify CSM readiness when executive sponsors leave: stakeholder remapping, risk framing, and judgment under ambiguity.",
    keywords: ["executive sponsor loss", "strategic account management training", "CSM readiness", "customer success coaching"],
    navLabel: "Executive sponsor loss",
    navDescription: "Rebuild alignment when sponsors leave",
    sections: [
      {
        title: "The sponsor-loss failure mode",
        paragraphs: [
          "Teams default to templated outreach and AI-drafted business cases when sponsorship goes quiet. The gap is judgment: who actually holds budget authority now, what changed in political dynamics, and what risk is worth escalating internally.",
        ],
      },
      {
        title: "Practice remapping and risk framing",
        paragraphs: [
          "ILE sessions walk CSMs through sponsor-loss scenarios with incomplete information. Evaluation probes test whether they gather the right signals before committing to a renewal strategy.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is this only for enterprise CS?",
        answer: "Most teams start with enterprise or mid-market strategic books where sponsor loss has the highest revenue impact.",
      },
    ],
    primaryCta: { label: "Create a sponsor-loss workspace", href: "/workspace/new" },
    closingTitle: "Prepare before sponsorship goes quiet",
    closingBody: "Build remapping and risk judgment before QBR season.",
  }),
  buildScenario({
    verticalSlug: "customer-success",
    slug: "adoption-stall-recovery",
    h1: "Adoption stall recovery readiness for customer success",
    intro:
      "When usage flatlines, AI can suggest generic re-engagement campaigns. Verify that your CSM understands root causes, customer jobs-to-be-done, and credible recovery paths.",
    metaTitle: "Adoption Stall Recovery Training for CSMs",
    metaDescription:
      "Measure CSM readiness to diagnose adoption stalls and design credible recovery plans—not generic AI re-engagement templates.",
    keywords: ["adoption stall", "customer success adoption", "CSM training", "product adoption readiness"],
    navLabel: "Adoption stall recovery",
    navDescription: "Diagnose stalls beyond AI templates",
    sections: [
      {
        title: "Stalls are a reasoning problem, not a content problem",
        paragraphs: [
          "Low adoption often reflects misidentified champions, wrong success criteria, or change-management gaps—not missing enablement PDFs. openLesson tests whether CSMs can diagnose before prescribing.",
        ],
      },
      {
        title: "Evidence-based recovery planning",
        paragraphs: [
          "Upload usage artifacts, customer interviews, and internal notes as evidence. Performance analysis returns gap-ranked recommendations for the specific account context.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can we tie this to health scores?",
        answer:
          "Yes. Use workspaces per stall archetype and upload health-score exports as evidence for performance analysis.",
      },
    ],
    primaryCta: { label: "Start an adoption workspace", href: "/workspace/new" },
    closingTitle: "Fix stalls with judgment, not more email templates",
    closingBody: "Measure diagnostic skill before scaling CS playbooks.",
  }),
  buildScenario({
    verticalSlug: "customer-success",
    slug: "security-review-escalation",
    h1: "Security review escalation readiness for customer success",
    intro:
      "Security reviews stall deals and trigger executive attention. Ensure CSMs and SEs can explain architecture tradeoffs, scope remediation, and flag AI-generated inaccuracies before legal and security teams do.",
    metaTitle: "Security Review Escalation CS Readiness",
    metaDescription:
      "Verify customer success readiness during security review escalations: architecture explanation, scope control, and AI assumption checks.",
    keywords: ["security review customer success", "CS security escalation", "enterprise CS training"],
    navLabel: "Security review escalation",
    navDescription: "CS readiness during security reviews",
    sections: [
      {
        title: "When security reviews become CS incidents",
        paragraphs: [
          "AI-drafted security responses can sound compliant while missing deployment context your customer actually runs. Escalations punish shallow understanding fast.",
        ],
      },
      {
        title: "Practice cross-functional reasoning",
        paragraphs: [
          "Workspaces model questionnaire loops, architecture clarifications, and executive briefing prep. Evaluation sessions test explanation quality without security engineers in the room.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do we need security engineers to run evaluation?",
        answer:
          "Evaluation probes depth and gap patterns; security SMEs can review results asynchronously instead of attending every practice session.",
      },
    ],
    primaryCta: { label: "Build a security escalation workspace", href: "/workspace/new" },
    closingTitle: "Reduce security-review surprises",
    closingBody: "Prove CS can represent customer context accurately.",
  }),
  buildScenario({
    verticalSlug: "customer-success",
    slug: "churn-risk-quantification",
    h1: "Churn risk quantification readiness for renewals",
    intro:
      "AI can summarize risk narratively—but can your CSM quantify probability-weighted revenue loss and defend a renewal strategy? Measure that judgment before renewal season.",
    metaTitle: "Churn Risk Quantification CS Training",
    metaDescription:
      "Train CSMs to quantify churn risk and defend renewal strategy with evidence—not AI-generated risk summaries alone.",
    keywords: ["churn risk training", "renewal readiness", "customer success quantification", "CS renewal coaching"],
    navLabel: "Churn risk quantification",
    navDescription: "Quantify renewal risk with evidence",
    sections: [
      {
        title: "Narrative risk is not quantified risk",
        paragraphs: [
          "Dashboards flag red accounts; they rarely teach CSMs how to model downside scenarios, weight leading indicators, or connect product usage to revenue exposure.",
        ],
      },
      {
        title: "Renewal blocks with evaluation gates",
        paragraphs: [
          "Create renewal-season workspaces with blocks for risk math, executive narrative, and procurement anticipation. Evaluation before forecast calls gives managers auditable readiness evidence.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does this replace revenue forecasting tools?",
        answer: "No. openLesson verifies the human judgment behind forecasts and renewal plans.",
      },
    ],
    primaryCta: { label: "Create a renewal readiness workspace", href: "/workspace/new" },
    closingTitle: "Renew with evidence, not optimism",
    closingBody: "Quantify churn risk before the forecast commit.",
  }),

  // ── Sales Enablement (5) ──────────────────────────────────────────
  buildScenario({
    verticalSlug: "sales-enablement",
    slug: "sales-discovery-judgment",
    h1: "Sales discovery judgment assessment for AI-assisted reps",
    intro:
      "AI talk tracks and call summaries make reps sound prepared. openLesson measures whether they qualify pain without leading questions, challenge AI drafts, and map buyer stakes to solution fit.",
    metaTitle: "Sales Discovery Judgment Assessment",
    metaDescription:
      "Assess sales discovery readiness: qualifying pain, challenging AI talk tracks, and mapping buyer stakes—beyond polished call prep.",
    keywords: [
      "sales discovery training",
      "discovery call assessment",
      "AI sales coaching",
      "sales readiness evaluation",
      "B2B discovery skills",
    ],
    navLabel: "Sales discovery judgment",
    navDescription: "Qualify pain beyond AI talk tracks",
    sections: [
      {
        title: "Discovery is where AI illusions die first",
        paragraphs: [
          "Reps can run calls with AI-generated questions that sound consultative but fail to test buyer understanding. Discovery judgment shows up when the prospect agrees with the AI summary and the rep must ask the next probing question without a script.",
        ],
      },
      {
        title: "Workspace blocks for discovery milestones",
        paragraphs: [
          "Model blocks for pain qualification, stakeholder mapping, technical validation handoffs, and mutual close plans. ILE practice captures reasoning traces; evaluation sessions score depth before managers join live calls.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can we align blocks to our sales methodology?",
        answer: "Yes. Workspaces are built from your ICP, methodology, and objection library.",
      },
      {
        question: "How do managers use evaluation results?",
        answer:
          "Gap analysis highlights specific repairs—e.g., leading questions, weak stake mapping—and suggested practice scenarios for the next week.",
      },
    ],
    primaryCta: { label: "Build a discovery workspace", href: "/workspace/new" },
    closingTitle: "Hire and coach for discovery depth",
    closingBody: "Measure whether reps understand the problem—not just the pitch.",
  }),
  buildScenario({
    verticalSlug: "sales-enablement",
    slug: "renewal-negotiation-readiness",
    h1: "Enterprise renewal negotiation readiness training",
    intro:
      "Renewals punish reps who lean on AI ROI decks without understanding procurement dynamics, churn math, or concession tradeoffs. Verify renewal negotiation readiness before Q4.",
    metaTitle: "Enterprise Renewal Negotiation Readiness",
    metaDescription:
      "Train and assess enterprise renewal negotiation judgment: procurement pushback, value defense, and AI-assisted deck scrutiny.",
    keywords: [
      "renewal negotiation training",
      "enterprise sales readiness",
      "procurement negotiation sales",
      "renewal sales coaching",
    ],
    navLabel: "Renewal negotiation readiness",
    navDescription: "Enterprise renewal judgment under pressure",
    sections: [
      {
        title: "Renewals test judgment, not slides",
        paragraphs: [
          "AI generates compelling renewal narratives. Buyers test whether reps can defend assumptions, quantify risk, and navigate multi-stakeholder tradeoffs when discounts and legal terms enter the conversation.",
        ],
      },
      {
        title: "Simulate procurement pushback",
        paragraphs: [
          "Evaluation sessions model procurement objections, competitive threats, and executive economic buyers. Reps demonstrate value defense without retreating to generic talk tracks.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is this for AEs or CSMs?",
        answer: "Both. Many teams pair AE negotiation blocks with CSM risk-quantification blocks in the same workspace.",
      },
    ],
    primaryCta: { label: "Create a renewal workspace", href: "/workspace/new" },
    closingTitle: "Protect NRR with ready reps",
    closingBody: "Practice renewals before procurement applies pressure.",
  }),
  buildScenario({
    verticalSlug: "sales-enablement",
    slug: "procurement-pushback-readiness",
    h1: "Procurement pushback readiness for enterprise sales",
    intro:
      "Procurement teams weaponize AI benchmarking and RFP templates. Measure whether your reps can respond with substance—not defensive scripts generated minutes before the call.",
    metaTitle: "Procurement Pushback Sales Training",
    metaDescription:
      "Assess sales readiness for procurement pushback: benchmarking responses, concession strategy, and value defense without AI scripts.",
    keywords: ["procurement pushback sales", "enterprise procurement training", "sales negotiation readiness"],
    navLabel: "Procurement pushback",
    navDescription: "Respond to procurement with substance",
    sections: [
      {
        title: "Procurement calls are reasoning exams",
        paragraphs: [
          "Buyers compare vendors with AI-generated scorecards. Reps fail when they cannot explain differentiation, total cost of ownership, and implementation risk in their own words.",
        ],
      },
      {
        title: "Practice concession strategy under probes",
        paragraphs: [
          "ILE and evaluation sessions test when to concede, what to trade, and how to document mutual value—skills AI drafts approximate but do not instill.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can we import our RFP objection library?",
        answer: "Yes. Seed workspaces with RFP patterns and competitive benchmarks as prompts and evidence files.",
      },
    ],
    primaryCta: { label: "Build a procurement workspace", href: "/workspace/new" },
    closingTitle: "Win procurement conversations with judgment",
    closingBody: "Stop losing deals to better-prepared benchmarking narratives.",
  }),
  buildScenario({
    verticalSlug: "sales-enablement",
    slug: "competitive-displacement-readiness",
    h1: "Competitive displacement readiness for sales teams",
    intro:
      "Displacement deals require sharp causal reasoning about why customers should switch now. AI battlecards help—but only if reps understand the underlying tradeoffs they summarize.",
    metaTitle: "Competitive Displacement Sales Readiness",
    metaDescription:
      "Verify sales readiness for competitive displacement: switch justification, risk framing, and AI battlecard scrutiny.",
    keywords: ["competitive displacement sales", "sales battlecard training", "competitive selling readiness"],
    navLabel: "Competitive displacement",
    navDescription: "Justify switching with real tradeoffs",
    sections: [
      {
        title: "Battlecards without judgment fail",
        paragraphs: [
          "Reps parrot competitive matrices without explaining migration risk, switching costs, or why the incumbent's strength does not apply to this buyer's context.",
        ],
      },
      {
        title: "Displacement workspaces by competitor",
        paragraphs: [
          "Create blocks per competitor motion with evaluation on switch economics, technical migration, and executive narrative coherence.",
        ],
      },
    ],
    faqs: [
      {
        question: "How often should battlecard workspaces update?",
        answer: "Refresh when positioning, pricing, or product parity shifts—blocks are fast to regenerate from updated prompts.",
      },
    ],
    primaryCta: { label: "Start a competitive workspace", href: "/workspace/new" },
    closingTitle: "Displace with evidence, not slogans",
    closingBody: "Measure switch justification before competitive bake-offs.",
  }),
  buildScenario({
    verticalSlug: "sales-enablement",
    slug: "technical-validation-call-readiness",
    h1: "Technical validation call readiness for sales teams",
    intro:
      "SE-led validation calls expose reps who cannot connect buyer requirements to product reality. Assess readiness before inviting architects into the deal.",
    metaTitle: "Technical Validation Call Sales Readiness",
    metaDescription:
      "Assess sales and SE readiness for technical validation calls: requirements mapping, architecture honesty, and AI demo scrutiny.",
    keywords: ["technical validation sales", "sales engineer readiness", "demo readiness assessment"],
    navLabel: "Technical validation calls",
    navDescription: "Prep validation calls with depth",
    sections: [
      {
        title: "Validation calls punish shallow product understanding",
        paragraphs: [
          "AI demos and auto-generated POC plans look credible until a technical buyer asks about limits, integration constraints, or failure modes the rep cannot explain.",
        ],
      },
      {
        title: "Joint AE + SE evaluation",
        paragraphs: [
          "Workspaces can include blocks for both commercial and technical stakeholders. Evaluation returns shared gap analysis for deal teams.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do SEs need separate workspaces?",
        answer: "Teams often share a workspace with role-specific blocks scoped to AE vs SE demonstration objectives.",
      },
    ],
    primaryCta: { label: "Build a validation workspace", href: "/workspace/new" },
    closingTitle: "Pass technical validation with credibility",
    closingBody: "Invite architects when your team can defend the architecture.",
  }),

  // ── Other verticals (landing-mapped) ──────────────────────────────
  buildScenario({
    verticalSlug: "compliance-risk",
    slug: "compliance-exception-review",
    h1: "Compliance exception review readiness training",
    intro:
      "Approvers can pass policy quizzes with AI help and still miss blast radius on exceptions. Measure whether staff cite rationale in their own words, weigh downstream risk, and flag undocumented AI assumptions.",
    metaTitle: "Compliance Exception Review Readiness",
    metaDescription:
      "Train and verify compliance exception judgment: policy rationale, blast radius analysis, and AI assumption checks.",
    keywords: ["compliance exception training", "policy exception review", "compliance readiness assessment", "risk training"],
    navLabel: "Compliance exception review",
    navDescription: "Exception judgment beyond policy quizzes",
    sections: [
      {
        title: "Exceptions are where policy training breaks",
        paragraphs: [
          "Models cite precedent and generate plausible approvals. Reviewers must verify context differences, quantify blast radius, and document dissent when AI confidence exceeds evidence.",
        ],
      },
      {
        title: "Auditable evaluation for approvers",
        paragraphs: [
          "Evaluation sessions produce marker scores and gap analysis suitable for audit trails and remediation plans.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can we model our control framework?",
        answer: "Yes. Workspaces are generated from your control library and exception taxonomy.",
      },
    ],
    primaryCta: { label: "Start a compliance workspace", href: "/workspace/new" },
    closingTitle: "Approve exceptions with defensible judgment",
    closingBody: "Verify approvers before regulators ask why.",
  }),
  buildScenario({
    verticalSlug: "engineering-oncall",
    slug: "incident-response-triage",
    h1: "Incident response triage readiness for on-call engineers",
    intro:
      "AI runbooks suggest the first move fast—but outages punish guesswork. Verify engineers can narrow root cause, prioritize customer impact, and explain rollback tradeoffs before they take the pager.",
    metaTitle: "Incident Response Triage Readiness Training",
    metaDescription:
      "Assess on-call incident triage judgment: root cause narrowing, customer impact prioritization, and rollback tradeoff reasoning.",
    keywords: ["incident response training", "on-call readiness", "SRE triage assessment", "production incident coaching"],
    navLabel: "Incident response triage",
    navDescription: "On-call triage beyond AI runbooks",
    sections: [
      {
        title: "Runbooks accelerate; judgment decides",
        paragraphs: [
          "Restarting the wrong service or scaling the wrong tier can amplify incidents. Triage readiness means knowing which signals would change your first hypothesis.",
        ],
      },
      {
        title: "Simulate past and hypothesized failures",
        paragraphs: [
          "Workspaces from anonymized incidents build muscle memory. Evaluation before pager expansion gates reduces mean time to bad decisions.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does this replace game days?",
        answer: "It complements them—scaling judgment assessment between full simulations.",
      },
    ],
    primaryCta: { label: "Build an on-call workspace", href: "/workspace/new" },
    closingTitle: "Triage with evidence, not adrenaline",
    closingBody: "Practice before the pager fires.",
  }),
  buildScenario({
    verticalSlug: "corporate-learning",
    slug: "manager-coaching-readiness",
    h1: "New manager coaching readiness for people leaders",
    intro:
      "AI drafts performance conversations that sound empathetic but hollow. Measure whether managers give behavior-tied feedback, adapt tone to context, and detect when scripts miss the employee's actual concern.",
    metaTitle: "Manager Coaching Readiness Assessment",
    metaDescription:
      "Verify new manager coaching judgment: behavior-tied feedback, contextual tone, and AI script scrutiny.",
    keywords: ["manager coaching training", "new manager readiness", "performance conversation coaching", "people leader development"],
    navLabel: "Manager coaching readiness",
    navDescription: "Feedback depth beyond AI scripts",
    sections: [
      {
        title: "Management AI makes everyone sound caring",
        paragraphs: [
          "The test is whether the employee actually heard the core message, whether feedback ties to observable behavior, and whether the manager adapts when emotion or context shifts mid-conversation.",
        ],
      },
      {
        title: "L&D pathways for new managers",
        paragraphs: [
          "Corporate learning teams embed coaching blocks in manager academies with ILE practice and evaluation before people leadership promotions.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is this for HR or line managers?",
        answer: "L&D typically owns the workspace; line managers complete practice and evaluation as part of promotion or onboarding paths.",
      },
    ],
    primaryCta: { label: "Create a manager coaching workspace", href: "/workspace/new" },
    closingTitle: "Coach with judgment, not generated empathy",
    closingBody: "Build people leaders who adapt—not recite.",
  }),
];

export const SCENARIO_ROUTE_PARAMS = SCENARIO_PAGES.map((page) => ({
  vertical: page.verticalSlug,
  scenario: page.slug,
}));

export function getScenarioPage(vertical: string, scenario: string): SeoScenarioPageConfig | undefined {
  return SCENARIO_PAGES.find((page) => page.verticalSlug === vertical && page.slug === scenario);
}

export function getScenariosForVertical(verticalSlug: string): SeoScenarioPageConfig[] {
  return SCENARIO_PAGES.filter((page) => page.verticalSlug === verticalSlug);
}

export function scenarioMetadata(page: SeoScenarioPageConfig): Metadata {
  const base = solutionMetadata(page);
  const vertical = getSolutionPage(page.verticalSlug);
  return {
    ...base,
    title: page.metaTitle,
    openGraph: {
      ...base.openGraph,
      title: page.metaTitle,
      url: `${BASE_URL}${page.path}`,
    },
  };
}

export type RelatedLink = {
  href: string;
  label: string;
  description: string;
};

export function scenarioToRelatedLink(page: SeoScenarioPageConfig): RelatedLink {
  return {
    href: page.path,
    label: page.navLabel,
    description: page.navDescription,
  };
}