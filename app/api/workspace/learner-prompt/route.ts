import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, ileTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { buildLearnerPromptSaveBody } from "@/lib/workspace-learner-writes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = buildLearnerPromptSaveBody({
      workspaceId: String(body.workspaceId || ""),
      blockId: String(body.blockId || ""),
      planningPrompt: String(body.planningPrompt ?? body.planning_prompt ?? ""),
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    const workspaceId = String(payload.workspaceId || "");
    const blockId = String(payload.blockId || "");
    if (!workspaceId || !blockId) {
      return jsonError(400, "workspaceId and blockId are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const prompt = String(payload.planningPrompt || "").trim() || null;
    const { error } = await auth.supabase
      .from("blocks")
      .update({ planning_prompt: prompt })
      .eq("id", blockId)
      .eq("workspace_id", workspaceId);
    if (error) {
      return jsonError(500, error.message);
    }
    return NextResponse.json({ ok: true, planningPrompt: prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save prompt";
    return jsonError(500, message);
  }
}
