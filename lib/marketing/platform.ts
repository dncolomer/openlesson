/**
 * Landing copy: knowledge acquisition, verification, and mapping as the front door.
 * Pages interpolate these strings so tests drive shipped copy, not a parallel corpus.
 */
import {
  HARNESS_PRICING_PATH,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  MAPPING_PRICING_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";

export const PLATFORM_PHRASE = "From genuine work" as const;

export const PLATFORM_HERO = {
  pill: "ACQUIRE VERIFY MAP",
  h1: "From genuine work.",
  p1: "Uncertain Systems is built around work you actually do. Capture it as proof, embed it, and define knowledge regions in that space. From there you can acquire knowledge, craft insights, verify what a person or an agentic harness knows, and run studies that sit neurological patterns next to those regions.",
} as const;

export const PLATFORM_PUBLIC_MAPS = {
  title: "Explore our Learning Maps",
  lead: "Try out any of our learning maps.",
  signupHref: "/register",
} as const;

export const PLATFORM_SPINE = {
  eyebrow: "WHAT YOU GET",
  title: "Curriculum, workspace, proof, and a live layer.",
  items: [
    {
      eyebrow: "01",
      name: "Authored curriculum",
      body: "Expert-grade assets (we adapt to your specific needs).",
    },
    {
      eyebrow: "02",
      name: "Unsys workspace",
      body: "Course-seeded Problem Solving Harness. Learners keep lifetime access and can grow it past the course.",
    },
    {
      eyebrow: "03",
      name: "Optional skill validation",
      body: "Knowledge Verification: proof from real work, not cheatable exams.",
    },
    {
      eyebrow: "04",
      name: "Optional live layer",
      body: "Mentors, intensive / on-site training, hardware labs.",
    },
  ],
} as const;

export const PLATFORM_DELIVERY = {
  eyebrow: "TWO WAYS TO RUN IT",
  title: "Program embed or on-site training.",
  lead: "Program embeds and on-site training use the same curriculum and workspace.",
  items: [
    {
      eyebrow: "PROGRAM EMBED",
      name: "Program embed",
      body: "We author hard modules for institutes and workforce programs. Every student gets an Unsys workspace scoped to the course, theirs for life.",
    },
    {
      eyebrow: "ON-SITE",
      name: "On-site training / intensive",
      body: "Sometimes async and online is a no-go. We learn by interacting with the real world.",
    },
  ],
} as const;

export const PLATFORM_LAYERS = {
  eyebrow: "THREE USES",
  title: "Knowledge Acquisition, Knowledge Verification, Knowledge Mapping.",
} as const;

export const PLATFORM_CORE = {
  eyebrow: "KNOWLEDGE REGIONS",
  title: "Build knowledge embedding models and knowledge regions.",
  p1: "At the core of the platform is the knowledge region: a territory in an embedding space built from genuine work. Uncertain Systems gives you tools to capture proof of work, then tools to build embedding models over those traces and to define regions in that space.",
  p2: "People, agents, and studies sit as positions. Distance is how close a position is to a region. Transitions are how that position moves as work continues.",
  p3: "The model is extensible. Audiovisual work, BCI streams, and other scientific signals can feed the same geometry, especially for studies that correlate neurological patterns with knowledge regions.",
  visualCaption: "Knowledge · Embeddings · Regions · Distance · Transitions",
  visualBody:
    "Proof of work becomes an embedding. Knowledge regions are the territories. Positions, distances, and transitions are how you read the space.",
  imageSrc: "/lp-boxes/knowledge-embedding-blueprint-v1.jpg",
  imageAlt:
    "Blueprint of overlapping drafted sheets of plotted knowledge-region points, with a gold path, loupe, and compass",
} as const;

export const PLATFORM_PROOF = {
  eyebrow: "CASE STUDIES",
  title: "They trust us",
  items: [
    {
      eyebrow: "WISER",
      name: "Specialized course authoring for WISER",
      body: "Slides + videos + Capstone + Notebooks + lifetime access to our Unsys workspaces for students.",
      href: "https://thewiser.org",
      hrefLabel: "thewiser.org",
      image: "/lp-boxes/wiser-blueprint.jpg",
      imageAlt: "Blueprint of a course-authoring kit: open notebook, stacked volumes, compass, and a video plate",
      logo: "/lp-boxes/wiser-logo.png",
      logoAlt: "WISER",
    },
    {
      eyebrow: "ETH ZÜRICH",
      name: "First Extropic Thermocomputing Hackathon in Europe",
      body: "Run by us at ETH Zürich.",
      href: "/community-events/probabilistic-computing",
      hrefLabel: "ETH Zürich",
      image: "/lp-boxes/eth-hackathon-blueprint.jpg",
      imageAlt: "Blueprint of thermodynamic computing chips from the ETH Zürich hackathon",
    },
  ],
} as const;

export const PLATFORM_PRODUCTS = {
  harness: {
    eyebrow: "FRONTIER TECH",
    name: "Knowledge Acquisition",
    title: "Knowledge Acquisition",
    body: "A problem-solving harness for frontier tech research and learning. Use it to acquire a field as it is being made: photonic computing, new materials, BCI systems, agent tooling. The harness is the working piece of a bottom-up approach based on the Free Energy Principle and epistemic foraging, and the work you do is captured as proof.",
    href: LEARNING_HARNESS_PATH,
    cta: "Explore",
    pricingHref: HARNESS_PRICING_PATH,
    image: "/lp-boxes/harness-books-blueprint.jpg",
    imageAlt: "Blueprint sketch of an open gridded notebook, a compass, and a stack of volumes",
  },
  verification: {
    eyebrow: "HUMANS AND AGENTS",
    name: "Knowledge Verification",
    title: "Knowledge Verification",
    body: "Verify that a person actually holds a skill from genuine work traces, without traditional tests. Results cannot be cheated or faked. The same stack benchmarks the knowledge of agentic harnesses, so labs and teams can score what a given agent setup knows.",
    href: KNOWLEDGE_VERIFICATION_PATH,
    cta: "Explore",
    pricingHref: VERIFICATION_PRICING_PATH,
    image: "/lp-boxes/verification-bottles-blueprint.jpg",
    imageAlt: "Blueprint sketch of laboratory bottles with blank plates and red seals",
  },
  mapping: {
    eyebrow: "FOR SCIENCE",
    name: "Knowledge Mapping",
    title: "Knowledge Mapping",
    body: "A product for science. Build studies that look for correlations between neurological patterns and knowledge regions: where a person sits in the embedding, and what the brain is doing there. Use it to study knowledge and to study the brain.",
    href: KNOWLEDGE_MAPPING_PATH,
    cta: "Explore",
    pricingHref: MAPPING_PRICING_PATH,
    image: "/lp-boxes/tapbench-maps-blueprint.jpg",
    imageAlt: "Blueprint sketch of a folded map, compass, and knowledge-region plates",
  },
} as const;

/** Full product catalog: Knowledge Acquisition, Knowledge Verification, Knowledge Mapping. */
export const PLATFORM_PRODUCT_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
  PLATFORM_PRODUCTS.mapping,
] as const;

export const PLATFORM_LAYER_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
  PLATFORM_PRODUCTS.mapping,
] as const;

/** Flattened homepage copy for contract tests that drive the shipped module. */
export function homepageCopyText(): string {
  return [
    PLATFORM_HERO.pill,
    PLATFORM_HERO.h1,
    PLATFORM_HERO.p1,
    PLATFORM_LAYERS.eyebrow,
    PLATFORM_LAYERS.title,
    ...PLATFORM_LAYER_LIST.flatMap((item) => [item.name, item.title, item.body, item.href]),
    PLATFORM_CORE.eyebrow,
    PLATFORM_CORE.title,
    PLATFORM_CORE.p1,
    PLATFORM_CORE.p2,
    PLATFORM_CORE.p3,
    PLATFORM_CORE.visualCaption,
    PLATFORM_CORE.visualBody,
    PLATFORM_CORE.imageSrc,
    PLATFORM_CORE.imageAlt,
    PLATFORM_PROOF.eyebrow,
    PLATFORM_PROOF.title,
    ...PLATFORM_PROOF.items.flatMap((item) => [
      item.eyebrow,
      item.name,
      item.body,
      item.href ?? "",
      item.hrefLabel ?? "",
      item.image,
      item.imageAlt,
      "logo" in item ? item.logo : "",
      "logoAlt" in item ? item.logoAlt : "",
    ]),
  ].join("\n");
}
