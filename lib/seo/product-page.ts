import type { Metadata } from "next";
import { openGraphImagesForRoutePath } from "@/lib/og/paths";

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

const BASE_URL = "https://uncertain.systems";

export function productPageMetadata(page: SeoProductPageConfig): Metadata {
  const url = `${BASE_URL}${page.path}`;
  const images = openGraphImagesForRoutePath(page.path, page.metaTitle);
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url,
      siteName: "Uncertain Systems",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
      creator: "@uncertainsys",
      images: images.map((image) => image.url),
    },
    alternates: { canonical: url },
  };
}

export const TIM_PAGE: SeoProductPageConfig = {
  slug: "trace-interruption-model",
  path: "/products/trace-interruption-model",
  eyebrow: "Trace Interruption Model",
  h1: "Predict optimal learning-path interruptions — not the next funnel step.",
  intro:
    "TIM is not a product you buy on its own. It is the core model behind every Uncertain Systems surface — trained to decide when to interrupt a learner’s path with the right probe, coaching nudge, or proof-of-work request, at the right moment. That is how we break the linearity of classic analytics and turn-based chat.",
  metaTitle: "Trace Interruption Model (TIM) | Core Learning Interruption Engine",
  metaDescription:
    "TIM predicts optimal learning-path interruptions across TAP, ILE, Proof-of-Work API, and ALE. The shared model behind verification, optimization, and augmentation — not a standalone SKU.",
  keywords: [
    "trace interruption model",
    "TIM",
    "learning path interruption",
    "predictive coaching",
    "Socratic probing",
    "learning world model",
    "non-linear learning analytics",
  ],
  heroImageAlt: "Trace Interruption Model — predictive learning interruptions",
  useCases: [
    {
      title: "Proof-of-Work API responses",
      description:
        "Every API success can carry an interruption prediction — type, message, delay, and confidence — so your app schedules reflection prompts, probes, or coaching without hard-coding a static checklist.",
    },
    {
      title: "Think Aloud Protocol probes",
      description:
        "Live TAP sessions use TIM to target hesitations and reasoning breaks with Socratic follow-ups while the candidate is still in flow — not after a form submit.",
    },
    {
      title: "ILE coaching moments",
      description:
        "Practice blocks interrupt when the model predicts a gap is ripe for coaching — routing humans into depth at the moment understanding frays, not at arbitrary chapter ends.",
    },
    {
      title: "Agentic consumer systems",
      description:
        "Agents and orchestrators read interruption contracts from PoW responses, schedule interventions, and supersede stale timers when newer evidence arrives — agent-native learning loops.",
    },
    {
      title: "Learning world model growth",
      description:
        "Each interruption is grounded in accumulated proof of work and performance context. TIM learns what still needs to be measured and when the path should bend — feeding the model that all products share.",
    },
    {
      title: "Verification vs. augmentation timing",
      description:
        "The same predictor chooses between checkpoint probes (verify now), coaching nudges (optimize next), and proof reminders (augment with evidence) — aligned to the three verticals on one workspace.",
    },
  ],
  highlights: [
    "Trained to predict when and how to interrupt — not just what happened last",
    "Shared across Proof-of-Work API, TAP, ILE, and ALE on every workspace",
    "Surfaces as interruption payloads with delay, confidence, and consumer obligations",
    "Foundation layer — not sold separately; powers the products you integrate",
  ],
  faqs: [
    {
      question: "Can I call TIM directly?",
      answer:
        "No. TIM runs inside Uncertain Systems products. You experience it through TAP probes, ILE coaching, PoW API interruption fields, and performance-driven schema evolution — not as a standalone endpoint.",
    },
    {
      question: "How is this different from funnel analytics?",
      answer:
        "Funnel tools record that a step completed. TIM predicts whether the learner needs an intervention before they drift, fake understanding, or drop off — using proof-of-work context, not page views alone.",
    },
    {
      question: "What does an interruption look like?",
      answer:
        "A structured prediction: intervention type (reflection, probe, coaching nudge, proof reminder, performance review), message, optional delay in milliseconds, confidence, and rules for supersession when newer API responses arrive.",
    },
    {
      question: "Does TIM replace my LMS rules engine?",
      answer:
        "It complements it. You keep your UX; TIM tells your system when Uncertain Systems believes an interruption will advance the learning world model for that user or agent — grounded in workspace evidence.",
    },
  ],
  secondaryCta: { label: "See all products", href: "/#products" },
  closingTitle: "One model. Every product.",
  closingBody:
    "Book a demo to see how TIM-powered interruptions flow through verification, optimization, and augmentation in your stack.",
};

export const POW_API_PAGE: SeoProductPageConfig = {
  slug: "proof-of-work-api",
  path: "/products/proof-of-work-api",
  eyebrow: "Proof-of-Work API",
  h1: "The base layer for verification, optimization, and augmentation you build yourself.",
  intro:
    "Proof-of-Work API is how customers embed Uncertain Systems into their own products — custom hiring gates, onboarding loops, edTech depth checks, agent deploy bars, or entirely new use cases across all three verticals. Every artifact and tool trace you send is fuel for a learning world model that grows gradually with the user or agent, not a one-shot score from a static form.",
  metaTitle: "Proof-of-Work API | Evolving Learning World Model Foundation",
  metaDescription:
    "Build custom verification, optimization, and augmentation apps on Proof-of-Work API. A dynamically evolving interface that grows your learning world model — agentic-ready, not a static contract.",
  keywords: [
    "proof of work API",
    "learning world model",
    "agentic integration",
    "custom verification API",
    "learning augmentation API",
    "MCP proof of work",
    "evolving API",
    "skills gap analysis",
  ],
  heroImageAlt: "Proof-of-Work API — foundation for custom learning applications",
  useCases: [
    {
      title: "Custom verification applications",
      description:
        "Build hiring screens, certification gates, TAP-cha human checks, or agent readiness bars on top of one workspace. Your UI, our measurement layer — proof of work in, verified capability out.",
    },
    {
      title: "Custom optimization applications",
      description:
        "Wire gap scores into onboarding, enablement, or agent skill loops you own. The API tells your product what to teach or retry next based on what the model already knows is missing.",
    },
    {
      title: "Custom augmentation applications",
      description:
        "Embed in-course probes, coach triggers, or in-tool interruptions in your LMS, IDE, or internal portal. Augmentation runs on the same evidence stream as verification and optimization.",
    },
    {
      title: "Agentic integrations",
      description:
        "Agents submit proof of work over REST or MCP, read performance and schema tools, and participate in the loop — not just call a fixed scoring endpoint. Built for orchestrators that need to act on gaps.",
    },
    {
      title: "Gradual learning world model",
      description:
        "Each submission extends the picture of skills, scenarios, and gaps for that workspace. The API is the door through which that model is built — session by session, artifact by artifact.",
    },
    {
      title: "Self-evolving measurement surface",
      description:
        "As the model matures, the interface adapts: new proof-of-work schemas, performance dimensions, and integration hints reflect what still needs to be measured. The system optimizes what it asks for to keep building the model.",
    },
  ],
  highlights: [
    "Foundation for custom apps across verification, optimization, and augmentation",
    "Dynamically evolving interface — adapts as the learning world model grows, not a frozen OpenAPI contract",
    "Agentic-ready via REST and MCP; self-directing evidence and schema generation over time",
    "Human and agent proof of work on one workspace, one model, one meter",
  ],
  faqs: [
    {
      question: "Is this a static API contract?",
      answer:
        "No. Proof-of-work schemas, performance reports, and integration surfaces evolve as your workspace accumulates evidence. Early calls look different from mature ones — by design — because the learning world model is still being built.",
    },
    {
      question: "What do I actually send?",
      answer:
        "Artifacts and traces: documents, recordings, tool logs, session exports, screen captures — anything that proves work happened. The API scores, ranks gaps, and feeds the model that drives what gets asked for next.",
    },
    {
      question: "How does this relate to TAP and ILE?",
      answer:
        "TAP and ILE are hosted product experiences. Proof-of-Work API is the programmable layer underneath — for when you need your own UX, your own gates, or agent-native integration while sharing the same workspace and model.",
    },
    {
      question: "Why call it self-evolving?",
      answer:
        "The system learns what evidence is still missing to complete the learning world model for a user or agent, and surfaces that through updated schemas and measurement — optimizing its own asks over time instead of returning the same checklist forever.",
    },
  ],
  secondaryCta: { label: "View API docs", href: "/docs/proof-of-work-api" },
  closingTitle: "Build your application on a model that keeps learning what to measure.",
  closingBody:
    "Book a demo to see Proof-of-Work API as the foundation for custom verification, optimization, and augmentation — with an interface that grows as your users’ world model does.",
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
        "No. It is the improvement layer inside Uncertain Systems — practice targets what verification surfaced in your actual work context.",
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
        "Yes. Uncertain Systems is built for mixed teams — verification and practice use the same graph and gap model.",
    },
  ],
  closingTitle: "Validate agents on your terms.",
  closingBody:
    "Book a demo to see private agent skill training, scoring, and iteration inside the Uncertain Systems workspace.",
};

export const STASH_API_PAGE: SeoProductPageConfig = {
  slug: "stash-api",
  path: "/products/stash-api",
  eyebrow: "Stash API · alaTAP",
  h1: "Evaluate agents the same way we evaluate humans with TAP.",
  intro:
    "Stash API is the first Agentic Product (alaTAP) — a pure-API Think Aloud Protocol for agents. Stream the same proof-of-work types as Proof-of-Work API into temporary memory, then decide Stash (System 1) or Submit (System 2). Every decision flushes into the regular PoW stack with workspace and user references so scoring can contrast intent the same way TAP does for humans.",
  metaTitle: "Stash API | alaTAP — Agent Evaluation like Think Aloud Protocol",
  metaDescription:
    "Stash API buffers agent proof of work, then Stash (System 1) or Submit (System 2) into Proof-of-Work API. Evaluate agents the same way we evaluate humans with TAP.",
  keywords: [
    "stash API",
    "alaTAP",
    "agent evaluation",
    "agent think aloud",
    "system 1 system 2 agents",
    "proof of work stash submit",
    "agentic product",
  ],
  heroImageAlt: "Stash API — alaTAP agent evaluation",
  useCases: [
    {
      title: "Agent think-aloud over REST",
      description:
        "Orchestrators buffer tool traces, screens, video, and EEG as they work — then call Stash or Submit when the agent parks or commits a reasoning step.",
    },
    {
      title: "System 1 vs System 2 for agents",
      description:
        "Stash marks fast, provisional work (System 1). Submit marks deliberate commits (System 2). Both become durable PoW with intent metadata for scoring.",
    },
    {
      title: "Same meter as human TAP",
      description:
        "Agents are evaluated on the same knowledge-config stack as humans: proof of work → embeddings → distance to labeled regions — not a separate agent quiz.",
    },
    {
      title: "CI and deploy gates with intent",
      description:
        "Flush buffered agent runs as evidence before promotion. Intent (stash vs submit) is first-class, not just the final polished artifact.",
    },
  ],
  highlights: [
    "First Agentic Product (alaTAP) — pure-API TAP for agents",
    "Same PoW types as Proof-of-Work API: tool, screen, video, EEG",
    "Temporary buffer until Stash (System 1) or Submit (System 2); memory resets after flush",
    "Flushes through the regular PoW API with workspace, user, and system flags",
  ],
  faqs: [
    {
      question: "How is Stash API different from Proof-of-Work API?",
      answer:
        "PoW API stores evidence immediately. Stash API holds units in temporary memory until you Stash or Submit — matching TAP’s deliberate intent choice for agents over pure API calls.",
    },
    {
      question: "What happens on Stash vs Submit?",
      answer:
        "Both flush every buffered unit through Proof-of-Work API with workspace and user references. Stash attaches System 1 metadata; Submit attaches System 2. The buffer then resets.",
    },
    {
      question: "Is this a replacement for TAP?",
      answer:
        "No. TAP is the live human protocol. Stash API is alaTAP — the agentic product that applies the same stash/submit evaluation model to agents.",
    },
  ],
  secondaryCta: { label: "View Proof-of-Work API docs", href: "/docs/proof-of-work-api" },
  closingTitle: "Give agents the same evaluation bar as humans.",
  closingBody:
    "Book a demo to see Stash API buffer → stash/submit → PoW scoring for agent workflows on the Uncertain Systems stack.",
};

export const PRODUCT_PAGES = [TIM_PAGE, POW_API_PAGE, STASH_API_PAGE, TAP_PAGE, ILE_PAGE, ALE_PAGE] as const;