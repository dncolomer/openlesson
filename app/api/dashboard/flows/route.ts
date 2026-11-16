/**
 * Owner dashboard: list and publish first-class Verification/Calibration/Solve flows.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardFlowsByCreatedAt,
  type DashboardRecentFlow,
} from "@/lib/dashboard-home";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  parseExactProblemOnCanvas,
  parseProductFlowKind,
  productFlowOwnerTitle,
  productFlowPagePath,
} from "@/lib/product-flow";
import { parseFlowArtifacts, flowProblemFromUnknown } from "@/lib/flow-artifacts";
import { parseFlowUnsysSeed } from "@/lib/flow-unsys-seed";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { solveFlowPublicPath } from "@/lib/solve-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  listCalibrationFlowsForOwnerUserId,
  runCalibrationCommand,
} from "@/lib/calibration-flow-repository";
import {
  listSolveFlowsForOwnerUserId,
  runSolveCommand,
} from "@/lib/solve-flow-repository";
import {
  listVerificationFlowsForOwnerUserId,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

function presentVerification(row: {
  id: string;
  name: string;
  topic: string;
  workspaceId: string;
  createdAt: string;
  publicToken: string;
  questions: unknown;
}): DashboardRecentFlow | null {
  return presentDashboardRecentFlow({
    id: row.id,
    kind: "verify",
    name: row.name,
    title: row.topic,
    workspaceId: row.workspaceId,
    workspaceTitle: productFlowOwnerTitle("verification"),
    createdAt: row.createdAt,
    publicToken: row.publicToken,
    topic: row.topic,
    questionCount: questionCountFromUnknown(row.questions),
  });
}

function presentSolve(row: {
  id: string;
  name: string;
  topic: string;
  workspaceId: string;
  createdAt: string;
  publicToken: string;
}): DashboardRecentFlow | null {
  return presentDashboardRecentFlow({
    id: row.id,
    kind: "solve",
    name: row.name,
    title: row.topic,
    workspaceId: row.workspaceId,
    workspaceTitle: productFlowOwnerTitle("solve"),
    createdAt: row.createdAt,
    publicToken: row.publicToken,
    topic: row.topic,
    questionCount: 0,
  });
}

function presentCalibration(row: {
  id: string;
  name: string;
  goal: string;
  topic?: string;
  workspaceId: string;
  createdAt: string;
  publicToken: string;
  questions: unknown;
}): DashboardRecentFlow | null {
  return presentDashboardRecentFlow({
    id: row.id,
    kind: "calibrate",
    name: row.name,
    title: row.goal || row.topic,
    workspaceId: row.workspaceId,
    workspaceTitle: productFlowOwnerTitle("calibration"),
    createdAt: row.createdAt,
    publicToken: row.publicToken,
    topic: row.topic || row.goal,
    questionCount: questionCountFromUnknown(row.questions),
  });
}

async function listOwnerFlows(
  userId: string,
  kind: "verification" | "calibration" | "solve",
): Promise<DashboardRecentFlow[]> {
  if (kind === "calibration") {
    const flows = await listCalibrationFlowsForOwnerUserId(userId);
    return flows
      .map((flow) => presentCalibration(flow))
      .filter((row): row is DashboardRecentFlow => Boolean(row));
  }
  if (kind === "solve") {
    const flows = await listSolveFlowsForOwnerUserId(userId);
    return flows
      .map((flow) => presentSolve(flow))
      .filter((row): row is DashboardRecentFlow => Boolean(row));
  }
  const flows = await listVerificationFlowsForOwnerUserId(userId);
  return flows
    .map((flow) => presentVerification(flow))
    .filter((row): row is DashboardRecentFlow => Boolean(row));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const kind = parseProductFlowKind(new URL(req.url).searchParams.get("kind"));
    const kinds = kind ? [kind] : (["solve", "verification", "calibration"] as const);
    const listed = sortDashboardFlowsByCreatedAt(
      (await Promise.all(kinds.map((item) => listOwnerFlows(auth.user.id, item)))).flat(),
    );
    return NextResponse.json({ kind: kind ?? "all", flows: listed });
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
    if (!kind) return jsonError(400, "kind must be verification, calibration, or solve");
    const workspaceId =
      String(body.workspaceId || body.workspace_id || "").trim() || undefined;
    const problem = flowProblemFromUnknown(body);
    const draft = {
      ...emptyProductFlowDraft(kind),
      name: String(body.name || ""),
      topic: problem,
      goal: problem,
      artifacts: parseFlowArtifacts(body.artifacts),
      actionCatalog: Number(body.actionCatalog) || 4,
      durationMinutes: Number(body.durationMinutes) || 15,
      exactProblemOnCanvas: parseExactProblemOnCanvas(body.exactProblemOnCanvas),
      answersModelSeed: parseFlowUnsysSeed(body.answersModelSeed ?? body.answers_model_seed),
    };
    const accepted = acceptProductFlowPublish(draft);
    if (!accepted.ok) return jsonError(400, accepted.reason);

    if (kind === "solve") {
      const created = await runSolveCommand({
        type: "create",
        ownerUserId: auth.user.id,
        workspaceId,
        name: accepted.name,
        topic: accepted.topic,
        artifacts: accepted.artifacts,
        exactProblemOnCanvas: accepted.exactProblemOnCanvas,
        durationMinutes: accepted.durationMinutes,
        actionCatalog: accepted.actionCatalog,
        answersModelSeed: accepted.answersModelSeed,
      });
      if (!created.ok || !created.flow) {
        return jsonError(400, created.ok ? "create_failed" : created.reason);
      }
      const origin = req.nextUrl.origin;
      return NextResponse.json({
        kind,
        flow: created.flow,
        name: created.flow.name,
        flowPath: productFlowPagePath("solve", created.flow.id),
        publicPath: solveFlowPublicPath(created.flow.publicToken),
        publicUrl: `${origin}${solveFlowPublicPath(created.flow.publicToken)}`,
      });
    }

    if (kind === "calibration") {
      const created = await runCalibrationCommand({
        type: "create",
        ownerUserId: auth.user.id,
        workspaceId,
        name: accepted.name,
        goal: accepted.goal,
        topic: accepted.topic,
        artifacts: accepted.artifacts,
        durationMinutes: accepted.durationMinutes,
        actionCatalog: accepted.actionCatalog,
        answersModelSeed: accepted.answersModelSeed,
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
      ownerUserId: auth.user.id,
      workspaceId,
      name: accepted.name,
      topic: accepted.topic,
      artifacts: accepted.artifacts,
      exactProblemOnCanvas: accepted.exactProblemOnCanvas,
      actionCatalog: accepted.actionCatalog,
      answersModelSeed: accepted.answersModelSeed,
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
