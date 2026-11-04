/**
 * Play-copy / AYCL-copy start: private run over the author's live flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { mapBlockLaunch } from "@/lib/block-kind";
import { chargeFlowSessionOrThrow } from "@/lib/credits/account";
import { insufficientCreditsResponse } from "@/lib/credits/request-runner";
import { getCalibrationFlowById } from "@/lib/calibration-flow-repository";
import { getSolveFlowById } from "@/lib/solve-flow-repository";
import { getVerificationFlowById } from "@/lib/verification-flow-repository";
import {
  flowRunSurfaceForWorkspace,
  playCopyFlowSessionInsert,
} from "@/lib/map-play-data-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export const DASHBOARD_MAPS_START_FLOW_PATH = "/api/dashboard/maps/start-flow";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "").trim();
    const blockId = String(body.blockId || "").trim();
    if (!workspaceId || !blockId) {
      return jsonError(400, "workspaceId and blockId are required");
    }
    const ayclToken = ayclTokenFromBody(body);
    const auth = await guardWorkspaceRoute(workspaceId, {
      feature: "map",
      ayclToken,
      requireProductAccess: false,
    });
    if (!auth.ok) return auth.response;

    const { data: workspace } = await auth.supabase
      .from("workspaces")
      .select("id, user_id, is_play_copy")
      .eq("id", workspaceId)
      .maybeSingle();
    const surface = flowRunSurfaceForWorkspace({
      is_play_copy: Boolean(workspace?.is_play_copy),
      ayclToken,
    });
    if (surface !== "play_copy") {
      return jsonError(400, "Start this flow from its public link");
    }

    const { data: block } = await auth.supabase
      .from("blocks")
      .select("id, title, map_block, workspace_id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!block) return jsonError(404, "Block not found");
    const linked = mapBlockLaunch(block.map_block);
    if (
      linked.action !== "calibrate" &&
      linked.action !== "verify" &&
      linked.action !== "solve"
    ) {
      return jsonError(400, "Block has no flow");
    }

    const flow =
      linked.action === "solve"
        ? await getSolveFlowById(linked.flowId)
        : linked.action === "calibrate"
          ? await getCalibrationFlowById(linked.flowId)
          : await getVerificationFlowById(linked.flowId);
    if (!flow) return jsonError(404, "Flow not found");

    const runnerUserId = String(auth.persistUserId || "").trim();
    if (!runnerUserId) return jsonError(401, "Sign in to start this map");

    const topic =
      linked.action === "calibrate"
        ? String((flow as { goal?: string }).goal || flow.name || "Calibrate")
        : String((flow as { topic?: string }).topic || flow.name || "Solve");
    const started = playCopyFlowSessionInsert({
      flowKind: linked.action,
      flowId: flow.id,
      runnerUserId,
      copyWorkspaceId: workspaceId,
      blockId,
      topic,
      publicToken: flow.publicToken,
      questions: (flow as { questions?: unknown }).questions,
    });

    try {
      await chargeFlowSessionOrThrow(createAdminClient(), {
        runnerUserId,
        ownerUserId: runnerUserId,
        flowKind: linked.action,
      });
    } catch (error) {
      const credits = insufficientCreditsResponse(error);
      if (credits) return credits;
      throw error;
    }

    const { data: session, error } = await createAdminClient()
      .from("sessions")
      .insert(started.row)
      .select("id")
      .single();
    if (error || !session?.id) {
      const { creditStoreFromClient, refundFlowSessionCredits } = await import(
        "@/lib/credits/account"
      );
      await refundFlowSessionCredits(
        creditStoreFromClient(createAdminClient()),
        started.billedUserId,
      ).catch(() => {});
      return jsonError(500, error?.message || "Failed to start session");
    }
    return NextResponse.json({
      sessionId: session.id,
      workspaceId,
      blockId,
      href: started.hrefForSession(String(session.id)),
    });
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : "Failed to start flow");
  }
}
