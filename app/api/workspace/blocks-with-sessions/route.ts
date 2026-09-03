import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardWorkspaceRoute,
} from "@/lib/api/require-auth";
import { listWorkspaceBlockIdsWithPreviousSessions } from "@/lib/block-previous-sessions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || body.workspace_id || "").trim();
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const blockIds = await listWorkspaceBlockIdsWithPreviousSessions(auth.supabase, {
      workspaceId,
    });
    return NextResponse.json({ blockIds });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list sessions";
    return jsonError(500, message);
  }
}
