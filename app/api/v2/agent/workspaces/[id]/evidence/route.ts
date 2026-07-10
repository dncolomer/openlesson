import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import {
  defaultEvidenceFileName,
  isAllowedEvidenceMime,
  MAX_WORKSPACE_EVIDENCE_BYTES,
  normalizeEvidenceType,
} from "@/lib/agent-v2/workspace-evidence";
import { uploadFileToXAI, deleteFileFromXAI } from "@/lib/xai-files";
import { checkEvidenceSubmissionAllowance } from "@/lib/usage-enforcement";

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
    .from("learning_plans")
    .select("id, user_id, organization_id, guest_user_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace || !canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  const evidenceAllowance = await checkEvidenceSubmissionAllowance(supabase, ownerUserId);
  if (!evidenceAllowance.allowed) {
    return errorResponse(402, "usage_limit_reached", evidenceAllowance.reason || "Evidence API monthly limit reached");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  const evidenceType = normalizeEvidenceType(body.type);
  const mimeType = typeof body.mime_type === "string" ? body.mime_type.trim().toLowerCase() : "";
  const base64 = typeof body.data === "string" ? body.data : "";
  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const sessionId = typeof body.session_id === "string" ? body.session_id : null;

  if (!evidenceType) {
    return errorResponse(400, "validation_error", "type must be one of: tool, screen, screenshot, video, eeg");
  }
  if (!mimeType || !base64) {
    return errorResponse(400, "validation_error", "mime_type and data (base64) are required");
  }
  if (!isAllowedEvidenceMime(evidenceType, mimeType)) {
    return errorResponse(400, "validation_error", `mime_type ${mimeType} is not allowed for type ${evidenceType}`);
  }

  const fileBytes = Buffer.from(base64, "base64");
  if (!fileBytes.length) {
    return errorResponse(400, "validation_error", "data must be non-empty base64 content");
  }
  if (fileBytes.length > MAX_WORKSPACE_EVIDENCE_BYTES) {
    return errorResponse(400, "validation_error", "Evidence file exceeds 10 MB limit");
  }

  if (blockId) {
    const { data: block } = await supabase
      .from("plan_nodes")
      .select("id")
      .eq("id", blockId)
      .eq("plan_id", workspaceId)
      .single();
    if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
  }

  if (sessionId) {
    const { data: session } = await supabase.from("sessions").select("id").eq("id", sessionId).single();
    if (!session) return errorResponse(404, "validation_error", "session_id not found");
  }

  const fileName = defaultEvidenceFileName(evidenceType, typeof body.file_name === "string" ? body.file_name : undefined);
  let xaiFileId: string;

  try {
    const uploaded = await uploadFileToXAI(fileName, mimeType, base64);
    xaiFileId = uploaded.file_id;
  } catch (error) {
    console.error("[agent/evidence] xAI upload failed:", error);
    return errorResponse(502, "internal_error", error instanceof Error ? error.message : "xAI upload failed");
  }

  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? (body.metadata as Record<string, unknown>)
    : {};

  const { data: row, error } = await supabase
    .from("workspace_evidence")
    .insert({
      plan_id: workspaceId,
      plan_node_id: blockId,
      session_id: sessionId,
      evidence_type: evidenceType,
      file_name: fileName,
      mime_type: mimeType,
      file_size: fileBytes.length,
      xai_file_id: xaiFileId,
      timestamp_ms: typeof body.timestamp_ms === "number" ? body.timestamp_ms : Date.now(),
      chunk_index: typeof body.chunk_index === "number" ? body.chunk_index : 0,
      metadata,
      tool_name: typeof body.tool_name === "string" ? body.tool_name : null,
      tool_action: typeof body.tool_action === "string" ? body.tool_action : null,
      band_powers:
        body.band_powers && typeof body.band_powers === "object" && !Array.isArray(body.band_powers)
          ? (body.band_powers as Record<string, number>)
          : null,
      device_name: typeof body.device_name === "string" ? body.device_name : null,
      sample_count: typeof body.sample_count === "number" ? body.sample_count : null,
      user_id: ownerUserId,
      guest_user_id: auth.guest_user_id,
      organization_id: auth.organization_id || workspace.organization_id,
      created_by_api_key_id: auth.key_id,
    })
    .select(
      "id, plan_id, plan_node_id, session_id, evidence_type, file_name, mime_type, file_size, xai_file_id, timestamp_ms, chunk_index, metadata, tool_name, tool_action, device_name, sample_count, created_at"
    )
    .single();

  if (error || !row) {
    console.error("[agent/evidence] DB insert failed:", error);
    await deleteFileFromXAI(xaiFileId).catch(() => {});
    return errorResponse(500, "internal_error", "Failed to store workspace evidence");
  }

  return NextResponse.json(
    {
      evidence: {
        ...row,
        workspace_id: row.plan_id,
        block_id: row.plan_node_id,
        type: row.evidence_type,
      },
    },
    { status: 201 }
  );
}