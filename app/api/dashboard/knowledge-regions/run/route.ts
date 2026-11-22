/**
 * Owner knowledge-region inspect: proof-of-work for one embedding run,
 * including spoken transcript_snapshot rows that live on proof_of_work
 * rather than the compact embedding payload. JSON/JSONL file bodies are
 * hydrated into a Stored record explorer; image/audio/video bytes stay
 * on BlobStore.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  loadStoredRecordBodies,
  presentStoredRecord,
  RECORD_HYDRATE_MAX_BYTES,
  type StoredRecordView,
} from "@/lib/behavior-record";
import {
  DASHBOARD_KNOWLEDGE_REGION_FILE_PATH,
  extractStudioSpeechTranscripts,
  extractStudioTranscripts,
  flowPowFromWorkspaceRow,
  type DataStudioInspectPayload,
} from "@/lib/data-studio-view";
import { getOrgScopedFileContentResponse, organizationIdFromUser, organizationIdFromWorkspace } from "@/lib/organization/org-xai-files";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const POW_SELECT =
  "proof_of_work_type, tool_name, tool_action, timestamp_ms, metadata, file_name, session_id, xai_file_id, mime_type, file_size";

function emptyRecord(): StoredRecordView {
  return {
    sample_count: 0,
    shown_count: 0,
    truncated: false,
    streams: [],
    files: [],
    rollup: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const workspaceId = (url.searchParams.get("workspaceId") || "").trim();
    const rawRunId = (url.searchParams.get("runId") || "").trim();
    const runId = /^[a-zA-Z0-9_-]+$/.test(rawRunId) ? rawRunId : "";
    if (!runId && !workspaceId) {
      return jsonError(400, "runId is required");
    }

    const admin = createAdminClient();
    if (workspaceId) {
      const { data: workspace, error: workspaceError } = await auth.supabase
        .from("workspaces")
        .select("id, user_id")
        .eq("id", workspaceId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (workspaceError || !workspace) {
        return jsonError(404, "Workspace not found");
      }
    } else {
      const { data: owned } = await admin
        .from("session_embeddings")
        .select("id")
        .eq("owner_user_id", auth.user.id)
        .eq("run_id", runId)
        .limit(1);
      if (!owned?.length) {
        return jsonError(404, "Run not found");
      }
    }

    let query = admin
      .from("proof_of_work")
      .select(POW_SELECT)
      .order("timestamp_ms", { ascending: true })
      .limit(400);
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    if (runId) {
      query = query.or(`session_id.eq.${runId},metadata->>tap_session_id.eq.${runId}`);
    }
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({
        workspaceId: workspaceId || null,
        runId: runId || null,
        pow: [],
        transcripts: [],
        speech: [],
        record: emptyRecord(),
      } satisfies Pick<DataStudioInspectPayload, "pow" | "transcripts" | "speech" | "record"> & {
        workspaceId: string | null;
        runId: string | null;
      });
    }

    const pow = (data || []).map((row) => flowPowFromWorkspaceRow(row));
    const orgId =
      (await organizationIdFromWorkspace(admin, workspaceId || null)) ||
      (await organizationIdFromUser(auth.supabase, auth.user.id));
    const bodies = await loadStoredRecordBodies(pow, async (fileId) => {
      const upstream = await getOrgScopedFileContentResponse(fileId, orgId);
      if (!upstream.ok) return null;
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > RECORD_HYDRATE_MAX_BYTES) return null;
      return buf.toString("utf8");
    });
    const record = presentStoredRecord({
      rows: pow,
      bodies,
      filePath: DASHBOARD_KNOWLEDGE_REGION_FILE_PATH,
    });
    return NextResponse.json({
      workspaceId: workspaceId || null,
      runId: runId || null,
      pow,
      transcripts: extractStudioTranscripts(pow),
      speech: extractStudioSpeechTranscripts(pow),
      record,
    });
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not load run proof of work",
    );
  }
}
