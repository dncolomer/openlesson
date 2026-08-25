/**
 * Landing copy: Human Knowledge Platform umbrella + two-product split.
 * Pages interpolate these strings so tests drive shipped copy, not a parallel corpus.
 */
import {
  HARNESS_PRICING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";

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
    title: "A Learning Harness for humans",
    body: "A system for knowledge acquisition. Practice, map, and grow what you hold. All-You-Can-Learn lifetime workspaces live here.",
    href: LEARNING_HARNESS_PATH,
    cta: "Explore the Learning Harness",
    pricingHref: HARNESS_PRICING_PATH,
    image: "/aesthetics/lp-boxes/harness-study-table.jpg",
    imageAlt: "A Greco-futurist marble study table crowded with books, scrolls, compasses, and drafting tools",
  },
  verification: {
    eyebrow: "FOR ENTERPRISE",
    name: "Knowledge Verification",
    title: "Knowledge Verification",
    body: "Verify Human Knowledge without traditional tests and exams. Results cannot be cheated or faked — uncheatable proof from genuine work.",
    href: KNOWLEDGE_VERIFICATION_PATH,
    cta: "Explore Knowledge Verification",
    pricingHref: VERIFICATION_PRICING_PATH,
    image: "/aesthetics/lp-boxes/verification-region-map.jpg",
    imageAlt: "Abstract knowledge map: overlapping circular regions, clustered dots, and bronze metadata plaques on dark marble",
  },
} as const;

export const PLATFORM_PRODUCT_LIST = [
  PLATFORM_PRODUCTS.harness,
  PLATFORM_PRODUCTS.verification,
] as const;
