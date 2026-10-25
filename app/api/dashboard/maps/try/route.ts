import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { rejectIfFreeWeeklySessionLimit } from "@/lib/api/free-session-quota";
import { loadProductAccessSnapshot } from "@/lib/api/product-access";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { pickHomeMapTryBlock } from "@/lib/dashboard-home-catalog";
import { dashboardPlayHref } from "@/lib/dashboard-play";
import { forkWorkspaceExactCopy } from "@/lib/fork-workspace";
import { decideAddToMyMaps } from "@/lib/workspace-play-copy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const access = await loadProductAccessSnapshot(auth.supabase, auth.user.id);
    if (!access.ok) return access.response;
    if (!access.hasPaidAccess) {
      const denied = await rejectIfFreeWeeklySessionLimit(auth.supabase, auth.user.id);
      if (denied) return denied;
    }

    const body = (await req.json().catch(() => ({}))) as { workspaceId?: unknown };
    const workspaceId = String(body.workspaceId || "").trim();
    if (!workspaceId) return jsonError(400, "workspaceId is required");

    const { data: source, error } = await auth.supabase
      .from("workspaces")
      .select("id, title, root_topic, is_public, is_all_you_can_learn")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error) return jsonError(500, error.message);

    const { data: existingRows } = await auth.supabase
      .from("workspaces")
      .select("id, original_workspace_id, is_play_copy")
      .eq("user_id", auth.user.id)
      .eq("is_play_copy", true)
      .eq("original_workspace_id", workspaceId);

    const decision = decideAddToMyMaps({
      source,
      existingCopies: existingRows || [],
    });
    if (decision.action === "reject") {
      return jsonError(decision.reason === "not_found" ? 404 : 403, "Map is not available");
    }
    if (decision.action === "buy") {
      return jsonError(402, "This map is All You Can Learn. Buy it to try a block.");
    }

    const copyId =
      decision.action === "reuse"
        ? decision.copyId
        : (
            await forkWorkspaceExactCopy(auth.supabase, {
              sourceWorkspaceId: workspaceId,
              ownerUserId: auth.user.id,
              title: source?.title || source?.root_topic,
              originalWorkspaceId: workspaceId,
              isPlayCopy: true,
            })
          ).workspaceId;

    const { data: copyBlocks, error: blocksError } = await auth.supabase
      .from("blocks")
      .select("id, title, planning_prompt, status, is_start, position_x, position_y")
      .eq("workspace_id", copyId);
    if (blocksError) return jsonError(500, blocksError.message);
    const block = pickHomeMapTryBlock(copyBlocks || []);
    if (!block) {
      return jsonError(400, "This map has no blocks to try");
    }

    const { data: session, error: sessionError } = await auth.supabase
      .from("sessions")
      .insert({
        user_id: auth.persistUserId,
        problem: block.title || source?.title || "Map",
        status: "active",
        kind: "learn",
        workspace_id: copyId,
        block_id: block.id,
        planning_prompt: block.planning_prompt || null,
        metadata: {
          session_mode: "learning",
          ile_session_mode: "learning",
          block_id: block.id,
          block_title: block.title,
          workspace_id: copyId,
        },
      })
      .select("id")
      .single();
    if (sessionError || !session) {
      return jsonError(500, sessionError?.message || "Failed to start session");
    }

    const { error: blockUpdateError } = await auth.supabase
      .from("blocks")
      .update({ status: "in_progress", session_id: session.id })
      .eq("id", block.id)
      .eq("workspace_id", copyId);
    if (blockUpdateError) {
      await auth.supabase
        .from("sessions")
        .update({ status: "archived" })
        .eq("id", session.id);
      return jsonError(500, blockUpdateError.message || "Failed to update block");
    }

    return NextResponse.json({
      sessionId: session.id,
      workspaceId: copyId,
      blockId: block.id,
      href: dashboardPlayHref("learn", session.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start session";
    return jsonError(500, message);
  }
}
