import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  createAgentFlow,
  listAgentFlows,
} from "@/lib/pow-api/agent-flow-management";
import { loadManagedWorkspace } from "@/lib/pow-api/workspace-management";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  const flows = await listAgentFlows({
    ownerUserId: String(auth.user_id || ""),
    workspaceId,
  });
  return NextResponse.json({ flows });
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  try {
    const flow = await createAgentFlow(auth, workspaceId, body);
    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to create flow",
    );
  }
}
