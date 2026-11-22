/**
 * Owner proxy for a proof-of-work BlobStore file shown in Stored record.
 * Person audio/video is refused. Image and JSON bytes stream through.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  getOrgScopedFileContentResponse,
  organizationIdFromSession,
  organizationIdFromWorkspace,
} from "@/lib/organization/org-xai-files";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const fileId = (req.nextUrl.searchParams.get("fileId") || "").trim();
    if (!fileId) return jsonError(400, "fileId required");

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("proof_of_work")
      .select("workspace_id, session_id, user_id, mime_type, proof_of_work_type")
      .eq("xai_file_id", fileId)
      .limit(1)
      .maybeSingle();
    if (!row) return jsonError(404, "File not found");

    const mime = typeof row.mime_type === "string" ? row.mime_type.split(";")[0].trim().toLowerCase() : "";
    const storedType = typeof row.proof_of_work_type === "string" ? row.proof_of_work_type : "";
    if (storedType === "video" || mime.startsWith("audio/") || mime.startsWith("video/")) {
      return jsonError(404, "File not found");
    }

    let allowed = row.user_id === auth.user.id;
    if (!allowed && row.workspace_id) {
      const { data: workspace } = await auth.supabase
        .from("workspaces")
        .select("id")
        .eq("id", row.workspace_id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      allowed = Boolean(workspace);
    }
    if (!allowed && row.session_id) {
      const { data: owned } = await admin
        .from("session_embeddings")
        .select("id")
        .eq("owner_user_id", auth.user.id)
        .eq("run_id", row.session_id)
        .limit(1);
      allowed = Boolean(owned?.length);
    }
    if (!allowed) return jsonError(403, "Forbidden");

    const organizationId =
      (await organizationIdFromWorkspace(admin, row.workspace_id)) ||
      (await organizationIdFromSession(
        admin,
        typeof row.session_id === "string" ? row.session_id : null,
      ));
    const upstream = await getOrgScopedFileContentResponse(fileId, organizationId);
    if (mime && !upstream.headers.get("content-type")) {
      const headers = new Headers(upstream.headers);
      headers.set("content-type", mime);
      return new NextResponse(upstream.body, { status: upstream.status, headers });
    }
    return upstream;
  } catch {
    return jsonError(500, "Could not load stored file");
  }
}
