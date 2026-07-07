import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { generateClientId, hashOAuthToken } from "./crypto";

export type OAuthClientRecord = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  client_secret_hash: string | null;
};

export type OAuthClientMetadataDocument = {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
};

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function validateRedirectUris(redirectUris: string[]): string[] | null {
  const cleaned = redirectUris.map((entry) => entry.trim()).filter(Boolean);
  if (!cleaned.length) return null;
  if (!cleaned.every(isAllowedRedirectUri)) return null;
  return cleaned;
}

export async function fetchClientMetadataDocument(
  clientId: string
): Promise<OAuthClientMetadataDocument | null> {
  if (!isHttpsUrl(clientId)) return null;
  try {
    const response = await fetch(clientId, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const metadata = (await response.json()) as OAuthClientMetadataDocument;
    if (metadata.client_id !== clientId) return null;
    const redirectUris = validateRedirectUris(metadata.redirect_uris || []);
    if (!redirectUris) return null;
    return {
      ...metadata,
      redirect_uris: redirectUris,
    };
  } catch {
    return null;
  }
}

export async function getOAuthClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<OAuthClientRecord | null> {
  if (clientId.startsWith("https://")) {
    const metadata = await fetchClientMetadataDocument(clientId);
    if (!metadata) return null;
    return {
      client_id: metadata.client_id,
      client_name: metadata.client_name || new URL(metadata.client_id).hostname,
      redirect_uris: metadata.redirect_uris,
      grant_types: metadata.grant_types || ["authorization_code"],
      token_endpoint_auth_method: metadata.token_endpoint_auth_method || "none",
      client_secret_hash: null,
    };
  }

  const { data } = await supabase
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, grant_types, token_endpoint_auth_method, client_secret_hash")
    .eq("client_id", clientId)
    .maybeSingle();

  return data || null;
}

export function redirectUriAllowed(client: OAuthClientRecord, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}

export async function verifyClientSecret(
  client: OAuthClientRecord,
  clientSecret: string | null | undefined
): Promise<boolean> {
  if (client.token_endpoint_auth_method === "none") return true;
  if (!client.client_secret_hash || !clientSecret) return false;
  const providedHash = await hashOAuthToken(clientSecret);
  if (providedHash.length !== client.client_secret_hash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(providedHash, "utf8"),
    Buffer.from(client.client_secret_hash, "utf8")
  );
}

export async function registerOAuthClient(
  supabase: SupabaseClient,
  input: {
    client_name?: string;
    redirect_uris: string[];
    grant_types?: string[];
    token_endpoint_auth_method?: string;
  }
) {
  const redirectUris = validateRedirectUris(input.redirect_uris);
  if (!redirectUris) {
    throw new Error("invalid_redirect_uri");
  }

  const tokenEndpointAuthMethod = input.token_endpoint_auth_method || "none";
  const clientId = generateClientId();
  let clientSecret: string | null = null;
  let clientSecretHash: string | null = null;

  if (tokenEndpointAuthMethod !== "none") {
    clientSecret = crypto.randomBytes(24).toString("base64url");
    clientSecretHash = await hashOAuthToken(clientSecret);
  }

  const { error } = await supabase.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: input.client_name?.trim() || null,
    redirect_uris: redirectUris,
    grant_types: input.grant_types?.length ? input.grant_types : ["authorization_code"],
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    client_secret_hash: clientSecretHash,
  });

  if (error) throw error;

  return {
    client_id: clientId,
    client_secret: clientSecret,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    client_name: input.client_name?.trim() || null,
    redirect_uris: redirectUris,
    grant_types: input.grant_types?.length ? input.grant_types : ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: tokenEndpointAuthMethod,
  };
}