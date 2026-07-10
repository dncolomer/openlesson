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

const BASE_URL = "https://openlesson.academy";
const DEFAULT_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

export const PLATFORM_PAGE: SeoPlatformPageConfig = {
  slug: "platform",
  path: "/platform",
  eyebrow: "Knowledge Workspace",
  h1: "Verify and augment learning where knowledge work happens.",
  intro:
    "openLesson is a knowledge workspace with software tools that verify learning through evidence, proof of work, and cognitive analysis — then augment it with targeted practice. Humans and AI agents perform real work inside the workspace; openLesson scores whether they actually learned, and routes gaps into improvement loops.",
  metaTitle: "Knowledge Workspace: Learning Efficiency for Humans & Agents",
  metaDescription:
    "A knowledge workspace that measures learning efficiency from evidence and augments gaps with practice. Evidence API, Think Aloud Protocol, ILE, and ALE for humans and agents.",
  keywords: [
    "knowledge workspace",
    "learning efficiency",
    "augmented learning",
    "evidence API",
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
        "A Verification Workspace is where knowledge work lives: skills, scenarios, and decision domains broken into assessable blocks on a learning graph. Documents, screen shares, tool traces, transcripts, and session artifacts accumulate as work happens.",
        "Software tools run on top of that context — not beside it. Verification scores learning from evidence; augmentation routes gaps into practice. One workspace, continuous signal, auditable improvement.",
      ],
    },
    {
      title: "Verify: Evidence API",
      paragraphs: [
        "The Evidence API is headless learning efficiency scoring for humans and agents. Send unstructured artifacts and tool traces; receive continuous readiness scores with severity-ranked gap analysis. No hosted session required.",
        "Use it when work already produces evidence: agent tool traces, call transcripts, screen captures, documents. Verify skills and judgment before deploy gates or high-stakes handoffs — beyond benchmark pass rates and quiz completion.",
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
        "Augmentation is not a separate LMS. It is the improvement layer wired to verification findings, so practice targets what actually broke, with evidence of progress along the way.",
      ],
    },
    {
      title: "Augment: Agentic Learning Environment",
      paragraphs: [
        "The Agentic Learning Environment (ALE) is where skill.md developers test and evolve agent skills against workspace scenarios. Run agents, inspect tool-use traces, and iterate on skill definitions until Evidence API scores clear your deploy bar.",
        "ALE mirrors the ILE loop for the agentic side: verification surfaces gaps in tool use and reasoning; developers refine skills in a sandbox until learning evidence supports production deployment.",
      ],
    },
    {
      title: "The verify-and-augment loop",
      paragraphs: [
        "Pipe artifacts into Evidence API for continuous scoring. Issue Think Aloud Protocol links when you need live human cognition under probe. Route human gaps into the ILE. Evolve agent skills in ALE against the same workspace.",
        "All tools share one knowledge graph, one scoring model, and one gap analysis. Verify learning, augment where it falls short, and prove improvement with auditable evidence at every step.",
      ],
    },
    {
      title: "Evidence API: programmatic workspace access",
      paragraphs: [
        "The Evidence API is how builders wire the knowledge workspace into their stack. Create workspaces, upload evidence, request performance reports, issue Think Aloud Protocol links, poll session results, and trigger ILE practice blocks.",
        "Embed verification and augmentation into CI pipelines, internal portals, agent orchestration, or any system where humans and agents perform knowledge work.",
      ],
    },
  ],
  faqs: [
    {
      question: "What is a knowledge workspace?",
      answer:
        "A Verification Workspace structures real knowledge work into assessable blocks and accumulates evidence as humans and agents perform tasks. Software tools verify learning from that evidence and augment it with targeted practice — all in one place.",
    },
    {
      question: "What software tools run in the workspace?",
      answer:
        "Evidence API (headless verification from artifacts), Think Aloud Protocol (live human cognition under probe), the Integrated Learning Environment (human practice and improvement), and the Agentic Learning Environment (agent skill iteration for skill.md developers).",
    },
    {
      question: "When should I use Evidence API vs. Think Aloud Protocol?",
      answer:
        "Use Evidence API when you have artifacts or tool traces and want continuous scoring without a hosted session. Use Think Aloud Protocol when you need live human reasoning under Socratic probe — the signal hidden behind AI-assisted deliverables.",
    },
    {
      question: "How does augmentation connect to verification?",
      answer:
        "Gap findings from Evidence API or Think Aloud Protocol route directly into ILE practice blocks or ALE skill iterations. Augmentation targets specific failures verification surfaced — not generic content libraries.",
    },
    {
      question: "What evidence can a workspace accumulate?",
      answer:
        "Documents, screen recordings, video, EEG traces, call transcripts, tool traces, think-aloud transcripts, and any artifact produced during knowledge work. Enrich programmatically via the Evidence API or manual upload.",
    },
    {
      question: "Who is openLesson for?",
      answer:
        "Teams where humans and AI agents perform knowledge work and need to verify learning with evidence — then augment it when gaps appear. Builders embedding verification and practice tools via API.",
    },
  ],
  primaryCta: { label: "Create a Verification Workspace", href: "/workspace/new" },
  secondaryCta: { label: "Evidence API docs", href: "/docs/agentic-v2" },
  closingTitle: "Verify learning. Augment where it breaks.",
  closingBody:
    "Stop trusting outputs and completion rates. Use software tools in a knowledge workspace to verify learning with evidence, and augment it until scores move.",
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