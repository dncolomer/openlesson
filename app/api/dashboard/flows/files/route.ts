/**
 * Flow Problem artifacts: org-scoped xAI Files, pointers stored on the flow.
 * Dashboard flows often have no workspace_id — resolve org from the owner.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { uploadFlowArtifactBytes } from "@/lib/flow-artifact-upload";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId ?? body.workspace_id ?? "").trim();
    const fileName = String(body.fileName ?? body.file_name ?? body.name ?? "").trim();
    const mimeType = String(body.mimeType ?? body.mime_type ?? "");
    const data = String(body.data ?? body.base64 ?? "");

    let artifact;
    try {
      artifact = await uploadFlowArtifactBytes({
        fileName,
        mimeType,
        data,
        userId: auth.user.id,
        workspaceId,
        supabase: auth.supabase,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "xAI upload failed";
      if (
        message === "fileName and data are required" ||
        message === "That file type is not supported." ||
        message === "File is too large (10 MB)."
      ) {
        return jsonError(400, message);
      }
      console.error("[flow-files] xAI upload failed:", err);
      return jsonError(502, message);
    }

    return NextResponse.json({
      success: true,
      xaiFileId: artifact.xaiFileId,
      xai_file_id: artifact.xaiFileId,
      name: artifact.name,
      mimeType: artifact.mimeType,
      mime_type: artifact.mimeType,
    });
  } catch (err) {
    console.error("[flow-files] POST error:", err);
    return jsonError(500, "Internal server error");
  }
}
