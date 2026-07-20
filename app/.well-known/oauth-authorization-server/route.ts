import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationServerMetadata } from "@/lib/pow-api/mcp-oauth/metadata";
import { getAppOrigin } from "@/lib/pow-api/mcp-oauth/config";

export async function GET(req: NextRequest) {
  return NextResponse.json(buildAuthorizationServerMetadata(getAppOrigin(req)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}