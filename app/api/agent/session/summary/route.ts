import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey } from "@/lib/x402";

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

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get("session_id");

    if (!session_id) {
      return NextResponse.json(
        { error: "Session ID is required (session_id query param)" },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, problem, status, report, report_generated_at, is_agent_workspace")
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

    if (!session.report || !session.report_generated_at) {
      return NextResponse.json({
        ready: false,
        message: "Session report not ready yet. Call /session/end first to generate the report.",
        sessionId: session_id,
        status: session.status,
      });
    }

    return NextResponse.json({
      ready: true,
      sessionId: session_id,
      report: session.report,
      createdAt: session.report_generated_at,
      status: session.status,
    });
  } catch (error) {
    console.error("Agent session summary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
