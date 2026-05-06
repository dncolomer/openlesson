// ============================================
// OpenLesson Agentic API v2 - Authentication
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey } from "@/lib/x402";
import type { AuthContext, ApiKeyScope, ApiError } from "./types";

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
 * Authenticate a raw API key value. This is used by transports like MCP where
 * the client may only support a connector URL and cannot set Authorization.
 */
export async function authenticateApiKey(
  apiKey: string,
  requiredScope: ApiKeyScope
): Promise<{ auth: AuthContext; supabase: SupabaseClient } | NextResponse> {
  const supabase = await getServiceClient();
  const keyHash = await hashApiKey(apiKey);

  // Look up key
  const { data: keyData, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, scopes, is_active, expires_at, rate_limit")
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

  // Look up profile for Pro/admin check
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status, is_admin")
    .eq("id", keyData.user_id)
    .single();

  const isAdmin = profile?.is_admin === true;
  const isPro =
    profile?.plan === "pro" &&
    profile?.subscription_status === "active";

  if (!isAdmin && !isPro) {
    return errorResponse(
      403,
      "subscription_lapsed",
      "A Pro subscription is required to use the Agentic API.",
      { renew_url: "https://openlesson.academy/pricing" }
    );
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
    key_id: keyData.id,
    scopes,
  };

  return { auth, supabase };
}

/**
 * Check if scopes include the required scope
 */
export function hasScope(scopes: ApiKeyScope[], required: ApiKeyScope): boolean {
  if (scopes.includes("*")) return true;
  return scopes.includes(required);
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
