import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import {
  buildSkillGridLayout,
  formatWeightedNeighborhoodSummary,
  isCellOccupied,
  type WeightedGridNeighbor,
} from "@/lib/block-skill-grid";
import { toSkillGridNodes } from "@/lib/skill-grid-positions";

interface AddBlockResponse {
  title: string;
  description: string;
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

    const { workspaceId, row, col, prompt, model: userModel, locale, weightedNeighbors } = await req.json();

    if (!workspaceId || typeof row !== "number" || typeof col !== "number" || !prompt?.trim()) {
      return NextResponse.json({ error: "Plan ID, grid position, and prompt are required" }, { status: 400 });
    }

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

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 });
    }

    const skillNodes = toSkillGridNodes(nodes);
    const { occupancy } = buildSkillGridLayout(skillNodes);

    if (isCellOccupied(occupancy, row, col)) {
      return NextResponse.json({ error: "That grid slot is already occupied" }, { status: 409 });
    }

    const hasSavedCollision = nodes.some(
      (node) => node.position_x === col && node.position_y === row,
    );
    if (hasSavedCollision) {
      return NextResponse.json({ error: "That grid slot is already occupied" }, { status: 409 });
    }

    const languageNote =
      locale && locale !== "en"
        ? `Respond in ${locale} language. Title and description must be in that language.`
        : "";

    const workspaceTitle = plan.title || plan.root_topic || "Untitled workspace";
    const neighborSummary = Array.isArray(weightedNeighbors) && weightedNeighbors.length > 0
      ? formatWeightedNeighborhoodSummary(weightedNeighbors as WeightedGridNeighbor[])
      : "none";

    const blockList = nodes
      .map((node) => {
        const coords =
          node.position_x != null && node.position_y != null
            ? ` at (${node.position_y},${node.position_x})`
            : "";
        return `- ${node.title}${coords}`;
      })
      .join("\n");

    const aiPrompt = `Workspace: ${workspaceTitle}
${plan.description ? `Description: ${plan.description}\n` : ""}Existing blocks:
${blockList || "(none yet)"}

Target grid slot: row ${row}, column ${col}
Nearby blocks (distance-weighted influence — closer blocks matter more):
${neighborSummary}

User request for the new block: "${prompt.trim()}"

Create exactly one learning block that belongs at this grid slot. The topic should fit the spatial context: complement nearby blocks, avoid duplicates, and respect distance-weighted influence.${languageNote ? `\n\n${languageNote}` : ""}`;

    const aiResponse = await callXaiJSON<AddBlockResponse>(
      [
        systemMessage(
          'You create a single learning block for a workspace skill grid slot. Return JSON only: { "title": "...", "description": "..." }. Title: 4-14 words. Description: 1-3 sentences.',
        ),
        userMessage(aiPrompt),
      ],
      {
        model: userModel || DEFAULT_MODEL,
        maxTokens: 600,
        temperature: 0.5,
      },
    );

    if (!aiResponse.success || !aiResponse.data?.title?.trim()) {
      return NextResponse.json({ error: aiResponse.error || "Failed to generate block" }, { status: 502 });
    }

    const { data: newNode, error: insertError } = await supabase
      .from("blocks")
      .insert({
        workspace_id: workspaceId,
        title: aiResponse.data.title.trim(),
        description: aiResponse.data.description?.trim() || "",
        is_start: nodes.length === 0,
        next_block_ids: [],
        status: "available",
        position_x: col,
        position_y: row,
      })
      .select()
      .single();

    if (insertError || !newNode) {
      return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
    }

    const { data: updatedNodes, error: fetchError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (fetchError) {
      return NextResponse.json({ error: "Block created but failed to refresh plan" }, { status: 500 });
    }

    return NextResponse.json({
      explanation: `Added "${newNode.title}" at grid slot (${row}, ${col}).`,
      planModified: true,
      updatedNodes: updatedNodes || [],
      placedNodeId: newNode.id,
    });
  } catch (error) {
    console.error("Add block at slot error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}