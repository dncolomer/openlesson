import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { getAgentFlow, updateAgentFlow } from "@/lib/pow-api/agent-flow-management";
import { loadManagedWorkspace } from "@/lib/pow-api/workspace-management";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string; flowId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId, flowId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  const flow = await getAgentFlow(workspaceId, flowId);
  if (!flow) return errorResponse(404, "not_found", "Flow not found");
  return NextResponse.json({ flow });
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId, flowId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  try {
    const flow = await updateAgentFlow(auth, workspaceId, flowId, body);
    return NextResponse.json({ flow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update flow";
    const status = message === "Flow not found." ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}
