/**
 * Owner dashboard: one knowledge verification protocol.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  flowOwnedByUser,
  parseExactProblemOnCanvas,
  productFlowPagePath,
  rejectedProtocolKind,
} from "@/lib/product-flow";
import { flowProblemFromUnknown, parseFlowArtifacts } from "@/lib/flow-artifacts";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import { requestHasUnsysSeed, unsysSeedFromRequestBody } from "@/lib/unsys-tree-spec";
import { parseFlowEnforcedChannels } from "@/lib/flow-channels";
import { parseFlowCanvasCapture } from "@/lib/flow-canvas-capture";
import { parseFlowOpeningCanvasScene } from "@/lib/flow-opening-canvas";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import {
  isProtocolSettingsError,
  parseProtocolSettingId,
} from "@/lib/organization/protocol-settings";
import { assertProtocolSettingInOrg } from "@/lib/organization/protocol-settings-store";
import { createAdminClient } from "@/lib/supabase/admin";
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
  body?: Record<string, unknown> | null,
): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      ownerUserId: string;
      workspaceId: string;
      flow: Record<string, unknown>;
      origin: string;
    }
> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  if (rejectedProtocolKind(req.nextUrl.searchParams.get("kind"))) {
    return {
      ok: false,
      response: jsonError(400, "Only knowledge verification protocols are supported"),
    };
  }
  const org = await resolveDashboardOrganizationId({
    req,
    userId: auth.user.id,
    email: auth.user.email,
    body,
  });
  if (!org.ok) return org;
  const flow = await getVerificationFlowById(id);
  if (!flow) return { ok: false, response: jsonError(404, "Protocol not found") };
  const flowOrg = String(flow.organizationId || "").trim();
  const requestedOrg = String(org.organizationId || "").trim();
  const inOrg = Boolean(requestedOrg && flowOrg && flowOrg === requestedOrg);
  if (flowOwnedByUser(flow, auth.user.id) || inOrg) {
    return {
      ok: true,
      ownerUserId: auth.user.id,
      workspaceId: flow.workspaceId,
      flow,
      origin: req.nextUrl.origin,
    };
  }
  return { ok: false, response: jsonError(404, "Protocol not found") };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const loaded = await loadOwnedFlow(req, id);
    if (!loaded.ok) return loaded.response;
    const publicPath = verificationFlowPublicPath(
      String(loaded.flow.publicToken || ""),
    );
    const links = await listFlowLinksForFlow({
      ownerUserId: loaded.ownerUserId,
      flowKind: "verification",
      flowId: id,
    });
    return NextResponse.json({
      protocol: loaded.flow,
      name: loaded.flow.name,
      challenge: loaded.flow.topic,
      protocolPath: productFlowPagePath(id),
      publicPath,
      publicUrl: `${loaded.origin}${publicPath}`,
      links: presentOwnedLinks(links, loaded.origin),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load protocol";
    return jsonError(500, message);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    const loaded = await loadOwnedFlow(req, id, body);
    if (!loaded.ok) return loaded.response;
    const action = typeof body.action === "string" ? body.action : "update";
    if (action === "addLink") {
      const created = await createFlowLink({
        ownerUserId: loaded.ownerUserId,
        flowKind: "verification",
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
      body.problem === undefined &&
      body.topic === undefined &&
      body.goal === undefined &&
      body.challenge === undefined
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
        : parseFlowOpeningCanvasScene(
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
    const protocolSettingId =
      body.protocol_setting_id === undefined && body.protocolSettingId === undefined
        ? undefined
        : parseProtocolSettingId(body.protocol_setting_id ?? body.protocolSettingId);
    if (protocolSettingId !== undefined) {
      const flowOrg = String(loaded.flow.organizationId || "").trim();
      if (flowOrg) {
        try {
          await assertProtocolSettingInOrg(createAdminClient(), flowOrg, protocolSettingId);
        } catch (error) {
          if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
          throw error;
        }
      }
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
      protocolSettingId,
    });
    if (!updated.ok) return jsonError(400, updated.reason);
    return NextResponse.json({
      protocol: updated.flow,
      name: updated.flow?.name,
      challenge: updated.flow?.topic,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save protocol";
    return jsonError(500, message);
  }
}
