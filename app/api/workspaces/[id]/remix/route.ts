import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { toSkillGridNodes, withSkillGridPositions } from "@/lib/skill-grid-positions";
import { blockMapGlyphDbFields, composeBlockMapGlyphJsonInstruction } from "@/lib/block-map-glyph";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { remixPrompt, title, exactCopy } = await req.json();

    if (!exactCopy && (!remixPrompt || typeof remixPrompt !== "string")) {
      return jsonError(400, "Remix prompt is required");
    }

    if (!title || typeof title !== "string") {
      return jsonError(400, "Title is required");
    }

    const { data: sourcePlan, error: planQueryError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (planQueryError || !sourcePlan) {
      console.error("Source plan error:", planQueryError);
      return jsonError(404, "Source plan not found");
    }

    if (!sourcePlan.is_public) {
      return jsonError(403, "Cannot remix a private plan");
    }

    const { data: sourceNodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (nodesError) {
      console.error("Nodes error:", nodesError);
      return jsonError(500, "Could not fetch source nodes");
    }

    if (exactCopy) {
      const { data: newPlan, error: planError } = await supabase
        .from("workspaces")
        .insert({
          user_id: user.id,
          root_topic: title.trim(),
          title: title.trim(),
          status: "active",
          is_public: false,
          author_id: user.id,
          original_workspace_id: workspaceId,
        })
        .select()
        .single();

      if (planError) {
        console.error("Plan insert error:", planError);
        throw new Error(`Could not create new plan: ${planError.message}`);
      }

      const blockIdMap = new Map<string, string>();
      for (const node of sourceNodes || []) {
        blockIdMap.set(node.id, crypto.randomUUID());
      }

      const newNodes = (sourceNodes || []).map((node) => ({
        id: blockIdMap.get(node.id),
        workspace_id: newPlan.id,
        title: node.title,
        description: node.description,
        map_keyword: node.map_keyword ?? null,
        map_icon: node.map_icon ?? null,
        is_start: node.is_start || false,
        next_block_ids: (node.next_block_ids || [])
          .map((id: string) => blockIdMap.get(id))
          .filter(Boolean),
        status: "available",
      }));

      const nodesWithPositions = withSkillGridPositions(
        newNodes.map((node, index) => ({
          ...node,
          id: node.id as string,
          position_x: sourceNodes?.[index]?.position_x ?? undefined,
          position_y: sourceNodes?.[index]?.position_y ?? undefined,
        })),
        toSkillGridNodes(
          newNodes.map((node, index) => ({
            id: node.id as string,
            title: node.title,
            is_start: node.is_start,
            next_block_ids: (node.next_block_ids || []).filter((nextId: string | undefined): nextId is string =>
              Boolean(nextId),
            ),
            status: node.status,
            position_x: sourceNodes?.[index]?.position_x ?? undefined,
            position_y: sourceNodes?.[index]?.position_y ?? undefined,
          })),
        ),
      );

      const { error: insertError } = await supabase
        .from("blocks")
        .insert(nodesWithPositions);

      if (insertError) {
        if (insertError.message.includes("schema cache") && insertError.message.includes("position_")) {
          const { error: retryError } = await supabase
            .from("blocks")
            .insert(newNodes);

          if (retryError) {
            console.error("Nodes insert retry error:", retryError);
            await supabase.from("workspaces").delete().eq("id", newPlan.id);
            throw new Error(`Could not copy nodes: ${retryError.message}`);
          }
        } else {
          console.error("Nodes insert error:", insertError);
          await supabase.from("workspaces").delete().eq("id", newPlan.id);
          throw new Error(`Could not copy nodes: ${insertError.message}`);
        }
      }

      await supabase
        .from("workspaces")
        .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
        .eq("id", workspaceId);

      return NextResponse.json({
        success: true,
        workspaceId: newPlan.id,
        message: `Plan copied with ${newNodes.length} sessions!`,
      });
    }

    const originalTopics = (sourceNodes || [])
      .map((n: { title: string; description?: string }) => `${n.title}: ${n.description}`)
      .join("; ");

    const prompt = `Create a new learning plan for a new learner based on an existing one.

ORIGINAL PLAN TOPIC: "${sourcePlan.root_topic}"

ORIGINAL LEARNING SESSIONS (for context only - do not use these IDs):
${originalTopics}

USER'S REMIX REQUEST: "${remixPrompt}"

Create a new learning plan according to the user's request. Consider:
- Adjust difficulty level based on their background
- Focus on specific areas they mentioned
- Adapt the pacing or structure as needed
- Keep the core learning goals but reshape the path

IMPORTANT: Create a completely fresh plan tailored to the user's needs. The new plan should be MORE suitable for them, not a copy of the original.

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Session Title", "description": "Why this matters", "keyword": "Core Foundations", "is_start": true/false, "next": ["b"] }
  ]
}

Rules:
- Use single-letter IDs (a, b, c...)
- is_start: true for at least one starting node
- next: array of IDs this node points to
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept
- Include 3-10 nodes total
- ${composeBlockMapGlyphJsonInstruction()}`;

    const response = await callXaiJSON<PlanData>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 3000,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      console.error("xAI error:", response.error);
      return jsonError(500, "Failed to remix plan");
    }

    const planData = response.data;

    if (!planData.nodes || !Array.isArray(planData.nodes)) {
      return jsonError(500, "Invalid plan data format");
    }

    const { data: newPlan, error: planError } = await supabase
      .from("workspaces")
      .insert({
        user_id: user.id,
        root_topic: title.trim(),
        title: title.trim(),
        status: "active",
        is_public: false,
        author_id: user.id,
        original_workspace_id: workspaceId,
      })
      .select()
      .single();

    if (planError) {
      console.error("Plan insert error:", planError);
      throw new Error(`Could not create new plan: ${planError.message}`);
    }

    // First pass: create UUID mappings for all nodes
    const blockIdMap = new Map<string, string>();
    for (const node of planData.nodes) {
      blockIdMap.set(node.id, crypto.randomUUID());
    }

    // Second pass: create nodes with mapped IDs
    const newNodes = planData.nodes.map((node: NodeData) => ({
      id: blockIdMap.get(node.id),
      workspace_id: newPlan.id,
      title: node.title,
      description: node.description,
      is_start: node.is_start || false,
      next_block_ids: (node.next || []).filter((id: string) => blockIdMap.has(id)).map((id: string) => blockIdMap.get(id)),
      status: "available",
      ...blockMapGlyphDbFields(node, node.title),
    }));

    const nodesToInsert = withSkillGridPositions(
      newNodes.map((node) => ({ ...node, id: node.id as string })),
      toSkillGridNodes(
        newNodes.map((node) => ({
          id: node.id as string,
          title: node.title,
          is_start: node.is_start,
          next_block_ids: (node.next_block_ids || []).filter((nextId: string | undefined): nextId is string =>
            Boolean(nextId),
          ),
          status: node.status,
        })),
      ),
    );

    const { error: insertError } = await supabase
      .from("blocks")
      .insert(nodesToInsert);

    if (insertError) {
      console.error("Nodes insert error:", insertError);
      // Rollback: delete the plan we just created
      await supabase.from("workspaces").delete().eq("id", newPlan.id);
      throw new Error(`Could not create nodes: ${insertError.message}`);
    }

    await supabase
      .from("workspaces")
      .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
      .eq("id", workspaceId);

    return NextResponse.json({
      success: true,
      workspaceId: newPlan.id,
      message: `Plan remixed with ${nodesToInsert.length} adapted sessions!`,
    });
  } catch (error) {
    console.error("Error remixing plan:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to remix plan");
  }
}
