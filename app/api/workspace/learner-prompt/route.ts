import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "workspaceId and blockId are required" }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, planningPrompt: prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
