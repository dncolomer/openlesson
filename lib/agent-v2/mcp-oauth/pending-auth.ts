import { encodeSignedObject, decodeSignedObject } from "./crypto";
import type { ApiKeyScope } from "../types";

export const MCP_OAUTH_PENDING_COOKIE = "mcp_oauth_pending";

export type PendingOAuthAuthorization = {
  client_id: string;
  client_name: string;
  redirect_uri: string;
  scopes: ApiKeyScope[];
  resource: string;
  code_challenge: string;
  code_challenge_method: string;
  state?: string;
  exp: number;
};

export function createPendingAuthorizationCookie(
  value: Omit<PendingOAuthAuthorization, "exp">,
  ttlSeconds = 600
): string {
  const payload: PendingOAuthAuthorization = {
    ...value,
    exp: Date.now() + ttlSeconds * 1000,
  };
  return encodeSignedObject(payload);
}

export function readPendingAuthorizationCookie(
  cookieValue: string | undefined | null
): PendingOAuthAuthorization | null {
  if (!cookieValue) return null;
  const parsed = decodeSignedObject<PendingOAuthAuthorization>(cookieValue);
  if (!parsed || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
  return parsed;
}