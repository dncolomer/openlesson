import { DEFAULT_APP_ORIGIN } from "@/lib/app-url";

export const WORKOS_AUTHORIZE_PATH = "/user_management/authorize";
export const WORKOS_AUTHENTICATE_PATH = "/user_management/authenticate";
export const WORKOS_PORTAL_LINK_PATH = "/portal/generate_link";
export const WORKOS_ORGANIZATIONS_PATH = "/organizations";
export const WORKOS_CALLBACK_PATH = "/auth/workos/callback";
export const WORKOS_START_PATH = "/auth/workos/start";
export const WORKOS_DEFAULT_API_BASE = "https://api.workos.com";
export const WORKOS_AUTHKIT_PROVIDER = "authkit";

export type WorkOsClientConfig = {
  apiKey: string;
  clientId: string;
  redirectUri: string;
  apiBaseUrl: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function workOsRedirectUri(
  origin: string,
  override?: string | null,
): string {
  const explicit = text(override);
  if (explicit) return explicit;
  const base = text(origin).replace(/\/$/, "") || DEFAULT_APP_ORIGIN;
  return `${base}${WORKOS_CALLBACK_PATH}`;
}

export function workOsClientConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
  origin: string = env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_ORIGIN,
): WorkOsClientConfig | { error: string } {
  const apiKey = text(env.WORKOS_API_KEY);
  const clientId = text(env.WORKOS_CLIENT_ID);
  if (!apiKey) return { error: "WORKOS_API_KEY is required" };
  if (!clientId) return { error: "WORKOS_CLIENT_ID is required" };
  const apiBaseUrl = text(env.WORKOS_API_BASE_URL) || WORKOS_DEFAULT_API_BASE;
  return {
    apiKey,
    clientId,
    redirectUri: workOsRedirectUri(origin, env.WORKOS_REDIRECT_URI),
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
  };
}

export function workOsIsConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !("error" in workOsClientConfigFromEnv(env));
}
