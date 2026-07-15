import type { Metadata } from "next";
import type { ProductUseCase } from "@/lib/seo/product-page";
import { DEMO_BOOKING_URL } from "@/lib/seo/product-page";

export type IntegrationTier = {
  level: string;
  title: string;
  product: string;
  productHref: string;
  description: string;
};

export type SeoUseCasePageConfig = {
  slug: string;
  path: string;
  eyebrow: string;
  lead: string;
  titleLines: string[];
  cardSummary: string[];
  intro: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  useCases: ProductUseCase[];
  integrationTiers?: IntegrationTier[];
  highlights: string[];
  faqs: { question: string; answer: string }[];
  closingTitle: string;
  closingBody: string;
};

const BASE_URL = "https://openlesson.academy";

export function useCasePageMetadata(page: SeoUseCasePageConfig): Metadata {
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
    alternates: { canonical: url },
  };
}

export const LEARNING_VERIFICATION_PAGE: SeoUseCasePageConfig = {
  slug: "learning-verification",
  path: "/use-cases/learning-verification",
  eyebrow: "Learning Verification",
  lead: "Our focus is",
  titleLines: ["Learning", "Verification"],
  cardSummary: ["Human hard skill validation", "Agentic skill validation"],
  intro:
    "Verify what candidates, employees, and agents can actually do — before you hire, promote, certify, or deploy. Built for HR tech, recruitment platforms, and talent marketplaces that need signal beyond polished deliverables and benchmark pass rates.",
  metaTitle: "Learning Verification | HR, Hiring & Agent Skill Validation",
  metaDescription:
    "Human hard skill and agentic skill validation for HR and recruitment platforms. Choose TAP for live probes, ILE for project-style depth, or full Proof-of-Work API integration.",
  keywords: [
    "learning verification",
    "skills validation",
    "HR tech",
    "recruitment platform",
    "hard skill assessment",
    "agent skill validation",
    "think aloud protocol",
    "proof of work",
  ],
  useCases: [
    {
      title: "Recruitment & applicant screening",
      description:
        "Replace take-home theater with verified reasoning. Score live think-aloud sessions or structured practice blocks before candidates reach final interviews.",
    },
    {
      title: "TAP-cha",
      description:
        "Use a short Think Aloud Protocol session to confirm a live human is behind the keyboard — not a bot, scripted agent, or AI-fed impersonation. Hesitations, self-corrections, and causal reasoning under probe are signal a completion checkbox cannot fake.",
    },
    {
      title: "Internal mobility & promotion gates",
      description:
        "Confirm judgment on realistic workflows before role changes — not self-reported proficiency or manager anecdotes.",
    },
    {
      title: "Staffing & talent marketplace quality",
      description:
        "Give buyers confidence that freelancers and contractors can perform under probe, with auditable gap reports per skill block.",
    },
    {
      title: "Agent vendor & deploy readiness",
      description:
        "Validate agentic skill before production rollout. Score tool traces and run scenarios the same way you gate human hires.",
    },
    {
      title: "Certification & compliance attestations",
      description:
        "Issue verification links per role or regulation. Reviewers get marker scores with rationale — not checkbox completions.",
    },
    {
      title: "Soft skill & judgment checks",
      description:
        "Probe tradeoffs, stakeholder reasoning, and metacognitive moves that multiple-choice screens cannot surface.",
    },
  ],
  integrationTiers: [
    {
      level: "01",
      title: "Lightweight — live, time-framed verification",
      product: "Think Aloud Protocol",
      productHref: "/products/think-aloud-protocol",
      description:
        "Send a shareable TAP link. Candidates or learners work through a scoped scenario on a clock while talking through their thinking. Ideal for high-volume screening, interview stages, and quick hard-skill probes inside your existing ATS or HRIS UI.",
    },
    {
      level: "02",
      title: "Open-ended — assignment & project style",
      product: "Integrated Learning Environment",
      productHref: "/products/integrated-learning-environment",
      description:
        "Run deeper validation when the role demands complex cognition: multi-step judgment, debugging, design tradeoffs, or extended practice. ILE replaces one-shot take-homes with coached scenarios and proof-of-work artifacts you can score and compare.",
    },
    {
      level: "03",
      title: "Full integration — custom Proof-of-Work in your stack",
      product: "Proof-of-Work API",
      productHref: "/products/proof-of-work-api",
      description:
        "Embed validation directly into your product, internal tools, or agent pipelines. Pipe recordings, documents, tool traces, and screen shares into scoring endpoints — fully integrated with your workflows, gates, and data model.",
    },
  ],
  highlights: [
    "One workspace model for human and agentic validation",
    "Auditable gap reports — not vanity completion metrics",
    "Pick depth by role: TAP for speed, ILE for complexity, API for native integration",
  ],
  faqs: [
    {
      question: "Which tier should an HR platform start with?",
      answer:
        "Most teams start with Think Aloud Protocol links for live screening, then add ILE for senior or technical roles. Full Proof-of-Work API integration makes sense when validation must run inside your own applicant or employee experience.",
    },
    {
      question: "Can we validate agents the same way we validate humans?",
      answer:
        "Yes. The same workspace blocks and scoring model apply to agent tool traces and human think-aloud sessions, so deploy gates stay consistent across your stack.",
    },
  ],
  closingTitle: "Verify skills before they cost you downstream.",
  closingBody:
    "Book a demo to map TAP, ILE, and Proof-of-Work API tiers to your HR or recruitment product.",
};

export const LEARNING_OPTIMIZATION_PAGE: SeoUseCasePageConfig = {
  slug: "learning-optimization",
  path: "/use-cases/learning-optimization",
  eyebrow: "Learning Optimization",
  lead: "We drive conversion through",
  titleLines: ["Learning", "optimization"],
  cardSummary: ["Dynamic onboarding flows", "Agentic skill optimization (ALE)"],
  intro:
    "Turn verification findings into learning that shows up downstream — adoption, deployment, and real use. Optimize onboarding and agent skills with loops that close gaps instead of checking boxes.",
  metaTitle: "Learning Optimization | Dynamic Onboarding & Agentic Skill Tuning",
  metaDescription:
    "Dynamic onboarding flows and Agentic Learning Environment (ALE) skill optimization. Close verified gaps until learning converts to adoption and deploy readiness.",
  keywords: [
    "learning optimization",
    "dynamic onboarding",
    "agentic onboarding",
    "ALE",
    "agent skill optimization",
    "learning to conversion",
  ],
  useCases: [
    {
      title: "Dynamic onboarding flows",
      description:
        "Adapt the next coaching step to verified gaps — not a static checklist. Trigger ILE practice or in-product guidance only when proof-of-work scores say it is needed.",
    },
    {
      title: "Product activation & feature adoption",
      description:
        "Diagnose which concepts block conversion after signup. Rank gaps by severity so enablement teaches what actually stops users from succeeding.",
    },
    {
      title: "Agentic skill optimization (ALE)",
      description:
        "Evolve agent skill.md files from real runs. ALE iterates capabilities until learning efficiency clears your deploy and adoption bar — because agents are not born with skills.",
    },
    {
      title: "Post-hire ramp & role transitions",
      description:
        "Route new hires into targeted practice blocks after verification. Compound efficiency gains instead of one-off training completions.",
    },
    {
      title: "Customer success & expansion plays",
      description:
        "Detect when accounts misunderstand core workflows. Intervene with practice tuned to their workspace evidence before churn or support load spikes.",
    },
    {
      title: "CI and eval improvement loops",
      description:
        "Embed scoring in agent pipelines. Compare runs over time and prove skill movement with auditable reports — not vanity benchmark deltas.",
    },
  ],
  highlights: [
    "Verification findings drive what gets practiced next",
    "ILE for humans, ALE for agents — same workspace context",
    "Tie every intervention to adoption, deploy, and conversion metrics",
  ],
  faqs: [
    {
      question: "How is optimization different from verification?",
      answer:
        "Verification tells you whether someone can perform today. Optimization routes them — or your agents — into practice and skill iteration until scores move and outcomes improve.",
    },
    {
      question: "When is ALE available?",
      answer:
        "ALE is rolling out for teams that already use Workspaces and Proof-of-Work scoring. Book a demo to join early access for agentic skill optimization.",
    },
  ],
  closingTitle: "Make learning convert — not just complete.",
  closingBody:
    "Book a demo to see dynamic onboarding and ALE skill loops wired to your verification signals.",
};

export const LEARNING_AUGMENTATION_PAGE: SeoUseCasePageConfig = {
  slug: "reasoning-augmentation",
  path: "/use-cases/reasoning-augmentation",
  eyebrow: "Learning Augmentation",
  lead: "Our method is",
  titleLines: ["Learning", "Augmentation"],
  cardSummary: [
    "EdTech & certification prep",
    "Course platform “check your knowledge” replacement",
  ],
  intro:
    "Strengthen how learners think — not just what they recall. Engineer interruptions that probe a deeper reasoning layer inside courses, prep programs, and certification journeys.",
  metaTitle: "Learning Augmentation | EdTech & Certification Prep Integration",
  metaDescription:
    "Replace shallow “check your knowledge” quizzes with think-aloud probes, coached practice, and proof-of-work scoring for edTech, certification prep agencies, and online course platforms.",
  keywords: [
    "learning augmentation",
    "edtech integration",
    "certification prep",
    "online course platform",
    "check your knowledge alternative",
    "cognitive tutoring",
    "Socratic probing",
  ],
  useCases: [
    {
      title: "EdTech platforms & learning apps",
      description:
        "Drop TAP or ILE blocks into lesson flows. Surface hesitations, causal reasoning, and revision patterns that multiple-choice items miss.",
    },
    {
      title: "Certification prep agencies",
      description:
        "Move beyond drill banks. Verify whether candidates can explain tradeoffs and defend decisions under timed, probed scenarios aligned to the real exam domain.",
    },
    {
      title: "Online course platform integration",
      description:
        "Replace lightweight “check your knowledge” widgets with verification that measures understanding — then route weak spots into coached practice inside the same course context.",
    },
    {
      title: "Corporate academy depth",
      description:
        "Augment video-and-quiz curricula with interruption moments that catch shallow fluency before learners claim completion.",
    },
    {
      title: "Bootcamp & cohort programs",
      description:
        "Give instructors auditable reasoning traces per learner. Calibrate coaching to verified gaps instead of homework volume.",
    },
    {
      title: "Publisher & content licensing",
      description:
        "License verification layers that travel with your content catalog — so partners get depth without rebuilding assessment infrastructure.",
    },
  ],
  highlights: [
    "Trace Interruption Model breaks turn-based quiz linearity",
    "Embeddable links and API hooks for LMS and course builders",
    "Verification plus practice in one workspace — no bolt-on tutoring tab",
  ],
  faqs: [
    {
      question: "Can this replace our existing quiz engine?",
      answer:
        "For depth checks, yes — TAP and ILE measure cognition quizzes cannot. Many teams keep lightweight recall checks and add openLesson where understanding must be proven.",
    },
    {
      question: "How do learners experience interruptions?",
      answer:
        "Probes arrive in context — during practice, after a chapter, or mid-scenario — with coaching tuned to the gap the workspace already detected.",
    },
  ],
  closingTitle: "Augment thinking where courses stop at recall.",
  closingBody:
    "Book a demo to integrate learning augmentation into your edTech stack or certification prep program.",
};

export const HERO_PILLAR_PAGES = [
  LEARNING_VERIFICATION_PAGE,
  LEARNING_OPTIMIZATION_PAGE,
  LEARNING_AUGMENTATION_PAGE,
] as const;

export { DEMO_BOOKING_URL };