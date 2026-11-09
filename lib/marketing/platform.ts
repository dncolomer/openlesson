/**
 * Landing copy: Solve, Verify, and Map as the front door.
 * Pages interpolate these strings so tests drive shipped copy, not a parallel corpus.
 */
import {
  DISCOVERY_CTA_LABEL,
  ENTERPRISE_SETUP_MAILTO,
  HARNESS_PRICING_PATH,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  MAPPING_PRICING_PATH,
  USE_CASES_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";
import { SCIENCE_HUB_PATH } from "@/lib/science/hub";

export const APPROVED_BRAND_ANCHOR =
  "Uncertain Systems is the autopilot for knowledge building, bringing human and artificial intelligence together so people can understand more with less effort." as const;

export const PLATFORM_PHRASE = "From genuine work" as const;

export const PLATFORM_HERO = {
  pill: "UNDERSTAND VERIFY MAP",
  h1: "Build Understanding on autopilot.",
  p1: APPROVED_BRAND_ANCHOR,
  p2: "Work through hard problems, examine the reasoning they reveal, and relate that evidence to knowledge regions built around your domain.",
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
  title: "Solve Protocol, Verify Protocol, Map Protocol.",
} as const;

export const PLATFORM_CORE = {
  eyebrow: "KNOWLEDGE REGIONS",
  title: "A knowledge region is where similar ways of thinking cluster.",
  p1: "Every piece of work done in the system, by people or by agents, is embedded into a custom knowledge embeddings space. Over time, that work forms clusters that group humans and agents who think and solve problems in similar ways within a knowledge area: these are knowledge regions. You can use a region as a target to practise toward, as a frame of reference for assessing a person's or an agent system's fit and knowledge, or as a way to spot gaps worth investigating next.",
  p2: "Knowledge regions can grow organically with expert users or be built synthetically with expert agents. You can also build them privately, as an internal asset for your project, team, or company, without sharing confidential information like internal APIs, strategy documents, or product details.",
  scienceHref: SCIENCE_HUB_PATH,
  scienceLabel: "Read the science",
  visualCaption: "Knowledge · Embeddings · Regions · Distance · Transitions",
  imageSrc: "/regions1.png",
  imageAlt:
    "Illustrative 2D projection of knowledge regions for Physics, Maths, Code, and Design, with positions and distances between them",
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
      image: "/lp-boxes/wiser-logo.png",
      imageAlt: "WISER logo",
      logo: "/lp-boxes/wiser-logo.png",
      logoAlt: "WISER",
    },
    {
      eyebrow: "ETH ZÜRICH",
      name: "First Extropic Thermocomputing Hackathon in Europe",
      body: "Run by us at ETH Zürich.",
      href: "/community-events/probabilistic-computing",
      hrefLabel: "ETH Zürich",
      image: "/lp-boxes/extropic-logo.webp",
      imageAlt: "Extropic logo",
      logo: "/lp-boxes/extropic-logo.webp",
      logoAlt: "Extropic",
    },
  ],
} as const;

export const PLATFORM_OUTCOMES = {
  eyebrow: "USE CASES",
  title: "Put knowledge building to work.",
  lead: "Solve Protocol, Verify Protocol, and Map Protocol can work together when a team needs to understand difficult work, develop expertise, or assess capability through hard problems.",
  cta: DISCOVERY_CTA_LABEL,
  ctaHref: ENTERPRISE_SETUP_MAILTO,
  moreCta: "Read the use cases",
  moreHref: USE_CASES_PATH,
  items: [
    {
      eyebrow: "FRONTIER WORK",
      name: "Understand difficult work",
      body: "Investigate an unfamiliar argument, including AI-generated work, until the assumptions and open questions are explicit.",
      href: `${USE_CASES_PATH}#research-ai`,
      hrefLabel: "Frontier work",
    },
    {
      eyebrow: "ASSESSMENT",
      name: "Assess capability through problems",
      body: "Examine how a candidate explores a demanding problem, including work with an allowed AI tool when the problem says so.",
      href: `${USE_CASES_PATH}#technical-hiring`,
      hrefLabel: "Hard-problem assessment",
    },
    {
      eyebrow: "TEAM INSIGHT",
      name: "Turn work into actionable insight",
      body: "Skills and expertise don't fit on a leaderboard or a two-axis chart. See your team, or yourself, across many dimensions at once, set against the goals that matter to you.",
      href: `${USE_CASES_PATH}#team-insight`,
      hrefLabel: "Team insight",
    },
  ],
} as const;

export const PLATFORM_PRODUCTS = {
  harness: {
    eyebrow: "PROBLEM WORK",
    name: "Solve",
    title: "Solve Protocol",
    body: "The Problem Solving Harness is how Build Understanding works in software today. You work through a demanding problem, make reasoning visible through supported session inputs, and follow up on gaps the work reveals. AI can sit in that working environment where the session supports it. The result is a work trace and a clearer basis for further investigation, not a finished course.",
    href: LEARNING_HARNESS_PATH,
    cta: "Explore understanding",
    pricingHref: HARNESS_PRICING_PATH,
    image: "/lp-boxes/harness-books-blueprint.jpg",
    imageAlt: "Blueprint sketch of an open gridded notebook, a compass, and a stack of volumes",
  },
  verification: {
    eyebrow: "WORK EVIDENCE",
    name: "Verify",
    title: "Verify Protocol",
    body: "Knowledge Verification looks at how someone explores a demanding problem, tests assumptions, and develops their reasoning, alongside the answer they reach. A session stores that work and can relate it to a knowledge region you define. The result is evidence for a hiring or development decision, not a score of the whole person.",
    href: KNOWLEDGE_VERIFICATION_PATH,
    cta: "Explore verification",
    pricingHref: VERIFICATION_PRICING_PATH,
    image: "/lp-boxes/verification-bottles-blueprint.jpg",
    imageAlt: "Blueprint sketch of laboratory bottles with blank plates and red seals",
  },
  mapping: {
    eyebrow: "DOMAIN REFERENCE",
    name: "Map",
    title: "Map Protocol",
    body: "Knowledge Mapping is the domain asset: a knowledge region built around your expertise, with positions informed by work. Use it as a reference while people develop understanding and when you examine that understanding. It is a model of the domain you care about, not a neurological instrument and not a complete picture of competence.",
    href: KNOWLEDGE_MAPPING_PATH,
    cta: "Explore mapping",
    pricingHref: MAPPING_PRICING_PATH,
    image: "/lp-boxes/tapbench-maps-blueprint.jpg",
    imageAlt: "Blueprint sketch of a folded map, compass, and knowledge-region plates",
  },
} as const;

/** Full product catalog: Solve, Verify, Map. */
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
    PLATFORM_HERO.p2,
    PLATFORM_LAYERS.eyebrow,
    PLATFORM_LAYERS.title,
    ...PLATFORM_LAYER_LIST.flatMap((item) => [item.name, item.title, item.body, item.href, item.cta]),
    PLATFORM_CORE.eyebrow,
    PLATFORM_CORE.title,
    PLATFORM_CORE.p1,
    PLATFORM_CORE.p2,
    PLATFORM_CORE.visualCaption,
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
      item.logo,
      item.logoAlt,
    ]),
    PLATFORM_OUTCOMES.eyebrow,
    PLATFORM_OUTCOMES.title,
    PLATFORM_OUTCOMES.lead,
    PLATFORM_OUTCOMES.cta,
    PLATFORM_OUTCOMES.moreCta,
    ...PLATFORM_OUTCOMES.items.flatMap((item) => [
      item.eyebrow,
      item.name,
      item.body,
      item.href ?? "",
      item.hrefLabel ?? "",
    ]),
  ].join("\n");
}
