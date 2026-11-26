/**
 * Owner dashboard: one first-class flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  flowOwnedByUser,
  parseExactProblemOnCanvas,
  parseProductFlowKind,
  productFlowPagePath,
} from "@/lib/product-flow";
import { flowProblemFromUnknown, parseFlowArtifacts } from "@/lib/flow-artifacts";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import { requestHasUnsysSeed, unsysSeedFromRequestBody } from "@/lib/unsys-tree-spec";
import { parseFlowEnforcedChannels } from "@/lib/flow-channels";
import { parseFlowCanvasCapture } from "@/lib/flow-canvas-capture";
import { parseFlowOpeningCanvasSceneForKind } from "@/lib/flow-opening-canvas";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { solveFlowPublicPath } from "@/lib/solve-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  getCalibrationFlowById,
  runCalibrationCommand,
} from "@/lib/calibration-flow-repository";
import {
  getSolveFlowById,
  runSolveCommand,
} from "@/lib/solve-flow-repository";
import {
  getVerificationFlowById,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";
import {
  createFlowLink,
  deleteFlowLink,
  flowLinkPublicPath,
  listFlowLinksForFlow,
  type FlowLink,
} from "@/lib/flow-links";

export const runtime = "nodejs";

function publicPathForKind(
  kind: "verification" | "calibration" | "solve",
  token: string,
): string {
  if (kind === "calibration") return calibrationFlowPublicPath(token);
  if (kind === "solve") return solveFlowPublicPath(token);
  return verificationFlowPublicPath(token);
}

function presentOwnedLinks(links: readonly FlowLink[], origin: string) {
  return links.map((link) => {
    const publicPath = flowLinkPublicPath(link.flowKind, link.publicToken);
    return {
      id: link.id,
      label: link.label,
      publicToken: link.publicToken,
      publicPath,
      publicUrl: `${origin}${publicPath}`,
    };
  });
}

async function loadOwnedFlow(
  req: NextRequest,
  id: string,
): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      kind: "verification" | "calibration" | "solve";
      ownerUserId: string;
      workspaceId: string;
      flow: Record<string, unknown>;
      origin: string;
    }
> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  const requested = parseProductFlowKind(req.nextUrl.searchParams.get("kind"));
  const kinds = requested
    ? [requested]
    : (["verification", "calibration", "solve"] as const);
  for (const kind of kinds) {
    if (kind === "solve") {
      const flow = await getSolveFlowById(id);
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
    const publicPath = publicPathForKind(
      loaded.kind,
      String(loaded.flow.publicToken || ""),
    );
    const links = await listFlowLinksForFlow({
      ownerUserId: loaded.ownerUserId,
      flowKind: loaded.kind,
      flowId: id,
    });
    return NextResponse.json({
      kind: loaded.kind,
      flow: loaded.flow,
      name: loaded.flow.name,
      flowPath: productFlowPagePath(loaded.kind, id),
      publicPath,
      publicUrl: `${loaded.origin}${publicPath}`,
      links: presentOwnedLinks(links, loaded.origin),
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
    if (action === "addLink") {
      const created = await createFlowLink({
        ownerUserId: loaded.ownerUserId,
        flowKind: loaded.kind,
        flowId: id,
        label: body.label,
      });
      const publicPath = flowLinkPublicPath(created.flowKind, created.publicToken);
      return NextResponse.json({
        ok: true,
        link: {
          id: created.id,
          label: created.label,
          publicToken: created.publicToken,
          publicPath,
          publicUrl: `${loaded.origin}${publicPath}`,
        },
      });
    }
    if (action === "removeLink") {
      const linkId = typeof body.linkId === "string" ? body.linkId : "";
      const removed = await deleteFlowLink({
        ownerUserId: loaded.ownerUserId,
        linkId,
      });
      if (!removed) return jsonError(404, "Link not found");
      return NextResponse.json({ ok: true });
    }
    if (action === "remove") {
      if (loaded.kind === "solve") {
        const removed = await runSolveCommand({
          type: "remove",
          ownerUserId: loaded.ownerUserId,
          workspaceId: loaded.workspaceId,
          flowId: id,
        });
        if (!removed.ok) return jsonError(400, removed.reason);
        return NextResponse.json({ ok: true });
      }
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

    const problem =
      body.problem === undefined && body.topic === undefined && body.goal === undefined
        ? undefined
        : flowProblemFromUnknown(body);
    const artifacts = body.artifacts === undefined ? undefined : parseFlowArtifacts(body.artifacts);
    const exactProblemOnCanvas =
      body.exactProblemOnCanvas === undefined
        ? undefined
        : parseExactProblemOnCanvas(body.exactProblemOnCanvas);
    const openingCanvasScene =
      body.openingCanvasScene === undefined && body.opening_canvas_scene === undefined
        ? undefined
        : parseFlowOpeningCanvasSceneForKind(
            loaded.kind,
            body.openingCanvasScene ?? body.opening_canvas_scene,
          );
    const generateProblemOnOpen =
      body.generateProblemOnOpen === undefined && body.generate_problem_on_open === undefined
        ? undefined
        : parseExactProblemOnCanvas(
            body.generateProblemOnOpen ?? body.generate_problem_on_open,
          );
    const answersModelSeed = !requestHasUnsysSeed(body)
      ? undefined
      : parseFlowUnsysSeed(unsysSeedFromRequestBody(body));
    const enforcedChannels =
      body.enforcedChannels === undefined && body.enforced_channels === undefined
        ? undefined
        : parseFlowEnforcedChannels(body.enforcedChannels ?? body.enforced_channels);
    const canvasCapture =
      body.canvasCapture === undefined && body.canvas_capture === undefined
        ? undefined
        : parseFlowCanvasCapture(body.canvasCapture ?? body.canvas_capture);

    if (loaded.kind === "solve") {
      const updated = await runSolveCommand({
        type: "update",
        ownerUserId: loaded.ownerUserId,
        workspaceId: loaded.workspaceId,
        flowId: id,
        name: typeof body.name === "string" ? body.name : undefined,
        topic: problem,
        artifacts,
        exactProblemOnCanvas,
        openingCanvasScene,
        generateProblemOnOpen,
        durationMinutes: body.durationMinutes as number | undefined,
        actionCatalog: body.actionCatalog as number | undefined,
        answersModelSeed,
        enforcedChannels,
        canvasCapture,
      });
      if (!updated.ok) return jsonError(400, updated.reason);
      return NextResponse.json({ flow: updated.flow, name: updated.flow?.name });
    }

    if (loaded.kind === "calibration") {
      const updated = await runCalibrationCommand({
        type: "update",
        ownerUserId: loaded.ownerUserId,
        workspaceId: loaded.workspaceId,
        flowId: id,
        name: typeof body.name === "string" ? body.name : undefined,
        goal: problem,
        topic: problem,
        artifacts,
        generateProblemOnOpen,
        durationMinutes: body.durationMinutes as number | undefined,
        actionCatalog: body.actionCatalog as number | undefined,
        answersModelSeed,
        enforcedChannels,
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
      topic: problem,
      artifacts,
      exactProblemOnCanvas,
      openingCanvasScene,
      generateProblemOnOpen,
      actionCatalog: body.actionCatalog as number | undefined,
      answersModelSeed,
      enforcedChannels,
      canvasCapture,
    });
    if (!updated.ok) return jsonError(400, updated.reason);
    return NextResponse.json({ flow: updated.flow, name: updated.flow?.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save flow";
    return jsonError(500, message);
  }
}
