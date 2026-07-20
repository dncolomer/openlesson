import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { errorResponse } from "../auth";
import { checkRateLimit } from "../rate-limit";
import { hasScope } from "../scopes";
import type { ApiKeyScope, AuthContext } from "../types";
import { hashOAuthToken } from "./crypto";
import { MCP_OAUTH_ACCESS_TOKEN_PREFIX } from "./config";

export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith(MCP_OAUTH_ACCESS_TOKEN_PREFIX);
}

export async function authenticateOAuthAccessToken(
  accessToken: string,
  requiredScope: ApiKeyScope
): Promise<{ auth: AuthContext; supabase: SupabaseClient } | NextResponse> {
  const { getServiceClient } = await import("../auth");
  const supabase = await getServiceClient();
  const tokenHash = await hashOAuthToken(accessToken);

  const { data: tokenData, error } = await supabase
    .from("mcp_oauth_tokens")
    .select("id, client_id, user_id, scopes, resource, expires_at, revoked_at, rate_limit")
    .eq("access_token_hash", tokenHash)
    .maybeSingle();

  if (error || !tokenData) {
    return errorResponse(401, "unauthorized", "Invalid OAuth access token");
  }

  if (tokenData.revoked_at) {
    return errorResponse(401, "key_revoked", "OAuth access token has been revoked");
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    return errorResponse(401, "key_expired", "OAuth access token has expired");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, organization_id, is_org_admin")
    .eq("id", tokenData.user_id)
    .single();

  const isAdmin = profile?.is_admin === true;
  let isTeams = isAdmin;
  if (!isTeams) {
    const { userHasOrgApiAccess } = await import(
      "@/lib/organization/resolve-user-billing"
    );
    isTeams = await userHasOrgApiAccess(supabase, tokenData.user_id);
  }

  if (!isTeams) {
    return errorResponse(
      403,
      "api_plan_required",
      "Proof-of-Work API organization and guest features require the Teams tier.",
      { renew_url: "https://uncertain.systems/pricing" }
    );
  }

  const rateLimit = tokenData.rate_limit ?? 120;
  const rateCheck = checkRateLimit(tokenData.id, rateLimit);
  if (!rateCheck.allowed) {
    return errorResponse(429, "rate_limit_exceeded", "API rate limit exceeded", {
      limit: rateCheck.limit,
      reset_at: Math.floor(rateCheck.resetAt / 1000),
    });
  }

  const scopes: ApiKeyScope[] = (tokenData.scopes || []) as ApiKeyScope[];
  if (!hasScope(scopes, requiredScope)) {
    return errorResponse(
      403,
      "forbidden",
      `This OAuth token does not have the required scope: ${requiredScope}`,
      { required_scope: requiredScope, key_scopes: scopes }
    );
  }

  supabase
    .from("mcp_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenData.id)
    .then();

  const auth: AuthContext = {
    user_id: tokenData.user_id,
    guest_user_id: null,
    organization_id: profile?.organization_id || null,
    is_org_admin: profile?.is_org_admin === true || isAdmin,
    key_id: tokenData.id,
    scopes,
    auth_method: "oauth",
    oauth_client_id: tokenData.client_id,
  };

  return { auth, supabase };
}