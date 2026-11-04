import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  chargeFlowSessionOrThrow,
  rejectIfInsufficientSessionCredits,
} from "@/lib/credits/account";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickHomeMapTryBlock } from "@/lib/dashboard-home-catalog";
import { dashboardPlayHref } from "@/lib/dashboard-play";
import { mapBlockLaunch } from "@/lib/block-kind";
import { forkWorkspaceExactCopy } from "@/lib/fork-workspace";
import { decideAddToMyMaps } from "@/lib/workspace-play-copy";
import { insufficientCreditsResponse } from "@/lib/credits/request-runner";
import { getCalibrationFlowById } from "@/lib/calibration-flow-repository";
import { getSolveFlowById } from "@/lib/solve-flow-repository";
import { getVerificationFlowById } from "@/lib/verification-flow-repository";
import { playCopyFlowSessionInsert } from "@/lib/map-play-data-access";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

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
      .select("id, title, planning_prompt, status, is_start, position_x, position_y, map_block")
      .eq("workspace_id", copyId);
    if (blocksError) return jsonError(500, blocksError.message);
    const block = pickHomeMapTryBlock(copyBlocks || []);
    if (!block) {
      return jsonError(400, "This map has no blocks to try");
    }

    const linked = mapBlockLaunch(block.map_block);
    if (
      linked.action === "calibrate" ||
      linked.action === "verify" ||
      linked.action === "solve"
    ) {
      const flow =
        linked.action === "solve"
          ? await getSolveFlowById(linked.flowId)
          : linked.action === "calibrate"
            ? await getCalibrationFlowById(linked.flowId)
            : await getVerificationFlowById(linked.flowId);
      if (!flow) return jsonError(404, "Flow not found");
      const topic =
        linked.action === "calibrate"
          ? String((flow as { goal?: string }).goal || flow.name || "Calibrate")
          : String((flow as { topic?: string }).topic || flow.name || "Solve");
      const started = playCopyFlowSessionInsert({
        flowKind: linked.action,
        flowId: flow.id,
        runnerUserId: auth.user.id,
        copyWorkspaceId: copyId,
        blockId: block.id,
        topic,
        publicToken: flow.publicToken,
        questions: (flow as { questions?: unknown }).questions,
      });
      try {
        await chargeFlowSessionOrThrow(createAdminClient(), {
          runnerUserId: auth.user.id,
          ownerUserId: auth.user.id,
          flowKind: linked.action,
        });
      } catch (error) {
        const credits = insufficientCreditsResponse(error);
        if (credits) return credits;
        throw error;
      }
      const { data: session, error: startError } = await createAdminClient()
        .from("sessions")
        .insert(started.row)
        .select("id")
        .single();
      if (startError || !session?.id) {
        const { creditStoreFromClient, refundFlowSessionCredits } = await import(
          "@/lib/credits/account"
        );
        await refundFlowSessionCredits(
          creditStoreFromClient(createAdminClient()),
          started.billedUserId,
        ).catch(() => {});
        return jsonError(500, startError?.message || "Failed to start session");
      }
      return NextResponse.json({
        workspaceId: copyId,
        blockId: block.id,
        sessionId: session.id,
        href: started.hrefForSession(String(session.id)),
      });
    }

    const denied = await rejectIfInsufficientSessionCredits(createAdminClient(), {
      runnerUserId: auth.user.id,
      ownerUserId: auth.user.id,
      flowKind: "learn",
    });
    if (denied) return denied;

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
      const { creditStoreFromClient, refundFlowSessionCredits } = await import("@/lib/credits/account");
      await refundFlowSessionCredits(creditStoreFromClient(createAdminClient()), auth.user.id).catch(() => {});
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
