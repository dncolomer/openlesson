import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  createAgentFlow,
  listAgentFlows,
  parseAgentFlowKind,
} from "@/lib/pow-api/agent-flow-management";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const ownerUserId = String(auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspace_id") || undefined;
  const kind = parseAgentFlowKind(url.searchParams.get("kind"));
  const flows = await listAgentFlows({
    ownerUserId,
    workspaceId,
    kind: kind || undefined,
  });
  return NextResponse.json({ flows });
}

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  try {
    const flow = await createAgentFlow(auth, undefined, body);
    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to create flow",
    );
  }
}
