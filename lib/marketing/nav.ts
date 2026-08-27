import {
  HARNESS_PRICING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  TAPBENCH_PATH,
  VERIFICATION_PRICING_PATH,
} from "@/lib/marketing/paths";

export const MAIN_NAV_PRODUCT_LINKS = [
  { href: LEARNING_HARNESS_PATH, label: "Harness" },
  { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verification" },
] as const;

export const PRICING_NAV_LINKS = [
  { href: HARNESS_PRICING_PATH, label: "Harness" },
  { href: VERIFICATION_PRICING_PATH, label: "Verification" },
] as const;

/** Community dropdown — AYCL lives under the Learning Harness product, not here. */
export const COMMUNITY_LINKS = [
  { href: "/community-events", label: "Community Events" },
  { href: "/map-of-knowledge", label: "The Map of Knowledge" },
  { href: TAPBENCH_PATH, label: "TAPBench" },
] as const;

export const COMMUNITY_NAV_LABEL = "Projects" as const;

export const TOP_LINKS = [
  { href: "/vision", label: "Vision" },
  { href: "/science", label: "Science" },
] as const;
