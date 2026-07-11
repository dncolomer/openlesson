import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { persistSkillGridPositions, toSkillGridNodes } from "@/lib/skill-grid-positions";

interface NodeData {
  id: string;
  title: string;
  description?: string;
  next?: string[];
}

interface PlanData {
  nodes: NodeData[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { blockId } = await req.json();
    
    if (!blockId) {
      return NextResponse.json({ error: "Node ID is required" }, { status: 400 });
    }

    const { data: node, error: nodeError } = await supabase
      .from("blocks")
      .select("*")
      .eq("id", blockId)
      .single();

    if (nodeError || !node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const { data: plan } = await supabase
      .from("workspaces")
      .select("user_id, is_public")
      .eq("id", node.workspace_id)
      .single();

    if (!plan || (plan.user_id !== user.id && !plan.is_public)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const prompt = `Expand the topic "${node.title}" with 2-4 follow-up learning sessions as a directed graph.

Return ONLY valid JSON:
{
  "nodes": [
    { "id": "a", "title": "Session Title", "description": "Why this matters", "next": ["b"] }
  ]
}

Rules:
- 2-4 new nodes
- Each is a distinct learning session building on "${node.title}"
- Use simple IDs (a, b, c...) for referencing
- next: array of IDs this node points to (can create chains or branches)
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence`;

    const response = await callXaiJSON<PlanData>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 1000,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      return NextResponse.json({ error: "Failed to expand plan" }, { status: 500 });
    }

    const newNodes = response.data.nodes || [];

    if (newNodes.length === 0) {
      return NextResponse.json({ error: "No nodes to expand" }, { status: 400 });
    }

    const blockIdMap = new Map<string, string>();

    for (const nodeData of newNodes) {
      const { data: newNode, error: insertError } = await supabase
        .from("blocks")
        .insert({
          workspace_id: node.workspace_id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: false,
          next_block_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (insertError || !newNode) {
        console.error("Failed to create node:", insertError);
        continue;
      }

      blockIdMap.set(nodeData.id, newNode.id);
    }

    for (const nodeData of newNodes) {
      const currentNodeId = blockIdMap.get(nodeData.id);
      if (!currentNodeId) continue;

      const nextIds: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextId of nodeData.next) {
          const targetId = blockIdMap.get(nextId);
          if (targetId) {
            nextIds.push(targetId);
          }
        }
      }

      await supabase
        .from("blocks")
        .update({ next_block_ids: nextIds })
        .eq("id", currentNodeId);
    }

    const newNodeIds = Array.from(blockIdMap.values());
    if (newNodeIds.length > 0) {
      const currentNextIds = node.next_block_ids || [];
      await supabase
        .from("blocks")
        .update({ next_block_ids: [...currentNextIds, ...newNodeIds] })
        .eq("id", blockId);
    }

    const { data: allNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", node.workspace_id);

    await persistSkillGridPositions(supabase, toSkillGridNodes(allNodes || []), {
      onlyNodeIds: newNodeIds,
    });

    return NextResponse.json({ success: true, newCount: newNodeIds.length });

  } catch (error) {
    console.error("Expand plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
