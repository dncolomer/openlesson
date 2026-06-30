import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

interface SuggestBlocksResponse {
  suggestions: string[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, row, col, neighborTitles, model: userModel, locale } = await req.json();

    if (!planId || row === undefined || col === undefined) {
      return NextResponse.json({ error: "Plan ID and grid position are required" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("id, user_id, root_topic, title, description")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("title, description, status, is_start")
      .eq("plan_id", planId);

    if (nodesError) {
      return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 });
    }

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Suggestion text must be in that language.`
        : "";

    const workspaceTitle = plan.title || plan.root_topic || "Untitled workspace";
    const blockList = (nodes || [])
      .map((node, index) => `${index + 1}. ${node.title}${node.is_start ? " (start)" : ""}`)
      .join("\n");

    const neighbors = Array.isArray(neighborTitles) && neighborTitles.length > 0
      ? neighborTitles.join(", ")
      : "none";

    const prompt = `Workspace: ${workspaceTitle}
${plan.description ? `Description: ${plan.description}\n` : ""}Existing blocks:
${blockList || "(none yet)"}

New block grid slot: row ${row + 1}, column ${col + 1}
Adjacent blocks: ${neighbors}

Suggest exactly 3 distinct learning block topics that would fit naturally at this position in the skill grid. Each should complement existing blocks without duplicating them. Keep each suggestion 4-14 words, specific and actionable as a block title.${languageNote ? `\n\n${languageNote}` : ""}`;

    const response = await callXaiJSON<SuggestBlocksResponse>(
      [
        systemMessage(
          'You suggest learning block topics for a workspace skill grid. Return JSON only: { "suggestions": ["...", "...", "..."] } with exactly 3 concise block titles.',
        ),
        userMessage(prompt),
      ],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 300,
        temperature: 0.7,
      },
    );

    if (!response.success || !response.data?.suggestions?.length) {
      return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
    }

    const suggestions = response.data.suggestions
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (suggestions.length === 0) {
      return NextResponse.json({ error: "No suggestions returned" }, { status: 500 });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggest blocks error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}