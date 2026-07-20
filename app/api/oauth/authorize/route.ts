import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOAuthClient, redirectUriAllowed } from "@/lib/pow-api/mcp-oauth/clients";
import {
  getAppOrigin,
  getMcpResourceUri,
  parseRequestedScopes,
} from "@/lib/pow-api/mcp-oauth/config";
import {
  createPendingAuthorizationCookie,
  MCP_OAUTH_PENDING_COOKIE,
} from "@/lib/pow-api/mcp-oauth/pending-auth";
import { getServiceClient } from "@/lib/pow-api/auth";

export const runtime = "nodejs";

function oauthErrorRedirect(redirectUri: string | null, error: string, state?: string | null) {
  if (!redirectUri) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const params = req.nextUrl.searchParams;
  const responseType = params.get("response_type");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method") || "S256";
  const scope = params.get("scope");
  const resource = params.get("resource") || getMcpResourceUri(origin);
  const state = params.get("state");

  if (responseType !== "code") {
    return oauthErrorRedirect(redirectUri, "unsupported_response_type", state);
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return oauthErrorRedirect(redirectUri, "invalid_request", state);
  }
  if (codeChallengeMethod !== "S256") {
    return oauthErrorRedirect(redirectUri, "invalid_request", state);
  }

  const expectedResource = getMcpResourceUri(origin);
  if (resource !== expectedResource) {
    return oauthErrorRedirect(redirectUri, "invalid_target", state);
  }

  const supabase = await getServiceClient();
  const client = await getOAuthClient(supabase, clientId);
  if (!client || !redirectUriAllowed(client, redirectUri)) {
    return oauthErrorRedirect(redirectUri, "invalid_client", state);
  }

  const scopes = parseRequestedScopes(scope);
  const supabaseSession = await createClient();
  const {
    data: { user },
  } = await supabaseSession.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("redirect", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const consentUrl = new URL("/oauth/consent", origin);
  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(
    MCP_OAUTH_PENDING_COOKIE,
    createPendingAuthorizationCookie({
      client_id: clientId,
      client_name: client.client_name || clientId,
      redirect_uri: redirectUri,
      scopes,
      resource,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state: state || undefined,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    }
  );
  return response;
}