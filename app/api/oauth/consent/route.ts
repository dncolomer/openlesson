import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/agent-v2/auth";
import { validateAssignableScopes } from "@/lib/agent-v2/scopes";
import {
  MCP_OAUTH_PENDING_COOKIE,
  readPendingAuthorizationCookie,
} from "@/lib/agent-v2/mcp-oauth/pending-auth";
import { issueAuthorizationCode } from "@/lib/agent-v2/mcp-oauth/tokens";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const pending = readPendingAuthorizationCookie(req.cookies.get(MCP_OAUTH_PENDING_COOKIE)?.value);
  if (!pending) {
    return NextResponse.json({ error: "expired_session" }, { status: 400 });
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
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const supabaseSession = await createClient();
  const {
    data: { user },
  } = await supabaseSession.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseSession
    .from("profiles")
    .select("is_org_admin, is_admin, plan, subscription_status")
    .eq("id", user.id)
    .single();

  const isTeams =
    profile?.is_admin === true ||
    (profile?.plan === "pro_teams" && profile?.subscription_status === "active");

  if (!isTeams) {
    return NextResponse.json(
      {
        error: "teams_required",
        message: "MCP OAuth access requires an active Teams subscription.",
      },
      { status: 403 }
    );
  }

  const scopeValidation = validateAssignableScopes(pending.scopes, {
    is_org_admin: profile?.is_org_admin,
    is_admin: profile?.is_admin,
  });
  if (!scopeValidation.ok) {
    return NextResponse.json({ error: "invalid_scope", message: scopeValidation.message }, { status: 403 });
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