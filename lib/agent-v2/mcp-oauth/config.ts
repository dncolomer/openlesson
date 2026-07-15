import type { NextRequest } from "next/server";
import type { ApiKeyScope } from "../types";
import { DEFAULT_API_KEY_SCOPES } from "../scopes";

export const MCP_OAUTH_RESOURCE_PATH = "/api/mcp";

export const MCP_OAUTH_SCOPES: ApiKeyScope[] = [
  "workspaces:read",
  "workspaces:write",
  "tap:read",
  "tap:write",
  "org:read",
  "org:write",
];

export const MCP_OAUTH_DEFAULT_SCOPES: ApiKeyScope[] = DEFAULT_API_KEY_SCOPES;

export const MCP_OAUTH_ACCESS_TOKEN_PREFIX = "oat_";
export const MCP_OAUTH_REFRESH_TOKEN_PREFIX = "ort_";
export const MCP_OAUTH_CLIENT_ID_PREFIX = "mcp_";

export const MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const MCP_OAUTH_AUTH_CODE_TTL_SECONDS = 600;

export { getAppOrigin } from "@/lib/app-url";

export function getMcpResourceUri(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${MCP_OAUTH_RESOURCE_PATH}`;
}

export function getOAuthIssuer(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function getProtectedResourceMetadataUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/.well-known/oauth-protected-resource${MCP_OAUTH_RESOURCE_PATH}`;
}

export function getAuthorizationServerMetadataUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/.well-known/oauth-authorization-server`;
}

export function parseRequestedScopes(scopeParam: string | null | undefined): ApiKeyScope[] {
  if (!scopeParam?.trim()) return [...MCP_OAUTH_DEFAULT_SCOPES];
  const requested = scopeParam
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean) as ApiKeyScope[];
  return requested.filter((scope) => MCP_OAUTH_SCOPES.includes(scope) || scope === "*");
}