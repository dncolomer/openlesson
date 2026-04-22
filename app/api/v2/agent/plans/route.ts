// ============================================
// OpenLesson Agentic API v2 - Learning Plans
// GET  /api/v2/agent/plans       - List plans
// POST /api/v2/agent/plans       - Create plan from topic
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";
import {
  callXaiJSON,
  userMessage,
  DEFAULT_MODEL,
} from "@/lib/xai-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_TO_NODES: Record<number, { min: number; max: number }> = {
  7: { min: 3, max: 5 },
  14: { min: 4, max: 7 },
  30: { min: 5, max: 10 },
  60: { min: 8, max: 14 },
  90: { min: 10, max: 18 },
  180: { min: 15, max: 25 },
};

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedNode {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next?: string[];
}

interface GeneratedPlan {
  title: string;
  nodes: GeneratedNode[];
}

// ---------------------------------------------------------------------------
// GET /api/v2/agent/plans - List plans with pagination
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const result = await authenticateRequest(req, "plans:read");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") || "0", 10) || 0,
      0
    );

    // Build query
    let query = supabase
      .from("learning_plans")
      .select("*", { count: "exact" })
      .eq("user_id", auth.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: plans, error, count } = await query;

    if (error) {
      console.error("[plans:list] Query error:", error);
      return errorResponse(500, "internal_error", "Failed to fetch plans");
    }

    const total = count ?? 0;

    return NextResponse.json({
      plans: plans ?? [],
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (err) {
    console.error("[plans:list] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}

// ---------------------------------------------------------------------------
// POST /api/v2/agent/plans - Create plan from topic
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const result = await authenticateRequest(req, "plans:write");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    // Parse & validate body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "validation_error", "Invalid JSON body");
    }

    const topic = body.topic as string | undefined;
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return errorResponse(400, "validation_error", "Field 'topic' is required and must be a non-empty string");
    }

    const description = (body.description as string) || undefined;
    const difficulty = (body.difficulty as string) || undefined;
    const sourceMaterials = (body.source_materials as string) || undefined;
    const userContext = (body.user_context as string) || undefined;

    // Resolve duration & node constraints
    const durationDays =
      typeof body.duration_days === "number" && body.duration_days > 0
        ? body.duration_days as number
        : DEFAULT_DAYS;

    const closestDays = Object.keys(DAYS_TO_NODES)
      .map(Number)
      .reduce((prev, curr) =>
        Math.abs(curr - durationDays) < Math.abs(prev - durationDays)
          ? curr
          : prev
      );
    const nodeConstraints = DAYS_TO_NODES[closestDays];

    // Build prompt
    const contextParts: string[] = [];
    if (description) contextParts.push(`Description: ${description}`);
    if (difficulty) contextParts.push(`Difficulty level: ${difficulty}`);
    if (sourceMaterials) contextParts.push(`Source materials: ${sourceMaterials}`);
    if (userContext) contextParts.push(`User context: ${userContext}`);
    const contextBlock =
      contextParts.length > 0
        ? `\nAdditional context:\n${contextParts.join("\n")}\n`
        : "";

    const prompt = `Generate a learning plan for "${topic.trim()}" as a directed graph where each node is a session.
${contextBlock}
Return ONLY valid JSON with this structure:
{
  "title": "A concise, descriptive title for the learning plan",
  "nodes": [
    { "id": "a", "title": "Node Title", "description": "Why this matters and what to learn", "is_start": true, "next": ["b", "c"] }
  ]
}

IMPORTANT CONSTRAINT: The plan should span approximately ${durationDays} days.
- Include ${nodeConstraints.min} to ${nodeConstraints.max} nodes total
- Each node represents one learning session

Rules:
- Each node is a distinct learning session
- Use single-letter or short IDs for referencing
- is_start: true for nodes that can begin a learning path (typically 1-2)
- next: array of node IDs that follow this node (can be empty for leaf nodes, or have 1-3 entries)
- Create branching paths where appropriate (1 to many connections allowed)
- Keep titles concise (3-8 words)
- Descriptions: 1-2 sentences explaining the concept and relevance`;

    // Call AI
    const aiResponse = await callXaiJSON<GeneratedPlan>(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 2500,
        temperature: 0.3,
      }
    );

    if (!aiResponse.success || !aiResponse.data) {
      console.error("[plans:create] AI generation failed:", aiResponse.error);
      return errorResponse(500, "internal_error", "Failed to generate learning plan");
    }

    const planData = aiResponse.data;

    if (!planData.nodes || !Array.isArray(planData.nodes) || planData.nodes.length === 0) {
      console.error("[plans:create] Invalid plan data from AI");
      return errorResponse(500, "internal_error", "AI returned invalid plan structure");
    }

    // Create the learning plan record
    const planTitle = planData.title || `Learning ${topic.trim()}`;

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: auth.user_id,
        title: planTitle,
        root_topic: topic.trim(),
        status: "active",
        source_type: "topic",
        notes: description || null,
        is_agent_session: true,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("[plans:create] Failed to insert plan:", planError);
      return errorResponse(500, "internal_error", "Failed to create plan record");
    }

    // --- Two-pass node creation ---
    // Pass 1: Create all nodes, build mapping from AI IDs to DB UUIDs
    const nodeIdMap = new Map<string, string>();

    for (const nodeData of planData.nodes) {
      const { data: node, error: nodeError } = await supabase
        .from("plan_nodes")
        .insert({
          plan_id: plan.id,
          title: nodeData.title,
          description: nodeData.description || "",
          is_start: nodeData.is_start || false,
          next_node_ids: [],
          status: "available",
        })
        .select()
        .single();

      if (nodeError || !node) {
        console.error("[plans:create] Failed to insert node:", nodeError);
        continue;
      }
      nodeIdMap.set(nodeData.id, node.id);
    }

    // Pass 2: Update next_node_ids with resolved DB UUIDs
    for (const nodeData of planData.nodes) {
      const dbId = nodeIdMap.get(nodeData.id);
      if (!dbId) continue;

      const resolvedNext: string[] = [];
      if (nodeData.next && Array.isArray(nodeData.next)) {
        for (const nextRef of nodeData.next) {
          const targetId = nodeIdMap.get(nextRef);
          if (targetId) resolvedNext.push(targetId);
        }
      }

      if (resolvedNext.length > 0) {
        await supabase
          .from("plan_nodes")
          .update({ next_node_ids: resolvedNext })
          .eq("id", dbId);
      }
    }

    // Fetch final nodes
    const { data: nodes } = await supabase
      .from("plan_nodes")
      .select("id, title, description, is_start, next_node_ids, status, created_at")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true });

    // Generate proof
    const proof = await createProof(supabase, {
      type: "plan_created",
      user_id: auth.user_id,
      plan_id: plan.id,
      event_data: {
        topic: topic.trim(),
        duration_days: durationDays,
        node_count: nodes?.length ?? 0,
        difficulty: difficulty || null,
      },
    });

    return NextResponse.json(
      {
        plan: {
          id: plan.id,
          title: plan.title,
          root_topic: plan.root_topic,
          status: plan.status,
          source_type: plan.source_type,
          is_agent_session: plan.is_agent_session,
          created_at: plan.created_at,
          updated_at: plan.updated_at,
        },
        nodes: nodes ?? [],
        node_count: nodes?.length ?? 0,
        proof: proof ? serializeProof(proof) : null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[plans:create] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
