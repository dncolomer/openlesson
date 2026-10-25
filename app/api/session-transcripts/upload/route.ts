import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  deleteOrgScopedXaiFile,
  organizationIdFromSession,
  uploadOrgScopedXaiFile,
} from "@/lib/organization/org-xai-files";

export const runtime = "nodejs";
export const maxDuration = 30;

interface UploadTranscriptRequest {
  sessionId: string;
  transcript: string;
  chunkIndex: number;
  timestampMs?: number;
  metadata?: Record<string, unknown>;
}

function normalizeTranscript(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function countWords(text: string) {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = (await req.json()) as UploadTranscriptRequest;
    const transcript = normalizeTranscript(body.transcript || "");
    const chunkIndex = Number(body.chunkIndex);

    if (!body.sessionId || !transcript || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return jsonError(400, "sessionId, transcript, and a non-negative integer chunkIndex are required");
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", body.sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    const { data: existing } = await supabase
      .from("proof_of_work")
      .select("id, xai_file_id")
      .eq("session_id", body.sessionId)
      .eq("chunk_index", chunkIndex)
      .eq("tool_name", "transcript")
      .limit(1);

    const existingRow = existing?.[0];
    if (existingRow && existingRow.xai_file_id !== "_empty") {
      return NextResponse.json({
        success: true,
        xai_file_id: existingRow.xai_file_id,
        duplicate: true,
      });
    }

    const fileName = `${body.sessionId}_chunk_${chunkIndex}.txt`;
    const base64 = Buffer.from(transcript, "utf-8").toString("base64");

    const organizationId = await organizationIdFromSession(supabase, body.sessionId);
    let xaiFileId: string;
    try {
      const uploaded = await uploadOrgScopedXaiFile(fileName, "text/plain", base64, {
        organizationId,
        collectionFields: {
          session_id: body.sessionId,
          user_id: user.id,
        },
      });
      xaiFileId = uploaded.file_id;
    } catch (err) {
      console.error("[session-transcripts/upload] xAI upload failed:", err);
      return jsonError(502, err instanceof Error ? err.message : "xAI upload failed");
    }

    const ts = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();
    const { workspaceIdForSession, sensorPowInsertPayload } = await import("@/lib/session-sensor-pow");
    const { insertWorkspaceProofOfWorkRow } = await import("@/lib/pow-api/workspace-proof-of-work");
    const workspaceId = await workspaceIdForSession(supabase, body.sessionId);
    if (!workspaceId) {
      await deleteOrgScopedXaiFile(xaiFileId, organizationId).catch(() => {});
      return jsonError(400, "Session is missing a Learning Map");
    }
    const transcriptRow = sensorPowInsertPayload({
      sessionId: body.sessionId,
      userId: user.id,
      workspaceId,
      kind: "transcript",
      xaiFileId,
      fileName: fileName,
      mimeType: "text/plain",
      timestampMs: ts,
      chunkIndex,
      metadata: {
        ...(body.metadata ?? {}),
        source: "browser-web-speech",
        word_count: countWords(transcript),
      },
    });

    const { error: writeError } = existingRow
      ? await supabase
        .from("proof_of_work")
        .update(transcriptRow)
        .eq("id", existingRow.id)
        .eq("user_id", user.id)
      : (await insertWorkspaceProofOfWorkRow(supabase, transcriptRow)).error;

    if (writeError) {
      console.error("[session-transcripts/upload] DB write failed:", writeError.message);
      await deleteOrgScopedXaiFile(xaiFileId, organizationId).catch(() => {});
      return jsonError(500, writeError.message);
    }

    return NextResponse.json({ success: true, xai_file_id: xaiFileId });
  } catch (err) {
    console.error("[session-transcripts/upload] Internal error:", err);
    return jsonError(500, "Internal server error");
  }
}
