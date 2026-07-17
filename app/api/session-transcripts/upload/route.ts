import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { deleteFileFromXAI, uploadFileToXAI } from "@/lib/xai-files";

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
      return NextResponse.json(
        { error: "sessionId, transcript, and a non-negative integer chunkIndex are required" },
        { status: 400 },
      );
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", body.sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from("session_transcript")
      .select("id, xai_file_id")
      .eq("session_id", body.sessionId)
      .eq("chunk_index", chunkIndex)
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

    let xaiFileId: string;
    try {
      const uploaded = await uploadFileToXAI(fileName, "text/plain", base64);
      xaiFileId = uploaded.file_id;
    } catch (err) {
      console.error("[session-transcripts/upload] xAI upload failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "xAI upload failed" },
        { status: 502 },
      );
    }

    const ts = typeof body.timestampMs === "number" ? body.timestampMs : Date.now();
    const transcriptRow = {
      session_id: body.sessionId,
      user_id: user.id,
      timestamp_ms: ts,
      xai_file_id: xaiFileId,
      chunk_index: chunkIndex,
      word_count: countWords(transcript),
      metadata: {
        ...(body.metadata ?? {}),
        source: "browser-web-speech",
      },
    };

    const { error: writeError } = existingRow
      ? await supabase
        .from("session_transcript")
        .update(transcriptRow)
        .eq("id", existingRow.id)
        .eq("user_id", user.id)
      : await supabase.from("session_transcript").insert(transcriptRow);

    if (writeError) {
      console.error("[session-transcripts/upload] DB write failed:", writeError.message);
      await deleteFileFromXAI(xaiFileId).catch(() => {});
      return NextResponse.json({ error: writeError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, xai_file_id: xaiFileId });
  } catch (err) {
    console.error("[session-transcripts/upload] Internal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
