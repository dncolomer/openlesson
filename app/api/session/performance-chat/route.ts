import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadFileToXAI } from "@/lib/xai-files";
import { callXaiResponses, DEFAULT_MODEL, ResponsesInputMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SessionPerformanceData {
  session_id: string;
  problem: string;
  status: string;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  report: string | null;
  probes: {
    id: string;
    text: string;
    gap_score: number;
    timestamp_ms: number;
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, message, conversationHistory = [], fileIds = [] } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Get the session and verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    // If this is the first message (no fileIds), we need to fetch and upload data
    let activeFileIds = fileIds;

    if (activeFileIds.length === 0) {
      // Fetch probes for this session
      const { data: probes } = await supabase
        .from("probes")
        .select("id, text, gap_score, timestamp_ms")
        .eq("session_id", sessionId)
        .order("timestamp_ms", { ascending: true });

      // Build session performance data
      const performanceData: SessionPerformanceData = {
        session_id: session.id,
        problem: session.problem,
        status: session.status,
        duration_minutes: Math.round((session.duration_ms || 0) / 60000),
        started_at: session.created_at,
        ended_at: session.ended_at,
        report: session.report,
        probes: (probes || []).map(p => ({
          id: p.id,
          text: p.text,
          gap_score: p.gap_score,
          timestamp_ms: p.timestamp_ms,
        })),
      };

      if (!performanceData.report && performanceData.probes.length === 0) {
        return NextResponse.json({
          response: "This session doesn't have enough data to analyze yet. Complete the session to get performance insights.",
          fileIds: [],
        });
      }

      // Upload the performance data as a file to xAI
      const dataJson = JSON.stringify(performanceData, null, 2);
      const fileName = `session-performance-${sessionId}-${Date.now()}.json`;
      
      try {
        const uploadResult = await uploadFileToXAI(
          fileName,
          "application/json",
          Buffer.from(dataJson).toString("base64")
        );
        activeFileIds = [uploadResult.file_id];
      } catch (uploadError) {
        console.error("[session-performance-chat] Failed to upload file to xAI:", uploadError);
        return NextResponse.json(
          { error: "Failed to prepare session data" },
          { status: 500 }
        );
      }
    }

    // Build the conversation for xAI Responses API
    const systemInstructions = buildSystemInstructions(session.problem);

    // Build input messages
    const inputMessages: ResponsesInputMessage[] = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      inputMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // Add current message with file references
    inputMessages.push({
      role: "user",
      content: [
        { type: "input_text", text: message },
        ...activeFileIds.map((fileId: string) => ({ type: "input_file" as const, file_id: fileId })),
      ],
    });

    // Call xAI Responses API
    const result = await callXaiResponses({
      model: DEFAULT_MODEL,
      instructions: systemInstructions,
      input: inputMessages,
      temperature: 0.7,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
    });

    if (!result.success) {
      console.error("[session-performance-chat] xAI API error:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to get AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: result.text,
      fileIds: activeFileIds,
    });

  } catch (error) {
    console.error("[session-performance-chat] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function buildSystemInstructions(sessionTopic: string): string {
  return `You are Helios, an AI learning assistant analyzing a single tutoring session on the topic: "${sessionTopic}".

Your role is to help the learner understand their performance in this specific session and provide actionable insights.

The session data is provided in a JSON file attached to this conversation, containing:
- Session metadata (topic, duration, status)
- The session report (AI-generated summary with detailed feedback)
- All probes/questions generated during the session with their gap scores

When analyzing performance:
1. Reference specific details from the session report and probes
2. Explain what the gap scores indicate (0 = no gap, 1 = significant knowledge gap)
3. Identify strengths demonstrated during the session
4. Point out specific areas that need more work
5. Be encouraging while being honest about areas needing improvement
6. Provide concrete, actionable suggestions for improvement

Keep responses concise but insightful. Format your responses in markdown for readability.`;
}
