import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPerformanceChatInstructions,
  buildWorkspacePerformanceContext,
} from "@/lib/agent-v2/performance-context";
import { callXaiResponses, type ResponsesInputMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

interface PerformanceConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
    const persistedFileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single();

    const { data: plan } = await supabase
      .from("workspaces")
      .select("id, user_id, is_group")
      .eq("id", workspaceId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const isOwner = plan.user_id === user.id;
    const isOrgAdmin = profile?.is_org_admin || profile?.is_admin;
    const canSeeAllUsers = isOwner || isOrgAdmin;

    if (!isOwner && !isOrgAdmin && plan.is_group) {
      // Group participants may chat about their own proof of work only.
    } else if (!isOwner && !isOrgAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    let activeFileIds = persistedFileIds;
    if (activeFileIds.length === 0) {
      const dataClient = canSeeAllUsers ? createAdminClient() : supabase;
      const context = await buildWorkspacePerformanceContext({
        supabase: dataClient,
        auth: {
          user_id: user.id,
          guest_user_id: null,
          organization_id: profile?.organization_id || null,
          is_org_admin: canSeeAllUsers,
          key_id: "web",
          scopes: ["workspaces:read"],
        },
        workspaceId,
      });

      activeFileIds = context.fileIds;

      if (
        context.payload.counts.proof_of_work_artifacts === 0 &&
        context.payload.counts.linked_sessions === 0 &&
        context.payload.counts.workspace_files === 0
      ) {
        return NextResponse.json({
          response:
            "No proof of work is attached to this workspace yet. Complete a TAP or ILE session, upload tool traces via the Proof of Work API, or add workspace files — then ask about performance here.",
          fileIds: [],
        });
      }
    }

    const inputMessages: ResponsesInputMessage[] = conversationHistory
      .filter((entry: PerformanceConversationMessage) => {
        return (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string";
      })
      .map((entry: PerformanceConversationMessage) => ({
        role: entry.role,
        content: entry.content,
      }));

    inputMessages.push({
      role: "user",
      content: [
        { type: "input_text", text: message },
        ...activeFileIds.map((fileId: string) => ({ type: "input_file" as const, file_id: fileId })),
      ],
    });

    const result = await callXaiResponses({
      model: "grok-4.3",
      instructions: buildPerformanceChatInstructions(null),
      input: inputMessages,
      temperature: 0.6,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
    });

    if (!result.success || !result.text) {
      console.error("[performance-chat] xAI API error:", result.error);
      return NextResponse.json({ error: result.error || "Failed to get AI response" }, { status: 500 });
    }

    return NextResponse.json({
      response: result.text,
      fileIds: activeFileIds,
    });
  } catch (error) {
    console.error("[performance-chat] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}