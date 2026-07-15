import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "token and blockId are required" }, { status: 400 });
    }

    const ctx = await resolveAyclAccess(token);
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { data: block, error: blockError } = await ctx.supabase
      .from("blocks")
      .select("id, workspace_id, status, planning_prompt")
      .eq("id", blockId)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (blockError || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (block.status === "locked") {
      return NextResponse.json({ error: "Block is locked" }, { status: 403 });
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
      return NextResponse.json({ error: sessionError?.message || "Failed to create session" }, { status: 500 });
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
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }
}