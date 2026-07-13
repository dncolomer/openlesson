import { NextRequest, NextResponse } from "next/server";
import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { generateTapStartingTopics, getTapScoreBrief, getTapScoreBriefForUser } from "@/lib/tap-score";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const privateToken = body.privateToken ? String(body.privateToken) : "";
    const workspaceId = body.workspaceId ? String(body.workspaceId) : "";
    const blockId = body.blockId ? String(body.blockId) : null;
    const focusSessionId = body.sessionId ? String(body.sessionId) : null;
    const minutes = Math.max(1, Number(body.minutes || 15));
    const tapSessionId = body.tapSessionId ? String(body.tapSessionId) : "";

    const access = await resolveTapSessionAccess({
      privateToken,
      workspaceId,
      tapSessionId,
      blockId,
      focusSessionId,
    });
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const focusNodeIds = blockId ? [blockId] : access.blockId ? [access.blockId] : [];
    const resolvedFocusSessionId = focusSessionId || access.focusSessionId;
    const { brief } = access.userId
      ? await getTapScoreBriefForUser(access.workspaceId, access.userId, focusNodeIds, true, resolvedFocusSessionId)
      : await getTapScoreBrief(access.workspaceId, focusNodeIds, resolvedFocusSessionId);

    const topics = await generateTapStartingTopics(brief, minutes);
    return NextResponse.json({ topics });
  } catch (error) {
    console.error("[workspace-tap-score/topics] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}