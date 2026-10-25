/**
 * Owner Data Studio: proof-of-work for one embedding run, including spoken
 * transcript_snapshot rows that live on proof_of_work rather than
 * the compact embedding payload.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  extractStudioSpeechTranscripts,
  extractStudioTranscripts,
  flowPowFromWorkspaceRow,
  type DataStudioInspectPayload,
} from "@/lib/data-studio-view";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const workspaceId = (url.searchParams.get("workspaceId") || "").trim();
    const rawRunId = (url.searchParams.get("runId") || "").trim();
    const runId = /^[a-zA-Z0-9_-]+$/.test(rawRunId) ? rawRunId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const { data: workspace, error: workspaceError } = await auth.supabase
      .from("workspaces")
      .select("id, user_id")
      .eq("id", workspaceId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (workspaceError || !workspace) {
      return jsonError(404, "Workspace not found");
    }

    const admin = createAdminClient();
    let query = admin
      .from("proof_of_work")
      .select("proof_of_work_type, tool_name, tool_action, timestamp_ms, metadata, file_name, session_id")
      .eq("workspace_id", workspaceId)
      .order("timestamp_ms", { ascending: true })
      .limit(400);
    if (runId) {
      query = query.or(`session_id.eq.${runId},metadata->>tap_session_id.eq.${runId}`);
    }
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        workspaceId,
        runId: runId || null,
        pow: [],
        transcripts: [],
        speech: [],
      } satisfies Pick<DataStudioInspectPayload, "pow" | "transcripts" | "speech"> & {
        workspaceId: string;
        runId: string | null;
      });
    }

    const pow = (data || []).map((row) => flowPowFromWorkspaceRow(row));
    return NextResponse.json({
      workspaceId,
      runId: runId || null,
      pow,
      transcripts: extractStudioTranscripts(pow),
      speech: extractStudioSpeechTranscripts(pow),
    });
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not load run proof of work",
    );
  }
}
