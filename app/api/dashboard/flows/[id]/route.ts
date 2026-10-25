/**
 * Owner dashboard: one first-class flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { flowOwnedByUser, parseProductFlowKind, productFlowPagePath } from "@/lib/product-flow";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  getCalibrationFlowById,
  runCalibrationCommand,
} from "@/lib/calibration-flow-repository";
import {
  getVerificationFlowById,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

async function loadOwnedFlow(
  req: NextRequest,
  id: string,
): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      kind: "verification" | "calibration";
      ownerUserId: string;
      workspaceId: string;
      flow: Record<string, unknown>;
      origin: string;
    }
> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  const requested = parseProductFlowKind(req.nextUrl.searchParams.get("kind"));
  const kinds = requested ? [requested] : (["verification", "calibration"] as const);
  for (const kind of kinds) {
    if (kind === "calibration") {
      const flow = await getCalibrationFlowById(id);
      if (flow && flowOwnedByUser(flow, auth.user.id)) {
        return {
          ok: true,
          kind,
          ownerUserId: auth.user.id,
          workspaceId: flow.workspaceId,
          flow,
          origin: req.nextUrl.origin,
        };
      }
      continue;
    }
    const flow = await getVerificationFlowById(id);
    if (flow && flowOwnedByUser(flow, auth.user.id)) {
      return {
        ok: true,
        kind,
        ownerUserId: auth.user.id,
        workspaceId: flow.workspaceId,
        flow,
        origin: req.nextUrl.origin,
      };
    }
  }
  return { ok: false, response: jsonError(404, "Flow not found") };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const loaded = await loadOwnedFlow(req, id);
    if (!loaded.ok) return loaded.response;
    const publicPath =
      loaded.kind === "calibration"
        ? calibrationFlowPublicPath(String(loaded.flow.publicToken || ""))
        : verificationFlowPublicPath(String(loaded.flow.publicToken || ""));
    return NextResponse.json({
      kind: loaded.kind,
      flow: loaded.flow,
      name: loaded.flow.name,
      flowPath: productFlowPagePath(loaded.kind, id),
      publicPath,
      publicUrl: `${loaded.origin}${publicPath}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load flow";
    return jsonError(500, message);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const loaded = await loadOwnedFlow(req, id);
    if (!loaded.ok) return loaded.response;
    const body = (await req.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "update";
    if (action === "remove") {
      if (loaded.kind === "calibration") {
        const removed = await runCalibrationCommand({
          type: "remove",
          ownerUserId: loaded.ownerUserId,
          workspaceId: loaded.workspaceId,
          flowId: id,
        });
        if (!removed.ok) return jsonError(400, removed.reason);
        return NextResponse.json({ ok: true });
      }
      const removed = await runVerificationCommand({
        type: "remove",
        ownerUserId: loaded.ownerUserId,
        workspaceId: loaded.workspaceId,
        flowId: id,
      });
      if (!removed.ok) return jsonError(400, removed.reason);
      return NextResponse.json({ ok: true });
    }

    if (loaded.kind === "calibration") {
      const updated = await runCalibrationCommand({
        type: "update",
        ownerUserId: loaded.ownerUserId,
        workspaceId: loaded.workspaceId,
        flowId: id,
        name: typeof body.name === "string" ? body.name : undefined,
        goal: typeof body.goal === "string" ? body.goal : undefined,
        questions: body.questions,
        durationMinutes: body.durationMinutes as number | undefined,
        actionCatalog: body.actionCatalog as number | undefined,
      });
      if (!updated.ok) return jsonError(400, updated.reason);
      return NextResponse.json({ flow: updated.flow, name: updated.flow?.name });
    }
    const updated = await runVerificationCommand({
      type: "update",
      ownerUserId: loaded.ownerUserId,
      workspaceId: loaded.workspaceId,
      flowId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      topic: typeof body.topic === "string" ? body.topic : undefined,
      questions: body.questions,
      actionCatalog: body.actionCatalog as number | undefined,
    });
    if (!updated.ok) return jsonError(400, updated.reason);
    return NextResponse.json({ flow: updated.flow, name: updated.flow?.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save flow";
    return jsonError(500, message);
  }
}
