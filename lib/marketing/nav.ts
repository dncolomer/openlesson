import {
  ACADEMY_K_HREF,
  AUTHORING_PRICING_PATH,
  HARNESS_PRICING_PATH,
  KNOWLEDGE_MAPPING_PATH,
  KNOWLEDGE_VERIFICATION_PATH,
  LEARNING_HARNESS_PATH,
} from "@/lib/marketing/paths";

export const MAIN_NAV_PRODUCT_LINKS = [
  { href: LEARNING_HARNESS_PATH, label: "Harness" },
  { href: KNOWLEDGE_VERIFICATION_PATH, label: "Verification" },
  { href: KNOWLEDGE_MAPPING_PATH, label: "Mapping" },
] as const;

export const PRICING_NAV_LINKS = [
  { href: HARNESS_PRICING_PATH, label: "Modules" },
  { href: AUTHORING_PRICING_PATH, label: "Authoring" },
] as const;

/** Community dropdown — AYCL lives under the Learning Harness product, not here. */
export const COMMUNITY_LINKS = [
  { href: "/community-events", label: "Community Events" },
  { href: "/kardashev", label: "Kardashev Research" },
  { href: ACADEMY_K_HREF, label: "Academy-k" },
] as const;

export const COMMUNITY_NAV_LABEL = "Projects" as const;

export const TOP_LINKS = [
  { href: "/science", label: "Vision" },
] as const;
