/**
 * Owner dashboard: list and publish knowledge verification protocols.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardFlowsByCreatedAt,
} from "@/lib/dashboard-home";
import {
  acceptProtocolPublish,
  emptyProtocolDraft,
  parseExactProblemOnCanvas,
  productFlowOwnerTitle,
  productFlowPagePath,
  protocolChallengeFromUnknown,
  rejectedProtocolKind,
} from "@/lib/product-flow";
import { parseFlowArtifacts } from "@/lib/flow-artifacts";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import { unsysSeedFromRequestBody } from "@/lib/unsys-tree-spec";
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
  listVerificationFlowsForDashboard,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    if (rejectedProtocolKind(new URL(req.url).searchParams.get("kind"))) {
      return jsonError(400, "Only knowledge verification protocols are supported");
    }
    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const organizationId = org.organizationId;
    const flows = await listVerificationFlowsForDashboard({
      ownerUserId: auth.user.id,
      organizationId,
    });
    const listed = sortDashboardFlowsByCreatedAt(
      flows
        .map((flow) =>
          presentDashboardRecentFlow({
            id: flow.id,
            name: flow.name,
            title: flow.topic,
            workspaceId: flow.workspaceId,
            workspaceTitle: productFlowOwnerTitle(),
            createdAt: flow.createdAt,
            publicToken: flow.publicToken,
            challenge: flow.topic,
            topic: flow.topic,
            questionCount: questionCountFromUnknown(flow.questions),
          }),
        )
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    );
    return NextResponse.json({ protocols: listed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list protocols";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    if (rejectedProtocolKind(body.kind ?? body.type ?? body.product)) {
      return jsonError(400, "Only knowledge verification protocols are supported");
    }
    const workspaceId =
      String(body.workspaceId || body.workspace_id || "").trim() || undefined;
    const challenge = protocolChallengeFromUnknown(body);
    const draft = {
      ...emptyProtocolDraft(),
      name: String(body.name || ""),
      challenge,
      artifacts: parseFlowArtifacts(body.artifacts),
      actionCatalog: Number(body.actionCatalog) || 4,
      durationMinutes: Number(body.durationMinutes) || 15,
      exactProblemOnCanvas: parseExactProblemOnCanvas(body.exactProblemOnCanvas),
      openingCanvasScene: parseFlowOpeningCanvasScene(
        body.openingCanvasScene ?? body.opening_canvas_scene,
      ),
      generateProblemOnOpen: parseExactProblemOnCanvas(
        body.generateProblemOnOpen ?? body.generate_problem_on_open,
      ),
      answersModelSeed: parseFlowUnsysSeed(
        unsysSeedFromRequestBody(body) ?? body.answersModelSeed ?? body.answers_model_seed,
      ),
      enforcedChannels: parseFlowEnforcedChannels(
        body.enforcedChannels ?? body.enforced_channels,
      ),
      canvasCapture: parseFlowCanvasCapture(body.canvasCapture ?? body.canvas_capture),
      protocolSettingId: parseProtocolSettingId(
        body.protocol_setting_id ?? body.protocolSettingId,
      ),
    };
    const accepted = acceptProtocolPublish(draft);
    if (!accepted.ok) return jsonError(400, accepted.reason);

    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
      body,
    });
    if (!org.ok) return org.response;
    const organizationId = org.organizationId;
    let protocolSettingId = accepted.protocolSettingId;
    if (organizationId) {
      try {
        protocolSettingId = await assertProtocolSettingInOrg(
          createAdminClient(),
          organizationId,
          accepted.protocolSettingId,
        );
      } catch (error) {
        if (isProtocolSettingsError(error)) return jsonError(error.status, error.message);
        throw error;
      }
    } else {
      protocolSettingId = null;
    }
    const created = await runVerificationCommand({
      type: "create",
      ownerUserId: auth.user.id,
      organizationId: organizationId || undefined,
      workspaceId,
      name: accepted.name,
      topic: accepted.challenge,
      artifacts: accepted.artifacts,
      exactProblemOnCanvas: accepted.exactProblemOnCanvas,
      openingCanvasScene: accepted.openingCanvasScene,
      generateProblemOnOpen: accepted.generateProblemOnOpen,
      durationMinutes: accepted.durationMinutes,
      actionCatalog: accepted.actionCatalog,
      answersModelSeed: accepted.answersModelSeed,
      enforcedChannels: accepted.enforcedChannels,
      canvasCapture: accepted.canvasCapture,
      protocolSettingId,
    });
    if (!created.ok || !created.flow) {
      return jsonError(400, created.ok ? "create_failed" : created.reason);
    }
    const origin = req.nextUrl.origin;
    const protocolPath = productFlowPagePath(created.flow.id);
    return NextResponse.json({
      protocol: created.flow,
      name: created.flow.name,
      challenge: created.flow.topic,
      protocolPath,
      publicPath: verificationFlowPublicPath(created.flow.publicToken),
      publicUrl: `${origin}${verificationFlowPublicPath(created.flow.publicToken)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish protocol";
    return jsonError(500, message);
  }
}
