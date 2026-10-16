/**
 * List or recover Calibrate / Learn / Verify embeddings for a workspace.
 * GET ?id= recovers one record including the raw used to embed.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";
import { getFlowEmbedding, listFlowEmbeddings, presentFlowEmbedding } from "@/lib/flow-embedding-store";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id } = await params;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", id)
    .single();

  if (workspaceError || !workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const url = new URL(req.url);
  const embeddingId = url.searchParams.get("id") || url.searchParams.get("embedding_id");
  if (embeddingId) {
    const row = await getFlowEmbedding({ workspaceId: id, embeddingId });
    if (!row) return errorResponse(404, "flow_embedding_not_found", "Flow embedding not found");
    return NextResponse.json(
      await withProofOfWorkApiResponse(
        { flow_embedding: presentFlowEmbedding(row) },
        { endpoint: "get_flow_embedding", workspace_id: id },
      ),
    );
  }

  const flowKind = url.searchParams.get("flow_kind") || url.searchParams.get("flowKind");
  const flowId = url.searchParams.get("flow_id") || url.searchParams.get("flowId");
  const rows = await listFlowEmbeddings({
    workspaceId: id,
    flowKind,
    flowId,
  });
  return NextResponse.json(
    await withProofOfWorkApiResponse(
      { flow_embeddings: rows.map(presentFlowEmbedding) },
      { endpoint: "list_flow_embeddings", workspace_id: id },
    ),
  );
}
