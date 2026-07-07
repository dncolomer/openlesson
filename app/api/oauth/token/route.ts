import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/agent-v2/auth";
import { getOAuthClient, verifyClientSecret } from "@/lib/agent-v2/mcp-oauth/clients";
import { getAppOrigin, getMcpResourceUri } from "@/lib/agent-v2/mcp-oauth/config";
import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/agent-v2/mcp-oauth/tokens";

export const runtime = "nodejs";

async function readTokenRequest(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  const form = await req.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
}

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await readTokenRequest(req);
    const grantType = body.grant_type;
    const clientId = body.client_id;
    const clientSecret = body.client_secret;
    const resource = body.resource || getMcpResourceUri(getAppOrigin(req));

    if (!clientId) {
      return tokenError("invalid_request", "client_id is required");
    }

    const supabase = await getServiceClient();
    const client = await getOAuthClient(supabase, clientId);
    if (!client) {
      return tokenError("invalid_client", "Unknown OAuth client");
    }

    const secretOk = await verifyClientSecret(client, clientSecret);
    if (!secretOk) {
      return tokenError("invalid_client", "Invalid client credentials", 401);
    }

    if (grantType === "authorization_code") {
      if (!body.code || !body.redirect_uri || !body.code_verifier) {
        return tokenError("invalid_request", "code, redirect_uri, and code_verifier are required");
      }

      const tokenResponse = await exchangeAuthorizationCode(supabase, {
        code: body.code,
        client_id: clientId,
        redirect_uri: body.redirect_uri,
        code_verifier: body.code_verifier,
        resource,
      });
      return NextResponse.json(tokenResponse);
    }

    if (grantType === "refresh_token") {
      if (!body.refresh_token) {
        return tokenError("invalid_request", "refresh_token is required");
      }

      const tokenResponse = await refreshAccessToken(supabase, {
        refresh_token: body.refresh_token,
        client_id: clientId,
        resource,
      });
      return NextResponse.json(tokenResponse);
    }

    return tokenError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "invalid_grant" || message === "invalid_scope" ? 400 : 500;
    return tokenError(message, "Token request failed", status);
  }
}