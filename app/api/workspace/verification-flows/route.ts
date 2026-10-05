/**
 * Owner verification-flow list and create.
 * Question pools, public links, and skills are stored on the flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { assertWorkspacePolicy } from "@/lib/workspace-access-policy";
import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";
import {
  buildVerificationFlowSkillMarkdown,
  knowledgeRowsFromFlowResults,
  verificationFlowPublicPath,
} from "@/lib/verification-flow";
import {
  listVerificationFlows,
  listVerificationResults,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

export const runtime = "nodejs";

async function loadKind(workspaceId: string): Promise<unknown> {
  const auth = await requireProductWorkspaceEvalAuth(workspaceId, null);
  if (!auth.ok) return null;
  const { data } = await auth.supabase
    .from("workspaces")
    .select("workspace_kind")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.workspace_kind;
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
    if (!auth.ok) return auth.response;
    const origin = req.nextUrl.origin;
    const flows = await listVerificationFlows(workspaceId);
    const results = await listVerificationResults(workspaceId);
    return NextResponse.json({
      flows: flows.map((flow) => ({
        ...flow,
        publicPath: verificationFlowPublicPath(flow.publicToken),
        publicUrl: `${origin}${verificationFlowPublicPath(flow.publicToken)}`,
        skillMd: buildVerificationFlowSkillMarkdown({
          workspaceId,
          flowId: flow.id,
          topic: flow.topic,
          questions: flow.questions,
          publicToken: flow.publicToken,
          baseUrl: origin,
        }),
      })),
      results,
      rows: knowledgeRowsFromFlowResults(results),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list verification flows";
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

    const kind = await loadKind(workspaceId);
    if (kind && !isKnowledgeRegionWorkspace(kind)) {
      return jsonError(403, "Verification flows belong to Verification Workspaces");
    }

    const action = typeof body.action === "string" ? body.action : "create";
    if (action === "update") {
      const updated = await runVerificationCommand({
        type: "update",
        workspaceId,
        flowId: String(body.flowId || ""),
        topic: typeof body.topic === "string" ? body.topic : undefined,
        questions: body.questions,
        durationMinutes: body.durationMinutes as number | undefined,
      });
      if (!updated.ok) return jsonError(400, updated.reason);
      return NextResponse.json({ flow: updated.flow });
    }
    if (action === "remove") {
      const removed = await runVerificationCommand({
        type: "remove",
        workspaceId,
        flowId: String(body.flowId || ""),
      });
      if (!removed.ok) return jsonError(400, removed.reason);
      return NextResponse.json({ ok: true });
    }

    const created = await runVerificationCommand({
      type: "create",
      workspaceId,
      topic: String(body.topic || ""),
      questions: body.questions,
      durationMinutes: body.durationMinutes as number | undefined,
    });
    if (!created.ok || !created.flow) return jsonError(400, created.ok ? "create_failed" : created.reason);
    const origin = req.nextUrl.origin;
    return NextResponse.json({
      flow: created.flow,
      publicPath: verificationFlowPublicPath(created.flow.publicToken),
      publicUrl: `${origin}${verificationFlowPublicPath(created.flow.publicToken)}`,
      skillMd: buildVerificationFlowSkillMarkdown({
        workspaceId,
        flowId: created.flow.id,
        topic: created.flow.topic,
        questions: created.flow.questions,
        publicToken: created.flow.publicToken,
        baseUrl: origin,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save verification flow";
    return jsonError(500, message);
  }
}
