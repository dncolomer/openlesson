import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  listWorkspaceBlocks,
  loadManagedWorkspace,
  updateManagedWorkspace,
} from "@/lib/pow-api/workspace-management";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

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
  return NextResponse.json(
    await withProofOfWorkApiResponse(
      { blocks },
      { endpoint: "list_blocks", workspace_id: workspaceId },
    ),
  );
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
  const updated = await updateManagedWorkspace(supabase, auth, workspaceId, {
    blocks: body.blocks ?? body.map ?? body,
  });
  if (!updated) return errorResponse(404, "workspace_not_found", "Workspace not found");
  return NextResponse.json(
    await withProofOfWorkApiResponse(updated, {
      endpoint: "update_blocks",
      workspace_id: workspaceId,
    }),
  );
}
