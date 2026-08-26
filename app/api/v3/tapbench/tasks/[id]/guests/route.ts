import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { toErrorCode } from "@/lib/api/error-codes";
import { requireTapbenchTaskAuth } from "@/lib/tapbench/task-auth";
import { mintTapbenchGuests, supabaseTapbenchGuestStore } from "@/lib/tapbench/guests";
import { readJsonObject } from "@/lib/tapbench/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/** List guests minted by this TAPBench key. */
export async function GET(req: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const workspaceId = typeof id === "string" ? id.trim() : "";
  if (!workspaceId) {
    return errorResponse(400, "validation_error", "Benchmark Task id is required");
  }
  const authed = await requireTapbenchTaskAuth(req, workspaceId);
  if (!authed.ok) return authed.response;
  const guests = await supabaseTapbenchGuestStore(authed.supabase).listByKey(authed.auth.key_id);
  return NextResponse.json({ workspace_id: workspaceId, guests });
}

/** Mint one or more guest runs for this TAPBench key. Body: { count?, label? } */
export async function POST(req: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const workspaceId = typeof id === "string" ? id.trim() : "";
  if (!workspaceId) {
    return errorResponse(400, "validation_error", "Benchmark Task id is required");
  }
  const authed = await requireTapbenchTaskAuth(req, workspaceId);
  if (!authed.ok) return authed.response;
  const body = await readJsonObject(req);
  const count = typeof body.count === "number" ? body.count : 1;
  const label = typeof body.label === "string" ? body.label : null;
  try {
    const guests = await mintTapbenchGuests({
      supabase: authed.supabase,
      auth: authed.auth,
      workspaceId,
      count,
      label,
    });
    return NextResponse.json({ workspace_id: workspaceId, guests }, { status: 201 });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : "internal_error";
    const message = err instanceof Error ? err.message : "Failed to mint TAPBench guests";
    return errorResponse(status, toErrorCode(code), message);
  }
}
