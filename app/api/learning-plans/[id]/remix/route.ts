import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { toSkillGridNodes, withSkillGridPositions } from "@/lib/skill-grid-positions";

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
    const { id: planId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { remixPrompt, title, exactCopy } = await req.json();

    if (!exactCopy && (!remixPrompt || typeof remixPrompt !== "string")) {
      return NextResponse.json(
        { error: "Remix prompt is required" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const { data: sourcePlan, error: planQueryError } = await supabase
      .from("learning_plans")
      .select("*, profiles:author_id(username)")
      .eq("id", planId)
      .single();

    if (planQueryError || !sourcePlan) {
      console.error("Source plan error:", planQueryError);
      return NextResponse.json({ error: "Source plan not found" }, { status: 404 });
    }

    if (!sourcePlan.is_public) {
      return NextResponse.json(
        { error: "Cannot remix a private plan" },
        { status: 403 }
      );
    }

    const { data: sourceNodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId);

    if (nodesError) {
      console.error("Nodes error:", nodesError);
      return NextResponse.json({ error: "Could not fetch source nodes" }, { status: 500 });
    }

    if (exactCopy) {
      const { data: newPlan, error: planError } = await supabase
        .from("learning_plans")
        .insert({
          user_id: user.id,
          root_topic: title.trim(),
          title: title.trim(),
          status: "active",
          is_public: false,
          author_id: user.id,
          original_plan_id: planId,
        })
        .select()
        .single();

      if (planError) {
        console.error("Plan insert error:", planError);
        throw new Error(`Could not create new plan: ${planError.message}`);
      }

      const nodeIdMap = new Map<string, string>();
      for (const node of sourceNodes || []) {
        nodeIdMap.set(node.id, crypto.randomUUID());
      }

      const newNodes = (sourceNodes || []).map((node) => ({
        id: nodeIdMap.get(node.id),
        plan_id: newPlan.id,
        title: node.title,
        description: node.description,
        is_start: node.is_start || false,
        next_node_ids: (node.next_node_ids || [])
          .map((id: string) => nodeIdMap.get(id))
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
            next_node_ids: (node.next_node_ids || []).filter((nextId: string | undefined): nextId is string =>
              Boolean(nextId),
            ),
            status: node.status,
            position_x: sourceNodes?.[index]?.position_x ?? undefined,
            position_y: sourceNodes?.[index]?.position_y ?? undefined,
          })),
        ),
      );

      const { error: insertError } = await supabase
        .from("plan_nodes")
        .insert(nodesWithPositions);

      if (insertError) {
        if (insertError.message.includes("schema cache") && insertError.message.includes("position_")) {
          const { error: retryError } = await supabase
            .from("plan_nodes")
            .insert(newNodes);

          if (retryError) {
            console.error("Nodes insert retry error:", retryError);
            await supabase.from("learning_plans").delete().eq("id", newPlan.id);
            throw new Error(`Could not copy nodes: ${retryError.message}`);
          }
        } else {
          console.error("Nodes insert error:", insertError);
          await supabase.from("learning_plans").delete().eq("id", newPlan.id);
          throw new Error(`Could not copy nodes: ${insertError.message}`);
        }
      }

      await supabase
        .from("learning_plans")
        .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
        .eq("id", planId);

      return NextResponse.json({
        success: true,
        planId: newPlan.id,
        message: `Plan copied with ${newNodes.length} sessions!`,
      });
    }

    const authorUsername = sourcePlan.profiles?.username;

    const originalTopics = (sourceNodes || [])
      .map((n: { title: string; description?: string }) => `${n.title}: ${n.description}`)
      .join("; ");

    const prompt = `Create a new learning plan for a new learner based on an existing one.

ORIGINAL PLAN TOPIC: "${sourcePlan.root_topic}"
${
  authorUsername
    ? `Originally created by: @${authorUsername}`
    : ""
}

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
    { "id": "a", "title": "Session Title", "description": "Why this matters", "is_start": true/false, "next": ["b"] }
  ]
}

Rules:
- Use single-letter IDs (a, b, c...)
- is_start: true for at least one starting node
- next: array of IDs this node points to
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept
- Include 3-10 nodes total`;

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
      return NextResponse.json({ error: "Failed to remix plan" }, { status: 500 });
    }

    const planData = response.data;

    if (!planData.nodes || !Array.isArray(planData.nodes)) {
      return NextResponse.json({ error: "Invalid plan data format" }, { status: 500 });
    }

    const { data: newPlan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: user.id,
        root_topic: title.trim(),
        title: title.trim(),
        status: "active",
        is_public: false,
        author_id: user.id,
        original_plan_id: planId,
      })
      .select()
      .single();

    if (planError) {
      console.error("Plan insert error:", planError);
      throw new Error(`Could not create new plan: ${planError.message}`);
    }

    // First pass: create UUID mappings for all nodes
    const nodeIdMap = new Map<string, string>();
    for (const node of planData.nodes) {
      nodeIdMap.set(node.id, crypto.randomUUID());
    }

    // Second pass: create nodes with mapped IDs
    const newNodes = planData.nodes.map((node: NodeData) => ({
      id: nodeIdMap.get(node.id),
      plan_id: newPlan.id,
      title: node.title,
      description: node.description,
      is_start: node.is_start || false,
      next_node_ids: (node.next || []).filter((id: string) => nodeIdMap.has(id)).map((id: string) => nodeIdMap.get(id)),
      status: "available",
    }));

    const nodesToInsert = withSkillGridPositions(
      newNodes.map((node) => ({ ...node, id: node.id as string })),
      toSkillGridNodes(
        newNodes.map((node) => ({
          id: node.id as string,
          title: node.title,
          is_start: node.is_start,
          next_node_ids: (node.next_node_ids || []).filter((nextId: string | undefined): nextId is string =>
            Boolean(nextId),
          ),
          status: node.status,
        })),
      ),
    );

    const { error: insertError } = await supabase
      .from("plan_nodes")
      .insert(nodesToInsert);

    if (insertError) {
      console.error("Nodes insert error:", insertError);
      // Rollback: delete the plan we just created
      await supabase.from("learning_plans").delete().eq("id", newPlan.id);
      throw new Error(`Could not create nodes: ${insertError.message}`);
    }

    await supabase
      .from("learning_plans")
      .update({ remix_count: (sourcePlan.remix_count || 0) + 1 })
      .eq("id", planId);

    return NextResponse.json({
      success: true,
      planId: newPlan.id,
      message: `Plan remixed with ${nodesToInsert.length} adapted sessions!`,
    });
  } catch (error) {
    console.error("Error remixing plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remix plan" },
      { status: 500 }
    );
  }
}
