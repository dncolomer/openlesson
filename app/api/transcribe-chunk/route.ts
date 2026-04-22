import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/xai-stt";
import { uploadFileToXAI } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 60;

const HESITATION_MARKERS = ["um", "uh", "hmm", "huh", "er", "ah", "like,", "you know"];
const SELF_CORRECTION_MARKERS = ["actually", "no wait", "let me rethink", "scratch that", "I mean", "correction", "wait no"];
const QUESTION_MARKERS = ["?", "why", "how", "what if", "could it be", "I wonder"];

async function getAudioFromSupabase(supabase: SupabaseClient, storagePath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const { data, error } = await supabase.storage.from("session-audio").download(storagePath);
  
  if (error || !data) {
    console.error("[transcribe-chunk] Failed to download audio from Supabase:", error);
    return null;
  }
  
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Determine mime type from extension.
  // xAI STT supports: WAV, MP3, OGG, Opus, FLAC, AAC, MP4, M4A, MKV.
  // WebM is NOT supported — map to ogg (webm+opus ≈ ogg+opus).
  const ext = storagePath.split(".").pop()?.toLowerCase() || "mp4";
  const mimeMap: Record<string, string> = {
    mp4: "audio/mp4",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    opus: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
    mkv: "video/x-matroska",
    webm: "audio/ogg", // legacy webm+opus → re-label as ogg for xAI
  };
  const mimeType = mimeMap[ext] || "audio/mp4";
  
  return { buffer, mimeType };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const storagePath = formData.get("storage_path") as string | null;
    const audioFile = formData.get("audio") as File | null;
    const sessionId = formData.get("session_id") as string | null;
    const chunkIndex = formData.get("chunk_index") as string | null;
    const timestampMs = formData.get("timestamp_ms") as string | null;

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }
    if (!chunkIndex || isNaN(parseInt(chunkIndex))) {
      return NextResponse.json({ error: "Missing or invalid chunk_index" }, { status: 400 });
    }
    if (!timestampMs || isNaN(parseInt(timestampMs))) {
      return NextResponse.json({ error: "Missing or invalid timestamp_ms" }, { status: 400 });
    }

    const parsedChunkIndex = parseInt(chunkIndex);
    const parsedTimestampMs = parseInt(timestampMs);

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let buffer: Buffer;
    let mimeType: string;
    let fileName = "unknown";

    // Two modes: new (storage_path) or legacy (audio file)
    if (storagePath) {
      // NEW MODE: Fetch audio from Supabase Storage (metadata-only, no double-upload)
      console.log("[transcribe-chunk] New mode: fetching audio from Supabase:", storagePath);
      const audioData = await getAudioFromSupabase(supabase, storagePath);
      
      if (!audioData) {
        return NextResponse.json({ error: "Failed to fetch audio from storage" }, { status: 400 });
      }
      
      buffer = audioData.buffer;
      mimeType = audioData.mimeType;
      // Rename legacy .webm files to .ogg for xAI compatibility
      const rawFn = storagePath.split("/").pop() || "audio.mp4";
      fileName = rawFn.endsWith(".webm") ? rawFn.replace(/\.webm$/, ".ogg") : rawFn;
      
      console.log("[transcribe-chunk] Fetched audio from storage:", { size: buffer.length, mimeType });
      
    } else if (audioFile) {
      // LEGACY MODE: Receive audio file directly (backward compatibility)
      const allowedTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3", "audio/aac", "audio/flac"];
      const isAllowed = allowedTypes.some(type => 
        audioFile.type === type || audioFile.type.startsWith(type + ";")
      );
      if (!isAllowed) {
        console.log("[transcribe-chunk] Invalid audio format:", audioFile.type, "file:", audioFile.name);
        return NextResponse.json({ error: "Invalid audio format" }, { status: 400 });
      }

      const arrayBuffer = await audioFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      // Map webm → ogg for xAI compatibility
      let rawMime = audioFile.type.split(";")[0].trim() || "audio/mp4";
      if (rawMime === "audio/webm") rawMime = "audio/ogg";
      mimeType = rawMime;
      fileName = audioFile.name.endsWith(".webm")
        ? audioFile.name.replace(/\.webm$/, ".ogg")
        : audioFile.name;
    } else {
      return NextResponse.json({ error: "Missing either storage_path or audio file" }, { status: 400 });
    }

    if (buffer.length < 1000) {
      console.log("[transcribe-chunk] Audio too small, skipping transcription:", buffer.length);
      return NextResponse.json({
        success: true,
        chunkIndex: parsedChunkIndex,
        transcript: "",
        wordCount: 0,
      });
    }

    console.log("[transcribe-chunk] Audio info:", { mimeType, bufferSize: buffer.length });

    // Transcribe via xAI Speech-to-Text
    const sttResult = await transcribeAudio(buffer, fileName, mimeType);
    if (!sttResult) {
      return NextResponse.json({ error: "xAI STT transcription failed" }, { status: 500 });
    }

    let transcription = (sttResult.text || "").trim();

    // Check for empty/silent audio markers or hallucinated content
    const lowerTranscript = transcription.toLowerCase();
    const isNoSpeech = 
      transcription === "[NO_SPEECH]" ||
      lowerTranscript.includes("[no_speech]") ||
      lowerTranscript.includes("no speech") ||
      lowerTranscript.includes("no audio") ||
      lowerTranscript.includes("silent") ||
      lowerTranscript.includes("inaudible") ||
      lowerTranscript.includes("cannot transcribe") ||
      lowerTranscript.includes("no discernible") ||
      lowerTranscript.includes("audio is empty") ||
      lowerTranscript.includes("nothing to transcribe") ||
      // Common hallucination patterns for empty audio
      (transcription.length < 30 && /^(thanks?|thank you|bye|goodbye|hello|hi|okay|ok|yes|no|\.+|\s*)$/i.test(transcription));
    
    if (isNoSpeech) {
      console.log("[transcribe-chunk] No speech detected or empty audio, returning empty transcript");
      return NextResponse.json({
        success: true,
        chunkIndex: parsedChunkIndex,
        transcript: "",
        wordCount: 0,
      });
    }

    const audioStoragePath = storagePath || `${user.id}/${sessionId}/chunk_${parsedChunkIndex}_${Date.now()}.webm`;

    const lower = transcription.toLowerCase();
    const wordCount = transcription.split(/\s+/).filter((w: string) => w.length > 0).length;

    // Upload transcript chunk to xAI Files (plain text)
    const transcriptFileName = `${sessionId}_chunk_${parsedChunkIndex}.txt`;
    const transcriptBase64 = Buffer.from(transcription, "utf-8").toString("base64");
    let xaiFileId: string | null = null;
    try {
      const uploaded = await uploadFileToXAI(transcriptFileName, "text/plain", transcriptBase64);
      xaiFileId = uploaded.file_id;
    } catch (e) {
      console.error("[transcribe-chunk] xAI transcript upload failed:", e);
      return NextResponse.json({ error: "Transcript upload to xAI failed" }, { status: 502 });
    }

    const toolData = {
      has_hesitation: HESITATION_MARKERS.some((m) => lower.includes(m)),
      has_self_correction: SELF_CORRECTION_MARKERS.some((m) => lower.includes(m)),
      has_questions: QUESTION_MARKERS.some((m) => lower.includes(m)),
      word_count: wordCount,
      original_filename: fileName,
    };

    // Insert to session_audio table (only if new path, avoid duplicates)
    if (!storagePath) {
      try {
        await supabase
          .from("session_audio")
          .insert({
            session_id: sessionId,
            user_id: user.id,
            timestamp_ms: parsedTimestampMs,
            storage_path: audioStoragePath,
            chunk_index: parsedChunkIndex,
            metadata: { original_filename: fileName },
          });
      } catch (e) {
        console.warn("session_audio insert failed (non-critical):", e);
      }
    }

    // Insert to session_transcript table (xAI file reference)
    try {
      await supabase
        .from("session_transcript")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          timestamp_ms: parsedTimestampMs,
          xai_file_id: xaiFileId,
          chunk_index: parsedChunkIndex,
          word_count: wordCount,
          metadata: toolData,
        });
    } catch (e) {
      console.warn("session_transcript insert failed (non-critical):", e);
    }

    return NextResponse.json({
      success: true,
      chunkIndex: parsedChunkIndex,
      transcript: transcription,
      wordCount: wordCount,
    });
  } catch (error) {
    console.error("Transcribe chunk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
