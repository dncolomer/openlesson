import { NextRequest, NextResponse } from "next/server";
import { authenticateMcpRequest } from "@/lib/agent-v2/mcp-oauth/authenticate-mcp-request";
import {
  mcpEndpointDiscoveryResponse,
  processMcpJsonRpcRequest,
} from "@/lib/agent-v2/mcp-jsonrpc-handler";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const authResult = await authenticateMcpRequest(req, "workspaces:read");
  if (authResult instanceof NextResponse) return authResult;

  return mcpEndpointDiscoveryResponse("/api/mcp");
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateMcpRequest(req, "workspaces:read");
  if (authResult instanceof NextResponse) return authResult;

  const { auth, supabase } = authResult;
  return processMcpJsonRpcRequest(req, auth, supabase);
}