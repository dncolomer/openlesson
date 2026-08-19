import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  MCP_OAUTH_PENDING_COOKIE,
  readPendingAuthorizationCookie,
} from "@/lib/pow-api/mcp-oauth/pending-auth";

export async function GET(req: NextRequest) {
  const pending = readPendingAuthorizationCookie(req.cookies.get(MCP_OAUTH_PENDING_COOKIE)?.value);
  if (!pending) {
    return jsonError(400, "expired_session");
  }

  return NextResponse.json({
    client_name: pending.client_name,
    scopes: pending.scopes,
    resource: pending.resource,
  });
}