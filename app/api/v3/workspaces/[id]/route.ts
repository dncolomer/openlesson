import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  listWorkspaceBlocks,
  loadManagedWorkspace,
  presentManagedWorkspace,
  updateManagedWorkspace,
} from "@/lib/pow-api/workspace-management";

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
  const blocks = await listWorkspaceBlocks(supabase, workspaceId);
  return NextResponse.json({
    workspace: presentManagedWorkspace(workspace as Record<string, unknown>),
    blocks,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  try {
    const updated = await updateManagedWorkspace(supabase, auth, workspaceId, body);
    if (!updated) return errorResponse(404, "workspace_not_found", "Workspace not found");
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to update workspace",
    );
  }
}
