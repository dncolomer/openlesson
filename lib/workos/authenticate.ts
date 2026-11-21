import { WORKOS_AUTHENTICATE_PATH, type WorkOsClientConfig } from "@/lib/workos/config";

export function workOsAuthenticateRequest(
  config: WorkOsClientConfig,
  code: string,
): { url: string; headers: Record<string, string>; body: Record<string, string> } {
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) {
    throw new Error("authorization code is required");
  }
  return {
    url: `${config.apiBaseUrl}${WORKOS_AUTHENTICATE_PATH}`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      client_id: config.clientId,
      client_secret: config.apiKey,
      grant_type: "authorization_code",
      code: authorizationCode,
    },
  };
}
