import { randomBytes } from "crypto";
import { textClaim } from "@/lib/lti/claims";
import { LTI_LAUNCH_PATH } from "@/lib/lti/tool-urls";

export type LtiLoginInitiation = {
  iss: string;
  loginHint: string;
  targetLinkUri: string;
  clientId: string;
  ltiMessageHint: string;
  ltiDeploymentId: string;
};

export type LtiOidcState = {
  state: string;
  nonce: string;
  iss: string;
  clientId: string;
  createdAt: string;
  expiresAt: string;
};

export const LTI_OIDC_STATE_TTL_MS = 10 * 60 * 1000;

export function parseLoginInitiation(
  raw: Record<string, unknown> | URLSearchParams,
): LtiLoginInitiation | { error: string } {
  const read = (key: string) => {
    if (raw instanceof URLSearchParams) return textClaim(raw.get(key));
    return textClaim(raw[key] ?? raw[key.replace(/([A-Z])/g, "_$1").toLowerCase()]);
  };
  const iss = read("iss");
  const loginHint = read("login_hint");
  const targetLinkUri = read("target_link_uri");
  const clientId = read("client_id");
  const ltiMessageHint = read("lti_message_hint");
  const ltiDeploymentId = read("lti_deployment_id");
  if (!iss) return { error: "iss is required" };
  if (!targetLinkUri) return { error: "target_link_uri is required" };
  if (!clientId) return { error: "client_id is required" };
  return {
    iss,
    loginHint,
    targetLinkUri,
    clientId,
    ltiMessageHint,
    ltiDeploymentId,
  };
}

export function newOidcState(input: {
  iss: string;
  clientId: string;
  now?: number;
}): LtiOidcState {
  const now = input.now ?? Date.now();
  return {
    state: randomBytes(24).toString("hex"),
    nonce: randomBytes(24).toString("hex"),
    iss: input.iss,
    clientId: input.clientId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LTI_OIDC_STATE_TTL_MS).toISOString(),
  };
}

export function oidcStateIsFresh(row: { expiresAt: string }, now = Date.now()): boolean {
  const expires = Date.parse(row.expiresAt);
  return Number.isFinite(expires) && expires > now;
}

export function buildPlatformAuthRedirect(input: {
  authLoginUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  loginHint?: string;
  ltiMessageHint?: string;
}): string {
  const url = new URL(input.authLoginUrl);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("prompt", "none");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  if (input.ltiMessageHint) url.searchParams.set("lti_message_hint", input.ltiMessageHint);
  return url.toString();
}

export function defaultRedirectUri(origin: string): string {
  return `${String(origin || "").replace(/\/$/, "")}${LTI_LAUNCH_PATH}`;
}
