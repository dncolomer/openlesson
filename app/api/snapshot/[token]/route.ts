import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseSnapshotShareBackend,
  lookupSnapshotShare,
  normalizeSnapshotShareToken,
} from "@/lib/pow-api/snapshot-share";

export const runtime = "nodejs";

/**
 * GET /api/snapshot/[token]
 * Unauthenticated public lookup. Unknown/unpublished tokens return no snapshot payload.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  const token = normalizeSnapshotShareToken(rawToken);
  if (!token) {
    return jsonError(404, "Snapshot not found");
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Supabase admin client is not configured";
    return jsonError(503, message);
  }

  const landing = await lookupSnapshotShare(
    createSupabaseSnapshotShareBackend(supabase),
    token,
  );
  if (!landing) {
    return jsonError(404, "Snapshot not found");
  }

  return NextResponse.json({ landing });
}
