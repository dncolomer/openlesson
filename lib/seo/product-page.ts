import type { Metadata } from "next";

export const DEMO_BOOKING_URL = "https://cal.com/daniel-colomer-lvwg8w/openlesson-demo";

export type ProductUseCase = {
  title: string;
  description: string;
};

export type SeoProductPageConfig = {
  slug: string;
  path: string;
  eyebrow: string;
  h1: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  heroImageAlt: string;
  heroVideoSrc?: string;
  heroVideoPosition?: string;
  useCases: ProductUseCase[];
  highlights: string[];
  faqs: { question: string; answer: string }[];
  secondaryCta?: { label: string; href: string };
  closingTitle: string;
  closingBody: string;
};

const BASE_URL = "https://openlesson.academy";

export function productPageMetadata(page: SeoProductPageConfig): Metadata {
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

export const POW_API_PAGE: SeoProductPageConfig = {
  slug: "proof-of-work-api",
  path: "/products/proof-of-work-api",
  eyebrow: "Proof-of-Work API",
  h1: "Optimize learning to convert — before users drop off.",
  intro:
    "Use proof-of-work signals from real workflows to learn what people and agents still need before they convert, promote, or deploy. Build dynamic, agentic onboarding that teaches the right thing at the right moment — not a static checklist.",
  metaTitle: "Proof-of-Work API | Learning Optimization for Conversion",
  metaDescription:
    "Headless API that scores live cognition and tool traces so you can optimize onboarding, certification, and conversion with proof of work — not completion rates.",
  keywords: [
    "proof of work API",
    "learning optimization",
    "conversion optimization",
    "agentic onboarding",
    "skills gap analysis",
    "readiness scoring",
  ],
  heroImageAlt: "Proof-of-Work API product hero",
  useCases: [
    {
      title: "Agentic onboarding",
      description:
        "Pipe tool traces and session artifacts into scoring endpoints. Trigger the next coaching step only when gaps are real — not when a progress bar hits 100%.",
    },
    {
      title: "Conversion diagnostics",
      description:
        "See which concepts block activation or upgrade. Rank gaps by severity so product and enablement teams know what to teach next.",
    },
    {
      title: "Deploy and promotion gates",
      description:
        "Hold agents and humans to the same readiness bar before production access, certification, or customer-facing work.",
    },
    {
      title: "CI and eval harnesses",
      description:
        "Embed scoring in pipelines. Compare runs over time and prove improvement with auditable gap reports — not vanity metrics.",
    },
  ],
  highlights: [
    "Headless — fits portals, LMS hooks, agent orchestration, and internal tools",
    "Works for human artifacts and agent tool traces in the same workspace model",
    "Continuous readiness scores with severity-ranked gaps",
  ],
  faqs: [
    {
      question: "How is this different from quiz completion?",
      answer:
        "Completion tells you someone finished a flow. Proof-of-Work API scores whether they can perform the underlying skill from real artifacts and traces.",
    },
    {
      question: "Do I need a hosted session?",
      answer:
        "No. Send recordings, write-ups, tool traces, or other proof-of-work artifacts via API and receive structured gap analysis.",
    },
  ],
  secondaryCta: { label: "View API docs", href: "/docs/proof-of-work-api" },
  closingTitle: "Teach what actually blocks conversion.",
  closingBody:
    "Book a demo to see how proof-of-work scoring powers dynamic onboarding and agentic learning loops in your stack.",
};

export const TAP_PAGE: SeoProductPageConfig = {
  slug: "think-aloud-protocol",
  path: "/products/think-aloud-protocol",
  eyebrow: "Think Aloud Protocol",
  h1: "Verify hard skills with live human reasoning.",
  intro:
    "Send a link. Candidates or learners talk through their thinking while they work. You get scored evidence of what they understand — signal that polished deliverables and AI-assisted output cannot fake.",
  metaTitle: "Think Aloud Protocol | Hard Skill & Human Verification",
  metaDescription:
    "Live think-aloud sessions with Socratic probes for hard skill verification and human judgment checks inside your workspace.",
  keywords: [
    "think aloud protocol",
    "hard skill verification",
    "human verification",
    "skills assessment",
    "live cognition",
  ],
  heroImageAlt: "Think Aloud Protocol product hero",
  useCases: [
    {
      title: "Hiring and promotion",
      description:
        "Verify judgment on realistic scenarios — not rehearsed answers. Capture hesitations, revisions, and causal reasoning under probe.",
    },
    {
      title: "Certification gates",
      description:
        "Issue shareable links per role or practice block. Score markers with rationale auditors can review.",
    },
    {
      title: "High-stakes handoffs",
      description:
        "Confirm a human actually understands the workflow before they own customer outcomes or safety-critical steps.",
    },
    {
      title: "Coach calibration",
      description:
        "Give managers a repeatable protocol for reviewing how people think — not just what they produced.",
    },
  ],
  highlights: [
    "Shareable URLs scoped to a workspace or block",
    "Think-aloud traces plus targeted Socratic follow-ups",
    "Marker scores and auditable gap reports",
  ],
  faqs: [
    {
      question: "When should I use TAP instead of the API?",
      answer:
        "Use TAP when you need live human cognition under probe. Use the Proof-of-Work API when you already have artifacts or traces to score asynchronously.",
    },
    {
      question: "Can candidates use their own tools?",
      answer:
        "Yes. TAP captures reasoning during real work — spreadsheets, IDEs, dashboards — not artificial puzzle screens.",
    },
  ],
  closingTitle: "Trust the thinking, not the slide deck.",
  closingBody:
    "Book a demo to see Think Aloud Protocol links, scoring, and reviewer workflows end to end.",
};

export const ILE_PAGE: SeoProductPageConfig = {
  slug: "integrated-learning-environment",
  path: "/products/integrated-learning-environment",
  eyebrow: "Integrated Learning Environment",
  h1: "Replace tests with cognitive analysis people actually learn from.",
  intro:
    "ILE is a drop-in alternative to multiple-choice tests and take-home assignments when you care about complex cognition — how someone reasons, adapts, and improves under realistic conditions.",
  metaTitle: "Integrated Learning Environment | Cognitive Analysis Beyond Tests",
  metaDescription:
    "Practice environment for complex skills: guided scenarios, coaching, and proof of progress — a replacement for tests and take-homes when depth matters.",
  keywords: [
    "integrated learning environment",
    "cognitive analysis",
    "take home assignment alternative",
    "skills practice",
    "workplace learning",
  ],
  heroImageAlt: "Integrated Learning Environment product hero",
  useCases: [
    {
      title: "Take-home replacement",
      description:
        "Run realistic practice blocks with think-aloud and proof of work instead of one-shot submissions that are easy to outsource.",
    },
    {
      title: "Complex role readiness",
      description:
        "Train multi-step judgment — tradeoffs, debugging, stakeholder calls — with coaching targeted to verified gaps.",
    },
    {
      title: "Academy and bootcamp depth",
      description:
        "Move beyond syntax drills. Track whether learners can perform under ambiguity inside the same workspace context.",
    },
    {
      title: "Post-verification improvement",
      description:
        "Route TAP or API findings directly into practice until scores move — not into a generic content library.",
    },
  ],
  highlights: [
    "Practice wired to verification gaps from TAP and Proof-of-Work API",
    "Progress tracked in the same workspace and learning graph",
    "Designed for complex cognition, not checkbox completion",
  ],
  faqs: [
    {
      question: "Is ILE an LMS?",
      answer:
        "No. It is the improvement layer inside openLesson — practice targets what verification surfaced in your actual work context.",
    },
    {
      question: "Can I use ILE without TAP?",
      answer:
        "Yes. Gaps from Proof-of-Work API or manual review can also route into practice blocks.",
    },
  ],
  closingTitle: "Measure depth, not just delivery.",
  closingBody:
    "Book a demo to see how ILE turns verification gaps into guided practice with proof of progress.",
};

export const ALE_PAGE: SeoProductPageConfig = {
  slug: "agentic-learning-environment",
  path: "/products/agentic-learning-environment",
  eyebrow: "Agentic Learning Environment",
  h1: "Train and validate agents without leaking corporate data.",
  intro:
    "ALE is a private learning environment for evolving agent skills against real scenarios. Practice, score, and iterate on skill definitions inside your boundary — so validation runs on sensitive workflows without exposing them to public models or shared sandboxes.",
  metaTitle: "Agentic Learning Environment | Private Agent Skill Training",
  metaDescription:
    "Private environment to train agents, evolve skill files, and validate capabilities with proof of work — without leaking sensitive corporate data.",
  keywords: [
    "agentic learning environment",
    "agent training",
    "skill.md",
    "private AI sandbox",
    "agent validation",
  ],
  heroImageAlt: "Agentic Learning Environment product hero",
  heroVideoSrc: "/animations/labi.mp4",
  heroVideoPosition: "center 68%",
  useCases: [
    {
      title: "Private skill evolution",
      description:
        "Iterate skill.md files from real workspace runs. Close gaps until Proof-of-Work API scores clear your deploy bar.",
    },
    {
      title: "Sensitive workflow validation",
      description:
        "Run agents against realistic internal scenarios without shipping data to external eval vendors or public chat UIs.",
    },
    {
      title: "Pre-production agent gates",
      description:
        "Sandbox tool-use traces and reasoning patterns before agents touch customer systems or regulated data.",
    },
    {
      title: "Enterprise agent programs",
      description:
        "Give platform teams a controlled loop: verify, practice, re-score — with audit trails suitable for compliance review.",
    },
  ],
  highlights: [
    "Skill evolution driven by proof of work, not one-shot prompt edits",
    "Same workspace model as human verification and ILE",
    "Designed for data-boundary-conscious teams",
  ],
  faqs: [
    {
      question: "How is ALE different from generic agent evals?",
      answer:
        "ALE evolves skills inside your workspace context with proof-of-work scoring — not isolated benchmark prompts that ignore your tools and policies.",
    },
    {
      question: "Can humans and agents share a workspace?",
      answer:
        "Yes. openLesson is built for mixed teams — verification and practice use the same graph and gap model.",
    },
  ],
  closingTitle: "Validate agents on your terms.",
  closingBody:
    "Book a demo to see private agent skill training, scoring, and iteration inside the openLesson workspace.",
};

export const PRODUCT_PAGES = [POW_API_PAGE, TAP_PAGE, ILE_PAGE, ALE_PAGE] as const;