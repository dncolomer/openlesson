import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { canAccessAgentWorkspace } from "@/lib/pow-api/workspace-access";
import { countWorkspaceProofOfWorkForPlan } from "@/lib/pow-api/workspace-proof-of-work";
import {
  getUploadProofOfWorkMeta,
  mapUploadWorkspaceProofOfWorkError,
  uploadWorkspaceProofOfWork,
} from "@/lib/pow-api/upload-workspace-proof-of-work";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select(
      "id, user_id, organization_id, guest_user_id, evaluation_mode, protocol_config, external_refs, title, root_topic, workspace_goal",
    )
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  // Public agent surface: snake_case only
  try {
    const row = await uploadWorkspaceProofOfWork(
      supabase,
      auth,
      {
        id: workspace.id,
        user_id: workspace.user_id,
        organization_id: workspace.organization_id,
        evaluation_mode: workspace.evaluation_mode,
        protocol_config: workspace.protocol_config,
        external_refs: workspace.external_refs,
        title: workspace.title,
        root_topic: workspace.root_topic,
        workspace_goal: workspace.workspace_goal,
      },
      {
        workspaceId,
        type: typeof body.type === "string" ? body.type : "",
        mime_type: typeof body.mime_type === "string" ? body.mime_type : "",
        data: typeof body.data === "string" ? body.data : "",
        block_id: typeof body.block_id === "string" ? body.block_id : null,
        session_id: typeof body.session_id === "string" ? body.session_id : null,
        file_name: typeof body.file_name === "string" ? body.file_name : undefined,
        timestamp_ms: typeof body.timestamp_ms === "number" ? body.timestamp_ms : undefined,
        chunk_index: typeof body.chunk_index === "number" ? body.chunk_index : undefined,
        tool_name: typeof body.tool_name === "string" ? body.tool_name : undefined,
        tool_action: typeof body.tool_action === "string" ? body.tool_action : undefined,
        metadata:
          body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : undefined,
        band_powers:
          body.band_powers && typeof body.band_powers === "object" && !Array.isArray(body.band_powers)
            ? (body.band_powers as Record<string, number>)
            : null,
        device_name: typeof body.device_name === "string" ? body.device_name : null,
        sample_count: typeof body.sample_count === "number" ? body.sample_count : null,
        pow_model_version: typeof body.pow_model_version === "string" ? body.pow_model_version : undefined,
        require_existing_session: true,
      },
    );

    const meta = getUploadProofOfWorkMeta(row);
    const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(supabase, workspaceId);

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        {
          proof_of_work: row,
          evaluation_mode: meta.evaluation_mode,
          privacy: meta.privacy,
          plaintext_lint: meta.plaintext_lint,
        },
        {
          endpoint: "upload_proof_of_work",
          workspace_id: workspaceId,
          block_id: typeof row.block_id === "string" ? row.block_id : null,
          proof_of_work_artifacts: proofOfWorkCount ?? 1,
          tool_name: typeof row.tool_name === "string" ? row.tool_name : null,
          tap_action: typeof row.tool_action === "string" ? row.tool_action : null,
          workspace_title: workspace.title || workspace.root_topic || null,
          workspace_goal: workspace.workspace_goal,
          artifact_summary: row.tool_name
            ? `${row.tool_name}${row.tool_action ? `:${row.tool_action}` : ""}`
            : null,
          artifact_metadata:
            row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
              ? (row.metadata as Record<string, unknown>)
              : null,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapUploadWorkspaceProofOfWorkError(error);
    return errorResponse(mapped.status, mapped.code, mapped.message);
  }
}
