import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { generateFollowUpSessions } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, problem, duration, gapsSummary, reportSummary } = body;

    if (!problem) {
      return jsonError(400, "Missing problem");
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body), ileToken: ileTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const promptOverrides = await getUserPrompts();

    // If sessionId provided, fetch file IDs from the database
    let fileIds: string[] | undefined;
    if (sessionId) {
      
      // Fetch transcript file IDs
      const { data: transcripts } = await supabase
        .from("session_transcript")
        .select("xai_file_id")
        .eq("session_id", sessionId);

      // Fetch analysis file IDs
      const { data: analyses } = await supabase
        .from("session_analysis")
        .select("xai_file_id")
        .eq("session_id", sessionId);

      fileIds = [];
      
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

    const result = await generateFollowUpSessions({
      problem,
      duration: duration || "unknown",
      gapsSummary: gapsSummary || "",
      reportSummary: reportSummary || "",
      promptOverrides,
      fileIds: fileIds && fileIds.length > 0 ? fileIds : undefined,
    });

    if (!result.success) {
      return jsonError(500, result.error || "Failed to generate suggestions");
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } catch (error) {
    console.error("Generate follow-ups error:", error);
    return jsonError(500, "Internal server error");
  }
}
