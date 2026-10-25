/**
 * Session restart used to delete xAI files. Proof of work is the corpus:
 * this endpoint no longer deletes files or rows.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return jsonError(400, "sessionId required");
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    return NextResponse.json({ success: true, deleted: 0, preserved: true });
  } catch (err) {
    console.error("[session-files/cleanup] Error:", err);
    return jsonError(500, "Internal server error");
  }
}
