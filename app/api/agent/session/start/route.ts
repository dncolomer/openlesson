import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashApiKey, getX402Price, getX402Description } from "@/lib/x402";

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
    const { block_id, problem } = body;

    if (!problem || typeof problem !== "string") {
      return NextResponse.json(
        { error: "Problem is required" },
        { status: 400 }
      );
    }

    const price = getX402Price("session_start");

    // x402 payment check disabled for now
    // const payment = checkX402Payment(req.headers);
    // if (!payment.valid) {
    //   const response = create402Response("session_start");
    //   if (response) {
    //     return response;
    //   }
    // }

    let blockTitle = problem;
    let workspaceId: string | null = null;

    if (block_id) {
      const { data: node } = await supabase
        .from("blocks")
        .select("id, title, workspace_id, status")
        .eq("id", block_id)
        .single();

      if (node) {
        blockTitle = node.title;
        workspaceId = node.workspace_id;
      }
    }

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: auth.user_id,
        problem,
        status: "active",
        is_agent_workspace: true,
        metadata: {
          block_id: block_id || null,
          workspace_id: workspaceId,
          block_title: blockTitle,
        },
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error("Failed to create session:", sessionError);
      return NextResponse.json(
        { error: "Failed to create session", details: sessionError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      problem,
      blockTitle,
      workspaceId,
      status: "active",
      price,
      currency: "usd",
      instructions: {
        audioFormat: "webm",
        submitEndpoint: "/api/agent/session/analyze",
        maxChunkDuration: 60000,
      },
    });
  } catch (error) {
    console.error("Agent session start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const price = getX402Price("session_start");

  return NextResponse.json({
    endpoint: "session_start",
    description: getX402Description("session_start"),
    price,
    currency: "usd",
    required_params: ["problem"],
    optional_params: ["block_id", "x402_payment_id"],
    audio_required: false,
    usage: "Start a new tutoring session. Returns sessionId for audio submission.",
  });
}
