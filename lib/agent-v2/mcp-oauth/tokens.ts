import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiKeyScope } from "../types";
import { validateAssignableScopes } from "../scopes";
import {
  generateAuthorizationCode,
  generateOAuthToken,
  hashOAuthToken,
  verifyPkceChallenge,
} from "./crypto";
import {
  MCP_OAUTH_ACCESS_TOKEN_PREFIX,
  MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  MCP_OAUTH_AUTH_CODE_TTL_SECONDS,
  MCP_OAUTH_REFRESH_TOKEN_PREFIX,
  MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS,
} from "./config";

export async function issueAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    client_id: string;
    user_id: string;
    scopes: ApiKeyScope[];
    resource: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: string;
  }
) {
  const code = generateAuthorizationCode();
  const codeHash = await hashOAuthToken(code);
  const expiresAt = new Date(Date.now() + MCP_OAUTH_AUTH_CODE_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabase.from("mcp_oauth_authorization_codes").insert({
    code_hash: codeHash,
    client_id: input.client_id,
    user_id: input.user_id,
    scopes: input.scopes,
    resource: input.resource,
    redirect_uri: input.redirect_uri,
    code_challenge: input.code_challenge,
    code_challenge_method: input.code_challenge_method,
    expires_at: expiresAt,
  });

  if (error) throw error;
  return code;
}

export async function exchangeAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    code: string;
    client_id: string;
    redirect_uri: string;
    code_verifier: string;
    resource: string;
  }
) {
  const codeHash = await hashOAuthToken(input.code);
  const { data: authCode, error } = await supabase
    .from("mcp_oauth_authorization_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (error || !authCode) {
    throw new Error("invalid_grant");
  }

  if (authCode.used_at) throw new Error("invalid_grant");
  if (new Date(authCode.expires_at) < new Date()) throw new Error("invalid_grant");
  if (authCode.client_id !== input.client_id) throw new Error("invalid_grant");
  if (authCode.redirect_uri !== input.redirect_uri) throw new Error("invalid_grant");
  if (authCode.resource !== input.resource) throw new Error("invalid_grant");
  if (
    !verifyPkceChallenge(
      input.code_verifier,
      authCode.code_challenge,
      authCode.code_challenge_method
    )
  ) {
    throw new Error("invalid_grant");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_org_admin, is_admin")
    .eq("id", authCode.user_id)
    .single();

  const scopeValidation = validateAssignableScopes(authCode.scopes as ApiKeyScope[], {
    is_org_admin: profile?.is_org_admin,
    is_admin: profile?.is_admin,
  });
  if (!scopeValidation.ok) throw new Error("invalid_scope");

  await supabase
    .from("mcp_oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", authCode.id);

  return issueAccessToken(supabase, {
    client_id: authCode.client_id,
    user_id: authCode.user_id,
    scopes: authCode.scopes as ApiKeyScope[],
    resource: authCode.resource,
  });
}

export async function refreshAccessToken(
  supabase: SupabaseClient,
  input: {
    refresh_token: string;
    client_id: string;
    resource: string;
  }
) {
  const refreshHash = await hashOAuthToken(input.refresh_token);
  const { data: tokenRow, error } = await supabase
    .from("mcp_oauth_tokens")
    .select("*")
    .eq("refresh_token_hash", refreshHash)
    .maybeSingle();

  if (error || !tokenRow) throw new Error("invalid_grant");
  if (tokenRow.revoked_at) throw new Error("invalid_grant");
  if (tokenRow.client_id !== input.client_id) throw new Error("invalid_grant");
  if (tokenRow.resource !== input.resource) throw new Error("invalid_grant");
  if (tokenRow.refresh_expires_at && new Date(tokenRow.refresh_expires_at) < new Date()) {
    throw new Error("invalid_grant");
  }

  await supabase
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return issueAccessToken(supabase, {
    client_id: tokenRow.client_id,
    user_id: tokenRow.user_id,
    scopes: tokenRow.scopes as ApiKeyScope[],
    resource: tokenRow.resource,
  });
}

async function issueAccessToken(
  supabase: SupabaseClient,
  input: {
    client_id: string;
    user_id: string;
    scopes: ApiKeyScope[];
    resource: string;
  }
) {
  const accessToken = generateOAuthToken(MCP_OAUTH_ACCESS_TOKEN_PREFIX);
  const refreshToken = generateOAuthToken(MCP_OAUTH_REFRESH_TOKEN_PREFIX);
  const accessTokenHash = await hashOAuthToken(accessToken);
  const refreshTokenHash = await hashOAuthToken(refreshToken);
  const expiresAt = new Date(Date.now() + MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(
    Date.now() + MCP_OAUTH_REFRESH_TOKEN_TTL_SECONDS * 1000
  ).toISOString();

  const { error } = await supabase.from("mcp_oauth_tokens").insert({
    access_token_hash: accessTokenHash,
    access_token_prefix: accessToken.slice(0, 12),
    refresh_token_hash: refreshTokenHash,
    client_id: input.client_id,
    user_id: input.user_id,
    scopes: input.scopes,
    resource: input.resource,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    rate_limit: 120,
  });

  if (error) throw error;

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: input.scopes.join(" "),
  };
}