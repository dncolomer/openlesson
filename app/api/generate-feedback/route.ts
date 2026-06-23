import { NextResponse } from "next/server";
import { callXaiText, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { getFileTextContent } from "@/lib/xai-files";
import { guardSessionRoute } from "@/lib/api/require-auth";

export async function POST(request: Request) {
  try {
    const { sessionId, problem } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const auth = await guardSessionRoute(sessionId);
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const transcripts: string[] = [];

    const { data: transcriptRecords, error: transcriptError } = await supabase
      .from("session_transcript")
      .select("id, xai_file_id, timestamp_ms")
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true })
      .limit(20);

    if (transcriptError) {
      console.error("[generate-feedback] Error fetching transcript records:", transcriptError);
    } else {
      for (const record of transcriptRecords || []) {
        if (record.xai_file_id && record.xai_file_id !== "_empty") {
          const text = await getFileTextContent(record.xai_file_id);
          if (text) transcripts.push(text);
        }
      }
    }

    if (transcripts.length === 0) {
      return NextResponse.json({ feedback: null });
    }

    const combinedTranscript = transcripts.reverse().join("\n\n");

    const response = await callXaiText(
      [
        systemMessage("You are an AI learning assistant. Based on the student's speech, give brief feedback (1-2 sentences)."),
        userMessage(`Problem: ${problem}\n\nTranscripts:\n${combinedTranscript}`),
      ],
      {
        model: DEFAULT_MODEL,
        maxTokens: 200,
        temperature: 0.6,
      }
    );

    if (!response.success || !response.data) {
      console.error("[generate-feedback] LLM error:", response.error);
      return NextResponse.json({ feedback: null });
    }

    const feedback = response.data;
    if (!feedback || feedback.length < 10) {
      return NextResponse.json({ feedback: null });
    }

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("[generate-feedback] Error:", err);
    return NextResponse.json({ feedback: null });
  }
}