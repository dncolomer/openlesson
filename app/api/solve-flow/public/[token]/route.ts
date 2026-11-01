/**
 * Public Solve-flow entry: unique identity, then a Learn work-canvas session
 * parented on the Solve flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  claimSolveIdentity,
  getSolveFlowByToken,
  getSolveSessionById,
  saveSolveSessionRow,
  solveSessionBelongsToFlow,
} from "@/lib/solve-flow-repository";
import {
  insufficientCreditsResponse,
  runnerUserIdFromCookies,
} from "@/lib/credits/request-runner";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const flow = await getSolveFlowByToken(token);
  if (!flow) return jsonError(404, "Solve flow not found");
  return NextResponse.json({
    topic: flow.topic,
    name: flow.name,
    durationMinutes: flow.durationMinutes,
    actionCatalog: flow.actionCatalog,
    flowId: flow.id,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const flow = await getSolveFlowByToken(token);
  if (!flow) return jsonError(404, "Solve flow not found");
  const body = (await req.json().catch(() => ({}))) as {
    identity?: string;
    sessionId?: string;
    session?: Record<string, unknown>;
  };
  const sessionId = String(body.sessionId || "").trim();
  if (sessionId && body.session && typeof body.session === "object") {
    const existing = await getSolveSessionById(sessionId);
    if (!existing || !solveSessionBelongsToFlow(existing as Record<string, unknown>, flow.id)) {
      return jsonError(404, "Session not found");
    }
    const session = await saveSolveSessionRow(sessionId, body.session);
    if (!session) return jsonError(404, "Session not found");
    return NextResponse.json({ session });
  }
  if (sessionId) {
    const session = await getSolveSessionById(sessionId);
    if (!session || !solveSessionBelongsToFlow(session as Record<string, unknown>, flow.id)) {
      return jsonError(404, "Session not found");
    }
    return NextResponse.json({ session });
  }
  let claimed;
  try {
    claimed = await claimSolveIdentity(token, String(body.identity || ""), {
      runnerUserId: await runnerUserIdFromCookies(),
    });
  } catch (error) {
    const credits = insufficientCreditsResponse(error);
    if (credits) return credits;
    throw error;
  }
  if (!claimed.ok) {
    const status = claimed.reason === "not_found" ? 404 : 400;
    return jsonError(status, claimed.reason);
  }
  return NextResponse.json({
    identity: claimed.identity,
    sessionId: claimed.sessionId,
    topic: claimed.flow.topic,
    name: claimed.flow.name,
    durationMinutes: claimed.flow.durationMinutes,
    actionCatalog: claimed.flow.actionCatalog,
    flowId: claimed.flow.id,
  });
}
