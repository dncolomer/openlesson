export type LtiPlatformRegistration = {
  id?: string;
  organizationId: string;
  issuer: string;
  clientId: string;
  authLoginUrl: string;
  authTokenUrl: string;
  keysetUrl: string;
  deploymentIds: string[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDeploymentIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }
  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

export function parsePlatformRegistration(
  raw: Record<string, unknown>,
  organizationId: string,
): LtiPlatformRegistration | { error: string } {
  const issuer = text(raw.issuer ?? raw.iss);
  const clientId = text(raw.clientId ?? raw.client_id);
  const authLoginUrl = text(
    raw.authLoginUrl ?? raw.auth_login_url ?? raw.openid_connect_authentication_endpoint,
  );
  const authTokenUrl = text(
    raw.authTokenUrl ?? raw.auth_token_url ?? raw.oauth2_access_token_url,
  );
  const keysetUrl = text(raw.keysetUrl ?? raw.keyset_url ?? raw.jwks_url);
  const deploymentIds = parseDeploymentIds(raw.deploymentIds ?? raw.deployment_ids);
  if (!organizationId) return { error: "organization_id is required" };
  if (!issuer) return { error: "issuer is required" };
  if (!clientId) return { error: "client_id is required" };
  if (!authLoginUrl) return { error: "auth_login_url is required" };
  if (!keysetUrl) return { error: "keyset_url is required" };
  try {
    new URL(issuer.startsWith("http") ? issuer : `https://${issuer}`);
    new URL(authLoginUrl);
    new URL(keysetUrl);
    if (authTokenUrl) new URL(authTokenUrl);
  } catch {
    return { error: "platform URLs must be absolute" };
  }
  return {
    id: text(raw.id) || undefined,
    organizationId,
    issuer,
    clientId,
    authLoginUrl,
    authTokenUrl,
    keysetUrl,
    deploymentIds,
  };
}

export function presentPlatformRegistration(row: LtiPlatformRegistration) {
  return {
    id: row.id || null,
    organization_id: row.organizationId,
    issuer: row.issuer,
    client_id: row.clientId,
    auth_login_url: row.authLoginUrl,
    auth_token_url: row.authTokenUrl,
    keyset_url: row.keysetUrl,
    deployment_ids: row.deploymentIds,
  };
}
