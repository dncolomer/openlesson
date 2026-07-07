import type { ApiKeyScope } from "./types";

const ORG_SCOPES: ApiKeyScope[] = ["org:read", "org:write"];

const TAP_SCOPE_EQUIVALENTS: Partial<Record<ApiKeyScope, ApiKeyScope[]>> = {
  "tap:read": ["tap:read", "ghl:read"],
  "tap:write": ["tap:write", "ghl:write"],
  "ghl:read": ["tap:read", "ghl:read"],
  "ghl:write": ["tap:write", "ghl:write"],
};

export function hasScope(scopes: ApiKeyScope[], required: ApiKeyScope): boolean {
  if (scopes.includes("*")) return true;
  const equivalents = TAP_SCOPE_EQUIVALENTS[required];
  if (equivalents) return equivalents.some((scope) => scopes.includes(scope));
  return scopes.includes(required);
}

export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = [
  "workspaces:read",
  "workspaces:write",
  "tap:read",
  "tap:write",
];

/** Scopes issued to organization guest API keys (`gsk_`). */
export const GUEST_API_KEY_SCOPES: ApiKeyScope[] = [
  "workspaces:read",
  "workspaces:write",
  "tap:read",
  "tap:write",
];

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