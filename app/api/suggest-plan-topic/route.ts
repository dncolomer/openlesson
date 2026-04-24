import { NextRequest, NextResponse } from "next/server";
import { callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, problem, report } = body;

    if (!problem || !report) {
      return NextResponse.json({ error: "Missing problem or report" }, { status: 400 });
    }

    // Optionally fetch file IDs for richer context
    let fileIds: string[] = [];
    if (sessionId) {
      const supabase = await createClient();
      
      const { data: transcripts } = await supabase
        .from("session_transcript")
        .select("xai_file_id")
        .eq("session_id", sessionId);

      const { data: analyses } = await supabase
        .from("session_analysis")
        .select("xai_file_id")
        .eq("session_id", sessionId);

      if (transcripts) {
        for (const r of transcripts) {
          if (r.xai_file_id && r.xai_file_id !== "_empty") {
            fileIds.push(r.xai_file_id);
          }
        }
      }
      
      if (analyses) {
        for (const r of analyses as Array<{ xai_file_id: string | null }>) {
          if (r.xai_file_id) {
            fileIds.push(r.xai_file_id);
          }
        }
      }
    }

    const prompt = `Based on this completed tutoring session, suggest ONE specific learning plan topic that would help the student continue their learning journey.

Session Topic: ${problem}

Session Report:
${report}

Generate a single, specific topic for a multi-session learning plan that:
1. Builds on what was learned or addresses gaps found
2. Is broader/deeper than a single session topic
3. Would benefit from a structured multi-week approach

Return ONLY the suggested topic text (5-15 words), nothing else. No quotes, no explanation.`;

    const response = await callXaiText(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 100,
        temperature: 0.7,
      }
    );

    if (!response.success || !response.data) {
      return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
    }

    // Clean up the response - remove quotes and extra whitespace
    const suggestion = response.data.trim().replace(/^["']|["']$/g, '');

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Suggest plan topic error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
