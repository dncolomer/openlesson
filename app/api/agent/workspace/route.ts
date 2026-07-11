import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashApiKey,
  getX402Price,
  getX402Description,
} from "@/lib/x402";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { persistSkillGridPositions, skillGridNodesFromRefs } from "@/lib/skill-grid-positions";

async function getServiceRoleClient() {
  return createAdminClient();
}

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

const DEFAULT_DAYS = 30;

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

async function authenticateRequest(
  apiKey: string,
  supabase: SupabaseClient
) {
  const keyHash = await hashApiKey(apiKey);

  const { data: keyData, error } = await supabase
    .from("agent_api_keys")
    .select("id, user_id, is_active, rate_limit, last_used_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !keyData) {
    return null;
  }

  await supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyData.id);

  return keyData;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7);
    const supabase = await getServiceRoleClient();

    const auth = await authenticateRequest(apiKey, supabase as SupabaseClient);
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { topic, days } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const planGenerationPrice = getX402Price("plan_generation");
    const sessionPrice = getX402Price("session_start");

    const daysNum = typeof days === "number" ? days : DEFAULT_DAYS;
    const nodeConstraints = DAYS_TO_NODES[daysNum] || DAYS_TO_NODES[DEFAULT_DAYS];

    const prompt = `Generate a learning plan for "${topic}" as a directed graph where each node is a session.

Return ONLY valid JSON (no markdown) with this structure:
{
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters", "is_start": true/false, "next": ["b", "c"] }
  ]
}

IMPORTANT CONSTRAINT: The plan should span approximately "${daysNum} days".
- Include ${nodeConstraints.min} to ${nodeConstraints.max} nodes total
- Each node represents one learning session
- Create a realistic learning path that fits within this timeframe

Rules:
- Each node is a distinct learning session
- Use single-letter or short IDs for referencing
- is_start: true for nodes that can begin a learning path
- next: array of node IDs that follow this node (can be empty or have 1-3 entries)
- Create branching paths (1 to many connections allowed)
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept`;

    const response = await callXaiJSON<PlanData>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 2000,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      console.error("xAI error:", response.error);
      return NextResponse.json(
        { error: "Failed to generate plan" },
        { status: 500 }
      );
    }

    const planData = response.data;

    if (!planData.nodes || !Array.isArray(planData.nodes)) {
      return NextResponse.json(
        { error: "Invalid plan data format" },
        { status: 500 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .insert({
        user_id: auth.user_id,
        title: `Learning ${topic}`,
        root_topic: topic,
        status: "active",
        is_agent_workspace: true,
        payment_status: "paid",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to create plan:", planError);
      return NextResponse.json(
        { error: "Failed to create plan" },
        { status: 500 }
      );
    }

    const blockIdMap = new Map<string, string>();
    const nodeRefs = planData.nodes;

    for (const nodeData of nodeRefs) {
      const { data: node, error: nodeError } = await supabase
        .from("blocks")
        .insert({
          workspace_id: plan.id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_block_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (nodeError || !node) {
        console.error("Failed to create node:", nodeError);
        continue;
      }

      blockIdMap.set(nodeData.id, node.id);
    }

    for (const nodeData of nodeRefs) {
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

    await persistSkillGridPositions(
      supabase,
      skillGridNodesFromRefs(nodeRefs, blockIdMap),
    );

    const { data: nodes } = await supabase
      .from("blocks")
      .select("id, title, description, is_start, next_block_ids, status")
      .eq("workspace_id", plan.id);

    const nodeCount = nodes?.length || 0;
    const expectedSessionCost = nodeCount * sessionPrice;
    const totalExpectedCost = planGenerationPrice + expectedSessionCost;

    return NextResponse.json({
      workspaceId: plan.id,
      topic,
      days: daysNum,
      nodes: nodes || [],
      pricing: {
        planGeneration: planGenerationPrice,
        perSession: sessionPrice,
        estimatedSessions: nodeCount,
        estimatedSessionCost: expectedSessionCost,
        totalEstimatedCost: totalExpectedCost,
        currency: "usd",
      },
    });
  } catch (error) {
    console.error("Agent plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const planPrice = getX402Price("plan_generation");
  const sessionPrice = getX402Price("session_start");

  return NextResponse.json({
    endpoint: "plan_generation",
    description: getX402Description("plan_generation"),
    price: planPrice,
    currency: "usd",
    required_params: ["topic"],
    optional_params: ["days", "x402_payment_id"],
    days_options: Object.keys(DAYS_TO_NODES).map(Number),
    default_days: DEFAULT_DAYS,
    pricing: {
      planGeneration: planPrice,
      perSession: sessionPrice,
      note: "Total cost = plan generation + (estimated sessions × session price)",
    },
    audio_required: false,
    usage: "Generate a learning plan for a given topic. Returns a directed graph of learning sessions with estimated cost.",
  });
}
