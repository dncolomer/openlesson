import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { loadManagedWorkspace } from "@/lib/pow-api/workspace-management";
import {
  applyHeliosMapToolsForAgent,
  heliosMapAgentFeatureDenied,
  listHeliosMapToolsForAgent,
} from "@/lib/pow-api/helios-map-agent";
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
  const denied = heliosMapAgentFeatureDenied(
    (workspace as { workspace_kind?: unknown }).workspace_kind,
  );
  if (denied) return errorResponse(403, "forbidden", denied);
  const payload = await listHeliosMapToolsForAgent(supabase, workspaceId);
  return NextResponse.json(
    await withProofOfWorkApiResponse(payload, {
      endpoint: "list_map_tools",
      workspace_id: workspaceId,
    }),
  );
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;
  const workspace = await loadManagedWorkspace(supabase, auth, workspaceId);
  if (!workspace) return errorResponse(404, "workspace_not_found", "Workspace not found");
  const denied = heliosMapAgentFeatureDenied(
    (workspace as { workspace_kind?: unknown }).workspace_kind,
  );
  if (denied) return errorResponse(403, "forbidden", denied);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  const payload = await applyHeliosMapToolsForAgent({
    supabase,
    workspaceId,
    body,
  });
  if (!payload.ok) {
    return errorResponse(
      400,
      "validation_error",
      payload.error || "tool is required (Helios map catalog)",
      payload as unknown as Record<string, unknown>,
    );
  }
  return NextResponse.json(
    await withProofOfWorkApiResponse(payload, {
      endpoint: "apply_map_tool",
      workspace_id: workspaceId,
    }),
  );
}
