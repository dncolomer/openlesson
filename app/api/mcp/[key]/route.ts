import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/agent-v2/auth";
import {
  mcpEndpointDiscoveryResponse,
  processMcpJsonRpcRequest,
} from "@/lib/agent-v2/mcp-jsonrpc-handler";

export const runtime = "nodejs";
export const maxDuration = 180;

/** @deprecated Prefer POST /api/mcp with Authorization: Bearer. Path-embedded keys remain supported. */
async function authenticateMcpKey(key: string) {
  return authenticateApiKey(decodeURIComponent(key), "workspaces:read");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const authResult = await authenticateMcpKey(key);
  if (authResult instanceof NextResponse) return authResult;

  return mcpEndpointDiscoveryResponse(`/api/mcp/${encodeURIComponent(key)}`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const authResult = await authenticateMcpKey(key);
  if (authResult instanceof NextResponse) return authResult;

  const { auth, supabase } = authResult;
  return processMcpJsonRpcRequest(req, auth, supabase);
}