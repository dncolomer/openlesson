/** Public marketing routes for the Uncertain Systems IA. */

export const VERIFY_PROTOCOLS_PATH = "/verify-protocols" as const;
export const KNOWLEDGE_VERIFICATION_PATH = VERIFY_PROTOCOLS_PATH;
export const USE_CASES_PATH = "/use-cases" as const;
export const HARNESS_PRICING_PATH = "/pricing" as const;
export const VERIFICATION_PRICING_PATH = "/pricing#verification" as const;
export const ACADEMY_K_HREF = "https://academy-k.com/" as const;

export const ENTERPRISE_SETUP_EMAIL = "daniel@uncertain.systems" as const;
export const ENTERPRISE_SETUP_MAILTO = `mailto:${ENTERPRISE_SETUP_EMAIL}` as const;
export const DISCOVERY_CTA_LABEL = "Discuss your use case" as const;

export function discoveryMailto(subject: string): string {
  return `${ENTERPRISE_SETUP_MAILTO}?subject=${encodeURIComponent(subject)}`;
}
