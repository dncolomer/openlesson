import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/pow-api/auth";
import { validateAssignableScopes } from "@/lib/pow-api/scopes";
import {
  MCP_OAUTH_PENDING_COOKIE,
  readPendingAuthorizationCookie,
} from "@/lib/pow-api/mcp-oauth/pending-auth";
import { issueAuthorizationCode } from "@/lib/pow-api/mcp-oauth/tokens";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const pending = readPendingAuthorizationCookie(req.cookies.get(MCP_OAUTH_PENDING_COOKIE)?.value);
  if (!pending) {
    return jsonError(400, "expired_session");
  }

  const body = (await req.json()) as { decision?: "approve" | "deny" };
  const redirectUrl = new URL(pending.redirect_uri);

  if (body.decision === "deny") {
    redirectUrl.searchParams.set("error", "access_denied");
    if (pending.state) redirectUrl.searchParams.set("state", pending.state);
    const response = NextResponse.json({ redirect_to: redirectUrl.toString() });
    response.cookies.set(MCP_OAUTH_PENDING_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }

  if (body.decision !== "approve") {
    return jsonError(400, "invalid_decision");
  }

  const supabaseSession = await createClient();
  const {
    data: { user },
  } = await supabaseSession.auth.getUser();

  if (!user) {
    return jsonError(401, "unauthorized");
  }

  const { data: profile } = await supabaseSession
    .from("profiles")
    .select("is_org_admin, is_admin, organization_id")
    .eq("id", user.id)
    .single();

  let isTeams = profile?.is_admin === true;
  if (!isTeams) {
    const { userHasOrgApiAccess } = await import(
      "@/lib/organization/resolve-user-billing"
    );
    isTeams = await userHasOrgApiAccess(supabaseSession, user.id);
  }

  if (!isTeams) {
    return NextResponse.json(
      {
        error: {
          code: "api_plan_required",
          message: "MCP OAuth access requires an active Teams subscription.",
        },
      },
      { status: 403 }
    );
  }

  const scopeValidation = validateAssignableScopes(pending.scopes, {
    is_org_admin: profile?.is_org_admin,
    is_admin: profile?.is_admin,
  });
  if (!scopeValidation.ok) {
    return jsonError(403, scopeValidation.message, "validation_error");
  }

  const supabase = await getServiceClient();
  const code = await issueAuthorizationCode(supabase, {
    client_id: pending.client_id,
    user_id: user.id,
    scopes: scopeValidation.scopes,
    resource: pending.resource,
    redirect_uri: pending.redirect_uri,
    code_challenge: pending.code_challenge,
    code_challenge_method: pending.code_challenge_method,
  });

  redirectUrl.searchParams.set("code", code);
  if (pending.state) redirectUrl.searchParams.set("state", pending.state);

  const response = NextResponse.json({ redirect_to: redirectUrl.toString() });
  response.cookies.set(MCP_OAUTH_PENDING_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}