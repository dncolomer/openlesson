import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { toErrorCode } from "@/lib/api/error-codes";
import { requireTapbenchTaskAuth } from "@/lib/tapbench/task-auth";
import {
  assertTapbenchGuestForKey,
  supabaseTapbenchGuestStore,
} from "@/lib/tapbench/guests";
import { snapshotTapbenchSession } from "@/lib/tapbench/after-pow";
import { readJsonObject } from "@/lib/tapbench/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * Snapshot one guest run or all guests for this TAPBench key.
 * POST { guest_user_id? } or { guest_user_ids?: string[] }
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
  const store = supabaseTapbenchGuestStore(authed.supabase);

  const ids: string[] = [];
  if (typeof body.guest_user_id === "string" && body.guest_user_id.trim()) {
    ids.push(body.guest_user_id.trim());
  }
  if (Array.isArray(body.guest_user_ids)) {
    for (const raw of body.guest_user_ids) {
      if (typeof raw === "string" && raw.trim()) ids.push(raw.trim());
    }
  }

  try {
    const minted = await store.listByKey(authed.auth.key_id);
    const targets = ids.length
      ? minted.filter((g) => ids.includes(g.guest_user_id))
      : minted;
    if (ids.length && targets.length !== new Set(ids).size) {
      return errorResponse(404, "guest_not_found", "Unknown TAPBench guest for this key");
    }
    if (!targets.length) {
      return errorResponse(400, "validation_error", "Mint guests before snapshot");
    }
    for (const g of targets) {
      await assertTapbenchGuestForKey(store, authed.auth.key_id, g.guest_user_id);
    }

    const snapshots = [];
    for (const g of targets) {
      const wrap = await snapshotTapbenchSession({
        auth: authed.auth,
        supabase: authed.supabase,
        workspaceId,
        guestUserId: g.guest_user_id,
      });
      snapshots.push({
        guest_user_id: g.guest_user_id,
        label: g.label,
        snapshot: wrap?.snapshot ?? null,
      });
    }
    return NextResponse.json({ workspace_id: workspaceId, snapshots });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : "internal_error";
    const message = err instanceof Error ? err.message : "Failed to snapshot TAPBench guests";
    return errorResponse(status, toErrorCode(code), message);
  }
}
