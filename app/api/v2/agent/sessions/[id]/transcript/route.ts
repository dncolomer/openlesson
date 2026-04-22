// ============================================
// OpenLesson Agentic API v2 - Session Transcript
// GET /api/v2/agent/sessions/:id/transcript
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { getFileTextContent } from "@/lib/xai-files";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TranscriptRecord {
  xai_file_id: string;
  chunk_index: number;
  word_count: number;
  timestamp_ms: number;
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "sessions:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  const url = req.nextUrl;
  const format = url.searchParams.get("format") || "full"; // full, summary, chunks
  const sinceMs = parseInt(url.searchParams.get("since_ms") || "0", 10);

  if (!["full", "summary", "chunks"].includes(format)) {
    return errorResponse(400, "validation_error", "format must be one of: full, summary, chunks");
  }

  try {
    // ── Validate session ownership ─────────────────────────────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, user_id, is_agent_session, problem, created_at")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return errorResponse(404, "not_found", "Session not found");
    }

    if (session.user_id !== auth.user_id) {
      return errorResponse(403, "forbidden", "Session does not belong to this user");
    }

    if (!session.is_agent_session) {
      return errorResponse(403, "forbidden", "This endpoint is for agent sessions only");
    }

    // ── Fetch transcript records ───────────────────────────────────────
    let query = supabase
      .from("session_transcript")
      .select("xai_file_id, chunk_index, word_count, timestamp_ms")
      .eq("session_id", sessionId)
      .order("chunk_index", { ascending: true });

    if (sinceMs > 0) {
      query = query.gte("timestamp_ms", sinceMs);
    }

    const { data: records, error: recordsErr } = await query;

    if (recordsErr) {
      console.error("[v2/transcript] Query error:", recordsErr);
      return errorResponse(500, "internal_error", "Failed to fetch transcript records");
    }

    const transcriptRecords = (records || []) as TranscriptRecord[];

    if (transcriptRecords.length === 0) {
      return NextResponse.json({
        transcript: format === "chunks" ? [] : "",
        metadata: {
          session_id: sessionId,
          format,
          chunk_count: 0,
          total_words: 0,
          since_ms: sinceMs > 0 ? sinceMs : null,
        },
      });
    }

    const totalWords = transcriptRecords.reduce((sum, r) => sum + (r.word_count || 0), 0);

    // ── Format: chunks (metadata only, no content download) ────────────
    if (format === "chunks") {
      return NextResponse.json({
        transcript: transcriptRecords.map((r) => ({
          chunk_index: r.chunk_index,
          word_count: r.word_count,
          timestamp_ms: r.timestamp_ms,
        })),
        metadata: {
          session_id: sessionId,
          format: "chunks",
          chunk_count: transcriptRecords.length,
          total_words: totalWords,
          since_ms: sinceMs > 0 ? sinceMs : null,
        },
      });
    }

    // ── Download all chunks (from xAI) ─────────────────────────────────
    const chunkTexts: { index: number; text: string; timestamp_ms: number; word_count: number }[] = [];

    for (const record of transcriptRecords) {
      if (!record.xai_file_id || record.xai_file_id === "_empty") continue;
      const text = await getFileTextContent(record.xai_file_id);
      if (text && text.trim()) {
        chunkTexts.push({
          index: record.chunk_index,
          text: text.trim(),
          timestamp_ms: record.timestamp_ms,
          word_count: record.word_count,
        });
      }
    }

    // ── Format: summary (condensed) ────────────────────────────────────
    if (format === "summary") {
      const fullText = chunkTexts.map((c) => c.text).join("\n\n");
      const sentences = fullText.split(/[.!?]+/).filter((s) => s.trim().length > 10);

      // Take first 5 and last 5 sentences as summary
      const summaryParts: string[] = [];
      if (sentences.length <= 10) {
        summaryParts.push(...sentences);
      } else {
        summaryParts.push(...sentences.slice(0, 5));
        summaryParts.push("...");
        summaryParts.push(...sentences.slice(-5));
      }

      return NextResponse.json({
        transcript: summaryParts.join(". ").trim(),
        metadata: {
          session_id: sessionId,
          format: "summary",
          chunk_count: transcriptRecords.length,
          total_words: totalWords,
          full_sentence_count: sentences.length,
          since_ms: sinceMs > 0 ? sinceMs : null,
        },
      });
    }

    // ── Format: full ───────────────────────────────────────────────────
    const fullTranscript = chunkTexts.map((c) => c.text).join("\n\n");

    return NextResponse.json({
      transcript: fullTranscript,
      chunks: chunkTexts.map((c) => ({
        chunk_index: c.index,
        timestamp_ms: c.timestamp_ms,
        word_count: c.word_count,
        text: c.text,
      })),
      metadata: {
        session_id: sessionId,
        format: "full",
        chunk_count: chunkTexts.length,
        total_words: totalWords,
        since_ms: sinceMs > 0 ? sinceMs : null,
      },
    });
  } catch (err) {
    console.error("[v2/transcript] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
