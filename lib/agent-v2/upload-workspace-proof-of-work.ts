import { randomUUID } from "node:crypto";
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
import {
  assertCanSubmitProofOfWork,
  isUsageLimitReachedError,
  UsageLimitReachedError,
} from "@/lib/usage-enforcement";
import type { ErrorCode } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  attachFileToOrgCollection,
  ensureOrgXaiApiKey,
} from "@/lib/organization/ensure-xai-resources";
import {
  buildPrivacyMetadata,
  lintOpaquePayload,
  normalizeEvaluationMode,
  parseWorkspaceEvaluationMeta,
  redactOpaqueFileName,
  sanitizeOpaqueMetadata,
} from "./opaque-evaluation";

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

export interface UploadWorkspaceProofOfWorkWorkspace {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  evaluation_mode?: string | null;
  protocol_config?: unknown;
  external_refs?: unknown;
  title?: string | null;
  root_topic?: string | null;
  workspace_goal?: string | null;
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
  chunk_index?: number;
  tool_name?: string;
  tool_action?: string;
  metadata?: Record<string, unknown>;
  band_powers?: Record<string, number> | null;
  device_name?: string | null;
  sample_count?: number | null;
  /** When true, missing session_id raises (agent REST strict mode). Default false keeps session soft-resolve. */
  require_existing_session?: boolean;
}

export type UploadWorkspaceProofOfWorkResult = {
  proof_of_work: Record<string, unknown> & {
    workspace_id: string;
    block_id: string | null;
    type: string;
    tool_name?: string | null;
    tool_action?: string | null;
    metadata?: unknown;
  };
  evaluation_mode: "semantic" | "opaque";
  privacy?: ReturnType<typeof buildPrivacyMetadata>;
  plaintext_lint?: { passed: boolean; violations: string[] };
};

export async function uploadWorkspaceProofOfWork(
  supabase: SupabaseClient,
  auth: AuthContext,
  workspace: UploadWorkspaceProofOfWorkWorkspace,
  input: UploadWorkspaceProofOfWorkInput
): Promise<UploadWorkspaceProofOfWorkResult["proof_of_work"] & {
  _upload_meta?: {
    evaluation_mode: "semantic" | "opaque";
    privacy?: ReturnType<typeof buildPrivacyMetadata>;
    plaintext_lint?: { passed: boolean; violations: string[] };
  };
}> {
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

  const billingUserId = workspace.user_id || auth.user_id;
  if (!billingUserId) {
    throw new Error("Workspace owner is missing.");
  }
  await assertCanSubmitProofOfWork(supabase, billingUserId);

  const participantUserId = auth.guest_user_id ? null : auth.user_id || null;
  const participantGuestUserId = isUuid(auth.guest_user_id) ? auth.guest_user_id : null;

  if (input.block_id) {
    const { data: block } = await supabase
      .from("blocks")
      .select("id")
      .eq("id", input.block_id)
      .eq("workspace_id", input.workspaceId)
      .single();
    if (!block) throw new Error("Block not found in this workspace");
  }

  if (input.require_existing_session && input.session_id) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", input.session_id)
      .single();
    if (!session) throw new Error("session_id not found");
  }

  const evalMeta = parseWorkspaceEvaluationMeta(workspace);
  const isOpaque = normalizeEvaluationMode(workspace.evaluation_mode) === "opaque";
  const rawMetadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {};
  const allowPlaintext = isOpaque && rawMetadata.allow_plaintext === true;

  if (isOpaque && evidenceType === "tool") {
    const lint = lintOpaquePayload(fileBytes.toString("utf8"), { allowPlaintext });
    if (!lint.passed) {
      throw new Error(`Opaque mode plaintext lint failed: ${lint.violations.join(", ")}`);
    }
  }

  const artifactId = randomUUID();
  const fileName = isOpaque
    ? redactOpaqueFileName(artifactId)
    : defaultProofOfWorkFileName(evidenceType, input.file_name);

  const { session_id: resolvedSessionId, metadata: sessionMeta } = await resolveProofOfWorkSession(
    supabase,
    input.require_existing_session ? null : input.session_id,
    rawMetadata
  );
  // When require_existing_session, we already validated session_id above — keep it.
  const finalSessionId = input.require_existing_session
    ? input.session_id || null
    : resolvedSessionId;
  const metadataBase = input.require_existing_session ? rawMetadata : sessionMeta;
  const metadata = isOpaque
    ? sanitizeOpaqueMetadata(metadataBase, allowPlaintext)
    : metadataBase;

  const organizationId = await resolveOrganizationId(
    supabase,
    auth.organization_id || workspace.organization_id
  );

  let xaiApiKey: string | undefined;
  if (organizationId) {
    try {
      const admin = createAdminClient();
      const ensured = await ensureOrgXaiApiKey(admin, organizationId);
      xaiApiKey = ensured.apiKey;
    } catch (err) {
      console.error("[upload-workspace-proof-of-work] org xAI key resolve failed:", err);
    }
  }

  const uploaded = await uploadFileToXAI(fileName, mimeType, base64, {
    apiKey: xaiApiKey,
  });
  const xaiFileId = uploaded.file_id;

  let xaiCollectionId: string | null = null;
  if (organizationId) {
    try {
      const admin = createAdminClient();
      xaiCollectionId = await attachFileToOrgCollection(admin, organizationId, xaiFileId, {
        organization_id: organizationId,
        workspace_id: input.workspaceId,
        proof_of_work_type: evidenceType,
        ...(participantUserId ? { user_id: participantUserId } : {}),
      });
    } catch (err) {
      console.error("[upload-workspace-proof-of-work] collection attach failed:", err);
    }
  }

  const { row, error } = await insertWorkspaceProofOfWorkRow(supabase, {
    workspace_id: input.workspaceId,
    block_id: input.block_id || null,
    session_id: finalSessionId,
    proof_of_work_type: evidenceType,
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileBytes.length,
    xai_file_id: xaiFileId,
    xai_collection_id: xaiCollectionId,
    timestamp_ms: input.timestamp_ms ?? Date.now(),
    chunk_index: input.chunk_index ?? 0,
    metadata,
    tool_name: input.tool_name || null,
    tool_action: input.tool_action || null,
    band_powers: input.band_powers ?? null,
    device_name: input.device_name ?? null,
    sample_count: input.sample_count ?? null,
    user_id: participantUserId || billingUserId,
    guest_user_id: participantGuestUserId,
    organization_id: organizationId,
    created_by_api_key_id: createdByApiKeyId(auth),
  });

  if (error || !row) {
    await deleteFileFromXAI(xaiFileId).catch(() => {});
    console.error("[upload-workspace-proof-of-work] DB insert failed:", error);
    throw new Error(
      formatDbError(
        error
          ? "Failed to store workspace proof of work"
          : "Failed to store workspace proof of work: insert returned no rows",
        error
      )
    );
  }

  const proof_of_work = {
    ...row,
    workspace_id: row.workspace_id,
    block_id: row.block_id,
    type: row.proof_of_work_type,
  };

  // Attach non-enumerable meta for agent response builders without breaking callers that spread row.
  Object.defineProperty(proof_of_work, "_upload_meta", {
    value: {
      evaluation_mode: evalMeta.evaluation_mode,
      privacy: isOpaque ? buildPrivacyMetadata(evalMeta) : undefined,
      plaintext_lint: isOpaque ? { passed: true, violations: [] as string[] } : undefined,
    },
    enumerable: false,
  });

  return proof_of_work as typeof proof_of_work & {
    _upload_meta: {
      evaluation_mode: "semantic" | "opaque";
      privacy?: ReturnType<typeof buildPrivacyMetadata>;
      plaintext_lint?: { passed: boolean; violations: string[] };
    };
  };
}

/** Extract opaque/eval metadata attached by uploadWorkspaceProofOfWork. */
export function getUploadProofOfWorkMeta(
  row: { _upload_meta?: UploadWorkspaceProofOfWorkResult extends never ? never : {
    evaluation_mode: "semantic" | "opaque";
    privacy?: ReturnType<typeof buildPrivacyMetadata>;
    plaintext_lint?: { passed: boolean; violations: string[] };
  } }
): {
  evaluation_mode: "semantic" | "opaque";
  privacy?: ReturnType<typeof buildPrivacyMetadata>;
  plaintext_lint?: { passed: boolean; violations: string[] };
} {
  return (
    row._upload_meta || {
      evaluation_mode: "semantic",
    }
  );
}

export type UploadProofOfWorkHttpError = {
  status: number;
  code: ErrorCode;
  message: string;
};

/**
 * Map errors from uploadWorkspaceProofOfWork / assertCanSubmitProofOfWork into
 * the public agent REST envelope (used by POST .../proof-of-work).
 */
export function mapUploadWorkspaceProofOfWorkError(error: unknown): UploadProofOfWorkHttpError {
  if (isUsageLimitReachedError(error) || error instanceof UsageLimitReachedError) {
    return {
      status: 402,
      code: "usage_limit_reached",
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : "Upload failed";

  if (message.includes("Workspace owner is missing")) {
    return { status: 500, code: "internal_error", message };
  }
  if (message.includes("Block not found")) {
    return { status: 404, code: "block_not_found", message };
  }
  if (message.includes("session_id not found")) {
    return { status: 404, code: "validation_error", message };
  }
  if (message.includes("xAI") || message.includes("Failed to store")) {
    return { status: 502, code: "internal_error", message };
  }
  // Fallback: plain Error with usage-limit wording (legacy throws / re-wrapped)
  if (
    /Proof-of-Work submissions this month/i.test(message) ||
    /No active subscription.*Proof-of-Work/i.test(message) ||
    /Proof-of-Work monthly limit reached/i.test(message)
  ) {
    return { status: 402, code: "usage_limit_reached", message };
  }

  return { status: 400, code: "validation_error", message };
}

export { UsageLimitReachedError, isUsageLimitReachedError };
