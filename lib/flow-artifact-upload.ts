/**
 * Org-scoped upload for flow Problem artifacts (dashboard + public agent).
 * Bytes live on xAI Files; the flow stores name, mime, file id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  organizationIdFromUser,
  organizationIdFromWorkspace,
  uploadOrgScopedXaiFile,
} from "@/lib/organization/org-xai-files";
import {
  FLOW_ARTIFACT_MAX_BYTES,
  parseFlowArtifacts,
  type FlowArtifact,
} from "@/lib/flow-artifacts";
import {
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
  parseHeliosAttachedFiles,
} from "@/lib/workspace-helios-files";

function estimatedBase64Bytes(data: string): number {
  return Math.ceil((String(data || "").replace(/\s+/g, "").length * 3) / 4);
}

export type UploadFlowArtifactInput = {
  fileName: string;
  mimeType?: string;
  data: string;
  userId: string;
  workspaceId?: string | null;
  supabase?: SupabaseClient;
};

export async function uploadFlowArtifactBytes(
  input: UploadFlowArtifactInput,
): Promise<FlowArtifact> {
  const fileName = String(input.fileName || "").trim();
  const data = String(input.data || "").replace(/\s+/g, "");
  if (!fileName || !data) {
    throw new Error("fileName and data are required");
  }
  const mimeType = normalizeHeliosFileMime(fileName, String(input.mimeType || ""));
  if (!isHeliosAllowedMimeType(mimeType)) {
    throw new Error("That file type is not supported.");
  }
  if (estimatedBase64Bytes(data) > FLOW_ARTIFACT_MAX_BYTES) {
    throw new Error("File is too large (10 MB).");
  }
  const supabase = input.supabase ?? createAdminClient();
  const workspaceId = String(input.workspaceId || "").trim();
  const organizationId =
    (workspaceId ? await organizationIdFromWorkspace(supabase, workspaceId) : null) ||
    (await organizationIdFromUser(supabase, input.userId));

  const uploaded = await uploadOrgScopedXaiFile(fileName, mimeType, data, {
    organizationId,
    collectionFields: {
      user_id: input.userId,
      kind: "flow_artifact",
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    },
  });
  const xaiFileId = uploaded.file_id;
  if (!xaiFileId) throw new Error("xAI upload failed");
  return {
    name: fileName,
    xaiFileId,
    mimeType,
  };
}

/** Upload inline `{ name, mime_type, data }` items and merge with existing pointers. */
export async function resolveFlowArtifactsFromBody(input: {
  artifacts?: unknown;
  files?: unknown;
  userId: string;
  workspaceId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FlowArtifact[]> {
  const pointers = parseFlowArtifacts(input.artifacts);
  const inline = parseHeliosAttachedFiles(
    input.files !== undefined ? input.files : input.artifacts,
  );
  const uploaded: FlowArtifact[] = [];
  for (const file of inline) {
    uploaded.push(
      await uploadFlowArtifactBytes({
        fileName: file.name,
        mimeType: file.mimeType,
        data: file.data,
        userId: input.userId,
        workspaceId: input.workspaceId,
        supabase: input.supabase,
      }),
    );
  }
  const seen = new Set(pointers.map((item) => item.xaiFileId));
  const merged = [...pointers];
  for (const item of uploaded) {
    if (seen.has(item.xaiFileId)) continue;
    seen.add(item.xaiFileId);
    merged.push(item);
  }
  return merged;
}
