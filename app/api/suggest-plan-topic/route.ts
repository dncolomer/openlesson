import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, problem, report } = body;

    if (!problem || !report) {
      return jsonError(400, "Missing problem or report");
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body), ileToken: ileTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    // Optionally fetch file IDs for richer context
    let fileIds: string[] = [];
    if (sessionId) {
      
      const { data: powRows } = await supabase
        .from("proof_of_work")
        .select("xai_file_id")
        .eq("session_id", sessionId);

      if (powRows) {
        for (const r of powRows) {
          if (r.xai_file_id && r.xai_file_id !== "_empty" && !String(r.xai_file_id).startsWith("storage:")) {
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
      return jsonError(500, "Failed to generate suggestion");
    }

    // Clean up the response - remove quotes and extra whitespace
    const suggestion = response.data.trim().replace(/^["']|["']$/g, '');

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Suggest plan topic error:", error);
    return jsonError(500, "Internal server error");
  }
}
