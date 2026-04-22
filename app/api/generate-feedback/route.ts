import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { callXaiText, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { getFileTextContent } from "@/lib/xai-files";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { sessionId, problem } = await request.json();
    console.log("[generate-feedback] Request:", { sessionId, problem });

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const transcripts: string[] = [];

    // Fetch session transcript chunk metadata, then download content from xAI
    const { data: transcriptRecords, error: transcriptError } = await supabase
      .from("session_transcript")
      .select("id, xai_file_id, timestamp_ms")
      .eq("session_id", sessionId)
      .order("timestamp_ms", { ascending: true })
      .limit(20);

    if (transcriptError) {
      console.error("[generate-feedback] Error fetching transcript records:", transcriptError);
    } else {
      console.log("[generate-feedback] Found", transcriptRecords?.length || 0, "transcript records");

      for (const record of transcriptRecords || []) {
        if (record.xai_file_id && record.xai_file_id !== "_empty") {
          const text = await getFileTextContent(record.xai_file_id);
          if (text) transcripts.push(text);
        }
      }
    }

    if (transcripts.length === 0) {
      console.log("[generate-feedback] No transcripts found");
      return NextResponse.json({
        feedback: null,
        debug: { reason: "No transcripts found in session_transcript" }
      });
    }

    const combinedTranscript = transcripts.reverse().join("\n\n");
    console.log("[generate-feedback] Combined length:", combinedTranscript.length);

    // Call LLM using shared client
    const response = await callXaiText(
      [
        systemMessage("You are an AI learning assistant. Based on the student's speech, give brief feedback (1-2 sentences)."),
        userMessage(`Problem: ${problem}\n\nTranscripts:\n${combinedTranscript}`)
      ],
      {
        model: DEFAULT_MODEL,
        maxTokens: 200,
        temperature: 0.6,
      }
    );

    console.log("[generate-feedback] LLM success:", response.success);
    
    if (!response.success || !response.data) {
      console.error("[generate-feedback] LLM error:", response.error);
      return NextResponse.json({ 
        feedback: null,
        debug: { reason: "LLM call failed", error: response.error }
      });
    }

    const feedback = response.data;
    console.log("[generate-feedback] Feedback:", feedback);

    if (!feedback || feedback.length < 10) {
      return NextResponse.json({ feedback: null });
    }

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("[generate-feedback] Error:", err);
    return NextResponse.json({ feedback: null });
  }
}
