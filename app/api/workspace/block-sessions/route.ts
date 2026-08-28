import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardWorkspaceRoute,
} from "@/lib/api/require-auth";
import { listBlockPreviousSessions } from "@/lib/block-previous-sessions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || body.workspace_id || "").trim();
    const blockId = String(body.blockId || body.block_id || "").trim();
    if (!workspaceId || !blockId) {
      return jsonError(400, "workspaceId and blockId are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const sessions = await listBlockPreviousSessions(auth.supabase, {
      workspaceId,
      blockId,
    });
    return NextResponse.json({ sessions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list sessions";
    return jsonError(500, message);
  }
}
