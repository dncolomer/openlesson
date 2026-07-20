import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import {
  countWorkspaceProofOfWorkForPlan,
  defaultProofOfWorkFileName,
  insertWorkspaceProofOfWorkRow,
  isAllowedProofOfWorkMime,
  MAX_WORKSPACE_PROOF_OF_WORK_BYTES,
  normalizeProofOfWorkType,
} from "@/lib/agent-v2/workspace-proof-of-work";
import { uploadFileToXAI, deleteFileFromXAI } from "@/lib/xai-files";
import { checkProofOfWorkSubmissionAllowance } from "@/lib/usage-enforcement";
import {
  lintOpaquePayload,
  normalizeEvaluationMode,
  parseWorkspaceEvaluationMeta,
  redactOpaqueFileName,
  sanitizeOpaqueMetadata,
} from "@/lib/agent-v2/opaque-evaluation";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";
import { randomUUID } from "node:crypto";

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

  const ownerUserId = auth.user_id || workspace.user_id;
  if (!ownerUserId) {
    return errorResponse(500, "internal_error", "Workspace owner is missing");
  }
  const proofOfWorkAllowance = await checkProofOfWorkSubmissionAllowance(supabase, ownerUserId);
  if (!proofOfWorkAllowance.allowed) {
    return errorResponse(402, "usage_limit_reached", proofOfWorkAllowance.reason || "Proof-of-Work API monthly limit reached");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  const evidenceType = normalizeProofOfWorkType(body.type);
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
  if (!isAllowedProofOfWorkMime(evidenceType, mimeType)) {
    return errorResponse(400, "validation_error", `mime_type ${mimeType} is not allowed for type ${evidenceType}`);
  }

  const fileBytes = Buffer.from(base64, "base64");
  if (!fileBytes.length) {
    return errorResponse(400, "validation_error", "data must be non-empty base64 content");
  }
  if (fileBytes.length > MAX_WORKSPACE_PROOF_OF_WORK_BYTES) {
    return errorResponse(400, "validation_error", "Proof-of-work file exceeds 10 MB limit");
  }

  if (blockId) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();
    if (!block) return errorResponse(404, "block_not_found", "Block not found in this workspace");
  }

  if (sessionId) {
    const { data: session } = await supabase.from("sessions").select("id").eq("id", sessionId).single();
    if (!session) return errorResponse(404, "validation_error", "session_id not found");
  }

  const evalMeta = parseWorkspaceEvaluationMeta(workspace);
  const isOpaque = normalizeEvaluationMode(workspace.evaluation_mode) === "opaque";
  const allowPlaintext: boolean =
    isOpaque &&
    !!(
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata) &&
      (body.metadata as Record<string, unknown>).allow_plaintext
    );

  if (isOpaque && evidenceType === "tool") {
    const lint = lintOpaquePayload(fileBytes.toString("utf8"), { allowPlaintext });
    if (!lint.passed) {
      return errorResponse(
        400,
        "validation_error",
        `Opaque mode plaintext lint failed: ${lint.violations.join(", ")}`
      );
    }
  }

  const artifactId = randomUUID();
  const fileName = isOpaque
    ? redactOpaqueFileName(artifactId)
    : defaultProofOfWorkFileName(evidenceType, typeof body.file_name === "string" ? body.file_name : undefined);
  let xaiFileId: string;

  try {
    const uploaded = await uploadFileToXAI(fileName, mimeType, base64);
    xaiFileId = uploaded.file_id;
  } catch (error) {
    console.error("[agent/proof-of-work] xAI upload failed:", error);
    return errorResponse(502, "internal_error", error instanceof Error ? error.message : "xAI upload failed");
  }

  const rawMetadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  const metadata = isOpaque ? sanitizeOpaqueMetadata(rawMetadata, allowPlaintext) : rawMetadata;

  const { row, error } = await insertWorkspaceProofOfWorkRow(supabase, {
    workspace_id: workspaceId,
    block_id: blockId,
    session_id: sessionId,
    proof_of_work_type: evidenceType,
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
  });

  if (error || !row) {
    console.error("[agent/proof-of-work] DB insert failed:", error);
    await deleteFileFromXAI(xaiFileId).catch(() => {});
    return errorResponse(500, "internal_error", "Failed to store workspace proof of work");
  }

  const proofOfWorkCount = await countWorkspaceProofOfWorkForPlan(supabase, workspaceId);

  return NextResponse.json(
    await withProofOfWorkApiResponse(
      {
        proof_of_work: {
          ...row,
          workspace_id: row.workspace_id,
          block_id: row.block_id,
          type: row.proof_of_work_type,
        },
        evaluation_mode: evalMeta.evaluation_mode,
        privacy: isOpaque
          ? {
              evaluation_mode: "opaque" as const,
              semantic_inference: "disabled" as const,
              plaintext_lint: "enforced" as const,
              stored_prompt: false,
            }
          : undefined,
        plaintext_lint: isOpaque ? { passed: true, violations: [] } : undefined,
      },
      {
        endpoint: "upload_proof_of_work",
        workspace_id: workspaceId,
        block_id: blockId,
        proof_of_work_artifacts: proofOfWorkCount ?? 1,
        tool_name: row.tool_name,
        tap_action: row.tool_action,
        workspace_title: workspace.title || workspace.root_topic || null,
        workspace_goal: workspace.workspace_goal,
        artifact_summary: row.tool_name
          ? `${row.tool_name}${row.tool_action ? `:${row.tool_action}` : ""}`
          : null,
        artifact_metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      }
    ),
    { status: 201 }
  );
}