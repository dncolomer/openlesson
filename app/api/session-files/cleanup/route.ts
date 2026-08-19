/**
 * Server-side cleanup of all xAI files associated with a session.
 * Called when a session is deleted or restarted.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { deleteFileFromXAI } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 60;

const TABLES_WITH_XAI_FILES = [
  "session_transcript",
  "session_eeg",
  "session_tool",
  "session_facial",
  "session_screenshots",
  "session_analysis",
] as const;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return jsonError(400, "sessionId required");
    }

    // Ownership check
    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    // Collect all xAI file IDs across the per-session tables
    const allFileIds: string[] = [];
    for (const table of TABLES_WITH_XAI_FILES) {
      const { data: rows } = await supabase
        .from(table)
        .select("xai_file_id")
        .eq("session_id", sessionId);

      if (rows) {
        for (const r of rows as Array<{ xai_file_id: string | null }>) {
          if (r.xai_file_id && r.xai_file_id !== "_empty") allFileIds.push(r.xai_file_id);
        }
      }
    }

    // Best-effort parallel delete from xAI
    await Promise.all(
      allFileIds.map(id => deleteFileFromXAI(id).catch(() => {}))
    );

    return NextResponse.json({ success: true, deleted: allFileIds.length });
  } catch (err) {
    console.error("[session-files/cleanup] Error:", err);
    return jsonError(500, "Internal server error");
  }
}
