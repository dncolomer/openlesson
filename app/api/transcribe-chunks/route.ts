import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/xai-stt";
import { uploadFileToXAI } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 60;

type SupabaseServerClient = SupabaseClient;

// Extension → MIME type mapping for xAI STT.
// xAI STT supports: WAV, MP3, OGG, Opus, FLAC, AAC, MP4, M4A, MKV.
// WebM is NOT supported — map to ogg (webm+opus ≈ ogg+opus).
const MIME_MAP: Record<string, string> = {
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  mkv: "video/x-matroska",
  webm: "audio/ogg", // legacy files recorded as webm+opus → re-label as ogg
};

/**
 * Insert a session_transcript marker row so the chunk is not re-attempted
 * on the next poll. Uses xai_file_id="_empty" sentinel (column is NOT NULL)
 * and word_count: 0 to indicate silence / STT failure.
 */
async function insertEmptyTranscript(
  supabase: SupabaseServerClient,
  sessionId: string,
  userId: string,
  timestampMs: number,
  chunkIndex: number
) {
  try {
    await supabase.from("session_transcript").insert({
      session_id: sessionId,
      user_id: userId,
      timestamp_ms: timestampMs,
      xai_file_id: "_empty",
      chunk_index: chunkIndex,
      word_count: 0,
      metadata: { empty: true },
    });
  } catch (e) {
    // Non-critical — worst case the chunk is re-attempted next poll
    console.warn("[transcribe-chunks] Failed to insert empty transcript marker:", e);
  }
}

async function transcribeChunk(supabase: SupabaseServerClient, storagePath: string, sessionId: string, chunkIndex: number, timestampMs: number, userId: string): Promise<string> {
  try {
    const { data: audioData } = await supabase.storage
      .from("session-audio")
      .download(storagePath);

    if (!audioData) {
      console.warn("[transcribe-chunks] Failed to download audio:", storagePath);
      return "";
    }

    const arrayBuffer = await audioData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1000) {
      return "";
    }

    const ext = storagePath.split(".").pop()?.toLowerCase() || "mp4";
    const mimeType = MIME_MAP[ext] || "audio/mp4";
    // If the file has a .webm extension (legacy), rename to .ogg for xAI
    const rawFileName = storagePath.split("/").pop() || `chunk.${ext}`;
    const fileName = rawFileName.endsWith(".webm")
      ? rawFileName.replace(/\.webm$/, ".ogg")
      : rawFileName;

    const sttResult = await transcribeAudio(buffer, fileName, mimeType);
    if (!sttResult) {
      console.warn("[transcribe-chunks] xAI STT failed for", storagePath);
      // Insert a marker row so we don't re-attempt this chunk every poll
      await insertEmptyTranscript(supabase, sessionId, userId, timestampMs, chunkIndex);
      return "";
    }

    let transcription = (sttResult.text || "").trim();

    const lowerTranscript = transcription.toLowerCase();
    const isNoSpeech =
      lowerTranscript.includes("no speech") ||
      lowerTranscript.includes("no audio") ||
      lowerTranscript.includes("silent") ||
      transcription.length < 5;

    if (isNoSpeech) {
      transcription = "";
    }

    if (!transcription) {
      // Insert a marker row (word_count: 0) so this chunk is skipped on next poll
      await insertEmptyTranscript(supabase, sessionId, userId, timestampMs, chunkIndex);
      return "";
    }

    const wordCount = transcription.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Upload transcript to xAI Files
    const transcriptFileName = `${sessionId}_chunk_${chunkIndex}.txt`;
    const transcriptBase64 = Buffer.from(transcription, "utf-8").toString("base64");
    let xaiFileId: string | null = null;
    try {
      const uploaded = await uploadFileToXAI(transcriptFileName, "text/plain", transcriptBase64);
      xaiFileId = uploaded.file_id;
    } catch (e) {
      console.error("[transcribe-chunks] xAI transcript upload failed:", e);
      return "";
    }

    try {
      await supabase
        .from("session_transcript")
        .insert({
          session_id: sessionId,
          user_id: userId,
          timestamp_ms: timestampMs,
          xai_file_id: xaiFileId,
          chunk_index: chunkIndex,
          word_count: wordCount,
          metadata: {},
        });
    } catch (e) {
      console.warn("session_transcript insert failed (non-critical):", e);
    }

    return transcription;
  } catch (e) {
    console.warn("[transcribe-chunks] Transcription failed:", e);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffTime = Date.now() - 15 * 60 * 1000; // 15 minutes
    
    const { data: audioChunks } = await supabase
      .from("session_audio")
      .select("id, session_id, timestamp_ms, storage_path, chunk_index")
      .eq("session_id", sessionId)
      .gte("timestamp_ms", cutoffTime)
      .order("timestamp_ms", { ascending: true });

    if (!audioChunks || audioChunks.length === 0) {
      console.log("[transcribe-chunks] No audio chunks found in the last 15 minutes");
      return NextResponse.json({ transcribed: 0 });
    }

    const chunkIndices = audioChunks.map((c: { chunk_index: number }) => c.chunk_index);
    const { data: existingTranscripts } = await supabase
      .from("session_transcript")
      .select("chunk_index")
      .eq("session_id", sessionId)
      .in("chunk_index", chunkIndices);

    const transcribedIndices = new Set((existingTranscripts || []).map((t: { chunk_index: number }) => t.chunk_index));

    // Filter to only untranscribed chunks and cap at 5 per request to bound work
    const MAX_CHUNKS_PER_REQUEST = 5;
    const chunksToTranscribe = audioChunks
      .filter((chunk: { chunk_index: number }) => !transcribedIndices.has(chunk.chunk_index))
      .slice(0, MAX_CHUNKS_PER_REQUEST);

    if (chunksToTranscribe.length === 0) {
      return NextResponse.json({ transcribed: 0 });
    }

    // Process chunks in parallel with concurrency limit of 3
    const CONCURRENCY_LIMIT = 3;
    let transcribedCount = 0;
    
    for (let i = 0; i < chunksToTranscribe.length; i += CONCURRENCY_LIMIT) {
      const batch = chunksToTranscribe.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(
        batch.map((chunk: { storage_path: string; session_id: string; chunk_index: number; timestamp_ms: number }) => {
          console.log(`[transcribe-chunks] Transcribing chunk ${chunk.chunk_index}`);
          return transcribeChunk(
            supabase,
            chunk.storage_path,
            chunk.session_id,
            chunk.chunk_index,
            chunk.timestamp_ms,
            user.id
          );
        })
      );
      
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          transcribedCount++;
        }
      }
    }

    return NextResponse.json({ transcribed: transcribedCount, pending: audioChunks.length - transcribedIndices.size - transcribedCount });
  } catch (error) {
    console.error("Transcribe chunks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
