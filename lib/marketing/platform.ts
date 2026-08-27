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
    image: "/lp-boxes/harness-study-table.jpg",
    imageAlt: "A Greco-futurist marble study table crowded with books, scrolls, compasses, and drafting tools",
  },
  verification: {
    eyebrow: "FOR ENTERPRISE",
    name: "Knowledge Verification",
    title: "Knowledge Verification",
    body: "Verify Human Knowledge without traditional tests and exams. Results cannot be cheated or faked — uncheatable proof from genuine work.",
    href: KNOWLEDGE_VERIFICATION_PATH,
    cta: "Explore",
    pricingHref: VERIFICATION_PRICING_PATH,
    image: "/lp-boxes/verification-lab-table.jpg",
    imageAlt: "Greco-futurist marble table set as a chemical lab with bottles, test tubes, and testing instruments",
  },
  tapbench: {
    eyebrow: "FOR SCIENCE",
    name: "TAPBench",
    title: "Knowledge Mapping",
    body: "TAP-Bench: Think-Aloud Protocol + Benchmark. An instrument for measuring knowledge in configuration space.",
    href: TAPBENCH_PATH,
    cta: "Explore",
    image: "/lp-boxes/tapbench-maps-desk.jpg",
    imageAlt: "Greco-futurist marble table covered with rolled and unfolded maps, a star chart, and cartography tools",
  },
} as const;

export const PLATFORM_PRODUCT_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
  PLATFORM_PRODUCTS.tapbench,
] as const;
