import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { persistSkillGridPositions, toSkillGridNodes } from "@/lib/skill-grid-positions";

interface NodeData {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
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

    const { nodeId, planId } = await req.json();
    
    if (!nodeId || !planId) {
      return NextResponse.json({ error: "Node ID and Plan ID are required" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("id, user_id, root_topic")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: allNodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId);

    if (nodesError || !allNodes) {
      return NextResponse.json({ error: "Failed to fetch nodes" }, { status: 500 });
    }

    const nodeToDelete = allNodes.find((n: { id: string }) => n.id === nodeId);
    if (!nodeToDelete) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const descendantIds = await findDescendantNodes(allNodes, nodeId);
    const nodesToDelete = new Set([nodeId, ...descendantIds]);

    const preservedNodes = allNodes.filter((n: { id: string }) => !nodesToDelete.has(n.id));
    const preservedCompleted = preservedNodes.filter((n: { status: string }) => n.status === "completed");

    const prompt = `Regenerate a learning plan for "${plan.root_topic}" as a directed graph where each node is a session.
    
The plan already has these completed nodes that must be preserved in the learning path:
${preservedCompleted.map((n: { title: string; description?: string }) => `- ${n.title}: ${n.description}`).join("\n")}

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters", "is_start": true/false, "next": ["b", "c"] }
  ]
}

Rules:
- The completed nodes above should be integrated naturally into the new learning path
- Use single-letter or short IDs for referencing (a, b, c...)
- is_start: true for nodes that can begin a learning path (must have at least one)
- next: array of node IDs that follow this node (can be empty or have 1-3 entries)
- Create branching paths (1 to many connections allowed)
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept
- Include 3-8 nodes total`;

    const response = await callXaiJSON<PlanData>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 1500,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      return NextResponse.json({ error: "Failed to regenerate plan" }, { status: 500 });
    }

    const newNodes = response.data.nodes || [];

    if (newNodes.length === 0) {
      return NextResponse.json({ error: "No nodes generated" }, { status: 400 });
    }

    for (const nodeIdToDelete of nodesToDelete) {
      await supabase
        .from("plan_nodes")
        .delete()
        .eq("id", nodeIdToDelete);
    }

    const nodeIdMap = new Map<string, string>();

    for (const nodeData of newNodes) {
      const { data: newNode, error: insertError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: planId,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_node_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (insertError || !newNode) {
        console.error("Failed to create node:", insertError);
        continue;
      }

      nodeIdMap.set(nodeData.id, newNode.id);
    }

    for (const nodeData of newNodes) {
      const currentNodeId = nodeIdMap.get(nodeData.id);
      if (!currentNodeId) continue;

      const nextIds: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextId of nodeData.next) {
          const targetId = nodeIdMap.get(nextId);
          if (targetId) {
            nextIds.push(targetId);
          }
        }
      }

      await supabase
        .from("plan_nodes")
        .update({ next_node_ids: nextIds })
        .eq("id", currentNodeId);
    }

    const { data: updatedNodes } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId);

    await persistSkillGridPositions(supabase, toSkillGridNodes(updatedNodes || []));

    return NextResponse.json({ 
      success: true, 
      newCount: newNodes.length,
      deletedCount: nodesToDelete.size
    });

  } catch (error) {
    console.error("Regenerate plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

function findDescendantNodes(
  nodes: { id: string; next_node_ids?: string[] }[],
  nodeId: string
): string[] {
  const descendants = new Set<string>();
  const queue = [nodeId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter((n) => 
      (n.next_node_ids || []).includes(currentId)
    );
    
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    }
  }
  
  return Array.from(descendants);
}
