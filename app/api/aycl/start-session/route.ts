import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const blockId = typeof body.blockId === "string" ? body.blockId.trim() : "";
    const blockTitle = typeof body.blockTitle === "string" ? body.blockTitle.trim() : "Lesson";
    const planningPrompt =
      typeof body.planningPrompt === "string" ? body.planningPrompt.trim() : null;

    if (!token || !blockId) {
      return jsonError(400, "token and blockId are required");
    }

    const ctx = await resolveAyclAccess(token);
    if ("error" in ctx) {
      return jsonError(ctx.status, ctx.error);
    }

    const { data: block, error: blockError } = await ctx.supabase
      .from("blocks")
      .select("id, workspace_id, status, planning_prompt")
      .eq("id", blockId)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (blockError || !block) {
      return jsonError(404, "Block not found");
    }

    if (block.status === "locked") {
      return jsonError(403, "Block is locked");
    }

    const effectivePrompt = planningPrompt || block.planning_prompt || null;

    const { data: session, error: sessionError } = await ctx.supabase
      .from("sessions")
      .insert({
        user_id: ctx.ownerUserId,
        problem: blockTitle,
        status: "active",
        planning_prompt: effectivePrompt,
        metadata: {
          workspace_id: ctx.workspaceId,
          aycl_fork_workspace_id: ctx.workspaceId,
          aycl_purchase_id: ctx.purchase.id,
        },
      })
      .select("id, status")
      .single();

    if (sessionError || !session) {
      return jsonError(500, sessionError?.message || "Failed to create session");
    }

    await ctx.supabase.from("blocks").update({
      status: "in_progress",
      session_id: session.id,
      ...(effectivePrompt ? { planning_prompt: effectivePrompt } : {}),
    }).eq("id", blockId);

    await ctx.supabase.from("block_sessions").insert({
      block_id: blockId,
      session_id: session.id,
      user_id: ctx.ownerUserId,
      workspace_id: ctx.workspaceId,
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("[aycl/start-session]", error);
    return jsonError(500, "Failed to start session");
  }
}