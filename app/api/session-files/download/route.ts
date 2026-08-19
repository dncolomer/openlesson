/**
 * Server-side proxy for downloading any session artifact stored on xAI Files.
 * Validates that the caller owns the file via a cross-table lookup.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getFileContentResponse } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 30;

const TABLES = [
  "session_transcript",
  "session_eeg",
  "session_tool",
  "session_facial",
  "session_screenshots",
  "session_analysis",
  "workspace_files",
] as const;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const fileId = req.nextUrl.searchParams.get("fileId");
    if (!fileId) {
      return jsonError(400, "fileId required");
    }

    // Verify the caller owns a row referencing this xai_file_id in any of
    // our known tables.
    let allowed = false;
    let mimeTypeHint: string | undefined;
    for (const table of TABLES) {
      const { data: row } = await supabase
        .from(table)
        .select("user_id")
        .eq("xai_file_id", fileId)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (row) {
        allowed = true;
        if (table === "session_screenshots") mimeTypeHint = "image/png";
        else if (table === "session_tool" || table === "session_eeg" || table === "session_facial") mimeTypeHint = "application/json";
        else if (table === "session_transcript" || table === "session_analysis") mimeTypeHint = "text/plain";
        break;
      }
    }

    if (!allowed) {
      return jsonError(403, "Forbidden");
    }

    const upstream = await getFileContentResponse(fileId);
    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => "");
      console.error(`[session-files/download] xAI fetch failed for file_id=${fileId} status=${upstream.status} body=${body.slice(0, 200)}`);
      return jsonError(502, `Upstream ${upstream.status}`);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || mimeTypeHint || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[session-files/download] Error:", err);
    return jsonError(500, "Internal server error");
  }
}
