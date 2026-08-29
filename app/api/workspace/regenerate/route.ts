import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { persistSkillGridPositions, toSkillGridNodes } from "@/lib/skill-grid-positions";
import { blockMapGlyphDbFields, composeBlockMapGlyphJsonInstruction } from "@/lib/block-map-glyph";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";

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
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { blockId, workspaceId } = await req.json();
    
    if (!blockId || !workspaceId) {
      return jsonError(400, "Node ID and Plan ID are required");
    }

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("id, user_id, root_topic, title, notes, workspace_goal")
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return jsonError(404, "Plan not found");
    }

    if (plan.user_id !== user.id) {
      return jsonError(403, "Access denied");
    }

    const { data: allNodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (nodesError || !allNodes) {
      return jsonError(500, "Failed to fetch nodes");
    }

    const { data: workspaceFiles } = await supabase
      .from("workspace_files")
      .select("file_name")
      .eq("workspace_id", workspaceId);

    const alwaysContext = composeBlockGenerationContext({
      workspaceTitle: plan.title || plan.root_topic || undefined,
      goal: plan.workspace_goal || plan.root_topic,
      notes: plan.notes,
      fileNames: (workspaceFiles || []).map((f: { file_name: string }) => f.file_name).filter(Boolean),
    });

    const nodeToDelete = allNodes.find((n: { id: string }) => n.id === blockId);
    if (!nodeToDelete) {
      return jsonError(404, "Node not found");
    }

    const descendantIds = await findDescendantNodes(allNodes, blockId);
    const nodesToDelete = new Set([blockId, ...descendantIds]);

    const preservedNodes = allNodes.filter((n: { id: string }) => !nodesToDelete.has(n.id));
    const preservedCompleted = preservedNodes.filter((n: { status: string }) => n.status === "completed");

    const prompt = `${alwaysContext}

Regenerate a learning plan for "${plan.root_topic}" as a directed graph where each node is a session.
Always honor workspace files and notes when creating blocks.
    
The plan already has these completed nodes that must be preserved in the learning path:
${preservedCompleted.map((n: { title: string; description?: string }) => `- ${n.title}: ${n.description}`).join("\n")}

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters", "keyword": "Foundations", "is_start": true/false, "next": ["b", "c"] }
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
- Include 3-8 nodes total
- ${composeBlockMapGlyphJsonInstruction()}`;

    const response = await callXaiJSON<PlanData>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 1500,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      return jsonError(500, "Failed to regenerate plan");
    }

    const newNodes = response.data.nodes || [];

    if (newNodes.length === 0) {
      return jsonError(400, "No nodes generated");
    }

    for (const blockIdToDelete of nodesToDelete) {
      await supabase
        .from("blocks")
        .delete()
        .eq("id", blockIdToDelete);
    }

    const blockIdMap = new Map<string, string>();

    for (const nodeData of newNodes) {
      const { data: newNode, error: insertError } = await supabase
        .from("blocks")
        .insert({
          workspace_id: workspaceId,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_block_ids: [],
          status: "available",
          ...blockMapGlyphDbFields(nodeData, nodeData.title),
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

    const { data: updatedNodes } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    await persistSkillGridPositions(supabase, toSkillGridNodes(updatedNodes || []));

    return NextResponse.json({ 
      success: true, 
      newCount: newNodes.length,
      deletedCount: nodesToDelete.size
    });

  } catch (error) {
    console.error("Regenerate plan error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Internal error");
  }
}

function findDescendantNodes(
  nodes: { id: string; next_block_ids?: string[] }[],
  blockId: string
): string[] {
  const descendants = new Set<string>();
  const queue = [blockId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter((n) => 
      (n.next_block_ids || []).includes(currentId)
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
