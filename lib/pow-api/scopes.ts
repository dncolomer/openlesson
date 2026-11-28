import type { ApiKeyScope } from "./types";

export const VALID_API_KEY_SCOPES: readonly ApiKeyScope[] = [
  "protocols:read",
  "protocols:write",
  "knowledge-regions:read",
  "knowledge-regions:write",
  "sessions:read",
  "sessions:write",
  "org:read",
  "org:write",
  "*",
] as const;

const VALID_SCOPE_SET = new Set<string>(VALID_API_KEY_SCOPES);
const ORG_SCOPES: ApiKeyScope[] = ["org:read", "org:write"];

export function isValidApiKeyScope(value: unknown): value is ApiKeyScope {
  return typeof value === "string" && VALID_SCOPE_SET.has(value);
}

export function parseRequestedApiKeyScopes(
  raw: unknown,
): { ok: true; scopes: ApiKeyScope[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, scopes: [...DEFAULT_API_KEY_SCOPES] };
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, message: "scopes must be a non-empty array of valid scopes" };
  }
  const invalid = raw.filter((s) => !isValidApiKeyScope(s));
  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid scope(s): ${invalid.map(String).join(", ")}. Valid scopes: ${VALID_API_KEY_SCOPES.join(", ")}`,
    };
  }
  const deduped = [...new Set(raw as ApiKeyScope[])];
  return { ok: true, scopes: deduped };
}

export function hasScope(scopes: ApiKeyScope[], required?: ApiKeyScope): boolean {
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  if (!required) return true;
  return scopes.includes("*") || scopes.includes(required);
}

export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = ["*"];

/** Scopes issued to organization guest API keys (`gsk_`). */
export const GUEST_API_KEY_SCOPES: ApiKeyScope[] = ["*"];

export function requiresOrgAdminScope(scopes: ApiKeyScope[]): boolean {
  return scopes.some((scope) => ORG_SCOPES.includes(scope) || scope === "*");
}

export function canAssignApiKeyScopes(profile: {
  is_org_admin?: boolean | null;
  is_admin?: boolean | null;
}): boolean {
  return profile.is_org_admin === true || profile.is_admin === true;
}

export function validateAssignableScopes(
  scopes: ApiKeyScope[],
  profile: { is_org_admin?: boolean | null; is_admin?: boolean | null }
): { ok: true; scopes: ApiKeyScope[] } | { ok: false; message: string } {
  if (requiresOrgAdminScope(scopes) && !canAssignApiKeyScopes(profile)) {
    return {
      ok: false,
      message: "org:read and org:write scopes require organization admin access",
    };
  }
  return { ok: true, scopes };
}
