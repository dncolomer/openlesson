import { NextRequest, NextResponse } from "next/server";
import { generateOpeningProbe } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import { createClient } from "@/lib/supabase/server";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, objectives, sessionId, tutoringLanguage: bodyLanguage } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    // Get tutoring language from body or session metadata
    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage && sessionId) {
      const supabase = await createClient();
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", sessionId)
        .single();
      if (sessionData?.metadata?.tutoringLanguage) {
        tutoringLanguage = sessionData.metadata.tutoringLanguage;
      }
    }
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    const promptOverrides = await getUserPrompts();

    const result = await generateOpeningProbe(problem, promptOverrides, objectives, languageName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Opening probe generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ probe: result.probe });
  } catch (error) {
    console.error("Opening probe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
