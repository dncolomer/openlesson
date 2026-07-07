import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationServerMetadata } from "@/lib/agent-v2/mcp-oauth/metadata";
import { getAppOrigin } from "@/lib/agent-v2/mcp-oauth/config";

export async function GET(req: NextRequest) {
  return NextResponse.json(buildAuthorizationServerMetadata(getAppOrigin(req)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}