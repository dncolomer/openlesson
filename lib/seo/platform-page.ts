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

export type SeoPlatformPageConfig = {
  slug: string;
  path: string;
  eyebrow: string;
  h1: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  sections: SeoSection[];
  faqs: SeoFaq[];
  primaryCta: SeoCtaLink;
  secondaryCta?: SeoCtaLink;
  closingTitle: string;
  closingBody: string;
};

const BASE_URL = "https://uncertain.systems";
const DEFAULT_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

export const PLATFORM_PAGE: SeoPlatformPageConfig = {
  slug: "platform",
  path: "/platform",
  eyebrow: "Knowledge Workspace",
  h1: "Verify and augment learning where knowledge work happens.",
  intro:
    "Uncertain Systems is a knowledge workspace with software tools that verify learning through proof of work, proof of work, and cognitive analysis — then augment it with targeted practice. Humans and AI agents perform real work inside the workspace; Uncertain Systems scores whether they actually learned, and routes gaps into improvement loops.",
  metaTitle: "Knowledge Workspace: Learning Efficiency for Humans & Agents",
  metaDescription:
    "A knowledge workspace that measures learning efficiency from proof of work and augments gaps with practice. Proof-of-Work API, Think Aloud Protocol, ILE, and ALE for humans and agents.",
  keywords: [
    "knowledge workspace",
    "learning efficiency",
    "augmented learning",
    "Proof-of-Work API",
    "think aloud protocol",
    "integrated learning environment",
    "agentic learning environment",
    "proof of work",
    "cognitive analysis",
    "skills gap analysis",
  ],
  sections: [
    {
      title: "The knowledge workspace",
      paragraphs: [
        "A Workspace is where knowledge work lives: skills, scenarios, and decision domains broken into assessable blocks on a learning graph. Documents, screen shares, tool traces, transcripts, and session artifacts accumulate as work happens.",
        "Software tools run on top of that context — not beside it. Verification scores learning from proof of work; augmentation routes gaps into practice. One workspace, continuous signal, auditable improvement.",
      ],
    },
    {
      title: "Verify: Proof-of-Work API",
      paragraphs: [
        "The Proof-of-Work API is headless learning efficiency scoring for humans and agents. Send unstructured artifacts and tool traces; receive continuous readiness scores with severity-ranked gap analysis. No hosted session required.",
        "Use it when work already produces proof_of_work: agent tool traces, call transcripts, screen captures, documents. Verify skills and judgment before deploy gates or high-stakes handoffs — beyond benchmark pass rates and quiz completion.",
      ],
    },
    {
      title: "Verify: Think Aloud Protocol",
      paragraphs: [
        "Think Aloud Protocol (TAP) captures live human cognition inside the workspace. Issue shareable URLs scoped to a block or entire workspace. People verbalize reasoning while working — signal that polished AI-assisted output cannot fabricate.",
        "Speech becomes think-aloud traces. Socratic probes target hesitations, revisions, and causal chains. Results include marker scores, per-marker rationale, and auditable gap reports.",
      ],
    },
    {
      title: "Augment: Integrated Learning Environment",
      paragraphs: [
        "The ILE is where humans improve after verification surfaces gaps. Guided practice, think-aloud sessions, Socratic follow-ups, and targeted blocks until scores move — all inside the same workspace context.",
        "Augmentation is not a separate LMS. It is the improvement layer wired to verification findings, so practice targets what actually broke, with proof of work of progress along the way.",
      ],
    },
    {
      title: "Augment: Agentic Learning Environment",
      paragraphs: [
        "The Agentic Learning Environment (ALE) is where skill.md developers test and evolve agent skills against workspace scenarios. Run agents, inspect tool-use traces, and iterate on skill definitions until Proof-of-Work API scores clear your deploy bar.",
        "ALE mirrors the ILE loop for the agentic side: verification surfaces gaps in tool use and reasoning; developers refine skills in a sandbox until learning proof of work supports production deployment.",
      ],
    },
    {
      title: "The verify-and-augment loop",
      paragraphs: [
        "Pipe artifacts into Proof-of-Work API for continuous scoring. Issue Think Aloud Protocol links when you need live human cognition under probe. Route human gaps into the ILE. Evolve agent skills in ALE against the same workspace.",
        "All tools share one knowledge graph, one scoring model, and one gap analysis. Verify learning, augment where it falls short, and prove improvement with auditable proof of work at every step.",
      ],
    },
    {
      title: "Proof-of-Work API: programmatic workspace access",
      paragraphs: [
        "The Proof-of-Work API is how builders wire the Workspace into their stack. Create workspaces, upload proof of work, request unified performance reports, issue Think Aloud Protocol links, poll TAP completion, and trigger ILE practice blocks.",
        "Embed verification and augmentation into CI pipelines, internal portals, agent orchestration, or any system where humans and agents perform knowledge work.",
      ],
    },
  ],
  faqs: [
    {
      question: "What is a knowledge workspace?",
      answer:
        "A Workspace structures real knowledge work into assessable blocks and accumulates proof of work as humans and agents perform tasks. Software tools verify learning from that proof of work and augment it with targeted practice — all in one place.",
    },
    {
      question: "What software tools run in the workspace?",
      answer:
        "Proof-of-Work API (headless verification from artifacts), Think Aloud Protocol (live human cognition under probe), the Integrated Learning Environment (human practice and improvement), and the Agentic Learning Environment (agent skill iteration for skill.md developers).",
    },
    {
      question: "When should I use Proof-of-Work API vs. Think Aloud Protocol?",
      answer:
        "Use Proof-of-Work API when you have artifacts or tool traces and want continuous scoring without a hosted session. Use Think Aloud Protocol when you need live human reasoning under Socratic probe — the signal hidden behind AI-assisted deliverables.",
    },
    {
      question: "How does augmentation connect to verification?",
      answer:
        "Gap findings from Proof-of-Work API or Think Aloud Protocol route directly into ILE practice blocks or ALE skill iterations. Augmentation targets specific failures verification surfaced — not generic content libraries.",
    },
    {
      question: "What proof of work can a workspace accumulate?",
      answer:
        "Documents, screen recordings, video, EEG traces, call transcripts, tool traces, think-aloud transcripts, and any artifact produced during knowledge work. Enrich programmatically via the Proof-of-Work API or manual upload.",
    },
    {
      question: "Who is Uncertain Systems for?",
      answer:
        "Teams where humans and AI agents perform knowledge work and need to verify learning with proof of work — then augment it when gaps appear. Builders embedding verification and practice tools via API.",
    },
  ],
  primaryCta: { label: "Create a Workspace", href: "/workspace/new" },
  secondaryCta: { label: "Proof-of-Work API docs", href: "/docs/proof-of-work-api" },
  closingTitle: "Verify learning. Augment where it breaks.",
  closingBody:
    "Stop trusting outputs and completion rates. Use software tools in a knowledge workspace to verify learning with proof of work, and augment it until scores move.",
};

export function platformMetadata(page: SeoPlatformPageConfig): Metadata {
  const url = `${BASE_URL}${page.path}`;
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