// ============================================
// OpenLesson Agentic API v2 - Plan Adaptation
// POST /api/v2/agent/plans/:id/adapt - AI-powered plan adaptation
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof } from "@/lib/agent-v2/proofs";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
} from "@/lib/xai-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ExistingNode {
  id: string;
  title: string;
  description: string | null;
  is_start: boolean;
  next_node_ids: string[];
  status: string;
  created_at: string;
}

interface AdaptedNode {
  id: string; // "existing:<uuid>" for keep/update, "new:<ref>" for new nodes
  title: string;
  description: string;
  is_start: boolean;
  next: string[]; // references to other id values in this list
  action: "keep" | "update" | "create" | "delete";
}

interface AdaptResponse {
  explanation: string;
  nodes: AdaptedNode[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADAPT_SYSTEM_PROMPT = `You are an AI Learning Plan Adaptation assistant for OpenLesson. Your role is to modify learning plans based on user instructions while preserving the directed graph structure.

Guidelines:
- Understand the current plan structure (nodes and their connections)
- Apply the user's requested changes precisely
- NEVER modify or delete nodes that are marked as "completed" when preserve_completed is true
- Maintain valid graph structure: at least one start node, valid connections
- Keep titles concise (3-8 words)
- Descriptions: 1-2 sentences explaining the concept

Response format (JSON):
{
  "explanation": "Brief explanation of the changes made",
  "nodes": [
    {
      "id": "existing:<uuid>" or "new:<ref>",
      "title": "Node Title",
      "description": "Description of this session",
      "is_start": true/false,
      "next": ["existing:<uuid>", "new:<ref>"],
      "action": "keep" | "update" | "create" | "delete"
    }
  ]
}

IMPORTANT:
- For existing nodes you want to keep unchanged, use id "existing:<uuid>" with action "keep"
- For existing nodes you want to modify, use id "existing:<uuid>" with action "update"
- For new nodes, use id "new:<short-ref>" (e.g., "new:a", "new:b") with action "create"
- For nodes to remove, use id "existing:<uuid>" with action "delete" (include them so we know to delete)
- The "next" array should reference other node ids in this response
- Always output the COMPLETE list of nodes (the full desired state of the plan)
- Completed nodes must appear with action "keep" when preserve_completed is true`;

// ---------------------------------------------------------------------------
// POST /api/v2/agent/plans/:id/adapt
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const result = await authenticateRequest(req, "plans:write");
    if (result instanceof NextResponse) return result;
    const { auth, supabase } = result;

    const { id: planId } = await context.params;
    if (!planId) {
      return errorResponse(400, "validation_error", "Plan ID is required");
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", auth.user_id)
      .single();

    if (planError || !plan) {
      return errorResponse(404, "plan_not_found", "Plan not found");
    }

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "validation_error", "Invalid JSON body");
    }

    const instruction = body.instruction as string | undefined;
    if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
      return errorResponse(
        400,
        "validation_error",
        "Field 'instruction' is required and must be a non-empty string"
      );
    }

    const preserveCompleted = body.preserve_completed !== false; // default true
    const userContextStr = (body.context as string) || undefined;

    // Fetch current nodes
    const { data: existingNodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (nodesError) {
      console.error("[plans:adapt] Failed to fetch nodes:", nodesError);
      return errorResponse(500, "internal_error", "Failed to fetch plan nodes");
    }

    const currentNodes: ExistingNode[] = existingNodes ?? [];

    if (currentNodes.length === 0) {
      return errorResponse(
        400,
        "validation_error",
        "Cannot adapt an empty plan. Create nodes first."
      );
    }

    // Build current state description for the AI
    const nodesDescription = currentNodes
      .map((n) => {
        const nextRefs =
          n.next_node_ids && n.next_node_ids.length > 0
            ? ` -> [${n.next_node_ids.map((id) => `existing:${id}`).join(", ")}]`
            : "";
        const statusTag = n.status === "completed" ? " [COMPLETED]" : n.status === "in_progress" ? " [IN PROGRESS]" : "";
        return `  existing:${n.id} | ${n.is_start ? "START" : "     "} | "${n.title}" - ${n.description || "No description"}${statusTag}${nextRefs}`;
      })
      .join("\n");

    const contextParts: string[] = [];
    contextParts.push(`Plan: "${plan.title}" (topic: ${plan.root_topic})`);
    contextParts.push(`Total nodes: ${currentNodes.length}`);
    if (preserveCompleted) {
      const completedCount = currentNodes.filter((n) => n.status === "completed").length;
      if (completedCount > 0) {
        contextParts.push(
          `Completed nodes: ${completedCount} (MUST be preserved with action "keep")`
        );
      }
    }
    if (userContextStr) {
      contextParts.push(`User context: ${userContextStr}`);
    }

    const userPrompt = `${contextParts.join("\n")}

CURRENT NODES:
${nodesDescription}

USER INSTRUCTION: "${instruction.trim()}"

Apply the requested changes and return the complete updated node list as JSON.`;

    // Call AI
    const aiResponse = await callXaiJSON<AdaptResponse>(
      [systemMessage(ADAPT_SYSTEM_PROMPT), userMessage(userPrompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 4000,
        temperature: 0.3,
      }
    );

    if (!aiResponse.success || !aiResponse.data) {
      console.error("[plans:adapt] AI generation failed:", aiResponse.error);
      return errorResponse(500, "internal_error", "Failed to generate plan adaptation");
    }

    const adaptData = aiResponse.data;

    if (!adaptData.nodes || !Array.isArray(adaptData.nodes)) {
      console.error("[plans:adapt] Invalid adaptation data from AI");
      return errorResponse(500, "internal_error", "AI returned invalid adaptation structure");
    }

    // Process the adaptation
    const existingIdSet = new Set(currentNodes.map((n) => n.id));
    const completedIdSet = new Set(
      currentNodes.filter((n) => n.status === "completed").map((n) => n.id)
    );

    // Build a mapping: response node id -> DB UUID
    const idMapping = new Map<string, string>();

    // Track changes for the proof
    const changesSummary = {
      created: 0,
      updated: 0,
      deleted: 0,
      kept: 0,
    };

    // Pre-populate mapping for existing nodes
    for (const node of currentNodes) {
      idMapping.set(`existing:${node.id}`, node.id);
    }

    // Track which existing nodes are referenced (not deleted)
    const referencedExistingIds = new Set<string>();

    // --- Pass 1: Process create/update/keep/delete ---
    for (const adaptNode of adaptData.nodes) {
      const nodeId = adaptNode.id;
      const action = adaptNode.action || "keep";

      if (nodeId.startsWith("existing:")) {
        const existingId = nodeId.replace("existing:", "");

        if (!existingIdSet.has(existingId)) {
          // AI referenced a non-existent node; skip
          console.warn(`[plans:adapt] AI referenced non-existent node: ${existingId}`);
          continue;
        }

        if (action === "delete") {
          // Protect completed nodes
          if (preserveCompleted && completedIdSet.has(existingId)) {
            console.warn(`[plans:adapt] Skipping delete of completed node: ${existingId}`);
            referencedExistingIds.add(existingId);
            changesSummary.kept++;
            continue;
          }

          // Will be deleted after pass 2
          changesSummary.deleted++;
          continue;
        }

        referencedExistingIds.add(existingId);

        if (action === "update") {
          // Protect completed nodes from modification
          if (preserveCompleted && completedIdSet.has(existingId)) {
            changesSummary.kept++;
            continue;
          }

          await supabase
            .from("plan_nodes")
            .update({
              title: adaptNode.title,
              description: adaptNode.description || "",
              is_start: adaptNode.is_start || false,
            })
            .eq("id", existingId);

          changesSummary.updated++;
        } else {
          // keep
          changesSummary.kept++;
        }
      } else if (nodeId.startsWith("new:")) {
        // Create new node
        const { data: newNode, error: insertError } = await supabase
          .from("plan_nodes")
          .insert({
            plan_id: planId,
            title: adaptNode.title,
            description: adaptNode.description || "",
            is_start: adaptNode.is_start || false,
            next_node_ids: [],
            status: "available",
          })
          .select()
          .single();

        if (insertError || !newNode) {
          console.error("[plans:adapt] Failed to create node:", insertError);
          continue;
        }

        idMapping.set(nodeId, newNode.id);
        referencedExistingIds.add(newNode.id);
        changesSummary.created++;
      }
    }

    // Delete unreferenced existing nodes (that aren't completed when preserve is on)
    for (const existingId of existingIdSet) {
      if (!referencedExistingIds.has(existingId)) {
        if (preserveCompleted && completedIdSet.has(existingId)) {
          // Don't delete completed nodes - keep them
          continue;
        }
        await supabase.from("plan_nodes").delete().eq("id", existingId);
        changesSummary.deleted++;
      }
    }

    // --- Pass 2: Update next_node_ids with resolved UUIDs ---
    for (const adaptNode of adaptData.nodes) {
      const action = adaptNode.action || "keep";
      if (action === "delete") continue;

      const dbId = idMapping.get(adaptNode.id);
      if (!dbId) continue;

      // Resolve next references
      const resolvedNext: string[] = [];
      if (adaptNode.next && Array.isArray(adaptNode.next)) {
        for (const nextRef of adaptNode.next) {
          const targetDbId = idMapping.get(nextRef);
          if (targetDbId) {
            resolvedNext.push(targetDbId);
          }
        }
      }

      await supabase
        .from("plan_nodes")
        .update({
          next_node_ids: resolvedNext,
          is_start: adaptNode.is_start || false,
        })
        .eq("id", dbId);
    }

    // Update plan timestamp
    await supabase
      .from("learning_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId);

    // Fetch final state
    const { data: updatedNodes } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    // Generate proof
    const proof = await createProof(supabase, {
      type: "plan_adapted",
      user_id: auth.user_id,
      plan_id: planId,
      event_data: {
        action: "ai_adaptation",
        instruction: instruction.trim(),
        changes: changesSummary,
        node_count_before: currentNodes.length,
        node_count_after: updatedNodes?.length ?? 0,
      },
    });

    return NextResponse.json({
      explanation: adaptData.explanation || "Plan has been adapted.",
      plan_id: planId,
      nodes: updatedNodes ?? [],
      changes: changesSummary,
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[plans:adapt] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
