import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";

type Block = { id: string; title: string; description: string; is_start: boolean; next?: string[] };
type PlanData = { title: string; nodes: Block[] };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { rootQuestion } = await request.json();
  if (!rootQuestion || typeof rootQuestion !== "string") return NextResponse.json({ error: "Missing root question" }, { status: 400 });

  const result = await callXaiJSON<PlanData>([userMessage(`Generate a concise OpenLesson learning plan from this Rabbit Hole question: "${rootQuestion}".

Return JSON with this shape:
{
  "title": "A short catchy plan title",
  "nodes": [
    { "id": "a", "title": "3-8 word session title", "description": "One sentence", "is_start": true, "next": ["b"] }
  ]
}

Rules:
- Include 4 to 6 nodes.
- Exactly one node should have is_start true.
- Keep it practical and Socratic.
- Use short IDs like a, b, c.
- Every non-final node should point to the next node.`)], { model: DEFAULT_MODEL, maxTokens: 1200, temperature: 0.35 });

  if (!result.success || !result.data?.nodes?.length) return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });

  const { data: plan, error } = await supabase.from("workspaces").insert({
    user_id: user.id,
    title: result.data.title || rootQuestion.slice(0, 80),
    root_topic: rootQuestion,
    status: "active",
  }).select("id").single();
  if (error || !plan) return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });

  const blockIdMap = new Map<string, string>();
  for (const nodeData of result.data.nodes) {
    const { data: node } = await supabase.from("blocks").insert({
      workspace_id: plan.id,
      title: nodeData.title,
      description: nodeData.description || "",
      is_start: nodeData.is_start,
      next_block_ids: [],
      status: "available",
    }).select("id").single();
    if (node) blockIdMap.set(nodeData.id, node.id);
  }

  for (const nodeData of result.data.nodes) {
    const currentNodeId = blockIdMap.get(nodeData.id);
    if (!currentNodeId) continue;
    const nextIds = (nodeData.next ?? []).map((id) => blockIdMap.get(id)).filter(Boolean) as string[];
    await supabase.from("blocks").update({ next_block_ids: nextIds }).eq("id", currentNodeId);
  }

  await persistSkillGridPositions(
    supabase,
    skillGridNodesFromRefs(result.data.nodes, blockIdMap),
  );

  return NextResponse.json({ workspaceId: plan.id });
}
