import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { callXaiJSON, systemMessage, userMessage, buildImageContent, DEFAULT_MODEL, MessageContent } from "@/lib/xai-client";
import { composeBlockGenerationContext } from "@/lib/workspace-create-modes";

const SYSTEM_PROMPT = `You are an AI Workspace assistant. Your role is to help users understand and customize their workspaces.

 Guidelines:
  - Be conversational and helpful
  - Explain WHY the learning path is structured the way it is
  - When user requests changes, ALWAYS output the COMPLETE updated plan - include all sessions in order
  - Keep sessions focused and actionable
  - NEVER delete or modify completed sessions - keep them exactly as they are
  - For ordering: use "order" field (1, 2, 3...) to specify sequence
  
  FORMATTING: Use proper markdown formatting in your responses:
  - Use ## for section headings
  - Use bullet points (-) or numbered lists (1.) for lists
  - Use **bold** for important terms
  - Use BLANK LINES between paragraphs - always leave an empty line between separate thoughts
  - Use > for quotes or callouts
  - Keep paragraphs short (2-4 sentences max), then add a blank line
  - Break up long walls of text with subheadings or bullet points
  - Make your response visually scannable with proper spacing

 Response format (JSON):
  {
    "explanation": "Your conversational response to the user (use markdown formatting)",
    "planModified": true/false - true if you're proposing any changes to the plan,
    "questions": ["optional clarification question if needed"],
    "sessions": [
      { "id": "existing-id-if-not-new", "title": "Session Title", "description": "Description", "order": 1 }
    ]
  }

  IMPORTANT: 
  - ALWAYS include the "sessions" array with the FULL plan state after your proposed changes
  - For existing sessions you want to keep, include their id from the current plan
  - For new sessions, omit the id field or use a new identifier
  - Completed sessions must appear in the sessions array unchanged
  - The "order" field determines the sequence (1 = first session, 2 = second, etc.)
  - If no changes requested, just return current sessions unchanged`;

interface ChatResponse {
  explanation: string;
  planModified?: boolean;
  sessions?: Array<{ id?: string; title: string; description?: string; order?: number }>;
  questions?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, userPrompt, conversationHistory, model: userModel, locale, images, gridRow, gridCol } = body;

    if (!workspaceId || !userPrompt) {
      return jsonError(400, "Plan ID and prompt are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { supabase, persistUserId } = auth;

    const languageNote = locale && locale !== 'en' 
      ? `\n\nIMPORTANT: Respond in ${locale} language (e.g., for 'vi' respond in Vietnamese, 'zh' in Chinese, 'es' in Spanish, 'de' in German, 'pl' in Polish).`
      : '';

    if (images && images.length > 0) {
      console.log(`[Chat] Processing ${images.length} image(s) from user`);
    }

    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return jsonError(404, "Plan not found");
    }

    if (plan.user_id !== persistUserId && !plan.is_public) {
      return jsonError(403, "Access denied");
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (nodesError || !nodes) {
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

    const model = userModel || DEFAULT_MODEL;

    // Build conversation history context
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = `\n\nCONVERSATION HISTORY (full):\n${conversationHistory.map((m: { role: string; content: string }) => 
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
      ).join("\n")}\n`;
    }

    const sessionsSection = nodes.length > 0 
      ? `CURRENT SESSIONS (include the id for any session you want to keep/modify):
${nodes.map((n: { id: string; status: string; title: string; description?: string }, i: number) => `${n.id} | order:${i+1} | ${n.status === "completed" ? "✓ DONE" : "active"} | ${n.title}: ${n.description || "No description"}`).join("\n")}`
      : `CURRENT SESSIONS: None yet - this is a new/empty plan. Create sessions based on the user's request.`;

    const prompt = `${alwaysContext}

Current Workspace: "${plan.root_topic}"

${sessionsSection}

CONVERSATION HISTORY:${historyContext}

Current User request: "${userPrompt}"

${plan.description ? `Plan context: ${plan.description}` : ""}

Always honor workspace files and notes when creating or modifying sessions.

IMPORTANT: You MUST include a "sessions" array in your response with the complete plan. For new sessions, omit the "id" field.

Respond with JSON containing your explanation and the complete updated sessions array.`;

    const fullSystemPrompt = SYSTEM_PROMPT + languageNote;

    let userContent: string | MessageContent[];
    if (images && images.length > 0) {
      const imageContents = images.map((img: { data: string; mimeType: string }) => 
        buildImageContent("", { data: img.data, mimeType: img.mimeType })[1]
      );
      userContent = [{ type: "text", text: prompt }, ...imageContents];
    } else {
      userContent = prompt;
    }

    const aiResponse = await callXaiJSON<ChatResponse>(
      [systemMessage(fullSystemPrompt), { role: "user", content: userContent }],
      {
        model,
        maxTokens: 16000,
        temperature: 0.3,
      }
    );

    if (!aiResponse.success || !aiResponse.data) {
      console.error("[Chat] AI response failed:", aiResponse.error);
      console.error("[Chat] Raw content:", aiResponse.rawContent?.substring(0, 1000));
      return jsonError(502, aiResponse.error || "Failed to get AI response");
    }



    

    const response = {
      explanation: aiResponse.data.explanation || "I've updated your workspace.",
      planModified: aiResponse.data.planModified ?? true,
      sessions: aiResponse.data.sessions || [],
      questions: aiResponse.data.questions || []
    };

    const llmSessions = response.sessions || [];
    const existingIds = new Set<string>(nodes.map((n: { id: string }) => n.id));
    const completedNodes = nodes.filter((n: { status: string }) => n.status === "completed");
    const completedIds = new Set<string>(completedNodes.map((n: { id: string }) => n.id));
    
    console.log("[Chat] Processing", llmSessions.length, "sessions from LLM");

    // Map from LLM session identifier (id or index) to actual DB node id
    const idMap = new Map<string, string>();
    // Track all node IDs that exist after processing (including newly created)
    const allNodeIds = new Set<string>(existingIds);
    const createdNodeIds: string[] = [];
    const hasGridPlacement = typeof gridRow === "number" && typeof gridCol === "number";

    for (let idx = 0; idx < llmSessions.length; idx++) {
      const session = llmSessions[idx];
      const cleanId = session.id?.replace(/[^a-zA-Z0-9-]/g, "");
      
      if (cleanId && existingIds.has(cleanId) && !completedIds.has(cleanId)) {
        // Update existing node
        await supabase
          .from("blocks")
          .update({
            title: session.title,
            description: session.description || ""
          })
          .eq("id", cleanId);
        if (session.id) idMap.set(session.id, cleanId);
      } else if (!cleanId || !existingIds.has(cleanId)) {
        // Create new node - handles both: no ID provided OR new ID that doesn't exist
        // Skip if it's a completed session ID (shouldn't happen but safety check)
        if (cleanId && completedIds.has(cleanId)) {
          continue;
        }
        const { data: newNode, error: insertError } = await supabase
          .from("blocks")
          .insert({
            workspace_id: workspaceId,
            title: session.title,
            description: session.description || "",
            is_start: false,
            next_block_ids: [],
            status: "available",
          })
          .select()
          .single();
        
        if (!insertError && newNode) {
          // Map both the original session.id (if any) and use index as fallback
          if (session.id) {
            idMap.set(session.id, newNode.id);
          }
          // Also map by index for linking purposes
          idMap.set(`__idx_${idx}`, newNode.id);
          allNodeIds.add(newNode.id);
          createdNodeIds.push(newNode.id);
        }
      }
    }

    const llmIds = new Set(llmSessions.map(s => {
      const cleanId = s.id?.replace(/[^a-zA-Z0-9-]/g, "");
      return cleanId && existingIds.has(cleanId) ? cleanId : null;
    }).filter(Boolean));

    for (const node of nodes) {
      if (!completedIds.has(node.id) && !llmIds.has(node.id as string)) {
        await supabase.from("blocks").delete().eq("id", node.id);
      }
    }

    const sortedSessions = [...llmSessions].sort((a, b) => (a.order || 999) - (b.order || 999));
    
    // Build a map from original LLM index to sorted index for fallback lookups
    const originalIndexMap = new Map<number, number>();
    llmSessions.forEach((session, origIdx) => {
      const sortedIdx = sortedSessions.findIndex(s => s === session);
      if (sortedIdx !== -1) {
        originalIndexMap.set(origIdx, sortedIdx);
      }
    });
    

    
    for (let i = 0; i < sortedSessions.length; i++) {
      const session = sortedSessions[i];
      // Find the original index of this session in llmSessions
      const originalIdx = llmSessions.findIndex(s => s === session);
      
      // Try multiple ways to get the mapped ID
      let mappedId: string | undefined;
      if (session.id) {
        mappedId = idMap.get(session.id) || idMap.get(session.id.replace(/[^a-zA-Z0-9-]/g, ""));
      }
      if (!mappedId && originalIdx !== -1) {
        mappedId = idMap.get(`__idx_${originalIdx}`);
      }
      
      // Use allNodeIds (which includes newly created nodes) instead of existingIds
      if (mappedId && allNodeIds.has(mappedId)) {
        const nextSession = sortedSessions[i + 1];
        let nextNodeId: string | null = null;
        
        if (nextSession) {
          // Try to get next node ID using same lookup strategy
          if (nextSession.id) {
            nextNodeId = idMap.get(nextSession.id) || idMap.get(nextSession.id.replace(/[^a-zA-Z0-9-]/g, "")) || null;
          }
          if (!nextNodeId) {
            const nextOriginalIdx = llmSessions.findIndex(s => s === nextSession);
            if (nextOriginalIdx !== -1) {
              nextNodeId = idMap.get(`__idx_${nextOriginalIdx}`) || null;
            }
          }
        }
        
        await supabase
          .from("blocks")
          .update({
            next_block_ids: nextNodeId ? [nextNodeId] : [],
            is_start: i === 0
          })
          .eq("id", mappedId);
      }
    }

    if (hasGridPlacement && createdNodeIds.length > 0) {
      const gridNodeId = createdNodeIds[createdNodeIds.length - 1];
      await supabase
        .from("blocks")
        .update({
          position_x: gridCol,
          position_y: gridRow,
        })
        .eq("id", gridNodeId);
    }

    const { data: updatedNodes, error: fetchError } = await supabase
      .from("blocks")
      .select("*")
      .eq("workspace_id", workspaceId);

    console.log("[Chat] Plan updated:", updatedNodes?.length, "nodes");

    // Build a summary of the current plan structure
    const orderedAll = getOrderedSessions(updatedNodes || []);
    const currentPlanSummary = orderedAll.map((n: { title: string; status?: string }, i: number) => 
      `${i + 1}. ${n.title}${n.status === "completed" ? " ✓" : ""}`
    ).join("\n");



    return NextResponse.json({ 
      explanation: response.explanation || "Done!",
      currentPlan: currentPlanSummary,
      questions: response.questions || [],
      planModified: response.planModified ?? false,
      updatedNodes: updatedNodes || []
    });

  } catch (error) {
    console.error("Chat plan error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return jsonError(status, message);
  }
}

interface Block {
  id: string;
  title: string;
  status?: string;
  is_start?: boolean;
  next_block_ids?: string[];
}

function getOrderedSessions(nodes: Block[]): Block[] {
  if (nodes.length === 0) return [];
  
  const visited = new Set<string>();
  const ordered: typeof nodes = [];
  
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
