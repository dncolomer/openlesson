import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiJSON, systemMessage, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

const SYSTEM_PROMPT = `You are an AI Learning Plan Descriptor. Your job is to explain a learning plan to users in a clear, helpful way.

 Guidelines:
 - Explain the overall structure and why topics are ordered that way
 - Mention prerequisites and how topics build on each other
 - Provide estimated time or difficulty context if relevant
 - Be encouraging and clear
 - If there are multiple paths, explain the main recommended path

 Response format (JSON):
 {
   "title": "Short descriptive title for this plan",
   "overview": "2-3 sentences explaining the plan structure and learning approach",
   "highlights": ["Key point 1", "Key point 2", "Key point 3"],
   "suggestions": "Optional: suggestions for how to approach this plan"
 }`;

interface DescriptionResponse {
  title?: string;
  overview?: string;
  highlights?: string[];
  suggestions?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, model: userModel } = await req.json();
    
    if (!workspaceId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Allow access if user owns the plan or if it's public
    if (plan.user_id !== user.id && !plan.is_public) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json({ error: "Failed to fetch nodes" }, { status: 500 });
    }

    const completedNodes = nodes.filter((n: { status: string }) => n.status === "completed");
    const activeNodes = nodes.filter((n: { status: string }) => n.status !== "completed");
    
    const orderedActive = getOrderedSessions(activeNodes);
    const orderedCompleted = getOrderedSessions(completedNodes);

    const model = userModel || DEFAULT_MODEL;

    const prompt = `Generate a description for this learning plan.

Plan Topic: "${plan.root_topic}"

ACTIVE SESSIONS:
${orderedActive.map((n: { title: string; description?: string }, i: number) => `${i + 1}. ${n.title}: ${n.description || "No description"}`).join("\n")}

COMPLETED SESSIONS:
${orderedCompleted.map((n: { title: string }) => `✓ ${n.title}`).join("\n")}

Total sessions: ${nodes.length} (${completedNodes.length} completed)

Respond with JSON only.`;

    const response = await callXaiJSON<DescriptionResponse>(
      [systemMessage(SYSTEM_PROMPT), userMessage(prompt)],
      {
        model,
        maxTokens: 1000,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
    }

    const parsed = response.data;
    let description = `${parsed.overview || ""}\n\n${(parsed.highlights || []).map((h: string) => `• ${h}`).join("\n")}`;
    if (parsed.suggestions) {
      description += `\n\n💡 ${parsed.suggestions}`;
    }

    await supabase
      .from("workspaces")
      .update({ description: description })
      .eq("id", workspaceId);

    return NextResponse.json({ 
      description,
      overview: description.split("\n\n")[0],
      highlights: parsed.highlights || []
    });

  } catch (error) {
    console.error("Describe plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

interface Block {
  id: string;
  title: string;
  description?: string;
  status?: string;
  is_start?: boolean;
  next_block_ids?: string[];
}

function getOrderedSessions(nodes: Block[]): Block[] {
  if (nodes.length === 0) return [];
  
  const visited = new Set<string>();
  const ordered: Block[] = [];
  
  const startNodes = nodes.filter(n => n.is_start);
  const queue = [...startNodes];
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    
    visited.add(node.id);
    ordered.push(node);
    
    const children = nodes.filter(n => 
      node.next_block_ids?.includes(n.id)
    );
    
    for (const child of children) {
      if (!visited.has(child.id)) {
        queue.push(child);
      }
    }
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }
  
  return ordered;
}
