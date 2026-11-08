/**
 * Flow Problem artifacts: org-scoped xAI Files, pointers stored on the flow.
 * Dashboard flows often have no workspace_id — resolve org from the owner.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  organizationIdFromUser,
  organizationIdFromWorkspace,
  uploadOrgScopedXaiFile,
} from "@/lib/organization/org-xai-files";
import {
  FLOW_ARTIFACT_MAX_BYTES,
} from "@/lib/flow-artifacts";
import {
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
} from "@/lib/workspace-helios-files";

export const runtime = "nodejs";
export const maxDuration = 30;

function estimatedBase64Bytes(data: string): number {
  return Math.ceil((String(data || "").replace(/\s+/g, "").length * 3) / 4);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId ?? body.workspace_id ?? "").trim();
    const fileName = String(body.fileName ?? body.file_name ?? body.name ?? "").trim();
    const mimeType = normalizeHeliosFileMime(
      fileName,
      String(body.mimeType ?? body.mime_type ?? ""),
    );
    const data = String(body.data ?? body.base64 ?? "").replace(/\s+/g, "");
    if (!fileName || !data) {
      return jsonError(400, "fileName and data are required");
    }
    if (!isHeliosAllowedMimeType(mimeType)) {
      return jsonError(400, "That file type is not supported.");
    }
    if (estimatedBase64Bytes(data) > FLOW_ARTIFACT_MAX_BYTES) {
      return jsonError(400, "File is too large (10 MB).");
    }

    const organizationId =
      (workspaceId
        ? await organizationIdFromWorkspace(auth.supabase, workspaceId)
        : null) || (await organizationIdFromUser(auth.supabase, auth.user.id));

    let xaiFileId: string;
    try {
      const uploaded = await uploadOrgScopedXaiFile(fileName, mimeType, data, {
        organizationId,
        collectionFields: {
          user_id: auth.user.id,
          kind: "flow_artifact",
          ...(workspaceId ? { workspace_id: workspaceId } : {}),
        },
      });
      xaiFileId = uploaded.file_id;
    } catch (err) {
      console.error("[flow-files] xAI upload failed:", err);
      return jsonError(502, err instanceof Error ? err.message : "xAI upload failed");
    }
    if (!xaiFileId) return jsonError(502, "xAI upload failed");

    return NextResponse.json({
      success: true,
      xaiFileId,
      xai_file_id: xaiFileId,
      name: fileName,
      mimeType,
    });
  } catch (err) {
    console.error("[flow-files] POST error:", err);
    return jsonError(500, "Internal server error");
  }
}
