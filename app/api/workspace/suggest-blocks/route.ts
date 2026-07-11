import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { formatWeightedNeighborhoodSummary, type WeightedGridNeighbor } from "@/lib/block-skill-grid";

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

    const {
      workspaceId,
      sessionId,
      mode = "block",
      row,
      col,
      neighborTitles,
      weightedNeighbors,
      model: userModel,
      locale,
    } = await req.json();

    if (row === undefined || col === undefined) {
      return NextResponse.json({ error: "Grid position is required" }, { status: 400 });
    }

    if (mode === "chapter" && !sessionId) {
      return NextResponse.json({ error: "Session ID is required for chapter suggestions" }, { status: 400 });
    }

    if (mode === "block" && !workspaceId) {
      return NextResponse.json({ error: "Plan ID is required for block suggestions" }, { status: 400 });
    }

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Suggestion text must be in that language.`
        : "";

    let workspaceTitle = "Untitled workspace";
    let workspaceDescription = "";
    let blockList = "(none yet)";
    let entityLabel = "learning block";

    if (mode === "chapter") {
      entityLabel = "chapter";

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("id, user_id, problem")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.user_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const { data: sessionPlan, error: planError } = await supabase
        .from("session_plans")
        .select("steps")
        .eq("session_id", sessionId)
        .single();

      if (planError) {
        return NextResponse.json({ error: "Failed to fetch chapter plan" }, { status: 500 });
      }

      workspaceTitle = session.problem || "Session chapters";
      const steps = (sessionPlan?.steps || []) as Array<{
        description: string;
        position_x?: number;
        position_y?: number;
      }>;

      blockList = steps.length
        ? steps
            .map((step) => {
              const coords =
                step.position_x != null && step.position_y != null
                  ? ` at (${step.position_y},${step.position_x})`
                  : "";
              return `- ${step.description}${coords}`;
            })
            .join("\n")
        : "(none yet)";
    } else {
      const { data: plan, error: planError } = await supabase
        .from("workspaces")
        .select("id, user_id, root_topic, title, description")
        .eq("id", workspaceId)
        .single();

      if (planError || !plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }

      if (plan.user_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      workspaceTitle = plan.title || plan.root_topic || "Untitled workspace";
      workspaceDescription = plan.description || "";

      const { data: nodes, error: nodesError } = await supabase
        .from("blocks")
        .select("title, description, status, is_start, position_x, position_y")
        .eq("workspace_id", workspaceId);

      if (nodesError) {
        return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 });
      }

      blockList = (nodes || []).length
        ? (nodes || [])
            .map((node) => {
              const coords =
                node.position_x != null && node.position_y != null
                  ? ` at (${node.position_y},${node.position_x})`
                  : "";
              return `- ${node.title}${coords}${node.is_start ? " (start)" : ""}`;
            })
            .join("\n")
        : "(none yet)";
    }

    const spatialContext =
      Array.isArray(weightedNeighbors) && weightedNeighbors.length > 0
        ? formatWeightedNeighborhoodSummary(weightedNeighbors as WeightedGridNeighbor[])
        : Array.isArray(neighborTitles) && neighborTitles.length > 0
          ? neighborTitles.join(", ")
          : "none";

    const prompt = `Workspace: ${workspaceTitle}
${workspaceDescription ? `Description: ${workspaceDescription}\n` : ""}Existing ${mode === "chapter" ? "chapters" : "blocks"}:
${blockList}

New ${entityLabel} grid slot: row ${row}, column ${col}
Nearby ${mode === "chapter" ? "chapters" : "blocks"} (distance-weighted — closer items should influence suggestions more):
${spatialContext}

Suggest exactly 3 distinct ${entityLabel} topics that would fit naturally at this position in the skill grid. Each should complement existing items without duplicating them. Closer neighbors should have stronger thematic influence. Keep each suggestion 4-14 words, specific and actionable as a title.${languageNote ? `\n\n${languageNote}` : ""}`;

    const response = await callXaiJSON<SuggestBlocksResponse>(
      [
        systemMessage(
          `You suggest ${entityLabel} topics for a skill grid. Return JSON only: { "suggestions": ["...", "...", "..."] } with exactly 3 concise titles.`,
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