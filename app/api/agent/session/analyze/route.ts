import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey, getX402Price, getX402Description } from "@/lib/x402";
import { analyzeGap } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import { getLanguageName } from "@/lib/tutoring-languages";

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
    const { session_id, audio_base64, audio_format } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    if (!audio_base64) {
      return NextResponse.json(
        { error: "Audio data is required (audio_base64)" },
        { status: 400 }
      );
    }

    if (!audio_format) {
      return NextResponse.json(
        { error: "Audio format is required (audio_format: webm, mp4, etc.)" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, problem, is_agent_workspace, status, metadata")
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

    if (!session.is_agent_workspace) {
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

    const promptOverrides = await getUserPrompts();

    const tutoringLanguage = session.metadata?.tutoringLanguage;
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    const result = await analyzeGap({
      audioBase64: audio_base64,
      audioFormat: audio_format,
      problem: session.problem,
      promptOverrides,
      tutoringLanguage: languageName,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Analysis failed" },
        { status: 500 }
      );
    }

    const gapScore = result.result!.gap_score;
    const signals = result.result!.signals;
    const transcript = result.result!.transcript || "";

    let followUpQuestion = "";
    if (gapScore > 0.5) {
      followUpQuestion = signals.length > 0
        ? signals[0]
        : "Can you explain your reasoning further?";
    }

    return NextResponse.json({
      sessionId: session.id,
      gapScore,
      signals,
      transcript: transcript.substring(0, 1000),
      followUpQuestion,
      requiresFollowUp: gapScore > 0.5,
      price: getX402Price("session_analyze"),
      currency: "usd",
    });
  } catch (error) {
    console.error("Agent session analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const price = getX402Price("session_analyze");

  return NextResponse.json({
    endpoint: "session_analyze",
    description: getX402Description("session_analyze"),
    price,
    currency: "usd",
    required_params: ["session_id", "audio_base64", "audio_format"],
    optional_params: [],
    audio_required: true,
    audio_format_note: "Only audio input accepted (webm, mp4, ogg). Base64 encode the audio data.",
    usage: "Submit an audio chunk for analysis. Returns gap score, reasoning signals, and a follow-up question if needed.",
  });
}
