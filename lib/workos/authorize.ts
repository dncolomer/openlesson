import {
  WORKOS_AUTHKIT_PROVIDER,
  WORKOS_AUTHORIZE_PATH,
  type WorkOsClientConfig,
} from "@/lib/workos/config";

export type WorkOsAuthorizeInput = {
  state?: string;
  organizationId?: string | null;
  loginHint?: string | null;
  provider?: string | null;
  screenHint?: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function workOsAuthorizationUrl(
  config: WorkOsClientConfig,
  input: WorkOsAuthorizeInput = {},
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    provider: text(input.provider) || WORKOS_AUTHKIT_PROVIDER,
  });
  const state = text(input.state);
  if (state) params.set("state", state);
  const organizationId = text(input.organizationId);
  if (organizationId) params.set("organization_id", organizationId);
  const loginHint = text(input.loginHint);
  if (loginHint) params.set("login_hint", loginHint);
  const screenHint = text(input.screenHint);
  if (screenHint) params.set("screen_hint", screenHint);
  return `${config.apiBaseUrl}${WORKOS_AUTHORIZE_PATH}?${params.toString()}`;
}

export function encodeWorkOsOAuthState(input: {
  nonce: string;
  next?: string | null;
}): string {
  const nonce = text(input.nonce);
  const next = text(input.next);
  return Buffer.from(
    JSON.stringify({ nonce, next: next && next.startsWith("/") && !next.startsWith("//") ? next : "" }),
    "utf8",
  ).toString("base64url");
}

export function decodeWorkOsOAuthState(raw: string): { nonce: string; next: string } {
  try {
    const parsed = JSON.parse(Buffer.from(String(raw || "").trim(), "base64url").toString("utf8")) as {
      nonce?: unknown;
      next?: unknown;
    };
    const nonce = text(parsed.nonce);
    const next = text(parsed.next);
    return {
      nonce,
      next: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
    };
  } catch {
    return { nonce: "", next: "/dashboard" };
  }
}
