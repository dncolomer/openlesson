import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateApiKey } from "../auth";
import type { ApiKeyScope, AuthContext } from "../types";
import { authenticateOAuthAccessToken, isOAuthAccessToken } from "./authenticate-oauth-token";
import { buildMcpUnauthorizedResponse } from "./metadata";
import { getAppOrigin } from "./config";

export async function authenticateMcpRequest(
  req: NextRequest,
  requiredScope: ApiKeyScope
): Promise<{ auth: AuthContext; supabase: SupabaseClient } | NextResponse> {
  const origin = getAppOrigin(req);
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return buildMcpUnauthorizedResponse(origin);
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return buildMcpUnauthorizedResponse(origin);
  }

  if (isOAuthAccessToken(token)) {
    return authenticateOAuthAccessToken(token, requiredScope);
  }

  return authenticateApiKey(token, requiredScope);
}