import { NextRequest, NextResponse } from "next/server";
import { buildProtectedResourceMetadata } from "@/lib/pow-api/mcp-oauth/metadata";
import { getAppOrigin } from "@/lib/pow-api/mcp-oauth/config";

export async function GET(req: NextRequest) {
  return NextResponse.json(buildProtectedResourceMetadata(getAppOrigin(req)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}