import {
  ACADEMY_K_HREF,
  HARNESS_PRICING_PATH,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
  USE_CASES_PATH,
} from "@/lib/marketing/paths";

export const PLATFORM_NAV_LABEL = "Explore the Protocols" as const;

export const MAIN_NAV_PRODUCT_LINKS = [
  { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verify Protocols" },
  { href: KNOWLEDGE_MAPPING_PATH, label: "Mapping Protocols" },
  { href: LEARNING_HARNESS_PATH, label: "Solve / Practice Protocols" },
] as const;

export const USE_CASES_NAV_LINK = {
  href: USE_CASES_PATH,
  label: "Use cases",
} as const;

export const PRICING_NAV_LINKS = [
  { href: HARNESS_PRICING_PATH, label: "Pricing" },
] as const;

/** Community dropdown — AYCL lives under Solve, not here. */
export const COMMUNITY_LINKS = [
  { href: "/community-events", label: "Community Events" },
  { href: ACADEMY_K_HREF, label: "Academy-k" },
] as const;

export const COMMUNITY_NAV_LABEL = "Projects" as const;

export const TOP_LINKS = [
  { href: "/science", label: "Vision" },
] as const;
