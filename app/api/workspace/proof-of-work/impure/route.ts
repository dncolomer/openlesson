import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { flagIleSessionProofOfWorkImpure } from "@/lib/ile-session-purity";
import {
  ileTokenFromPowBody,
  requireSessionWorkspaceProofOfWorkAccess,
} from "@/lib/pow-api/workspace-session-access";
import { entryQueryParamsFromBody } from "@/lib/guest-link-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const sessionId =
      typeof body.session_id === "string"
        ? body.session_id
        : typeof body.sessionId === "string"
          ? body.sessionId
          : "";
    if (!sessionId) {
      return jsonError(400, "session_id is required");
    }

    const access = await requireSessionWorkspaceProofOfWorkAccess(workspaceId, sessionId, {
      ileToken: ileTokenFromPowBody(body),
      entryQueryParams: entryQueryParamsFromBody(body),
    });
    if (access instanceof NextResponse) return access;

    const updated = await flagIleSessionProofOfWorkImpure(
      access.supabase,
      workspaceId,
      sessionId,
    );

    return NextResponse.json({ ok: true, updated, session_quality: "impure" });
  } catch (error) {
    console.error("[workspace/proof-of-work/impure] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return jsonError(status, message);
  }
}
