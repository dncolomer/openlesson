/**
 * Landing copy: Human Knowledge Platform umbrella + two-product split.
 * Pages interpolate these strings so tests drive shipped copy, not a parallel corpus.
 */
import {
  HARNESS_PRICING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  TAPBENCH_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";
import { HARNESS_PRODUCT_COPY } from "@/lib/marketing/harness-product";

export const PLATFORM_PHRASE = "Human Knowledge Platform" as const;

export const PLATFORM_HERO = {
  pill: "HUMAN KNOWLEDGE PLATFORM",
  h1: "A Human Knowledge Platform.",
  p1: "Uncertain Systems is a Human Knowledge Platform.",
  p2: "A Learning Harness for humans, and Knowledge Verification for companies that need to verify Human Knowledge without traditional tests and exams — with the guarantee that results cannot be cheated or faked.",
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

export const PLATFORM_PRODUCT_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
  PLATFORM_PRODUCTS.tapbench,
] as const;
