/**
 * Owner calibration-flow list and create.
 * A flow stores a goal and the question pool the learner sorts.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { assertWorkspacePolicy } from "@/lib/workspace-access-policy";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { listCalibrationFlows, runCalibrationCommand } from "@/lib/calibration-flow-repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
    if (!auth.ok) return auth.response;
    const origin = req.nextUrl.origin;
    const flows = await listCalibrationFlows(workspaceId);
    return NextResponse.json({
      flows: flows.map((flow) => ({
        ...flow,
        publicPath: calibrationFlowPublicPath(flow.publicToken),
        publicUrl: `${origin}${calibrationFlowPublicPath(flow.publicToken)}`,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list calibration flows";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || "");
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    const ayclToken = typeof body.ayclToken === "string" ? body.ayclToken : null;
    const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
    if (!auth.ok) return auth.response;
    const policy = assertWorkspacePolicy({
      principal: auth.principal,
      workspaceOwnerId: auth.workspaceOwnerId,
      action: "author",
    });
    if (!policy.ok) return jsonError(403, "Forbidden");

    const { data: workspaceRow } = await auth.supabase
      .from("workspaces")
      .select("workspace_kind")
      .eq("id", workspaceId)
      .maybeSingle();
    const kind = workspaceRow?.workspace_kind;
    if (kind && !isKnowledgeRegionWorkspace(kind)) {
      return jsonError(403, "Calibration flows belong to Verification Workspaces");
    }

    const action = typeof body.action === "string" ? body.action : "create";
    if (action === "update") {
      const updated = await runCalibrationCommand({
        type: "update",
        workspaceId,
        flowId: String(body.flowId || ""),
        goal: typeof body.goal === "string" ? body.goal : undefined,
        questions: body.questions,
      });
      if (!updated.ok) return jsonError(400, updated.reason);
      return NextResponse.json({ flow: updated.flow });
    }
    if (action === "remove") {
      const removed = await runCalibrationCommand({
        type: "remove",
        workspaceId,
        flowId: String(body.flowId || ""),
      });
      if (!removed.ok) return jsonError(400, removed.reason);
      return NextResponse.json({ ok: true });
    }

    const created = await runCalibrationCommand({
      type: "create",
      workspaceId,
      goal: String(body.goal || ""),
      questions: body.questions,
    });
    if (!created.ok || !created.flow) {
      return jsonError(400, created.ok ? "create_failed" : created.reason);
    }
    const origin = req.nextUrl.origin;
    return NextResponse.json({
      flow: created.flow,
      publicPath: calibrationFlowPublicPath(created.flow.publicToken),
      publicUrl: `${origin}${calibrationFlowPublicPath(created.flow.publicToken)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save calibration flow";
    return jsonError(500, message);
  }
}
