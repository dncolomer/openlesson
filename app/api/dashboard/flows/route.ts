/**
 * Owner dashboard: list and publish first-class Verification/Calibration flows.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardRecentFlows,
  type DashboardRecentFlow,
} from "@/lib/dashboard-home";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  parseProductFlowKind,
  productFlowPagePath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import {
  ensureProductFlowOwnerWorkspace,
  listProductFlowWorkspaceIds,
} from "@/lib/product-flow-owner";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  listCalibrationFlowsForWorkspaceIds,
  runCalibrationCommand,
} from "@/lib/calibration-flow-repository";
import {
  listVerificationFlowsForWorkspaceIds,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

function presentVerification(
  row: {
    id: string;
    name: string;
    topic: string;
    workspaceId: string;
    createdAt: string;
    publicToken: string;
    questions: unknown;
  },
  workspaceTitle: string,
): DashboardRecentFlow | null {
  return presentDashboardRecentFlow({
    id: row.id,
    kind: "verify",
    name: row.name,
    title: row.topic,
    workspaceId: row.workspaceId,
    workspaceTitle,
    createdAt: row.createdAt,
    publicToken: row.publicToken,
    questionCount: questionCountFromUnknown(row.questions),
  });
}

function presentCalibration(
  row: {
    id: string;
    name: string;
    goal: string;
    workspaceId: string;
    createdAt: string;
    publicToken: string;
    questions: unknown;
  },
  workspaceTitle: string,
): DashboardRecentFlow | null {
  return presentDashboardRecentFlow({
    id: row.id,
    kind: "calibrate",
    name: row.name,
    title: row.goal,
    workspaceId: row.workspaceId,
    workspaceTitle,
    createdAt: row.createdAt,
    publicToken: row.publicToken,
    questionCount: questionCountFromUnknown(row.questions),
  });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const kind = parseProductFlowKind(new URL(req.url).searchParams.get("kind"));
    if (!kind) return jsonError(400, "kind must be verification or calibration");

    const workspaceIds = await listProductFlowWorkspaceIds(auth.supabase, auth.user.id, kind);
    const { data: workspaces } = await auth.supabase
      .from("workspaces")
      .select("id, title, root_topic")
      .in("id", workspaceIds.length ? workspaceIds : ["__none__"]);
    const titles = new Map(
      (workspaces || []).map((row) => [
        String(row.id),
        String(row.title || row.root_topic || "Workspace"),
      ]),
    );

    if (kind === "calibration") {
      const flows = await listCalibrationFlowsForWorkspaceIds(workspaceIds);
      const listed = sortDashboardRecentFlows(
        flows
          .map((flow) => presentCalibration(flow, titles.get(flow.workspaceId) || "Workspace"))
          .filter((row): row is DashboardRecentFlow => Boolean(row)),
        100,
      );
      return NextResponse.json({ kind, flows: listed });
    }

    const flows = await listVerificationFlowsForWorkspaceIds(workspaceIds);
    const listed = sortDashboardRecentFlows(
      flows
        .map((flow) => presentVerification(flow, titles.get(flow.workspaceId) || "Workspace"))
        .filter((row): row is DashboardRecentFlow => Boolean(row)),
      100,
    );
    return NextResponse.json({ kind, flows: listed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list flows";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const kind = parseProductFlowKind(body.kind);
    if (!kind) return jsonError(400, "kind must be verification or calibration");
    const draft = {
      ...emptyProductFlowDraft(kind),
      name: String(body.name || ""),
      topic: String(body.topic || ""),
      goal: String(body.goal || ""),
      questions: Array.isArray(body.questions) ? body.questions.map((item) => String(item)) : [],
      actionCatalog: Number(body.actionCatalog) || 4,
      durationMinutes: Number(body.durationMinutes) || 15,
    };
    const accepted = acceptProductFlowPublish(draft);
    if (!accepted.ok) return jsonError(400, accepted.reason);

    const owner = await ensureProductFlowOwnerWorkspace(auth.supabase, auth.user.id, kind);
    if ("error" in owner) return jsonError(500, owner.error);

    if (kind === "calibration") {
      const created = await runCalibrationCommand({
        type: "create",
        workspaceId: owner.id,
        name: accepted.name,
        goal: accepted.goal,
        questions: accepted.questions,
        durationMinutes: accepted.durationMinutes,
        actionCatalog: accepted.actionCatalog,
      });
      if (!created.ok || !created.flow) {
        return jsonError(400, created.ok ? "create_failed" : created.reason);
      }
      const origin = req.nextUrl.origin;
      return NextResponse.json({
        kind,
        flow: created.flow,
        name: created.flow.name,
        flowPath: productFlowPagePath("calibration", created.flow.id),
        publicPath: calibrationFlowPublicPath(created.flow.publicToken),
        publicUrl: `${origin}${calibrationFlowPublicPath(created.flow.publicToken)}`,
      });
    }

    const created = await runVerificationCommand({
      type: "create",
      workspaceId: owner.id,
      name: accepted.name,
      topic: accepted.topic,
      questions: accepted.questions,
      actionCatalog: accepted.actionCatalog,
    });
    if (!created.ok || !created.flow) {
      return jsonError(400, created.ok ? "create_failed" : created.reason);
    }
    const origin = req.nextUrl.origin;
    return NextResponse.json({
      kind,
      flow: created.flow,
      name: created.flow.name,
      flowPath: productFlowPagePath("verification", created.flow.id),
      publicPath: verificationFlowPublicPath(created.flow.publicToken),
      publicUrl: `${origin}${verificationFlowPublicPath(created.flow.publicToken)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish flow";
    return jsonError(500, message);
  }
}
