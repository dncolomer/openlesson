/** Public marketing routes for the Uncertain Systems IA. */

export const SOLVE_PROTOCOLS_PATH = "/solve-protocols" as const;
export const VERIFY_PROTOCOLS_PATH = "/verify-protocols" as const;
export const MAPPING_PROTOCOLS_PATH = "/mapping-protocols" as const;

/** Canonical product pages. Legacy names stay as aliases for existing imports. */
export const ACQUISITION_PATH = SOLVE_PROTOCOLS_PATH;
export const LEARNING_HARNESS_PATH = SOLVE_PROTOCOLS_PATH;
export const KNOWLEDGE_VERIFICATION_PATH = VERIFY_PROTOCOLS_PATH;
export const KNOWLEDGE_MAPPING_PATH = MAPPING_PROTOCOLS_PATH;
export const USE_CASES_PATH = "/use-cases" as const;
export const SUPPORT_PATH = "/support" as const;
export const HARNESS_PRICING_PATH = "/pricing" as const;
export const VERIFICATION_PRICING_PATH = "/pricing#verification" as const;
export const MAPPING_PRICING_PATH = "/pricing#mapping" as const;
export const AUTHORING_PRICING_PATH = "/pricing/authoring" as const;
export const ACADEMY_K_HREF = "https://academy-k.com/" as const;
export const BRAIN_PRIMING_PATH = "/brain-priming" as const;
export const BRAIN_PRIMING_JOIN_PATH = "/brain-priming/join" as const;

export const ENTERPRISE_SETUP_EMAIL = "daniel@uncertain.systems" as const;
export const ENTERPRISE_SETUP_MAILTO = `mailto:${ENTERPRISE_SETUP_EMAIL}` as const;
export const DISCOVERY_CTA_LABEL = "Discuss your use case" as const;
export const WORKSPACE_NEW_PATH = "/workspace/new" as const;

export function discoveryMailto(subject: string): string {
  return `${ENTERPRISE_SETUP_MAILTO}?subject=${encodeURIComponent(subject)}`;
}
