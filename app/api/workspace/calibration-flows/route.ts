/**
 * Owner calibration-flow list and create.
 * A flow stores a goal and the question pool the learner sorts.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { assertWorkspacePolicy } from "@/lib/workspace-access-policy";
import { denyWorkspaceFeatureById } from "@/lib/workspace-feature-gate";
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
    const denied = await denyWorkspaceFeatureById(workspaceId, "calibration_flows");
    if (denied) return denied;
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

    const denied = await denyWorkspaceFeatureById(workspaceId, "calibration_flows");
    if (denied) return denied;

    const action = typeof body.action === "string" ? body.action : "create";
    if (action === "update") {
      const updated = await runCalibrationCommand({
        type: "update",
        workspaceId,
        flowId: String(body.flowId || ""),
        name: typeof body.name === "string" ? body.name : undefined,
        goal: typeof body.goal === "string" ? body.goal : undefined,
        questions: body.questions,
        durationMinutes: body.durationMinutes as number | undefined,
        actionCatalog: body.actionCatalog as number | undefined,
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
      name: typeof body.name === "string" ? body.name : undefined,
      goal: String(body.goal || ""),
      questions: body.questions,
      durationMinutes: body.durationMinutes as number | undefined,
      actionCatalog: body.actionCatalog as number | undefined,
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
