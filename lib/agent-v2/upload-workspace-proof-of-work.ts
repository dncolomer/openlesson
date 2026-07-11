import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultProofOfWorkFileName,
  insertWorkspaceProofOfWorkRow,
  isAllowedProofOfWorkMime,
  MAX_WORKSPACE_PROOF_OF_WORK_BYTES,
  normalizeProofOfWorkType,
} from "./workspace-proof-of-work";
import { createdByApiKeyId } from "./auth";
import type { AuthContext } from "./types";
import { uploadFileToXAI, deleteFileFromXAI } from "@/lib/xai-files";
import { assertCanSubmitProofOfWork } from "@/lib/usage-enforcement";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function formatDbError(context: string, error: { message?: string; code?: string; details?: string; hint?: string } | null) {
  if (!error) return context;
  const parts = [context, error.message, error.code, error.details, error.hint].filter(Boolean);
  return parts.join(" — ");
}

async function resolveOrganizationId(
  supabase: SupabaseClient,
  organizationId: string | null | undefined
): Promise<string | null> {
  if (!isUuid(organizationId)) return null;
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  return org?.id ?? null;
}

async function resolveProofOfWorkSession(
  supabase: SupabaseClient,
  sessionId: string | null | undefined,
  metadata: Record<string, unknown>
): Promise<{ session_id: string | null; metadata: Record<string, unknown> }> {
  if (!sessionId) {
    return { session_id: null, metadata };
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (session) {
    return { session_id: sessionId, metadata };
  }

  return {
    session_id: null,
    metadata: { ...metadata, correlation_session_id: sessionId },
  };
}

export interface UploadWorkspaceProofOfWorkInput {
  workspaceId: string;
  type: string;
  mime_type: string;
  data: string;
  block_id?: string | null;
  session_id?: string | null;
  file_name?: string;
  timestamp_ms?: number;
  tool_name?: string;
  tool_action?: string;
  metadata?: Record<string, unknown>;
}

export async function uploadWorkspaceProofOfWork(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspace: { id: string; user_id: string; organization_id: string | null },
  input: UploadWorkspaceProofOfWorkInput
) {
  const evidenceType = normalizeProofOfWorkType(input.type);
  const mimeType = input.mime_type.trim().toLowerCase();
  const base64 = input.data;

  if (!evidenceType) {
    throw new Error("type must be one of: tool, screen, screenshot, video, eeg");
  }
  if (!mimeType || !base64) {
    throw new Error("mime_type and data (base64) are required");
  }
  if (!isAllowedProofOfWorkMime(evidenceType, mimeType)) {
    throw new Error(`mime_type ${mimeType} is not allowed for type ${evidenceType}`);
  }

  const fileBytes = Buffer.from(base64, "base64");
  if (!fileBytes.length) {
    throw new Error("data must be non-empty base64 content");
  }
  if (fileBytes.length > MAX_WORKSPACE_PROOF_OF_WORK_BYTES) {
    throw new Error("Proof-of-work file exceeds 10 MB limit");
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  if (!ownerUserId) {
    throw new Error("Workspace owner is missing.");
  }
  await assertCanSubmitProofOfWork(supabase, ownerUserId);

  if (input.block_id) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", input.block_id)
      .eq("workspace_id", input.workspaceId)
      .single();
    if (!block) throw new Error("Block not found in this workspace");
  }

  const fileName = defaultProofOfWorkFileName(evidenceType, input.file_name);
  const uploaded = await uploadFileToXAI(fileName, mimeType, base64);
  const xaiFileId = uploaded.file_id;

  const { session_id: resolvedSessionId, metadata } = await resolveProofOfWorkSession(
    supabase,
    input.session_id,
    input.metadata || {}
  );
  const organizationId = await resolveOrganizationId(
    supabase,
    auth.organization_id || workspace.organization_id
  );

  const { row, error } = await insertWorkspaceProofOfWorkRow(supabase, {
    workspace_id: input.workspaceId,
    block_id: input.block_id || null,
    session_id: resolvedSessionId,
    proof_of_work_type: evidenceType,
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileBytes.length,
    xai_file_id: xaiFileId,
    timestamp_ms: input.timestamp_ms ?? Date.now(),
    chunk_index: 0,
    metadata,
    tool_name: input.tool_name || null,
    tool_action: input.tool_action || null,
    user_id: ownerUserId,
    guest_user_id: isUuid(auth.guest_user_id) ? auth.guest_user_id : null,
    organization_id: organizationId,
    created_by_api_key_id: createdByApiKeyId(auth),
  });

  if (error || !row) {
    await deleteFileFromXAI(xaiFileId).catch(() => {});
    console.error("[upload-workspace-proof-of-work] DB insert failed:", error);
    throw new Error(
      formatDbError(
        error ? "Failed to store workspace proof of work" : "Failed to store workspace proof of work: insert returned no rows",
        error
      )
    );
  }

  return {
    ...row,
    workspace_id: row.workspace_id,
    block_id: row.block_id,
    type: row.proof_of_work_type,
  };
}