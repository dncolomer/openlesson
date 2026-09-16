/**
 * Landing copy: hard-domain learning experiences as the front door.
 * Pages interpolate these strings so tests drive shipped copy, not a parallel corpus.
 */
import {
  ENTERPRISE_SETUP_EMAIL,
  ENTERPRISE_SETUP_MAILTO,
  HARNESS_PRICING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  TAPBENCH_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";

export const PLATFORM_PHRASE = "Hard-domain learning experiences" as const;

export const PLATFORM_HERO = {
  pill: "HARD-DOMAIN LEARNING",
  h1: "We author and run hard-domain learning experiences where experts are scarce.",
  p1: "Frontier topics don't fail because people lack curiosity. They fail because the people who can teach them won't build the course.",
  p2: "Frontier topics are not learned by dumping slides in front of an audience. They need a different approach: an active search that shrinks what you don't know, instead of a lecture you sit through. We author and run them that way.",
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
      body: "Course-seeded Learning Harness. Learners keep lifetime access and can grow it past the course.",
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
  eyebrow: "INSIDE THE EXPERIENCE",
  title: "Learning Harness, Knowledge Verification, Custom Knowledge Mapping.",
} as const;

export const PLATFORM_PROOF = {
  eyebrow: "CASE STUDIES",
  title: "Case Studies, Existing Projects & Clients.",
  items: [
    {
      eyebrow: "WISER",
      name: "Specialized course authoring for WISER",
      body: "Slides + videos + Capstone + Notebooks + lifetime access to our Unsys workspaces for students.",
      href: "https://thewiser.org",
      hrefLabel: "thewiser.org",
      image: "/lp-boxes/wiser.jpg",
      imageAlt: "Researchers collaborating over a laptop in a lab",
    },
    {
      eyebrow: "ETH ZÜRICH",
      name: "First Extropic Thermocomputing Hackathon in Europe",
      body: "Run by us at ETH Zürich.",
      href: "/community-events/probabilistic-computing",
      hrefLabel: "ETH Zürich",
      image: "/lp-boxes/eth-hackathon.jpg",
      imageAlt: "Extropic thermodynamic computing chips from the ETH Zürich hackathon",
    },
  ],
} as const;

export const PLATFORM_CTA = {
  eyebrow: "CONTACT",
  title: "Scope a program embed or on-site training.",
  label: "Scope a program embed or on-site training",
  href: ENTERPRISE_SETUP_MAILTO,
  email: ENTERPRISE_SETUP_EMAIL,
} as const;

export const PLATFORM_PRODUCTS = {
  harness: {
    eyebrow: "FOR HUMANS",
    name: "Learning Harness",
    title: "A Learning Harness for Humans",
    body: HARNESS_PRODUCT_COPY.lead,
    href: LEARNING_HARNESS_PATH,
    cta: "Explore",
    pricingHref: HARNESS_PRICING_PATH,
    image: "/lp-boxes/harness-books.jpg",
    imageAlt: "A small cluster of antique books and a compass on an empty abstract background",
  },
  verification: {
    eyebrow: "FOR ENTERPRISE",
    name: "Knowledge Verification",
    title: "Knowledge Verification",
    body: "Verify Human Knowledge without traditional tests and exams. Results cannot be cheated or faked — uncheatable proof from genuine work.",
    href: KNOWLEDGE_VERIFICATION_PATH,
    cta: "Explore",
    pricingHref: VERIFICATION_PRICING_PATH,
    image: "/lp-boxes/verification-bottles.jpg",
    imageAlt: "A small cluster of experimental bottles and test tubes on an empty abstract background",
  },
  tapbench: {
    eyebrow: "FOR SCIENCE",
    name: "TAPBench",
    title: "Knowledge Mapping",
    body: "TAP-Bench: Think-Aloud Protocol + Benchmark. An instrument for measuring knowledge in configuration space.",
    href: TAPBENCH_PATH,
    cta: "Explore",
    image: "/lp-boxes/tapbench-maps.jpg",
    imageAlt: "A small cluster of maps, a compass, and a magnifying glass on an empty abstract background",
  },
} as const;

/** Full product catalog. TAPBench stays here and on /tapbench. */
export const PLATFORM_PRODUCT_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
  PLATFORM_PRODUCTS.tapbench,
] as const;

export const PLATFORM_LAYER_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
  {
    ...PLATFORM_PRODUCTS.tapbench,
    eyebrow: "MAPPING",
    name: "Custom Knowledge Mapping",
    title: "Custom Knowledge Mapping",
    body: "We use this tech to see where a target audience actually is. Knowledge, mapped.",
  },
] as const;

/** Flattened homepage copy for contract tests that drive the shipped module. */
export function homepageCopyText(): string {
  return [
    PLATFORM_HERO.pill,
    PLATFORM_HERO.h1,
    PLATFORM_HERO.p1,
    PLATFORM_HERO.p2,
    PLATFORM_SPINE.eyebrow,
    PLATFORM_SPINE.title,
    ...PLATFORM_SPINE.items.flatMap((item) => [item.eyebrow, item.name, item.body]),
    PLATFORM_DELIVERY.eyebrow,
    PLATFORM_DELIVERY.title,
    PLATFORM_DELIVERY.lead,
    ...PLATFORM_DELIVERY.items.flatMap((item) => [item.eyebrow, item.name, item.body]),
    PLATFORM_LAYERS.eyebrow,
    PLATFORM_LAYERS.title,
    ...PLATFORM_LAYER_LIST.flatMap((item) => [item.name, item.title, item.body, item.href]),
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
    ]),
    PLATFORM_CTA.eyebrow,
    PLATFORM_CTA.title,
    PLATFORM_CTA.label,
    PLATFORM_CTA.href,
    PLATFORM_CTA.email,
  ].join("\n");
}
