/**
 * Server-side proxy for downloading session artifacts stored on xAI Files.
 * Ownership is the proof-of-work row for that file.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  getOrgScopedFileContentResponse,
  organizationIdFromSession,
} from "@/lib/organization/org-xai-files";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const fileId = req.nextUrl.searchParams.get("fileId");
    if (!fileId) {
      return jsonError(400, "fileId required");
    }

    const { data: row } = await supabase
      .from("proof_of_work")
      .select("user_id, session_id, mime_type, proof_of_work_type")
      .eq("xai_file_id", fileId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!row) {
      return jsonError(403, "Forbidden");
    }

    const mimeTypeHint =
      typeof row.mime_type === "string" && row.mime_type ? row.mime_type : undefined;
    const organizationId = await organizationIdFromSession(
      supabase,
      typeof row.session_id === "string" ? row.session_id : null,
    );

    const upstream = await getOrgScopedFileContentResponse(fileId, organizationId);
    if (mimeTypeHint && !upstream.headers.get("content-type")) {
      const headers = new Headers(upstream.headers);
      headers.set("content-type", mimeTypeHint);
      return new NextResponse(upstream.body, { status: upstream.status, headers });
    }
    return upstream;
  } catch (err) {
    console.error("[session-files/download] Internal error:", err);
    return jsonError(500, "Internal server error");
  }
}
