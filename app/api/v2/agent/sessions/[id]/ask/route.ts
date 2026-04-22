// ============================================
// OpenLesson Agentic API v2 - Teaching Assistant
// POST /api/v2/agent/sessions/:id/ask
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { createProof, serializeProof, hashData } from "@/lib/agent-v2/proofs";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import {
  callXaiText,
  userMessage,
  systemMessage,
  assistantMessage,
  RECOMMENDED_TEMPS,
} from "@/lib/xai-client";
import type { Message } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AskRequestBody {
  question: string;
  context?: {
    relevant_probe_ids?: string[];
    user_confusion_level?: number;
    what_user_already_tried?: string;
  };
  conversation_id?: string;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface ConversationRecord {
  id: string;
  session_id: string;
  user_id: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await authenticateRequest(req, "assistant:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  const { id: sessionId } = await params;

  if (!sessionId) {
    return errorResponse(400, "validation_error", "Session ID is required");
  }

  let body: AskRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }

  if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
    return errorResponse(400, "validation_error", "question is required and must be a non-empty string");
  }

  if (body.question.length > 5000) {
    return errorResponse(400, "validation_error", "question must be 5000 characters or fewer");
  }

  try {
    // ── 1. Validate session ownership, is_agent_session ───────────────
    const { data: session, error: sessionErr } = await supabase
      .from("sessions")
      .select("id, user_id, problem, status, is_agent_session")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      return errorResponse(404, "not_found", "Session not found");
    }

    if (session.user_id !== auth.user_id) {
      return errorResponse(403, "forbidden", "Session does not belong to this user");
    }

    if (!session.is_agent_session) {
      return errorResponse(403, "forbidden", "This endpoint is for agent sessions only");
    }

    // ── 2. Get focused probe for context ──────────────────────────────
    let probeText = "No active guiding question";

    // If specific probe IDs were provided in context, use the first one
    if (body.context?.relevant_probe_ids?.length) {
      const { data: probes } = await supabase
        .from("probes")
        .select("text")
        .in("id", body.context.relevant_probe_ids)
        .eq("session_id", sessionId)
        .limit(1);

      if (probes && probes.length > 0 && probes[0].text) {
        probeText = probes[0].text;
      }
    } else {
      // Default: get the focused probe from the session
      const { data: focusedProbe } = await supabase
        .from("probes")
        .select("text")
        .eq("session_id", sessionId)
        .eq("focused", true)
        .eq("archived", false)
        .order("timestamp_ms", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (focusedProbe?.text) {
        probeText = focusedProbe.text;
      } else {
        // Fallback: most recent active probe
        const { data: latestProbe } = await supabase
          .from("probes")
          .select("text")
          .eq("session_id", sessionId)
          .eq("archived", false)
          .order("timestamp_ms", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestProbe?.text) {
          probeText = latestProbe.text;
        }
      }
    }

    // ── 3. Get or create conversation ─────────────────────────────────
    let conversation: ConversationRecord;

    if (body.conversation_id) {
      const { data: existing, error: convErr } = await supabase
        .from("agent_assistant_conversations")
        .select("*")
        .eq("id", body.conversation_id)
        .eq("session_id", sessionId)
        .eq("user_id", auth.user_id)
        .single();

      if (convErr || !existing) {
        return errorResponse(404, "not_found", "Conversation not found");
      }

      conversation = existing as ConversationRecord;
    } else {
      // Create new conversation
      const { data: newConv, error: createErr } = await supabase
        .from("agent_assistant_conversations")
        .insert({
          session_id: sessionId,
          user_id: auth.user_id,
          messages: [],
        })
        .select()
        .single();

      if (createErr || !newConv) {
        console.error("[v2/ask] Conversation create error:", createErr);
        return errorResponse(500, "internal_error", "Failed to create conversation");
      }

      conversation = newConv as ConversationRecord;
    }

    // ── 4. Build prompt using ask_question template ───────────────────
    const systemPromptText = DEFAULT_PROMPTS.ask_question
      .replace("{problem}", session.problem)
      .replace("{probe}", probeText)
      .replace("{question}", body.question);

    // Add extra context if provided
    let enrichedPrompt = systemPromptText;
    if (body.context?.user_confusion_level !== undefined) {
      enrichedPrompt += `\n\nThe student reports a confusion level of ${body.context.user_confusion_level}/10.`;
    }
    if (body.context?.what_user_already_tried) {
      enrichedPrompt += `\n\nWhat the student has already tried: ${body.context.what_user_already_tried}`;
    }

    // ── 5. Build messages with conversation history ───────────────────
    const messages: Message[] = [];

    // System message with context
    messages.push(systemMessage(enrichedPrompt));

    // Add conversation history (keep last 20 messages for context window)
    const historyMessages = (conversation.messages || []).slice(-20);
    for (const msg of historyMessages) {
      if (msg.role === "user") {
        messages.push(userMessage(msg.content));
      } else if (msg.role === "assistant") {
        messages.push(assistantMessage(msg.content));
      }
    }

    // Add the current question
    messages.push(userMessage(body.question));

    // ── 6. Call LLM ───────────────────────────────────────────────────
    const response = await callXaiText(messages, {
      maxTokens: 800,
      temperature: RECOMMENDED_TEMPS.chat,
    });

    if (!response.success || !response.data) {
      console.error("[v2/ask] LLM call failed:", response.error);
      return errorResponse(500, "internal_error", "Failed to generate response");
    }

    const assistantContent = response.data;

    // ── 7. Generate suggested follow-up ───────────────────────────────
    // Extract a follow-up suggestion from the response if possible
    let suggestedFollowUp: string | null = null;
    if (assistantContent.includes("?")) {
      // Find the last question in the response as a potential follow-up
      const sentences = assistantContent.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
      const questions = sentences.filter((s) =>
        assistantContent.includes(s + "?")
      );
      if (questions.length > 0) {
        suggestedFollowUp = questions[questions.length - 1] + "?";
      }
    }

    // ── 8. Store messages in conversation ─────────────────────────────
    const now = new Date().toISOString();

    const userMsg: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: body.question,
      timestamp: now,
    };

    const assistantMsg: ConversationMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: "assistant",
      content: assistantContent,
      timestamp: now,
    };

    const updatedMessages = [...(conversation.messages || []), userMsg, assistantMsg];

    const { error: updateErr } = await supabase
      .from("agent_assistant_conversations")
      .update({
        messages: updatedMessages,
        updated_at: now,
      })
      .eq("id", conversation.id);

    if (updateErr) {
      console.error("[v2/ask] Conversation update error:", updateErr);
      // Non-fatal: continue with response even if storage fails
    }

    // ── 9. Generate proof ─────────────────────────────────────────────
    const inputHash = hashData(body.question);
    const outputHash = hashData(assistantContent);

    const proof = await createProof(supabase, {
      type: "assistant_query",
      user_id: auth.user_id,
      session_id: sessionId,
      input_hash: inputHash,
      output_hash: outputHash,
      event_data: {
        conversation_id: conversation.id,
        question_length: body.question.length,
        response_length: assistantContent.length,
        probe_context: probeText !== "No active guiding question",
        has_conversation_history: historyMessages.length > 0,
      },
    });

    // ── 10. Build response ────────────────────────────────────────────
    return NextResponse.json({
      response: {
        id: assistantMsg.id,
        content: assistantContent,
        suggested_follow_up: suggestedFollowUp,
      },
      conversation: {
        id: conversation.id,
        message_count: updatedMessages.length,
      },
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (err) {
    console.error("[v2/ask] Error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
