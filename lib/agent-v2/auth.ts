// ============================================
// OpenLesson Agentic API v2 - Authentication
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey } from "@/lib/x402";
import type { AuthContext, ApiKeyScope, ApiError } from "./types";
import { checkRateLimit } from "./rate-limit";
import { hasScope } from "./scopes";

/**
 * Get a Supabase client with service role (bypasses RLS)
 */
export async function getServiceClient(): Promise<SupabaseClient> {
  return createAdminClient();
}

/**
 * Authenticate a request using API key from Authorization header.
 * Validates: key exists, is active, not expired, user has Pro subscription.
 * Returns AuthContext or an error response.
 */
export async function authenticateRequest(
  req: NextRequest,
  requiredScope: ApiKeyScope
): Promise<{ auth: AuthContext; supabase: SupabaseClient } | NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "unauthorized", "Missing or invalid Authorization header");
  }

  const apiKey = authHeader.substring(7);

  return authenticateApiKey(apiKey, requiredScope);
}

/**
 * Authenticate a raw API key value. Used by legacy MCP path transport (/api/mcp/{key}).
 * Prefer Bearer auth on POST /api/mcp for new integrations.
 */
export async function authenticateApiKey(
  apiKey: string,
  requiredScope: ApiKeyScope
): Promise<{ auth: AuthContext; supabase: SupabaseClient } | NextResponse> {
  const supabase = await getServiceClient();
  const keyHash = await hashApiKey(apiKey);

  const { data: keyData, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, guest_user_id, organization_id, scopes, is_active, expires_at, rate_limit")
    .eq("key_hash", keyHash)
    .single();

  if (error || !keyData) {
    return errorResponse(401, "unauthorized", "Invalid API key");
  }

  // Check active
  if (!keyData.is_active) {
    return errorResponse(401, "key_revoked", "API key has been revoked");
  }

  // Check expiration
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return errorResponse(401, "key_expired", "API key has expired");
  }

  let organizationId = keyData.organization_id as string | null;
  let isOrgAdmin = false;
  let isTeams = false;

  if (keyData.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, subscription_status, is_admin, organization_id, is_org_admin")
      .eq("id", keyData.user_id)
      .single();

    const isAdmin = profile?.is_admin === true;
    organizationId = organizationId || profile?.organization_id || null;
    isOrgAdmin = profile?.is_org_admin === true || isAdmin;
    isTeams = isAdmin || (profile?.plan === "pro_teams" && profile?.subscription_status === "active");
  } else if (keyData.guest_user_id) {
    const { data: guest } = await supabase
      .from("organization_guest_users")
      .select("id, organization_id, status")
      .eq("id", keyData.guest_user_id)
      .single();

    if (!guest || guest.status !== "active") {
      return errorResponse(401, "key_revoked", "Guest API key is no longer active");
    }

    organizationId = organizationId || guest.organization_id;
    const { data: teamsAdmin } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_org_admin", true)
      .eq("plan", "pro_teams")
      .eq("subscription_status", "active")
      .limit(1);
    isTeams = !!teamsAdmin?.length;
  }

  if (!isTeams) {
    return errorResponse(
      403,
      "teams_required",
      "Evidence API organization and guest features require the Teams tier.",
      { renew_url: "https://openlesson.academy/pricing" }
    );
  }

  const rateLimit = keyData.rate_limit ?? 120;
  const rateCheck = checkRateLimit(keyData.id, rateLimit);
  if (!rateCheck.allowed) {
    return errorResponse(429, "rate_limit_exceeded", "API rate limit exceeded", {
      limit: rateCheck.limit,
      reset_at: Math.floor(rateCheck.resetAt / 1000),
    });
  }

  // Check scopes
  const scopes: ApiKeyScope[] = keyData.scopes || ["*"];
  if (!hasScope(scopes, requiredScope)) {
    return errorResponse(
      403,
      "forbidden",
      `This API key does not have the required scope: ${requiredScope}`,
      { required_scope: requiredScope, key_scopes: scopes }
    );
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id)
    .then();

  const auth: AuthContext = {
    user_id: keyData.user_id,
    guest_user_id: keyData.guest_user_id || null,
    organization_id: organizationId,
    is_org_admin: isOrgAdmin,
    key_id: keyData.id,
    scopes,
    auth_method: "api_key",
  };

  return { auth, supabase };
}

export { hasScope } from "./scopes";

/** FK to agent_api_keys — only set for Bearer API key auth, not MCP OAuth tokens. */
export function createdByApiKeyId(auth: AuthContext): string | null {
  return auth.auth_method === "api_key" ? auth.key_id : null;
}

/**
 * Create a standard error response
 */
export function errorResponse(
  status: number,
  code: ApiError["code"],
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Add rate limit headers to a response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  limit: number = 120,
  remaining: number = 119
): NextResponse {
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set(
    "X-RateLimit-Reset",
    Math.floor(Date.now() / 1000 + 60).toString()
  );
  return response;
}
