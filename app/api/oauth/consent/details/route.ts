import { NextRequest, NextResponse } from "next/server";
import {
  MCP_OAUTH_PENDING_COOKIE,
  readPendingAuthorizationCookie,
} from "@/lib/agent-v2/mcp-oauth/pending-auth";

export async function GET(req: NextRequest) {
  const pending = readPendingAuthorizationCookie(req.cookies.get(MCP_OAUTH_PENDING_COOKIE)?.value);
  if (!pending) {
    return NextResponse.json({ error: "expired_session" }, { status: 400 });
  }

  return NextResponse.json({
    client_name: pending.client_name,
    scopes: pending.scopes,
    resource: pending.resource,
  });
}