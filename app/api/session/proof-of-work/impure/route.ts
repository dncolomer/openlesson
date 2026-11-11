import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { flagIleSessionProofOfWorkImpure } from "@/lib/learn-session-purity";
import {
  requireSessionProofAccess,
  sessionProofAccessFromBody,
} from "@/lib/session-proof-access";

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

    const access = await requireSessionProofAccess(sessionProofAccessFromBody(body));
    if (access instanceof NextResponse) return access;

    const sessionId = access.sessionId;
    if (!sessionId) return jsonError(400, "session_id is required");

    const updated = await flagIleSessionProofOfWorkImpure(
      access.supabase,
      access.workspaceId,
      sessionId,
    );

    return NextResponse.json({ ok: true, updated, session_quality: "impure" });
  } catch (error) {
    console.error("[session/proof-of-work/impure] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return jsonError(status, message);
  }
}
