import type { ApiKeyScope } from "./types";

const ORG_SCOPES: ApiKeyScope[] = ["org:read", "org:write"];

export function hasScope(scopes: ApiKeyScope[], _required?: ApiKeyScope): boolean {
  return Array.isArray(scopes) && scopes.length > 0;
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