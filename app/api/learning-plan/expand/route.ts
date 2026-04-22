import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

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

    const { nodeId } = await req.json();
    
    if (!nodeId) {
      return NextResponse.json({ error: "Node ID is required" }, { status: 400 });
    }

    const { data: node, error: nodeError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("id", nodeId)
      .single();

    if (nodeError || !node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const { data: plan } = await supabase
      .from("learning_plans")
      .select("user_id, is_public")
      .eq("id", node.plan_id)
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

    const nodeIdMap = new Map<string, string>();

    for (const nodeData of newNodes) {
      const { data: newNode, error: insertError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: node.plan_id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: false,
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

    const newNodeIds = Array.from(nodeIdMap.values());
    if (newNodeIds.length > 0) {
      const currentNextIds = node.next_node_ids || [];
      await supabase
        .from("plan_nodes")
        .update({ next_node_ids: [...currentNextIds, ...newNodeIds] })
        .eq("id", nodeId);
    }

    const { data: allNodes } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", node.plan_id);

    const edges = (allNodes || []).flatMap((n: { id: string; next_node_ids?: string[] }) =>
      (n.next_node_ids || []).map((nextId: string) => ({
        from: n.id,
        to: nextId
      }))
    );

    const positions = calculateForceDirectedLayout(allNodes || [], edges);

    for (const [id, pos] of positions) {
      await supabase
        .from("plan_nodes")
        .update({ 
          position_x: Math.round(pos.x),
          position_y: Math.round(pos.y)
        })
        .eq("id", id);
    }

    return NextResponse.json({ success: true, newCount: newNodeIds.length });

  } catch (error) {
    console.error("Expand plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

function calculateForceDirectedLayout(
  nodes: { id: string }[],
  edges: { from: string; to: string }[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return positions;
  
  const width = 800;
  const height = 600;
  const padding = 80;
  
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const radius = Math.min(width, height) / 3;
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
    });
  });
  
  const iterations = 50;
  const repulsion = 5000;
  const attraction = 0.1;
  const damping = 0.9;
  
  const velocities = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => velocities.set(n.id, { x: 0, y: 0 }));
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => forces.set(n.id, { x: 0, y: 0 }));
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const posA = positions.get(nodes[i].id)!;
        const posB = positions.get(nodes[j].id)!;
        
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        const fA = forces.get(nodes[i].id)!;
        const fB = forces.get(nodes[j].id)!;
        fA.x -= fx;
        fA.y -= fy;
        fB.x += fx;
        fB.y += fy;
      }
    }
    
    for (const edge of edges) {
      const posA = positions.get(edge.from);
      const posB = positions.get(edge.to);
      if (!posA || !posB) continue;
      
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const force = (dist - 100) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      const fA = forces.get(edge.from)!;
      const fB = forces.get(edge.to)!;
      fA.x += fx;
      fA.y += fy;
      fB.x -= fx;
      fB.y -= fy;
    }
    
    for (const node of nodes) {
      const pos = positions.get(node.id)!;
      const vel = velocities.get(node.id)!;
      const force = forces.get(node.id)!;
      
      vel.x = (vel.x + force.x) * damping;
      vel.y = (vel.y + force.y) * damping;
      
      pos.x += vel.x;
      pos.y += vel.y;
      
      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    }
  }
  
  return positions;
}
