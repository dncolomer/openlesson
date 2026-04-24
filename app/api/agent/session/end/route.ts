import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/x402";
import { generateReport } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import { getFileTextContent } from "@/lib/xai-files";

async function getServiceRoleClient() {
  return createAdminClient();
}

async function authenticateRequest(
  apiKey: string,
  supabase: SupabaseClient
) {
  const keyHash = await hashApiKey(apiKey);

  const { data: keyData, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, is_active, rate_limit, last_used_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !keyData) {
    return null;
  }

  await supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return keyData;
}

async function fetchTranscriptsFromStorage(
  _supabase: SupabaseClient,
  transcriptRecords: { xai_file_id: string; chunk_index: number }[]
): Promise<string> {
  const sortedRecords = [...transcriptRecords].sort(
    (a, b) => a.chunk_index - b.chunk_index
  );

  const transcripts: string[] = [];

  for (const record of sortedRecords) {
    if (!record.xai_file_id || record.xai_file_id === "_empty") continue;
    const text = await getFileTextContent(record.xai_file_id);
    if (text && text.trim()) transcripts.push(text.trim());
  }

  return transcripts.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const supabase = await getServiceRoleClient();

    const auth = await authenticateRequest(apiKey, supabase as SupabaseClient);
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.user_id !== auth.user_id) {
      return NextResponse.json(
        { error: "Session does not belong to this API key" },
        { status: 403 }
      );
    }

    if (!session.is_agent_session) {
      return NextResponse.json(
        { error: "This endpoint is for agent sessions only" },
        { status: 403 }
      );
    }

    if (session.status === "completed" || session.status === "ended_by_tutor") {
      return NextResponse.json(
        { error: "Session is already completed" },
        { status: 400 }
      );
    }

    const { data: transcriptRecords, error: transcriptError } = await supabase
      .from("session_transcript")
      .select("xai_file_id, chunk_index, word_count, timestamp_ms")
      .eq("session_id", session_id)
      .order("chunk_index", { ascending: true });

    if (transcriptError) {
      console.error("[agent-session-end] Error fetching transcripts:", transcriptError);
    }

    const { data: probes, error: probesError } = await supabase
      .from("probes")
      .select("id, question, answer, gap_score, timestamp_ms, gap_type")
      .eq("session_id", session_id)
      .order("timestamp_ms", { ascending: true });

    if (probesError) {
      console.error("[agent-session-end] Error fetching probes:", probesError);
    }

    const fullTranscript = transcriptRecords?.length
      ? await fetchTranscriptsFromStorage(supabase, transcriptRecords)
      : "";

    const transcriptCount = transcriptRecords?.length || 0;
    const wordCount = fullTranscript.split(/\s+/).filter(w => w.length > 0).length;
    const probeCount = probes?.length || 0;

    // ── Fetch analysis records for file IDs ────────────────────────────
    const { data: analysisRecords, error: analysisError } = await supabase
      .from("session_analysis")
      .select("xai_file_id")
      .eq("session_id", session_id);

    if (analysisError) {
      console.error("[agent-session-end] Analysis query error:", analysisError);
    }

    // ── Collect all xAI file IDs for report generation ─────────────────
    const sessionFileIds: string[] = [];

    // Add transcript file IDs
    if (transcriptRecords) {
      for (const r of transcriptRecords) {
        if (r.xai_file_id && r.xai_file_id !== "_empty") {
          sessionFileIds.push(r.xai_file_id);
        }
      }
    }

    // Add analysis file IDs
    if (analysisRecords) {
      for (const r of analysisRecords as Array<{ xai_file_id: string | null }>) {
        if (r.xai_file_id) {
          sessionFileIds.push(r.xai_file_id);
        }
      }
    }

    const avgGapScore = probes && probes.length > 0
      ? probes.reduce((sum, p) => sum + (p.gap_score || 0), 0) / probes.length
      : 0;

    const sessionDurationMs = session.ended_at && session.created_at
      ? new Date(session.ended_at).getTime() - new Date(session.created_at).getTime()
      : session.duration_ms || 0;

    const durationStr = sessionDurationMs > 0
      ? `${Math.round(sessionDurationMs / 1000)} seconds (${Math.round(sessionDurationMs / 60000)} minutes)`
      : "unknown";

    const probesSummary = buildProbesSummary(probes || [], fullTranscript);

    const NO_AUDIO_THRESHOLD = 50;
    if (wordCount < NO_AUDIO_THRESHOLD) {
      console.log("[agent-session-end] No significant audio recorded, skipping report generation", {
        wordCount,
        threshold: NO_AUDIO_THRESHOLD
      });

      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "completed",
          report: `## Session Summary\n\n**No audio was recorded during this session.**\n\nThis may indicate that the microphone was not active or the session was very short without verbal interaction.\n\n**Session Details:**\n- Duration: ${durationStr}\n- Problem: ${session.problem}\n- Probes triggered: ${probeCount}`,
          report_generated_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        })
        .eq("id", session_id);

      if (updateError) {
        console.error("[agent-session-end] Update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update session" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        sessionId: session_id,
        message: "Session ended. No significant audio was recorded.",
        hasAudio: false,
        transcriptCount,
        wordCount,
        probeCount,
      });
    }

    const promptOverrides = await getUserPrompts();
    const reportResult = await generateReport({
      problem: session.problem,
      duration: durationStr,
      probeCount,
      avgGapScore,
      probesSummary,
      promptOverrides,
      fileIds: sessionFileIds.length > 0 ? sessionFileIds : undefined,
    });

    if (!reportResult.success) {
      return NextResponse.json(
        { error: reportResult.error || "Report generation failed" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        report: reportResult.report,
        report_generated_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    if (updateError) {
      console.error("[agent-session-end] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session_id,
      message: "Session ended and report generated",
      hasAudio: true,
      transcriptCount,
      wordCount,
      probeCount,
      avgGapScore: avgGapScore.toFixed(2),
    });
  } catch (error) {
    console.error("Agent session end error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

function buildProbesSummary(probes: {
  question?: string;
  answer?: string;
  gap_score?: number;
  gap_type?: string;
  timestamp_ms?: number;
}[], fullTranscript: string): string {
  if (probes.length === 0) {
    return fullTranscript || "No probes were triggered during this session.";
  }

  const probeDetails = probes.map((p, i) => {
    const gapType = p.gap_type || "unknown";
    const gapScore = p.gap_score?.toFixed(2) || "N/A";
    const question = p.question || "No question recorded";
    return `[Probe ${i + 1}] Gap type: ${gapType}, Gap score: ${gapScore}\nQuestion: ${question}`;
  }).join("\n\n");

  return `Probes triggered: ${probes.length}\n\n${probeDetails}\n\n---\n\nTranscript:\n${fullTranscript || "No transcript available"}`;
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    endpoint: "session_end",
    description: "End an agent session and generate a summary report",
    required_params: ["session_id"],
    optional_params: [],
    usage: "Call this endpoint when the tutoring session is complete. It will mark the session as completed and generate a summary report.",
  });
}
