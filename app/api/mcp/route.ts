import { NextRequest, NextResponse } from "next/server";
import { authenticateMcpRequest } from "@/lib/pow-api/mcp-oauth/authenticate-mcp-request";
import { getAppOrigin, getMcpResourceUri } from "@/lib/pow-api/mcp-oauth/config";
import {
  mcpEndpointDiscoveryResponse,
  processMcpJsonRpcRequest,
} from "@/lib/pow-api/mcp-jsonrpc-handler";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const resourceUri = getMcpResourceUri(origin);
  const authHeader = req.headers.get("Authorization");

  // Streamable HTTP clients open GET before POST; endpoint discovery is public.
  if (!authHeader?.startsWith("Bearer ")) {
    return mcpEndpointDiscoveryResponse(resourceUri);
  }

  const authResult = await authenticateMcpRequest(req, "workspaces:read");
  if (authResult instanceof NextResponse) return authResult;

  return mcpEndpointDiscoveryResponse(resourceUri);
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateMcpRequest(req, "workspaces:read");
  if (authResult instanceof NextResponse) return authResult;

  const { auth, supabase } = authResult;
  return processMcpJsonRpcRequest(req, auth, supabase);
}