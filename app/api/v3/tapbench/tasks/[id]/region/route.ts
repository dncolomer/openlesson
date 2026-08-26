import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { toErrorCode } from "@/lib/api/error-codes";
import { requireTapbenchTaskAuth } from "@/lib/tapbench/task-auth";
import { createTapbenchRegionFromGuests } from "@/lib/tapbench/region";
import { readJsonObject } from "@/lib/tapbench/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * Build a knowledge region from guest-run snapshots.
 * POST { guest_user_ids?: string[], name?: string }
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
  const guestUserIds = Array.isArray(body.guest_user_ids)
    ? body.guest_user_ids.filter((x): x is string => typeof x === "string")
    : typeof body.guest_user_id === "string"
      ? [body.guest_user_id]
      : null;
  const name = typeof body.name === "string" ? body.name : null;
  try {
    const region = await createTapbenchRegionFromGuests({
      supabase: authed.supabase,
      auth: authed.auth,
      workspaceId,
      guestUserIds,
      name,
    });
    return NextResponse.json({ workspace_id: workspaceId, region }, { status: 201 });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err && typeof err.status === "number"
        ? err.status
        : 400;
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : "validation_error";
    const message = err instanceof Error ? err.message : "Failed to build TAPBench region";
    return errorResponse(status, toErrorCode(code), message);
  }
}
