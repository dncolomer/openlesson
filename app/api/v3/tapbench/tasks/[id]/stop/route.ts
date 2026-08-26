import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { toErrorCode } from "@/lib/api/error-codes";
import { requireTapbenchTaskAuth } from "@/lib/tapbench/task-auth";
import { stopTapbenchSession } from "@/lib/tapbench/stop";
import { readJsonObject } from "@/lib/tapbench/http";
import { tapbenchGuestIdFromRequest } from "@/lib/tapbench/guests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * Stop one guest run. The TAPBench key stays live.
 * POST { guest_user_id, snapshot?: boolean }
 */
export async function POST(req: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const workspaceId = typeof id === "string" ? id.trim() : "";
  if (!workspaceId) {
    return errorResponse(400, "validation_error", "Benchmark Task id is required");
  }

  const authed = await requireTapbenchTaskAuth(req, workspaceId);
  if (!authed.ok) return authed.response;
  const body = await readJsonObject(req);
  const guestUserId = tapbenchGuestIdFromRequest(req, body);
  if (!guestUserId) {
    return errorResponse(400, "validation_error", "guest_user_id is required to stop a run");
  }
  const snapshot = body.snapshot === true;

  try {
    const result = await stopTapbenchSession({
      auth: authed.auth,
      supabase: authed.supabase,
      workspaceId,
      guestUserId,
      snapshot,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : "internal_error";
    const message = err instanceof Error ? err.message : "Failed to stop TAPBench guest run";
    return errorResponse(status, toErrorCode(code), message);
  }
}
